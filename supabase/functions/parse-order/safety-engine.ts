import type {
  BlockedOperation,
  CatalogItem,
  ItemAllowedUnitRule,
  ItemOrderLimit,
  ParseResponse,
  PendingQuickOrderClarification,
  QuickOrderSource,
  SafetyWarning,
} from './types.ts';

export type SafetyValidationInput = {
  parseResponse: ParseResponse;
  catalog: CatalogItem[];
  locationId: string;
  source: QuickOrderSource;
  limits: ItemOrderLimit[];
  allowedUnitRules: ItemAllowedUnitRule[];
  userRole?: string | null;
};

export type SafetyValidationResult = {
  response: ParseResponse;
  warnings: SafetyWarning[];
  blockedOperations: BlockedOperation[];
  pendingClarifications: PendingQuickOrderClarification[];
};

export function deduplicatePendingClarifications(
  clarifications: PendingQuickOrderClarification[],
): PendingQuickOrderClarification[] {
  const seen = new Map<string, PendingQuickOrderClarification>();
  for (const clarification of clarifications) {
    const lineId = clarification.incoming_item?.line_id ?? '';
    const key = `${clarification.type}:${clarification.item_name ?? ''}:${lineId}`;
    if (!seen.has(key)) seen.set(key, clarification);
  }
  return [...seen.values()];
}

export function applyStockSafetyLimits(input: {
  stockUpdates: import('./types.ts').StockOperation[];
  catalog: CatalogItem[];
  locationId: string;
  source: QuickOrderSource;
  limits: ItemOrderLimit[];
  allowedUnitRules: ItemAllowedUnitRule[];
  userRole?: string | null;
}): {
  accepted: import('./types.ts').StockOperation[];
  blocked: BlockedOperation[];
  warnings: SafetyWarning[];
} {
  return { accepted: input.stockUpdates, blocked: [], warnings: [] };
}

export function validateQuickOrderSafety(input: SafetyValidationInput): SafetyValidationResult {
  const pendingClarifications: PendingQuickOrderClarification[] = deduplicatePendingClarifications([
    ...(input.parseResponse.pending_clarifications ?? input.parseResponse.pending_actions ?? []),
  ]);
  const hasClarifications = pendingClarifications.length > 0;
  const status = hasClarifications
      ? 'needs_clarification'
      : input.parseResponse.status;

  const dedupedClarifications = deduplicatePendingClarifications(pendingClarifications);

  return {
    response: {
      ...input.parseResponse,
      status,
      parsed_items: input.parseResponse.parsed_items,
      pending_actions: dedupedClarifications,
      pending_clarifications: dedupedClarifications,
      operations: input.parseResponse.operations ?? [],
      diagnostics: {
        ...(input.parseResponse.diagnostics ?? {}),
        items_after_validation: input.parseResponse.parsed_items.length,
        items_accepted: input.parseResponse.parsed_items.length,
        pending_action_count: dedupedClarifications.length,
        rejected_reasons: input.parseResponse.diagnostics?.rejected_reasons ?? [],
      },
    },
    warnings: [],
    blockedOperations: [],
    pendingClarifications: dedupedClarifications,
  };
}
