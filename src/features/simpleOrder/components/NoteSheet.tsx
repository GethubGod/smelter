import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, TextInput, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheetShell } from '@/components/BottomSheetShell';
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
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState(note);

  useEffect(() => {
    if (visible) setDraft(note);
  }, [visible, note]);

  return (
    <BottomSheetShell
      visible={visible}
      onClose={onClose}
      bottomPadding={Math.max(insets.bottom, ds.spacing(14))}
    >
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Text style={{ fontSize: ds.fontSize(typeScale.title), fontWeight: '700', color: color.ink }}>
          {note.trim() ? 'Edit note' : 'Add note'}
        </Text>
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

        <TouchableOpacity
          onPress={() => {
            void triggerImpactHaptic();
            onSave(draft.trim());
          }}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Save note"
          style={{
            minHeight: 52,
            borderRadius: radius.pill,
            backgroundColor: color.accent,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: ds.fontSize(typeScale.body), fontWeight: '700', color: color.onAccent }}>
            {draft.trim() ? 'Save note' : note.trim() ? 'Remove note' : 'Save note'}
          </Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </BottomSheetShell>
  );
}
