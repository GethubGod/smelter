import React, { useState } from 'react';
import { View, Alert, Linking } from 'react-native';
import { Button, Card, EmptyState, SectionLabel } from '@/components/ui';
import { useSettingsStore } from '@/store';
import { Reminder } from '@/types/settings';
import {
  ReminderListItem,
  ReminderModal,
  SettingToggle,
  SettingsGroup,
  SettingsScreenLayout,
  SettingsSectionLabel,
  TimePickerRow,
} from '@/components/settings';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { space } from '@/theme/tokens';

import {
  requestNotificationPermissions,
  scheduleReminder,
  cancelReminder,
  scheduleNoOrderTodayReminder,
  scheduleBeforeClosingReminder,
} from '@/services/notificationService';

function RemindersSection({
  onAddReminder,
  onEditReminder,
}: {
  onAddReminder: () => void;
  onEditReminder: (reminder: Reminder) => void;
}) {
  const ds = useScaledStyles();
  const {
    reminders,
    setReminderSettings,
    toggleReminder,
    deleteReminder,
  } = useSettingsStore();

  const ensureNotificationPermissions = async () => {
    const granted = await requestNotificationPermissions();
    if (!granted) {
      Alert.alert(
        'Permission Required',
        'Please enable notifications in your device settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
      return false;
    }
    return true;
  };

  const handleReminderMasterToggle = async (enabled: boolean) => {
    setReminderSettings({ enabled });

    if (!enabled) {
      await scheduleNoOrderTodayReminder(false);
      await scheduleBeforeClosingReminder(false, reminders.closingTime);
      return;
    }

    const permitted = await ensureNotificationPermissions();
    if (!permitted) return;

    if (reminders.noOrderTodayReminder) {
      await scheduleNoOrderTodayReminder(true);
    }
    if (reminders.beforeClosingReminder) {
      await scheduleBeforeClosingReminder(true, reminders.closingTime);
    }
  };

  const handleNoOrderTodayToggle = async (enabled: boolean) => {
    if (enabled) {
      const permitted = await ensureNotificationPermissions();
      if (!permitted) return;
    }
    setReminderSettings({ noOrderTodayReminder: enabled });
    await scheduleNoOrderTodayReminder(enabled);
  };

  const handleBeforeClosingToggle = async (enabled: boolean) => {
    if (enabled) {
      const permitted = await ensureNotificationPermissions();
      if (!permitted) return;
    }
    setReminderSettings({ beforeClosingReminder: enabled });
    await scheduleBeforeClosingReminder(enabled, reminders.closingTime);
  };

  const handleClosingTimeChange = async (time: string) => {
    setReminderSettings({ closingTime: time });
    if (reminders.beforeClosingReminder) {
      const permitted = await ensureNotificationPermissions();
      if (!permitted) return;
      await scheduleBeforeClosingReminder(true, time);
    }
  };

  const handleDeleteReminder = (reminder: Reminder) => {
    Alert.alert('Delete Reminder', `Delete "${reminder.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await cancelReminder(reminder.id);
          deleteReminder(reminder.id);
        },
      },
    ]);
  };

  const handleToggleReminder = async (id: string) => {
    toggleReminder(id);
    const reminder = reminders.reminders.find((r) => r.id === id);
    if (reminder) {
      if (!reminder.enabled) {
        await scheduleReminder({ ...reminder, enabled: true });
      } else {
        await cancelReminder(id);
      }
    }
  };

  return (
    <View>
      <SettingToggle
        icon="alarm"
        title="Reminders"
        subtitle="Get reminded to place orders"
        value={reminders.enabled}
        onValueChange={handleReminderMasterToggle}
        showBorder={reminders.enabled}
      />

      {reminders.enabled && (
        <>
          <SectionLabel>Quick reminders</SectionLabel>

          <SettingToggle
            title="No order today"
            subtitle="Remind at 3 PM if no order placed"
            value={reminders.noOrderTodayReminder}
            onValueChange={handleNoOrderTodayToggle}
          />

          <SettingToggle
            title="Before closing"
            subtitle="30 minutes before store closes"
            value={reminders.beforeClosingReminder}
            onValueChange={handleBeforeClosingToggle}
            showBorder={false}
          />

          {reminders.beforeClosingReminder && (
            <View style={{ paddingBottom: ds.spacing(space[3]) }}>
              <Card flush style={{ paddingHorizontal: ds.spacing(space[3] + 2) }}>
                <TimePickerRow
                  title="Closing time"
                  value={reminders.closingTime}
                  onTimeChange={handleClosingTimeChange}
                />
              </Card>
            </View>
          )}

          <SectionLabel>Custom reminders</SectionLabel>

          {reminders.reminders.length === 0 ? (
            <EmptyState
              icon="alarm-outline"
              title="No custom reminders yet"
              body="Add one to be reminded at a time that suits the shift."
              compact
            />
          ) : (
            reminders.reminders.map((reminder) => (
              <ReminderListItem
                key={reminder.id}
                reminder={reminder}
                onToggle={() => handleToggleReminder(reminder.id)}
                onEdit={() => onEditReminder(reminder)}
                onDelete={() => handleDeleteReminder(reminder)}
              />
            ))
          )}

          <Button
            variant="secondary"
            icon="add"
            label="Add reminder"
            onPress={onAddReminder}
            style={{ marginVertical: ds.spacing(space[3]) }}
          />
        </>
      )}
    </View>
  );
}

export default function RemindersSettingsScreen() {
  const { addReminder, updateReminder } = useSettingsStore();
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);

  const handleSaveReminder = async (reminderData: Omit<Reminder, 'id' | 'createdAt'>) => {
    if (editingReminder) {
      updateReminder(editingReminder.id, reminderData);
      if (reminderData.enabled) {
        await scheduleReminder({
          ...reminderData,
          id: editingReminder.id,
          createdAt: editingReminder.createdAt,
        });
      } else {
        await cancelReminder(editingReminder.id);
      }
    } else {
      addReminder(reminderData);
    }
    setEditingReminder(null);
  };

  return (
    <SettingsScreenLayout title="Reminders">
      <SettingsSectionLabel label="Control panel" />
      <SettingsGroup>
        <RemindersSection
          onAddReminder={() => {
            setEditingReminder(null);
            setShowReminderModal(true);
          }}
          onEditReminder={(reminder) => {
            setEditingReminder(reminder);
            setShowReminderModal(true);
          }}
        />
      </SettingsGroup>

      <ReminderModal
        visible={showReminderModal}
        reminder={editingReminder}
        onClose={() => {
          setShowReminderModal(false);
          setEditingReminder(null);
        }}
        onSave={handleSaveReminder}
      />
    </SettingsScreenLayout>
  );
}
