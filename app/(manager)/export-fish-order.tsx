import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { colors } from '@/constants';
import { ManagerScaleContainer } from '@/components/ManagerScaleContainer';
import { EmptyStateCard } from '@/components/EmptyStateCard';
import { parseFishOrderExportParams, type FishOrderExport, type FishOrderExportParams, type FishItemOrder, type LocationQuantity } from '@/features/fulfillment/fishOrderExportParams';
import { color, radius, typeScale, weight } from '@/theme/tokens';

export default function ExportFishOrderScreen() {
  const params = useLocalSearchParams<FishOrderExportParams>();
  const order = parseFishOrderExportParams(params);

  if (!order) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: 'Fish Order', headerBackTitle: 'Back' }} />
        <SafeAreaView className="flex-1" style={{ backgroundColor: color.page }} edges={['bottom']}>
          <ManagerScaleContainer>
            <View style={{ padding: 16 }}>
              <EmptyStateCard
                icon="receipt-outline"
                title="No fish order to export"
                message="Order details are missing or invalid. Go back and select an order with quantities to export."
                actionLabel="Go Back"
                onPressAction={() => {
                  if (router.canGoBack()) router.back();
                  else router.replace('/(manager)');
                }}
              />
            </View>
          </ManagerScaleContainer>
        </SafeAreaView>
      </>
    );
  }

  return <FishOrderExportEditor key={JSON.stringify(order)} order={order} />;
}

function FishOrderExportEditor({ order }: { order: FishOrderExport }) {
  const isMultiItemFormat = order.format === 'multi';
  const locationName = order.format === 'multi' ? order.locationName : '';
  const locationShortCode = order.format === 'multi' ? order.locationShortCode : '';
  const initialFishItems = order.format === 'multi' ? order.items : [];
  const legacyItemName = order.format === 'legacy' ? order.itemName : '';
  const legacyItemUnit = order.format === 'legacy' ? order.unit : '';
  const legacyLocations = order.format === 'legacy' ? order.locations : [];

  // Editable state for multi-item format
  const [fishItems, setFishItems] = useState<FishItemOrder[]>(
    initialFishItems.map((item) => ({ ...item }))
  );

  // Editable state for legacy format
  const [locationQuantities, setLocationQuantities] = useState<LocationQuantity[]>(
    legacyLocations.map((loc) => ({ ...loc }))
  );

  // Calculate totals
  const totalQuantity = useMemo(() => {
    if (isMultiItemFormat) {
      return fishItems.reduce((sum, item) => sum + item.quantity, 0);
    }
    return locationQuantities.reduce((sum, loc) => sum + loc.quantity, 0);
  }, [isMultiItemFormat, fishItems, locationQuantities]);

  const canExport = totalQuantity > 0 && Number.isFinite(totalQuantity);

  // Update quantity for a fish item (multi-item format)
  const updateFishItemQuantity = useCallback((index: number, newQuantity: number) => {
    if (!Number.isFinite(newQuantity)) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setFishItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], quantity: Math.max(0, newQuantity) };
      return updated;
    });
  }, []);

  // Update quantity for a location (legacy format)
  const updateQuantity = useCallback((index: number, newQuantity: number) => {
    if (!Number.isFinite(newQuantity)) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setLocationQuantities((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], quantity: Math.max(0, newQuantity) };
      return updated;
    });
  }, []);

  // Generate message text
  const messageText = useMemo(() => {
    const today = new Date().toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    let message = `Hi, I'd like to place an order:\n\n`;
    message += `FISH ORDER - Smelter\n`;
    message += `Date: ${today}\n\n`;

    if (isMultiItemFormat) {
      // Multi-item format: one location, multiple fish items
      message += `${locationName}:\n`;
      fishItems.forEach((item) => {
        if (item.quantity > 0) {
          message += `- ${item.itemName}: ${item.quantity} ${item.unit}\n`;
        }
      });
      message += `\n`;
      message += `TOTAL: ${totalQuantity} items\n\n`;
    } else {
      // Legacy format: one item, multiple locations
      locationQuantities.forEach((loc) => {
        if (loc.quantity > 0) {
          message += `${loc.name}:\n`;
          message += `- ${legacyItemName}: ${loc.quantity} ${legacyItemUnit}\n\n`;
        }
      });
      message += `TOTAL: ${totalQuantity} ${legacyItemUnit}\n\n`;
    }

    message += `Please confirm availability.\nThank you!`;

    return message;
  }, [isMultiItemFormat, fishItems, locationQuantities, locationName, legacyItemName, legacyItemUnit, totalQuantity]);

  // Handle copy to clipboard
  const handleCopyToClipboard = useCallback(async () => {
    if (!canExport) return;
    await Clipboard.setStringAsync(messageText);
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    Alert.alert('Copied!', 'Order copied to clipboard');
  }, [canExport, messageText]);

  // Handle share
  const handleShare = useCallback(async () => {
    if (!canExport) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    try {
      const result = await Share.share({
        message: messageText,
        title: 'Fish Order',
      });

      if (result.action === Share.sharedAction) {
        Alert.alert('Shared!', 'Order has been shared');
      }
    } catch (error: unknown) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to share');
    }
  }, [canExport, messageText]);

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Confirm Order',
          headerBackTitle: 'Back',
          headerTintColor: colors.primary[500],
          headerStyle: { backgroundColor: colors.white },
          headerTitleStyle: { color: colors.text, fontWeight: weight.semibold },
        }}
      />
      <SafeAreaView className="flex-1" style={{ backgroundColor: color.page }} edges={['bottom']}>
        <ManagerScaleContainer>
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
          {/* Header */}
          <View
            className="p-4 mb-4 border"
            style={{ backgroundColor: color.card, borderRadius: radius.card, borderColor: color.hairlineStrong, shadowColor: colors.background,
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.05,
              shadowRadius: 4,
              elevation: 2 }}
          >
            {isMultiItemFormat ? (
              <>
                <View className="flex-row items-center mb-2">
                  <View className="w-10 h-10 items-center justify-center mr-3" style={{ backgroundColor: color.accent, borderRadius: radius.pill }}>
                    <Text className="font-bold" style={{ color: color.onAccent }}>{locationShortCode}</Text>
                  </View>
                  <Text className="font-bold flex-1" style={{ fontSize: typeScale.title, color: color.ink }}>
                    {locationName}
                  </Text>
                </View>
                <View className="flex-row items-center justify-between">
                  <Text style={{ color: color.ink2 }}>Fish Items</Text>
                  <Text className="font-bold" style={{ fontSize: typeScale.display, color: color.accent }}>
                    {fishItems.length} items
                  </Text>
                </View>
              </>
            ) : (
              <>
                <View className="flex-row items-center mb-2">
                  <Text className="mr-2" style={{ fontSize: typeScale.display }}></Text>
                  <Text className="font-bold flex-1" style={{ fontSize: typeScale.title, color: color.ink }}>
                    {legacyItemName}
                  </Text>
                </View>
                <View className="flex-row items-center justify-between">
                  <Text style={{ color: color.ink2 }}>Total Order</Text>
                  <Text className="font-bold" style={{ fontSize: typeScale.display, color: color.accent }}>
                    {totalQuantity} {legacyItemUnit}
                  </Text>
                </View>
              </>
            )}
          </View>

          {/* Editable Quantities */}
          <Text className="font-semibold uppercase tracking-wide mb-3 px-1" style={{ fontSize: typeScale.body, color: color.ink2 }}>
            {isMultiItemFormat ? 'Adjust Quantities' : 'Adjust Quantities by Location'}
          </Text>

          {isMultiItemFormat ? (
            // Multi-item format: list fish items
            fishItems.map((item, index) => (
              <View
                key={item.itemId}
                className="p-4 mb-3 border flex-row items-center"
                style={{ backgroundColor: color.card, borderRadius: radius.control, borderColor: color.hairlineStrong, shadowColor: colors.background,
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.05,
                  shadowRadius: 4,
                  elevation: 2 }}
              >
                {/* Item Info */}
                <Text className="mr-2" style={{ fontSize: typeScale.title }}></Text>
                <View className="flex-1">
                  <Text className="font-semibold" style={{ color: color.ink }}>{item.itemName}</Text>
                  <Text style={{ fontSize: typeScale.body, color: color.ink2 }}>{item.unit}</Text>
                </View>

                {/* Quantity Controls */}
                <View className="flex-row items-center">
                  <TouchableOpacity
                    className="w-10 h-10 items-center justify-center" style={{ backgroundColor: color.well, borderTopLeftRadius: radius.control, borderBottomLeftRadius: radius.control }}
                    onPress={() => updateFishItemQuantity(index, item.quantity - 1)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="remove" size={20} color={colors.gray[600]} />
                  </TouchableOpacity>

                  <TextInput
                    className="w-16 h-10 text-center font-bold" style={{ backgroundColor: color.page, fontSize: typeScale.title, color: color.ink }}
                    value={item.quantity.toString()}
                    onChangeText={(text) => {
                      const num = parseInt(text, 10);
                      if (!isNaN(num)) {
                        updateFishItemQuantity(index, num);
                      }
                    }}
                    keyboardType="number-pad"
                    selectTextOnFocus
                  />

                  <TouchableOpacity
                    className="w-10 h-10 items-center justify-center" style={{ backgroundColor: color.well, borderTopRightRadius: radius.control, borderBottomRightRadius: radius.control }}
                    onPress={() => updateFishItemQuantity(index, item.quantity + 1)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="add" size={20} color={colors.gray[600]} />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          ) : (
            // Legacy format: list locations
            locationQuantities.map((loc, index) => (
              <View
                key={index}
                className="p-4 mb-3 border flex-row items-center"
                style={{ backgroundColor: color.card, borderRadius: radius.control, borderColor: color.hairlineStrong, shadowColor: colors.background,
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.05,
                  shadowRadius: 4,
                  elevation: 2 }}
              >
                {/* Location Info */}
                <View className="flex-1">
                  <Text className="font-semibold" style={{ color: color.ink }}>{loc.name}</Text>
                  <Text style={{ fontSize: typeScale.body, color: color.ink2 }}>{loc.shortCode}</Text>
                </View>

                {/* Quantity Controls */}
                <View className="flex-row items-center">
                  <TouchableOpacity
                    className="w-10 h-10 items-center justify-center" style={{ backgroundColor: color.well, borderTopLeftRadius: radius.control, borderBottomLeftRadius: radius.control }}
                    onPress={() => updateQuantity(index, loc.quantity - 1)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="remove" size={20} color={colors.gray[600]} />
                  </TouchableOpacity>

                  <TextInput
                    className="w-16 h-10 text-center font-bold" style={{ backgroundColor: color.page, fontSize: typeScale.title, color: color.ink }}
                    value={loc.quantity.toString()}
                    onChangeText={(text) => {
                      const num = parseInt(text, 10);
                      if (!isNaN(num)) {
                        updateQuantity(index, num);
                      }
                    }}
                    keyboardType="number-pad"
                    selectTextOnFocus
                  />

                  <TouchableOpacity
                    className="w-10 h-10 items-center justify-center" style={{ backgroundColor: color.well, borderTopRightRadius: radius.control, borderBottomRightRadius: radius.control }}
                    onPress={() => updateQuantity(index, loc.quantity + 1)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="add" size={20} color={colors.gray[600]} />
                  </TouchableOpacity>
                </View>

                {/* Unit Label */}
                <Text className="ml-2 w-12" style={{ fontSize: typeScale.body, color: color.ink2 }}>{legacyItemUnit}</Text>
              </View>
            ))
          )}

          {/* Message Preview */}
          <Text className="font-semibold uppercase tracking-wide mt-4 mb-3 px-1" style={{ fontSize: typeScale.body, color: color.ink2 }}>
            Message Preview
          </Text>

          <View
            className="p-4 border"
            style={{ backgroundColor: color.card, borderRadius: radius.control, borderColor: color.hairlineStrong, shadowColor: colors.background,
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.05,
              shadowRadius: 4,
              elevation: 2 }}
          >
            <Text className="leading-6 font-mono" style={{ color: color.ink2, fontSize: typeScale.body }}>
              {canExport ? messageText : 'Set a quantity greater than zero before exporting.'}
            </Text>
          </View>
        </ScrollView>

        {/* Bottom Action Buttons */}
        <View className="border-t px-4 py-4" style={{ backgroundColor: color.card, borderColor: color.hairlineStrong }}>
          <View className="flex-row space-x-3">
            {/* Copy to Clipboard */}
            <TouchableOpacity
              className="flex-1 py-4 flex-row items-center justify-center"
              disabled={!canExport}
              accessibilityState={{ disabled: !canExport }}
              style={{ backgroundColor: color.well, borderRadius: radius.control, opacity: canExport ? 1 : 0.5 }}
              onPress={handleCopyToClipboard}
              activeOpacity={0.8}
            >
              <Ionicons name="copy-outline" size={20} color={colors.gray[700]} />
              <Text className="font-semibold ml-2" style={{ color: color.ink2 }}>Copy</Text>
            </TouchableOpacity>

            {/* Share */}
            <TouchableOpacity
              className="flex-1 py-4 flex-row items-center justify-center"
              disabled={!canExport}
              accessibilityState={{ disabled: !canExport }}
              style={{ backgroundColor: color.accent, borderRadius: radius.control, opacity: canExport ? 1 : 0.5 }}
              onPress={handleShare}
              activeOpacity={0.8}
            >
              <Ionicons name="share-outline" size={20} color="white" />
              <Text className="font-semibold ml-2" style={{ color: color.onAccent }}>Share</Text>
            </TouchableOpacity>
          </View>
        </View>
        </ManagerScaleContainer>
      </SafeAreaView>
    </>
  );
}
