import React, { useCallback } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Card, SectionLabel, Sheet } from '@/components/ui';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { triggerImpactHaptic } from '@/lib/haptics';
import { color, radius, typeScale, weight } from '@/theme/tokens';
import { formatQuantity, type SelectionLine } from '../checklistSelection';

interface ConfirmOrderSheetProps {
  visible: boolean;
  /** `review` routes to manager review; `direct` continues to the supplier queue. */
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
    if (!isSending) onClose();
  }, [isSending, onClose]);

  const handleConfirm = useCallback(() => {
    void triggerImpactHaptic();
    onConfirm();
  }, [onConfirm]);

  const sendableCount = lines.length;
  const trimmedNote = note.trim();
  const itemLabel = sendableCount === 1 ? '1 item' : `${sendableCount} items`;

  return (
    <Sheet
      visible={visible}
      title="Review order"
      subtitle={`${itemLabel} · ${
        mode === 'direct' ? 'sends straight to your suppliers' : 'goes to manager review'
      }`}
      onClose={handleClose}
      dismissible={!isSending}
      expandable
      primary={{
        label:
          mode === 'direct'
            ? 'Continue to send'
            : sendableCount === 1
              ? 'Send 1 item'
              : `Send ${sendableCount} items`,
        onPress: handleConfirm,
        loading: isSending,
        disabled: sendableCount === 0,
      }}
    >
      <Card flush>
        {lines.map((line, index) => (
          <View
            key={line.key}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: ds.spacing(10),
              paddingHorizontal: ds.spacing(14),
              paddingVertical: ds.spacing(12),
              borderBottomWidth: index === lines.length - 1 ? 0 : 1,
              borderBottomColor: color.hairline,
            }}
          >
            <Text
              numberOfLines={1}
              style={{
                flex: 1,
                minWidth: 0,
                fontSize: ds.fontSize(typeScale.itemDense),
                fontWeight: weight.semibold,
                color: color.ink,
              }}
            >
              {line.itemName}
            </Text>
            <Text
              numberOfLines={1}
              style={{
                fontSize: ds.fontSize(typeScale.itemDense),
                fontWeight: weight.semibold,
                color: color.ink,
              }}
            >
              {formatQuantity(line.quantity)} {line.unit}
            </Text>
          </View>
        ))}
        {lines.length === 0 ? (
          <Text
            style={{
              paddingHorizontal: ds.spacing(14),
              paddingVertical: ds.spacing(16),
              fontSize: ds.fontSize(typeScale.body),
              color: color.ink2,
              textAlign: 'center',
            }}
          >
            No items left to send.
          </Text>
        ) : null}
      </Card>

      <View>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <SectionLabel>Note</SectionLabel>
          <TouchableOpacity
            onPress={onEditNote}
            accessibilityRole="button"
            accessibilityLabel={`${trimmedNote ? 'Edit' : 'Add'} order note`}
            hitSlop={ds.spacing(8)}
            style={{ paddingTop: ds.spacing(14), paddingBottom: ds.spacing(4) }}
          >
            <Text
              style={{
                fontSize: ds.fontSize(typeScale.secondary),
                fontWeight: weight.semibold,
                color: color.accent,
              }}
            >
              {trimmedNote ? 'Edit' : 'Add'}
            </Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          onPress={onEditNote}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={`${trimmedNote ? 'Edit' : 'Add'} order note`}
        >
          <Card>
            <Text
              style={{
                fontSize: ds.fontSize(typeScale.itemDense),
                color: trimmedNote ? color.ink : color.ink3,
              }}
            >
              {trimmedNote || 'No note. The manager sees only the items.'}
            </Text>
          </Card>
        </TouchableOpacity>
      </View>

      {unmatchedNames.length > 0 ? (
        <View
          style={{
            backgroundColor: color.alertBg,
            borderRadius: radius.control,
            paddingHorizontal: ds.spacing(12),
            paddingVertical: ds.spacing(9),
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
            backgroundColor: color.alertBg,
            borderRadius: radius.control,
            paddingHorizontal: ds.spacing(12),
            paddingVertical: ds.spacing(9),
          }}
        >
          <Text style={{ fontSize: ds.fontSize(typeScale.secondary), color: color.alert }}>
            {sendError}
          </Text>
        </View>
      ) : null}
    </Sheet>
  );
}
