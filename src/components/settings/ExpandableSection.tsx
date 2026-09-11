import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDisplayStore } from '@/store';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { Card } from '@/components/ui';
import { color, radius, size, space, tracking, typeScale, weight } from '@/theme/tokens';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface ExpandableSectionProps {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  /**
   * @deprecated The contract has one icon tile. Accepted so callers outside
   * this sweep keep compiling; ignored.
   */
  iconColor?: string;
  /** @deprecated See `iconColor`. */
  iconBgColor?: string;
}

export function ExpandableSection({
  title,
  icon,
  children,
  defaultExpanded = false,
}: ExpandableSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const reduceMotion = useDisplayStore((state) => state.reduceMotion);
  const ds = useScaledStyles();
  const tile = ds.icon(32);

  const toggle = () => {
    if (!reduceMotion) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setIsExpanded(!isExpanded);
  };

  return (
    <Card
      flush
      style={{
        marginHorizontal: ds.spacing(space[4]),
        marginBottom: ds.spacing(space[4]),
        paddingHorizontal: ds.spacing(space[4]),
        overflow: 'hidden',
      }}
    >
      <TouchableOpacity
        onPress={toggle}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ expanded: isExpanded }}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: ds.spacing(space[3]),
          minHeight: ds.spacing(size.touchMin),
          paddingVertical: ds.spacing(space[3]),
        }}
      >
        <View
          style={{
            width: tile,
            height: tile,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: radius.control,
            backgroundColor: color.well,
          }}
        >
          <Ionicons name={icon} size={ds.icon(16)} color={color.ink2} />
        </View>
        <Text
          style={{
            flex: 1,
            fontSize: ds.fontSize(typeScale.title),
            fontWeight: weight.bold,
            letterSpacing: tracking.title,
            color: color.ink,
          }}
        >
          {title}
        </Text>
        <Ionicons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={ds.icon(18)}
          color={color.ink3}
        />
      </TouchableOpacity>

      {isExpanded ? (
        <View style={{ borderTopWidth: 1, borderTopColor: color.hairline }}>{children}</View>
      ) : null}
    </Card>
  );
}
