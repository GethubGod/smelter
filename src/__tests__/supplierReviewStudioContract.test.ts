import fs from 'fs';
import path from 'path';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

describe('supplier review Studio contract', () => {
  const screen = read('../app/(manager)/fulfillment-confirmation.tsx');
  const row = read('features/fulfillment/components/FulfillmentConfirmItemRow.tsx');
  const unitSelector = read('features/fulfillment/components/QuantityExportSelector.tsx');

  it('matches the pushed supplier review hierarchy and fixed actions', () => {
    expect(screen).toContain('mode="pushed"');
    expect(screen).toContain('showDot={false}');
    expect(screen).toContain("label={remainingItems.length > 0 ? `${remainingItems.length} remaining` : 'Ready'}");
    expect(screen).toContain("{ label: 'items', value: reviewListEntries.length }");
    expect(screen).toContain("{ label: 'remaining', value: remainingItems.length }");
    expect(screen).toContain("{ label: 'people', value: peopleCount }");
    expect(screen).toContain('<SectionLabel style={{ flex: 1 }}>Items</SectionLabel>');
    expect(screen).toContain('<SectionLabel style={{ flex: 1 }}>Message preview</SectionLabel>');
    expect(screen).toContain('label="Copy"');
    expect(screen).toContain('label="Share"');
    expect(screen).toContain('style={{ flex: 1.4 }}');
  });

  it('keeps the real finalization and send-all queue return contracts', () => {
    expect(screen).toContain('findStaleConsumedOrderItemIds(payload.consumedOrderItemIds)');
    expect(screen).toContain('consumedOrderItemIds: payload.consumedOrderItemIds');
    expect(screen).toContain('consumedDraftItemIds: payload.consumedDraftItemIds');
    expect(screen).toContain('finalizeSupplierOrder({');
    expect(screen).toContain("shareMethod: 'share' | 'copy'");
    expect(screen).toContain("=== 'send-all'");
    expect(screen).toContain('router.back()');
  });

  it('uses compact Studio rows and app-native sheets', () => {
    expect(row).toContain('const controlSize = ds.icon(30)');
    expect(row).toContain('fontSize: ds.fontSize(typeScale.itemComfort)');
    expect(row).toContain('left: ds.spacing(44)');
    expect(unitSelector).toContain('backgroundColor: color.well');
    expect(screen).toContain("'Finalize Failed'");
    expect(screen).toContain("title={noteRegularItem?.notes.length || noteRemainingItem?.note ? 'Edit note' : 'Add note'}");
    expect(screen).not.toContain('Alert.alert');
    expect(screen).not.toContain('GlassSurface');
    expect(screen).not.toContain('ManagerScaleContainer');
    expect(screen).not.toContain('@/theme/design');
  });
});
