import React, { useState, useEffect } from 'react';
import { View, Text, Alert, ScrollView, useWindowDimensions } from 'react-native';
import { Button, Card, Chip, Input, SectionLabel, Segment, Sheet } from '@/components/ui';
import { Reminder, RepeatType } from '@/types/settings';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { color, space, typeScale } from '@/theme/tokens';
import { TimePickerRow } from './TimePickerRow';

interface ReminderModalProps {
  visible: boolean;
  onClose: () => void;
  reminder?: Reminder | null;
  onSave: (reminder: Omit<Reminder, 'id' | 'createdAt'>) => void;
}

const DAY_FULL_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const REPEAT_OPTIONS: { value: RepeatType; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'custom', label: 'Custom' },
];

export function ReminderModal({
  visible,
  onClose,
  reminder,
  onSave,
}: ReminderModalProps) {
  const ds = useScaledStyles();
  const { height: windowHeight } = useWindowDimensions();

  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [repeatType, setRepeatType] = useState<RepeatType>('daily');
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]); // Mon-Fri
  const [time, setTime] = useState('14:00');

  const isEditing = !!reminder;

  useEffect(() => {
    if (reminder) {
      setName(reminder.name);
      setMessage(reminder.message);
      setRepeatType(reminder.repeatType);
      setSelectedDays(reminder.selectedDays);
      setTime(reminder.time);
    } else {
      // Reset to defaults for new reminder
      setName('');
      setMessage('');
      setRepeatType('daily');
      setSelectedDays([1, 2, 3, 4, 5]);
      setTime('14:00');
    }
  }, [reminder, visible]);

  const handleClose = () => {
    onClose();
  };

  const toggleDay = (day: number) => {
    if (selectedDays.includes(day)) {
      // Don't allow removing all days
      if (selectedDays.length > 1) {
        setSelectedDays(selectedDays.filter((d) => d !== day));
      }
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  const handleRepeatTypeChange = (type: RepeatType) => {
    setRepeatType(type);
    // Reset days when switching to daily
    if (type === 'daily') {
      setSelectedDays([0, 1, 2, 3, 4, 5, 6]);
    }
  };

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a reminder name');
      return;
    }

    if (!message.trim()) {
      Alert.alert('Error', 'Please enter a reminder message');
      return;
    }

    onSave({
      name: name.trim(),
      message: message.trim(),
      enabled: reminder?.enabled ?? true,
      repeatType,
      selectedDays: repeatType === 'daily' ? [0, 1, 2, 3, 4, 5, 6] : selectedDays,
      time,
    });

    handleClose();
  };

  return (
    <Sheet
      visible={visible}
      title={isEditing ? 'Edit reminder' : 'New reminder'}
      onClose={handleClose}
    >
      <ScrollView
        style={{ maxHeight: windowHeight * 0.55 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View>
          <SectionLabel>Reminder name</SectionLabel>
          <Input
            value={name}
            onChangeText={setName}
            placeholder="e.g., Daily Order Reminder"
            accessibilityLabel="Reminder name"
          />
        </View>

        <View>
          <SectionLabel>Message</SectionLabel>
          <Input
            value={message}
            onChangeText={setMessage}
            placeholder="e.g., Time to submit your inventory order!"
            accessibilityLabel="Reminder message"
            multiline
          />
        </View>

        <View>
          <SectionLabel>Repeat</SectionLabel>
          <Segment
            options={REPEAT_OPTIONS}
            value={repeatType}
            onChange={handleRepeatTypeChange}
            accessibilityLabel="Repeat"
          />
        </View>

        {repeatType !== 'daily' ? (
          <View>
            <SectionLabel>Days</SectionLabel>
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: ds.spacing(space[2]),
              }}
            >
              {DAY_FULL_LABELS.map((label, index) => (
                <Chip
                  key={label}
                  label={label}
                  selected={selectedDays.includes(index)}
                  onPress={() => toggleDay(index)}
                />
              ))}
            </View>
            <Text
              style={{
                marginTop: ds.spacing(space[2]),
                fontSize: ds.fontSize(typeScale.secondary),
                color: color.ink3,
              }}
            >
              Selected: {[...selectedDays]
                .sort((a, b) => a - b)
                .map((d) => DAY_FULL_LABELS[d])
                .join(', ')}
            </Text>
          </View>
        ) : null}

        <View>
          <SectionLabel>Time</SectionLabel>
          <Card>
            <TimePickerRow title="Reminder time" value={time} onTimeChange={setTime} />
          </Card>
        </View>
      </ScrollView>

      <Button
        variant="primary"
        label={isEditing ? 'Save Changes' : 'Add Reminder'}
        onPress={handleSave}
      />
      <Button
        variant="secondary"
        label="Cancel"
        accessibilityHint="Closes the reminder editor without saving"
        onPress={handleClose}
      />
    </Sheet>
  );
}
