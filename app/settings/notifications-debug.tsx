import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuthStore, useSettingsStore } from '@/store';
import { getNotificationsModule } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import {
  SettingsGroup,
  SettingsScreenLayout,
  SettingsSectionLabel,
} from '@/components/settings';
import { Button, ListRow, Loading } from '@/components/ui';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { color as tokenColor, space, typeScale, weight } from '@/theme/tokens';

interface DebugInfo {
  permissionStatus: string;
  lastPushToken: string | null;
  dbTokenCount: number;
  scheduledCount: number;
  profileNotificationsEnabled: boolean | null;
  localPushEnabled: boolean;
}

export default function NotificationsDebugScreen() {
  if (!__DEV__) return <Redirect href="/settings/notifications" />;
  return <NotificationsDebugContent />;
}

function NotificationsDebugContent() {
  const ds = useScaledStyles();
  const { user, profile } = useAuthStore();
  const { notifications } = useSettingsStore();
  const [info, setInfo] = useState<DebugInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const Notifications = await getNotificationsModule();
      if (!Notifications) {
        setInfo({
          permissionStatus: 'unsupported',
          lastPushToken: null,
          dbTokenCount: 0,
          scheduledCount: 0,
          profileNotificationsEnabled: profile?.notifications_enabled ?? null,
          localPushEnabled: notifications.pushEnabled,
        });
        return;
      }

      const { status } = await Notifications.getPermissionsAsync();
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();

      let lastToken: string | null = null;
      let tokenCount = 0;

      if (user?.id) {
        const { data: tokens } = await (supabase as any)
          .from('device_push_tokens')
          .select('expo_push_token, active, updated_at')
          .eq('user_id', user.id)
          .eq('active', true)
          .order('updated_at', { ascending: false })
          .limit(5);

        tokenCount = tokens?.length ?? 0;
        lastToken = tokens?.[0]?.expo_push_token ?? null;
      }

      setInfo({
        permissionStatus: status,
        lastPushToken: lastToken,
        dbTokenCount: tokenCount,
        scheduledCount: scheduled.length,
        profileNotificationsEnabled: profile?.notifications_enabled ?? null,
        localPushEnabled: notifications.pushEnabled,
      });
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to load debug info');
    } finally {
      setLoading(false);
    }
  }, [notifications.pushEnabled, profile?.notifications_enabled, user?.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const sendTestNotification = async () => {
    try {
      const Notifications = await getNotificationsModule();
      if (!Notifications) {
        Alert.alert('Unavailable', 'Notifications are not supported on this platform.');
        return;
      }

      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Test Notification',
          body: `This is a test from Smelter at ${new Date().toLocaleTimeString()}`,
          data: { type: 'debug-test' },
          sound: true,
        },
        trigger: null,
      });
      Alert.alert('Sent', 'Test local notification sent.');
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to send test notification');
    }
  };

  const renderRow = (label: string, value: string | number | boolean | null, last = false) => {
    const display =
      value === null
        ? 'null'
        : typeof value === 'boolean'
          ? value
            ? 'true'
            : 'false'
          : String(value);
    // Status colours are reserved for state, and this diagnostic row is state.
    const valueColor =
      value === true || value === 'granted'
        ? tokenColor.good
        : value === false || value === 'denied'
          ? tokenColor.alert
          : tokenColor.ink;

    return (
      <ListRow
        key={label}
        title={label}
        last={last}
        right={
          <Text
            style={{
              maxWidth: '55%',
              fontSize: ds.fontSize(typeScale.secondary),
              color: valueColor,
              textAlign: 'right',
              fontWeight: weight.semibold,
            }}
            selectable
            numberOfLines={2}
          >
            {display}
          </Text>
        }
      />
    );
  };

  return (
    <SettingsScreenLayout
      title="Notifications debug"
      subtitle="Development-only notification state and token visibility."
    >
      <SettingsSectionLabel label="Diagnostics" />

      <SettingsGroup>
        {loading ? (
          <View style={{ paddingVertical: ds.spacing(space[5]) }}>
            <Loading size="inline" label="Loading debug info" style={{ alignItems: 'center' }} />
          </View>
        ) : info ? (
          <>
            {renderRow('OS permission', info.permissionStatus)}
            {renderRow('Local pushEnabled toggle', info.localPushEnabled)}
            {renderRow('DB notifications_enabled', info.profileNotificationsEnabled)}
            {renderRow('Active DB tokens', info.dbTokenCount)}
            {renderRow(
              'Last push token',
              info.lastPushToken ? `...${info.lastPushToken.slice(-20)}` : 'none',
            )}
            {renderRow('Scheduled notifications', info.scheduledCount)}
            {renderRow('Platform', Platform.OS, true)}
          </>
        ) : null}
      </SettingsGroup>

      <View
        style={{
          paddingHorizontal: ds.spacing(space[4]),
          paddingTop: ds.spacing(space[4]),
          gap: ds.spacing(space[3]),
        }}
      >
        <Button
          label="Send test local notification"
          onPress={() => void sendTestNotification()}
        />
        <Button
          variant="secondary"
          icon="refresh-outline"
          label="Refresh"
          onPress={() => {
            void refresh();
          }}
        />
      </View>
    </SettingsScreenLayout>
  );
}
