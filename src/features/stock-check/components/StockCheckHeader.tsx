import React, { memo, useCallback, useEffect, useMemo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { color, radius, size, space, tracking, typeScale, weight } from '@/theme/tokens';
import { LocationSwitcherDropdown } from './LocationSwitcherDropdown';
import type { Location } from '@/types';

type HeaderIconName = React.ComponentProps<typeof Ionicons>['name'];

interface StockCheckHeaderProps {
  locationLabel: string;
  locations: Location[];
  selectedLocationId: string | null;
  isDropdownOpen: boolean;
  onToggleDropdown: () => void;
  onSelectLocation: (location: Location) => void;
  onCloseDropdown: () => void;
  onPressMore?: () => void;
  moreAccessibilityLabel?: string;
  moreIconName?: HeaderIconName;
}

// Matches the location selector pill's `minHeight` so the two affordances are
// the same size and sit on a shared baseline.
const ELLIPSIS_BUTTON_SIZE = size.input;
const CHEVRON_TIMING = { duration: 200, easing: Easing.bezier(0.2, 0, 0.2, 1) };

/**
 * Compact, sticky-friendly header for the Stock Check screen.
 *
 * The "Stock Check" title and date subheader were removed in a prior pass —
 * this header is now a single row with two affordances:
 *   • A wide location selector pill (flex: 1) that opens an animated dropdown
 *     of all locations when tapped. The trailing chevron rotates 180° in
 *     lock-step with the dropdown's open progress for a tightly-coupled feel.
 *   • A 48×48 ellipsis-menu button beside it (same size as the pill) for meta
 *     actions.
 *
 * The dropdown overlay is rendered as a sibling immediately below the pill so
 * it doesn't push the rest of the sticky header (progress bar, station pills)
 * down on open — the menu animates over them as a layered overlay.
 */
export const StockCheckHeader = memo(function StockCheckHeader({
  locationLabel,
  locations,
  selectedLocationId,
  isDropdownOpen,
  onToggleDropdown,
  onSelectLocation,
  onCloseDropdown,
  onPressMore,
  moreAccessibilityLabel = 'More options',
  moreIconName = 'ellipsis-horizontal',
}: StockCheckHeaderProps) {
  const ds = useScaledStyles();
  const chevronProgress = useSharedValue(isDropdownOpen ? 1 : 0);

  useEffect(() => {
    chevronProgress.value = withTiming(
      isDropdownOpen ? 1 : 0,
      CHEVRON_TIMING,
    );
  }, [chevronProgress, isDropdownOpen]);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronProgress.value * 180}deg` }],
  }));

  const handlePressLocation = useCallback(() => {
    onToggleDropdown();
  }, [onToggleDropdown]);

  const handleSelect = useCallback(
    (location: Location) => {
      onSelectLocation(location);
      onCloseDropdown();
    },
    [onCloseDropdown, onSelectLocation],
  );

  const sortedLocations = useMemo(
    () => [...locations].sort((a, b) => a.name.localeCompare(b.name)),
    [locations],
  );

  return (
    <View
      style={{
        zIndex: 10,
        paddingTop: ds.spacing(space[1] / 2),
        paddingBottom: ds.spacing(space[3]),
        // `position: relative` is required so the absolutely-positioned
        // dropdown overlay below anchors to THIS container, floating over
        // siblings (progress bar, station rail) instead of pushing them down.
        position: 'relative',
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        <View
          style={{
            flex: 1,
            marginRight: ds.spacing(space[2]),
            borderRadius: radius.pill,
            borderWidth: 1,
            borderColor: color.hairline,
            backgroundColor: color.card,
            overflow: 'hidden',
          }}
        >
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`Active location ${locationLabel}. Tap to change.`}
            accessibilityHint="Opens the location switcher"
            accessibilityState={{ expanded: isDropdownOpen }}
            onPress={handlePressLocation}
            disabled={locations.length === 0}
            activeOpacity={0.75}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              minHeight: ELLIPSIS_BUTTON_SIZE,
              paddingHorizontal: ds.spacing(space[4]),
            }}
          >
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: radius.pill,
                backgroundColor: color.accent,
                marginRight: ds.spacing(space[2] + 2),
              }}
            />
            <Text
              style={{
                flex: 1,
                fontSize: ds.fontSize(typeScale.body),
                fontWeight: weight.bold,
                color: color.ink,
                letterSpacing: tracking.title,
              }}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {locationLabel}
            </Text>
            <Animated.View style={[{ marginLeft: ds.spacing(space[2]) }, chevronStyle]}>
              <Ionicons
                name="chevron-down"
                size={ds.icon(18)}
                color={color.ink2}
              />
            </Animated.View>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={moreAccessibilityLabel}
          onPress={onPressMore}
          activeOpacity={0.7}
          hitSlop={8}
          style={{
            width: ELLIPSIS_BUTTON_SIZE,
            height: ELLIPSIS_BUTTON_SIZE,
            borderRadius: radius.pill,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: color.card,
            borderWidth: 1,
            borderColor: color.hairline,
          }}
        >
          <Ionicons
            name={moreIconName}
            size={ds.icon(18)}
            color={color.ink2}
          />
        </TouchableOpacity>
      </View>

      {/*
        Dropdown floats as an absolute overlay anchored to the bottom of the
        pill row. It sits over the progress bar / station rail when open,
        instead of pushing them down. Width matches the location pill (the
        ellipsis menu sits beyond the pill, so the menu visually aligns).
      */}
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          top: ds.spacing(space[1] / 2) + ELLIPSIS_BUTTON_SIZE + ds.spacing(space[1]),
          left: 0,
          right: ELLIPSIS_BUTTON_SIZE + ds.spacing(space[2]),
        }}
      >
        <LocationSwitcherDropdown
          isOpen={isDropdownOpen}
          locations={sortedLocations}
          selectedLocationId={selectedLocationId}
          onSelect={handleSelect}
          onRequestClose={onCloseDropdown}
        />
      </View>
    </View>
  );
});
