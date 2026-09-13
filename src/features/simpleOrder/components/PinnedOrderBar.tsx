import React, { useCallback, useEffect, useRef } from 'react';
import {
  FlatList,
  Keyboard,
  type KeyboardEvent,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSequence,
} from 'react-native-reanimated';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { triggerImpactHaptic, triggerSelectionHaptic } from '@/lib/haptics';
import { color, motion, radius, shadow, typeScale, weight } from '@/theme/tokens';
import type { InventoryItem } from '@/types';
import { unitForInventoryItem } from '../checklistSelection';

interface PinnedOrderBarProps {
  query: string;
  onQueryChange: (query: string) => void;
  results: InventoryItem[];
  listedItemIds: Set<string>;
  selectedItemIds: Set<string>;
  onAddItem: (item: InventoryItem) => void;
  checkedCount: number;
  onPressSend: () => void;
  voiceAvailable: boolean;
  onPressMic: () => void;
  restingBottom: number;
}

const KEYBOARD_FALLBACK_MS = 220;
const MAX_RESULTS_HEIGHT = 300;
const SEARCH_WELL_HEIGHT = 46;
const SEND_SIZE = 48;
const MIC_SIZE = 36;
const CLEAR_SIZE = 24;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const glideEasing = Easing.bezier(...motion.ease);
const controlEasing = Easing.bezier(...motion.controlEase);
const popEasing = Easing.bezier(...motion.pop);

export function PinnedOrderBar({
  query,
  onQueryChange,
  results,
  listedItemIds,
  selectedItemIds,
  onAddItem,
  checkedCount,
  onPressSend,
  voiceAvailable,
  onPressMic,
  restingBottom,
}: PinnedOrderBarProps) {
  const ds = useScaledStyles();
  const focused = useIsFocused();
  const restingBottomRef = useRef(restingBottom);
  const keyboardBottom = useSharedValue(restingBottom);
  const focusProgress = useSharedValue(focused ? 1 : 0);
  const focusOpacity = useSharedValue(focused ? 1 : 0);
  const resultsOpacity = useSharedValue(query.trim() ? 1 : 0);
  const sendProgress = useSharedValue(checkedCount > 0 ? 1 : 0);
  const resultsProgress = useSharedValue(query.trim() ? 1 : 0);
  const sendScale = useSharedValue(1);
  const badgeScale = useSharedValue(1);

  useEffect(() => {
    restingBottomRef.current = restingBottom;
    keyboardBottom.value = withTiming(restingBottom, {
      duration: KEYBOARD_FALLBACK_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [keyboardBottom, restingBottom]);

  useEffect(() => {
    focusProgress.value = withTiming(focused ? 1 : 0, {
      duration: 260,
      easing: glideEasing,
    });
    focusOpacity.value = withTiming(focused ? 1 : 0, { duration: 220, easing: controlEasing });
  }, [focusOpacity, focusProgress, focused]);

  useEffect(() => {
    resultsProgress.value = withTiming(query.trim() ? 1 : 0, {
      duration: motion.dur,
      easing: glideEasing,
    });
    resultsOpacity.value = withTiming(query.trim() ? 1 : 0, { duration: motion.dur, easing: controlEasing });
  }, [query, resultsOpacity, resultsProgress]);

  useEffect(() => {
    sendProgress.value = withTiming(checkedCount > 0 ? 1 : 0, { duration: motion.dur, easing: controlEasing });
    if (checkedCount === 0) return;
    badgeScale.value = 1;
    badgeScale.value = withSequence(
      withTiming(1.35, { duration: 128, easing: popEasing }),
      withTiming(1, { duration: 192, easing: popEasing }),
    );
  }, [badgeScale, checkedCount, sendProgress]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (event: KeyboardEvent) => {
      keyboardBottom.value = withTiming(
        Math.max(event.endCoordinates.height + 12, restingBottomRef.current),
        {
          duration:
            event.duration && event.duration > 0
              ? event.duration
              : KEYBOARD_FALLBACK_MS,
          easing: Easing.out(Easing.cubic),
        },
      );
    };
    const onHide = (event: KeyboardEvent) => {
      keyboardBottom.value = withTiming(restingBottomRef.current, {
        duration:
          event.duration && event.duration > 0
            ? event.duration
            : KEYBOARD_FALLBACK_MS,
        easing: Easing.out(Easing.cubic),
      });
    };

    const showSubscription = Keyboard.addListener(showEvent, onShow);
    const hideSubscription = Keyboard.addListener(hideEvent, onHide);
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [keyboardBottom]);

  const positionStyle = useAnimatedStyle(() => ({
    bottom: keyboardBottom.value,
    opacity: focusOpacity.value,
    transform: [{ translateY: 28 * (1 - focusProgress.value) }],
  }));
  const resultsHeightStyle = useAnimatedStyle(() => ({
    maxHeight: MAX_RESULTS_HEIGHT * resultsProgress.value,
  }));
  const resultsStyle = useAnimatedStyle(() => ({
    marginBottom: 8 * resultsProgress.value,
    opacity: resultsOpacity.value,
    transform: [{ translateY: 8 * (1 - resultsProgress.value) }],
  }));
  const sendStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sendScale.value }],
    backgroundColor: interpolateColor(sendProgress.value, [0, 1], [color.disabled, color.accent]),
  }));
  const badgeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: badgeScale.value }],
  }));

  const handleAdd = useCallback(
    (item: InventoryItem) => {
      void triggerSelectionHaptic();
      onAddItem(item);
      onQueryChange('');
    },
    [onAddItem, onQueryChange],
  );

  const handleSend = useCallback(() => {
    Keyboard.dismiss();
    onPressSend();
  }, [onPressSend]);

  const handleMic = useCallback(() => {
    void triggerImpactHaptic();
    Keyboard.dismiss();
    onPressMic();
  }, [onPressMic]);

  const showResults = query.trim().length > 0;
  const sendDisabled = checkedCount === 0;

  const renderResult = useCallback(
    ({ item, index }: { item: InventoryItem; index: number }) => {
      const isListed = listedItemIds.has(item.id);
      const isSelected = selectedItemIds.has(item.id);
      return (
        <Pressable
          onPress={() => handleAdd(item)}
          accessibilityRole="button"
          accessibilityLabel={
            isSelected ? `${item.name}, already on order` : `Add ${item.name}`
          }
          style={{
            minHeight: 50,
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: ds.spacing(14),
            paddingVertical: ds.spacing(6),
            gap: ds.spacing(10),
          }}
        >
          <View style={{ flex: 1, minWidth: 0, paddingRight: 0 }}>
            <Text
              numberOfLines={1}
              style={{
                fontSize: ds.fontSize(typeScale.body),
                fontWeight: weight.semibold,
                color: color.ink,
              }}
            >
              {item.name}
            </Text>
            <Text
              numberOfLines={1}
              style={{
                fontSize: ds.fontSize(typeScale.meta),
                color: color.ink3,
              }}
            >
              {unitForInventoryItem(item)}
              {isListed ? ' · on your list' : ''}
            </Text>
          </View>
          {index > 0 ? <View pointerEvents="none" style={{ position: 'absolute', left: ds.spacing(14), right: ds.spacing(14), top: 0, height: 1, backgroundColor: color.hairline }} /> : null}
          <Ionicons
            name={isSelected ? 'checkmark' : 'add'}
            size={ds.icon(20)}
            color={isSelected ? color.good : color.accent}
          />
        </Pressable>
      );
    },
    [ds, handleAdd, listedItemIds, selectedItemIds],
  );

  return (
    <Animated.View
      pointerEvents={focused ? 'box-none' : 'none'}
      style={[
        {
          position: 'absolute',
          left: ds.spacing(14),
          right: ds.spacing(14),
        },
        positionStyle,
      ]}
    >
      <Animated.View
        pointerEvents={showResults ? 'auto' : 'none'}
        style={[
          {
            backgroundColor: color.card,
            borderRadius: radius.card,
            ...shadow.addBar,
            shadowOpacity: 0.12,
          },
          resultsStyle,
        ]}
      >
        <Animated.View style={[{ overflow: 'hidden', borderRadius: radius.card }, resultsHeightStyle]}>
        {results.length > 0 ? (
          <FlatList
            data={results}
            keyExtractor={(item) => item.id}
            renderItem={renderResult}
            keyboardShouldPersistTaps="handled"
          />
        ) : (
          <View
            style={{
              minHeight: 50,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: ds.spacing(14),
              paddingVertical: ds.spacing(6),
            }}
          >
            <Text
              style={{
                fontSize: ds.fontSize(typeScale.secondary),
                color: color.ink3,
                textAlign: 'center',
              }}
            >
              No items match “{query.trim()}”
            </Text>
          </View>
        )}
        </Animated.View>
      </Animated.View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: ds.spacing(8),
          padding: ds.spacing(8),
          borderRadius: radius.addBar,
          backgroundColor: color.card,
          ...shadow.addBar,
        }}
      >
        <View
          style={{
            flex: 1,
            minHeight: SEARCH_WELL_HEIGHT,
            flexDirection: 'row',
            alignItems: 'center',
            paddingLeft: ds.spacing(14),
            paddingRight: ds.spacing(6),
            gap: ds.spacing(8),
            borderRadius: radius.pill,
            backgroundColor: color.page,
          }}
        >
          <Ionicons
            name="search-outline"
            size={ds.icon(18)}
            color={color.ink3}
          />
          <TextInput
            value={query}
            onChangeText={onQueryChange}
            placeholder="Add item"
            placeholderTextColor={color.ink3}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Search inventory to add items"
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: ds.fontSize(typeScale.body),
              color: color.ink,
              paddingVertical: 0,
            }}
          />
          {query.length > 0 ? (
            <Pressable
              onPress={() => onQueryChange('')}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              hitSlop={8}
              style={{
                width: CLEAR_SIZE,
                height: CLEAR_SIZE,
                borderRadius: radius.pill,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: color.well,
              }}
            >
              <Ionicons name="close" size={ds.icon(16)} color={color.ink3} />
            </Pressable>
          ) : null}
          {voiceAvailable ? (
            <Pressable
              onPress={handleMic}
              accessibilityRole="button"
              accessibilityLabel="Add items by voice"
              hitSlop={6}
              style={{
                width: MIC_SIZE,
                height: MIC_SIZE,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="mic-outline" size={ds.icon(20)} color={color.accent} />
            </Pressable>
          ) : null}
        </View>

        <AnimatedPressable
          onPress={handleSend}
          onPressIn={() => {
            sendScale.value = withTiming(0.94, {
              duration: 90,
              easing: controlEasing,
            });
          }}
          onPressOut={() => {
            sendScale.value = withTiming(1, {
              duration: 90,
              easing: controlEasing,
            });
          }}
          disabled={sendDisabled}
          accessibilityRole="button"
          accessibilityState={{ disabled: sendDisabled }}
          accessibilityLabel={
            sendDisabled
              ? 'Send order, no items selected'
              : `Send order with ${checkedCount} ${checkedCount === 1 ? 'item' : 'items'}`
          }
          style={[
            {
              width: SEND_SIZE,
              height: SEND_SIZE,
              borderRadius: radius.pill,
              alignItems: 'center',
              justifyContent: 'center',
            },
            sendStyle,
          ]}
        >
          <Ionicons name="arrow-up" size={ds.icon(22)} color={color.onAccent} />
          {checkedCount > 0 ? (
            <Animated.View
              style={[
                {
                  position: 'absolute',
                  top: -4,
                  right: -4,
                  minWidth: 20,
                  height: 19,
                  paddingHorizontal: ds.spacing(6),
                  borderRadius: radius.pill,
                  backgroundColor: color.ink,
                  alignItems: 'center',
                  justifyContent: 'center',
                },
                badgeStyle,
              ]}
            >
              <Text
                numberOfLines={1}
                style={{
                  fontSize: ds.fontSize(typeScale.caption),
                  fontWeight: weight.bold,
                  fontVariant: ['tabular-nums'],
                  color: color.onAccent,
                }}
              >
                {checkedCount}
              </Text>
            </Animated.View>
          ) : null}
        </AnimatedPressable>
      </View>
    </Animated.View>
  );
}
