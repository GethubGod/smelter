// @ts-nocheck
import { evaluateRecurringRule } from './evaluator.ts';

const NOW = new Date('2026-09-05T17:05:00.000Z');
const LOCATION_ID = '33333333-3333-4333-8333-333333333333';

Deno.test('a location rule consumes mixed push results and does not resend next run', async () => {
  const rule = {
    id: 'rule-1',
    scope: 'location',
    location_id: LOCATION_ID,
    employee_id: null,
    created_by: null,
    timezone: 'America/Los_Angeles',
    time_of_day: '10:00',
    days_of_week: [6],
    last_triggered_at: null,
    quiet_hours_enabled: false,
    condition_type: 'no_order_today',
    condition_value: null,
    rule_kind: 'standard',
    channels: { push: true, in_app: false },
  };
  const employees = [
    { id: 'employee-a', default_location_id: LOCATION_ID },
    { id: 'employee-b', default_location_id: LOCATION_ID },
  ];
  const deliveries: { employeeId: string; failureCount: number }[] = [];

  const supabaseAdmin = {
    from(table: string) {
      if (table !== 'recurring_reminder_rules') {
        throw new Error(`Unexpected table: ${table}`);
      }
      return {
        update(values: { last_triggered_at: string }) {
          return {
            async eq(column: string, value: string) {
              if (column !== 'id' || value !== rule.id) {
                throw new Error('The evaluator updated the wrong rule');
              }
              rule.last_triggered_at = values.last_triggered_at;
              return { error: null };
            },
          };
        },
      };
    },
  };

  // employee-b's tokens cannot be resolved: the reminder row is still written,
  // but nothing reached the phone.
  const sendReminder = async (_client: unknown, input: { employeeId: string; source: string }) => {
    if (input.source !== 'recurring') {
      throw new Error(`Expected recurring source, got ${input.source}`);
    }
    const failureCount = input.employeeId === 'employee-b' ? 1 : 0;
    deliveries.push({ employeeId: input.employeeId, failureCount });
    return {
      push: {
        status: failureCount === 1 ? 'failed' : 'sent',
        successCount: failureCount === 1 ? 0 : 1,
        failureCount,
        tokenResolutionFailed: failureCount === 1,
        errorDetail: failureCount === 1 ? 'schema cache is reloading' : null,
      },
    };
  };

  const input = {
    supabaseAdmin,
    rule,
    settings: { recurringWindowMinutes: 120 },
    now: NOW,
    actorUserId: null,
    dryRun: false,
    employeeById: new Map(employees.map((employee) => [employee.id, employee])),
    employeesByLocation: new Map([[LOCATION_ID, employees]]),
    ordersByEmployeeId: new Map(),
    locationGroupById: new Map(),
    sendReminder,
  };

  const first = await evaluateRecurringRule(input);
  if (!first.due || first.remindersSent !== 1) {
    throw new Error(
      `Only the delivered reminder counts as sent: ${JSON.stringify(first)}`,
    );
  }
  if (deliveries.length !== 2 || deliveries[0].failureCount !== 0 || deliveries[1].failureCount !== 1) {
    throw new Error(`Expected one accepted and one failed push: ${JSON.stringify(deliveries)}`);
  }
  // The run must not report success for an employee who received nothing.
  if (first.errors.length !== 1) {
    throw new Error(
      `Expected exactly one error entry: ${JSON.stringify(first.errors)}`,
    );
  }
  const [failure] = first.errors;
  if (failure.ruleId !== rule.id || failure.employeeId !== 'employee-b') {
    throw new Error(
      `The error entry does not identify the rule and employee: ${JSON.stringify(failure)}`,
    );
  }
  if (failure.message !== 'schema cache is reloading') {
    throw new Error(`Expected the resolver error message: ${failure.message}`);
  }
  if (rule.last_triggered_at !== NOW.toISOString()) {
    throw new Error('The mixed-result location rule was not consumed');
  }

  const second = await evaluateRecurringRule(input);
  if (second.due || second.remindersSent !== 0 || deliveries.length !== 2) {
    throw new Error('The next evaluation resent an already consumed location rule');
  }
  if (second.errors.length !== 0) {
    throw new Error('A consumed rule reported errors on the next run');
  }
});
