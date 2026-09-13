import React from 'react';
import { Card, ListRow, Sheet } from '@/components/ui';
import { triggerSelectionHaptic } from '@/lib/haptics';
import type { SimpleOrderDensity } from '@/types/settings';

export type QuickAction =
  | 'clear'
  | 'saveDefault'
  | 'note'
  | 'display'
  | 'receive'
  | 'recent';

interface QuickActionsSheetProps {
  visible: boolean;
  hasNote: boolean;
  density: SimpleOrderDensity;
  showCategories: boolean;
  onAction: (action: QuickAction) => void;
  onClose: () => void;
}
export function QuickActionsSheet({
  visible,
  hasNote,
  onAction,
  onClose,
}: QuickActionsSheetProps) {
  const handle = (action: QuickAction) => {
    void triggerSelectionHaptic();
    onAction(action);
  };

  return (
    <Sheet
      visible={visible}
      title="Quick actions"
      subtitle="For this checklist."
      onClose={onClose}
    >
      <Card flush>
        <ListRow
          title="Clear checklist"
          subtitle="Uncheck everything, reset amounts"
          icon="trash-outline"
          onPress={() => handle('clear')}
        />
        <ListRow
          title="Save as default"
          subtitle="Checked items start the next order"
          icon="star-outline"
          onPress={() => handle('saveDefault')}
        />
        <ListRow
          title={hasNote ? 'Edit note' : 'Add note'}
          subtitle={hasNote ? 'Sent with this order' : 'Attach a message to this order'}
          icon="document-text-outline"
          onPress={() => handle('note')}
          last
        />
      </Card>

      <Card flush>
        <ListRow
          title="Checklist display"
          icon="options-outline"
          onPress={() => handle('display')}
          chevron
        />
        <ListRow
          title="Receive delivery"
          icon="cube-outline"
          onPress={() => handle('receive')}
          chevron
        />
        <ListRow
          title="Recent orders"
          icon="time-outline"
          onPress={() => handle('recent')}
          chevron
          last
        />
      </Card>
    </Sheet>
  );
}
