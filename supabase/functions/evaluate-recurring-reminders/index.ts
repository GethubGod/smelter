// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2?no-dts';
import { corsHeaders } from '../_shared/cors.ts';
import {
  getReminderSystemSettings,
  getRequesterFromToken,
} from '../_shared/reminders.ts';
import type { ReminderLocationGroup } from '../_shared/recurringReminderScope.ts';
import { evaluateRecurringRule } from './evaluator.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const cronSecret = Deno.env.get('CRON_SECRET');

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const token = authHeader.replace('Bearer ', '').trim();
  let authorized = false;
  let actorUserId: string | null = null;

  if (cronSecret && token === cronSecret) {
    authorized = true;
  } else {
    const requester = await getRequesterFromToken(supabaseAdmin, token);
    if (!requester) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }
    if (requester.suspended) {
      return jsonResponse({ error: 'Suspended accounts cannot run reminders' }, 403);
    }
    if (requester.role !== 'manager') {
      return jsonResponse({ error: 'Only managers can run recurring reminders' }, 403);
    }
    authorized = true;
    actorUserId = requester.userId;
  }

  if (!authorized) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  let dryRun = false;
  try {
    const payload = await req.json().catch(() => ({}));
    dryRun = Boolean(payload?.dryRun);
  } catch {
    // ignore invalid body and continue with defaults
  }

  const settings = await getReminderSystemSettings(supabaseAdmin);
  const now = new Date();

  const { data: rules, error: rulesError } = await supabaseAdmin
    .from('recurring_reminder_rules')
    .select('*')
    .eq('enabled', true)
    .order('created_at', { ascending: true });

  if (rulesError) {
    return jsonResponse({ error: rulesError.message || 'Unable to load recurring rules' }, 500);
  }

  const enabledRules = rules ?? [];
  if (enabledRules.length === 0) {
    return jsonResponse({
      success: true,
      evaluatedRules: 0,
      dueRules: 0,
      remindersSent: 0,
      skippedByCondition: 0,
      skippedByRateLimit: 0,
      dryRun,
    });
  }

  const employeeIdsFromRules = new Set<string>();
  const locationIdsFromRules = new Set<string>();
  enabledRules.forEach((rule: any) => {
    if (rule.scope === 'employee' && rule.employee_id) employeeIdsFromRules.add(rule.employee_id);
    if (rule.scope === 'location' && rule.location_id) locationIdsFromRules.add(rule.location_id);
  });

  const { data: allEmployees, error: employeeError } = await supabaseAdmin
    .from('users')
    .select('id, name, email, default_location_id, role')
    .eq('role', 'employee');

  if (employeeError) {
    return jsonResponse({ error: employeeError.message || 'Unable to load employees' }, 500);
  }

  const employees = (allEmployees ?? []).filter((employee: any) => {
    if (employeeIdsFromRules.size > 0 && employeeIdsFromRules.has(employee.id)) return true;
    if (locationIdsFromRules.size > 0 && employee.default_location_id && locationIdsFromRules.has(employee.default_location_id)) {
      return true;
    }
    return false;
  });

  const employeeById = new Map(employees.map((row: any) => [row.id, row]));
  const employeesByLocation = new Map<string, any[]>();
  employees.forEach((employee: any) => {
    const key = employee.default_location_id || '__none__';
    const list = employeesByLocation.get(key) || [];
    list.push(employee);
    employeesByLocation.set(key, list);
  });

  const targetEmployeeIds = employees.map((employee: any) => employee.id);
  const ordersByEmployeeId = new Map<string, any[]>();
  const locationGroupById = new Map<string, ReminderLocationGroup>();

  if (enabledRules.some((rule: any) => rule.rule_kind === 'checklist_order_day')) {
    const { data: locations, error: locationsError } = await supabaseAdmin
      .from('locations')
      .select('id, short_code');
    if (locationsError) {
      return jsonResponse({ error: locationsError.message || 'Unable to load reminder locations' }, 500);
    }
    (locations ?? []).forEach((location: any) => {
      const prefix = typeof location.short_code === 'string'
        ? location.short_code.trim().toLowerCase().charAt(0)
        : '';
      if (prefix === 's') locationGroupById.set(location.id, 'sushi');
      if (prefix === 'p') locationGroupById.set(location.id, 'poki');
    });
  }

  if (targetEmployeeIds.length > 0) {
    const { data: recentOrders } = await supabaseAdmin
      .from('orders')
      .select('id, user_id, location_id, created_at, status')
      .in('user_id', targetEmployeeIds)
      .neq('status', 'draft')
      .order('created_at', { ascending: false });

    (recentOrders ?? []).forEach((order: any) => {
      const employeeOrders = ordersByEmployeeId.get(order.user_id) ?? [];
      employeeOrders.push(order);
      ordersByEmployeeId.set(order.user_id, employeeOrders);
    });
  }

  let evaluatedRules = 0;
  let dueRules = 0;
  let remindersSent = 0;
  let skippedByCondition = 0;
  let skippedByRateLimit = 0;
  const errors: { ruleId: string; employeeId?: string; message: string }[] = [];

  for (const rule of enabledRules) {
    evaluatedRules += 1;
    const result = await evaluateRecurringRule({
      supabaseAdmin,
      rule,
      settings,
      now,
      actorUserId,
      dryRun,
      employeeById,
      employeesByLocation,
      ordersByEmployeeId,
      locationGroupById,
    });

    if (result.due) dueRules += 1;
    remindersSent += result.remindersSent;
    skippedByCondition += result.skippedByCondition;
    skippedByRateLimit += result.skippedByRateLimit;
    errors.push(...result.errors);
  }

  return jsonResponse({
    success: true,
    evaluatedRules,
    dueRules,
    remindersSent,
    skippedByCondition,
    skippedByRateLimit,
    errors,
    dryRun,
  });
});
