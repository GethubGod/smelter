import React, { useCallback, useEffect, useMemo, useRef } from "react";
import {
  ActivityIndicator,
  LayoutChangeEvent,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  Easing,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useScaledStyles } from "@/hooks/useScaledStyles";
import { triggerConfirmationHaptic } from "@/lib/haptics";
import {
  colors,
  glassColors,
  glassHairlineWidth,
  glassRadii,
  grayScale,
  quickOrderAccent,
} from "@/theme/design";
import { LocationSwitcherDropdown } from "@/features/stock-check/components/LocationSwitcherDropdown";
import type { Location } from "@/types";
import {
  QUICK_ORDER_ROW_MIN_HEIGHT,
  QuickOrderItemRow,
  type ResolveQuantityOptions,
} from "./QuickOrderItemRow";
import {
  formatParsedItemQuantity,
  getParsedItemIssue,
  getParsedItemKey,
  normalizeQuickOrderUnit,
  type ParsedQuickOrderItem,
} from "./quickOrderItems";
import { color, radius, typeScale, weight } from '@/theme/tokens';

const CARD_PADDING = 13;
const CARD_SECTION_GAP = 7;
const VISIBLE_ROW_SLOTS = 4;
const CTA_HEIGHT = 36;
const SCROLLBAR_WIDTH = 5;
const SCROLLBAR_MIN_THUMB = 28;
const LOCATION_PILL_HEIGHT = 32;
const CHEVRON_TIMING = { duration: 200, easing: Easing.bezier(0.2, 0, 0.2, 1) };

type QuickOrderListCardProps = {
  items: ParsedQuickOrderItem[];
  /** Number of items that still need attention before the order can be confirmed. */
  issueCount: number;
  isSubmitting: boolean;
  onEditItem: (item: ParsedQuickOrderItem) => void;
  onResolveQuantity: (
    item: ParsedQuickOrderItem,
    options?: ResolveQuantityOptions,
  ) => void;
  /** Removes every parsed item backing a swiped row. */
  onRemoveItems: (items: ParsedQuickOrderItem[]) => void;
  onConfirm: () => void;
  onHeightChange: (height: number) => void;
  /**
   * Location switcher, hosted inside the card header. When these props are
   * omitted the pill/trash affordances are simply not rendered (used by tests).
   */
  locationShortLabel?: string;
  locationLabel?: string;
  locations?: Location[];
  selectedLocationId?: string | null;
  isLocationDropdownOpen?: boolean;
  onToggleLocationDropdown?: () => void;
  onSelectLocation?: (location: Location) => void;
  onCloseLocationDropdown?: () => void;
  /** Clears the current order (trash button). */
  onClear?: () => void;
};

type ConfirmState = "empty" | "needs-fixing" | "ready" | "confirming";

type OrderListQuantityLine = {
  label: string;
  item: ParsedQuickOrderItem;
};

type OrderListGroup = {
  key: string;
  item: ParsedQuickOrderItem;
  items: ParsedQuickOrderItem[];
  quantityLines: OrderListQuantityLine[];
};

/**
 * Order List card.
 *
 *   1. Header               — title + summary, compact padding
 *   2. List slot            — empty hint (slim) or ScrollView capped at 4 rows
 *      Scroll affordance     — chevron-down on the right when more rows exist
 *   3. Confirm footer        — TouchableOpacity with inline solid background.
 *      Decorative overlay    — in the `ready` state, an extra absolutely-
 *                              positioned pill is rendered on top of the
 *                              footer so the Confirm Order CTA is visible even
 *                              if the underlying Pressable paint fails.
 */
export function QuickOrderListCard({
  items,
  issueCount,
  isSubmitting,
  onEditItem,
  onResolveQuantity,
  onRemoveItems,
  onConfirm,
  onHeightChange,
  locationShortLabel,
  locationLabel,
  locations,
  selectedLocationId,
  isLocationDropdownOpen = false,
  onToggleLocationDropdown,
  onSelectLocation,
  onCloseLocationDropdown,
  onClear,
}: QuickOrderListCardProps) {
  const ds = useScaledStyles();
  const scrollRef = useRef<React.ComponentRef<typeof Animated.ScrollView> | null>(null);

  const showLocationPill = Boolean(onToggleLocationDropdown && locationShortLabel);
  const sortedLocations = useMemo(
    () => [...(locations ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [locations],
  );


  // Rotate the pill chevron 180° in lock-step with the dropdown open progress.
  const chevronProgress = useSharedValue(isLocationDropdownOpen ? 1 : 0);
  useEffect(() => {
    chevronProgress.value = withTiming(
      isLocationDropdownOpen ? 1 : 0,
      CHEVRON_TIMING,
    );
  }, [chevronProgress, isLocationDropdownOpen]);
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronProgress.value * 180}deg` }],
  }));

  const handleSelectLocation = useCallback(
    (location: Location) => {
      onSelectLocation?.(location);
      onCloseLocationDropdown?.();
    },
    [onCloseLocationDropdown, onSelectLocation],
  );

  const displayGroups = useMemo(() => groupOrderListItems(items), [items]);
  const count = displayGroups.length;
  const isEmpty = count === 0;

  const confirmState: ConfirmState = isSubmitting
    ? "confirming"
    : isEmpty
      ? "empty"
      : issueCount > 0
        ? "needs-fixing"
        : "ready";

  const rowSlot = ds.spacing(QUICK_ORDER_ROW_MIN_HEIGHT);
  const scrollable = count > VISIBLE_ROW_SLOTS;
  const listMaxHeight = rowSlot * VISIBLE_ROW_SLOTS;

  // Live scroll geometry powering the always-visible custom scrollbar. The
  // native indicator fades out after scrolling stops, so we draw our own thumb
  // and keep it pinned. Seeded from onLayout / onContentSizeChange so the bar
  // is correct before the first scroll event.
  const offsetY = useSharedValue(0);
  const contentHeight = useSharedValue(0);
  const viewportHeight = useSharedValue(0);

  const handleScroll = useAnimatedScrollHandler((event) => {
    offsetY.value = event.contentOffset.y;
    contentHeight.value = event.contentSize.height;
    viewportHeight.value = event.layoutMeasurement.height;
  });

  const handleScrollContentSizeChange = useCallback(
    (_width: number, height: number) => {
      contentHeight.value = height;
    },
    [contentHeight],
  );

  const handleScrollViewLayout = useCallback(
    (event: LayoutChangeEvent) => {
      viewportHeight.value = event.nativeEvent.layout.height;
    },
    [viewportHeight],
  );

  // Derive the custom scrollbar thumb geometry. We seed it from the known row
  // count (available on first render) and refine with measured values once the
  // ScrollView reports them, so the bar is visible immediately and stays
  // accurate as rows resize.
  const showScrollbar = scrollable;
  const scrollbarThumbStyle = useAnimatedStyle(() => {
    const measuredViewportHeight =
      viewportHeight.value > 0 ? viewportHeight.value : listMaxHeight;
    const measuredContentHeight = Math.max(contentHeight.value, count * rowSlot);
    const geometry = getScrollbarThumbGeometry({
      viewportHeight: measuredViewportHeight,
      contentHeight: measuredContentHeight,
      offsetY: offsetY.value,
      minThumbHeight: SCROLLBAR_MIN_THUMB,
    });

    return {
      height: geometry.height,
      transform: [{ translateY: geometry.top }],
    };
  }, [count, listMaxHeight, rowSlot]);

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) =>
      onHeightChange(event.nativeEvent.layout.height),
    [onHeightChange],
  );

  const handleConfirmPress = useCallback(() => {
    if (confirmState !== "ready") return;
    void triggerConfirmationHaptic();
    onConfirm();
  }, [confirmState, onConfirm]);

  const summary =
    issueCount > 0
      ? `${count} · ${issueCount} to fix`
      : `${count} · all set`;

  // Find the first item that needs attention so we can scroll it into view.
  const firstIssueIndex = useMemo(() => {
    if (issueCount === 0) return -1;
    for (let i = 0; i < displayGroups.length; i += 1) {
      if (displayGroups[i].items.some((item) => getParsedItemIssue(item) != null)) return i;
    }
    return -1;
  }, [displayGroups, issueCount]);

  // When the list grows, follow the newest row.
  const previousCount = useRef(count);
  useEffect(() => {
    const grew = count > previousCount.current;
    previousCount.current = count;
    if (count === 0 || !grew) return;
    const frame = requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [count]);

  // When an issue appears, scroll the offending item into view (only useful
  // when it sits below the visible window).
  useEffect(() => {
    if (firstIssueIndex < 0 || !scrollable) return;
    if (firstIssueIndex < VISIBLE_ROW_SLOTS) return;
    const frame = requestAnimationFrame(() => {
      const offset = Math.max(0, (firstIssueIndex - 1) * rowSlot);
      scrollRef.current?.scrollTo({ y: offset, animated: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [firstIssueIndex, rowSlot, scrollable]);

  return (
    <View
      onLayout={handleLayout}
      style={[
        styles.container,
        {
          left: ds.spacing(20),
          right: ds.spacing(20),
        },
      ]}
    >
      <View
        style={[
          styles.card,
          {
            borderRadius: radius.sheet,
            padding: ds.spacing(CARD_PADDING),
          },
        ]}
      >
        {/* 1. Header — title, plus the location switcher + clear affordances. */}
        <View style={styles.header}>
          <Text style={[styles.title, { fontSize: ds.fontSize(typeScale.title) }]}>
            Order list
          </Text>
          {showLocationPill || onClear ? (
            <View style={styles.headerActions}>
              {showLocationPill ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={`Active location ${
                    locationLabel ?? locationShortLabel
                  }. Tap to change.`}
                  accessibilityState={{ expanded: isLocationDropdownOpen }}
                  onPress={onToggleLocationDropdown}
                  disabled={(locations?.length ?? 0) === 0}
                  activeOpacity={0.75}
                  style={[
                    styles.locationPill,
                    {
                      height: ds.spacing(LOCATION_PILL_HEIGHT),
                      paddingLeft: ds.spacing(10),
                      paddingRight: ds.spacing(8),
                      borderRadius: radius.pill,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.locationDot,
                      { marginRight: ds.spacing(7) },
                    ]}
                  />
                  <Text
                    style={[styles.locationLabel, { fontSize: ds.fontSize(typeScale.body) }]}
                    numberOfLines={1}
                  >
                    {locationShortLabel}
                  </Text>
                  <Animated.View style={[{ marginLeft: ds.spacing(4) }, chevronStyle]}>
                    <Ionicons
                      name="chevron-down"
                      size={ds.icon(15)}
                      color={glassColors.textSecondary}
                    />
                  </Animated.View>
                </TouchableOpacity>
              ) : null}
              {onClear ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Clear quick order"
                  onPress={onClear}
                  activeOpacity={0.7}
                  hitSlop={8}
                  style={[
                    styles.trashButton,
                    {
                      width: ds.spacing(LOCATION_PILL_HEIGHT),
                      height: ds.spacing(LOCATION_PILL_HEIGHT),
                      marginLeft: ds.spacing(8),
                      borderRadius: radius.pill,
                    },
                  ]}
                >
                  <Ionicons
                    name="trash-outline"
                    size={ds.icon(16)}
                    color={glassColors.textSecondary}
                  />
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}
        </View>

        {/* 2. List slot */}
        <View
          style={{
            marginTop: ds.spacing(CARD_SECTION_GAP),
            position: "relative",
          }}
        >
          {isEmpty ? (
            <View
              style={[
                styles.emptyPanel,
                {
                  paddingVertical: ds.spacing(20),
                  paddingHorizontal: ds.spacing(12),
                },
              ]}
            >
              <Text
                style={[styles.emptyText, { fontSize: ds.fontSize(typeScale.body) }]}
                numberOfLines={2}
              >
                Items you add will appear here
              </Text>
            </View>
          ) : (
            <View style={{ position: "relative" }}>
              <Animated.ScrollView
                ref={scrollRef}
                style={{ maxHeight: listMaxHeight }}
                contentContainerStyle={{ paddingRight: ds.spacing(14) }}
                showsVerticalScrollIndicator={false}
                onScroll={handleScroll}
                onLayout={handleScrollViewLayout}
                onContentSizeChange={handleScrollContentSizeChange}
                scrollEventThrottle={16}
                scrollEnabled={scrollable}
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
                bounces={false}
              >
                {displayGroups.map((group, index) => (
                  <QuickOrderItemRow
                    key={`${group.key}::${index}`}
                    item={group.item}
                    quantityLines={group.quantityLines}
                    showDivider={index > 0}
                    onEdit={onEditItem}
                    onResolveQuantity={onResolveQuantity}
                    onRemove={() => onRemoveItems(group.items)}
                  />
                ))}
              </Animated.ScrollView>
              {showScrollbar ? (
                <View
                  pointerEvents="none"
                  style={[
                    styles.scrollbarTrack,
                    {
                      width: ds.spacing(SCROLLBAR_WIDTH),
                      borderRadius: ds.radius(SCROLLBAR_WIDTH),
                    },
                  ]}
                >
                  <Animated.View
                    style={[
                      styles.scrollbarThumb,
                      scrollbarThumbStyle,
                      {
                        borderRadius: ds.radius(SCROLLBAR_WIDTH),
                      },
                    ]}
                  />
                </View>
              ) : null}
            </View>
          )}
        </View>

        {/* 3. Footer — status badge (left) + compact confirm button (right). */}
        {confirmState !== "empty" ? (
          <View
            style={[
              styles.footer,
              { marginTop: ds.spacing(CARD_SECTION_GAP) },
            ]}
          >
            {count > 0 ? (
              <View
                style={[
                  styles.statusBadge,
                  issueCount > 0 ? styles.statusBadgeAmber : styles.statusBadgeGreen,
                  {
                    paddingHorizontal: ds.spacing(10),
                    paddingVertical: ds.spacing(5),
                    borderRadius: radius.pill,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.statusBadgeText,
                    issueCount > 0
                      ? styles.statusBadgeTextAmber
                      : styles.statusBadgeTextGreen,
                    { fontSize: ds.fontSize(typeScale.secondary) },
                  ]}
                  numberOfLines={1}
                >
                  {summary}
                </Text>
              </View>
            ) : (
              <View />
            )}
            <ConfirmButton
              state={confirmState}
              onPress={handleConfirmPress}
              radius={radius.pill}
              fontSize={ds.fontSize(typeScale.body)}
              iconSize={ds.icon(18)}
              height={ds.spacing(CTA_HEIGHT)}
              paddingHorizontal={ds.spacing(34)}
            />
          </View>
        ) : null}

        {/* Location dropdown overlay — anchored so its top-right corner lands on
            the pill's top-right corner. Absolute insets are measured from the
            card's border box, so we inset by the card padding to reach the
            content box where the pill actually sits. The menu then grows down +
            outward from the pill. */}
        {showLocationPill ? (
          <View
            pointerEvents="box-none"
            style={[
              styles.dropdownOverlay,
              {
                top: ds.spacing(CARD_PADDING),
                left: ds.spacing(CARD_PADDING),
                right: ds.spacing(CARD_PADDING),
              },
            ]}
          >
            <LocationSwitcherDropdown
              isOpen={isLocationDropdownOpen}
              locations={sortedLocations}
              selectedLocationId={selectedLocationId ?? null}
              onSelect={handleSelectLocation}
              onRequestClose={onCloseLocationDropdown ?? (() => {})}
              tone="muted"
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}

export function getScrollbarThumbGeometry({
  viewportHeight,
  contentHeight,
  offsetY,
  minThumbHeight,
}: {
  viewportHeight: number;
  contentHeight: number;
  offsetY: number;
  minThumbHeight: number;
}): { height: number; top: number } {
  'worklet';
  if (viewportHeight <= 0 || contentHeight <= viewportHeight) {
    return { height: Math.max(0, viewportHeight), top: 0 };
  }

  const height = Math.min(
    viewportHeight,
    Math.max(minThumbHeight, (viewportHeight * viewportHeight) / contentHeight),
  );
  const maxOffset = contentHeight - viewportHeight;
  const maxTop = viewportHeight - height;
  const top = Math.max(0, Math.min(maxTop, (offsetY / maxOffset) * maxTop));
  return { height, top };
}

function groupOrderListItems(items: ParsedQuickOrderItem[]): OrderListGroup[] {
  const groups = new Map<string, ParsedQuickOrderItem[]>();
  const order: string[] = [];

  for (const item of items) {
    const key = item.item_id ? `item:${item.item_id}` : getParsedItemKey(item);
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key)!.push(item);
  }

  return order.map((key) => {
    const groupItems = groups.get(key) ?? [];
    const item = groupItems.find((entry) => getParsedItemIssue(entry) != null) ?? groupItems[0];
    return {
      key,
      item,
      items: groupItems,
      quantityLines: buildQuantityLines(groupItems),
    };
  });
}

function buildQuantityLines(items: ParsedQuickOrderItem[]): OrderListQuantityLine[] {
  const byUnit = new Map<string, ParsedQuickOrderItem>();
  const lines: ParsedQuickOrderItem[] = [];

  for (const item of items) {
    const issue = getParsedItemIssue(item);
    if (issue) {
      lines.push(item);
      continue;
    }

    const unitKey = normalizeQuickOrderUnit(item.unit) ?? item.unit ?? getParsedItemKey(item);
    const existing = byUnit.get(unitKey);
    if (!existing) {
      byUnit.set(unitKey, { ...item });
      lines.push(byUnit.get(unitKey)!);
      continue;
    }

    if (item.quantity != null && existing.quantity != null) {
      existing.quantity += item.quantity;
    }
  }

  return lines.map((lineItem) => ({
    label: formatParsedItemQuantity(lineItem),
    item: lineItem,
  }));
}

type ConfirmButtonProps = {
  state: ConfirmState;
  onPress: () => void;
  radius: number;
  fontSize: number;
  iconSize: number;
  height: number;
  paddingHorizontal: number;
};

const FOOTER_LABEL: Record<ConfirmState, string> = {
  empty: "Add item",
  "needs-fixing": "Fix cart",
  ready: "Confirm order",
  confirming: "Confirming…",
};

function ConfirmButton({
  state,
  onPress,
  radius,
  fontSize,
  iconSize,
  height,
  paddingHorizontal,
}: ConfirmButtonProps) {
  const disabled = state !== "ready";
  const variant = FOOTER_VARIANT[state];
  const label = FOOTER_LABEL[state];

  return (
    <TouchableOpacity
      activeOpacity={disabled ? 1 : 0.85}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityLabel={label}
      disabled={disabled}
      onPress={disabled ? undefined : onPress}
      style={{
        height,
        paddingHorizontal,
        backgroundColor: variant.background,
        borderColor: variant.border,
        borderWidth: variant.borderWidth,
        borderRadius: radius,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
      }}
    >
      {state === "confirming" ? (
        <ActivityIndicator
          color={variant.foreground}
          style={{ marginRight: 6 }}
          size="small"
        />
      ) : null}
      <Text
        style={{
          color: variant.foreground,
          fontSize,
          fontWeight: weight.bold,
          letterSpacing: 0,
          textAlign: "center",
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
      {state === "ready" ? (
        <Ionicons
          name="arrow-forward"
          size={iconSize}
          color={variant.foreground}
          style={{ marginLeft: 6 }}
        />
      ) : null}
    </TouchableOpacity>
  );
}

type FooterVariant = {
  background: string;
  foreground: string;
  border: string;
  borderWidth: number;
};

// Opaque backgrounds in every state. The previous translucent amber wash made
// the pill read as plain text.
const FOOTER_VARIANT: Record<ConfirmState, FooterVariant> = {
  ready: {
    background: quickOrderAccent,
    foreground: color.card,
    border: quickOrderAccent,
    borderWidth: 0,
  },
  confirming: {
    background: quickOrderAccent,
    foreground: color.card,
    border: quickOrderAccent,
    borderWidth: 0,
  },
  "needs-fixing": {
    background: color.warningBg,
    foreground: color.warning,
    border: color.warning,
    borderWidth: 1,
  },
  empty: {
    background: color.well,
    foreground: color.ink2,
    border: color.hairlineStrong,
    borderWidth: glassHairlineWidth,
  },
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    zIndex: 10,
  },
  card: {
    backgroundColor: colors.white,
    borderWidth: glassHairlineWidth,
    borderColor: glassColors.cardBorder,
    overflow: "visible",
    shadowColor: colors.textPrimary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    flexShrink: 0,
    color: colors.textPrimary,
    fontWeight: weight.bold,
    letterSpacing: 0,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
    marginLeft: 12,
  },
  locationPill: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
    backgroundColor: color.well,
    borderWidth: glassHairlineWidth,
    borderColor: glassColors.cardBorder,
  },
  locationDot: {
    width: 9,
    height: 9,
    borderRadius: glassRadii.round,
    backgroundColor: glassColors.accent,
  },
  locationLabel: {
    flexShrink: 1,
    color: glassColors.textPrimary,
    fontWeight: weight.bold,
    letterSpacing: -0.2,
  },
  trashButton: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.well,
  },
  dropdownOverlay: {
    position: "absolute",
    // top/left/right are set inline (insets = card padding) so the box aligns
    // with the content where the pill sits.
    zIndex: 50,
  },
  emptyPanel: {
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    color: grayScale[500],
    fontWeight: weight.semibold,
    letterSpacing: 0,
  },
  scrollbarTrack: {
    position: "absolute",
    top: 2,
    bottom: 2,
    right: 2,
    backgroundColor: "rgba(60, 60, 67, 0.12)",
    overflow: "hidden",
  },
  scrollbarThumb: {
    position: "absolute",
    left: 0,
    right: 0,
    backgroundColor: "rgba(60, 60, 67, 0.55)",
  },
  statusBadge: {
    alignItems: "center",
    justifyContent: "center",
  },
  statusBadgeAmber: {
    backgroundColor: color.warningBg,
  },
  statusBadgeGreen: {
    backgroundColor: color.goodBg,
  },
  statusBadgeText: {
    fontWeight: weight.bold,
    letterSpacing: 0,
  },
  statusBadgeTextAmber: {
    color: color.warning,
  },
  statusBadgeTextGreen: {
    color: color.good,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
});
