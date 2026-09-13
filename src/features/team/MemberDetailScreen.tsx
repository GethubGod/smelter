// Employee detail: works-at (changeable anytime), feature toggles, Reset PIN,
// and Preview as <Name>. Toggles write user_modules live; works-at goes
// through the manager-gated set_user_default_location RPC.

import { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useShallow } from 'zustand/react/shallow';
import {
  Button,
  EmptyState,
  Input,
  Loading,
  ScreenHeader,
  Sheet,
  getTabBarClearance,
} from '@/components/ui';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { useSettingsNavigationContext } from '@/hooks/useSettingsBackRoute';
import { useAuthStore } from '@/store';
import { showNotice } from '@/components/ui/NoticeSheet';
import { showStudioToast } from '@/components/ui/StudioToast';
import { triggerNotificationHaptic, NotificationFeedbackType } from '@/lib/haptics';
import { color, space } from '@/theme/tokens';
import { listManagedUsers, type ManagedUser } from '@/services/userManagement';
import { getModulesForUser, setUserModule, type ModuleKey } from '@/services/userModules';
import {
  resolveEffectiveModules,
  type EffectiveModules,
} from '@/store/moduleStore.helpers';
import { isValidPin, resetUserCredential } from '@/services/loginCredentials';
import type { InviteLocationGroup } from '@/services/invites';
import {
  fetchDefaultLocationIds,
  groupForLocationId,
  locationIdForGroup,
  setUserDefaultLocation,
} from './teamService';
import { ModuleToggleRow, TeamCard, TeamSectionLabel, WorksAtSegmented } from './components/TeamUI';

/** Screen-local labels per the flow spec. */
const DETAIL_MODULE_LABELS: Partial<Record<ModuleKey, string>> = {
  ordering_simple: 'Checklist ordering',
  tips: 'Tips',
};
const DETAIL_MODULE_KEYS: readonly ModuleKey[] = ['ordering_simple', 'tips'];

export default function MemberDetailScreen() {
  const ds = useScaledStyles();
  const { backTo } = useSettingsNavigationContext();
  const params = useLocalSearchParams<{ userId?: string | string[] }>();
  const userId = (Array.isArray(params.userId) ? params.userId[0] : params.userId) ?? '';
  const { locations } = useAuthStore(useShallow((state) => ({ locations: state.locations })));

  const [user, setUser] = useState<ManagedUser | null>(null);
  const [modules, setModules] = useState<EffectiveModules | null>(null);
  const [group, setGroup] = useState<InviteLocationGroup>('both');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<ModuleKey | null>(null);
  const [groupSaving, setGroupSaving] = useState(false);

  const [resetVisible, setResetVisible] = useState(false);
  const [resetPin, setResetPin] = useState('');
  const [resetBusy, setResetBusy] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) {
      setUser(null);
      setModules(null);
      setLoadError('No team member was selected.');
      return;
    }
    setLoadError(null);
    try {
      const [users, locationIds] = await Promise.all([
        listManagedUsers(),
        fetchDefaultLocationIds(),
      ]);
      const found = users.find((candidate) => candidate.id === userId) ?? null;
      if (!found) {
        setUser(null);
        setModules(null);
        setLoadError('This person is no longer on the roster.');
        return;
      }
      const states = await getModulesForUser(userId);
      setUser(found);
      setGroup(groupForLocationId(locationIds.get(userId) ?? null, locations));
      setModules(resolveEffectiveModules(found.role, states));
    } catch (error) {
      setUser(null);
      setModules(null);
      setLoadError(error instanceof Error ? error.message : 'Unable to load this person.');
    }
  }, [userId, locations]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const handleGroupChange = async (nextGroup: InviteLocationGroup) => {
    if (!user || groupSaving || nextGroup === group) return;
    const previous = group;
    setGroup(nextGroup);
    setGroupSaving(true);
    try {
      await setUserDefaultLocation(user.id, locationIdForGroup(nextGroup, locations));
      showStudioToast('Works at updated');
    } catch (error) {
      setGroup(previous);
      showNotice('Update failed', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setGroupSaving(false);
    }
  };

  const handleModuleChange = async (key: ModuleKey, enabled: boolean) => {
    if (!user || !modules || pendingKey) return;
    const previous = modules;
    setModules({ ...modules, [key]: enabled });
    setPendingKey(key);
    try {
      await setUserModule(user.id, key, enabled);
      showStudioToast(`${DETAIL_MODULE_LABELS[key] ?? key} ${enabled ? 'on' : 'off'}`);
    } catch (error) {
      setModules(previous);
      showNotice('Update failed', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setPendingKey(null);
    }
  };

  const handleResetSubmit = async () => {
    if (!user) return;
    if (!isValidPin(resetPin)) {
      setResetError('PIN must be exactly 4 digits');
      return;
    }
    setResetBusy(true);
    setResetError(null);
    try {
      await resetUserCredential(user.id, resetPin);
      void triggerNotificationHaptic(NotificationFeedbackType.Success);
      setResetVisible(false);
      setResetPin('');
      showStudioToast('PIN reset');
    } catch (error) {
      setResetError(error instanceof Error ? error.message : 'Unable to reset the PIN.');
    } finally {
      setResetBusy(false);
    }
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace(backTo);
  };

  const displayName = user?.full_name ?? 'Team member';
  const firstName = displayName.trim().split(/\s+/)[0] || 'member';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.page }} edges={['left', 'right']}>
      <ScreenHeader
        mode="pushed"
        title={displayName}
        onBack={handleBack}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: ds.spacing(space[4]),
          paddingBottom: getTabBarClearance(0),
        }}
        showsVerticalScrollIndicator={false}
      >
        {loadError ? (
          <EmptyState
            icon="alert-circle-outline"
            tone="alert"
            title="Unable to load this person"
            body={loadError}
            action={{ label: 'Retry', onPress: () => void load() }}
            compact
          />
        ) : null}

        {!user && !loadError ? (
          <View style={{ paddingVertical: ds.spacing(space[8]) }}>
            <Loading size="inline" label="Loading this person" style={{ alignItems: 'center' }} />
          </View>
        ) : null}

        {user ? (
          <>
            <TeamSectionLabel label="Works at" />
            <WorksAtSegmented
              value={group}
              onChange={(next) => void handleGroupChange(next)}
              disabled={groupSaving}
            />

            <TeamSectionLabel label="Features" />
            <TeamCard>
              {modules ? (
                DETAIL_MODULE_KEYS.map((key, index) => (
                  <ModuleToggleRow
                    key={key}
                    label={DETAIL_MODULE_LABELS[key] ?? key}
                    value={modules[key]}
                    disabled={pendingKey !== null}
                    showBorder={index < DETAIL_MODULE_KEYS.length - 1}
                    onChange={(value) => void handleModuleChange(key, value)}
                  />
                ))
              ) : (
                <View style={{ paddingVertical: ds.spacing(space[4]) }}>
                  <Loading size="inline" label="Loading features" style={{ alignItems: 'center' }} />
                </View>
              )}
            </TeamCard>

            <View
              style={{
                marginTop: ds.spacing(space[4]),
                gap: ds.spacing(space[2] + 2),
              }}
            >
              <Button
                variant="secondary"
                label={`Reset ${firstName}'s PIN`}
                disabled={user.is_suspended}
                onPress={() => {
                  setResetPin('');
                  setResetError(null);
                  setResetVisible(true);
                }}
              />
              <Button
                variant="secondary"
                label={`Preview as ${firstName}`}
                onPress={() =>
                  router.push({
                    pathname: '/(manager)/manager-settings/team-preview',
                    params: {
                      userId: user.id,
                      name: displayName,
                      group,
                      origin: 'manager',
                      backTo: String(backTo),
                    },
                  })
                }
              />
            </View>
          </>
        ) : null}
      </ScrollView>

      <Sheet
        visible={resetVisible}
        title={`Reset ${firstName}'s PIN`}
        subtitle="Type a new 4-digit PIN. Tell them in person."
        dismissible={!resetBusy}
        onClose={() => {
          if (!resetBusy) setResetVisible(false);
        }}
        primary={{
          label: 'Reset PIN',
          loading: resetBusy,
          disabled: resetPin.length !== 4,
          onPress: () => void handleResetSubmit(),
        }}
      >
        <Input
          value={resetPin}
          onChangeText={(value) => {
            setResetPin(value.replace(/[^0-9]/g, '').slice(0, 4));
            if (resetError) setResetError(null);
          }}
          accessibilityLabel="New PIN"
          placeholder="New 4-digit PIN"
          keyboardType="number-pad"
          secureTextEntry
          maxLength={4}
          editable={!resetBusy}
          autoFocus
          error={resetError ?? undefined}
        />
      </Sheet>
    </SafeAreaView>
  );
}
