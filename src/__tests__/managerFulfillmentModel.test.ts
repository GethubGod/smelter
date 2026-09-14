import {
  buildManagerFulfillmentModel,
  isSendableManagerSupplier,
} from '@/features/fulfillment/managerFulfillmentModel';
import type { SupplierLookupMaps, SupplierLookupRow } from '@/services/supplierResolver';
import type {
  OrderLaterItem,
  SupplierDraftsBySupplier,
} from '@/store/orderStore.types';
import type {
  InventoryItem,
  OrderItemWithInventory,
  OrderWithDetails,
} from '@/types';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { fetch: jest.fn(async () => ({ isConnected: true })) },
}));
Object.defineProperty(globalThis, '__DEV__', {
  value: false,
  configurable: true,
});

function makeLookup(rows: SupplierLookupRow[]): SupplierLookupMaps {
  return {
    suppliers: rows,
    supplierById: new Map(rows.flatMap((row) => [
      [row.id, row] as const,
      [row.id.toLowerCase(), row] as const,
    ])),
    supplierByNameNormalized: new Map(
      rows.map((row) => [row.name.toLowerCase(), row] as const),
    ),
  };
}

function makeInventoryItem(
  id: string,
  name: string,
  supplierId: string,
): InventoryItem {
  return {
    id,
    name,
    category: 'dry',
    supplier_category: 'main_distributor',
    supplier_id: supplierId,
    base_unit: 'pack',
    pack_unit: 'case',
    pack_size: 1,
    active: true,
    created_at: '2026-09-01T00:00:00.000Z',
  };
}

function makeOrderItem(
  id: string,
  inventoryItem: InventoryItem,
  options: {
    inputMode?: 'quantity' | 'remaining';
    quantity?: number;
    remainingReported?: number;
  } = {},
): OrderItemWithInventory {
  const inputMode = options.inputMode ?? 'quantity';
  return {
    id,
    order_id: `order-${id}`,
    inventory_item_id: inventoryItem.id,
    quantity: options.quantity ?? 2,
    unit_type: 'base',
    input_mode: inputMode,
    quantity_requested: inputMode === 'quantity' ? options.quantity ?? 2 : null,
    remaining_reported:
      inputMode === 'remaining' ? options.remainingReported ?? 1 : null,
    decided_quantity: inputMode === 'remaining' ? null : options.quantity ?? 2,
    decided_by: null,
    decided_at: null,
    note: null,
    status: 'pending',
    supplier_override_id: null,
    created_at: '2026-09-12T09:00:00.000Z',
    inventory_item: inventoryItem,
  };
}

function makeOrder(
  id: string,
  locationId: string,
  shortCode: string,
  employeeName: string,
  items: OrderItemWithInventory[],
  notes: string | null = null,
): OrderWithDetails {
  return {
    id,
    order_number: 1,
    user_id: `user-${employeeName}`,
    location_id: locationId,
    status: 'submitted',
    notes,
    created_at: '2026-09-12T09:00:00.000Z',
    fulfilled_at: null,
    fulfilled_by: null,
    user: {
      id: `user-${employeeName}`,
      email: `${employeeName.toLowerCase()}@example.com`,
      name: employeeName,
      role: 'employee',
      default_location_id: locationId,
      created_at: '2026-01-01T00:00:00.000Z',
    },
    location: {
      id: locationId,
      name: `Babytuna ${shortCode === 'SUS' ? 'Sushi' : 'Poki'}`,
      short_code: shortCode,
      active: true,
      created_at: '2026-01-01T00:00:00.000Z',
    },
    order_items: items.map((item) => ({ ...item, order_id: id })),
  };
}

function makeOrderLater(
  id: string,
  locationId: string,
  scheduledAt: string,
): OrderLaterItem {
  return {
    id,
    createdBy: 'manager-1',
    createdAt: '2026-09-12T09:00:00.000Z',
    scheduledAt,
    quantity: 1,
    itemId: `item-${id}`,
    itemName: `Later ${id}`,
    unit: 'pack',
    locationId,
    locationName: 'Babytuna Sushi',
    notes: null,
    suggestedSupplierId: 'supplier-a',
    preferredSupplierId: null,
    preferredLocationGroup: 'sushi',
    sourceOrderItemId: null,
    sourceOrderItemIds: [],
    sourceOrderId: null,
    notificationId: null,
    status: 'queued',
    payload: {},
  };
}

const SUPPLIER_A: SupplierLookupRow = {
  id: 'supplier-a',
  name: 'Mutual',
  supplierType: 'main_distributor',
  isDefault: true,
  active: true,
};
const SUPPLIER_B: SupplierLookupRow = {
  id: 'supplier-b',
  name: 'Ocean Group',
  supplierType: 'fish_supplier',
  isDefault: true,
  active: true,
};

describe('buildManagerFulfillmentModel', () => {
  it('builds one selected-location source for header, badge, notes, and review payloads', () => {
    const rice = makeInventoryItem('rice', 'Rice', SUPPLIER_A.id);
    const nori = makeInventoryItem('nori', 'Nori', SUPPLIER_A.id);
    const salmon = makeInventoryItem('salmon', 'Salmon', SUPPLIER_B.id);
    const orders = [
      makeOrder(
        'order-sushi',
        'location-sushi',
        'SUS',
        'Aiko',
        [
          makeOrderItem('rice-line', rice),
          makeOrderItem('nori-line', nori, {
            inputMode: 'remaining',
            remainingReported: 1.5,
          }),
        ],
        'Hold extra rice until Friday',
      ),
      makeOrder(
        'order-poki',
        'location-poki',
        'POK',
        'Marco',
        [makeOrderItem('salmon-line', salmon)],
        'Poki note',
      ),
    ];
    const supplierDrafts: SupplierDraftsBySupplier = {
      [SUPPLIER_A.id]: [
        {
          id: 'draft-1',
          supplierId: SUPPLIER_A.id,
          inventoryItemId: 'oil',
          name: 'Fryer oil',
          category: 'dry',
          quantity: 1,
          unitType: 'pack',
          unitLabel: 'case',
          locationGroup: 'sushi',
          locationId: 'location-sushi',
          locationName: 'Babytuna Sushi',
          note: null,
          createdAt: '2026-09-12T09:00:00.000Z',
          sourceOrderLaterItemId: 'later-1',
        },
      ],
    };

    const result = buildManagerFulfillmentModel({
      orders,
      supplierDrafts,
      orderLater: [
        makeOrderLater('later-2', 'location-sushi', '2026-09-14T09:00:00.000Z'),
        makeOrderLater('later-1', 'location-sushi', '2026-09-13T09:00:00.000Z'),
        makeOrderLater('other', 'location-poki', '2026-09-12T09:00:00.000Z'),
      ],
      supplierLookup: makeLookup([SUPPLIER_A, SUPPLIER_B]),
      locationId: 'location-sushi',
    });

    expect(result.supplierCount).toBe(1);
    expect(result.totalItems).toBe(3);
    expect(result.totalNotes).toBe(1);
    expect(result.notes[0]).toEqual({
      id: 'order-sushi',
      author: 'Aiko',
      text: 'Hold extra rice until Friday',
      shortCode: '#1',
      locationName: 'Babytuna Sushi',
    });
    expect(result.orderLater.map((item) => item.id)).toEqual(['later-1', 'later-2']);
    expect(result.groups[0]).toMatchObject({
      supplierId: SUPPLIER_A.id,
      supplierName: 'Mutual',
      itemCount: 3,
      peopleCount: 1,
      remainingCount: 1,
    });
    expect(result.groups[0].regularItems).toHaveLength(2);
    expect(result.groups[0].remainingItems).toHaveLength(1);
    expect(
      result.groups[0].regularItems.find((item) => item.name === 'Rice')
        ?.sourceOrderIds,
    ).toContain('order-sushi');
    expect(
      result.groups[0].regularItems.find((item) => item.name === 'Fryer oil')
        ?.sourceDraftItemIds,
    ).toContain('draft-1');
  });

  it('keeps supplier ordering stable and counts unique people', () => {
    const rice = makeInventoryItem('rice', 'Rice', SUPPLIER_A.id);
    const salmon = makeInventoryItem('salmon', 'Salmon', SUPPLIER_B.id);
    const result = buildManagerFulfillmentModel({
      orders: [
        makeOrder('aiko', 'location-sushi', 'SUS', 'Aiko', [
          makeOrderItem('rice-a', rice),
          makeOrderItem('salmon-a', salmon),
        ]),
        makeOrder('marco', 'location-sushi', 'SUS', 'Marco', [
          makeOrderItem('rice-m', rice),
        ]),
      ],
      supplierDrafts: {},
      orderLater: [],
      supplierLookup: makeLookup([SUPPLIER_A, SUPPLIER_B]),
      locationId: 'location-sushi',
    });

    expect(result.groups.map((group) => group.supplierName)).toEqual([
      'Ocean Group',
      'Mutual',
    ]);
    expect(result.groups.find((group) => group.supplierId === SUPPLIER_A.id)?.peopleCount).toBe(2);
    expect(result.groups.find((group) => group.supplierId === SUPPLIER_B.id)?.peopleCount).toBe(1);
  });

  it('returns an empty model until a selected location is available', () => {
    const result = buildManagerFulfillmentModel({
      orders: [],
      supplierDrafts: {},
      orderLater: [],
      supplierLookup: makeLookup([SUPPLIER_A]),
      locationId: null,
    });
    expect(result).toEqual({
      groups: [],
      notes: [],
      orderLater: [],
      supplierCount: 0,
      totalItems: 0,
      totalNotes: 0,
    });
  });

  it('keeps unresolved supplier work visible and blocks it from sending', () => {
    const rice = makeInventoryItem('rice', 'Rice', SUPPLIER_A.id);
    const mystery = makeInventoryItem(
      'mystery-item',
      'Mystery item',
      'missing-supplier',
    );
    const result = buildManagerFulfillmentModel({
      orders: [
        makeOrder('mixed', 'location-sushi', 'SUS', 'Aiko', [
          makeOrderItem('rice-line', rice),
          makeOrderItem('mystery-line', mystery),
        ]),
      ],
      supplierDrafts: {},
      orderLater: [],
      supplierLookup: makeLookup([SUPPLIER_A]),
      locationId: 'location-sushi',
    });

    expect(result.supplierCount).toBe(2);
    expect(result.totalItems).toBe(2);
    expect(result.groups).toHaveLength(2);
    const unresolved = result.groups.find(
      (group) => !isSendableManagerSupplier(group),
    );
    expect(unresolved).toMatchObject({
      itemCount: 1,
      supplierName: 'UNRESOLVED SUPPLIER',
    });
    expect(result.groups.filter(isSendableManagerSupplier)).toHaveLength(1);
  });
});
