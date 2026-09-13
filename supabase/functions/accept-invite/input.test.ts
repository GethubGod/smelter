import { INVITE_TOKEN_LENGTH } from "../_shared/invites.ts";
import { classifyAuthCreateError, parseAcceptInviteRequest } from "./input.ts";

const token = "A".repeat(INVITE_TOKEN_LENGTH);

Deno.test("token-only requests use authenticated link mode", () => {
  for (const payload of [{ token }, { token, mode: "link" }]) {
    const result = parseAcceptInviteRequest(payload);
    if (!result.ok || result.value.action !== "link") {
      throw new Error("Expected link mode");
    }
  }
});

Deno.test("preview stays available through validateOnly", () => {
  const result = parseAcceptInviteRequest({ token, validateOnly: true });
  if (!result.ok || result.value.action !== "preview") {
    throw new Error("Expected preview mode");
  }
});

Deno.test("credential acceptance normalizes email and preserves password whitespace", () => {
  const result = parseAcceptInviteRequest({
    token,
    email: "  Alex@Example.COM ",
    password: " pass word ",
    name: "Ignored in favor of invite name",
  });
  if (!result.ok || result.value.action !== "credentials") {
    throw new Error("Expected credential mode");
  }
  if (
    result.value.email !== "alex@example.com" ||
    result.value.password !== " pass word "
  ) {
    throw new Error("Expected normalized email and unchanged password");
  }
});

Deno.test("credential acceptance rejects malformed email before Auth", () => {
  const result = parseAcceptInviteRequest({
    token,
    email: "not-an-email",
    password: "long enough",
  });
  if (result.ok) throw new Error("Expected malformed email to fail");
});

Deno.test("retired onboarding mode is rejected", () => {
  const result = parseAcceptInviteRequest({
    token,
    mode: "onboarding",
    credentialKind: "pin",
    credentialSecret: "1234",
  });
  if (result.ok) throw new Error("Expected onboarding mode to be rejected");
});

Deno.test("link mode rejects credential fields", () => {
  const result = parseAcceptInviteRequest({
    token,
    mode: "link",
    email: "relay@privaterelay.appleid.com",
  });
  if (result.ok) {
    throw new Error("Expected link mode credential fields to fail");
  }
});

Deno.test("auth create errors expose safe structured reasons", () => {
  const cases = [
    [{ code: "email_exists", status: 422 }, "email_exists", 409],
    [{ code: "user_already_exists", status: 422 }, "email_exists", 409],
    [{ code: "weak_password", status: 422 }, "password_rejected", 422],
    [{ code: "email_address_invalid", status: 422 }, "email_invalid", 422],
    [{ code: "request_timeout", status: 504 }, "service_unavailable", 503],
    [{ name: "AuthRetryableFetchError" }, "service_unavailable", 503],
    [{ code: "email_provider_disabled", status: 400 }, "account_rejected", 422],
  ] as const;

  for (const [error, reason, status] of cases) {
    const result = classifyAuthCreateError(error);
    if (result.reason !== reason || result.status !== status) {
      throw new Error(
        "Expected " + reason + "/" + status + ", got " +
          result.reason + "/" + result.status,
      );
    }
  }
});
