// Manager Team list: live roster with a per-person feature summary and the
// "New employee defaults" entry pinned at the bottom.

import { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useShallow } from 'zustand/react/shallow';
import { Button, Card, EmptyState, ListRow, Loading, ScreenHeader, SectionLabel } from '@/components/ui';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { useSettingsNavigationContext } from '@/hooks/useSettingsBackRoute';
import { buildSettingsHref } from '@/lib/settingsNavigation';
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

type DefaultsStatus = 'loading' | 'ready' | 'error';

function summarizeDefaults(
  defaults: EmployeeInviteDefaults | null,
  status: DefaultsStatus,
): string {
  if (status === 'loading') return 'Loading defaults';
  if (status === 'error' || !defaults) return 'Defaults unavailable';

  const extraLabels = [
    defaults.ordering_advanced ? 'Advanced ordering' : null,
    defaults.stock_check ? 'Stock check' : null,
    defaults.tips ? 'Tips' : null,
  ].filter((label): label is string => label !== null);
  const extras = extraLabels.length === 0
    ? 'everything else off'
    : `${extraLabels.join(', ')} on`;
  return `Checklist ${defaults.ordering_simple ? 'on' : 'off'} · ${extras}`;
}

export default function TeamScreen() {
  const ds = useScaledStyles();
  const { backTo } = useSettingsNavigationContext();
  const { locations } = useAuthStore(useShallow((state) => ({ locations: state.locations })));

  const [roster, setRoster] = useState<RosterEntry[] | null>(null);
  const [defaults, setDefaults] = useState<EmployeeInviteDefaults | null>(null);
  const [defaultsStatus, setDefaultsStatus] = useState<DefaultsStatus>('loading');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setDefaultsStatus('loading');
    try {
      const [users, locationIds, defaultsResult] = await Promise.all([
        listManagedUsers(),
        fetchDefaultLocationIds(),
        getEmployeeInviteDefaults()
          .then((value) => ({ status: 'ready' as const, value }))
          .catch(() => ({ status: 'error' as const, value: null })),
      ]);
      setDefaults(defaultsResult.value);
      setDefaultsStatus(defaultsResult.status);

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

  const defaultsSummary = summarizeDefaults(defaults, defaultsStatus);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.page }} edges={['left', 'right']}>
      <ScreenHeader
        mode="pushed"
        title="Team"
        onBack={handleBack}
        right={
          <Button
            size="small"
            label="Invite"
            onPress={() =>
              router.push(
                buildSettingsHref('/(manager)/manager-settings/team-invite', {
                  origin: 'manager',
                  backTo,
                }),
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
        showsVerticalScrollIndicator={false}
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

        {roster && roster.length > 0 ? (
          <Card flush>
            {roster.map(({ user, modules, locationId }, index) => {
              const group = groupForLocationId(locationId, locations);
              const locationSummary = LOCATION_GROUP_LABELS[group];
              const summary = `${locationSummary} · ${
                user.is_suspended ? 'Suspended' : summarizeModules(modules)
              }`;
              return (
                <TeamRow
                  key={user.id}
                  initial={(user.full_name ?? user.email ?? '?').trim().charAt(0).toUpperCase() || '?'}
                  title={user.full_name ?? user.email ?? 'Unnamed'}
                  subtitle={summary}
                  last={index === roster.length - 1}
                  onPress={() =>
                    router.push({
                      pathname: '/(manager)/manager-settings/team-member',
                      params: { userId: user.id, origin: 'manager', backTo: String(backTo) },
                    })
                  }
                />
              );
            })}
          </Card>
        ) : null}

        {roster !== null ? (
          <>
            <SectionLabel>Defaults</SectionLabel>
            <Card flush>
              <ListRow
                icon="sparkles-outline"
                title="New employee defaults"
                subtitle={defaultsSummary}
                chevron
                last
                onPress={() =>
                  router.push(
                    buildSettingsHref('/(manager)/manager-settings/team-defaults', {
                      origin: 'manager',
                      backTo,
                    }),
                  )
                }
              />
            </Card>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
