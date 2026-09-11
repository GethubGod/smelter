import React, { useState } from 'react';
import { View, Text, Platform } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { ListRow, Sheet } from '@/components/ui';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { color, space, typeScale, weight } from '@/theme/tokens';

interface TimePickerRowProps {
  title: string;
  value: string; // "HH:MM" format
  onTimeChange: (time: string) => void;
  disabled?: boolean;
}

export function TimePickerRow({
  title,
  value,
  onTimeChange,
  disabled = false,
}: TimePickerRowProps) {
  const [showPicker, setShowPicker] = useState(false);
  const ds = useScaledStyles();

  // Parse "HH:MM" string to Date
  const parseTime = (timeString: string): Date => {
    const [hours, minutes] = timeString.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
  };

  // Format Date to "HH:MM" string
  const formatTime = (date: Date): string => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  // Format for display (12-hour with AM/PM)
  const formatDisplayTime = (timeString: string): string => {
    const [hours, minutes] = timeString.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  const handlePress = () => {
    if (disabled) return;
    setShowPicker(true);
  };

  const handleChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowPicker(false);
    }
    if (event.type === 'set' && selectedDate) {
      onTimeChange(formatTime(selectedDate));
    }
  };

  return (
    <View>
      <ListRow
        title={title}
        onPress={handlePress}
        disabled={disabled}
        last
        right={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: ds.spacing(space[2]) }}>
            <Text
              style={{
                fontSize: ds.fontSize(typeScale.body),
                fontWeight: weight.semibold,
                color: color.ink,
              }}
            >
              {formatDisplayTime(value)}
            </Text>
            <Ionicons name="time-outline" size={ds.icon(18)} color={color.ink2} />
          </View>
        }
      />

      {/* iOS: the contract sheet hosts the spinner. */}
      {Platform.OS === 'ios' && showPicker ? (
        <Sheet
          visible={showPicker}
          title={title}
          onClose={() => setShowPicker(false)}
          primary={{ label: 'Done', onPress: () => setShowPicker(false) }}
        >
          <DateTimePicker
            value={parseTime(value)}
            mode="time"
            display="spinner"
            onChange={handleChange}
            style={{ height: Math.max(200, ds.spacing(200)) }}
          />
        </Sheet>
      ) : null}

      {/* Android keeps its platform dialog. */}
      {Platform.OS === 'android' && showPicker ? (
        <DateTimePicker
          value={parseTime(value)}
          mode="time"
          display="default"
          onChange={handleChange}
        />
      ) : null}
    </View>
  );
}
