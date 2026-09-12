import React from 'react';
import { Text, View } from 'react-native';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { radius, space, statusTone, tracking, typeScale, weight, type StatusTone } from '@/theme/tokens';

export type { StatusTone };

export interface StatusPillProps {
  status: StatusTone;
  /** Overrides the default word, for example "1 ready" on a supplier card. */
  label?: string;
  /** Tags can omit the status dot when the text and tone fully name the state. */
  showDot?: boolean;
  testID?: string;
}

/**
 * The only place status colours appear in the app.
 *
 * Usually a dot plus a word, never colour alone, so the state survives
 * greyscale and colour blindness. Named header tags can omit the redundant dot.
 */
export function StatusPill({ status, label, showDot = true, testID }: StatusPillProps) {
  const ds = useScaledStyles();
  const tone = statusTone[status];
  const text = label ?? tone.label;
  const dot = Math.max(4, ds.icon(6));

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`Status: ${text}`}
      testID={testID}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: ds.spacing(space[1] + 1),
        paddingHorizontal: ds.spacing(space[2] + 1),
        paddingVertical: ds.spacing(space[1] - 1),
        borderRadius: radius.pill,
        backgroundColor: tone.background,
      }}
    >
      {showDot ? (
        <View
          style={{
            width: dot,
            height: dot,
            borderRadius: radius.pill,
            backgroundColor: tone.text,
          }}
        />
      ) : null}
      <Text
        numberOfLines={1}
        style={{
          fontSize: ds.fontSize(typeScale.caption),
          fontWeight: weight.bold,
          letterSpacing: tracking.caption,
          color: tone.text,
        }}
      >
        {text}
      </Text>
    </View>
  );
}
