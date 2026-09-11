import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, hairline, radii } from '@/theme/design';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { BrandLogo } from './BrandLogo';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { resolveLocationSwitchTarget } from '@/features/cart/locationSwitch';
import { typeScale, weight } from '@/theme/tokens';

export interface ConfirmLocationOption {
  id: string;
  name: string;
  shortCode?: string;
}

interface ConfirmLocationBottomSheetProps {
  visible: boolean;
  selectedLocationId: string | null;
  locationOptions: ConfirmLocationOption[];
  isSubmitting?: boolean;
  onLocationChange: (locationId: string) => void;
  onNoLocationAvailable?: () => void;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmLocationBottomSheet({
  visible,
  selectedLocationId,
  locationOptions,
  isSubmitting = false,
  onLocationChange,
  onNoLocationAvailable,
  onConfirm,
  onClose,
}: ConfirmLocationBottomSheetProps) {
  const ds = useScaledStyles();
  const [viewMode, setViewMode] = useState<'confirm' | 'change'>('confirm');

  useEffect(() => {
    if (visible) {
      setViewMode('confirm');
    }
  }, [visible, selectedLocationId]);

  const selectedLocation = useMemo(() => {
    if (!selectedLocationId) return locationOptions[0] ?? null;
    return locationOptions.find((location) => location.id === selectedLocationId) ?? locationOptions[0] ?? null;
  }, [locationOptions, selectedLocationId]);

  const otherLocations = useMemo(
    () =>
      locationOptions.filter((location) =>
        selectedLocation ? location.id !== selectedLocation.id : true
      ),
    [locationOptions, selectedLocation]
  );

  const changeResolution = useMemo(
    () =>
      resolveLocationSwitchTarget({
        currentLocationId: selectedLocationId,
        availableLocationIds: locationOptions.map((location) => location.id),
      }),
    [locationOptions, selectedLocationId]
  );

  const handlePressChangeLocation = useCallback(() => {
    if (changeResolution.mode === 'toggle' && changeResolution.targetLocationId) {
      onLocationChange(changeResolution.targetLocationId);
      return;
    }

    if (changeResolution.mode === 'selector') {
      setViewMode('change');
      return;
    }

    onNoLocationAvailable?.();
  }, [changeResolution, onLocationChange, onNoLocationAvailable]);

  const submitLabel = selectedLocation
    ? `Submitting for ${selectedLocation.name}`
    : 'Submitting for selected location';

  return (
    <Sheet
      visible={visible}
      title={viewMode === 'change' ? 'Change Location' : 'Confirm Location'}
      onClose={onClose}
      primary={
        viewMode === 'change'
          ? undefined
          : {
              label: isSubmitting ? 'Submitting...' : 'Confirm & Submit',
              onPress: onConfirm,
              loading: isSubmitting,
              disabled: isSubmitting || !selectedLocation,
            }
      }
    >
      {viewMode === 'change' ? (
        <>
          <Text style={{ fontSize: ds.fontSize(typeScale.secondary), color: colors.textSecondary }}>
            Select another location.
          </Text>

          <ScrollView
            style={{ maxHeight: ds.spacing(360) }}
            contentContainerStyle={{ paddingHorizontal: ds.spacing(6), paddingBottom: ds.spacing(8) }}
            showsVerticalScrollIndicator={false}
          >
            {otherLocations.length > 0 ? (
              <View style={{ borderRadius: radii.button, borderWidth: hairline, borderColor: colors.glassBorder, backgroundColor: colors.white, overflow: 'hidden' }}>
                {otherLocations.map((location, index) => (
                  <TouchableOpacity
                    key={location.id}
                    activeOpacity={0.75}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      minHeight: Math.max(56, ds.rowH),
                      paddingHorizontal: ds.spacing(16),
                      paddingVertical: ds.spacing(10),
                      borderBottomWidth: index < otherLocations.length - 1 ? hairline : 0,
                      borderBottomColor: colors.divider,
                    }}
                    onPress={() => {
                      onLocationChange(location.id);
                      setViewMode('confirm');
                    }}
                  >
                    <View
                      style={{
                        width: ds.icon(40),
                        height: ds.icon(40),
                        borderRadius: ds.icon(20),
                        backgroundColor: colors.background,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <BrandLogo variant="inline" size={18} />
                    </View>
                    <View style={{ flex: 1, marginLeft: ds.spacing(12) }}>
                      <Text style={{ fontSize: ds.fontSize(typeScale.body), fontWeight: weight.semibold, color: colors.textPrimary }}>
                        {location.name}
                      </Text>
                    </View>
                    <Ionicons name="arrow-forward" size={ds.icon(18)} color={colors.textSecondary} />
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={{ borderRadius: radii.button, borderWidth: hairline, borderColor: colors.glassBorder, backgroundColor: colors.background, paddingHorizontal: ds.spacing(16), paddingVertical: ds.spacing(20), alignItems: 'center' }}>
                <Text style={{ fontSize: ds.fontSize(typeScale.body), color: colors.textSecondary, textAlign: 'center' }}>
                  No other cart locations available.
                </Text>
              </View>
            )}

          </ScrollView>

          <Button label="Back" variant="secondary" onPress={() => setViewMode('confirm')} />
        </>
      ) : (
        <>
          <ScrollView
            style={{ maxHeight: ds.spacing(420) }}
            contentContainerStyle={{ paddingHorizontal: ds.spacing(6), paddingBottom: ds.spacing(8) }}
            showsVerticalScrollIndicator={false}
          >
            <View
              style={{
                borderRadius: radii.button,
                borderWidth: hairline,
                borderColor: colors.glassBorder,
                backgroundColor: colors.background,
                paddingHorizontal: ds.spacing(16),
                paddingVertical: ds.spacing(14),
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View
                  style={{
                    width: ds.icon(42),
                    height: ds.icon(42),
                    borderRadius: ds.icon(21),
                    backgroundColor: colors.white,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <BrandLogo variant="inline" size={18} />
                </View>
                <View style={{ flex: 1, marginLeft: ds.spacing(12) }}>
                  <Text style={{ fontSize: ds.fontSize(typeScale.title), fontWeight: weight.semibold, color: colors.textPrimary }} numberOfLines={1}>
                    {selectedLocation?.name || 'Selected location'}
                  </Text>
                </View>
              </View>
            </View>

            <Text style={{ fontSize: ds.fontSize(typeScale.secondary), marginTop: ds.spacing(10), color: colors.textSecondary }}>
              {submitLabel}
            </Text>

          </ScrollView>

          <Button
            label="Change Location"
            variant="secondary"
            onPress={handlePressChangeLocation}
            disabled={isSubmitting}
          />
          <Button label="Cancel" variant="secondary" onPress={onClose} disabled={isSubmitting} />
        </>
      )}
    </Sheet>
  );
}
