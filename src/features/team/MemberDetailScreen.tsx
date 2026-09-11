// Employee detail: works-at (changeable anytime), feature toggles, Reset PIN,
// and Preview as <Name>. Toggles write user_modules live; works-at goes
// through the manager-gated set_user_default_location RPC.

import { useCallback, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useShallow } from 'zustand/react/shallow';
import { ManagerScaleContainer } from '@/components/ManagerScaleContainer';
import {
  Button,
  Card,
  EmptyState,
  Input,
  ListRow,
  Loading,
  ScreenHeader,
  Sheet,
} from '@/components/ui';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { useSettingsNavigationContext } from '@/hooks/useSettingsBackRoute';
import { useAuthStore } from '@/store';
import { triggerNotificationHaptic, NotificationFeedbackType } from '@/lib/haptics';
import { color, space, typeScale, weight } from '@/theme/tokens';
import { listManagedUsers, type ManagedUser } from '@/services/userManagement';
import { getModulesForUser, setUserModule, type ModuleKey } from '@/services/userModules';
import {
  getManageableModuleKeys,
  resolveEffectiveModules,
  type EffectiveModules,
} from '@/store/moduleStore.helpers';
import { isValidPin, resetUserCredential } from '@/services/loginCredentials';
import type { InviteLocationGroup } from '@/services/invites';
import {
  fetchDefaultLocationIds,
  fetchLoginCredentialInfo,
  groupForLocationId,
  locationIdForGroup,
  setUserDefaultLocation,
  type LoginCredentialInfo,
} from './teamService';
import { ModuleToggleRow, TeamCard, TeamSectionLabel, WorksAtSegmented } from './components/TeamUI';

/** Screen-local labels per the flow spec. */
const DETAIL_MODULE_LABELS: Partial<Record<ModuleKey, string>> = {
  ordering_simple: 'Ordering checklist',
  ordering_advanced: 'Advanced ordering',
  stock_check: 'Stock check',
  tips: 'Tips',
  fulfillment: 'Fulfillment',
};

export default function MemberDetailScreen() {
  const ds = useScaledStyles();
  const { backTo } = useSettingsNavigationContext();
  const params = useLocalSearchParams<{ userId?: string | string[] }>();
  const userId = (Array.isArray(params.userId) ? params.userId[0] : params.userId) ?? '';
  const { locations } = useAuthStore(useShallow((state) => ({ locations: state.locations })));

  const [user, setUser] = useState<ManagedUser | null>(null);
  const [modules, setModules] = useState<EffectiveModules | null>(null);
  const [group, setGroup] = useState<InviteLocationGroup>('both');
  const [credential, setCredential] = useState<LoginCredentialInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<ModuleKey | null>(null);
  const [groupSaving, setGroupSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [resetVisible, setResetVisible] = useState(false);
  const [resetPin, setResetPin] = useState('');
  const [resetBusy, setResetBusy] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const showNotice = (message: string) => {
    setNotice(message);
    setTimeout(() => setNotice(null), 2200);
  };

  const load = useCallback(async () => {
    if (!userId) return;
    setLoadError(null);
    try {
      const [users, locationIds, credentialInfo] = await Promise.all([
        listManagedUsers(),
        fetchDefaultLocationIds(),
        fetchLoginCredentialInfo(userId).catch(() => null),
      ]);
      const found = users.find((candidate) => candidate.id === userId) ?? null;
      if (!found) {
        setLoadError('This person is no longer on the roster.');
        return;
      }
      setUser(found);
      setCredential(credentialInfo);
      setGroup(groupForLocationId(locationIds.get(userId) ?? null, locations));
      const states = await getModulesForUser(userId).catch(() => null);
      setModules(resolveEffectiveModules(found.role, states));
    } catch (error) {
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
      showNotice('Works-at updated.');
    } catch (error) {
      setGroup(previous);
      Alert.alert('Update failed', error instanceof Error ? error.message : 'Try again.');
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
      showNotice(`${DETAIL_MODULE_LABELS[key] ?? key} ${enabled ? 'on' : 'off'}.`);
    } catch (error) {
      setModules(previous);
      Alert.alert('Update failed', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setPendingKey(null);
    }
  };

  const handleResetSubmit = () => {
    if (!user) return;
    if (!isValidPin(resetPin)) {
      setResetError('PIN must be exactly 4 digits');
      return;
    }
    Alert.alert(
      `Reset ${user.full_name ?? 'this'} PIN?`,
      `They sign in with ${resetPin} from now on.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setResetBusy(true);
              setResetError(null);
              try {
                await resetUserCredential(user.id, resetPin);
                triggerNotificationHaptic(NotificationFeedbackType.Success);
                setResetVisible(false);
                setResetPin('');
                setCredential({ kind: 'pin', updatedAt: new Date().toISOString() });
                showNotice('PIN reset.');
              } catch (error) {
                setResetError(error instanceof Error ? error.message : 'Unable to reset the PIN.');
              } finally {
                setResetBusy(false);
              }
            })();
          },
        },
      ],
    );
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace(backTo);
  };

  const displayName = user?.full_name ?? 'Team member';
  const manageableKeys = user ? getManageableModuleKeys(user.role) : [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.page }} edges={['left', 'right']}>
      <ManagerScaleContainer>
        <ScreenHeader
          mode="pushed"
          title={displayName}
          subtitle={
            user?.is_suspended
              ? 'Suspended'
              : credential
                ? `Signs in with a ${credential.kind === 'pin' ? 'PIN' : 'password'}`
                : 'No app sign-in set up yet'
          }
          onBack={handleBack}
        />

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: ds.spacing(space[4]),
            paddingBottom: ds.spacing(space[8]),
          }}
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
              {notice ? (
                <Card style={{ marginTop: ds.spacing(space[2]) }}>
                  <Text
                    accessibilityRole="alert"
                    style={{
                      fontSize: ds.fontSize(typeScale.secondary),
                      fontWeight: weight.semibold,
                      color: color.ink,
                    }}
                  >
                    {notice}
                  </Text>
                </Card>
              ) : null}

              <TeamSectionLabel label="Works at · change anytime" />
              <WorksAtSegmented value={group} onChange={(next) => void handleGroupChange(next)} disabled={groupSaving} />

              <TeamSectionLabel label="Features" />
              <TeamCard style={{ paddingHorizontal: ds.spacing(space[3] + 2) }}>
                {modules ? (
                  manageableKeys.map((key, index) => (
                    <ModuleToggleRow
                      key={key}
                      label={DETAIL_MODULE_LABELS[key] ?? key}
                      value={modules[key]}
                      disabled={pendingKey !== null}
                      showBorder={index < manageableKeys.length - 1}
                      onChange={(value) => void handleModuleChange(key, value)}
                    />
                  ))
                ) : (
                  <View style={{ paddingVertical: ds.spacing(space[4]) }}>
                    <Loading size="inline" label="Loading features" style={{ alignItems: 'center' }} />
                  </View>
                )}
              </TeamCard>

              <View style={{ height: ds.spacing(space[2]) }} />
              <Card flush style={{ paddingHorizontal: ds.spacing(space[3] + 2) }}>
                <ListRow
                  icon="key-outline"
                  title={`Reset ${displayName.split(' ')[0]}'s PIN`}
                  chevron
                  last
                  disabled={user.is_suspended}
                  onPress={() => {
                    setResetPin('');
                    setResetError(null);
                    setResetVisible(true);
                  }}
                />
              </Card>

              <Button
                icon="eye-outline"
                label={`Preview as ${displayName.split(' ')[0]}`}
                onPress={() =>
                  router.push({
                    pathname: '/(manager)/manager-settings/team-preview',
                    params: { userId: user.id, name: displayName, group },
                  } as Parameters<typeof router.push>[0])
                }
                style={{ marginTop: ds.spacing(space[3]) }}
              />
            </>
          ) : null}
        </ScrollView>

        <Sheet
          visible={resetVisible}
          title={`Reset ${displayName.split(' ')[0]}'s PIN`}
          onClose={() => {
            if (!resetBusy) setResetVisible(false);
          }}
        >
          <Text style={{ fontSize: ds.fontSize(typeScale.secondary), color: color.ink2 }}>
            Type a new 4-digit PIN. Tell them in person.
          </Text>
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
          <Button
            label="Reset PIN"
            loading={resetBusy}
            disabled={resetPin.length !== 4}
            onPress={handleResetSubmit}
          />
          <Button
            variant="secondary"
            label="Cancel"
            disabled={resetBusy}
            accessibilityHint="Leaves the PIN unchanged"
            onPress={() => setResetVisible(false)}
          />
        </Sheet>
      </ManagerScaleContainer>
    </SafeAreaView>
  );
}
