// Device-local entry session + A/B variant assignment (localStorage).
// The session token is opaque; the server holds the scoping (location) and
// attribution (closer). What we cache here is display state only.

import type { VoiceVariant } from "@/types/database";

const SESSION_KEY = "bt_tips_session";
const VARIANT_KEY = "bt_tips_voice_variant";
const CLOSER_KEY = "bt_tips_closer";
const ONBOARDED_KEY = "bt_tips_onboarded";

export interface StoredSession {
  token: string;
  locationId: string;
  locationName: string;
  closerId: string | null;
  closerName: string | null;
}

export function parseStoredSession(value: unknown): StoredSession | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.token !== "string" ||
    !candidate.token ||
    typeof candidate.locationId !== "string" ||
    !candidate.locationId
  ) {
    return null;
  }
  return {
    token: candidate.token,
    locationId: candidate.locationId,
    locationName:
      typeof candidate.locationName === "string" ? candidate.locationName : "",
    closerId: typeof candidate.closerId === "string" ? candidate.closerId : null,
    closerName: typeof candidate.closerName === "string" ? candidate.closerName : null,
  };
}

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadSession(): StoredSession | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(SESSION_KEY);
    if (!raw) return null;
    return parseStoredSession(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveSession(session: StoredSession): void {
  storage()?.setItem(SESSION_KEY, JSON.stringify(session));
}

export function updateSession(patch: Partial<StoredSession>): StoredSession | null {
  const current = loadSession();
  if (!current) return null;
  const next = { ...current, ...patch };
  saveSession(next);
  return next;
}

export function clearSession(): void {
  storage()?.removeItem(SESSION_KEY);
}

/**
 * Device-remembered "who's closing" — survives across entry sessions so the
 * same phone skips the roster screen on its next scan. Keyed per location:
 * a phone that scans the other store's QR code still gets asked.
 */
export interface RememberedCloser {
  locationId: string;
  closerId: string;
  closerName: string;
}

export function loadRememberedCloser(locationId?: string): RememberedCloser | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(CLOSER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RememberedCloser>;
    if (
      typeof parsed.locationId !== "string" ||
      typeof parsed.closerId !== "string" ||
      typeof parsed.closerName !== "string"
    ) {
      return null;
    }
    // With a locationId the caller wants a match for THAT store; without one
    // (the /e fast path) the stored entry rides to the server, which enforces
    // the location match itself.
    if (locationId !== undefined && parsed.locationId !== locationId) return null;
    return {
      locationId: parsed.locationId,
      closerId: parsed.closerId,
      closerName: parsed.closerName,
    };
  } catch {
    return null;
  }
}

export function saveRememberedCloser(remembered: RememberedCloser): void {
  storage()?.setItem(CLOSER_KEY, JSON.stringify(remembered));
}

export function clearRememberedCloser(): void {
  storage()?.removeItem(CLOSER_KEY);
}

/** First-visit onboarding carousel: shown once per device. */
export function hasOnboarded(): boolean {
  return storage()?.getItem(ONBOARDED_KEY) === "1";
}

export function markOnboarded(): void {
  storage()?.setItem(ONBOARDED_KEY, "1");
}

/**
 * A/B assignment for the voice sheet feedback element, randomized once per
 * device and persisted; recorded on every voice entry as voice_variant.
 */
export function getVoiceVariant(): VoiceVariant {
  const store = storage();
  const existing = store?.getItem(VARIANT_KEY);
  if (existing === "waveform" || existing === "live_transcript") return existing;
  const assigned: VoiceVariant = Math.random() < 0.5 ? "waveform" : "live_transcript";
  store?.setItem(VARIANT_KEY, assigned);
  return assigned;
}
