import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2?no-dts";
import { corsHeadersForRequest } from "../_shared/cors.ts";
import {
  inspectInviteState,
  type InviteInvalidReason,
  type InviteLocationGroup,
  type InviteRole,
  type InviteState,
  isInviteLocationGroup,
  isInviteRole,
} from "../_shared/invites.ts";
import {
  classifyAuthCreateError,
  normalizeEmail,
  parseAcceptInviteRequest,
} from "./input.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")?.trim() ?? "";
const publishableKeys = [
  Deno.env.get("SUPABASE_PUBLISHABLE_KEY"),
  ...(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "").split(","),
].map((key) => key?.trim()).filter((key): key is string => Boolean(key));

if (
  !supabaseUrl || !serviceRoleKey || (!anonKey && publishableKeys.length === 0)
) {
  throw new Error(
    "Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or a public API key",
  );
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface InviteRow {
  id: string;
  invited_name: string;
  invited_email: string | null;
  role: string;
  created_by: string | null;
  expires_at: string;
  used_at: string | null;
  revoked_at: string | null;
  location_group: string | null;
}

interface ClaimResult {
  ok: boolean;
  reason?: string;
  role?: InviteRole;
  locationGroup?: InviteLocationGroup;
}

interface AuthClient {
  getUser(token: string): Promise<{
    data: { user: { id: string } | null };
    error: unknown;
  }>;
  admin: {
    createUser(input: {
      email: string;
      password: string;
      email_confirm: boolean;
      user_metadata: Record<string, unknown>;
    }): Promise<{
      data: { user: { id: string } | null };
      error: unknown;
    }>;
    deleteUser(userId: string): Promise<{ error: unknown }>;
  };
}

function requireAuthClient(value: unknown): AuthClient {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Supabase Auth client is unavailable");
  }
  const candidate = value as Record<string, unknown>;
  const admin = candidate.admin;
  if (
    typeof candidate.getUser !== "function" ||
    !admin ||
    typeof admin !== "object" ||
    Array.isArray(admin)
  ) {
    throw new Error("Supabase Auth client is unavailable");
  }
  const adminMethods = admin as Record<string, unknown>;
  if (
    typeof adminMethods.createUser !== "function" ||
    typeof adminMethods.deleteUser !== "function"
  ) {
    throw new Error("Supabase Auth admin client is unavailable");
  }
  return value as AuthClient;
}

const authClient = requireAuthClient(supabaseAdmin.auth);

function jsonResponse(
  req: Request,
  body: Record<string, unknown>,
  status = 200,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeadersForRequest(req),
      "Content-Type": "application/json",
    },
  });
}

function hasPublicApiKey(req: Request): boolean {
  const apiKey = req.headers.get("apikey")?.trim();
  const authorization = req.headers.get("Authorization")?.trim();

  if (apiKey && (apiKey === anonKey || publishableKeys.includes(apiKey))) {
    return true;
  }

  return Boolean(anonKey && authorization === "Bearer " + anonKey);
}

function bearerToken(req: Request): string | null {
  const authorization = req.headers.get("Authorization")?.trim();
  if (!authorization?.startsWith("Bearer ")) return null;
  return authorization.slice("Bearer ".length).trim() || null;
}

function inviteStateFromRow(invite: InviteRow | null): InviteState | null {
  if (!invite || !isInviteRole(invite.role)) return null;

  return {
    invitedName: invite.invited_name,
    role: invite.role,
    locationGroup: isInviteLocationGroup(invite.location_group)
      ? invite.location_group
      : "both",
    expiresAt: invite.expires_at,
    usedAt: invite.used_at,
    revokedAt: invite.revoked_at,
  };
}

function reasonMessage(reason: InviteInvalidReason | string): string {
  switch (reason) {
    case "used":
      return "This invite has already been used";
    case "expired":
      return "This invite has expired";
    case "revoked":
      return "This invite has been revoked";
    case "already_on_team":
      return "This account is already on a team";
    case "email_mismatch":
      return "This invite was sent to a different email";
    default:
      return "This invite is invalid";
  }
}

async function findInvite(
  token: string,
): Promise<{ invite: InviteRow | null; failed: boolean }> {
  const { data, error } = await supabaseAdmin
    .from("invites")
    .select(
      "id, invited_name, invited_email, role, created_by, expires_at, used_at, revoked_at, location_group",
    )
    .eq("token", token)
    .maybeSingle();

  if (error) {
    console.error("Unable to read invite", error);
    return { invite: null, failed: true };
  }

  return { invite: (data as InviteRow | null) ?? null, failed: false };
}

async function findInviterName(createdBy: string | null): Promise<{
  name: string | null;
  failed: boolean;
}> {
  if (!createdBy) return { name: null, failed: false };

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("full_name")
    .eq("id", createdBy)
    .maybeSingle();
  if (error) {
    console.error("Unable to read invite creator", error);
    return { name: null, failed: true };
  }
  return { name: data?.full_name ?? null, failed: false };
}

function parseClaimResult(value: unknown): ClaimResult | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.ok !== "boolean") return null;
  if (
    record.ok &&
    (!isInviteRole(record.role) ||
      !isInviteLocationGroup(record.locationGroup))
  ) {
    return null;
  }
  return {
    ok: record.ok,
    reason: typeof record.reason === "string" ? record.reason : undefined,
    role: isInviteRole(record.role) ? record.role : undefined,
    locationGroup: isInviteLocationGroup(record.locationGroup)
      ? record.locationGroup
      : undefined,
  };
}

async function claimInvite(input: {
  token: string;
  userId: string;
  rejectExistingMembership: boolean;
  requireInvitedEmailMatch: boolean;
}): Promise<ClaimResult | null> {
  const { data, error } = await supabaseAdmin.rpc("claim_invite_for_user", {
    p_token: input.token,
    p_user_id: input.userId,
    p_reject_existing_membership: input.rejectExistingMembership,
    p_require_invited_email_match: input.requireInvitedEmailMatch,
  });
  if (error) {
    console.error("Unable to claim invite", error);
    return null;
  }
  return parseClaimResult(data);
}

async function reconcileClaim(input: {
  inviteId: string;
  userId: string;
}): Promise<ClaimResult | null> {
  const [inviteLookup, profileLookup] = await Promise.all([
    supabaseAdmin
      .from("invites")
      .select("used_by, role, location_group")
      .eq("id", input.inviteId)
      .maybeSingle(),
    supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", input.userId)
      .maybeSingle(),
  ]);
  if (inviteLookup.error || profileLookup.error) {
    console.error(
      "Unable to reconcile invite claim",
      inviteLookup.error ?? profileLookup.error,
    );
    return null;
  }

  const invite = inviteLookup.data;
  if (
    invite?.used_by !== input.userId ||
    !isInviteRole(invite.role) ||
    !isInviteLocationGroup(invite.location_group) ||
    profileLookup.data?.role !== invite.role
  ) {
    return null;
  }
  return {
    ok: true,
    role: invite.role,
    locationGroup: invite.location_group,
  };
}

async function claimInviteWithRecovery(input: {
  inviteId: string;
  token: string;
  userId: string;
  rejectExistingMembership: boolean;
  requireInvitedEmailMatch: boolean;
}): Promise<ClaimResult | null> {
  const firstAttempt = await claimInvite(input);
  if (firstAttempt) return firstAttempt;

  const reconciled = await reconcileClaim(input);
  if (reconciled) return reconciled;

  // The SQL claim is idempotent for the same invite/user pair, so one retry
  // safely resolves a response lost after commit without consuming it twice.
  const retry = await claimInvite(input);
  if (retry) return retry;
  return await reconcileClaim(input);
}

async function removeUnclaimedUser(userId: string): Promise<void> {
  const { error: authError } = await authClient.admin.deleteUser(
    userId,
  );
  if (authError) {
    console.error("Unable to delete unclaimed auth user", authError);
  }

  const [{ error: profileError }, { error: userError }] = await Promise.all([
    supabaseAdmin.from("profiles").delete().eq("id", userId),
    supabaseAdmin.from("users").delete().eq("id", userId),
  ]);
  if (profileError) {
    console.error("Unable to clean up unclaimed profile", profileError);
  }
  if (userError) {
    console.error("Unable to clean up unclaimed legacy user", userError);
  }
}

function claimFailureResponse(req: Request, claim: ClaimResult) {
  const reason = claim.reason ?? "invalid";
  if (reason === "already_on_team") {
    return jsonResponse(
      req,
      { error: reasonMessage(reason), reason: "already_on_team" },
      409,
    );
  }
  if (
    ["invalid", "used", "expired", "revoked", "email_mismatch"].includes(
      reason,
    )
  ) {
    return jsonResponse(req, { error: reasonMessage(reason), reason }, 409);
  }
  return jsonResponse(req, { error: "Unable to apply invite" }, 500);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeadersForRequest(req) });
  }

  if (req.method !== "POST") {
    return jsonResponse(req, { error: "Method not allowed" }, 405);
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse(req, { error: "Invalid request body" }, 400);
  }

  const parsed = parseAcceptInviteRequest(payload);
  if (!parsed.ok) return jsonResponse(req, { error: parsed.error }, 400);

  if (parsed.value.action !== "link" && !hasPublicApiKey(req)) {
    return jsonResponse(req, { error: "Unauthorized" }, 401);
  }

  let linkUserId: string | null = null;
  if (parsed.value.action === "link") {
    const accessToken = bearerToken(req);
    if (!accessToken) {
      return jsonResponse(req, { error: "Unauthorized" }, 401);
    }

    const { data: authData, error: authError } = await authClient.getUser(
      accessToken,
    );
    if (authError || !authData.user) {
      return jsonResponse(req, { error: "Unauthorized" }, 401);
    }
    linkUserId = authData.user.id;
  }

  const lookup = await findInvite(parsed.value.token);
  if (lookup.failed) {
    return jsonResponse(req, { error: "Unable to validate invite" }, 500);
  }

  const validity = inspectInviteState(inviteStateFromRow(lookup.invite));
  if (parsed.value.action === "preview") {
    if (!validity.valid) {
      let invitedBy: string | null = null;
      if (
        lookup.invite &&
        (validity.reason === "expired" || validity.reason === "used")
      ) {
        const inviter = await findInviterName(lookup.invite.created_by);
        if (inviter.failed) {
          return jsonResponse(req, { error: "Unable to validate invite" }, 500);
        }
        invitedBy = inviter.name;
      }
      return jsonResponse(req, {
        valid: false,
        error: reasonMessage(validity.reason),
        reason: validity.reason,
        invitedBy,
      });
    }
    if (!lookup.invite) {
      return jsonResponse(req, { error: "Unable to validate invite" }, 500);
    }

    const inviter = await findInviterName(lookup.invite.created_by);
    if (inviter.failed) {
      return jsonResponse(req, { error: "Unable to validate invite" }, 500);
    }

    return jsonResponse(req, {
      valid: true,
      invitedName: validity.invitedName,
      invitedEmail: lookup.invite.invited_email,
      invitedBy: inviter.name,
      role: validity.role,
      locationGroup: validity.locationGroup,
    });
  }

  if (parsed.value.action === "link") {
    if (!linkUserId) {
      return jsonResponse(req, { error: "Unauthorized" }, 401);
    }
    if (!lookup.invite) {
      return jsonResponse(req, {
        error: reasonMessage("invalid"),
        reason: "invalid",
      }, 409);
    }
    const claim = await claimInviteWithRecovery({
      inviteId: lookup.invite.id,
      token: parsed.value.token,
      userId: linkUserId,
      rejectExistingMembership: true,
      requireInvitedEmailMatch: false,
    });
    if (!claim) {
      return jsonResponse(req, {
        error: "Invite status could not be confirmed. Try again.",
        reason: "service_unavailable",
      }, 503);
    }
    if (!claim.ok) return claimFailureResponse(req, claim);
    if (!claim.role || !claim.locationGroup) {
      return jsonResponse(req, { error: "Unable to apply invite" }, 500);
    }

    return jsonResponse(req, {
      ok: true,
      role: claim.role,
      locationGroup: claim.locationGroup,
    });
  }

  if (!validity.valid || !lookup.invite) {
    const reason = validity.valid ? "invalid" : validity.reason;
    return jsonResponse(req, { error: reasonMessage(reason), reason }, 409);
  }

  if (
    lookup.invite.invited_email &&
    normalizeEmail(parsed.value.email) !== lookup.invite.invited_email
  ) {
    return jsonResponse(req, {
      error: reasonMessage("email_mismatch"),
      reason: "email_mismatch",
    }, 409);
  }

  const invitedName = validity.invitedName;
  const { data: created, error: createError } = await authClient.admin
    .createUser({
      email: parsed.value.email,
      password: parsed.value.password,
      email_confirm: true,
      user_metadata: {
        name: invitedName,
        full_name: invitedName,
        provider: "email",
      },
    });

  if (createError || !created.user) {
    const failure = classifyAuthCreateError(createError);
    console.error("Unable to create invited auth user", {
      reason: failure.reason,
      status: failure.status,
    });
    return jsonResponse(req, {
      error: failure.error,
      reason: failure.reason,
    }, failure.status);
  }

  const claim = await claimInviteWithRecovery({
    inviteId: lookup.invite.id,
    token: parsed.value.token,
    userId: created.user.id,
    rejectExistingMembership: false,
    requireInvitedEmailMatch: true,
  });
  if (!claim) {
    return jsonResponse(req, {
      error: "Account setup status could not be confirmed. Try again.",
      reason: "service_unavailable",
    }, 503);
  }
  if (!claim.ok) {
    await removeUnclaimedUser(created.user.id);
    return claimFailureResponse(req, claim);
  }
  if (!claim.role || !claim.locationGroup) {
    return jsonResponse(req, {
      error: "Account setup status could not be confirmed. Try again.",
      reason: "service_unavailable",
    }, 503);
  }

  return jsonResponse(req, {
    ok: true,
    role: claim.role,
    locationGroup: claim.locationGroup,
  });
});
