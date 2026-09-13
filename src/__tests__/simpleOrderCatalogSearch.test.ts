import {
  buildCatalogSearchIndex,
  filterCatalogSearchIndex,
  filterCatalogItems,
  mapVoiceActionsToAdditions,
} from '@/features/simpleOrder/catalogSearch';
import {
  initSelection,
  selectionReducer,
} from '@/features/simpleOrder/checklistSelection';
import type { Checklist } from '@/services/orderChecklist';
import type {
  VoiceParsedAction,
  VoiceUnresolvedAction,
} from '@/features/ordering/quickOrderVoice';
import type { InventoryItem } from '@/types';

function makeInventoryItem(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: 'inv-1',
    name: 'Salmon (Fresh)',
    category: 'protein',
    supplier_category: 'main_distributor',
    base_unit: 'lb',
    pack_unit: 'case',
    pack_size: 10,
    active: true,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  } as InventoryItem;
}

function makeVoiceAction(overrides: Partial<VoiceParsedAction> = {}): VoiceParsedAction {
  return {
    type: 'add',
    itemId: 'inv-1',
    itemName: 'Salmon (Fresh)',
    canonicalItemName: 'Salmon (Fresh)',
    spokenItemName: 'salmon',
    quantity: 2,
    unit: 'lb',
    confidence: 0.9,
    catalogMatchConfidence: 0.9,
    sourceText: 'two pounds of salmon',
    ...overrides,
  };
}

describe('filterCatalogItems', () => {
  const catalog = [
    makeInventoryItem({ id: 'b', name: 'Smoked Salmon' }),
    makeInventoryItem({ id: 'a', name: 'Salmon (Fresh)' }),
    makeInventoryItem({ id: 'c', name: 'Tuna', aliases: ['maguro', 'saku salmon cut'] }),
    makeInventoryItem({ id: 'd', name: 'Rice' }),
  ];

  it('returns nothing for an empty query', () => {
    expect(filterCatalogItems(catalog, '')).toEqual([]);
    expect(filterCatalogItems(catalog, '   ')).toEqual([]);
  });

  it('matches item-name substrings case-insensitively in catalogue order', () => {
    const results = filterCatalogItems(catalog, 'salmon');
    expect(results.map((item) => item.id)).toEqual(['b', 'a']);
    expect(filterCatalogItems(catalog, 'SMOKED').map((item) => item.id)).toEqual(['b']);
  });

  it('does not include alias-only matches', () => {
    expect(filterCatalogItems(catalog, 'MAGURO')).toEqual([]);
  });

  it('respects the result limit', () => {
    const results = filterCatalogItems(catalog, 'salmon', 2);
    expect(results).toHaveLength(2);
  });

  it('returns only the first six matches by default', () => {
    const matches = Array.from({ length: 8 }, (_, index) =>
      makeInventoryItem({ id: `match-${index}`, name: `Match ${index}` }),
    );
    expect(filterCatalogItems(matches, 'match').map((item) => item.id)).toEqual([
      'match-0',
      'match-1',
      'match-2',
      'match-3',
      'match-4',
      'match-5',
    ]);
  });

  it('indexes each item name once across repeated queries', () => {
    let nameReads = 0;
    const indexedCatalog = Array.from({ length: 40 }, (_, index) => {
      const item = makeInventoryItem({ id: `indexed-${index}` });
      Object.defineProperties(item, {
        name: {
          configurable: true,
          enumerable: true,
          get: () => {
            nameReads += 1;
            return `Ingredient ${index}`;
          },
        },
      });
      return item;
    });

    const index = buildCatalogSearchIndex(indexedCatalog);
    for (const query of ['ingredient', 'ingredient 3', 'missing']) {
      filterCatalogSearchIndex(index, query);
    }

    expect(nameReads).toBe(indexedCatalog.length);
  });
});

describe('mapVoiceActionsToAdditions', () => {
  const catalog = [
    makeInventoryItem({ id: 'inv-1', name: 'Salmon (Fresh)', default_order_unit: 'lb' }),
    makeInventoryItem({ id: 'inv-2', name: 'Rice', base_unit: 'bag' }),
  ];

  it('maps resolved add actions onto catalog items with clamped quantities', () => {
    const { additions, unmatched } = mapVoiceActionsToAdditions(
      [makeVoiceAction({ quantity: 2 })],
      [],
      catalog,
    );
    expect(unmatched).toEqual([]);
    expect(additions).toHaveLength(1);
    expect(additions[0].item.id).toBe('inv-1');
    expect(additions[0].quantity).toBe(2);
    expect(additions[0].unit).toBe('lb');
    expect(additions[0].spokenUnit).toBeNull();
  });

  it('keeps the item unit and surfaces a differing spoken unit', () => {
    const { additions } = mapVoiceActionsToAdditions(
      [makeVoiceAction({ itemId: 'inv-2', unit: 'case', quantity: 3 })],
      [],
      catalog,
    );
    expect(additions[0].unit).toBe('bag');
    expect(additions[0].spokenUnit).toBe('case');
  });

  it('reports unknown items, non-add actions, and unresolved entries as unmatched', () => {
    const unresolved: VoiceUnresolvedAction[] = [
      { sourceText: 'some mumbling', reason: 'unknown_item', spokenItemName: 'mystery fish' },
    ];
    const { additions, unmatched } = mapVoiceActionsToAdditions(
      [
        makeVoiceAction({ itemId: 'inv-missing', spokenItemName: 'dragon fruit' }),
        makeVoiceAction({ type: 'remove', spokenItemName: 'rice' }),
      ],
      unresolved,
      catalog,
    );
    expect(additions).toEqual([]);
    expect(unmatched).toEqual(['dragon fruit', 'rice', 'mystery fish']);
  });

  it('dedupes repeated mentions of the same item', () => {
    const { additions } = mapVoiceActionsToAdditions(
      [makeVoiceAction({ quantity: 2 }), makeVoiceAction({ quantity: 5 })],
      [],
      catalog,
    );
    expect(additions).toHaveLength(1);
    expect(additions[0].quantity).toBe(2);
  });

  it('uses null quantity when nothing was heard so defaults apply', () => {
    const { additions } = mapVoiceActionsToAdditions(
      [makeVoiceAction({ quantity: null })],
      [],
      catalog,
    );
    expect(additions[0].quantity).toBeNull();
  });
});

describe('selectionReducer auto-check on quantity edits', () => {
  const checklist: Checklist = {
    id: 'chk-1',
    locationGroup: 'sushi',
    generatedAt: '2026-08-10T00:00:00Z',
    items: [
      {
        id: 'line-1',
        itemId: 'inv-1',
        itemName: 'Salmon',
        unit: 'lb',
        defaultChecked: false,
        recommendedQty: 3,
        stalenessBucket: 'occasional',
        lastOrderedAt: null,
        sortOrder: 0,
      },
    ],
  };

  it('checks an unchecked line when its quantity is stepped', () => {
    const state = initSelection(checklist);
    expect(state.lines[0].checked).toBe(false);
    const next = selectionReducer(state, {
      type: 'adjustQuantity',
      key: 'line-1',
      delta: 1,
    });
    expect(next.lines[0].checked).toBe(true);
    expect(next.lines[0].quantity).toBe(4);
  });

  it('checks an unchecked line when a quantity is typed', () => {
    const state = initSelection(checklist);
    const next = selectionReducer(state, {
      type: 'setQuantity',
      key: 'line-1',
      quantity: 6,
    });
    expect(next.lines[0].checked).toBe(true);
    expect(next.lines[0].quantity).toBe(6);
  });

  it('still no-ops when quantity and checked state are unchanged', () => {
    const state = initSelection(checklist);
    const checked = selectionReducer(state, { type: 'toggle', key: 'line-1' });
    const next = selectionReducer(checked, {
      type: 'setQuantity',
      key: 'line-1',
      quantity: checked.lines[0].quantity,
    });
    expect(next).toBe(checked);
  });
});
