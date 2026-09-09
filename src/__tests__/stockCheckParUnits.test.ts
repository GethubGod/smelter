/**
 * Regression cover for issue #73: `loadLocation` matched
 * `area_items.unit_type` against the literal string 'base' and treated
 * everything else as 'pack', so a row denominated in a real unit name
 * ("fillet") had its par multiplied by `pack_size`.
 *
 * Every fixture below mirrors scripts/release-readiness/seed-local-mobile-e2e.sql,
 * the seed the defect was reproduced against.
 */
const mockAsyncStorage = {
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
};

const getStorageAreasMock = jest.fn();
const getAreaItemsMock = jest.fn();
const startOrResumeStockCheckMock = jest.fn();
const recordStockCheckCountMock = jest.fn();
const completeStockCheckMock = jest.fn();

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);
jest.mock('../lib/api/stock', () => ({
  getStorageAreas: getStorageAreasMock,
  getAreaItems: getAreaItemsMock,
}));
jest.mock('../services/stockCheckV2', () => ({
  startOrResumeStockCheck: startOrResumeStockCheckMock,
  recordStockCheckCount: recordStockCheckCountMock,
  completeStockCheck: completeStockCheckMock,
}));

// eslint-disable-next-line import/first -- must load after the jest.mock() calls above so their mock vars are initialized first
import {
  __resetStockCheckSessionCache,
  computeOverallProgress,
  useStockCheckStore,
} from '../features/stock-check/useStockCheckStore';
// eslint-disable-next-line import/first -- same ordering constraint as above
import {
  computeNeedToOrder,
  formatParSubtitle,
  parInBase,
} from '../features/stock-check/utils/stockMath';

const LOCATION_ID = '45000000-0000-4000-8000-000000000001';
const AREA_ID = '47000000-0000-4000-8000-000000000001';
const SALMON_ID = '48000000-0000-4000-8000-000000000001';
const NORI_ID = '48000000-0000-4000-8000-000000000003';
const SESSION_ID = '4d000000-0000-4000-8000-000000000001';

/**
 * The exact `area_items` + joined `inventory_items` shape the fixture seed
 * produces. Fixture Salmon: par_level 8, unit_type 'fillet', order_unit
 * 'case', conversion_factor 10.
 */
function salmonRow() {
  return {
    id: SALMON_ID,
    area_id: AREA_ID,
    min_quantity: 0,
    max_quantity: 10,
    par_level: 8,
    current_quantity: 3,
    unit_type: 'fillet',
    reorder_point: 4,
    inventory_item: {
      id: '46000000-0000-4000-8000-000000000001',
      name: 'Fixture Salmon',
      category: 'fish',
      base_unit: 'fillet',
      pack_unit: 'case',
      pack_size: 10,
    },
  };
}

/** Fixture Nori: par_level 25, unit_type 'pack' (its base unit), case of 50. */
function noriRow() {
  return {
    id: NORI_ID,
    area_id: AREA_ID,
    min_quantity: 0,
    max_quantity: 50,
    par_level: 25,
    current_quantity: 20,
    unit_type: 'pack',
    reorder_point: 10,
    inventory_item: {
      id: '46000000-0000-4000-8000-000000000003',
      name: 'Fixture Nori',
      category: 'dry',
      base_unit: 'pack',
      pack_unit: 'case',
      pack_size: 50,
    },
  };
}

async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 20; i += 1) {
    await Promise.resolve();
  }
}

async function loadRows(rows: unknown[]): Promise<void> {
  getStorageAreasMock.mockResolvedValue([
    { id: AREA_ID, name: 'Fixture Freezer', sort_order: 0, location_id: LOCATION_ID },
  ]);
  getAreaItemsMock.mockResolvedValue(rows);
  await useStockCheckStore.getState().loadLocation(LOCATION_ID);
  await flushMicrotasks();
}

describe('stock-check par units', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __resetStockCheckSessionCache();
    useStockCheckStore.setState(
      {
        locationId: null,
        areas: [],
        itemsById: {},
        selectedAreaId: null,
        expandingItemId: null,
        perLocationState: {},
        isLoading: false,
        loadError: null,
        pendingOps: [],
        isSyncing: false,
        lastSyncAt: null,
        syncError: null,
      },
      false,
    );
    startOrResumeStockCheckMock.mockResolvedValue({ id: SESSION_ID, locationId: LOCATION_ID });
    recordStockCheckCountMock.mockResolvedValue({ areaItemId: SALMON_ID });
    completeStockCheckMock.mockResolvedValue({ id: SESSION_ID, status: 'completed' });
  });

  test('a real unit name resolves to the base unit, not pack', async () => {
    await loadRows([salmonRow()]);

    const item = useStockCheckStore.getState().itemsById[SALMON_ID];
    // Before the fix both of these were 'pack', because the read path matched
    // `unit_type` against the literal 'base'.
    expect(item.countUnitType).toBe('base');
    expect(item.unitType).toBe('base');
    expect(item.parLevel).toBe(8);
  });

  test('the sheet subtitle reads par 8 fillet, not par 8 case', async () => {
    await loadRows([salmonRow()]);

    const item = useStockCheckStore.getState().itemsById[SALMON_ID];
    expect(formatParSubtitle(item)).toBe('par 8 fillet · 1 case ≈ 10 fillet');
  });

  test('6 cases against a par of 8 fillets leaves nothing to order', async () => {
    await loadRows([salmonRow()]);

    useStockCheckStore.getState().commitStockEntry(SALMON_ID, {
      stockUnit: 'pack',
      stockAmount: 6,
      stockPieces: 0,
    });
    await flushMicrotasks();

    const item = useStockCheckStore.getState().itemsById[SALMON_ID];
    // 6 cases is 60 fillets against a par of 8. Before the fix par was read
    // as 8 cases (80 fillets) and this showed 2 to order.
    expect(item.orderQuantity).toBe(0);
    expect(item.status).toBe('at_par');
  });

  test('the area progress header reports nothing to order', async () => {
    await loadRows([salmonRow()]);

    useStockCheckStore.getState().commitStockEntry(SALMON_ID, {
      stockUnit: 'pack',
      stockAmount: 6,
      stockPieces: 0,
    });
    await flushMicrotasks();

    const state = useStockCheckStore.getState();
    expect(computeOverallProgress(state.areas, state.itemsById).itemsToOrder).toBe(0);
  });

  test('a genuine shortfall still produces a deficit in the count unit', async () => {
    await loadRows([salmonRow()]);

    // 3 fillets against a par of 8 fillets.
    useStockCheckStore.getState().commitStockEntry(SALMON_ID, {
      stockUnit: 'base',
      stockAmount: 3,
      stockPieces: 0,
    });
    await flushMicrotasks();

    expect(useStockCheckStore.getState().itemsById[SALMON_ID].orderQuantity).toBe(5);
  });

  test('switching the wheel unit does not move par', async () => {
    await loadRows([salmonRow()]);

    // The wheel unit is the user's counting preference. Par stays in the
    // count unit whatever they pick.
    useStockCheckStore.getState().setItemUnitType(SALMON_ID, 'pack');
    useStockCheckStore.getState().commitStockEntry(SALMON_ID, {
      stockUnit: 'pack',
      stockAmount: 6,
      stockPieces: 0,
    });
    await flushMicrotasks();

    const item = useStockCheckStore.getState().itemsById[SALMON_ID];
    expect(item.countUnitType).toBe('base');
    expect(item.orderQuantity).toBe(0);
    expect(formatParSubtitle(item)).toBe('par 8 fillet · 1 case ≈ 10 fillet');
  });

  test('a count unit literally named "pack" is still read as the base unit', async () => {
    await loadRows([noriRow()]);

    const item = useStockCheckStore.getState().itemsById[NORI_ID];
    expect(item.countUnitType).toBe('base');
    expect(formatParSubtitle(item)).toBe('par 25 pack · 1 case ≈ 50 pack');

    // 1 case is 50 packs against a par of 25 packs.
    useStockCheckStore.getState().commitStockEntry(NORI_ID, {
      stockUnit: 'pack',
      stockAmount: 1,
      stockPieces: 0,
    });
    await flushMicrotasks();

    expect(useStockCheckStore.getState().itemsById[NORI_ID].orderQuantity).toBe(0);
  });
});

describe('stockMath par helpers', () => {
  test('parInBase scales only when the row is denominated in packs', () => {
    expect(parInBase({ parLevel: 8, countUnitType: 'base', packSize: 10 })).toBe(8);
    expect(parInBase({ parLevel: 8, countUnitType: 'pack', packSize: 10 })).toBe(80);
  });

  test('computeNeedToOrder returns the deficit in the count unit', () => {
    // Par 8 fillets, 6 cases counted (60 fillets): nothing owed.
    expect(
      computeNeedToOrder({
        parLevel: 8,
        countUnitType: 'base',
        packSize: 10,
        stockUnit: 'pack',
        stockAmount: 6,
        stockPieces: 0,
      }),
    ).toBe(0);

    // Par 8 cases, 6 cases counted: 2 cases owed.
    expect(
      computeNeedToOrder({
        parLevel: 8,
        countUnitType: 'pack',
        packSize: 10,
        stockUnit: 'pack',
        stockAmount: 6,
        stockPieces: 0,
      }),
    ).toBe(2);
  });
});
