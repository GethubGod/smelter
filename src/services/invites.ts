// Invite-link authentication edge function wrappers and the pure deep-link
// helpers behind the babytunasystems://join?token=… flow.

import { supabase } from '@/lib/supabase';
import type { UserRole } from '@/types';
import {
  classifyInviteFailure,
  describeInviteFailure,
  type InviteFailureReason,
} from '@/services/inviteLinks';

export {
  classifyInviteFailure,
  describeInviteFailure,
  parseJoinToken,
  type InviteFailureReason,
} from '@/services/inviteLinks';

export type InviteLocationGroup = 'sushi' | 'poki' | 'both';

export interface InvitePreview {
  invitedName: string | null;
  invitedEmail: string | null;
  invitedBy: string | null;
  role: UserRole | null;
  locationGroup: InviteLocationGroup;
}

export interface AcceptInviteInput {
  token: string;
  email: string;
  password: string;
}

export interface CreateInviteInput {
  invitedName: string;
  invitedEmail?: string;
  role: 'employee' | 'manager';
  expiresInHours: number;
  modulePreset: Record<string, boolean>;
  locationGroup: InviteLocationGroup;
}

export interface CreatedInvite {
  inviteId: string;
  token: string;
  joinUrl: string;
  locationGroup: InviteLocationGroup;
}

export interface AcceptedInvite {
  role: UserRole;
  locationGroup: InviteLocationGroup;
}

interface FunctionErrorDetails {
  message: string | null;
  /** Structured reason from the error body, when the backend sent one. */
  reason: InviteFailureReason | null;
  code: string | null;
  invitedBy: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readFunctionErrorPayload(value: unknown): FunctionErrorDetails | null {
  if (!isRecord(value) || typeof value.error !== 'string') return null;
  return {
    message: value.error,
    reason: readReason(value.reason),
    code: readString(value.reason),
    invitedBy: readName(value.invitedBy),
  };
}

async function getFunctionErrorDetails(error: unknown): Promise<FunctionErrorDetails> {
  if (isRecord(error)) {
    const context = error.context;

    if (context) {
      // Newer supabase-js: context is the already-parsed JSON body
      const directDetails = readFunctionErrorPayload(context);
      if (directDetails) return directDetails;

      // Older supabase-js: context is a Response object
      if (isRecord(context) && typeof context.json === 'function') {
        try {
          const payload = await context.json();
          const responseDetails = readFunctionErrorPayload(payload);
          if (responseDetails) return responseDetails;
        } catch {
          // Body already consumed or not JSON. Fall through to the outer error.
        }
      }
    }

    const message = error.message;
    if (
      typeof message === 'string' &&
      !message.toLowerCase().includes('edge function returned a non-2xx')
    ) {
      return { message, reason: null, code: null, invitedBy: null };
    }
  }

  return { message: null, reason: null, code: null, invitedBy: null };
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readRole(value: unknown): UserRole | null {
  return value === 'employee' || value === 'manager' ? value : null;
}

function readReason(value: unknown): InviteFailureReason | null {
  return value === 'used' || value === 'expired' || value === 'revoked' || value === 'invalid'
    ? value
    : null;
}

function readName(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readLocationGroup(value: unknown): InviteLocationGroup {
  return value === 'sushi' || value === 'poki' || value === 'both' ? value : 'both';
}

class InviteError extends Error {
  reason: InviteFailureReason;
  invitedBy: string | null;

  constructor(reason: InviteFailureReason, message?: string, invitedBy: string | null = null) {
    super(message ?? describeInviteFailure(reason));
    this.reason = reason;
    this.invitedBy = invitedBy;
  }
}

class InviteServiceError extends Error {
  code: string | null;

  constructor(message: string, code: string | null = null) {
    super(message);
    this.code = code;
  }
}

export function getInviteFailureReason(error: unknown): InviteFailureReason | null {
  return error instanceof InviteError ? error.reason : null;
}

export function getInviteErrorInvitedBy(error: unknown): string | null {
  return error instanceof InviteError ? error.invitedBy : null;
}

export function isInviteAlreadyOnTeam(error: unknown): boolean {
  return error instanceof InviteServiceError && error.code === 'already_on_team';
}

export function getInviteServiceCode(error: unknown): string | null {
  return error instanceof InviteServiceError ? error.code : null;
}

export function isInviteNetworkError(error: unknown): boolean {
  if (error instanceof InviteServiceError && error.code === 'service_unavailable') return true;
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  return (
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('connection') ||
    message.includes('failed to send')
  );
}

/**
 * Dry-run validation ({token, validateOnly: true}) — shows the invitee their
 * name/role before they fill anything in. Throws InviteError on bad tokens.
 */
export async function fetchInvitePreview(token: string): Promise<InvitePreview> {
  const trimmed = token.trim();
  if (!trimmed) throw new InviteError('invalid');

  const { data, error } = await supabase.functions.invoke('accept-invite', {
    body: { token: trimmed, validateOnly: true },
  });

  if (error) {
    const { message, reason, invitedBy } = await getFunctionErrorDetails(error);
    throw new InviteError(reason ?? classifyInviteFailure(message), message ?? undefined, invitedBy);
  }

  const payload = isRecord(data) ? data : null;

  // Backend dry-run responds {valid, invitedName, role, reason}; tolerate {ok}.
  if (payload?.ok !== true && payload?.valid !== true) {
    const structured = readReason(payload?.reason);
    const message = typeof payload?.error === 'string' ? payload.error : null;
    throw new InviteError(
      structured ?? classifyInviteFailure(message),
      message ?? undefined,
      readName(payload?.invitedBy),
    );
  }

  return {
    invitedName: readName(payload.invitedName) ?? readName(payload.invited_name),
    invitedEmail: readName(payload.invitedEmail),
    invitedBy: readName(payload.invitedBy),
    role: readRole(payload.role),
    locationGroup: readLocationGroup(payload.locationGroup),
  };
}

/**
 * Full accept: the edge function creates/claims the account server-side with
 * the service role, marks the invite used, and returns {ok, role}. The caller
 * then signs in with the same credentials.
 */
export async function acceptInvite(input: AcceptInviteInput): Promise<AcceptedInvite> {
  const { data, error } = await supabase.functions.invoke('accept-invite', {
    body: {
      token: input.token.trim(),
      email: input.email,
      password: input.password,
    },
  });

  if (error) {
    // Prefer the structured reason from the 409 body (mirrors the dry-run
    // handling); keyword classification is only the fallback for older
    // backends that send just an error string.
    const { message, reason: structuredReason, code } = await getFunctionErrorDetails(error);
    if (message || structuredReason) {
      const reason = structuredReason ?? classifyInviteFailure(message);
      if (reason !== 'invalid') {
        throw new InviteError(reason, message ?? undefined);
      }
      throw new InviteServiceError(message ?? describeInviteFailure(reason), code);
    }
    throw new InviteServiceError('Unable to accept the invite. Please try again.');
  }

  const payload = isRecord(data) ? data : null;
  if (payload?.ok !== true) {
    const message = typeof payload?.error === 'string' ? payload.error : null;
    throw new InviteServiceError(
      message ?? 'Unable to accept the invite. Please try again.',
      readString(payload?.reason),
    );
  }

  const role = readRole(payload.role);
  if (!role) {
    throw new Error('Unexpected response from accept-invite.');
  }

  return { role, locationGroup: readLocationGroup(payload.locationGroup) };
}

/** Claim an invite for the currently authenticated Google or Apple user. */
export async function acceptInviteLink(token: string): Promise<AcceptedInvite> {
  const trimmed = token.trim();
  if (!trimmed) throw new InviteError('invalid');

  const { data, error } = await supabase.functions.invoke('accept-invite', {
    body: { token: trimmed },
  });

  if (error) {
    const details = await getFunctionErrorDetails(error);
    if (details.reason) {
      throw new InviteError(details.reason, details.message ?? undefined, details.invitedBy);
    }
    throw new InviteServiceError(
      details.message ?? 'Unable to accept the invite. Check your connection and try again.',
      details.code,
    );
  }

  const payload = isRecord(data) ? data : null;
  if (payload?.ok !== true) {
    const message = typeof payload?.error === 'string' ? payload.error : null;
    throw new InviteServiceError(
      message ?? 'Unable to accept the invite. Try again.',
      readString(payload?.reason),
    );
  }

  const role = readRole(payload.role);
  if (!role) {
    throw new Error('Unexpected response from accept-invite.');
  }

  return { role, locationGroup: readLocationGroup(payload.locationGroup) };
}

/**
 * Manager-side invite creation (mirrors web/src/lib/dashboard/invites.ts).
 * Duplicate sign-in names come back as a 409 with a clear message.
 */
export async function createInvite(input: CreateInviteInput): Promise<CreatedInvite> {
  const { data, error } = await supabase.functions.invoke('create-invite', {
    body: {
      invitedName: input.invitedName.trim(),
      invitedEmail: input.invitedEmail?.trim() || undefined,
      role: input.role,
      expiresInHours: input.expiresInHours,
      modulePreset: input.modulePreset,
      locationGroup: input.locationGroup,
    },
  });

  if (error) {
    const { message } = await getFunctionErrorDetails(error);
    throw new Error(message ?? 'Unable to create the invite. Try again.');
  }

  const payload = isRecord(data) ? data : null;
  if (
    typeof payload?.inviteId !== 'string' ||
    typeof payload?.token !== 'string' ||
    typeof payload?.joinUrl !== 'string'
  ) {
    const message = typeof payload?.error === 'string' ? payload.error : null;
    throw new Error(message ?? 'Unexpected response from create-invite.');
  }

  return {
    inviteId: payload.inviteId,
    token: payload.token,
    joinUrl: payload.joinUrl,
    locationGroup: readLocationGroup(payload.locationGroup),
  };
}

/** Manager-side revoke (mirrors the dashboard's revokeInvite). */
export async function revokeInvite(inviteId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke('revoke-invite', {
    body: { inviteId },
  });

  if (error) {
    const { message } = await getFunctionErrorDetails(error);
    throw new Error(message ?? 'Unable to revoke the invite.');
  }

  const payload = isRecord(data) ? data : null;
  if (payload?.ok !== true) {
    const message = typeof payload?.error === 'string' ? payload.error : null;
    throw new Error(message ?? 'Unable to revoke the invite.');
  }
}
