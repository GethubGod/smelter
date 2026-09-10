import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { RealtimeChannel } from '@supabase/supabase-js';
import { colors } from '@/constants';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store';
import { useManagedRefresh } from '@/hooks/useManagedRefresh';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { ManagerScaleContainer } from '@/components/ManagerScaleContainer';
import {
  EmployeeReminderOverview,
  EmployeeReminderStatusRow,
  ReminderServiceError,
  listEmployeesWithReminderStatus,
  sendReminder,
} from '@/services';
import { color, radius, typeScale, weight } from '@/theme/tokens';

type SortMode = 'overdue' | 'name' | 'location' | 'active_first';

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: 'overdue', label: 'Most overdue' },
  { value: 'name', label: 'Name A-Z' },
  { value: 'location', label: 'Location' },
  { value: 'active_first', label: 'Active reminder first' },
];

const DEFAULT_REMINDER_OVERVIEW: EmployeeReminderOverview = {
  employees: [],
  stats: {
    pendingReminders: 0,
    overdueEmployees: 0,
    notificationsOff: 0,
  },
  settings: {
    overdueThresholdDays: 7,
    reminderRateLimitMinutes: 15,
    recurringWindowMinutes: 15,
  },
  generatedAt: '',
};

function formatLastOrderLabel(row: EmployeeReminderStatusRow): string {
  if (!row.lastOrderAt) return 'Last order: Never';

  const now = Date.now();
  const lastOrderTs = new Date(row.lastOrderAt).getTime();
  if (Number.isNaN(lastOrderTs)) return 'Last order: Unknown';

  const delta = now - lastOrderTs;
  const minutes = Math.floor(delta / (1000 * 60));
  const hours = Math.floor(delta / (1000 * 60 * 60));
  const days = Math.floor(delta / (1000 * 60 * 60 * 24));

  if (minutes < 1) return 'Last order: just now';
  if (minutes < 60) return `Last order: ${minutes}m ago`;
  if (hours < 24) return `Last order: ${hours}h ago`;
  return `Last order: ${days}d ago`;
}

function statusConfig(status: EmployeeReminderStatusRow['status']) {
  if (status === 'reminder_active') {
    return {
      label: 'Reminder Active',
      bg: colors.primary[50],
      text: colors.primary[700],
    };
  }

  if (status === 'overdue') {
    return {
      label: 'Overdue',
      bg: colors.errorBg,
      text: colors.error,
    };
  }

  return {
    label: 'OK',
    bg: colors.successBg,
    text: colors.success,
  };
}

export default function EmployeeRemindersScreen() {
  const ds = useScaledStyles();
  const { locations, fetchLocations } = useAuthStore();

  const [overview, setOverview] = useState<EmployeeReminderOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadErrorMessage, setLoadErrorMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('overdue');
  const [isSendingUserId, setIsSendingUserId] = useState<string | null>(null);

  const [showLocationMenu, setShowLocationMenu] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const realtimeChannelRef = useRef<RealtimeChannel | null>(null);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadOverview = useCallback(async () => {
    try {
      const data = await listEmployeesWithReminderStatus({
        locationId: selectedLocationId,
      });
      setOverview(data);
      setLoadErrorMessage(null);
    } catch (error: any) {
      // Keep page usable in dev/prod when reminders functions are not deployed yet.
      setLoadErrorMessage(error?.message || 'Reminder service is temporarily unavailable.');
      setOverview((previous) => previous ?? {
        ...DEFAULT_REMINDER_OVERVIEW,
        generatedAt: new Date().toISOString(),
      });
    } finally {
      setIsLoading(false);
    }
  }, [selectedLocationId]);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  useFocusEffect(
    useCallback(() => {
      loadOverview();
    }, [loadOverview])
  );

  useEffect(() => {
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
      realtimeChannelRef.current = null;
    }

    const scheduleRefresh = () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      refreshTimeoutRef.current = setTimeout(() => {
        loadOverview();
      }, 250);
    };

    const channel = supabase
      .channel(`employee-reminders-sync-${selectedLocationId ?? 'all'}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reminders' },
        scheduleRefresh
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reminder_events' },
        scheduleRefresh
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        scheduleRefresh
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        scheduleRefresh
      )
      .subscribe();

    realtimeChannelRef.current = channel;

    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
      }
    };
  }, [loadOverview, selectedLocationId]);

  const { refreshing, onRefresh: handleRefresh } = useManagedRefresh(loadOverview);

  const executeReminder = useCallback(
    async (row: EmployeeReminderStatusRow, overrideRateLimit = false) => {
      setIsSendingUserId(row.userId);
      try {
        await sendReminder({
          employeeId: row.userId,
          locationId: selectedLocationId ?? row.locationId,
          overrideRateLimit,
          source: row.activeReminder ? 'manual_repeat' : 'manual',
          channels: {
            push: row.notificationsEnabled,
            in_app: true,
          },
        });

        Alert.alert(
          'Reminder sent',
          row.activeReminder
            ? `Reminder sent again to ${row.name}.`
            : `Reminder sent to ${row.name}.`
        );

        await loadOverview();
      } catch (error: any) {
        const reminderError = error as ReminderServiceError;

        if (!overrideRateLimit && reminderError?.code === 'RATE_LIMITED') {
          Alert.alert(
            'Reminder sent recently',
            reminderError.message || 'This employee was reminded recently.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Send Anyway',
                onPress: () => {
                  executeReminder(row, true);
                },
              },
            ]
          );
          return;
        }

        Alert.alert('Unable to send reminder', reminderError?.message || 'Please try again.');
      } finally {
        setIsSendingUserId(null);
      }
    },
    [loadOverview, selectedLocationId]
  );

  const handleReminderPress = useCallback(
    (row: EmployeeReminderStatusRow) => {
      const actionLabel = row.activeReminder ? 'Send reminder again' : 'Send reminder';
      const deliveryHint = row.notificationsOff
        ? 'Push notifications are OFF. This will deliver in-app only.'
        : 'This will send push (if available) and in-app notifications.';

      Alert.alert(actionLabel, `${deliveryHint}\n\nSend to ${row.name}?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: row.activeReminder ? 'Remind Again' : 'Remind', onPress: () => executeReminder(row) },
      ]);
    },
    [executeReminder]
  );

  const filteredEmployees = useMemo(() => {
    const base = overview?.employees ?? [];
    const query = searchQuery.trim().toLowerCase();

    const searched = query
      ? base.filter((row) => {
          const haystack = `${row.name} ${row.email} ${row.locationName}`.toLowerCase();
          return haystack.includes(query);
        })
      : base;

    return [...searched].sort((a, b) => {
      if (sortMode === 'name') {
        return a.name.localeCompare(b.name);
      }

      if (sortMode === 'location') {
        const byLocation = a.locationName.localeCompare(b.locationName);
        return byLocation === 0 ? a.name.localeCompare(b.name) : byLocation;
      }

      if (sortMode === 'active_first') {
        const aActive = a.status === 'reminder_active' ? 0 : 1;
        const bActive = b.status === 'reminder_active' ? 0 : 1;
        if (aActive !== bActive) return aActive - bActive;
      }

      const aDays = a.daysSinceLastOrder ?? Number.POSITIVE_INFINITY;
      const bDays = b.daysSinceLastOrder ?? Number.POSITIVE_INFINITY;
      if (aDays !== bDays) return bDays - aDays;

      return a.name.localeCompare(b.name);
    });
  }, [overview?.employees, searchQuery, sortMode]);

  const selectedSortLabel = SORT_OPTIONS.find((option) => option.value === sortMode)?.label || 'Most overdue';
  const selectedLocationName =
    selectedLocationId == null
      ? 'All Locations'
      : locations.find((entry) => entry.id === selectedLocationId)?.name || 'Selected Location';

  const stats = overview?.stats ?? {
    pendingReminders: 0,
    overdueEmployees: 0,
    notificationsOff: 0,
  };

  const renderRow = (row: EmployeeReminderStatusRow) => {
    const status = statusConfig(row.status);
    const isSending = isSendingUserId === row.userId;
    const actionLabel = row.notificationsOff
      ? row.activeReminder
        ? 'Remind Again'
        : 'Notify Anyway'
      : row.activeReminder
        ? 'Remind Again'
        : 'Remind';

    return (
      <View
        key={row.userId}
        className="border"
        style={{ backgroundColor: color.card, borderColor: color.hairline, borderRadius: radius.card,
          paddingHorizontal: ds.spacing(14),
          paddingVertical: ds.spacing(12),
          marginBottom: ds.spacing(10) }}
      >
        <View className="flex-row items-start">
          <View
            className="items-center justify-center"
            style={{ backgroundColor: color.well, width: Math.max(40, ds.icon(42)),
              height: Math.max(40, ds.icon(42)),
              borderRadius: radius.pill,
              marginRight: ds.spacing(10) }}
          >
            <Text className="font-semibold" style={{ color: color.ink2, fontSize: ds.fontSize(typeScale.body) }}>
              {row.name.charAt(0).toUpperCase()}
            </Text>
          </View>

          <View className="flex-1 pr-2">
            <Text className="font-semibold" style={{ color: color.ink, fontSize: ds.fontSize(typeScale.body) }}>
              {row.name}
            </Text>
            <Text style={{ color: color.ink2, fontSize: ds.fontSize(typeScale.secondary), marginTop: ds.spacing(2) }}>
              {row.locationName} • {formatLastOrderLabel(row)}
            </Text>

            <View className="flex-row items-center flex-wrap" style={{ marginTop: ds.spacing(8), gap: ds.spacing(6) }}>
              <View
                style={{
                  backgroundColor: status.bg,
                  paddingHorizontal: ds.spacing(8),
                  paddingVertical: ds.spacing(3),
                  borderRadius: radius.pill,
                }}
              >
                <Text style={{ color: status.text, fontSize: ds.fontSize(typeScale.caption), fontWeight: weight.bold }}>
                  {status.label}
                </Text>
              </View>

              {row.notificationsOff && (
                <View
                  style={{
                    backgroundColor: colors.gray[200],
                    paddingHorizontal: ds.spacing(8),
                    paddingVertical: ds.spacing(3),
                    borderRadius: radius.pill,
                  }}
                >
                  <Text style={{ color: colors.gray[700], fontSize: ds.fontSize(typeScale.caption), fontWeight: weight.bold }}>
                    Notifications OFF
                  </Text>
                </View>
              )}
            </View>

            {row.activeReminder && (
              <Text style={{ color: color.warning, fontSize: ds.fontSize(typeScale.secondary), marginTop: ds.spacing(6) }}>
                Active reminder count: {row.activeReminder.reminderCount}
              </Text>
            )}
          </View>

          <TouchableOpacity
            onPress={() => handleReminderPress(row)}
            className={isSending ? 'bg-orange-300 items-center justify-center' : 'bg-primary-500 items-center justify-center'}
            style={{
              minHeight: Math.max(42, ds.buttonH - ds.spacing(6)),
              minWidth: Math.max(106, ds.buttonPadH * 4),
              borderRadius: radius.control,
              paddingHorizontal: ds.spacing(10),
            }}
            disabled={isSending}
          >
            <Text className="font-semibold" style={{ color: color.onAccent, fontSize: ds.fontSize(typeScale.secondary) }}>
              {isSending ? 'Sending...' : actionLabel}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: color.page }} edges={['top', 'left', 'right']}>
      <ManagerScaleContainer>
        <View
          className="border-b flex-row items-center justify-between"
          style={{ backgroundColor: color.card, borderColor: color.hairline, paddingHorizontal: ds.spacing(16), paddingVertical: ds.spacing(12) }}
        >
          <View className="flex-row items-center flex-1">
            <TouchableOpacity
              onPress={() => router.replace('/(manager)')}
              style={{ padding: ds.spacing(8), marginRight: ds.spacing(8), minWidth: 44, minHeight: 44, justifyContent: 'center' }}
            >
              <Ionicons name="arrow-back" size={ds.icon(20)} color={colors.gray[700]} />
            </TouchableOpacity>
            <View className="flex-1">
              <Text className="font-bold" style={{ color: color.ink, fontSize: ds.fontSize(typeScale.title) }}>
                Employee Reminders
              </Text>
              <Text style={{ color: color.ink2, fontSize: ds.fontSize(typeScale.secondary), marginTop: ds.spacing(2) }}>
                Send and track reminders by employee
              </Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => setShowMoreMenu(true)}
            style={{ width: 40, height: 40, borderRadius: radius.card, backgroundColor: colors.gray[100], alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="ellipsis-horizontal" size={18} color={colors.gray[700]} />
          </TouchableOpacity>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: ds.spacing(16), paddingBottom: ds.spacing(28) }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary[500]} />}
        >
          <View className="flex-row" style={{ columnGap: ds.spacing(8), marginBottom: ds.spacing(12) }}>
            <View className="flex-1 border" style={{ backgroundColor: color.card, borderRadius: radius.control, borderColor: color.hairline, padding: ds.spacing(10) }}>
              <Text style={{ fontSize: ds.fontSize(typeScale.secondary), color: color.ink2 }}>Pending</Text>
              <Text className="font-bold" style={{ color: color.ink, fontSize: ds.fontSize(typeScale.title), marginTop: ds.spacing(4) }}>
                {stats.pendingReminders}
              </Text>
            </View>
            <View className="flex-1 border" style={{ backgroundColor: color.card, borderRadius: radius.control, borderColor: color.hairline, padding: ds.spacing(10) }}>
              <Text style={{ fontSize: ds.fontSize(typeScale.secondary), color: color.ink2 }}>Overdue</Text>
              <Text className="font-bold" style={{ color: color.ink, fontSize: ds.fontSize(typeScale.title), marginTop: ds.spacing(4) }}>
                {stats.overdueEmployees}
              </Text>
            </View>
            <View className="flex-1 border" style={{ backgroundColor: color.card, borderRadius: radius.control, borderColor: color.hairline, padding: ds.spacing(10) }}>
              <Text style={{ fontSize: ds.fontSize(typeScale.secondary), color: color.ink2 }}>Notif Off</Text>
              <Text className="font-bold" style={{ color: color.ink, fontSize: ds.fontSize(typeScale.title), marginTop: ds.spacing(4) }}>
                {stats.notificationsOff}
              </Text>
            </View>
          </View>

          <View className="flex-row" style={{ columnGap: ds.spacing(8), marginBottom: ds.spacing(10) }}>
            <TouchableOpacity
              className="flex-1 border flex-row items-center justify-between"
              style={{ backgroundColor: color.card, borderColor: color.hairlineStrong, borderRadius: radius.control, paddingHorizontal: ds.spacing(12), minHeight: Math.max(44, ds.buttonH - ds.spacing(6)) }}
              onPress={() => setShowLocationMenu(true)}
            >
              <Text numberOfLines={1} style={{ color: color.ink2, fontSize: ds.fontSize(typeScale.secondary), flex: 1 }}>
                {selectedLocationName}
              </Text>
              <Ionicons name="chevron-down" size={ds.icon(16)} color={colors.gray[500]} />
            </TouchableOpacity>

            <TouchableOpacity
              className="flex-1 border flex-row items-center justify-between"
              style={{ backgroundColor: color.card, borderColor: color.hairlineStrong, borderRadius: radius.control, paddingHorizontal: ds.spacing(12), minHeight: Math.max(44, ds.buttonH - ds.spacing(6)) }}
              onPress={() => setShowSortMenu(true)}
            >
              <Text numberOfLines={1} style={{ color: color.ink2, fontSize: ds.fontSize(typeScale.secondary), flex: 1 }}>
                {selectedSortLabel}
              </Text>
              <Ionicons name="swap-vertical" size={ds.icon(16)} color={colors.gray[500]} />
            </TouchableOpacity>
          </View>

          <View
            className="border flex-row items-center"
            style={{ backgroundColor: color.card, borderColor: color.hairlineStrong, borderRadius: radius.control, paddingHorizontal: ds.spacing(12),
              minHeight: Math.max(46, ds.buttonH - ds.spacing(4)),
              marginBottom: ds.spacing(14) }}
          >
            <Ionicons name="search" size={ds.icon(18)} color={colors.gray[400]} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search employees"
              placeholderTextColor={colors.gray[400]}
              style={{
                flex: 1,
                marginLeft: ds.spacing(8),
                fontSize: ds.fontSize(typeScale.body),
                color: colors.gray[900],
              }}
            />
          </View>

          {loadErrorMessage && (
            <View
              className="border flex-row items-start"
              style={{ backgroundColor: color.warningBg, borderColor: color.warning, borderRadius: radius.control,
                paddingHorizontal: ds.spacing(10),
                paddingVertical: ds.spacing(9),
                marginBottom: ds.spacing(12) }}
            >
              <Ionicons
                name="warning-outline"
                size={ds.icon(16)}
                color={colors.warning}
                style={{ marginTop: 1 }}
              />
              <Text

                style={{ color: color.warning, fontSize: ds.fontSize(typeScale.secondary), marginLeft: ds.spacing(8), flex: 1 }}
              >
                Reminders backend unavailable right now. Showing fallback view.
              </Text>
            </View>
          )}

          {isLoading ? (
            <View className="items-center" style={{ paddingVertical: ds.spacing(40) }}>
              <Text style={{ color: color.ink2, fontSize: ds.fontSize(typeScale.body) }}>
                Loading employees...
              </Text>
            </View>
          ) : filteredEmployees.length === 0 ? (
            <View className="border items-center" style={{ backgroundColor: color.card, borderRadius: radius.card, borderColor: color.hairline, paddingVertical: ds.spacing(36), paddingHorizontal: ds.spacing(14) }}>
              <Ionicons name="people-outline" size={ds.icon(34)} color={colors.gray[300]} />
              <Text className="font-semibold" style={{ color: color.ink2, fontSize: ds.fontSize(typeScale.body), marginTop: ds.spacing(8) }}>
                {loadErrorMessage ? 'Reminder service unavailable' : 'No employees found'}
              </Text>
              <Text className="text-center" style={{ color: color.ink2, fontSize: ds.fontSize(typeScale.secondary), marginTop: ds.spacing(4) }}>
                {loadErrorMessage
                  ? 'Deploy the reminders Edge Functions and migration, then pull to refresh.'
                  : 'Try changing filters or search terms.'}
              </Text>
            </View>
          ) : (
            filteredEmployees.map(renderRow)
          )}
        </ScrollView>

        <Modal transparent animationType="fade" visible={showLocationMenu} onRequestClose={() => setShowLocationMenu(false)}>
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => setShowLocationMenu(false)}
            style={{ flex: 1, backgroundColor: colors.scrim, justifyContent: 'flex-end' }}
          >
            <View style={{ backgroundColor: color.card, borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card, paddingBottom: ds.spacing(20) }}>
              <Text className="font-semibold" style={{ color: color.ink, fontSize: ds.fontSize(typeScale.body), padding: ds.spacing(16) }}>
                Filter by Location
              </Text>
              <TouchableOpacity
                style={{ paddingHorizontal: ds.spacing(16), paddingVertical: ds.spacing(12) }}
                onPress={() => {
                  setSelectedLocationId(null);
                  setShowLocationMenu(false);
                }}
              >
                <Text style={{ color: color.ink, fontSize: ds.fontSize(typeScale.body) }}>All Locations</Text>
              </TouchableOpacity>
              {locations.map((entry) => (
                <TouchableOpacity
                  key={entry.id}
                  style={{ paddingHorizontal: ds.spacing(16), paddingVertical: ds.spacing(12) }}
                  onPress={() => {
                    setSelectedLocationId(entry.id);
                    setShowLocationMenu(false);
                  }}
                >
                  <Text style={{ color: color.ink, fontSize: ds.fontSize(typeScale.body) }}>{entry.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>

        <Modal transparent animationType="fade" visible={showSortMenu} onRequestClose={() => setShowSortMenu(false)}>
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => setShowSortMenu(false)}
            style={{ flex: 1, backgroundColor: colors.scrim, justifyContent: 'flex-end' }}
          >
            <View style={{ backgroundColor: color.card, borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card, paddingBottom: ds.spacing(20) }}>
              <Text className="font-semibold" style={{ color: color.ink, fontSize: ds.fontSize(typeScale.body), padding: ds.spacing(16) }}>
                Sort Employees
              </Text>
              {SORT_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={{
                    paddingHorizontal: ds.spacing(16),
                    paddingVertical: ds.spacing(12),
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                  onPress={() => {
                    setSortMode(option.value);
                    setShowSortMenu(false);
                  }}
                >
                  <Text style={{ color: color.ink, fontSize: ds.fontSize(typeScale.body) }}>{option.label}</Text>
                  {sortMode === option.value && <Ionicons name="checkmark" size={ds.icon(18)} color={colors.primary[500]} />}
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>

        <Modal transparent animationType="fade" visible={showMoreMenu} onRequestClose={() => setShowMoreMenu(false)}>
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => setShowMoreMenu(false)}
            style={{ flex: 1, backgroundColor: colors.scrim, justifyContent: 'flex-end' }}
          >
            <View style={{ backgroundColor: color.card, borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card, paddingBottom: ds.spacing(20) }}>
              <Text className="font-semibold" style={{ color: color.ink, fontSize: ds.fontSize(typeScale.body), padding: ds.spacing(16) }}>
                More
              </Text>

              <TouchableOpacity
                style={{ paddingHorizontal: ds.spacing(16), paddingVertical: ds.spacing(12) }}
                onPress={() => {
                  setShowMoreMenu(false);
                  router.push('/(manager)/employee-reminders-recurring');
                }}
              >
                <Text style={{ color: color.ink, fontSize: ds.fontSize(typeScale.body) }}>Recurring Reminders</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{ paddingHorizontal: ds.spacing(16), paddingVertical: ds.spacing(12) }}
                onPress={() => {
                  setShowMoreMenu(false);
                  router.push('/(manager)/employee-reminders-settings');
                }}
              >
                <Text style={{ color: color.ink, fontSize: ds.fontSize(typeScale.body) }}>Reminder Settings</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{ paddingHorizontal: ds.spacing(16), paddingVertical: ds.spacing(12) }}
                onPress={() => {
                  setShowMoreMenu(false);
                  router.push('/(manager)/employee-reminders-delivery');
                }}
              >
                <Text style={{ color: color.ink, fontSize: ds.fontSize(typeScale.body) }}>Notification Delivery Status</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      </ManagerScaleContainer>
    </SafeAreaView>
  );
}
