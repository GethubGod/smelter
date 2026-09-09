/**
 * Issue #70.
 *
 * Advanced ordering hit its error boundary once when the user sent a new
 * message while the cart had been rehydrated from
 * `quick_order_sessions.parsed_items` and still held an item with no resolved
 * unit. The original failure did not reproduce here, so the first block drives
 * the pure pipeline the composer send path runs over `parsedItems` as a
 * regression guard, and the last two cover the guards added for that state:
 * rehydrated rows are normalized on load so an unresolved unit always shows a
 * resolve prompt, and the render-phase cart update can no longer throw into the
 * error boundary.
 */
import {
  applyQuickOrderOperations,
  countUnresolvedItems,
  getParsedItemIssue,
  getParsedItemKey,
  isParsedItemReady,
  mergeQuickOrderParsedItemsDetailed,
  normalizeQuickOrderItemForDisplay,
  detectRepeatedOrderList,
  formatParsedItemQuantity,
  getParsedItemDisplayName,
  updateParsedItem,
  removeParsedItem,
  type ParsedQuickOrderItem,
} from '../features/ordering/quickOrderItems';
import {
  buildQuickOrderAssistantMessage,
  hasQuickOrderStateChange,
  normalizeQuickOrderParseResponse,
} from '../features/ordering/quickOrderResponse';
import {
  getQuantityFixQueue,
  resolveQuantityUnitOptions,
  getQuantitySheetInitialState,
} from '../features/ordering/quickOrderQuantityFlow';
import {
  areQuickOrderItemsCartReady,
  quickOrderItemsToCartAdds,
} from '../store/helpers/quickOrderCart';
import {
  applyQuickOrderCartUpdate,
  normalizePersistedQuickOrderItems,
  QUICK_ORDER_CART_APPLY_ERROR_CODE,
} from '../features/ordering/quickOrderSendGuards';
import { toFriendlyQuickOrderError } from '../features/ordering/quickOrderErrors';

/**
 * A cart as it comes back off `quick_order_sessions.parsed_items`: raw JSON,
 * no display normalization. Salmon is the "1 to fix" row from the report —
 * matched to an inventory id but with no unit.
 */
function rehydratedCartWithMissingUnit(): ParsedQuickOrderItem[] {
  return JSON.parse(
    JSON.stringify([
      {
        item_id: 'rice-id',
        item_name: 'Fixture Rice',
        raw_token: '2 bags of fixture rice',
        quantity: 2,
        unit: 'bag',
        status: 'valid',
        needs_clarification: false,
        unresolved: false,
      },
      {
        item_id: 'salmon-id',
        item_name: 'Fixture Salmon',
        raw_token: '3 fixture salmon',
        quantity: 3,
        unit: null,
        valid_units: ['lb', 'cs'],
        status: 'missing_unit',
        action: 'Choose unit',
        needs_clarification: true,
        unresolved: false,
      },
    ]),
  ) as ParsedQuickOrderItem[];
}

/** Same cart, but the unit is an id the catalog no longer knows about. */
function rehydratedCartWithStaleUnit(): ParsedQuickOrderItem[] {
  const items = rehydratedCartWithMissingUnit();
  items[1] = {
    ...items[1],
    unit: 'legacy-unit-id-4471',
    valid_units: ['lb', 'cs'],
    status: 'invalid_unit',
    action: 'Fix unit',
  };
  return items;
}

/** Cart where the unit key is missing from the JSON entirely (undefined). */
function rehydratedCartWithAbsentUnit(): ParsedQuickOrderItem[] {
  const items = rehydratedCartWithMissingUnit();
  const salmon = { ...items[1] } as Record<string, unknown>;
  delete salmon.unit;
  delete salmon.valid_units;
  delete salmon.status;
  items[1] = salmon as ParsedQuickOrderItem;
  return items;
}

/** The parse-order payload for "4 packs of fixture nori". */
const NORI_PARSE_RESPONSE = {
  status: 'ok',
  assistant_message: 'Got it.',
  parsed_items: [
    {
      item_id: 'nori-id',
      item_name: 'Fixture Nori',
      raw_text: '4 packs of fixture nori',
      quantity: 4,
      unit: 'pack',
      status: 'valid',
    },
  ],
};

/** Mirrors QuickOrderScreen.buildQuickOrderCartHash. */
function buildQuickOrderCartHash(items: ParsedQuickOrderItem[]): string {
  return items
    .filter((item) => item.item_id && item.quantity != null)
    .map(
      (item) =>
        `${item.item_id}:${Number(item.quantity ?? 0).toFixed(4)}:${String(item.unit ?? '')
          .trim()
          .toLowerCase()}`,
    )
    .sort()
    .join('|');
}

/**
 * Everything the composer send path runs over `parsedItems`, in the order the
 * screen runs it: the pre-send helpers, the parse response normalization, the
 * `setParsedItems` render-phase updater (operations -> merge -> assistant
 * message), and the post-send reads.
 */
function runSendPipeline(rehydrated: ParsedQuickOrderItem[]) {
  // Pre-send reads.
  buildQuickOrderCartHash(rehydrated);
  countUnresolvedItems(rehydrated);
  rehydrated.forEach((item) => {
    getParsedItemIssue(item);
    getParsedItemKey(item);
    getParsedItemDisplayName(item);
    formatParsedItemQuantity(item);
    isParsedItemReady(item);
  });
  getQuantityFixQueue(rehydrated);

  const response = normalizeQuickOrderParseResponse(NORI_PARSE_RESPONSE);

  // The render-phase state updater.
  const operationResult =
    response.operations.length > 0
      ? applyQuickOrderOperations(rehydrated, response.operations)
      : null;
  const operationBase = operationResult ? operationResult.items : rehydrated;
  const mergeResult = mergeQuickOrderParsedItemsDetailed(
    operationBase,
    response.parsedItems,
  );
  hasQuickOrderStateChange(mergeResult, response.pendingActions.length, operationResult);
  const assistantMessage = buildQuickOrderAssistantMessage({
    normalized: response,
    mergeResult,
    pendingCount: response.pendingActions.length,
    operationResult,
  });

  // Post-send reads.
  const next = mergeResult.items;
  countUnresolvedItems(next);
  buildQuickOrderCartHash(next);
  detectRepeatedOrderList(next, response.parsedItems);
  next.map((item) => item.item_id);
  areQuickOrderItemsCartReady(next);
  getQuantityFixQueue(next);

  return { assistantMessage, items: next, mergeResult };
}

describe('issue #70: sending after a rehydrated cart with an unresolved unit', () => {
  test.each([
    ['unit null', rehydratedCartWithMissingUnit],
    ['unit absent from the persisted JSON', rehydratedCartWithAbsentUnit],
    ['unit id no longer in the catalog', rehydratedCartWithStaleUnit],
  ])('send pipeline does not throw when the rehydrated cart has %s', (_label, build) => {
    expect(() => runSendPipeline(build())).not.toThrow();
  });

  test('the unresolved row survives the send and still reports an issue', () => {
    const { items } = runSendPipeline(rehydratedCartWithMissingUnit());
    const salmon = items.find((item) => item.item_id === 'salmon-id');
    expect(salmon).toBeDefined();
    expect(getParsedItemIssue(salmon as ParsedQuickOrderItem)).not.toBeNull();
    expect(items.some((item) => item.item_id === 'nori-id')).toBe(true);
  });

  test('the cart is never reported ready while a unit is unresolved', () => {
    const { items } = runSendPipeline(rehydratedCartWithMissingUnit());
    expect(areQuickOrderItemsCartReady(items)).toBe(false);
  });

  test('the quantity sheet can still be built for a rehydrated unresolved row', () => {
    const items = rehydratedCartWithMissingUnit();
    const salmon = items[1];
    expect(() => {
      const resolution = resolveQuantityUnitOptions({
        item: salmon,
        inventoryItem: null,
        suggestion: null,
      });
      getQuantitySheetInitialState({
        item: salmon,
        options: resolution.options,
        defaultValue: resolution.defaultValue,
        suggestion: null,
      });
    }).not.toThrow();
  });

  test('editing and removing a rehydrated unresolved row does not throw', () => {
    const items = rehydratedCartWithMissingUnit();
    const key = getParsedItemKey(items[1]);
    expect(() => {
      updateParsedItem(items, key, { unit: 'lb' });
      removeParsedItem(items, key);
      normalizeQuickOrderItemForDisplay(items[1]);
    }).not.toThrow();
  });

  test('confirm conversion refuses a cart with an unresolved unit instead of half-submitting', () => {
    const { items } = runSendPipeline(rehydratedCartWithMissingUnit());
    expect(() => quickOrderItemsToCartAdds(items, new Map())).toThrow();
  });
});

describe('normalizePersistedQuickOrderItems', () => {
  test('turns a persisted row with no unit into a visible "Choose unit" prompt', () => {
    // Persisted while the row was still being fixed: the stored status says
    // "valid" but there is no unit on the row.
    const [item] = normalizePersistedQuickOrderItems([
      {
        item_id: 'salmon-id',
        item_name: 'Fixture Salmon',
        quantity: 3,
        unit: null,
        valid_units: ['lb', 'cs'],
        status: 'valid',
        needs_clarification: false,
      },
    ]);

    expect(item.status).toBe('missing_unit');
    expect(item.action).toBe('Choose unit');
    expect(getParsedItemIssue(item)).toEqual({ kind: 'pick-unit', label: 'Choose unit' });
    expect(isParsedItemReady(item)).toBe(false);
  });

  test('keeps a "Fix unit" prompt for a unit id that is no longer in the catalog', () => {
    const [item] = normalizePersistedQuickOrderItems([
      {
        item_id: 'salmon-id',
        item_name: 'Fixture Salmon',
        quantity: 3,
        unit: 'legacy-unit-id-4471',
        valid_units: ['lb', 'cs'],
        status: 'invalid_unit',
      },
    ]);

    expect(item.action).toBe('Fix unit');
    expect(getParsedItemIssue(item)?.kind).toBe('fix-unit');
  });

  test('fills the only orderable unit instead of prompting for it', () => {
    const [item] = normalizePersistedQuickOrderItems([
      {
        item_id: 'nori-id',
        item_name: 'Fixture Nori',
        quantity: 4,
        unit: null,
        valid_units: ['pack'],
        status: 'missing_unit',
      },
    ]);

    expect(item.unit).toBe('pack');
    expect(getParsedItemIssue(item)).toBeNull();
  });

  test('drops entries there is nothing to render and tolerates a non-array payload', () => {
    expect(normalizePersistedQuickOrderItems(null)).toEqual([]);
    expect(normalizePersistedQuickOrderItems('not-an-array')).toEqual([]);
    expect(
      normalizePersistedQuickOrderItems([null, 'nope', [], {}, { quantity: 2, unit: 'cs' }]),
    ).toEqual([]);
  });

  test('keeps a nameless row so it still shows an "Unknown item" prompt', () => {
    const items = normalizePersistedQuickOrderItems([
      { raw_token: '3 fillets fixture salmon', quantity: 3, unit: null },
    ]);

    expect(items).toHaveLength(1);
    expect(getParsedItemDisplayName(items[0])).toBe('3 fillets fixture salmon');
    expect(getParsedItemIssue(items[0])?.kind).toBe('choose-item');
  });
});

describe('applyQuickOrderCartUpdate', () => {
  test('commits the computed cart when the update succeeds', () => {
    const current = rehydratedCartWithMissingUnit();
    const next = [...current, { ...current[0], item_id: 'nori-id' }];

    const result = applyQuickOrderCartUpdate(current, () => ({
      items: next,
      snapshot: 'applied',
    }));

    expect(result.error).toBeNull();
    expect(result.snapshot).toBe('applied');
    expect(result.items).toBe(next);
  });

  test('leaves the cart untouched and reports the failure instead of throwing', () => {
    const current = rehydratedCartWithMissingUnit();
    const boom = new TypeError("Cannot read properties of null (reading 'trim')");

    let result!: ReturnType<typeof applyQuickOrderCartUpdate<string>>;
    expect(() => {
      result = applyQuickOrderCartUpdate<string>(current, () => {
        throw boom;
      });
    }).not.toThrow();

    expect(result.items).toBe(current);
    expect(result.snapshot).toBeNull();
    expect(result.error).toBe(boom);
  });

  test('treats a malformed cart result as a failure rather than committing it', () => {
    const current = rehydratedCartWithMissingUnit();
    const result = applyQuickOrderCartUpdate(current, () =>
      ({ items: undefined, snapshot: 'bad' } as unknown as {
        items: ParsedQuickOrderItem[];
        snapshot: string;
      }),
    );

    expect(result.items).toBe(current);
    expect(result.snapshot).toBeNull();
    expect(result.error).toBeInstanceOf(Error);
  });

  test('the failure code maps to user-facing copy, not a stack trace', () => {
    const message = toFriendlyQuickOrderError(
      undefined,
      QUICK_ORDER_CART_APPLY_ERROR_CODE,
    );
    expect(message).toContain('order list');
    expect(message).not.toMatch(/TypeError|undefined|null/);
  });
});
