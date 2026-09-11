import React, { useCallback } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Sheet } from '@/components/ui';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { triggerImpactHaptic } from '@/lib/haptics';
import { color, radius, typeScale, weight } from '@/theme/tokens';
import { formatQuantity, type SelectionLine } from '../checklistSelection';

/**
 * Review order sheet: compact one-line rows (item name left, "qty unit"
 * right), the note card when a note exists, and "Send N items". The subtitle
 * flips between manager-review and direct-send wording per the user's send
 * mode. Quantities are adjusted on the list or quantity card, not here.
 */

interface ConfirmOrderSheetProps {
  visible: boolean;
  /** 'review' routes to manager review; 'direct' continues to the per-supplier send queue. */
  mode: 'review' | 'direct';
  lines: SelectionLine[];
  unmatchedNames: string[];
  note: string;
  onEditNote: () => void;
  isSending: boolean;
  sendError: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmOrderSheet({
  visible,
  mode,
  lines,
  unmatchedNames,
  note,
  onEditNote,
  isSending,
  sendError,
  onConfirm,
  onClose,
}: ConfirmOrderSheetProps) {
  const ds = useScaledStyles();

  const handleClose = useCallback(() => {
    if (isSending) return;
    onClose();
  }, [isSending, onClose]);

  const handleConfirm = useCallback(() => {
    void triggerImpactHaptic();
    onConfirm();
  }, [onConfirm]);

  const sendableCount = lines.length;
  const trimmedNote = note.trim();

  return (
    <Sheet visible={visible} title="Review order" onClose={handleClose}>
      <Text
        style={{ fontSize: ds.fontSize(typeScale.secondary), color: color.ink2, marginBottom: ds.spacing(12) }}
      >
        {sendableCount === 1 ? '1 item' : `${sendableCount} items`} ·{' '}
        {mode === 'direct' ? 'sends straight to your suppliers' : 'goes to manager review'}
      </Text>

      <View
        style={{
          backgroundColor: color.card,
          borderWidth: 1,
          borderColor: color.hairline,
          borderRadius: radius.card,
          paddingHorizontal: ds.spacing(16),
          marginBottom: ds.spacing(12),
        }}
      >
        <ScrollView
          style={{ maxHeight: ds.spacing(300) }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {lines.map((line, index) => (
            <View
              key={line.key}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: ds.spacing(10),
                minHeight: 40,
                borderBottomWidth: index === lines.length - 1 ? 0 : 1,
                borderBottomColor: color.hairline,
              }}
            >
              <Text
                numberOfLines={1}
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: ds.fontSize(typeScale.body),
                  fontWeight: weight.semibold,
                  color: color.ink,
                }}
              >
                {line.itemName}
              </Text>
              <Text
                style={{
                  fontSize: ds.fontSize(typeScale.secondary),
                  fontWeight: weight.semibold,
                  color: color.ink2,
                }}
                numberOfLines={1}
              >
                {formatQuantity(line.quantity)} {line.unit}
              </Text>
            </View>
          ))}

          {lines.length === 0 ? (
            <Text
              style={{
                paddingVertical: ds.spacing(16),
                fontSize: ds.fontSize(typeScale.body),
                color: color.ink2,
                textAlign: 'center',
              }}
            >
              No items left to send.
            </Text>
          ) : null}
        </ScrollView>
      </View>

      {trimmedNote ? (
        <TouchableOpacity
          onPress={onEditNote}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Edit the order note"
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: ds.spacing(9),
            backgroundColor: color.card,
            borderWidth: 1,
            borderColor: color.hairline,
            borderRadius: radius.card,
            paddingHorizontal: ds.spacing(16),
            paddingVertical: ds.spacing(12),
            marginBottom: ds.spacing(12),
          }}
        >
          <Ionicons name="create-outline" size={ds.icon(16)} color={color.accent} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              style={{
                fontSize: ds.fontSize(typeScale.caption),
                fontWeight: '700',
                letterSpacing: 0.5,
                color: color.ink2,
                marginBottom: 1,
              }}
            >
              NOTE
            </Text>
            <Text style={{ fontSize: ds.fontSize(typeScale.secondary), color: color.ink }} numberOfLines={4}>
              {trimmedNote}
            </Text>
          </View>
        </TouchableOpacity>
      ) : null}

      {unmatchedNames.length > 0 ? (
        <View
          style={{
            backgroundColor: color.tint,
            borderRadius: radius.control,
            paddingHorizontal: ds.spacing(12),
            paddingVertical: ds.spacing(9),
            marginBottom: ds.spacing(12),
          }}
        >
          <Text style={{ fontSize: ds.fontSize(typeScale.secondary), color: color.alert }}>
            Not in inventory, will be skipped: {unmatchedNames.join(', ')}
          </Text>
        </View>
      ) : null}

      {sendError ? (
        <View
          style={{
            backgroundColor: color.tint,
            borderRadius: radius.control,
            paddingHorizontal: ds.spacing(12),
            paddingVertical: ds.spacing(9),
            marginBottom: ds.spacing(12),
          }}
        >
          <Text style={{ fontSize: ds.fontSize(typeScale.secondary), color: color.alert }}>{sendError}</Text>
        </View>
      ) : null}

      <Button
        label={
          mode === 'direct'
            ? 'Continue to send'
            : sendableCount === 1
              ? 'Send 1 item'
              : `Send ${sendableCount} items`
        }
        onPress={handleConfirm}
        loading={isSending}
        disabled={sendableCount === 0}
        fullWidth
        accessibilityHint="Confirms and sends this order"
      />
    </Sheet>
  );
}
