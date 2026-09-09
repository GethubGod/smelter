// Route-param contract for the Send All screen.
//
// expo-router is not symmetric about URL encoding: `router.push({ params })`
// encodes each value once (`resolveHref` -> `encodeURIComponent`), but the read
// side decodes twice (`getStateFromPath` parses the query with `URL`, then
// `useLocalSearchParams` runs `decodeURIComponent` again). Any percent sequence
// a caller puts into a param value is therefore consumed on the way in, and a
// value that still contains a literal `%` after that second decode makes a
// third `decodeURIComponent` throw.
//
// So the param carries no encoded payload at all: Send All ships a plain list
// of supplier ids and reads the display names from the supplier lookup. The
// parser still accepts the legacy JSON payload (older builds, saved links) at
// any of the encoding depths it could arrive at.
//
// Pure module — no React/React Native imports. Unit-tested in
// src/__tests__/sendAllParams.test.ts.

export interface SendAllSupplierParam {
  id: string;
  name: string | null;
}

const ID_SEPARATOR = ',';

function toTrimmedId(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Build the `suppliers` route param. The value is handed to expo-router raw:
 * the router does its own encoding, and pre-encoding here would be undone by
 * the router's second decode on the read side.
 */
export function buildSendAllSuppliersParam(
  suppliers: readonly { id: string }[]
): string {
  const seen = new Set<string>();
  const ids: string[] = [];
  suppliers.forEach((supplier) => {
    const id = toTrimmedId(supplier?.id);
    // A comma would split one id into two. No supplier id in this app contains
    // one (uuids, `unknown:`/`unresolved:` sentinels), and dropping is safer
    // than shipping a corrupt id the Send All screen cannot match.
    if (!id || id.includes(ID_SEPARATOR) || seen.has(id)) return;
    seen.add(id);
    ids.push(id);
  });
  return ids.join(ID_SEPARATOR);
}

function parseLegacyJsonPayload(value: string): SendAllSupplierParam[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;

  const entries: SendAllSupplierParam[] = [];
  parsed.forEach((entry) => {
    const id = toTrimmedId((entry as { id?: unknown })?.id);
    if (!id) return;
    const rawName = (entry as { name?: unknown })?.name;
    const name = typeof rawName === 'string' && rawName.trim().length > 0 ? rawName.trim() : null;
    if (entries.some((existing) => existing.id === id)) return;
    entries.push({ id, name });
  });
  return entries;
}

function safeDecode(value: string): string | null {
  try {
    const decoded = decodeURIComponent(value);
    return decoded === value ? null : decoded;
  } catch {
    // A literal `%` that is not a valid escape: the value is already decoded.
    return null;
  }
}

/**
 * Read the `suppliers` route param.
 *
 * Accepts the current comma-separated id list, and the legacy
 * `encodeURIComponent(JSON.stringify([{ id, name }]))` payload at whatever
 * encoding depth it survived at. Returns [] only when the param really carries
 * no supplier id.
 */
export function parseSendAllSuppliersParam(
  raw: string | string[] | undefined | null
): SendAllSupplierParam[] {
  const first = Array.isArray(raw) ? raw[0] : raw;
  if (typeof first !== 'string') return [];
  const value = first.trim();
  if (value.length === 0) return [];

  // Legacy JSON payload, peeling one encoding layer at a time.
  let candidate: string | null = value;
  for (let depth = 0; depth < 3 && candidate !== null; depth += 1) {
    if (candidate.startsWith('[')) {
      const parsed = parseLegacyJsonPayload(candidate);
      if (parsed) return parsed;
    }
    candidate = safeDecode(candidate);
  }

  // Current format: a plain comma-separated id list. The router may still have
  // handed back an encoded separator, so decode once more before splitting.
  const decodedOnce = safeDecode(value);
  const idList = decodedOnce !== null && !decodedOnce.startsWith('[') ? decodedOnce : value;

  const seen = new Set<string>();
  const entries: SendAllSupplierParam[] = [];
  idList.split(ID_SEPARATOR).forEach((part) => {
    const id = toTrimmedId(part);
    if (!id || seen.has(id)) return;
    seen.add(id);
    entries.push({ id, name: null });
  });
  return entries;
}
