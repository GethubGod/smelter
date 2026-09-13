import React from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { color, radius, typeScale, weight } from '@/theme/tokens';

type ChipTone = 'amber' | 'gray' | 'blue';
type SurfaceTone = 'subtle' | 'homeGray';

export interface FulfillmentConfirmItemChip {
  id: string;
  label: string;
  tone?: ChipTone;
}

interface FulfillmentConfirmItemRowProps {
  title: string;
  headerActions?: React.ReactNode;
  chips?: FulfillmentConfirmItemChip[];
  trailingChip?: React.ReactNode;
  quantityValue: string;
  onQuantityChangeText: (value: string) => void;
  onDecrement: () => void;
  onIncrement: () => void;
  quantityPlaceholder?: string;
  unitSelector: React.ReactNode;
  details?: React.ReactNode;
  detailsVisible?: boolean;
  footer?: React.ReactNode;
  disableControls?: boolean;
  orderedByContent?: React.ReactNode;
  inlineNotesContent?: React.ReactNode;
  surfaceTone?: SurfaceTone;
  last?: boolean;
}

/** Compact supplier-review row with the same decision API as the legacy card. */
export const FulfillmentConfirmItemRow = React.memo(function FulfillmentConfirmItemRow({
  title,
  headerActions,
  chips = [],
  trailingChip,
  quantityValue,
  onQuantityChangeText,
  onDecrement,
  onIncrement,
  quantityPlaceholder = 'Set qty',
  unitSelector,
  details,
  detailsVisible = false,
  footer,
  disableControls = false,
  orderedByContent,
  inlineNotesContent,
  last = false,
}: FulfillmentConfirmItemRowProps) {
  const ds = useScaledStyles();
  const controlSize = ds.icon(30);

  return (
    <View
      style={{
        paddingHorizontal: ds.spacing(12),
        paddingVertical: ds.spacing(8),
        opacity: disableControls ? 0.62 : 1,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: ds.spacing(8) }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            numberOfLines={1}
            style={{
              fontSize: ds.fontSize(typeScale.body),
              fontWeight: weight.semibold,
              color: color.ink,
            }}
          >
            {title}
          </Text>
          {orderedByContent ? (
            <View style={{ marginTop: ds.spacing(2) }}>{orderedByContent}</View>
          ) : null}
          {chips.length > 0 || trailingChip ? (
            <View
              style={{
                marginTop: ds.spacing(3),
                flexDirection: 'row',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: ds.spacing(5),
              }}
            >
              {chips.map((chip) => (
                <Text
                  key={chip.id}
                  style={{
                    fontSize: ds.fontSize(typeScale.meta),
                    color:
                      chip.tone === 'amber'
                        ? color.warning
                        : chip.tone === 'blue'
                          ? color.accent
                          : color.ink3,
                  }}
                >
                  {chip.label}
                </Text>
              ))}
              {trailingChip}
            </View>
          ) : null}
        </View>

        <View style={{ alignItems: 'center', gap: ds.spacing(2) }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: ds.spacing(4) }}>
            <TouchableOpacity
              onPress={onDecrement}
              disabled={disableControls}
              accessibilityRole="button"
              accessibilityLabel={`Decrease ${title} quantity`}
              style={{
                width: controlSize,
                height: controlSize,
                borderRadius: radius.pill,
                backgroundColor: color.well,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="remove" size={ds.icon(16)} color={color.ink} />
            </TouchableOpacity>
            <TextInput
              value={quantityValue}
              onChangeText={onQuantityChangeText}
              editable={!disableControls}
              keyboardType="decimal-pad"
              placeholder={quantityPlaceholder}
              placeholderTextColor={color.ink3}
              accessibilityLabel={`${title} quantity`}
              selectTextOnFocus
              style={{
                minWidth: ds.spacing(36),
                maxWidth: ds.spacing(54),
                paddingHorizontal: 0,
                paddingVertical: 0,
                textAlign: 'center',
                fontSize: ds.fontSize(typeScale.itemComfort),
                fontWeight: weight.bold,
                color: color.ink,
              }}
            />
            <TouchableOpacity
              onPress={onIncrement}
              disabled={disableControls}
              accessibilityRole="button"
              accessibilityLabel={`Increase ${title} quantity`}
              style={{
                width: controlSize,
                height: controlSize,
                borderRadius: radius.pill,
                backgroundColor: color.well,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="add" size={ds.icon(16)} color={color.ink} />
            </TouchableOpacity>
          </View>
          {unitSelector}
        </View>

        {headerActions ? (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>{headerActions}</View>
        ) : null}
      </View>

      {inlineNotesContent ? (
        <View style={{ marginTop: ds.spacing(8) }}>{inlineNotesContent}</View>
      ) : null}
      {detailsVisible && details ? (
        <View
          style={{
            marginTop: ds.spacing(8),
            paddingTop: ds.spacing(8),
            borderTopWidth: 1,
            borderTopColor: color.hairline,
          }}
        >
          {details}
        </View>
      ) : null}
      {footer ? <View style={{ marginTop: ds.spacing(6) }}>{footer}</View> : null}
      {!last ? (
        <View
          style={{
            position: 'absolute',
            left: ds.spacing(44),
            right: 0,
            bottom: 0,
            height: 1,
            backgroundColor: color.hairline,
          }}
        />
      ) : null}
    </View>
  );
});
