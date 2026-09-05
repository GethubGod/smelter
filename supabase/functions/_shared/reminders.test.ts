import {
  buildChecklistOrderDayMessage,
  isExpoDeviceNotRegistered,
} from './reminderDelivery.ts';
import { PushTokenResolutionError, sendEmployeeReminder } from './reminders.ts';

Deno.test('buildChecklistOrderDayMessage includes the server-computed unchecked count', () => {
  const message = buildChecklistOrderDayMessage('sushi', 3);
  if (message !== 'Fish order due today — 3 items unchecked') {
    throw new Error(`Unexpected checklist reminder message: ${message}`);
  }
});

Deno.test('buildChecklistOrderDayMessage falls back to a generic message without a checklist', () => {
  const message = buildChecklistOrderDayMessage('poki', null);
  if (message !== 'Poki order due today') {
    throw new Error(`Unexpected generic checklist reminder message: ${message}`);
  }
});

Deno.test('isExpoDeviceNotRegistered recognizes ticket and receipt errors', () => {
  const ticketError = { details: { error: 'DeviceNotRegistered' } };
  const receiptError = { error: 'DeviceNotRegistered' };

  if (!isExpoDeviceNotRegistered(ticketError) || !isExpoDeviceNotRegistered(receiptError)) {
    throw new Error('Expected DeviceNotRegistered errors to be recognized.');
  }
  if (isExpoDeviceNotRegistered({ details: { error: 'MessageTooBig' } })) {
    throw new Error('Expected unrelated Expo errors not to be treated as token invalidation.');
  }
});

// ---------------------------------------------------------------------------
// Push token resolution failures in sendEmployeeReminder.
//
// Run from supabase/functions (the repo tsconfig is React Native, which Deno
// rejects, so the existing edge function tests are run the same way):
//   deno test --no-config --allow-all _shared/reminders.test.ts
// ---------------------------------------------------------------------------

const EMPLOYEE_ID = "11111111-1111-4111-8111-111111111111";
const MANAGER_ID = "22222222-2222-4222-8222-222222222222";

type RecordedCall = { table: string; ops: string[] };

const RESOLVER_FAILURE = {
  data: null,
  error: { message: "schema cache is reloading" },
};

/**
 * Minimal stand-in for the supabase-js client. Every builder method returns the
 * builder; awaiting it resolves to a canned answer for that table. Writes are
 * recorded so a test can prove nothing was consumed.
 */
function makeClient(rpcResult?: unknown) {
  const writes: RecordedCall[] = [];
  const rpcCalls: { name: string; args: Record<string, unknown> }[] = [];

  const reads: Record<string, unknown> = {
    reminder_system_settings: {
      data: {
        overdue_threshold_days: 7,
        reminder_rate_limit_minutes: 15,
        recurring_window_minutes: 15,
      },
    },
    users: {
      data: {
        id: EMPLOYEE_ID,
        name: "Fixture Employee",
        email: "employee@example.test",
        role: "employee",
        default_location_id: null,
      },
    },
    profiles: { data: { notifications_enabled: true, is_suspended: false } },
    orders: { data: null },
    reminders: { data: null },
  };

  const writeResults: Record<string, unknown> = {
    reminders: { data: { id: "reminder-1", reminder_count: 1 } },
    notifications: { data: { id: "notification-1" } },
    reminder_events: { data: { id: "event-1" } },
  };

  function resolve(call: RecordedCall): unknown {
    const isWrite = call.ops.includes("insert") || call.ops.includes("update");
    if (isWrite) {
      writes.push(call);
      return { error: null, ...(writeResults[call.table] as object ?? { data: null }) };
    }
    return { error: null, ...(reads[call.table] as object ?? { data: null }) };
  }

  function builder(table: string) {
    const call: RecordedCall = { table, ops: [] };
    // deno-lint-ignore no-explicit-any
    const chain: any = new Proxy({}, {
      get(_target, prop: string) {
        if (prop === "then") {
          // deno-lint-ignore no-explicit-any
          return (onFulfilled: any, onRejected: any) =>
            Promise.resolve(resolve(call)).then(onFulfilled, onRejected);
        }
        return (..._args: unknown[]) => {
          call.ops.push(prop);
          return chain;
        };
      },
    });
    return chain;
  }

  const client = {
    from: (table: string) => builder(table),
    rpc: (name: string, args: Record<string, unknown>) => {
      rpcCalls.push({ name, args });
      return Promise.resolve(rpcResult ?? { data: [], error: null });
    },
    // deno-lint-ignore no-explicit-any
  } as any;

  return { client, writes, rpcCalls };
}

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    employeeId: EMPLOYEE_ID,
    managerId: MANAGER_ID,
    message: "Please submit your order.",
    ...overrides,
  };
}

function writtenTables(writes: RecordedCall[]): string {
  return writes.map((write) => write.table).join(",");
}

Deno.test("a push-only reminder that cannot resolve tokens writes nothing", async () => {
  const { client, writes, rpcCalls } = makeClient(RESOLVER_FAILURE);

  let caught: unknown = null;
  try {
    await sendEmployeeReminder(
      client,
      baseInput({ channels: { push: true, in_app: false } }),
    );
  } catch (error) {
    caught = error;
  }

  if (!(caught instanceof PushTokenResolutionError)) {
    throw new Error(`Expected PushTokenResolutionError, got ${caught}`);
  }
  if (rpcCalls.length !== 1 || rpcCalls[0].name !== "active_device_push_tokens") {
    throw new Error("Expected exactly one call to the ownership resolver");
  }
  if (rpcCalls[0].args.p_user_id !== EMPLOYEE_ID) {
    throw new Error("The resolver was called for the wrong recipient");
  }
  if (writes.length !== 0) {
    throw new Error(`Expected no writes, saw ${writtenTables(writes)}`);
  }
});

Deno.test("the recurring path throws too, so the rule is not marked triggered", async () => {
  const { client, writes } = makeClient(RESOLVER_FAILURE);

  let caught: unknown = null;
  try {
    await sendEmployeeReminder(
      client,
      baseInput({ source: "recurring", channels: { push: true, in_app: false } }),
    );
  } catch (error) {
    caught = error;
  }

  if (!(caught instanceof PushTokenResolutionError)) {
    throw new Error(`Expected PushTokenResolutionError, got ${caught}`);
  }
  if ((caught as Error).message !== "schema cache is reloading") {
    throw new Error("Expected the resolver error to reach the caller");
  }
  // evaluate-recurring-reminders skips last_triggered_at on this error, so the
  // reminder thread must not have advanced either.
  if (writes.length !== 0) {
    throw new Error(`Expected no writes, saw ${writtenTables(writes)}`);
  }
});

Deno.test("in-app still lands and push records exactly one failure", async () => {
  const { client, writes } = makeClient(RESOLVER_FAILURE);

  const result = await sendEmployeeReminder(
    client,
    baseInput({ source: "recurring", channels: { push: true, in_app: true } }),
  );

  if (result.push.status !== "failed" || result.push.deliveryOutcome !== "failed") {
    throw new Error("Expected the push channel to be reported as failed");
  }
  if (result.push.successCount !== 0 || result.push.failureCount !== 1) {
    throw new Error(
      `Expected 0 successes and 1 failure, got ${result.push.successCount}/${result.push.failureCount}`,
    );
  }
  if (result.push.tokenCount !== 0) {
    throw new Error("Expected no resolved tokens");
  }
  if (result.push.errorDetail !== "schema cache is reloading") {
    throw new Error("Expected the resolver error to be reported");
  }
  if (result.inAppNotificationId !== "notification-1") {
    throw new Error("Expected the in-app notification to still be delivered");
  }
  if (writtenTables(writes) !== "reminders,notifications,reminder_events") {
    throw new Error(`Unexpected write sequence: ${writtenTables(writes)}`);
  }
});

Deno.test("a recipient who owns no device is not a failure", async () => {
  const { client, writes } = makeClient({ data: [], error: null });

  const result = await sendEmployeeReminder(
    client,
    baseInput({ channels: { push: true, in_app: false } }),
  );

  if (result.push.status !== "no_tokens") {
    throw new Error(`Expected no_tokens, got ${result.push.status}`);
  }
  if (result.push.failureCount !== 0 || result.push.deliveryOutcome !== null) {
    throw new Error("An empty device list must not be reported as a delivery failure");
  }
  if (writtenTables(writes) !== "reminders,reminder_events") {
    throw new Error(`Unexpected write sequence: ${writtenTables(writes)}`);
  }
});

Deno.test("tokens the sender cannot use are dropped, not sent", async () => {
  const { client } = makeClient({
    data: [{ expo_push_token: "   " }, { expo_push_token: "not-a-token" }],
    error: null,
  });

  const result = await sendEmployeeReminder(
    client,
    baseInput({ channels: { push: true, in_app: false } }),
  );

  if (result.push.status !== "no_tokens" || result.push.tokenCount !== 0) {
    throw new Error("Expected unusable tokens to be discarded before sending");
  }
});

Deno.test("no ownership lookup happens when push was not requested", async () => {
  const { client, rpcCalls } = makeClient();

  const result = await sendEmployeeReminder(
    client,
    baseInput({ channels: { push: false, in_app: true } }),
  );

  if (rpcCalls.length !== 0) {
    throw new Error("The resolver ran for a reminder that did not request push");
  }
  if (result.push.status !== "not_requested") {
    throw new Error(`Expected not_requested, got ${result.push.status}`);
  }
});
