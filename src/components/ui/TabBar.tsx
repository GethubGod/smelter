import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  PanResponder,
  Text,
  TouchableOpacity,
  View,
  type LayoutChangeEvent,
  type PanResponderGestureState,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { color, motion, radius, shadow, typeScale, weight } from '@/theme/tokens';

export interface TabBarItem {
  /** Route name. Passed back to `onPress`. */
  name: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  badge?: number;
}

export interface TabBarQuickActions {
  onPress: () => void;
  accessibilityLabel?: string;
}

export interface TabBarProps {
  tabs: readonly TabBarItem[];
  /** Route name of the active tab. */
  active: string;
  onPress: (name: string) => void;
  /** Appends the divider and the dots button, as on the employee Order tab. */
  quickActions?: TabBarQuickActions;
  testID?: string;
}

export type TabBarClearanceMode = 'pinned' | 'order' | 'default';

/** Clearance a screen must reserve below its content for the dock. */
export function getTabBarClearance(
  _insetsBottom: number,
  mode: TabBarClearanceMode = 'default',
): number {
  if (mode === 'pinned') return 104;
  if (mode === 'order') return 190;
  return 120;
}

interface TabLayout {
  x: number;
  width: number;
}

interface DockTabProps {
  item: TabBarItem;
  selected: boolean;
  hovered: boolean;
  reduceMotion: boolean;
  onLayout: (event: LayoutChangeEvent) => void;
  onPress: () => void;
}

const DOCK_SIDE_INSET = 18;
const DOCK_BOTTOM_INSET = 12;
const DOCK_HEIGHT = 80;
const DOCK_PADDING = 6;
const MORE_WIDTH = 64;
const MORE_TAB_WIDTH = 54;
const INDICATOR_DURATION = 320;
const INDICATOR_TRACKING_DURATION = 380;
const MORE_DURATION = 340;
const LABEL_DURATION = 260;
const GLYPH_DURATION = 220;
const DRAG_THRESHOLD = 6;

const glideEasing = Easing.bezier(...motion.ease);
const indicatorEasing = Easing.out(Easing.cubic);

function DockTab({
  item,
  selected,
  hovered,
  reduceMotion,
  onLayout,
  onPress,
}: DockTabProps) {
  const labelProgress = useSharedValue(selected ? 1 : 0);
  const glyphProgress = useSharedValue(selected || hovered ? 1 : 0);
  const badge = item.badge && item.badge > 0 ? item.badge : undefined;

  useEffect(() => {
    labelProgress.value = withTiming(selected ? 1 : 0, {
      duration: reduceMotion ? 0 : LABEL_DURATION,
      easing: glideEasing,
    });
  }, [labelProgress, reduceMotion, selected]);

  useEffect(() => {
    glyphProgress.value = withTiming(selected || hovered ? 1 : 0, {
      duration: reduceMotion ? 0 : GLYPH_DURATION,
      easing: glideEasing,
    });
  }, [glyphProgress, hovered, reduceMotion, selected]);

  const labelStyle = useAnimatedStyle(() => ({
    maxHeight: 12 * labelProgress.value,
    marginTop: 3 * labelProgress.value,
    opacity: labelProgress.value,
  }));
  const inactiveGlyphStyle = useAnimatedStyle(() => ({
    opacity: 1 - glyphProgress.value,
  }));
  const activeGlyphStyle = useAnimatedStyle(() => ({
    opacity: glyphProgress.value,
  }));

  return (
    <TouchableOpacity
      onLayout={onLayout}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="tab"
      accessibilityLabel={
        badge === undefined ? item.label : `${item.label}, ${badge} waiting`
      }
      accessibilityState={{ selected }}
      style={{
        flex: 1,
        minWidth: 0,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius.pill,
      }}
    >
      <View style={{ width: 24, height: 24 }} pointerEvents="none">
        <Animated.View
          style={[
            { position: 'absolute', left: 0, top: 0 },
            inactiveGlyphStyle,
          ]}
        >
          <Ionicons name={item.icon} size={24} color={color.dockFg} />
        </Animated.View>
        <Animated.View
          style={[
            { position: 'absolute', left: 0, top: 0 },
            activeGlyphStyle,
          ]}
        >
          <Ionicons name={item.icon} size={24} color={color.onAccent} />
        </Animated.View>
      </View>

      <Animated.View
        pointerEvents="none"
        style={[{ overflow: 'hidden' }, labelStyle]}
      >
        <Text
          numberOfLines={1}
          style={{
            color: color.onAccent,
            fontSize: typeScale.caption,
            fontWeight: weight.semibold,
            lineHeight: 12,
          }}
        >
          {item.label}
        </Text>
      </Animated.View>

      {badge === undefined ? null : (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 14,
            left: '50%',
            marginLeft: 6,
            minWidth: 18,
            height: 18,
            paddingHorizontal: 5,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: radius.pill,
            backgroundColor: color.onAccent,
          }}
        >
          <Text
            numberOfLines={1}
            style={{
              color: color.accent,
              fontSize: typeScale.caption,
              fontWeight: weight.bold,
              lineHeight: 13,
            }}
          >
            {badge}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

/**
 * The Studio dock shared by employee and manager roots. The navigator adapter
 * supplies routes and owns navigation. This component owns the measured
 * indicator, More segment, drag selection and visual contract.
 */
export function TabBar({ tabs, active, onPress, quickActions, testID }: TabBarProps) {
  const ds = useScaledStyles();
  const tabLayoutsRef = useRef(new Map<string, TabLayout>());
  const tabsWidthRef = useRef(0);
  const indicatorReadyRef = useRef(false);
  const draggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const trackingUntilRef = useRef(0);
  const trackingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);

  const indicatorStartX = useSharedValue(0);
  const indicatorStartWidth = useSharedValue(0);
  const indicatorTargetX = useSharedValue(0);
  const indicatorTargetWidth = useSharedValue(0);
  const indicatorProgress = useSharedValue(1);
  const moreWidth = useSharedValue(0);
  const hasQuickActions = quickActions !== undefined;

  const stopTrackingTimer = useCallback(() => {
    if (trackingTimerRef.current) {
      clearTimeout(trackingTimerRef.current);
      trackingTimerRef.current = null;
    }
  }, []);

  const currentIndicatorLayout = useCallback((): TabLayout => {
    const progress = indicatorProgress.value;
    return {
      x:
        indicatorStartX.value +
        (indicatorTargetX.value - indicatorStartX.value) * progress,
      width:
        indicatorStartWidth.value +
        (indicatorTargetWidth.value - indicatorStartWidth.value) * progress,
    };
  }, [
    indicatorProgress,
    indicatorStartWidth,
    indicatorStartX,
    indicatorTargetWidth,
    indicatorTargetX,
  ]);

  const setIndicatorDirect = useCallback(
    (layout: TabLayout) => {
      cancelAnimation(indicatorProgress);
      indicatorStartX.value = layout.x;
      indicatorStartWidth.value = layout.width;
      indicatorTargetX.value = layout.x;
      indicatorTargetWidth.value = layout.width;
      indicatorProgress.value = 1;
      indicatorReadyRef.current = true;
    },
    [
      indicatorProgress,
      indicatorStartWidth,
      indicatorStartX,
      indicatorTargetWidth,
      indicatorTargetX,
    ],
  );

  const beginIndicatorTransition = useCallback(
    (layout: TabLayout) => {
      if (!indicatorReadyRef.current || ds.reduceMotion) {
        setIndicatorDirect(layout);
        return;
      }

      const current = currentIndicatorLayout();
      cancelAnimation(indicatorProgress);
      indicatorStartX.value = current.x;
      indicatorStartWidth.value = current.width;
      indicatorTargetX.value = layout.x;
      indicatorTargetWidth.value = layout.width;
      indicatorProgress.value = 0;
      indicatorProgress.value = withTiming(1, {
        duration: INDICATOR_DURATION,
        easing: indicatorEasing,
      });
    },
    [
      currentIndicatorLayout,
      ds.reduceMotion,
      indicatorProgress,
      indicatorStartWidth,
      indicatorStartX,
      indicatorTargetWidth,
      indicatorTargetX,
      setIndicatorDirect,
    ],
  );

  const targetActiveIndicator = useCallback(
    (animate: boolean) => {
      const layout = tabLayoutsRef.current.get(active);
      if (!layout || draggingRef.current) return;
      if (animate) beginIndicatorTransition(layout);
      else setIndicatorDirect(layout);
    },
    [active, beginIndicatorTransition, setIndicatorDirect],
  );

  useEffect(() => {
    moreWidth.value = withTiming(hasQuickActions ? MORE_WIDTH : 0, {
      duration: ds.reduceMotion ? 0 : MORE_DURATION,
      easing: glideEasing,
    });
  }, [ds.reduceMotion, hasQuickActions, moreWidth]);

  useLayoutEffect(() => {
    trackingUntilRef.current = Date.now() + INDICATOR_TRACKING_DURATION;
    stopTrackingTimer();
    targetActiveIndicator(indicatorReadyRef.current);
    trackingTimerRef.current = setTimeout(() => {
      trackingTimerRef.current = null;
      targetActiveIndicator(false);
    }, ds.reduceMotion ? 0 : INDICATOR_TRACKING_DURATION);

    return stopTrackingTimer;
  }, [active, ds.reduceMotion, hasQuickActions, stopTrackingTimer, targetActiveIndicator]);

  const handleTabLayout = useCallback(
    (name: string, event: LayoutChangeEvent) => {
      const { x, width } = event.nativeEvent.layout;
      const layout = { x, width };
      tabLayoutsRef.current.set(name, layout);
      if (name === active && !draggingRef.current) {
        if (!indicatorReadyRef.current) {
          setIndicatorDirect(layout);
        } else if (Date.now() <= trackingUntilRef.current) {
          // The fixed-start progress keeps moving while the measured target
          // follows the tabs as the More segment changes their widths.
          indicatorTargetX.value = layout.x;
          indicatorTargetWidth.value = layout.width;
        } else {
          setIndicatorDirect(layout);
        }
      }
    },
    [active, indicatorTargetWidth, indicatorTargetX, setIndicatorDirect],
  );

  const tabAtIndicatorCenter = useCallback(() => {
    const indicator = currentIndicatorLayout();
    const center = indicator.x + indicator.width / 2;
    return tabs.find((tab) => {
      const layout = tabLayoutsRef.current.get(tab.name);
      return layout && center >= layout.x && center < layout.x + layout.width;
    })?.name ?? null;
  }, [currentIndicatorLayout, tabs]);

  const handleDragMove = useCallback(
    (gestureState: PanResponderGestureState) => {
      const indicator = currentIndicatorLayout();
      const maximum = Math.max(0, tabsWidthRef.current - indicator.width);
      const nextX = Math.max(
        0,
        Math.min(maximum, dragStartXRef.current + gestureState.dx),
      );
      indicatorStartX.value = nextX;
      indicatorTargetX.value = nextX;
      setHoveredTab(tabAtIndicatorCenter());
    },
    [
      currentIndicatorLayout,
      indicatorStartX,
      indicatorTargetX,
      tabAtIndicatorCenter,
    ],
  );

  const finishDrag = useCallback(() => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    const hit = tabAtIndicatorCenter();
    setHoveredTab(null);

    const target = hit ? tabLayoutsRef.current.get(hit) : undefined;
    trackingUntilRef.current = Date.now() + INDICATOR_TRACKING_DURATION;
    if (target) beginIndicatorTransition(target);
    else targetActiveIndicator(true);

    if (hit && hit !== active) onPress(hit);
  }, [active, beginIndicatorTransition, onPress, tabAtIndicatorCenter, targetActiveIndicator]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_, gestureState) =>
          Math.abs(gestureState.dx) > DRAG_THRESHOLD,
        onPanResponderGrant: () => {
          stopTrackingTimer();
          draggingRef.current = true;
          const indicator = currentIndicatorLayout();
          setIndicatorDirect(indicator);
          dragStartXRef.current = indicator.x;
        },
        onPanResponderMove: (_, gestureState) => handleDragMove(gestureState),
        onPanResponderRelease: finishDrag,
        onPanResponderTerminate: finishDrag,
        onPanResponderTerminationRequest: () => false,
      }),
    [
      currentIndicatorLayout,
      finishDrag,
      handleDragMove,
      setIndicatorDirect,
      stopTrackingTimer,
    ],
  );

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX:
          indicatorStartX.value +
          (indicatorTargetX.value - indicatorStartX.value) * indicatorProgress.value,
      },
    ],
    width:
      indicatorStartWidth.value +
      (indicatorTargetWidth.value - indicatorStartWidth.value) * indicatorProgress.value,
  }));
  const moreStyle = useAnimatedStyle(() => ({ width: moreWidth.value }));

  return (
    <View
      pointerEvents="box-none"
      testID={testID}
      style={{
        position: 'absolute',
        left: DOCK_SIDE_INSET,
        right: DOCK_SIDE_INSET,
        bottom: DOCK_BOTTOM_INSET,
        height: DOCK_HEIGHT,
      }}
    >
      <View
        accessibilityRole="tablist"
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'stretch',
          padding: DOCK_PADDING,
          borderRadius: radius.pill,
          backgroundColor: color.dockBg,
          ...shadow.tabBar,
        }}
      >
        <View
          {...panResponder.panHandlers}
          testID={testID ? `${testID}-tabs` : undefined}
          onLayout={(event) => {
            tabsWidthRef.current = event.nativeEvent.layout.width;
          }}
          style={{ flex: 1, flexDirection: 'row', position: 'relative' }}
        >
          <Animated.View
            pointerEvents="none"
            testID={testID ? `${testID}-indicator` : undefined}
            style={[
              {
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: 0,
                borderRadius: radius.pill,
                backgroundColor: color.accent,
              },
              indicatorStyle,
            ]}
          />

          {tabs.map((tab) => (
            <DockTab
              key={tab.name}
              item={tab}
              selected={tab.name === active}
              hovered={tab.name === hoveredTab}
              reduceMotion={ds.reduceMotion}
              onLayout={(event) => handleTabLayout(tab.name, event)}
              onPress={() => onPress(tab.name)}
            />
          ))}
        </View>

        <Animated.View
          testID={testID ? `${testID}-more` : undefined}
          style={[
            {
              flexDirection: 'row',
              alignItems: 'stretch',
              flexShrink: 0,
              overflow: 'hidden',
            },
            moreStyle,
          ]}
        >
          <View
            pointerEvents="none"
            style={{
              width: 1,
              marginVertical: 14,
              marginHorizontal: 4,
              backgroundColor: color.dockDivider,
            }}
          />
          <TouchableOpacity
            onPress={quickActions?.onPress}
            disabled={!quickActions}
            activeOpacity={0.8}
            accessibilityRole={quickActions ? 'button' : undefined}
            accessibilityLabel={
              quickActions
                ? quickActions.accessibilityLabel ?? 'Quick actions'
                : undefined
            }
            style={{
              width: MORE_TAB_WIDTH,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: radius.pill,
            }}
          >
            <Ionicons name="ellipsis-horizontal" size={24} color={color.dockFg} />
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}
