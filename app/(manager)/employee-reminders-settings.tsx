import React, { useCallback, useState } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants';
import { ManagerScaleContainer } from '@/components/ManagerScaleContainer';
import { useManagedRefresh } from '@/hooks/useManagedRefresh';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import {
  ReminderSystemSettings,
  getReminderSystemSettings,
  updateReminderSystemSettings,
} from '@/services';
import { color, radius, typeScale } from '@/theme/tokens';

export default function EmployeeReminderSettingsScreen() {
  const ds = useScaledStyles();

  const [settings, setSettings] = useState<ReminderSystemSettings | null>(null);
  const [overdueDays, setOverdueDays] = useState('7');
  const [rateLimitMinutes, setRateLimitMinutes] = useState('15');
  const [recurringWindowMinutes, setRecurringWindowMinutes] = useState('15');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadSettings = useCallback(async () => {
    try {
      const row = await getReminderSystemSettings();
      setSettings(row);
      if (row) {
        setOverdueDays(String(row.overdue_threshold_days));
        setRateLimitMinutes(String(row.reminder_rate_limit_minutes));
        setRecurringWindowMinutes(String(row.recurring_window_minutes));
      }
    } catch (error: any) {
      Alert.alert('Unable to load settings', error?.message || 'Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSettings();
    }, [loadSettings])
  );

  const { refreshing, onRefresh: handleRefresh } = useManagedRefresh(loadSettings);

  const handleSave = async () => {
    if (!settings?.id) {
      Alert.alert('Missing settings row', 'Run migrations and reload settings.');
      return;
    }

    const overdue = Math.max(1, Math.min(60, Number.parseInt(overdueDays, 10) || 7));
    const rateLimit = Math.max(1, Math.min(240, Number.parseInt(rateLimitMinutes, 10) || 15));
    const recurringWindow = Math.max(1, Math.min(120, Number.parseInt(recurringWindowMinutes, 10) || 15));

    setIsSaving(true);
    try {
      const updated = await updateReminderSystemSettings({
        overdue_threshold_days: overdue,
        reminder_rate_limit_minutes: rateLimit,
        recurring_window_minutes: recurringWindow,
      });
      setSettings(updated);
      setOverdueDays(String(updated.overdue_threshold_days));
      setRateLimitMinutes(String(updated.reminder_rate_limit_minutes));
      setRecurringWindowMinutes(String(updated.recurring_window_minutes));
      Alert.alert('Saved', 'Reminder settings updated.');
    } catch (error: any) {
      Alert.alert('Unable to save settings', error?.message || 'Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const NumericField = ({
    label,
    value,
    onChange,
    helpText,
  }: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    helpText: string;
  }) => (
    <View className="border" style={{ backgroundColor: color.card, borderColor: color.hairline, borderRadius: radius.card, padding: ds.spacing(14), marginBottom: ds.spacing(10) }}>
      <Text className="font-semibold" style={{ color: color.ink, fontSize: ds.fontSize(typeScale.body) }}>{label}</Text>
      <Text style={{ color: color.ink2, fontSize: ds.fontSize(typeScale.secondary), marginTop: ds.spacing(4), marginBottom: ds.spacing(10) }}>
        {helpText}
      </Text>
      <TextInput
        value={value}
        onChangeText={(text) => onChange(text.replace(/[^0-9]/g, ''))}
        keyboardType="number-pad"
        className="border"
        style={{ backgroundColor: color.page, borderColor: color.hairlineStrong, borderRadius: radius.control, color: color.ink, minHeight: Math.max(46, ds.buttonH - ds.spacing(4)), paddingHorizontal: ds.spacing(12), fontSize: ds.fontSize(typeScale.body) }}
      />
    </View>
  );

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: color.page }} edges={['top', 'left', 'right']}>
      <ManagerScaleContainer>
        <View className="border-b flex-row items-center" style={{ backgroundColor: color.card, borderColor: color.hairline, paddingHorizontal: ds.spacing(16), paddingVertical: ds.spacing(12) }}>
          <TouchableOpacity
            onPress={() => router.replace('/(manager)/employee-reminders')}
            style={{ padding: ds.spacing(8), marginRight: ds.spacing(8), minWidth: 44, minHeight: 44, justifyContent: 'center' }}
          >
            <Ionicons name="arrow-back" size={ds.icon(20)} color={colors.gray[700]} />
          </TouchableOpacity>
          <View>
            <Text className="font-bold" style={{ color: color.ink, fontSize: ds.fontSize(typeScale.title) }}>Reminder Settings</Text>
            <Text style={{ color: color.ink2, fontSize: ds.fontSize(typeScale.secondary), marginTop: ds.spacing(2) }}>
              Configure overdue and reminder limits
            </Text>
          </View>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: ds.spacing(16), paddingBottom: ds.spacing(28) }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary[500]} />}
        >
          {isLoading ? (
            <View className="items-center" style={{ paddingVertical: ds.spacing(40) }}>
              <Text style={{ color: color.ink2, fontSize: ds.fontSize(typeScale.body) }}>
                Loading settings...
              </Text>
            </View>
          ) : (
            <>
              <NumericField
                label="Overdue Threshold (days)"
                value={overdueDays}
                onChange={setOverdueDays}
                helpText="Employee is marked overdue when no order is placed for this many days."
              />
              <NumericField
                label="Manual Reminder Rate Limit (minutes)"
                value={rateLimitMinutes}
                onChange={setRateLimitMinutes}
                helpText="Prevents reminder spam. Managers can still override when needed."
              />
              <NumericField
                label="Recurring Evaluation Window (minutes)"
                value={recurringWindowMinutes}
                onChange={setRecurringWindowMinutes}
                helpText="How long after scheduled time a recurring rule is considered due."
              />

              <View style={{ backgroundColor: color.well, borderRadius: radius.control, padding: ds.spacing(12), marginTop: ds.spacing(8) }}>
                <Text style={{ color: color.ink2, fontSize: ds.fontSize(typeScale.secondary) }}>
                  These settings apply globally to all manager reminder workflows.
                </Text>
              </View>
            </>
          )}
        </ScrollView>

        <View className="border-t" style={{ backgroundColor: color.card, borderColor: color.hairline, paddingHorizontal: ds.spacing(16), paddingVertical: ds.spacing(12) }}>
          <TouchableOpacity
            className={isSaving ? 'bg-orange-300 rounded-xl items-center justify-center' : 'bg-primary-500 rounded-xl items-center justify-center'}
            style={{ minHeight: Math.max(48, ds.buttonH) }}
            onPress={handleSave}
            disabled={isSaving || isLoading}
          >
            <Text className="font-semibold" style={{ color: color.onAccent, fontSize: ds.fontSize(typeScale.body) }}>
              {isSaving ? 'Saving...' : 'Save Settings'}
            </Text>
          </TouchableOpacity>
        </View>
      </ManagerScaleContainer>
    </SafeAreaView>
  );
}
