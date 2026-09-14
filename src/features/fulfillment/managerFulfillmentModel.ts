import type { OrderWithDetails } from '@/types';
import type {
  OrderLaterItem,
  SupplierDraftItem,
  SupplierDraftsBySupplier,
} from '@/store/orderStore.types';
import {
  buildSupplierConfirmationData,
  type ConfirmationRegularItemData,
  type ConfirmationRemainingItemData,
} from '@/services/fulfillmentDataSource';
import {
  resolveOrderItemSupplier,
  type ResolvedOrderItemSupplier,
  type SupplierLookupMaps,
} from '@/services/supplierResolver';

export interface ManagerFulfillmentNote {
  id: string;
  author: string;
  text: string;
  shortCode: string;
  locationName: string;
}

export interface ManagerFulfillmentSupplierGroup {
  supplierId: string;
  supplierName: string;
  itemCount: number;
  peopleCount: number;
  remainingCount: number;
  regularItems: ConfirmationRegularItemData[];
  remainingItems: ConfirmationRemainingItemData[];
}

export interface ManagerFulfillmentModel {
  groups: ManagerFulfillmentSupplierGroup[];
  notes: ManagerFulfillmentNote[];
  orderLater: OrderLaterItem[];
  supplierCount: number;
  totalItems: number;
  totalNotes: number;
}

export interface ManagerFulfillmentModelInput {
  orders: OrderWithDetails[];
  supplierDrafts: SupplierDraftsBySupplier;
  orderLater: OrderLaterItem[];
  supplierLookup: SupplierLookupMaps;
  locationId: string | null;
}

const SUPPLIER_DISPLAY_PRIORITY = new Map<string, number>([
  ['asian markets', 0],
  ['ocean group', 1],
  ['mutual', 2],
  ['restaurant depot', 3],
]);

function toRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function lookupSupplier(
  lookup: SupplierLookupMaps,
  supplierId: string,
) {
  return (
    lookup.supplierById.get(supplierId) ??
    lookup.supplierById.get(supplierId.toLowerCase()) ??
    null
  );
}

function resolveOrderItem(
  orderItem: Record<string, unknown>,
  inventoryItem: Record<string, unknown>,
  lookup: SupplierLookupMaps,
): ResolvedOrderItemSupplier {
  const existing = toRecord(orderItem.__supplier_resolution);
  const effectiveSupplierId = toNonEmptyString(existing?.effectiveSupplierId);
  if (existing && effectiveSupplierId) {
    return {
      primarySupplierId: toNonEmptyString(existing.primarySupplierId),
      primarySupplierName: toNonEmptyString(existing.primarySupplierName),
      secondarySupplierId: toNonEmptyString(existing.secondarySupplierId),
      secondarySupplierName: toNonEmptyString(existing.secondarySupplierName),
      effectiveSupplierId,
      effectiveSupplierName:
        toNonEmptyString(existing.effectiveSupplierName) ??
        lookupSupplier(lookup, effectiveSupplierId)?.name ??
        'Unknown Supplier',
      isOverridden: existing.isOverridden === true,
      unresolvedPrimaryName: toNonEmptyString(existing.unresolvedPrimaryName),
      unresolvedSecondaryName: toNonEmptyString(existing.unresolvedSecondaryName),
      unresolvedOverrideId: toNonEmptyString(existing.unresolvedOverrideId),
    };
  }

  return resolveOrderItemSupplier({
    orderItem,
    inventoryItem,
    lookup,
  });
}

function supplierTypeOrder(value: string | null): number {
  if (value === 'asian_market') return 0;
  if (value === 'fish_supplier') return 1;
  if (value === 'main_distributor') return 2;
  return 3;
}

function compareSupplierIds(
  left: string,
  right: string,
  lookup: SupplierLookupMaps,
  names: Map<string, string>,
): number {
  const leftSupplier = lookupSupplier(lookup, left);
  const rightSupplier = lookupSupplier(lookup, right);
  if (leftSupplier?.active !== rightSupplier?.active) {
    return leftSupplier?.active === false ? 1 : -1;
  }

  const leftName = leftSupplier?.name ?? names.get(left) ?? 'Unknown Supplier';
  const rightName = rightSupplier?.name ?? names.get(right) ?? 'Unknown Supplier';
  const leftPriority = SUPPLIER_DISPLAY_PRIORITY.get(normalize(leftName));
  const rightPriority = SUPPLIER_DISPLAY_PRIORITY.get(normalize(rightName));
  if (leftPriority !== undefined || rightPriority !== undefined) {
    if (leftPriority === undefined) return 1;
    if (rightPriority === undefined) return -1;
    if (leftPriority !== rightPriority) return leftPriority - rightPriority;
  }

  const typeDifference =
    supplierTypeOrder(leftSupplier?.supplierType ?? null) -
    supplierTypeOrder(rightSupplier?.supplierType ?? null);
  return typeDifference !== 0 ? typeDifference : leftName.localeCompare(rightName);
}

function isUnknownSupplier(
  supplierId: string,
  lookup: SupplierLookupMaps,
): boolean {
  return (
    supplierId.startsWith('unknown:') ||
    supplierId.startsWith('unresolved:') ||
    lookupSupplier(lookup, supplierId) === null
  );
}

function peopleCount(
  regularItems: ConfirmationRegularItemData[],
  remainingItems: ConfirmationRemainingItemData[],
): number {
  const people = new Set<string>();
  regularItems.forEach((item) => {
    item.contributors.forEach((contributor) => {
      const name = contributor.name.trim();
      if (!name || name.toLowerCase() === 'order later') return;
      people.add(
        name.toLowerCase() === 'unknown' && contributor.userId
          ? `user:${contributor.userId}`
          : `name:${name.toLowerCase()}`,
      );
    });
  });
  remainingItems.forEach((item) => {
    const name = item.orderedBy.trim();
    if (name) people.add(`name:${name.toLowerCase()}`);
  });
  return people.size;
}

function scopeDrafts(
  supplierDrafts: SupplierDraftsBySupplier,
  locationId: string,
): SupplierDraftsBySupplier {
  const scoped: SupplierDraftsBySupplier = {};
  Object.entries(supplierDrafts).forEach(([supplierId, items]) => {
    const matching = items.filter((item) => item.locationId === locationId);
    if (matching.length > 0) scoped[supplierId] = matching;
  });
  return scoped;
}

function toConfirmationDraft(item: SupplierDraftItem) {
  return {
    id: item.id,
    inventoryItemId: item.inventoryItemId,
    name: item.name,
    category: item.category,
    quantity: item.quantity,
    unitType: item.unitType,
    unitLabel: item.unitLabel,
    locationGroup: item.locationGroup,
    locationId: item.locationId,
    locationName: item.locationName,
    note: item.note,
  };
}

export function buildManagerFulfillmentModel({
  orders,
  supplierDrafts,
  orderLater,
  supplierLookup,
  locationId,
}: ManagerFulfillmentModelInput): ManagerFulfillmentModel {
  if (!locationId) {
    return {
      groups: [],
      notes: [],
      orderLater: [],
      supplierCount: 0,
      totalItems: 0,
      totalNotes: 0,
    };
  }

  const scopedOrders = orders.filter(
    (order) => order.status === 'submitted' && order.location_id === locationId,
  );
  const scopedDrafts = scopeDrafts(supplierDrafts, locationId);
  const scopedOrderLater = orderLater
    .filter((item) => item.status === 'queued' && item.locationId === locationId)
    .sort(
      (left, right) =>
        new Date(left.scheduledAt).getTime() - new Date(right.scheduledAt).getTime(),
    );

  const notes: ManagerFulfillmentNote[] = scopedOrders.flatMap((order) => {
    const text = toNonEmptyString(order.notes);
    if (!text) return [];
    const orderNumber = Number.isFinite(order.order_number)
      ? `#${order.order_number}`
      : null;
    return [{
      id: order.id,
      author: toNonEmptyString(order.user?.name) ?? 'Unknown',
      text,
      shortCode:
        orderNumber ?? toNonEmptyString(order.location?.short_code) ?? '??',
      locationName: toNonEmptyString(order.location?.name) ?? 'Unknown',
    }];
  });

  const supplierIds = new Set<string>(Object.keys(scopedDrafts));
  const supplierNames = new Map<string, string>();
  scopedOrders.forEach((order) => {
    order.order_items.forEach((orderItem) => {
      const rawItem = toRecord(orderItem);
      const inventoryItem = toRecord(orderItem.inventory_item);
      if (!rawItem || !inventoryItem) return;
      const resolution = resolveOrderItem(rawItem, inventoryItem, supplierLookup);
      supplierIds.add(resolution.effectiveSupplierId);
      supplierNames.set(
        resolution.effectiveSupplierId,
        resolution.effectiveSupplierName,
      );
    });
  });

  const groups = Array.from(supplierIds)
    .sort((left, right) =>
      compareSupplierIds(left, right, supplierLookup, supplierNames),
    )
    .map((supplierId): ManagerFulfillmentSupplierGroup | null => {
      const supplierDraftItems = (scopedDrafts[supplierId] ?? []).map(
        toConfirmationDraft,
      );
      const { regularItems, remainingItems } = buildSupplierConfirmationData({
        supplierId,
        orders: scopedOrders,
        supplierLookup,
        supplierDraftItems,
      });
      const itemCount = regularItems.length + remainingItems.length;
      if (itemCount === 0) return null;
      const resolvedSupplierName =
        lookupSupplier(supplierLookup, supplierId)?.name ??
        supplierNames.get(supplierId) ??
        'Unknown Supplier';
      const supplierName = isUnknownSupplier(supplierId, supplierLookup)
        ? normalize(resolvedSupplierName).startsWith('unresolved supplier')
          ? resolvedSupplierName
          : `Unresolved supplier (${resolvedSupplierName})`
        : resolvedSupplierName;
      return {
        supplierId,
        supplierName,
        itemCount,
        peopleCount: peopleCount(regularItems, remainingItems),
        remainingCount: remainingItems.length,
        regularItems,
        remainingItems,
      };
    })
    .filter(
      (group): group is ManagerFulfillmentSupplierGroup => group !== null,
    );

  const totalItems = groups.reduce(
    (total, group) => total + group.itemCount,
    0,
  );

  return {
    groups,
    notes,
    orderLater: scopedOrderLater,
    supplierCount: groups.length,
    totalItems,
    totalNotes: notes.length,
  };
}

export function isSendableManagerSupplier(
  group: ManagerFulfillmentSupplierGroup,
): boolean {
  return (
    group.itemCount > 0 &&
    !group.supplierId.startsWith('unknown:') &&
    !group.supplierId.startsWith('unresolved:') &&
    !normalize(group.supplierName).startsWith('unknown supplier') &&
    !normalize(group.supplierName).startsWith('unresolved supplier')
  );
}
