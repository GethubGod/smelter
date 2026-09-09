import {
  buildSendAllSuppliersParam,
  parseSendAllSuppliersParam,
} from '@/features/fulfillment/sendAll/sendAllParams';

/**
 * expo-router's route params are not symmetric: `router.push({ params })`
 * encodes each value once, while the read side decodes twice (the query is
 * parsed with `URL`, then `useLocalSearchParams` runs `decodeURIComponent`
 * again). This reproduces that exact chain so the Send All param contract is
 * tested against the router's real behaviour rather than an assumed one.
 *
 * Mirrors expo-router 6.0.24:
 *   node_modules/expo-router/build/link/href.js            (createQueryParams)
 *   node_modules/expo-router/build/fork/getStateFromPath-forks.js (parseQueryParams)
 *   node_modules/expo-router/build/hooks.js                (useLocalSearchParams)
 */
function throughExpoRouter(paramValue: string): string {
  const href = `/(manager)/fulfillment-send-all?suppliers=${encodeURIComponent(paramValue)}`;
  const afterUrlParse = new URL(href, 'https://phony.example').searchParams.get('suppliers');
  if (afterUrlParse === null) return '';
  try {
    return decodeURIComponent(afterUrlParse);
  } catch {
    return afterUrlParse;
  }
}

const SUPPLIER_A = '49000000-0000-4000-8000-000000000001';
const SUPPLIER_B = '49000000-0000-4000-8000-000000000002';

describe('Send All route params', () => {
  it('round trips a single supplier id through expo-router', () => {
    const param = buildSendAllSuppliersParam([{ id: SUPPLIER_A }]);
    expect(parseSendAllSuppliersParam(throughExpoRouter(param))).toEqual([
      { id: SUPPLIER_A, name: null },
    ]);
  });

  it('round trips several supplier ids in order', () => {
    const param = buildSendAllSuppliersParam([{ id: SUPPLIER_A }, { id: SUPPLIER_B }]);
    expect(parseSendAllSuppliersParam(throughExpoRouter(param)).map((entry) => entry.id)).toEqual([
      SUPPLIER_A,
      SUPPLIER_B,
    ]);
  });

  it('drops blank and duplicate ids when building the param', () => {
    expect(
      buildSendAllSuppliersParam([
        { id: SUPPLIER_A },
        { id: '  ' },
        { id: SUPPLIER_A },
        { id: SUPPLIER_B },
      ])
    ).toBe(`${SUPPLIER_A},${SUPPLIER_B}`);
  });

  it('survives a supplier name that contains a percent sign', () => {
    // The old contract shipped JSON through the param and ran one more
    // decodeURIComponent than the router had encodes left, so a literal `%`
    // reaching the parser threw URIError and the screen fell back to the
    // "Nothing left to send" empty state.
    const legacy = encodeURIComponent(
      JSON.stringify([{ id: SUPPLIER_A, name: 'Sushi 100% Foods' }])
    );
    const arrived = throughExpoRouter(legacy);
    expect(() => decodeURIComponent(arrived)).toThrow();
    expect(parseSendAllSuppliersParam(arrived)).toEqual([
      { id: SUPPLIER_A, name: 'Sushi 100% Foods' },
    ]);
  });

  it('still reads the legacy JSON payload at its original encoding depth', () => {
    const legacy = encodeURIComponent(
      JSON.stringify([
        { id: SUPPLIER_A, name: 'Local QA Supplier' },
        { id: SUPPLIER_B, name: 'Second Supplier' },
      ])
    );
    expect(parseSendAllSuppliersParam(throughExpoRouter(legacy))).toEqual([
      { id: SUPPLIER_A, name: 'Local QA Supplier' },
      { id: SUPPLIER_B, name: 'Second Supplier' },
    ]);
  });

  it('reads a legacy JSON payload that arrives fully decoded', () => {
    const raw = JSON.stringify([{ id: SUPPLIER_A, name: 'Local QA Supplier' }]);
    expect(parseSendAllSuppliersParam(raw)).toEqual([
      { id: SUPPLIER_A, name: 'Local QA Supplier' },
    ]);
  });

  it('returns an empty list for a missing or unusable param', () => {
    expect(parseSendAllSuppliersParam(undefined)).toEqual([]);
    expect(parseSendAllSuppliersParam('')).toEqual([]);
    expect(parseSendAllSuppliersParam('   ')).toEqual([]);
    expect(parseSendAllSuppliersParam(',,')).toEqual([]);
    expect(parseSendAllSuppliersParam('[]')).toEqual([]);
  });

  it('takes the first value when expo-router hands back an array', () => {
    expect(parseSendAllSuppliersParam([`${SUPPLIER_A},${SUPPLIER_B}`, SUPPLIER_A])).toEqual([
      { id: SUPPLIER_A, name: null },
      { id: SUPPLIER_B, name: null },
    ]);
  });
});
