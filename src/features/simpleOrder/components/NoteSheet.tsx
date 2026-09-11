import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, TextInput } from 'react-native';
import { Button, Sheet } from '@/components/ui';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { triggerImpactHaptic } from '@/lib/haptics';
import { color, radius, typeScale } from '@/theme/tokens';

/**
 * Free-text note attached to THIS send: travels to manager review with the
 * order, or is appended to direct-send supplier messages.
 */

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

  return (
    <Sheet
      visible={visible}
      title={note.trim() ? 'Edit note' : 'Add note'}
      onClose={onClose}
    >
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Text
          style={{ fontSize: ds.fontSize(typeScale.secondary), color: color.ink2, marginBottom: ds.spacing(12) }}
        >
          Goes with this order to the manager.
        </Text>

        <TextInput
          value={draft}
          onChangeText={setDraft}
          multiline
          placeholder="Example: the walk-in freezer is full, hold the extra rice until Friday"
          placeholderTextColor={color.ink3}
          accessibilityLabel="Order note"
          style={{
            minHeight: ds.spacing(96),
            maxHeight: ds.spacing(180),
            backgroundColor: color.card,
            borderWidth: 1,
            borderColor: color.hairline,
            borderRadius: radius.card,
            paddingHorizontal: ds.spacing(15),
            paddingVertical: ds.spacing(12),
            fontSize: ds.fontSize(typeScale.body),
            color: color.ink,
            textAlignVertical: 'top',
            marginBottom: ds.spacing(14),
          }}
        />

        {/* The action stays inside the keyboard-avoiding region: `Sheet.primary`
            renders outside it, so with the note keyboard open Save sat behind
            the keyboard. */}
        <Button
          label={draft.trim() ? 'Save note' : note.trim() ? 'Remove note' : 'Save note'}
          onPress={() => {
            void triggerImpactHaptic();
            onSave(draft.trim());
          }}
        />
      </KeyboardAvoidingView>
    </Sheet>
  );
}
