// Manager Team list: live roster with a per-person feature summary and the
// "New employee defaults" entry pinned at the bottom.

import { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useShallow } from 'zustand/react/shallow';
import { ManagerScaleContainer } from '@/components/ManagerScaleContainer';
import { Button, EmptyState, Loading, ScreenHeader } from '@/components/ui';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { useSettingsNavigationContext } from '@/hooks/useSettingsBackRoute';
import { useAuthStore } from '@/store';
import { color, space } from '@/theme/tokens';
import { listManagedUsers, type ManagedUser } from '@/services/userManagement';
import { getModulesForUser } from '@/services/userModules';
import {
  resolveEffectiveModules,
  type EffectiveModules,
} from '@/store/moduleStore.helpers';
import {
  getEmployeeInviteDefaults,
  type EmployeeInviteDefaults,
} from '@/services/employeeDefaults';
import { LOCATION_GROUP_LABELS } from './invitePreview';
import {
  fetchDefaultLocationIds,
  groupForLocationId,
  summarizeModules,
} from './teamService';
import { TeamRow } from './components/TeamUI';

interface RosterEntry {
  user: ManagedUser;
  modules: EffectiveModules | null;
  locationId: string | null;
}

export default function TeamScreen() {
  const ds = useScaledStyles();
  const { backTo } = useSettingsNavigationContext();
  const { locations } = useAuthStore(useShallow((state) => ({ locations: state.locations })));

  const [roster, setRoster] = useState<RosterEntry[] | null>(null);
  const [defaults, setDefaults] = useState<EmployeeInviteDefaults | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [users, locationIds, inviteDefaults] = await Promise.all([
        listManagedUsers(),
        fetchDefaultLocationIds(),
        getEmployeeInviteDefaults().catch(() => null),
      ]);
      setDefaults(inviteDefaults);

      const entries: RosterEntry[] = await Promise.all(
        users.map(async (user) => {
          const modules = await getModulesForUser(user.id)
            .then((states) => resolveEffectiveModules(user.role, states))
            .catch(() => resolveEffectiveModules(user.role, null));
          return { user, modules, locationId: locationIds.get(user.id) ?? null };
        }),
      );
      setRoster(entries);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load the team.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace(backTo);
  };

  const defaultsSummary = defaults
    ? summarizeModules({ ...defaults, fulfillment: false } as EffectiveModules)
    : 'Loading';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.page }} edges={['left', 'right']}>
      <ManagerScaleContainer>
        <ScreenHeader
          mode="pushed"
          title="Team"
          subtitle="Invites, features, and sign-in resets"
          onBack={handleBack}
          right={
            <Button
              size="small"
              icon="add"
              label="Invite"
              onPress={() =>
                router.push(
                  '/(manager)/manager-settings/team-invite' as Parameters<typeof router.push>[0],
                )
              }
            />
          }
        />

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: ds.spacing(space[4]),
            paddingTop: ds.spacing(space[2]),
            paddingBottom: ds.spacing(space[8]),
          }}
        >
          {error ? (
            <EmptyState
              icon="alert-circle-outline"
              tone="alert"
              title="Unable to load the team"
              body={error}
              action={{ label: 'Retry', onPress: () => void load() }}
              compact
            />
          ) : null}

          {roster === null && !error ? (
            <View style={{ paddingVertical: ds.spacing(space[8]) }}>
              <Loading size="inline" label="Loading the team" style={{ alignItems: 'center' }} />
            </View>
          ) : null}

          {(roster ?? []).map(({ user, modules, locationId }) => {
            const group = groupForLocationId(locationId, locations);
            const summary = user.is_suspended
              ? 'Suspended'
              : `${LOCATION_GROUP_LABELS[group]} · ${summarizeModules(modules)}`;
            return (
              <TeamRow
                key={user.id}
                initial={(user.full_name ?? user.email ?? '?').trim().charAt(0).toUpperCase() || '?'}
                title={user.full_name ?? user.email ?? 'Unnamed'}
                subtitle={summary}
                onPress={() =>
                  router.push({
                    pathname: '/(manager)/manager-settings/team-member',
                    params: { userId: user.id },
                  } as Parameters<typeof router.push>[0])
                }
              />
            );
          })}

          {roster !== null ? (
            <TeamRow
              icon="options-outline"
              initial=""
              muted
              title="New employee defaults"
              subtitle={defaultsSummary === 'Nothing enabled' ? 'Everything off' : defaultsSummary}
              onPress={() =>
                router.push(
                  '/(manager)/manager-settings/team-defaults' as Parameters<typeof router.push>[0],
                )
              }
            />
          ) : null}
        </ScrollView>
      </ManagerScaleContainer>
    </SafeAreaView>
  );
}
