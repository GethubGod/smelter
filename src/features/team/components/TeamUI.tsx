// Shared building blocks for the Team screens, composed from the UI contract
// primitives (docs/mockups/ui-contract/index.html).

import type { ReactNode } from 'react';
import { Platform, Switch, Text, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, ListRow, SectionLabel, Segment } from '@/components/ui';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { color, radius, size, space, typeScale, weight } from '@/theme/tokens';
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
  onPress: () => void;
  muted?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
}

/**
 * Roster row: avatar initial (or icon), name, summary, chevron.
 *
 * `ListRow` takes an icon name, not an avatar, so the left tile is built from
 * tokens here. Pending invites keep the muted well fill, which `Card` (white
 * only) cannot carry.
 */
export function TeamRow({ initial, title, subtitle, onPress, muted = false, icon }: TeamRowProps) {
  const ds = useScaledStyles();
  const avatar = Math.max(size.touchMin, ds.icon(36));

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.82}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${subtitle}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: ds.spacing(space[3]),
        backgroundColor: muted ? color.well : color.card,
        borderWidth: 1,
        borderColor: muted ? color.well : color.hairline,
        borderRadius: radius.card,
        paddingHorizontal: ds.spacing(space[3] + 2),
        paddingVertical: ds.spacing(space[3]),
        marginBottom: ds.spacing(space[2]),
      }}
    >
      <View
        style={{
          width: avatar,
          height: avatar,
          borderRadius: radius.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: muted ? color.card : color.tint,
        }}
      >
        {icon ? (
          <Ionicons name={icon} size={ds.icon(size.icon)} color={color.ink2} />
        ) : (
          <Text
            style={{
              fontSize: ds.fontSize(typeScale.body),
              fontWeight: weight.bold,
              color: color.accent,
            }}
          >
            {initial}
          </Text>
        )}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          numberOfLines={1}
          style={{
            fontSize: ds.fontSize(typeScale.body),
            fontWeight: weight.semibold,
            color: color.ink,
          }}
        >
          {title}
        </Text>
        <Text
          numberOfLines={1}
          style={{ fontSize: ds.fontSize(typeScale.secondary), color: color.ink2 }}
        >
          {subtitle}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={ds.icon(size.icon)} color={color.ink3} />
    </TouchableOpacity>
  );
}
