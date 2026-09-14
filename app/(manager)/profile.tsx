import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/react/shallow';
import {
  Button,
  Card,
  ScreenHeader,
  SectionLabel,
  getTabBarClearance,
} from '@/components/ui';
import { BrandFooter } from '@/components/ui/BrandFooter';
import { useResolvedActiveLocation } from '@/hooks/useResolvedActiveLocation';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { useSignOutAction } from '@/hooks/useSignOutAction';
import { buildSettingsHref, MANAGER_SETTINGS_ROOT } from '@/lib/settingsNavigation';
import { switchViewMode } from '@/lib/switchViewMode';
import {
  listRecurringReminderRules,
  type RecurringReminderRule,
} from '@/services/employeeReminders';
import { isRealAccountEmail } from '@/services/selfProfile';
import { listManagedUsers } from '@/services/userManagement';
import { useAuthStore, useInventoryStore, useSettingsStore } from '@/store';
import { color, radius, space, tracking, typeScale, weight } from '@/theme/tokens';
import {
  AboutLegalSheet,
  LicensesSheet,
  openExternalUrl,
} from '@/features/employeeSettings/components/AboutLegalSheet';
import {
  SettingsCard,
  SettingsCardRow,
} from '@/features/employeeSettings/components/SettingsCardRow';
import {
  buildManagerSettingsGroups,
  type SettingsGroupModel,
} from '@/features/settings/settingsSections';
import { ChecklistSettingsSheet } from '@/features/simpleOrder/components/ChecklistSettingsSheet';
import { OrderDayReminderSheet } from '@/features/simpleOrder/components/OrderDayReminderSheet';
import { locationGroupForLocation } from '@/features/simpleOrder/checklistSelection';
import {
  findMyChecklistOrderDayRule,
  summarizeOrderDayRule,
} from '@/features/simpleOrder/orderDayReminder';
import { SUPPORT_URL } from '@/features/auth/legal';

type LoadStatus = 'loading' | 'ready' | 'error';

export default function ManagerSettingsScreen() {
  const ds = useScaledStyles();
  const insets = useSafeAreaInsets();
  const { location, locations } = useResolvedActiveLocation();
  const { user } = useAuthStore(
    useShallow((state) => ({
      user: state.user,
    })),
  );
  const {
    items,
    isLoading: inventoryLoading,
    error: inventoryError,
    fetchItems,
  } = useInventoryStore(
    useShallow((state) => ({
      items: state.items,
      isLoading: state.isLoading,
      error: state.error,
      fetchItems: state.fetchItems,
    })),
  );
  const density = useSettingsStore((state) => state.simpleOrderDensity);
  const setSimpleOrderDensity = useSettingsStore((state) => state.setSimpleOrderDensity);
  const showCategories = useSettingsStore((state) => state.simpleOrderShowCategories);
  const setShowCategories = useSettingsStore(
    (state) => state.setSimpleOrderShowCategories,
  );
  const { isSigningOut, requestSignOut } = useSignOutAction();

  const [teamCount, setTeamCount] = useState(0);
  const [teamStatus, setTeamStatus] = useState<LoadStatus>('loading');
  const [reminderRule, setReminderRule] = useState<RecurringReminderRule | null>(null);
  const [reminderSheetVisible, setReminderSheetVisible] = useState(false);
  const [displaySheetVisible, setDisplaySheetVisible] = useState(false);
  const [aboutVisible, setAboutVisible] = useState(false);
  const [licensesVisible, setLicensesVisible] = useState(false);

  const locationGroup = locationGroupForLocation(location?.name, location?.short_code);

  useEffect(() => {
    void fetchItems();
  }, [fetchItems]);

  useEffect(() => {
    let active = true;
    setTeamStatus('loading');
    void listManagedUsers()
      .then((members) => {
        if (!active) return;
        setTeamCount(members.length);
        setTeamStatus('ready');
      })
      .catch(() => {
        if (active) setTeamStatus('error');
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    void listRecurringReminderRules()
      .then((rules) => {
        if (active) {
          setReminderRule(findMyChecklistOrderDayRule(rules, locationGroup));
        }
      })
      .catch(() => {
        if (active) setReminderRule(null);
      });
    return () => {
      active = false;
    };
  }, [locationGroup]);

  const appVersion = Constants.expoConfig?.version || '1.0.0';
  const displayName = useMemo(() => {
    const name = user?.name?.trim();
    if (name) return name;
    const email = user?.email?.trim();
    return email && isRealAccountEmail(email) ? email : 'Your profile';
  }, [user?.email, user?.name]);
  const initial = (displayName[0] ?? '?').toUpperCase();
  const locationLabel = useMemo(() => {
    const names = Array.from(
      new Set(locations.map((entry) => entry.name.replace(/^Babytuna\s+/i, ''))),
    );
    return names.join(', ');
  }, [locations]);
  const activeInventoryCount = useMemo(
    () => items.filter((item) => item.active !== false).length,
    [items],
  );
  const densityLabel =
    density === 'comfort' ? 'Comfortable' : density === 'dense' ? 'Dense' : 'Compact';
  const reminderSubtitle =
    reminderRule === null
      ? 'Not set'
      : reminderRule.enabled === false
        ? 'Off'
        : summarizeOrderDayRule(reminderRule);
  const teamCountLabel =
    teamStatus === 'loading'
      ? 'Loading team'
      : teamStatus === 'error'
        ? 'Team unavailable'
        : `${teamCount} people`;
  const inventoryCountLabel =
    inventoryLoading && activeInventoryCount === 0
      ? 'Loading inventory'
      : inventoryError && activeInventoryCount === 0
        ? 'Inventory unavailable'
        : `${activeInventoryCount} items`;

  const settingsGroups = buildManagerSettingsGroups({
    teamCountLabel,
    inventoryCountLabel,
    reminderSubtitle,
    checklistSubtitle: `${densityLabel} · categories ${showCategories ? 'on' : 'off'}`,
    appVersion,
    onNavigate: (href) => router.push(href),
    onOpenReminder: () => setReminderSheetVisible(true),
    onOpenChecklist: () => setDisplaySheetVisible(true),
    onOpenAbout: () => setAboutVisible(true),
    onContactSupport: () => void openExternalUrl(SUPPORT_URL),
    onSwitchToEmployee: () => switchViewMode('employee'),
  });
  const bottomPadding = getTabBarClearance(insets.bottom) + ds.spacing(space[6]);

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
              backgroundColor: color.tint,
            }}
          >
            <Text
              style={{
                fontSize: ds.fontSize(typeScale.caption),
                fontWeight: weight.bold,
                letterSpacing: tracking.caption,
                textTransform: 'uppercase',
                color: color.accent,
              }}
            >
              Manager
            </Text>
          </View>
        }
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: ds.spacing(space[4]),
          paddingBottom: bottomPadding,
        }}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          onPress={() =>
            router.push(
              buildSettingsHref('/(manager)/manager-settings/profile', {
                origin: 'manager',
                backTo: MANAGER_SETTINGS_ROOT,
              }),
            )
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
                <Text
                  numberOfLines={2}
                  style={{ fontSize: ds.fontSize(typeScale.secondary), color: color.ink2 }}
                >
                  {locationLabel ? `${locationLabel} · Manager` : 'Manager'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={ds.icon(16)} color={color.ink3} />
            </View>
          </Card>
        </TouchableOpacity>

        {settingsGroups.map((group: SettingsGroupModel) => (
          <React.Fragment key={group.key}>
            <SectionLabel>{group.label}</SectionLabel>
            <SettingsCard>
              {group.items.map((item, index) => (
                <SettingsCardRow
                  key={item.key}
                  icon={item.icon}
                  title={item.title}
                  subtitle={item.subtitle}
                  onPress={item.onPress}
                  showChevron={item.chevron}
                  rightElement={
                    item.rightText ? (
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: ds.spacing(space[1] + 1),
                        }}
                      >
                        <Text
                          style={{
                            fontSize: ds.fontSize(typeScale.secondary),
                            color: color.ink3,
                          }}
                        >
                          {item.rightText}
                        </Text>
                        <Ionicons name="chevron-down" size={ds.icon(16)} color={color.ink3} />
                      </View>
                    ) : undefined
                  }
                  isLast={index === group.items.length - 1}
                />
              ))}
            </SettingsCard>
          </React.Fragment>
        ))}

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
