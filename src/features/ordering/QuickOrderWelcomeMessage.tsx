import React from "react";
import { LayoutChangeEvent, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  ZoomIn,
} from "react-native-reanimated";
import { useScaledStyles } from "@/hooks/useScaledStyles";
import { colors, glassColors, glassHairlineWidth } from "@/theme/design";
import {
  QUICK_ORDER_WELCOME_BODY_PARAGRAPHS,
  QUICK_ORDER_WELCOME_TITLE,
} from "./quickOrderWelcome";
import { radius, typeScale, weight } from '@/theme/tokens';

type QuickOrderWelcomeMessageProps = {
  onLayout?: (event: LayoutChangeEvent) => void;
};

export const QuickOrderWelcomeMessageCard = React.memo(
  function QuickOrderWelcomeMessageCard({
    onLayout,
  }: QuickOrderWelcomeMessageProps) {
    const ds = useScaledStyles();

    return (
      <Animated.View
        onLayout={onLayout}
        entering={ZoomIn.duration(180).easing(Easing.out(Easing.cubic))}
        style={[
          styles.card,
          {
            borderRadius: radius.card,
            padding: ds.spacing(14),
            marginTop: ds.spacing(10),
          },
        ]}
      >
        <Text style={[styles.title, { fontSize: ds.fontSize(typeScale.body) }]}>
          {QUICK_ORDER_WELCOME_TITLE}
        </Text>

        <View style={{ marginTop: ds.spacing(12), gap: ds.spacing(10) }}>
          {QUICK_ORDER_WELCOME_BODY_PARAGRAPHS.map((paragraph) => (
            <Text
              key={paragraph}
              style={[styles.body, { fontSize: ds.fontSize(typeScale.body) }]}
            >
              {paragraph}
            </Text>
          ))}
        </View>
      </Animated.View>
    );
  },
);

const styles = StyleSheet.create({
  card: {
    alignSelf: "flex-start",
    width: "94%",
    backgroundColor: colors.white,
    borderWidth: glassHairlineWidth,
    borderColor: glassColors.cardBorder,
    shadowColor: colors.textPrimary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
  },
  title: {
    color: colors.textPrimary,
    fontWeight: weight.bold,
    letterSpacing: 0,
  },
  body: {
    color: colors.textPrimary,
    fontWeight: weight.semibold,
    letterSpacing: 0,
    lineHeight: 22,
  },
});
