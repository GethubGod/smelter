import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  Switch,
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
import { useAuthStore } from '@/store';
import {
  EmployeeReminderStatusRow,
  RecurringReminderRule,
  deleteRecurringReminderRule,
  evaluateRecurringReminderRules,
  listEmployeesWithReminderStatus,
  listRecurringReminderRules,
  upsertRecurringReminderRule,
} from '@/services';
import { color, radius, typeScale, weight } from '@/theme/tokens';

const WEEKDAY_OPTIONS = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];

type RuleFormState = {
  id?: string;
  scope: 'employee' | 'location';
  targetId: string;
  daysOfWeek: number[];
  timeOfDay: string;
  conditionType: 'no_order_today' | 'days_since_last_order_gte';
  conditionValue: string;
  enabled: boolean;
  quietHoursEnabled: boolean;
  quietStart: string;
  quietEnd: string;
  push: boolean;
  inApp: boolean;
  timezone: string;
};

function timeZoneDefault() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Los_Angeles';
  } catch {
    return 'America/Los_Angeles';
  }
}

function defaultForm(): RuleFormState {
  return {
    scope: 'location',
    targetId: '',
    daysOfWeek: [1, 2, 3, 4, 5],
    timeOfDay: '15:00',
    conditionType: 'no_order_today',
    conditionValue: '2',
    enabled: true,
    quietHoursEnabled: false,
    quietStart: '22:00',
    quietEnd: '07:00',
    push: true,
    inApp: true,
    timezone: timeZoneDefault(),
  };
}

function summarizeDays(days: number[]) {
  if (days.length === 7) return 'Daily';
  return WEEKDAY_OPTIONS.filter((option) => days.includes(option.value)).map((option) => option.label).join(', ');
}

function mapRuleToForm(rule: RecurringReminderRule): RuleFormState {
  return {
    id: rule.id,
    scope: rule.scope,
    targetId: rule.scope === 'employee' ? rule.employee_id || '' : rule.location_id || '',
    daysOfWeek: Array.isArray(rule.days_of_week) ? rule.days_of_week : [],
    timeOfDay: (rule.time_of_day || '15:00').slice(0, 5),
    conditionType: rule.condition_type,
    conditionValue: String(rule.condition_value ?? 2),
    enabled: rule.enabled,
    quietHoursEnabled: rule.quiet_hours_enabled,
    quietStart: (rule.quiet_hours_start || '22:00').slice(0, 5),
    quietEnd: (rule.quiet_hours_end || '07:00').slice(0, 5),
    push: rule.channels?.push !== false,
    inApp: rule.channels?.in_app !== false,
    timezone: rule.timezone || timeZoneDefault(),
  };
}

export default function EmployeeReminderRecurringScreen() {
  const ds = useScaledStyles();
  const { user, locations, fetchLocations } = useAuthStore();

  const [rules, setRules] = useState<RecurringReminderRule[]>([]);
  const [employees, setEmployees] = useState<EmployeeReminderStatusRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [showEditor, setShowEditor] = useState(false);
  const [form, setForm] = useState<RuleFormState>(defaultForm());

  const loadData = useCallback(async () => {
    try {
      const [ruleRows, employeeOverview] = await Promise.all([
        listRecurringReminderRules(),
        listEmployeesWithReminderStatus(),
      ]);
      setRules(ruleRows);
      setEmployees(employeeOverview.employees);
    } catch (error: any) {
      Alert.alert('Unable to load recurring reminders', error?.message || 'Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const { refreshing, onRefresh: handleRefresh } = useManagedRefresh(loadData);

  const locationById = useMemo(() => {
    const map = new Map<string, string>();
    locations.forEach((entry) => map.set(entry.id, entry.name));
    return map;
  }, [locations]);

  const employeeById = useMemo(() => {
    const map = new Map<string, string>();
    employees.forEach((entry) => map.set(entry.userId, entry.name));
    return map;
  }, [employees]);

  const toggleDay = (day: number) => {
    setForm((prev) => {
      const exists = prev.daysOfWeek.includes(day);
      const nextDays = exists
        ? prev.daysOfWeek.filter((value) => value !== day)
        : [...prev.daysOfWeek, day];
      return { ...prev, daysOfWeek: nextDays.sort((a, b) => a - b) };
    });
  };

  const openNewRule = () => {
    setForm(defaultForm());
    setShowEditor(true);
  };

  const openEditRule = (rule: RecurringReminderRule) => {
    setForm(mapRuleToForm(rule));
    setShowEditor(true);
  };

  const handleSave = async () => {
    if (!user?.id) {
      Alert.alert('Manager required', 'Please sign in again to manage recurring reminders.');
      return;
    }

    if (!form.targetId) {
      Alert.alert('Missing target', `Please choose a ${form.scope}.`);
      return;
    }

    if (!/^\d{2}:\d{2}$/.test(form.timeOfDay)) {
      Alert.alert('Invalid time', 'Use HH:MM format, for example 15:00.');
      return;
    }

    if (form.daysOfWeek.length === 0) {
      Alert.alert('Select days', 'Choose at least one weekday for this rule.');
      return;
    }

    if (!form.inApp && !form.push) {
      Alert.alert('Select a channel', 'Enable at least one delivery channel.');
      return;
    }

    if (form.quietHoursEnabled) {
      if (!/^\d{2}:\d{2}$/.test(form.quietStart) || !/^\d{2}:\d{2}$/.test(form.quietEnd)) {
        Alert.alert('Invalid quiet hours', 'Quiet hours must use HH:MM format.');
        return;
      }
    }

    const conditionValue = form.conditionType === 'days_since_last_order_gte'
      ? Math.max(0, Number.parseInt(form.conditionValue, 10) || 0)
      : null;

    setIsSaving(true);
    try {
      await upsertRecurringReminderRule({
        id: form.id,
        scope: form.scope,
        employee_id: form.scope === 'employee' ? form.targetId : null,
        location_id: form.scope === 'location' ? form.targetId : null,
        days_of_week: [...form.daysOfWeek].sort((a, b) => a - b),
        time_of_day: form.timeOfDay,
        timezone: form.timezone || timeZoneDefault(),
        condition_type: form.conditionType,
        condition_value: conditionValue,
        quiet_hours_enabled: form.quietHoursEnabled,
        quiet_hours_start: form.quietHoursEnabled ? form.quietStart : null,
        quiet_hours_end: form.quietHoursEnabled ? form.quietEnd : null,
        channels: {
          push: form.push,
          in_app: form.inApp,
        },
        enabled: form.enabled,
        created_by: user.id,
      });

      setShowEditor(false);
      await loadData();
    } catch (error: any) {
      Alert.alert('Unable to save rule', error?.message || 'Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (rule: RecurringReminderRule) => {
    Alert.alert(
      'Delete recurring rule',
      'This reminder schedule will stop immediately. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteRecurringReminderRule(rule.id);
              await loadData();
            } catch (error: any) {
              Alert.alert('Unable to delete rule', error?.message || 'Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleToggleEnabled = async (rule: RecurringReminderRule) => {
    if (!user?.id) return;

    try {
      await upsertRecurringReminderRule({
        id: rule.id,
        scope: rule.scope,
        employee_id: rule.employee_id,
        location_id: rule.location_id,
        days_of_week: rule.days_of_week,
        time_of_day: rule.time_of_day,
        timezone: rule.timezone,
        condition_type: rule.condition_type,
        condition_value: rule.condition_value,
        quiet_hours_enabled: rule.quiet_hours_enabled,
        quiet_hours_start: rule.quiet_hours_start,
        quiet_hours_end: rule.quiet_hours_end,
        channels: rule.channels,
        enabled: !rule.enabled,
        created_by: rule.created_by || user.id,
      });
      await loadData();
    } catch (error: any) {
      Alert.alert('Unable to update rule', error?.message || 'Please try again.');
    }
  };

  const runRulesNow = async () => {
    try {
      const result = await evaluateRecurringReminderRules({ dryRun: false });
      Alert.alert(
        'Recurring evaluation complete',
        `Evaluated ${result?.evaluatedRules ?? 0} rules and sent ${result?.remindersSent ?? 0} reminders.`
      );
      await loadData();
    } catch (error: any) {
      Alert.alert('Unable to evaluate rules', error?.message || 'Please try again.');
    }
  };

  const selectedTargetLabel =
    form.scope === 'employee'
      ? employeeById.get(form.targetId) || 'Select employee'
      : locationById.get(form.targetId) || 'Select location';

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: color.page }} edges={['top', 'left', 'right']}>
      <ManagerScaleContainer>
        <View
          className="border-b flex-row items-center justify-between"
          style={{ backgroundColor: color.card, borderColor: color.hairline, paddingHorizontal: ds.spacing(16), paddingVertical: ds.spacing(12) }}
        >
          <View className="flex-row items-center flex-1">
            <TouchableOpacity
              onPress={() => router.replace('/(manager)/employee-reminders')}
              style={{ padding: ds.spacing(8), marginRight: ds.spacing(8), minWidth: 44, minHeight: 44, justifyContent: 'center' }}
            >
              <Ionicons name="arrow-back" size={ds.icon(20)} color={colors.gray[700]} />
            </TouchableOpacity>
            <View className="flex-1">
              <Text className="font-bold" style={{ color: color.ink, fontSize: ds.fontSize(typeScale.title) }}>
                Recurring Reminders
              </Text>
              <Text style={{ color: color.ink2, fontSize: ds.fontSize(typeScale.secondary), marginTop: ds.spacing(2) }}>
                Schedule reminders that run automatically
              </Text>
            </View>
          </View>

          <TouchableOpacity
            className="items-center justify-center"
            style={{ backgroundColor: color.well, borderRadius: radius.pill, width: 42, height: 42 }}
            onPress={runRulesNow}
          >
            <Ionicons name="play" size={ds.icon(18)} color={colors.gray[700]} />
          </TouchableOpacity>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: ds.spacing(16), paddingBottom: ds.spacing(28) }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary[500]} />}
        >
          <TouchableOpacity
            className="flex-row items-center justify-center"
            style={{ backgroundColor: color.accent, borderRadius: radius.control, minHeight: Math.max(48, ds.buttonH), marginBottom: ds.spacing(14) }}
            onPress={openNewRule}
          >
            <Ionicons name="add-circle-outline" size={ds.icon(18)} color={colors.white} />
            <Text className="font-semibold" style={{ color: color.onAccent, fontSize: ds.fontSize(typeScale.body), marginLeft: ds.spacing(6) }}>
              New Recurring Rule
            </Text>
          </TouchableOpacity>

          {isLoading ? (
            <View className="items-center" style={{ paddingVertical: ds.spacing(40) }}>
              <Text style={{ color: color.ink2, fontSize: ds.fontSize(typeScale.body) }}>
                Loading rules...
              </Text>
            </View>
          ) : rules.length === 0 ? (
            <View className="border items-center" style={{ backgroundColor: color.card, borderRadius: radius.card, borderColor: color.hairline, paddingVertical: ds.spacing(36), paddingHorizontal: ds.spacing(16) }}>
              <Ionicons name="repeat" size={ds.icon(34)} color={colors.gray[300]} />
              <Text className="font-semibold" style={{ color: color.ink2, fontSize: ds.fontSize(typeScale.body), marginTop: ds.spacing(8) }}>
                No recurring reminders yet
              </Text>
              <Text className="text-center" style={{ color: color.ink2, fontSize: ds.fontSize(typeScale.secondary), marginTop: ds.spacing(4) }}>
                Create a rule to remind employees automatically when no order is placed.
              </Text>
            </View>
          ) : (
            rules.map((rule) => {
              const targetLabel =
                rule.scope === 'employee'
                  ? employeeById.get(rule.employee_id || '') || 'Unknown employee'
                  : locationById.get(rule.location_id || '') || 'Unknown location';

              const conditionLabel =
                rule.condition_type === 'no_order_today'
                  ? 'If no order today'
                  : `If last order >= ${rule.condition_value ?? 0} day(s)`;

              return (
                <View
                  key={rule.id}
                  className="border"
                  style={{ backgroundColor: color.card, borderColor: color.hairline, borderRadius: radius.card,
                    paddingHorizontal: ds.spacing(14),
                    paddingVertical: ds.spacing(12),
                    marginBottom: ds.spacing(10) }}
                >
                  <View className="flex-row items-start justify-between">
                    <View className="flex-1 pr-3">
                      <Text className="font-semibold" style={{ color: color.ink, fontSize: ds.fontSize(typeScale.body) }}>
                        {rule.scope === 'employee' ? 'Employee Rule' : 'Location Rule'}
                      </Text>
                      <Text style={{ color: color.ink2, fontSize: ds.fontSize(typeScale.secondary), marginTop: ds.spacing(2) }}>
                        Target: {targetLabel}
                      </Text>
                      <Text style={{ color: color.ink2, fontSize: ds.fontSize(typeScale.secondary), marginTop: ds.spacing(2) }}>
                        {summarizeDays(rule.days_of_week)} at {String(rule.time_of_day).slice(0, 5)}
                      </Text>
                      <Text style={{ color: color.ink2, fontSize: ds.fontSize(typeScale.secondary), marginTop: ds.spacing(2) }}>
                        {conditionLabel}
                      </Text>
                      <Text style={{ color: color.ink2, fontSize: ds.fontSize(typeScale.secondary), marginTop: ds.spacing(2) }}>
                        Channels: {rule.channels?.push !== false ? 'Push' : ''}{rule.channels?.push !== false && rule.channels?.in_app !== false ? ' + ' : ''}{rule.channels?.in_app !== false ? 'In-app' : ''}
                      </Text>
                    </View>

                    <View className="items-end">
                      <Switch
                        value={rule.enabled}
                        onValueChange={() => handleToggleEnabled(rule)}
                        trackColor={{ false: colors.gray[300], true: colors.primary[200] }}
                        thumbColor={rule.enabled ? colors.primary[500] : colors.gray[100]}
                      />
                    </View>
                  </View>

                  <View className="flex-row" style={{ columnGap: ds.spacing(8), marginTop: ds.spacing(10) }}>
                    <TouchableOpacity
                      className="flex-1 items-center justify-center"
                      style={{ borderRadius: radius.control, backgroundColor: color.well, minHeight: Math.max(40, ds.buttonH - ds.spacing(10)) }}
                      onPress={() => openEditRule(rule)}
                    >
                      <Text className="font-semibold" style={{ color: color.ink2, fontSize: ds.fontSize(typeScale.secondary) }}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      className="flex-1 items-center justify-center"
                      style={{ borderRadius: radius.control, backgroundColor: color.alertBg, minHeight: Math.max(40, ds.buttonH - ds.spacing(10)) }}
                      onPress={() => handleDelete(rule)}
                    >
                      <Text className="font-semibold" style={{ color: color.alert, fontSize: ds.fontSize(typeScale.secondary) }}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>

        <Modal
          transparent
          visible={showEditor}
          animationType="slide"
          onRequestClose={() => setShowEditor(false)}
        >
          <View style={{ flex: 1, backgroundColor: colors.scrimStrong, justifyContent: 'flex-end' }}>
            <View

              style={{ backgroundColor: color.card, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, maxHeight: '92%' }}
            >
              <View
                className="flex-row items-center justify-between border-b"
                style={{ borderColor: color.hairline, paddingHorizontal: ds.spacing(16), paddingVertical: ds.spacing(12) }}
              >
                <Text className="font-semibold" style={{ color: color.ink, fontSize: ds.fontSize(typeScale.title) }}>
                  {form.id ? 'Edit Rule' : 'New Rule'}
                </Text>
                <TouchableOpacity onPress={() => setShowEditor(false)}>
                  <Ionicons name="close" size={ds.icon(22)} color={colors.gray[600]} />
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={{ padding: ds.spacing(16), paddingBottom: ds.spacing(28) }}>
                <Text className="uppercase" style={{ color: color.ink2, fontSize: ds.fontSize(typeScale.caption), marginBottom: ds.spacing(6) }}>
                  Scope
                </Text>
                <View className="flex-row" style={{ columnGap: ds.spacing(8), marginBottom: ds.spacing(12) }}>
                  <TouchableOpacity
                    className="flex-1 items-center justify-center"
                    style={{ backgroundColor: form.scope === 'employee' ? color.accent : color.well, borderRadius: radius.control, minHeight: Math.max(42, ds.buttonH - ds.spacing(8)) }}
                    onPress={() => setForm((prev) => ({ ...prev, scope: 'employee', targetId: '' }))}
                  >
                    <Text className="font-semibold" style={{ color: form.scope === 'employee' ? color.onAccent : color.ink2, fontSize: ds.fontSize(typeScale.secondary) }}>
                      Employee
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="flex-1 items-center justify-center"
                    style={{ backgroundColor: form.scope === 'location' ? color.accent : color.well, borderRadius: radius.control, minHeight: Math.max(42, ds.buttonH - ds.spacing(8)) }}
                    onPress={() => setForm((prev) => ({ ...prev, scope: 'location', targetId: '' }))}
                  >
                    <Text className="font-semibold" style={{ color: form.scope === 'location' ? color.onAccent : color.ink2, fontSize: ds.fontSize(typeScale.secondary) }}>
                      Location
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text className="uppercase" style={{ color: color.ink2, fontSize: ds.fontSize(typeScale.caption), marginBottom: ds.spacing(6) }}>
                  Target
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ columnGap: ds.spacing(8), marginBottom: ds.spacing(12) }}
                >
                  {(form.scope === 'employee' ? employees.map((entry) => ({ id: entry.userId, label: entry.name })) : locations.map((entry) => ({ id: entry.id, label: entry.name }))).map((option) => (
                    <TouchableOpacity
                      key={option.id}

                      style={{ backgroundColor: form.targetId === option.id ? color.accent : color.well, borderRadius: radius.control, paddingHorizontal: ds.spacing(12), minHeight: Math.max(38, ds.buttonH - ds.spacing(12)), justifyContent: 'center' }}
                      onPress={() => setForm((prev) => ({ ...prev, targetId: option.id }))}
                    >
                      <Text className={form.targetId === option.id ? 'font-semibold' : ''} style={{ color: form.targetId === option.id ? color.onAccent : color.ink2, fontWeight: form.targetId === option.id ? undefined : weight.semibold, fontSize: ds.fontSize(typeScale.secondary) }}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <Text className="uppercase" style={{ color: color.ink2, fontSize: ds.fontSize(typeScale.caption), marginBottom: ds.spacing(6) }}>
                  Days of Week
                </Text>
                <View className="flex-row flex-wrap" style={{ gap: ds.spacing(8), marginBottom: ds.spacing(12) }}>
                  {WEEKDAY_OPTIONS.map((day) => {
                    const selected = form.daysOfWeek.includes(day.value);
                    return (
                      <TouchableOpacity
                        key={day.value}

                        style={{ backgroundColor: selected ? color.accent : color.well, borderRadius: radius.control, minWidth: ds.spacing(44),
                          minHeight: Math.max(36, ds.buttonH - ds.spacing(14)),
                          alignItems: 'center',
                          justifyContent: 'center',
                          paddingHorizontal: ds.spacing(10) }}
                        onPress={() => toggleDay(day.value)}
                      >
                        <Text className={selected ? 'font-semibold' : ''} style={{ color: selected ? color.onAccent : color.ink2, fontWeight: selected ? undefined : weight.semibold, fontSize: ds.fontSize(typeScale.secondary) }}>
                          {day.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text className="uppercase" style={{ color: color.ink2, fontSize: ds.fontSize(typeScale.caption), marginBottom: ds.spacing(6) }}>
                  Time (HH:MM)
                </Text>
                <TextInput
                  value={form.timeOfDay}
                  onChangeText={(value) => setForm((prev) => ({ ...prev, timeOfDay: value }))}
                  className="border"
                  style={{ backgroundColor: color.page, borderColor: color.hairlineStrong, borderRadius: radius.control, color: color.ink, minHeight: Math.max(44, ds.buttonH - ds.spacing(6)),
                    paddingHorizontal: ds.spacing(12),
                    fontSize: ds.fontSize(typeScale.body),
                    marginBottom: ds.spacing(12) }}
                />

                <Text className="uppercase" style={{ color: color.ink2, fontSize: ds.fontSize(typeScale.caption), marginBottom: ds.spacing(6) }}>
                  Condition
                </Text>
                <View className="flex-row" style={{ columnGap: ds.spacing(8), marginBottom: ds.spacing(8) }}>
                  <TouchableOpacity
                    className="flex-1 items-center justify-center"
                    style={{ backgroundColor: form.conditionType === 'no_order_today' ? color.accent : color.well, borderRadius: radius.control, minHeight: Math.max(40, ds.buttonH - ds.spacing(10)) }}
                    onPress={() => setForm((prev) => ({ ...prev, conditionType: 'no_order_today' }))}
                  >
                    <Text className="font-semibold" style={{ color: form.conditionType === 'no_order_today' ? color.onAccent : color.ink2, fontSize: ds.fontSize(typeScale.secondary) }}>
                      No order today
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="flex-1 items-center justify-center"
                    style={{ backgroundColor: form.conditionType === 'days_since_last_order_gte' ? color.accent : color.well, borderRadius: radius.control, minHeight: Math.max(40, ds.buttonH - ds.spacing(10)) }}
                    onPress={() => setForm((prev) => ({ ...prev, conditionType: 'days_since_last_order_gte' }))}
                  >
                    <Text className="font-semibold" style={{ color: form.conditionType === 'days_since_last_order_gte' ? color.onAccent : color.ink2, fontSize: ds.fontSize(typeScale.secondary) }}>
                      Days since order
                    </Text>
                  </TouchableOpacity>
                </View>

                {form.conditionType === 'days_since_last_order_gte' && (
                  <TextInput
                    value={form.conditionValue}
                    onChangeText={(value) => setForm((prev) => ({ ...prev, conditionValue: value.replace(/[^0-9]/g, '') }))}
                    keyboardType="number-pad"
                    className="border"
                    style={{ backgroundColor: color.page, borderColor: color.hairlineStrong, borderRadius: radius.control, color: color.ink, minHeight: Math.max(44, ds.buttonH - ds.spacing(6)),
                      paddingHorizontal: ds.spacing(12),
                      fontSize: ds.fontSize(typeScale.body),
                      marginBottom: ds.spacing(12) }}
                    placeholder="Days threshold"
                  />
                )}

                <View className="flex-row items-center justify-between" style={{ marginBottom: ds.spacing(10) }}>
                  <Text className="font-semibold" style={{ color: color.ink, fontSize: ds.fontSize(typeScale.body) }}>Quiet Hours</Text>
                  <Switch
                    value={form.quietHoursEnabled}
                    onValueChange={(value) => setForm((prev) => ({ ...prev, quietHoursEnabled: value }))}
                    trackColor={{ false: colors.gray[300], true: colors.primary[200] }}
                    thumbColor={form.quietHoursEnabled ? colors.primary[500] : colors.gray[100]}
                  />
                </View>

                {form.quietHoursEnabled && (
                  <View className="flex-row" style={{ columnGap: ds.spacing(8), marginBottom: ds.spacing(12) }}>
                    <TextInput
                      value={form.quietStart}
                      onChangeText={(value) => setForm((prev) => ({ ...prev, quietStart: value }))}
                      placeholder="Start 22:00"
                      className="flex-1 border"
                      style={{ backgroundColor: color.page, borderColor: color.hairlineStrong, borderRadius: radius.control, color: color.ink, minHeight: Math.max(44, ds.buttonH - ds.spacing(6)), paddingHorizontal: ds.spacing(12), fontSize: ds.fontSize(typeScale.body) }}
                    />
                    <TextInput
                      value={form.quietEnd}
                      onChangeText={(value) => setForm((prev) => ({ ...prev, quietEnd: value }))}
                      placeholder="End 07:00"
                      className="flex-1 border"
                      style={{ backgroundColor: color.page, borderColor: color.hairlineStrong, borderRadius: radius.control, color: color.ink, minHeight: Math.max(44, ds.buttonH - ds.spacing(6)), paddingHorizontal: ds.spacing(12), fontSize: ds.fontSize(typeScale.body) }}
                    />
                  </View>
                )}

                <Text className="uppercase" style={{ color: color.ink2, fontSize: ds.fontSize(typeScale.caption), marginBottom: ds.spacing(6) }}>
                  Channels
                </Text>
                <View className="flex-row" style={{ columnGap: ds.spacing(8), marginBottom: ds.spacing(12) }}>
                  <TouchableOpacity
                    className="flex-1 items-center justify-center"
                    style={{ backgroundColor: form.push ? color.accent : color.well, borderRadius: radius.control, minHeight: Math.max(40, ds.buttonH - ds.spacing(10)) }}
                    onPress={() => setForm((prev) => ({ ...prev, push: !prev.push }))}
                  >
                    <Text className="font-semibold" style={{ color: form.push ? color.onAccent : color.ink2, fontSize: ds.fontSize(typeScale.secondary) }}>
                      Push
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="flex-1 items-center justify-center"
                    style={{ backgroundColor: form.inApp ? color.accent : color.well, borderRadius: radius.control, minHeight: Math.max(40, ds.buttonH - ds.spacing(10)) }}
                    onPress={() => setForm((prev) => ({ ...prev, inApp: !prev.inApp }))}
                  >
                    <Text className="font-semibold" style={{ color: form.inApp ? color.onAccent : color.ink2, fontSize: ds.fontSize(typeScale.secondary) }}>
                      In-app
                    </Text>
                  </TouchableOpacity>
                </View>

                <View className="flex-row items-center justify-between" style={{ marginBottom: ds.spacing(12) }}>
                  <Text className="font-semibold" style={{ color: color.ink, fontSize: ds.fontSize(typeScale.body) }}>Rule Enabled</Text>
                  <Switch
                    value={form.enabled}
                    onValueChange={(value) => setForm((prev) => ({ ...prev, enabled: value }))}
                    trackColor={{ false: colors.gray[300], true: colors.primary[200] }}
                    thumbColor={form.enabled ? colors.primary[500] : colors.gray[100]}
                  />
                </View>

                <View style={{ backgroundColor: color.well, borderRadius: radius.control, padding: ds.spacing(10), marginBottom: ds.spacing(12) }}>
                  <Text style={{ color: color.ink2, fontSize: ds.fontSize(typeScale.secondary) }}>
                    Target: {selectedTargetLabel || 'Not selected'}
                  </Text>
                  <Text style={{ color: color.ink2, fontSize: ds.fontSize(typeScale.secondary), marginTop: ds.spacing(2) }}>
                    Schedule: {summarizeDays(form.daysOfWeek)} at {form.timeOfDay}
                  </Text>
                </View>

                <TouchableOpacity
                  className="items-center justify-center"
                  style={{ backgroundColor: isSaving ? color.tint : color.accent, borderRadius: radius.control, minHeight: Math.max(48, ds.buttonH) }}
                  onPress={handleSave}
                  disabled={isSaving}
                >
                  <Text className="font-semibold" style={{ color: color.onAccent, fontSize: ds.fontSize(typeScale.body) }}>
                    {isSaving ? 'Saving...' : 'Save Rule'}
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </ManagerScaleContainer>
    </SafeAreaView>
  );
}
