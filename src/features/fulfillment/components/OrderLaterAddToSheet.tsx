import React, { useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, hairline, radii } from '@/theme/design';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { typeScale, weight } from '@/theme/tokens';

export interface OrderLaterSupplierOption {
  id: string;
  name: string;
}

interface OrderLaterAddToSheetProps {
  visible: boolean;
  itemName?: string;
  suppliers: OrderLaterSupplierOption[];
  selectedSupplierId: string | null;
  supplierError?: string | null;
  isSubmitting?: boolean;
  onSupplierChange: (supplierId: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}

export function OrderLaterAddToSheet({
  visible,
  itemName,
  suppliers,
  selectedSupplierId,
  supplierError = null,
  isSubmitting = false,
  onSupplierChange,
  onConfirm,
  onClose,
}: OrderLaterAddToSheetProps) {
  const ds = useScaledStyles();
  const [showSupplierPicker, setShowSupplierPicker] = useState(false);

  useEffect(() => {
    if (visible) {
      setShowSupplierPicker(false);
    }
  }, [visible]);

  const selectedSupplier = useMemo(
    () => suppliers.find((supplier) => supplier.id === selectedSupplierId) ?? null,
    [selectedSupplierId, suppliers]
  );
  const confirmDisabled = isSubmitting || !selectedSupplierId;

  return (
    <Sheet
      visible={visible}
      title="Add to Supplier"
      onClose={onClose}
      primary={{
        label: isSubmitting ? 'Adding...' : 'Add',
        onPress: onConfirm,
        loading: isSubmitting,
        disabled: confirmDisabled,
      }}
    >
      {itemName ? (
        <Text style={{ fontSize: ds.fontSize(typeScale.secondary), color: colors.textSecondary }}>
          {itemName}
        </Text>
      ) : null}

      <ScrollView
        style={{ maxHeight: ds.spacing(360) }}
        contentContainerStyle={{ paddingHorizontal: ds.spacing(6), paddingBottom: ds.spacing(4) }}
        showsVerticalScrollIndicator={false}
      >
        <Text
          style={{
            fontSize: ds.fontSize(typeScale.secondary),
            marginBottom: ds.spacing(6),
            marginLeft: ds.spacing(6),
            fontWeight: weight.semibold,
            letterSpacing: 0.6,
            textTransform: 'uppercase',
            color: colors.textSecondary,
          }}
        >
          Supplier
        </Text>
        <View style={{ borderRadius: radii.button, borderWidth: hairline, borderColor: colors.glassBorder, backgroundColor: colors.white, overflow: 'hidden' }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              minHeight: Math.max(56, ds.rowH),
              paddingHorizontal: ds.spacing(16),
              paddingVertical: ds.spacing(10),
            }}
          >
            <View style={{ flex: 1, paddingRight: ds.spacing(12) }}>
              <Text style={{ fontSize: ds.fontSize(typeScale.body), fontWeight: weight.semibold, color: colors.textPrimary }}>
                {selectedSupplier?.name || 'Select supplier'}
              </Text>
              {!selectedSupplier && (
                <Text style={{ fontSize: ds.fontSize(typeScale.secondary), marginTop: ds.spacing(2), color: colors.textSecondary }}>
                  A supplier is required to add this item.
                </Text>
              )}
            </View>
            <TouchableOpacity
              onPress={() => setShowSupplierPicker((prev) => !prev)}
              style={{
                paddingHorizontal: ds.spacing(12),
                paddingVertical: ds.spacing(8),
                borderRadius: radii.tag,
                borderWidth: hairline,
                borderColor: colors.glassBorder,
                backgroundColor: colors.background,
              }}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: ds.fontSize(typeScale.secondary), fontWeight: weight.semibold, color: colors.textPrimary }}>
                {showSupplierPicker ? 'Done' : 'Change'}
              </Text>
            </TouchableOpacity>
          </View>

          {showSupplierPicker && (
            <View style={{ borderTopWidth: hairline, borderTopColor: colors.divider }}>
              {suppliers.length === 0 ? (
                <View style={{ paddingHorizontal: ds.spacing(16), paddingVertical: ds.spacing(16) }}>
                  <Text style={{ fontSize: ds.fontSize(typeScale.secondary), color: colors.textSecondary }}>
                    No suppliers are available.
                  </Text>
                </View>
              ) : (
                suppliers.map((supplier, index) => {
                  const selected = supplier.id === selectedSupplierId;
                  return (
                    <TouchableOpacity
                      key={supplier.id}
                      onPress={() => {
                        onSupplierChange(supplier.id);
                        setShowSupplierPicker(false);
                      }}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        minHeight: Math.max(52, ds.rowH),
                        paddingHorizontal: ds.spacing(16),
                        paddingVertical: ds.spacing(9),
                        borderBottomWidth: index < suppliers.length - 1 ? hairline : 0,
                        borderBottomColor: colors.divider,
                      }}
                      activeOpacity={0.75}
                    >
                      <Text
                        style={{
                          fontSize: ds.fontSize(typeScale.body),
                          fontWeight: selected ? '600' : '500',
                          color: selected ? colors.primary : colors.textPrimary,
                        }}
                      >
                        {supplier.name}
                      </Text>
                      {selected && (
                        <Ionicons name="checkmark-circle" size={ds.icon(20)} color={colors.primary} />
                      )}
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          )}
        </View>

        {supplierError ? (
          <Text style={{ fontSize: ds.fontSize(typeScale.secondary), marginTop: ds.spacing(8), color: colors.primary, fontWeight: weight.semibold }}>
            {supplierError}
          </Text>
        ) : null}
      </ScrollView>

      <Button label="Cancel" variant="secondary" onPress={onClose} disabled={isSubmitting} />
    </Sheet>
  );
}
