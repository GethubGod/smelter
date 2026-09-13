// Edge function: anonymous submission of workspace requests from smelterpos.com/signup.
// Validates payload, drops honeypot requests silently, enforces IP and email rate limits,
// and records the request for manager review.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2?no-dts';
import { corsHeadersForRequest } from '../_shared/cors.ts';
import { parseWorkspaceRequest } from './validator.ts';

declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function jsonResponse(
  req: Request,
  body: Record<string, unknown>,
  status = 200,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeadersForRequest(req),
      'Content-Type': 'application/json',
    },
  });
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  const chain = forwarded?.split(',').map((p) => p.trim()).filter(Boolean) ?? [];
  return chain[chain.length - 1] || req.headers.get('x-real-ip')?.trim() || 'unknown';
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeadersForRequest(req),
    });
  }

  if (req.method !== 'POST') {
    return jsonResponse(req, { ok: false, error: 'Method not allowed' }, 405);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(req, { ok: false, error: 'Invalid JSON' }, 400);
  }

  const parsed = parseWorkspaceRequest(body);
  if (!parsed.ok) {
    return jsonResponse(req, { ok: false, error: parsed.error }, 400);
  }

  // Honeypot: silently drop bot submissions with 200 OK
  if (parsed.isHoneypot) {
    return jsonResponse(req, { ok: true });
  }

  const ip = clientIp(req);
  const salt = Deno.env.get('WORKSPACE_REQ_IP_SALT') ?? 'smelter_salt_2026';
  const ipHash = await sha256Hex(`${salt}:${ip}`);

  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  // Check rate limits: max 5/hr per IP, max 2/day per email
  const [ipLookup, emailLookup] = await Promise.all([
    supabaseAdmin
      .from('workspace_request_rate_limits')
      .select('id', { count: 'exact', head: true })
      .eq('ip_hash', ipHash)
      .gte('created_at', oneHourAgo),
    supabaseAdmin
      .from('workspace_request_rate_limits')
      .select('id', { count: 'exact', head: true })
      .eq('email', parsed.value.email)
      .gte('created_at', oneDayAgo),
  ]);

  if (ipLookup.error || emailLookup.error) {
    console.error('Rate limit query failed', ipLookup.error ?? emailLookup.error);
    return jsonResponse(req, { ok: false, error: 'Database error' }, 500);
  }

  if ((ipLookup.count ?? 0) >= 5 || (emailLookup.count ?? 0) >= 2) {
    return jsonResponse(req, { ok: false, error: 'rate_limited' }, 429);
  }

  // Log rate limit ledger entry
  const { error: rateLimitInsertErr } = await supabaseAdmin
    .from('workspace_request_rate_limits')
    .insert({
      ip_hash: ipHash,
      email: parsed.value.email,
    });

  if (rateLimitInsertErr) {
    console.error('Failed to log rate limit entry', rateLimitInsertErr);
    return jsonResponse(req, { ok: false, error: 'Database error' }, 500);
  }

  // Insert workspace request
  const userAgent = req.headers.get('user-agent') ?? null;
  const { data, error: insertErr } = await supabaseAdmin
    .from('workspace_requests')
    .insert({
      full_name: parsed.value.fullName,
      email: parsed.value.email,
      phone: parsed.value.phone,
      restaurant_name: parsed.value.restaurantName,
      city: parsed.value.city,
      website: parsed.value.website,
      primary_category: parsed.value.primaryCategory,
      locations_count: parsed.value.locationsCount,
      status: 'pending',
      ip_hash: ipHash,
      user_agent: userAgent,
    })
    .select('id')
    .single();

  if (insertErr || !data?.id) {
    console.error('Failed to insert workspace request', insertErr);
    return jsonResponse(req, { ok: false, error: 'Failed to record request' }, 500);
  }

  return jsonResponse(req, { ok: true, id: data.id }, 200);
});
