import { canonicalizeExpoPushToken } from './expoPushToken.ts';

const TOKEN = 'ExponentPushToken[fixture-device]';

Deno.test('canonicalizeExpoPushToken strips the ECMAScript trim whitespace set', () => {
  const fixtures = [
    `\uFEFF${TOKEN}`,
    `${TOKEN}\uFEFF`,
    `\u00A0${TOKEN}\u00A0`,
    `\uFEFF\u00A0${TOKEN}\u00A0\uFEFF`,
    `\u2028\u1680${TOKEN}\u3000\u2029`,
    `\t\n\v\f\r ${TOKEN} `,
  ];

  for (const fixture of fixtures) {
    const actual = canonicalizeExpoPushToken(fixture);
    if (actual !== TOKEN) {
      throw new Error(`Expected canonical token, got ${String(actual)}`);
    }
  }
});

Deno.test('canonicalizeExpoPushToken enforces the complete token grammar', () => {
  const invalid = [
    null,
    '',
    'ExponentPushToken[]',
    'ExponentPushToken[bad token]',
    'ExponentPushToken[bad\ttoken]',
    'ExponentPushToken[closed]junk',
    'prefixExponentPushToken[token]',
    'ExpoPushToken[token]]',
  ];

  for (const fixture of invalid) {
    if (canonicalizeExpoPushToken(fixture) !== null) {
      throw new Error(`Expected token to be rejected: ${String(fixture)}`);
    }
  }

  if (canonicalizeExpoPushToken('ExpoPushToken[token]') !== 'ExpoPushToken[token]') {
    throw new Error('Expected the ExpoPushToken form to be accepted');
  }
});
