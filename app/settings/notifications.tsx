import React, { useEffect } from 'react';
import { View, Text, Alert, Linking } from 'react-native';
import { router } from 'expo-router';
import { Button, Card, SectionLabel } from '@/components/ui';
import { useAuthStore, useSettingsStore } from '@/store';
import {
  SettingToggle,
  SettingsGroup,
  SettingsScreenLayout,
  SettingsSectionLabel,
  TimePickerRow,
} from '@/components/settings';
import {
  deactivatePushTokensForUser,
  registerCurrentDevicePushToken,
  requestNotificationPermissions,
  syncNotificationPreference,
} from '@/services/notificationService';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { buildSettingsHref, buildSettingsPath } from '@/lib/settingsNavigation';
import { useSettingsNavigationContext } from '@/hooks/useSettingsBackRoute';
import { color, space, typeScale } from '@/theme/tokens';


function NotificationsSection() {
  const ds = useScaledStyles();
  const { user, profile, setProfile } = useAuthStore();
  const { notifications, setNotificationSettings, setQuietHours } = useSettingsStore();
  const isManager = (user?.role ?? profile?.role) === 'manager';

  useEffect(() => {
    if (typeof profile?.notifications_enabled !== 'boolean') return;
    if (notifications.pushEnabled !== profile.notifications_enabled) {
      setNotificationSettings({ pushEnabled: profile.notifications_enabled });
    }
  }, [notifications.pushEnabled, profile?.notifications_enabled, setNotificationSettings]);

  const handlePushToggle = async (enabled: boolean) => {
    const userId = user?.id;
    if (enabled) {
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
        return;
      }
    }

    const previousValue = notifications.pushEnabled;
    setNotificationSettings({ pushEnabled: enabled });
    if (profile) {
      setProfile({ ...profile, notifications_enabled: enabled });
    }

    if (!userId) return;

    try {
      await syncNotificationPreference(userId, enabled);
      if (enabled) {
        await registerCurrentDevicePushToken(userId);
      } else {
        await deactivatePushTokensForUser(userId);
      }
    } catch (error: any) {
      setNotificationSettings({ pushEnabled: previousValue });
      if (profile) {
        setProfile({ ...profile, notifications_enabled: previousValue });
      }
      Alert.alert(
        'Sync Failed',
        error?.message || 'Unable to save notification preference. Please try again.'
      );
    }
  };

  return (
    <View>
      <SettingToggle
        icon="notifications"
        title="Push notifications"
        subtitle="Receive alerts on your device"
        value={notifications.pushEnabled}
        onValueChange={handlePushToggle}
        showBorder={notifications.pushEnabled}
      />

      {notifications.pushEnabled && (
        <>
          <SectionLabel>Notification types</SectionLabel>

          <SettingToggle
            title="Order status updates"
            subtitle="When your orders are fulfilled"
            value={notifications.orderStatus}
            onValueChange={(v) => setNotificationSettings({ orderStatus: v })}
          />

          {isManager && (
            <SettingToggle
              title="New orders"
              subtitle="When employees submit orders"
              value={notifications.newOrders}
              onValueChange={(v) => setNotificationSettings({ newOrders: v })}
            />
          )}

          <SettingToggle
            title="Daily summary"
            subtitle="End of day order summary"
            value={notifications.dailySummary}
            onValueChange={(v) => setNotificationSettings({ dailySummary: v })}
            showBorder={false}
          />

          <SectionLabel>Sound and vibration</SectionLabel>

          <SettingToggle
            title="Sound"
            subtitle="Play sound for notifications"
            value={notifications.soundEnabled}
            onValueChange={(v) => setNotificationSettings({ soundEnabled: v })}
          />

          <SettingToggle
            title="Vibration"
            subtitle="Vibrate for notifications"
            value={notifications.vibrationEnabled}
            onValueChange={(v) => setNotificationSettings({ vibrationEnabled: v })}
            showBorder={false}
          />

          <SectionLabel>Quiet hours</SectionLabel>

          <SettingToggle
            title="Quiet hours"
            subtitle="Silence notifications during set times"
            value={notifications.quietHours.enabled}
            onValueChange={(v) => setQuietHours({ enabled: v })}
            showBorder={notifications.quietHours.enabled}
          />

          {notifications.quietHours.enabled && (
            <View style={{ paddingVertical: ds.spacing(space[3]) }}>
              <Card flush style={{ paddingHorizontal: ds.spacing(space[3] + 2) }}>
                <TimePickerRow
                  title="Start"
                  value={notifications.quietHours.startTime}
                  onTimeChange={(t) => setQuietHours({ startTime: t })}
                />
                <TimePickerRow
                  title="End"
                  value={notifications.quietHours.endTime}
                  onTimeChange={(t) => setQuietHours({ endTime: t })}
                />
              </Card>
              <Text
                style={{
                  fontSize: ds.fontSize(typeScale.secondary),
                  marginTop: ds.spacing(space[2]),
                  color: color.ink2,
                }}
              >
                Notifications are silenced during these hours.
              </Text>
            </View>
          )}
        </>
      )}
    </View>
  );
}

export default function NotificationsSettingsScreen() {
  const ds = useScaledStyles();
  const { origin, backTo } = useSettingsNavigationContext();
  return (
    <SettingsScreenLayout title="Notifications">
      <SettingsSectionLabel label="Delivery" />
      <SettingsGroup>
        <NotificationsSection />
      </SettingsGroup>

      {__DEV__ && (
        <View style={{ paddingHorizontal: ds.spacing(space[4]), paddingTop: ds.spacing(space[4]) }}>
          <Button
            variant="secondary"
            icon="bug-outline"
            label="Notifications debug (DEV)"
            onPress={() =>
              router.push(
                buildSettingsHref('/settings/notifications-debug', {
                  origin,
                  backTo: buildSettingsPath('/settings/notifications', {
                    origin,
                    backTo,
                  }),
                }),
              )
            }
          />
        </View>
      )}
    </SettingsScreenLayout>
  );
}
