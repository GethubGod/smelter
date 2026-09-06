const CANONICAL_EXPO_PUSH_TOKEN = /^Expo(?:nent)?PushToken\[[^\]\s]+\]$/u;

/**
 * Return the one sender-safe spelling of an Expo push token.
 *
 * String.trim() removes the ECMAScript whitespace set, including U+FEFF,
 * U+00A0, U+2028, U+2029, U+1680, U+2000 through U+200A, U+202F, U+205F,
 * U+3000, and ASCII whitespace. The database migration applies the same set
 * before enforcing the same token grammar.
 */
export function canonicalizeExpoPushToken(token: unknown): string | null {
  if (typeof token !== 'string') return null;

  const canonical = token.trim();
  return CANONICAL_EXPO_PUSH_TOKEN.test(canonical) ? canonical : null;
}
