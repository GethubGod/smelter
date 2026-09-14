// Shared building blocks for the Team screens, composed from the UI contract
// primitives (docs/mockups/ui-contract/index.html).

import { useRef, type ReactNode } from 'react';
import { Animated, Easing, Platform, Pressable, Switch, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, ListRow, SectionLabel, Segment } from '@/components/ui';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { color, motion, radius, size, space, typeScale, weight } from '@/theme/tokens';
import type { InviteLocationGroup } from '@/services/invites';
import { LOCATION_GROUP_LABELS } from '../invitePreview';

/** The contract card. Rows carry their own padding, so it groups them flush. */
export function TeamCard({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <Card flush style={style}>
      {children}
    </Card>
  );
}

/** Uppercase section label ("WORKS AT · CHANGE ANYTIME"). */
export function TeamSectionLabel({ label }: { label: string }) {
  return <SectionLabel>{label}</SectionLabel>;
}

interface WorksAtSegmentedProps {
  value: InviteLocationGroup;
  onChange: (value: InviteLocationGroup) => void;
  disabled?: boolean;
}

const GROUPS: InviteLocationGroup[] = ['sushi', 'poki', 'both'];

const GROUP_OPTIONS = GROUPS.map((group) => ({
  value: group,
  label: LOCATION_GROUP_LABELS[group],
}));

/** Sushi / Poki & Pho / Both. The contract `Segment`. */
export function WorksAtSegmented({ value, onChange, disabled = false }: WorksAtSegmentedProps) {
  return (
    <Segment
      options={GROUP_OPTIONS}
      value={value}
      onChange={(next) => {
        if (disabled) return;
        onChange(next);
      }}
      accessibilityLabel="Works at"
      style={{ opacity: disabled ? 0.6 : 1 }}
    />
  );
}

interface ModuleToggleRowProps {
  label: string;
  tag?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  showBorder?: boolean;
}

/** Toggle row inside a TeamCard ("Ordering checklist  DEFAULT  [switch]"). */
export function ModuleToggleRow({
  label,
  tag,
  value,
  onChange,
  disabled = false,
  showBorder = true,
}: ModuleToggleRowProps) {
  const ds = useScaledStyles();
  const switchScale = ds.isLarge ? 1.15 : ds.isCompact ? 0.95 : 1;

  return (
    <ListRow
      title={label}
      subtitle={tag}
      disabled={disabled}
      last={!showBorder}
      right={
        <Switch
          value={value}
          disabled={disabled}
          onValueChange={onChange}
          accessibilityLabel={label}
          trackColor={{ false: color.well, true: color.accent }}
          thumbColor={Platform.OS === 'android' ? color.card : undefined}
          ios_backgroundColor={color.well}
          style={{ transform: [{ scaleX: switchScale }, { scaleY: switchScale }] }}
        />
      }
    />
  );
}

interface TeamRowProps {
  initial: string;
  title: string;
  subtitle: string;
  badge?: string;
  onPress: () => void;
  last?: boolean;
}

/**
 * Roster row: 38pt tint avatar, name, location/features summary, chevron.
 * TeamScreen groups these inside one flush card.
 */
export function TeamRow({ initial, title, subtitle, badge, onPress, last = false }: TeamRowProps) {
  const ds = useScaledStyles();
  const avatar = ds.icon(38);
  const pressed = useRef(new Animated.Value(0)).current;
  const animatePress = (toValue: number) => Animated.timing(pressed, {
    toValue,
    duration: 120,
    easing: Easing.bezier(...motion.controlEase),
    useNativeDriver: false,
  }).start();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${subtitle}${badge ? `, ${badge}` : ''}`}
      onPressIn={() => animatePress(1)}
      onPressOut={() => animatePress(0)}
      style={{ backgroundColor: color.card }}
    >
      <Animated.View
        style={{
          backgroundColor: pressed.interpolate({ inputRange: [0, 1], outputRange: [color.card, color.well] }),
          minHeight: ds.spacing(60),
          paddingHorizontal: ds.spacing(14),
          paddingVertical: ds.spacing(space[3] - 2),
          flexDirection: 'row',
          alignItems: 'center',
          gap: ds.spacing(space[3]),
        }}
      >
        <View
          style={{
            width: avatar,
            height: avatar,
            borderRadius: radius.pill,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: color.tint,
          }}
        >
          <Text
            style={{
              fontSize: ds.fontSize(typeScale.body),
              fontWeight: weight.bold,
              color: color.accent,
            }}
          >
            {initial}
          </Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: ds.spacing(space[2]) }}>
            <Text
              numberOfLines={1}
              style={{
                flexShrink: 1,
                fontSize: ds.fontSize(typeScale.body),
                fontWeight: weight.semibold,
                color: color.ink,
              }}
            >
              {title}
            </Text>
            {badge ? (
              <View
                style={{
                  paddingHorizontal: ds.spacing(space[2]),
                  paddingVertical: ds.spacing(space[1]),
                  borderRadius: radius.pill,
                  backgroundColor: color.well,
                }}
              >
                <Text
                  style={{
                    fontSize: ds.fontSize(typeScale.meta),
                    fontWeight: weight.semibold,
                    color: color.ink2,
                  }}
                >
                  {badge}
                </Text>
              </View>
            ) : null}
          </View>
          <Text
            numberOfLines={1}
            style={{ fontSize: ds.fontSize(typeScale.secondary), color: color.ink2 }}
          >
            {subtitle}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={ds.icon(size.icon)} color={color.ink3} />
        {!last ? (
          <View
            style={{
              position: 'absolute',
              left: ds.spacing(14),
              right: 0,
              bottom: 0,
              height: 1,
              backgroundColor: color.hairline,
            }}
          />
        ) : null}
      </Animated.View>
    </Pressable>
  );
}
