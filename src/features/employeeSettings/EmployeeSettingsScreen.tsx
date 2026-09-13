import React, { useEffect, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/react/shallow';
import { useResolvedActiveLocation } from '@/hooks/useResolvedActiveLocation';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { useSignOutAction } from '@/hooks/useSignOutAction';
import {
  listRecurringReminderRules,
  type RecurringReminderRule,
} from '@/services/employeeReminders';
import { useAuthStore, useSettingsStore } from '@/store';
import { Button, Card, ScreenHeader, SectionLabel, getTabBarClearance } from '@/components/ui';
import { BrandFooter } from '@/components/ui/BrandFooter';
import { switchViewMode } from '@/lib/switchViewMode';
import { color, radius, space, tracking, typeScale, weight } from '@/theme/tokens';
import { ChecklistSettingsSheet } from '@/features/simpleOrder/components/ChecklistSettingsSheet';
import { OrderDayReminderSheet } from '@/features/simpleOrder/components/OrderDayReminderSheet';
import {
  findMyChecklistOrderDayRule,
  summarizeOrderDayRule,
} from '@/features/simpleOrder/orderDayReminder';
import { locationGroupForLocation } from '@/features/simpleOrder/checklistSelection';
import { SUPPORT_URL } from '@/features/auth/legal';
import {
  AboutLegalSheet,
  LicensesSheet,
  openExternalUrl,
} from './components/AboutLegalSheet';
import { SettingsCard, SettingsCardRow } from './components/SettingsCardRow';

/**
 * Trimmed employee Settings (checklist-first restructure): profile card,
 * Order reminders, Checklist display, Contact support,
 * About and legal, Sign out. Everything else moved off this screen; the
 * order-day reminder editor lives here (not in quick actions).
 */

export function EmployeeSettingsScreen() {
  const ds = useScaledStyles();
  const insets = useSafeAreaInsets();
  const { user, profile, session } = useAuthStore(
    useShallow((state) => ({
      user: state.user,
      profile: state.profile,
      session: state.session,
    })),
  );
  const { isSigningOut, requestSignOut } = useSignOutAction();
  const { location } = useResolvedActiveLocation();

  const metadataRole =
    typeof session?.user?.user_metadata?.role === 'string'
      ? session.user.user_metadata.role
      : typeof session?.user?.app_metadata?.role === 'string'
        ? session.user.app_metadata.role
        : null;
  const resolvedRole = (user?.role ?? profile?.role ?? metadataRole) as
    | 'employee'
    | 'manager'
    | null;
  const isManager = resolvedRole === 'manager';

  const density = useSettingsStore((state) => state.simpleOrderDensity);
  const setSimpleOrderDensity = useSettingsStore((state) => state.setSimpleOrderDensity);
  const showCategories = useSettingsStore((state) => state.simpleOrderShowCategories);
  const setShowCategories = useSettingsStore(
    (state) => state.setSimpleOrderShowCategories,
  );

  const locationGroup = locationGroupForLocation(location?.name, location?.short_code);
  const [reminderRule, setReminderRule] = useState<RecurringReminderRule | null>(null);
  const [reminderSheetVisible, setReminderSheetVisible] = useState(false);
  const [displaySheetVisible, setDisplaySheetVisible] = useState(false);
  const [aboutVisible, setAboutVisible] = useState(false);
  const [licensesVisible, setLicensesVisible] = useState(false);

  useEffect(() => {
    let active = true;
    listRecurringReminderRules()
      .then((rules) => {
        if (active) setReminderRule(findMyChecklistOrderDayRule(rules, locationGroup));
      })
      .catch(() => {
        if (active) setReminderRule(null);
      });
    return () => {
      active = false;
    };
  }, [locationGroup]);

  const appVersion = Constants.expoConfig?.version || '1.0.0';
  const displayName = user?.name?.trim() || 'Your profile';
  const initial = (displayName[0] ?? '?').toUpperCase();
  const locationLabel = location?.name?.replace(/^Babytuna\s+/i, '') ?? null;
  const roleLabel = isManager ? 'Manager' : 'Employee';
  const densityLabel =
    density === 'comfort' ? 'Comfortable' : density === 'dense' ? 'Dense' : 'Compact';

  const reminderSubtitle =
    reminderRule === null
      ? 'Not set'
      : reminderRule.enabled === false
        ? 'Off'
        : summarizeOrderDayRule(reminderRule);

  const bottomPadding = getTabBarClearance(insets.bottom) + ds.spacing(24);

  return (
    <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: color.page }}>
      <ScreenHeader
        title="Settings"
        right={
          <View
            style={{
              paddingHorizontal: ds.spacing(space[2]),
              paddingVertical: ds.spacing(space[1]),
              borderRadius: radius.pill,
              backgroundColor: color.well,
            }}
          >
            <Text
              style={{
                fontSize: ds.fontSize(typeScale.caption),
                fontWeight: weight.bold,
                letterSpacing: tracking.caption,
                textTransform: 'uppercase',
                color: color.ink2,
              }}
            >
              Employee
            </Text>
          </View>
        }
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: ds.spacing(space[4]),
          paddingBottom: bottomPadding,
          gap: 0,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile card */}
        <TouchableOpacity
          onPress={() =>
            router.push('/(tabs)/profile' as Parameters<typeof router.push>[0])
          }
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Open your profile"
        >
          <Card flush>
            <View
              style={{
                minHeight: ds.spacing(60),
                paddingHorizontal: ds.spacing(14),
                paddingVertical: ds.spacing(7),
                flexDirection: 'row',
                alignItems: 'center',
                gap: ds.spacing(space[3]),
              }}
            >
              <View
                style={{
                  width: ds.icon(46),
                  height: ds.icon(46),
                  borderRadius: radius.pill,
                  backgroundColor: color.tint,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text
                  style={{
                    fontSize: ds.fontSize(typeScale.title),
                    fontWeight: weight.bold,
                    color: color.accent,
                  }}
                >
                  {initial}
                </Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  numberOfLines={1}
                  style={{
                    fontSize: ds.fontSize(typeScale.body),
                    fontWeight: weight.semibold,
                    color: color.ink,
                  }}
                >
                  {displayName}
                </Text>
                <Text style={{ fontSize: ds.fontSize(typeScale.secondary), color: color.ink2 }}>
                  {locationLabel ? `${locationLabel} · ${roleLabel}` : roleLabel}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={ds.icon(16)} color={color.ink3} />
            </View>
          </Card>
        </TouchableOpacity>

        <SectionLabel>Ordering</SectionLabel>
        <SettingsCard>
          <SettingsCardRow
            icon={reminderRule && reminderRule.enabled !== false ? 'notifications' : 'notifications-outline'}
            title="Order reminders"
            subtitle={reminderSubtitle}
            onPress={() => setReminderSheetVisible(true)}
            showChevron="down"
          />
          <SettingsCardRow
            icon="options-outline"
            title="Checklist display"
            subtitle={`${densityLabel} · categories ${showCategories ? 'on' : 'off'}`}
            onPress={() => setDisplaySheetVisible(true)}
            showChevron="down"
            isLast
          />
        </SettingsCard>

        <SectionLabel>Help</SectionLabel>
        <SettingsCard>
          <SettingsCardRow
            icon="help-circle-outline"
            title="Contact support"
            subtitle="Message the manager or report a problem"
            onPress={() => void openExternalUrl(SUPPORT_URL)}
          />
          <SettingsCardRow
            icon="shield-checkmark-outline"
            title="About and legal"
            onPress={() => setAboutVisible(true)}
            rightElement={
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: ds.spacing(space[1] + 1) }}>
                <Text style={{ fontSize: ds.fontSize(typeScale.secondary), color: color.ink3 }}>
                  v{appVersion}
                </Text>
                <Ionicons name="chevron-down" size={ds.icon(16)} color={color.ink3} />
              </View>
            }
            isLast
          />
        </SettingsCard>

        {isManager ? (
          <>
            <SectionLabel>Manager</SectionLabel>
            <SettingsCard>
              <SettingsCardRow
                icon="swap-horizontal"
                title="Switch to Manager view"
                subtitle="Fulfillment, team and inventory"
                onPress={() => switchViewMode('manager')}
                isLast
              />
            </SettingsCard>
          </>
        ) : null}

        <Button
          variant="secondary"
          label="Sign out"
          loading={isSigningOut}
          onPress={requestSignOut}
          style={{ marginTop: ds.spacing(14) }}
        />

        <BrandFooter name={displayName} />
      </ScrollView>

      <OrderDayReminderSheet
        visible={reminderSheetVisible}
        locationGroup={locationGroup}
        onClose={() => setReminderSheetVisible(false)}
        onRuleChanged={setReminderRule}
      />

      <ChecklistSettingsSheet
        visible={displaySheetVisible}
        density={density}
        showCategories={showCategories}
        onSelectDensity={setSimpleOrderDensity}
        onToggleCategories={setShowCategories}
        onClose={() => setDisplaySheetVisible(false)}
      />

      <AboutLegalSheet
        visible={aboutVisible}
        onClose={() => setAboutVisible(false)}
        onShowLicenses={() => {
          setAboutVisible(false);
          setTimeout(() => setLicensesVisible(true), 240);
        }}
      />

      <LicensesSheet visible={licensesVisible} onClose={() => setLicensesVisible(false)} />
    </SafeAreaView>
  );
}
