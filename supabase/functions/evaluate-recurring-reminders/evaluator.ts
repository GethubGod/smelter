// @ts-nocheck
import {
  getChecklistOrderDayReminderMessage,
  ReminderRateLimitError,
  sendEmployeeReminder,
} from '../_shared/reminders.ts';
import {
  selectLatestOrderForReminder,
  type ReminderLocationGroup,
} from '../_shared/recurringReminderScope.ts';

const WEEKDAY_MAP: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export interface RecurringRuleEvaluation {
  due: boolean;
  remindersSent: number;
  skippedByCondition: number;
  skippedByRateLimit: number;
  errors: { ruleId: string; employeeId?: string; message: string }[];
}

function getZonedParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
  });

  const parts = formatter.formatToParts(date);
  const values: Record<string, string> = {};
  parts.forEach((part) => {
    values[part.type] = part.value;
  });

  const weekdayShort = values.weekday || 'Sun';

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    weekday: WEEKDAY_MAP[weekdayShort] ?? 0,
    dateKey: `${values.year}-${values.month}-${values.day}`,
  };
}

function parseTimeToMinutes(value: string | null | undefined): number | null {
  if (!value || typeof value !== 'string') return null;
  const cleaned = value.trim();
  const match = cleaned.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

function isTimeInRange(nowMinutes: number, startMinutes: number, endMinutes: number): boolean {
  if (startMinutes === endMinutes) return true;
  if (startMinutes < endMinutes) {
    return nowMinutes >= startMinutes && nowMinutes < endMinutes;
  }
  return nowMinutes >= startMinutes || nowMinutes < endMinutes;
}

function toDateKeyInTimezone(value: string | null | undefined, timeZone: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return getZonedParts(date, timeZone).dateKey;
}

function daysBetweenDateKeys(a: string, b: string): number {
  const [aYear, aMonth, aDay] = a.split('-').map(Number);
  const [bYear, bMonth, bDay] = b.split('-').map(Number);
  const aMs = Date.UTC(aYear, aMonth - 1, aDay);
  const bMs = Date.UTC(bYear, bMonth - 1, bDay);
  return Math.max(0, Math.floor((aMs - bMs) / (1000 * 60 * 60 * 24)));
}

export async function evaluateRecurringRule({
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
  sendReminder = sendEmployeeReminder,
  getChecklistMessage = getChecklistOrderDayReminderMessage,
}: {
  supabaseAdmin: any;
  rule: any;
  settings: any;
  now: Date;
  actorUserId: string | null;
  dryRun: boolean;
  employeeById: Map<string, any>;
  employeesByLocation: Map<string, any[]>;
  ordersByEmployeeId: Map<string, any[]>;
  locationGroupById: Map<string, ReminderLocationGroup>;
  sendReminder?: typeof sendEmployeeReminder;
  getChecklistMessage?: typeof getChecklistOrderDayReminderMessage;
}): Promise<RecurringRuleEvaluation> {
  const result: RecurringRuleEvaluation = {
    due: false,
    remindersSent: 0,
    skippedByCondition: 0,
    skippedByRateLimit: 0,
    errors: [],
  };

  const timezone = typeof rule.timezone === 'string' && rule.timezone
    ? rule.timezone
    : 'America/Los_Angeles';
  const nowParts = getZonedParts(now, timezone);
  const nowMinutes = nowParts.hour * 60 + nowParts.minute;
  const scheduledMinutes = parseTimeToMinutes(rule.time_of_day);

  if (scheduledMinutes == null) {
    result.errors.push({ ruleId: rule.id, message: 'Invalid rule time_of_day' });
    return result;
  }

  const daysOfWeek = Array.isArray(rule.days_of_week)
    ? rule.days_of_week
      .map((value: any) => Number(value))
      .filter((value: number) => Number.isInteger(value))
    : [];

  if (!daysOfWeek.includes(nowParts.weekday)) return result;

  const windowMinutes = Math.max(1, Number(settings.recurringWindowMinutes || 15));
  if (!(nowMinutes >= scheduledMinutes && nowMinutes < scheduledMinutes + windowMinutes)) {
    return result;
  }

  const lastTriggeredDateKey = toDateKeyInTimezone(rule.last_triggered_at, timezone);
  if (lastTriggeredDateKey === nowParts.dateKey) return result;

  if (rule.quiet_hours_enabled) {
    const quietStart = parseTimeToMinutes(rule.quiet_hours_start);
    const quietEnd = parseTimeToMinutes(rule.quiet_hours_end);
    if (
      quietStart != null &&
      quietEnd != null &&
      isTimeInRange(nowMinutes, quietStart, quietEnd)
    ) {
      return result;
    }
  }

  result.due = true;

  const candidateEmployees = rule.scope === 'employee'
    ? (rule.employee_id && employeeById.has(rule.employee_id)
      ? [employeeById.get(rule.employee_id)]
      : [])
    : employeesByLocation.get(rule.location_id || '__none__') || [];

  for (const employee of candidateEmployees) {
    if (!employee) continue;

    const latestOrder = selectLatestOrderForReminder(
      ordersByEmployeeId.get(employee.id) ?? [],
      rule,
      locationGroupById,
    );
    const lastOrderDateKey = toDateKeyInTimezone(latestOrder?.created_at, timezone);

    let conditionMet = false;
    if (rule.condition_type === 'no_order_today') {
      conditionMet = !lastOrderDateKey || lastOrderDateKey !== nowParts.dateKey;
    } else {
      const thresholdDays = Math.max(0, Number(rule.condition_value ?? 0));
      if (!lastOrderDateKey) {
        conditionMet = true;
      } else {
        const elapsedDays = daysBetweenDateKeys(nowParts.dateKey, lastOrderDateKey);
        conditionMet = elapsedDays >= thresholdDays;
      }
    }

    if (!conditionMet) {
      result.skippedByCondition += 1;
      continue;
    }

    let checklistMessage: string | undefined;
    if (rule.rule_kind === 'checklist_order_day') {
      try {
        const locationGroup = rule.location_group === 'poki' ? 'poki' : 'sushi';
        const checklistContext = await getChecklistMessage(
          supabaseAdmin,
          employee.id,
          locationGroup,
        );
        checklistMessage = checklistContext.body;
      } catch (error: any) {
        result.errors.push({
          ruleId: rule.id,
          employeeId: employee.id,
          message: error?.message || 'Failed to resolve checklist reminder context',
        });
        continue;
      }
    }

    if (dryRun) {
      result.remindersSent += 1;
      continue;
    }

    try {
      const channelConfig = rule.channels && typeof rule.channels === 'object'
        ? {
            push: typeof rule.channels.push === 'boolean' ? rule.channels.push : true,
            in_app: typeof rule.channels.in_app === 'boolean' ? rule.channels.in_app : true,
          }
        : { push: true, in_app: true };

      const sendResult = await sendReminder(supabaseAdmin, {
        employeeId: employee.id,
        managerId: rule.created_by || actorUserId,
        locationId: rule.scope === 'location'
          ? rule.location_id
          : employee.default_location_id,
        source: 'recurring',
        message: checklistMessage,
        overrideRateLimit: false,
        channels: channelConfig,
      });

      // A resolver failure does not throw on the recurring path, because
      // throwing would leave the rule unconsumed and resend it to the
      // employees who did get their reminder. It still has to reach the run
      // result: this employee received nothing, so it is not a reminder sent,
      // and the cron output must say so rather than reporting success.
      if (sendResult?.push?.tokenResolutionFailed) {
        result.errors.push({
          ruleId: rule.id,
          employeeId: employee.id,
          message: sendResult.push.errorDetail
            || 'Unable to resolve the recipient push tokens.',
        });
        continue;
      }

      result.remindersSent += 1;
    } catch (error: any) {
      if (error instanceof ReminderRateLimitError) {
        result.skippedByRateLimit += 1;
        continue;
      }

      result.errors.push({
        ruleId: rule.id,
        employeeId: employee.id,
        message: error?.message || 'Failed to send recurring reminder',
      });
    }
  }

  if (!dryRun) {
    await supabaseAdmin
      .from('recurring_reminder_rules')
      .update({ last_triggered_at: now.toISOString() })
      .eq('id', rule.id);
  }

  return result;
}
