import React, { memo, useCallback, useMemo, useRef } from 'react';
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { triggerSelectionHaptic } from '@/lib/haptics';
import { Chip } from '@/components/ui';
import { color, radius, size, space } from '@/theme/tokens';

export interface StorageAreaFilterOption {
  id: string;
  label: string;
  badgeCount: number;
}

interface StorageAreaFilterBarProps {
  options: StorageAreaFilterOption[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onPressMore: () => void;
}

interface FilterPillProps extends StorageAreaFilterOption {
  isSelected: boolean;
  onSelect: (id: string) => void;
}

const MORE_BUTTON_SIZE = size.headerCircle;

const FilterPill = memo(function FilterPill({
  id,
  label,
  badgeCount,
  isSelected,
  onSelect,
}: FilterPillProps) {
  const handlePress = useCallback(() => {
    void triggerSelectionHaptic();
    onSelect(id);
  }, [id, onSelect]);

  return (
    <Chip
      label={label}
      selected={isSelected}
      count={badgeCount > 0 ? badgeCount : undefined}
      onPress={handlePress}
    />
  );
});

interface MoreButtonProps {
  onPress: () => void;
}

const MoreButton = memo(function MoreButton({ onPress }: MoreButtonProps) {
  const ds = useScaledStyles();
  const handlePress = useCallback(() => {
    void triggerSelectionHaptic();
    onPress();
  }, [onPress]);
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel="Show all stations"
      accessibilityHint="Opens a list of every storage area"
      onPress={handlePress}
      activeOpacity={0.85}
      style={{
        width: MORE_BUTTON_SIZE,
        height: MORE_BUTTON_SIZE,
        borderRadius: radius.pill,
        backgroundColor: color.card,
        borderWidth: 1,
        borderColor: color.hairlineStrong,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons
        name="chevron-down"
        size={ds.icon(18)}
        color={color.ink}
      />
    </TouchableOpacity>
  );
});

/**
 * StorageAreaFilterBar
 *
 * Layout: a horizontally scrolling rail of station pills with two affordances
 * pinned beside the rail to make overflow obvious to the user:
 *
 *   • A right-edge `LinearGradient` fades the trailing pill into the
 *     background, so the user can tell more content lives off-screen even at
 *     a glance, without scrolling.
 *   • A sticky "More" button (chevron-down) sits next to the rail and opens
 *     the full station list in a bottom sheet — the discovery escape hatch.
 *
 * The fade is hidden when the user has scrolled to the end of the content,
 * mirroring the pattern used by iOS App Store category lists.
 */
export const StorageAreaFilterBar = memo(function StorageAreaFilterBar({
  options,
  selectedId,
  onSelect,
  onPressMore,
}: StorageAreaFilterBarProps) {
  const ds = useScaledStyles();
  const scrollRef = useRef<ScrollView | null>(null);
  const fadeRef = useRef<View | null>(null);
  const lastFadeOpacityRef = useRef(1);

  // Imperative opacity update on the fade view avoids re-rendering the entire
  // pill rail on every onScroll tick — vital when the list is wide.
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      const distanceFromEnd =
        contentSize.width - (contentOffset.x + layoutMeasurement.width);
      const nextOpacity = Math.max(0, Math.min(1, distanceFromEnd / 24));
      if (Math.abs(nextOpacity - lastFadeOpacityRef.current) < 0.05) {
        return;
      }
      lastFadeOpacityRef.current = nextOpacity;
      fadeRef.current?.setNativeProps({
        style: { opacity: nextOpacity },
      });
    },
    [],
  );

  // The rail fades into the page token at the right edge. `transparent` is a
  // keyword, not a colour literal, so the ramp needs no off-contract value.
  const fadeColors = useMemo(() => ['transparent', color.page], []);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <View style={{ flex: 1, position: 'relative' }}>
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onScroll={handleScroll}
          scrollEventThrottle={32}
          contentContainerStyle={{
            gap: ds.spacing(space[2]),
            paddingVertical: ds.spacing(space[1] / 2),
            paddingRight: ds.spacing(space[6] + 4),
          }}
        >
          {options.map((opt) => (
            <FilterPill
              key={opt.id}
              id={opt.id}
              label={opt.label}
              badgeCount={opt.badgeCount}
              isSelected={opt.id === selectedId}
              onSelect={onSelect}
            />
          ))}
        </ScrollView>

        <View
          ref={fadeRef}
          pointerEvents="none"
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            width: 36,
          }}
        >
          <LinearGradient
            colors={fadeColors as unknown as [string, string, ...string[]]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={{ flex: 1 }}
          />
        </View>
      </View>

      <View style={{ marginLeft: ds.spacing(space[2]) }}>
        <MoreButton onPress={onPressMore} />
      </View>
    </View>
  );
});
