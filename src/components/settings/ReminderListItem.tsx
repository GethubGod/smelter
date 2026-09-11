import React from 'react';
import { View, Text, TouchableOpacity, Switch, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Reminder } from '@/types/settings';
import { Card } from '@/components/ui';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { color, radius, size, space, typeScale, weight } from '@/theme/tokens';

interface ReminderListItemProps {
  reminder: Reminder;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Memoized to prevent re-renders in list virtualization
function ReminderListItemInner({
  reminder,
  onToggle,
  onEdit,
  onDelete,
}: ReminderListItemProps) {
  const ds = useScaledStyles();
  const switchScale = ds.isLarge ? 1.15 : ds.isCompact ? 0.95 : 1;
  const control = Math.max(size.touchMin, ds.icon(size.touchMin));

  const formatTime = (time: string): string => {
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  const formatSchedule = (): string => {
    if (reminder.repeatType === 'daily') {
      return `Every day at ${formatTime(reminder.time)}`;
    }

    const days = reminder.selectedDays
      .sort((a, b) => a - b)
      .map((d) => DAY_LABELS[d])
      .join(', ');
    return `${days} at ${formatTime(reminder.time)}`;
  };

  return (
    <Card style={{ marginBottom: ds.spacing(space[3]) }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: ds.spacing(space[3]),
        }}
      >
        <View style={{ flex: 1 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: ds.spacing(space[2]),
              marginBottom: ds.spacing(space[1]),
            }}
          >
            <Ionicons
              name="notifications"
              size={ds.icon(18)}
              color={reminder.enabled ? color.accent : color.ink3}
            />
            <Text
              style={{
                flex: 1,
                fontSize: ds.fontSize(typeScale.body),
                fontWeight: weight.semibold,
                color: reminder.enabled ? color.ink : color.ink2,
              }}
            >
              {reminder.name}
            </Text>
          </View>
          <Text
            style={{
              fontSize: ds.fontSize(typeScale.secondary),
              marginBottom: ds.spacing(space[1]),
              color: color.ink2,
            }}
          >
            {formatSchedule()}
          </Text>
          <Text
            numberOfLines={1}
            style={{
              fontSize: ds.fontSize(typeScale.secondary),
              color: color.ink3,
              fontStyle: 'italic',
            }}
          >
            {'"'}
            {reminder.message}
            {'"'}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: ds.spacing(space[2]) }}>
          <TouchableOpacity
            onPress={onEdit}
            activeOpacity={0.82}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${reminder.name}`}
            style={{
              width: control,
              height: control,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: radius.pill,
              backgroundColor: color.well,
            }}
          >
            <Ionicons name="pencil" size={ds.icon(18)} color={color.ink2} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onDelete}
            activeOpacity={0.82}
            accessibilityRole="button"
            accessibilityLabel={`Delete ${reminder.name}`}
            style={{
              width: control,
              height: control,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: radius.pill,
              backgroundColor: color.alertBg,
            }}
          >
            <Ionicons name="trash-outline" size={ds.icon(18)} color={color.alert} />
          </TouchableOpacity>
          <Switch
            value={reminder.enabled}
            onValueChange={onToggle}
            accessibilityLabel={`${reminder.name} enabled`}
            trackColor={{ false: color.well, true: color.accent }}
            thumbColor={Platform.OS === 'android' ? color.card : undefined}
            ios_backgroundColor={color.well}
            style={{ transform: [{ scaleX: switchScale }, { scaleY: switchScale }] }}
          />
        </View>
      </View>
    </Card>
  );
}

export const ReminderListItem = React.memo(ReminderListItemInner);
