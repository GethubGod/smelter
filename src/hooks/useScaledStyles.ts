import { useCallback, useMemo } from 'react';
import { PixelRatio } from 'react-native';
import { useShallow } from 'zustand/react/shallow';
import { computeScaledFontSize, useDisplayStore } from '@/store/displayStore';

export function useScaledStyles() {
  const {
    scaledSpacing,
    scaledRadius,
    iconSize,
    buttonH,
    buttonFont,
    buttonPadH,
    cardPad,
    rowH,
    textScale,
    uiScale,
    reduceMotion,
    theme,
  } = useDisplayStore(
    useShallow((store) => ({
      scaledSpacing: store.scaledSpacing,
      scaledRadius: store.scaledRadius,
      iconSize: store.iconSize,
      buttonH: store.buttonHeight(),
      buttonFont: store.buttonFontSize(),
      buttonPadH: store.buttonPaddingH(),
      cardPad: store.cardPadding(),
      rowH: store.itemRowHeight(),
      textScale: store.textScale,
      uiScale: store.uiScale,
      reduceMotion: store.reduceMotion,
      theme: store.theme,
    })),
  );
  const systemFontScale = PixelRatio.getFontScale();
  const fontSize = useCallback(
    (basePx: number) => computeScaledFontSize(basePx, textScale, uiScale),
    // PixelRatio is not observable. This invalidates memoized styles on the next render,
    // while computeScaledFontSize still reads the current value at call time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [systemFontScale, textScale, uiScale],
  );

  return useMemo(
    () => ({
      // Scaling functions
      fontSize,
      spacing: scaledSpacing,
      radius: scaledRadius,
      icon: iconSize,

      // Button values
      buttonH,
      buttonFont,
      buttonPadH,

      // Layout values
      cardPad,
      rowH,

      // Raw values for direct access
      textScale,
      isLarge: uiScale === 'large',
      isCompact: uiScale === 'compact',
      reduceMotion,
      theme,
    }),
    [
      buttonFont,
      buttonH,
      buttonPadH,
      cardPad,
      fontSize,
      iconSize,
      reduceMotion,
      scaledRadius,
      scaledSpacing,
      rowH,
      textScale,
      theme,
      uiScale,
    ],
  );
}
