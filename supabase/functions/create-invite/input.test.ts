import { parseInvitedEmail } from "./input.ts";

Deno.test("create invite accepts and normalizes camel-case invitedEmail", () => {
  const result = parseInvitedEmail({ invitedEmail: "  Alex@Example.COM " });
  if (!result.ok || result.value.invitedEmail !== "alex@example.com") {
    throw new Error("Expected a normalized email");
  }
});

Deno.test("create invite accepts snake-case invited_email", () => {
  const result = parseInvitedEmail({ invited_email: "alex@example.com" });
  if (!result.ok || result.value.invitedEmail !== "alex@example.com") {
    throw new Error("Expected snake-case email support");
  }
});

Deno.test("create invite allows no bound email", () => {
  const result = parseInvitedEmail({});
  if (!result.ok || result.value.invitedEmail !== null) {
    throw new Error("Expected an absent email to stay null");
  }
});

Deno.test("create invite rejects malformed or conflicting emails", () => {
  const malformed = parseInvitedEmail({ invitedEmail: "not-an-email" });
  if (malformed.ok) throw new Error("Expected malformed email to fail");

  const conflicting = parseInvitedEmail({
    invitedEmail: "one@example.com",
    invited_email: "two@example.com",
  });
  if (conflicting.ok) throw new Error("Expected conflicting aliases to fail");
});
