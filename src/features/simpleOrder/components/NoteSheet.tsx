import React, { useCallback, useEffect, useState } from 'react';
import { TextInput } from 'react-native';
import { Sheet } from '@/components/ui';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { triggerImpactHaptic } from '@/lib/haptics';
import { color, radius, typeScale } from '@/theme/tokens';

interface NoteSheetProps {
  visible: boolean;
  note: string;
  onSave: (note: string) => void;
  onClose: () => void;
}
export function NoteSheet({ visible, note, onSave, onClose }: NoteSheetProps) {
  const ds = useScaledStyles();
  const [draft, setDraft] = useState(note);

  useEffect(() => {
    if (visible) setDraft(note);
  }, [visible, note]);

  const handleSave = useCallback(() => {
    void triggerImpactHaptic();
    onSave(draft.trim());
  }, [draft, onSave]);

  return (
    <Sheet
      visible={visible}
      title={note.trim() ? 'Edit note' : 'Add note'}
      subtitle="Goes with this order to the manager."
      onClose={onClose}
      primary={{ label: 'Save note', onPress: handleSave }}
    >
      <TextInput
        value={draft}
        onChangeText={setDraft}
        multiline
        placeholder="Example: the walk-in freezer is full, hold the extra rice until Friday"
        placeholderTextColor={color.ink3}
        accessibilityLabel="Order note"
        style={{
          minHeight: ds.spacing(110),
          maxHeight: ds.spacing(220),
          backgroundColor: color.card,
          borderRadius: radius.control,
          paddingHorizontal: ds.spacing(14),
          paddingVertical: ds.spacing(12),
          fontSize: ds.fontSize(typeScale.body),
          color: color.ink,
          textAlignVertical: 'top',
        }}
      />
    </Sheet>
  );
}
