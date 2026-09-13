import React, { useCallback, useEffect, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Loading, SectionLabel, Sheet } from '@/components/ui';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import {
  ImpactFeedbackStyle,
  NotificationFeedbackType,
  triggerConfirmationHaptic,
  triggerImpactHaptic,
  triggerNotificationHaptic,
  triggerSelectionHaptic,
} from '@/lib/haptics';
import {
  deleteRecurringReminderRule,
  listRecurringReminderRules,
  upsertMyChecklistOrderDayReminderRule,
  type RecurringReminderRule,
} from '@/services/employeeReminders';
import { color, radius, typeScale, weight } from '@/theme/tokens';
import {
  buildOrderDayReminderInput,
  defaultOrderDayReminderForm,
  findMyChecklistOrderDayRule,
  formatTimeLabel,
  mapRuleToOrderDayForm,
  REMINDER_EARLIEST_TIME,
  REMINDER_LATEST_TIME,
  REMINDER_TIME_STEP_MINUTES,
  shiftTime,
  toggleDay,
  WEEKDAY_LABELS,
  type OrderDayReminderFormState,
} from '../orderDayReminder';

interface OrderDayReminderSheetProps {
  visible: boolean;
  locationGroup: 'sushi' | 'poki';
  onClose: () => void;
  onRuleChanged?: (rule: RecurringReminderRule | null) => void;
}

export function OrderDayReminderSheet({
  visible,
  locationGroup,
  onClose,
  onRuleChanged,
}: OrderDayReminderSheetProps) {
  const ds = useScaledStyles();

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [existingRule, setExistingRule] = useState<RecurringReminderRule | null>(null);
  const [form, setForm] = useState<OrderDayReminderFormState>(defaultOrderDayReminderForm());
  const [isSaving, setIsSaving] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    setIsLoading(true);
    setLoadError(null);
    setSaveError(null);
    listRecurringReminderRules()
      .then((rules) => {
        if (!active) return;
        const rule = findMyChecklistOrderDayRule(rules, locationGroup);
        setExistingRule(rule);
        setForm(rule ? mapRuleToOrderDayForm(rule) : defaultOrderDayReminderForm());
      })
      .catch((error) => {
        if (!active) return;
        setLoadError(
          error instanceof Error ? error.message : 'Could not load your reminder.',
        );
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [locationGroup, visible]);

  const handleToggleDay = useCallback((day: number) => {
    void triggerSelectionHaptic();
    setForm((previous) => ({
      ...previous,
      daysOfWeek: toggleDay(previous.daysOfWeek, day),
    }));
  }, []);

  const handleShiftTime = useCallback((deltaMinutes: number) => {
    void triggerImpactHaptic(ImpactFeedbackStyle.Light);
    setForm((previous) => ({
      ...previous,
      timeOfDay: shiftTime(previous.timeOfDay, deltaMinutes),
    }));
  }, []);

  const handleSave = useCallback(async () => {
    if (isLoading || loadError || isSaving || isRemoving) return;
    const { input, error } = buildOrderDayReminderInput(
      form,
      locationGroup,
      existingRule?.id ?? null,
    );
    if (!input) {
      setSaveError(error);
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    try {
      const saved = await upsertMyChecklistOrderDayReminderRule(input);
      void triggerConfirmationHaptic();
      setExistingRule(saved);
      onRuleChanged?.(saved);
      onClose();
    } catch (error) {
      void triggerNotificationHaptic(NotificationFeedbackType.Error);
      setSaveError(
        error instanceof Error ? error.message : 'Could not save your reminder.',
      );
    } finally {
      setIsSaving(false);
    }
  }, [
    existingRule?.id,
    form,
    isLoading,
    isRemoving,
    isSaving,
    loadError,
    locationGroup,
    onClose,
    onRuleChanged,
  ]);

  const handleRemove = useCallback(async () => {
    if (isSaving || isRemoving || !existingRule) return;
    setIsRemoving(true);
    setSaveError(null);
    try {
      await deleteRecurringReminderRule(existingRule.id);
      void triggerConfirmationHaptic();
      setExistingRule(null);
      setForm(defaultOrderDayReminderForm());
      onRuleChanged?.(null);
      onClose();
    } catch (error) {
      void triggerNotificationHaptic(NotificationFeedbackType.Error);
      setSaveError(
        error instanceof Error ? error.message : 'Could not remove your reminder.',
      );
    } finally {
      setIsRemoving(false);
    }
  }, [existingRule, isRemoving, isSaving, onClose, onRuleChanged]);

  const formDisabled = isLoading || Boolean(loadError) || isSaving || isRemoving;
  const earlierDisabled = form.timeOfDay <= REMINDER_EARLIEST_TIME;
  const laterDisabled = form.timeOfDay >= REMINDER_LATEST_TIME;

  let body: React.ReactNode;
  if (isLoading) {
    body = (
      <View style={{ paddingVertical: ds.spacing(24), alignItems: 'center' }}>
        <Loading size="inline" color={color.accent} label="Loading" />
      </View>
    );
  } else if (loadError) {
    body = (
      <Text
        style={{
          paddingVertical: ds.spacing(20),
          fontSize: ds.fontSize(typeScale.body),
          color: color.alert,
          textAlign: 'center',
        }}
      >
        {loadError}
      </Text>
    );
  } else {
    body = (
      <View>
        <SectionLabel>Remind me on</SectionLabel>
        <View
          style={{
            flexDirection: 'row',
            gap: ds.spacing(6),
            marginBottom: ds.spacing(2),
          }}
        >
          {WEEKDAY_LABELS.map((label, day) => {
            const selected = form.daysOfWeek.includes(day);
            return (
              <TouchableOpacity
                key={label}
                onPress={() => handleToggleDay(day)}
                activeOpacity={0.75}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={`Remind on ${label}`}
                style={{
                  flex: 1,
                  borderRadius: radius.control,
                  borderWidth: 1.5,
                  borderColor: selected ? color.accent : color.card,
                  backgroundColor: selected ? color.tint : color.card,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: ds.spacing(12),
                }}
              >
                <Text
                  style={{
                    fontSize: ds.fontSize(typeScale.secondary),
                    fontWeight: weight.semibold,
                    color: selected ? color.accent : color.ink,
                  }}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <SectionLabel>At</SectionLabel>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderRadius: radius.control,
            backgroundColor: color.card,
            paddingHorizontal: ds.spacing(8),
            paddingVertical: ds.spacing(8),
          }}
        >
          <TouchableOpacity
            onPress={() => handleShiftTime(-REMINDER_TIME_STEP_MINUTES)}
            disabled={earlierDisabled}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Earlier reminder time"
            accessibilityState={{ disabled: earlierDisabled }}
            style={{
              width: 40,
              height: 40,
              borderRadius: radius.pill,
              backgroundColor: color.well,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: earlierDisabled ? 0.5 : 1,
            }}
          >
            <Ionicons name="remove" size={ds.icon(20)} color={color.ink} />
          </TouchableOpacity>
          <Text
            style={{
              fontSize: ds.fontSize(typeScale.time),
              fontWeight: weight.bold,
              fontVariant: ['tabular-nums'],
              color: color.ink,
            }}
          >
            {formatTimeLabel(form.timeOfDay)}
          </Text>
          <TouchableOpacity
            onPress={() => handleShiftTime(REMINDER_TIME_STEP_MINUTES)}
            disabled={laterDisabled}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Later reminder time"
            accessibilityState={{ disabled: laterDisabled }}
            style={{
              width: 40,
              height: 40,
              borderRadius: radius.pill,
              backgroundColor: color.well,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: laterDisabled ? 0.5 : 1,
            }}
          >
            <Ionicons name="add" size={ds.icon(20)} color={color.ink} />
          </TouchableOpacity>
        </View>

        {saveError ? (
          <Text
            style={{
              marginTop: ds.spacing(10),
              fontSize: ds.fontSize(typeScale.secondary),
              color: color.alert,
            }}
          >
            {saveError}
          </Text>
        ) : null}

        {existingRule ? (
          <TouchableOpacity
            onPress={() => void handleRemove()}
            disabled={isSaving || isRemoving}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Remove reminder"
            style={{
              minHeight: 44,
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: ds.spacing(8),
              opacity: isSaving || isRemoving ? 0.6 : 1,
            }}
          >
            <Text
              style={{
                fontSize: ds.fontSize(typeScale.body),
                fontWeight: weight.semibold,
                color: color.alert,
              }}
            >
              {isRemoving ? 'Removing…' : 'Remove reminder'}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }

  return (
    <Sheet
      visible={visible}
      title="Order-day reminder"
      subtitle="A push on your order days if you have not sent one yet."
      onClose={onClose}
      dismissible={!isSaving && !isRemoving}
      primary={{
        label: 'Set reminder',
        onPress: () => void handleSave(),
        loading: isSaving,
        disabled: formDisabled,
      }}
    >
      {body}
    </Sheet>
  );
}
