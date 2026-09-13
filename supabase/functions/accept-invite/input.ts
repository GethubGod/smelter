import { isInviteToken, type ParseResult } from "../_shared/invites.ts";

export type AcceptInviteRequest =
  | { action: "preview"; token: string }
  | { action: "link"; token: string }
  | {
    action: "credentials";
    token: string;
    email: string;
    password: string;
    name: string | null;
  };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function optionalTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function parseAcceptInviteRequest(
  payload: unknown,
): ParseResult<AcceptInviteRequest> {
  if (!isRecord(payload)) return { ok: false, error: "Invalid request body" };

  const token = optionalTrimmedString(payload.token);
  if (!isInviteToken(token)) {
    return { ok: false, error: "Invalid invite token" };
  }

  if (
    payload.validateOnly !== undefined &&
    typeof payload.validateOnly !== "boolean"
  ) {
    return { ok: false, error: "validateOnly must be a boolean" };
  }

  if (payload.validateOnly === true) {
    return { ok: true, value: { action: "preview", token } };
  }

  if (
    payload.mode !== undefined &&
    payload.mode !== "credentials" &&
    payload.mode !== "link"
  ) {
    return { ok: false, error: "mode must be credentials or link" };
  }

  const hasCredentialFields = payload.email !== undefined ||
    payload.password !== undefined || payload.name !== undefined;
  const action = payload.mode === "link" ||
      (payload.mode === undefined && !hasCredentialFields)
    ? "link"
    : "credentials";

  if (action === "link") {
    if (hasCredentialFields) {
      return { ok: false, error: "link mode accepts only token" };
    }
    return { ok: true, value: { action: "link", token } };
  }

  const rawEmail = optionalTrimmedString(payload.email);
  if (!rawEmail) return { ok: false, error: "email is required" };
  const email = normalizeEmail(rawEmail);

  const password = typeof payload.password === "string" &&
      payload.password.length > 0
    ? payload.password
    : null;
  if (!password) return { ok: false, error: "password is required" };

  const name = optionalTrimmedString(payload.name);
  if (name && name.length > 120) {
    return { ok: false, error: "name must be 120 characters or fewer" };
  }

  return {
    ok: true,
    value: { action: "credentials", token, email, password, name },
  };
}
