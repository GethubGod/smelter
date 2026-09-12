import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { color, motion, radius, shadow, size, space } from '@/theme/tokens';

interface BottomSheetShellProps {
  visible: boolean;
  /** Use inside an existing native Modal instead of presenting a second one. */
  presentation?: 'modal' | 'embedded';
  onClose: () => void;
  children?: React.ReactNode;
  /** Content above the scrolling body. Dragging this area moves the sheet. */
  header?: React.ReactNode;
  /** Content pinned below the scrolling body. */
  footer?: React.ReactNode;
  /** Gives the body its own scroll container and enables drag from its top edge. */
  scrollable?: boolean;
  /** Allows an upward drag to expand the sheet to 88% of the screen height. */
  expandable?: boolean;
  horizontalPadding?: number;
  bottomPadding?: number;
  /**
   * Scrim tap and drag-to-dismiss. Set false while the sheet holds unsaved
   * input so a graze on the backdrop cannot discard it; the sheet's own
   * Cancel action stays the way out.
   */
  dismissible?: boolean;
}

const SHEET_HEIGHT_RATIO = 0.88;
const OFFSCREEN_RATIO = 1.05;
const SHEET_DURATION_MS = 320;
const SCRIM_DURATION_MS = 240;
const DRAG_START_DISTANCE = 6;
const DISMISS_DISTANCE = 90;
const DISMISS_VELOCITY = 0.9;
const EXPAND_DISTANCE = 60;
const EXPAND_DRAG_RATIO = 0.55;
const RESISTED_DRAG_RATIO = 0.18;

export function BottomSheetShell({
  visible,
  presentation = 'modal',
  onClose,
  children,
  header,
  footer,
  scrollable = false,
  expandable = false,
  horizontalPadding,
  bottomPadding,
  dismissible = true,
}: BottomSheetShellProps) {
  const ds = useScaledStyles();
  const { height: windowHeight } = useWindowDimensions();
  const maxSheetHeight = windowHeight * SHEET_HEIGHT_RATIO;
  const initialOffscreenY = maxSheetHeight * OFFSCREEN_RATIO;
  const duration = ds.reduceMotion ? 0 : SHEET_DURATION_MS;
  const scrimDuration = ds.reduceMotion ? 0 : SCRIM_DURATION_MS;
  const easing = useMemo(() => Easing.bezier(...motion.ease), []);

  const translateY = useRef(new Animated.Value(initialOffscreenY)).current;
  const scrimOpacity = useRef(new Animated.Value(0)).current;
  const animatedHeight = useRef(new Animated.Value(0)).current;
  const bodyScrollY = useRef(0);
  const compactHeight = useRef(0);
  const sheetHeight = useRef(0);
  const expanded = useRef(false);
  const opened = useRef(false);
  const closing = useRef(false);
  const openFrame = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);
  const visibilityAnimation = useRef<Animated.CompositeAnimation | null>(null);
  const [rendered, setRendered] = useState(visible);
  const [usesAnimatedHeight, setUsesAnimatedHeight] = useState(false);

  const stopVisibilityAnimation = useCallback(() => {
    if (openFrame.current !== null) {
      cancelAnimationFrame(openFrame.current);
      openFrame.current = null;
    }
    visibilityAnimation.current?.stop();
    visibilityAnimation.current = null;
  }, []);

  const animateOpen = useCallback(
    (fromMeasuredEdge: boolean) => {
      stopVisibilityAnimation();
      closing.current = false;
      if (fromMeasuredEdge) {
        const measuredOffscreenY = (sheetHeight.current || maxSheetHeight) * OFFSCREEN_RATIO;
        translateY.setValue(measuredOffscreenY);
        scrimOpacity.setValue(0);
      }
      const animation = Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration,
          easing,
          useNativeDriver: true,
        }),
        Animated.timing(scrimOpacity, {
          toValue: 1,
          duration: scrimDuration,
          easing,
          useNativeDriver: true,
        }),
      ]);
      visibilityAnimation.current = animation;
      animation.start(({ finished }) => {
        if (finished) visibilityAnimation.current = null;
      });
    },
    [duration, easing, maxSheetHeight, scrimDuration, scrimOpacity, stopVisibilityAnimation, translateY],
  );

  const scheduleOpen = useCallback(
    (fromMeasuredEdge: boolean) => {
      stopVisibilityAnimation();
      openFrame.current = requestAnimationFrame(() => {
        openFrame.current = null;
        animateOpen(fromMeasuredEdge);
      });
    },
    [animateOpen, stopVisibilityAnimation],
  );

  const animateToRest = useCallback(
    (after?: () => void) => {
      Animated.timing(translateY, {
        toValue: 0,
        duration,
        easing,
        useNativeDriver: true,
      }).start(after);
    },
    [duration, easing, translateY],
  );

  const animateClose = useCallback(
    (notify: boolean) => {
      if (closing.current) return;
      stopVisibilityAnimation();
      closing.current = true;
      const measuredOffscreenY = (sheetHeight.current || maxSheetHeight) * OFFSCREEN_RATIO;
      const animation = Animated.parallel([
        Animated.timing(translateY, {
          toValue: measuredOffscreenY,
          duration,
          easing,
          useNativeDriver: true,
        }),
        Animated.timing(scrimOpacity, {
          toValue: 0,
          duration: scrimDuration,
          easing,
          useNativeDriver: true,
        }),
      ]);
      visibilityAnimation.current = animation;
      animation.start(({ finished }) => {
        if (!finished) return;
        visibilityAnimation.current = null;
        closing.current = false;
        opened.current = false;
        expanded.current = false;
        setUsesAnimatedHeight(false);
        setRendered(false);
        if (notify) onClose();
      });
    },
    [duration, easing, maxSheetHeight, onClose, scrimDuration, scrimOpacity, stopVisibilityAnimation, translateY],
  );

  const expandSheet = useCallback(() => {
    if (!expandable || expanded.current) {
      animateToRest();
      return;
    }
    const startHeight = compactHeight.current;
    if (startHeight <= 0) {
      expanded.current = true;
      setUsesAnimatedHeight(true);
      animatedHeight.setValue(maxSheetHeight);
      animateToRest();
      return;
    }
    expanded.current = true;
    animatedHeight.setValue(startHeight);
    setUsesAnimatedHeight(true);
    Animated.parallel([
      Animated.timing(animatedHeight, {
        toValue: maxSheetHeight,
        duration,
        easing,
        useNativeDriver: false,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration,
        easing,
        useNativeDriver: true,
      }),
    ]).start();
  }, [animateToRest, animatedHeight, duration, easing, expandable, maxSheetHeight, translateY]);

  const collapseSheet = useCallback(() => {
    const targetHeight = compactHeight.current;
    if (targetHeight <= 0) {
      expanded.current = false;
      setUsesAnimatedHeight(false);
      animateToRest();
      return;
    }
    Animated.parallel([
      Animated.timing(animatedHeight, {
        toValue: targetHeight,
        duration,
        easing,
        useNativeDriver: false,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration,
        easing,
        useNativeDriver: true,
      }),
    ]).start(() => {
      expanded.current = false;
      setUsesAnimatedHeight(false);
    });
  }, [animateToRest, animatedHeight, duration, easing, translateY]);

  const finishDrag = useCallback(
    (distance: number, velocity: number) => {
      const crossedCloseThreshold =
        distance > ds.spacing(DISMISS_DISTANCE) || velocity > DISMISS_VELOCITY;
      if (crossedCloseThreshold) {
        if (expanded.current) {
          collapseSheet();
        } else {
          animateClose(true);
        }
        return;
      }
      if (
        distance < -ds.spacing(EXPAND_DISTANCE) &&
        expandable &&
        !expanded.current
      ) {
        expandSheet();
        return;
      }
      animateToRest();
    },
    [animateClose, animateToRest, collapseSheet, ds, expandSheet, expandable],
  );

  const createPanResponder = useCallback(
    (body: boolean) =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          dismissible &&
          (!body || bodyScrollY.current <= 0) &&
          Math.abs(gestureState.dy) > ds.spacing(DRAG_START_DISTANCE) &&
          Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
        onPanResponderMove: (_, gestureState) => {
          const distance = gestureState.dy;
          const multiplier =
            distance >= 0
              ? 1
              : expandable && !expanded.current
                ? EXPAND_DRAG_RATIO
                : RESISTED_DRAG_RATIO;
          translateY.setValue(distance * multiplier);
        },
        onPanResponderRelease: (_, gestureState) => {
          finishDrag(gestureState.dy, gestureState.vy);
        },
        onPanResponderTerminate: () => animateToRest(),
      }),
    [animateToRest, dismissible, ds, expandable, finishDrag, translateY],
  );

  const chromePanResponder = useMemo(
    () => createPanResponder(false),
    [createPanResponder],
  );
  const bodyPanResponder = useMemo(
    () => createPanResponder(true),
    [createPanResponder],
  );

  useEffect(() => {
    if (visible) {
      const interruptedClose = closing.current;
      closing.current = false;
      if (!rendered) {
        opened.current = false;
        expanded.current = false;
        bodyScrollY.current = 0;
        setUsesAnimatedHeight(false);
        setRendered(true);
      } else if (interruptedClose && opened.current) {
        animateOpen(false);
      }
      return;
    }
    if (rendered) animateClose(false);
  }, [animateClose, animateOpen, rendered, visible]);

  useEffect(
    () => () => {
      stopVisibilityAnimation();
    },
    [stopVisibilityAnimation],
  );

  useEffect(() => {
    if (expanded.current) animatedHeight.setValue(maxSheetHeight);
  }, [animatedHeight, maxSheetHeight]);

  const handleSheetLayout = useCallback(
    (event: LayoutChangeEvent) => {
      sheetHeight.current = event.nativeEvent.layout.height;
      if (!usesAnimatedHeight && !expanded.current) {
        compactHeight.current = event.nativeEvent.layout.height;
      }
      if (visible && !opened.current && !closing.current) {
        opened.current = true;
        scheduleOpen(true);
      }
    },
    [scheduleOpen, usesAnimatedHeight, visible],
  );

  const handleBodyScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    bodyScrollY.current = Math.max(0, event.nativeEvent.contentOffset.y);
  }, []);

  if (!rendered) return null;

  const sidePadding = horizontalPadding ?? ds.spacing(space[5]);
  const body = scrollable ? (
    <ScrollView
      style={{ flexShrink: 1, flexGrow: usesAnimatedHeight ? 1 : 0 }}
      contentContainerStyle={{
        paddingTop: ds.spacing(space[1]),
        paddingHorizontal: sidePadding,
        paddingBottom: ds.spacing(space[2]),
      }}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      showsVerticalScrollIndicator={false}
      bounces={false}
      scrollEventThrottle={16}
      onScroll={handleBodyScroll}
      {...bodyPanResponder.panHandlers}
    >
      {children}
    </ScrollView>
  ) : (
    <View
      style={{
        paddingTop: ds.spacing(space[1]),
        paddingHorizontal: sidePadding,
        paddingBottom: bottomPadding ?? ds.spacing(space[3]),
      }}
    >
      {children}
    </View>
  );

  const content = (
    <View style={{ flex: 1, justifyContent: 'flex-end' }}>
      <Animated.View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          opacity: scrimOpacity,
          backgroundColor: color.scrim,
        }}
      >
        <Pressable
          accessible={false}
          style={{ flex: 1 }}
          onPress={dismissible ? () => animateClose(true) : undefined}
        />
      </Animated.View>

      <Animated.View
        accessibilityViewIsModal
        onLayout={handleSheetLayout}
        style={[
          {
            maxHeight: maxSheetHeight,
            backgroundColor: color.sheetBg,
            borderTopLeftRadius: radius.sheet,
            borderTopRightRadius: radius.sheet,
            transform: [{ translateY }],
            overflow: 'hidden',
          },
          shadow.sheet,
          usesAnimatedHeight ? { height: animatedHeight } : null,
        ]}
      >
        <View {...chromePanResponder.panHandlers}>
          <View
            accessible={false}
            style={{
              alignItems: 'center',
              paddingTop: ds.spacing(10),
              paddingBottom: ds.spacing(space[1]),
            }}
          >
            <View
              style={{
                width: ds.spacing(size.sheetHandleWidth),
                height: ds.spacing(size.sheetHandleHeight),
                borderRadius: radius.pill,
                backgroundColor: color.sheetHandle,
              }}
            />
          </View>
          {header}
        </View>
        {body}
        {footer}
      </Animated.View>
    </View>
  );

  if (presentation === 'embedded') return content;

  return (
    <Modal
      visible
      transparent
      animationType="none"
      onRequestClose={dismissible ? () => animateClose(true) : () => undefined}
    >
      {content}
    </Modal>
  );
}
