import type { ParseResult } from "../_shared/invites.ts";

export interface InvitedEmailInput {
  invitedEmail: string | null;
}

const SIMPLE_EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseOptionalEmail(value: unknown): ParseResult<string | null> {
  if (value === undefined || value === null) {
    return { ok: true, value: null };
  }
  if (typeof value !== "string") {
    return { ok: false, error: "invitedEmail must be a valid email" };
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) return { ok: true, value: null };
  if (normalized.length > 320 || !SIMPLE_EMAIL.test(normalized)) {
    return { ok: false, error: "invitedEmail must be a valid email" };
  }
  return { ok: true, value: normalized };
}

export function parseInvitedEmail(
  payload: unknown,
): ParseResult<InvitedEmailInput> {
  if (!isRecord(payload)) return { ok: false, error: "Invalid request body" };

  const camel = parseOptionalEmail(payload.invitedEmail);
  if (!camel.ok) return camel;
  const snake = parseOptionalEmail(payload.invited_email);
  if (!snake.ok) return snake;

  if (
    camel.value !== null && snake.value !== null &&
    camel.value !== snake.value
  ) {
    return {
      ok: false,
      error: "invitedEmail and invited_email must match",
    };
  }

  return {
    ok: true,
    value: { invitedEmail: camel.value ?? snake.value },
  };
}
