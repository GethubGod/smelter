import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Platform,
  RefreshControl,
  ScrollView,
  Switch,
  Text,
  ToastAndroid,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  Input,
  ListRow,
  Loading,
  ScreenHeader,
  StatusPill,
  type StatusTone,
} from '@/components/ui';
import { useAuthStore } from '@/store';
import { ManagerScaleContainer } from '@/components/ManagerScaleContainer';
import { useManagedRefresh } from '@/hooks/useManagedRefresh';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { useSettingsNavigationContext } from '@/hooks/useSettingsBackRoute';
import { color, radius, size, space, typeScale, weight } from '@/theme/tokens';
import { ManagedUser, listManagedUsers, setManagedUserSuspended } from '@/services/userManagement';
import { getModulesForUser, setUserModule, type ModuleKey } from '@/services/userModules';
import {
  getManageableModuleKeys,
  MODULE_LABELS,
  resolveEffectiveModules,
  type EffectiveModules,
} from '@/store/moduleStore.helpers';

type UserFilter = 'all' | 'employees' | 'managers' | 'active' | 'inactive' | 'suspended';

type ModuleRowState = {
  isLoading: boolean;
  error: string | null;
  modules: EffectiveModules | null;
  pendingKey: ModuleKey | null;
};

const FILTER_OPTIONS: { key: UserFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'employees', label: 'Employees' },
  { key: 'managers', label: 'Managers' },
  { key: 'active', label: 'Active' },
  { key: 'inactive', label: 'Inactive (30d+)' },
  { key: 'suspended', label: 'Suspended' },
];

const INACTIVE_THRESHOLD_DAYS = 30;
const SEARCH_DEBOUNCE_MS = 220;
const MANAGERS_ONLY_MESSAGE = 'Managers only';
const SUSPEND_CONFIRM_MESSAGE =
  'They will be signed out and will not be able to sign in again until reinstated.';

function toDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysSince(value: Date | null): number | null {
  if (!value) return null;
  const delta = Date.now() - value.getTime();
  if (delta < 0) return 0;
  return Math.floor(delta / (1000 * 60 * 60 * 24));
}

function formatDaysAgo(prefix: string, date: Date): string {
  const days = daysSince(date) ?? 0;
  if (days === 0) return `${prefix}: today`;
  if (days === 1) return `${prefix}: 1 day ago`;
  return `${prefix}: ${days} days ago`;
}

function getInactiveReferenceDate(user: ManagedUser): Date | null {
  return toDate(user.last_order_at) ?? toDate(user.last_active_at);
}

function isInactive30d(user: ManagedUser): boolean {
  if (user.is_suspended) return false;
  const referenceDate = getInactiveReferenceDate(user);
  const elapsedDays = daysSince(referenceDate);
  return elapsedDays !== null && elapsedDays >= INACTIVE_THRESHOLD_DAYS;
}

function formatLastActivity(user: ManagedUser): string {
  const lastOrder = toDate(user.last_order_at);
  if (lastOrder) return formatDaysAgo('Last order', lastOrder);

  const lastActive = toDate(user.last_active_at);
  if (lastActive) return formatDaysAgo('Last active', lastActive);

  const createdAt = toDate(user.created_at);
  if (createdAt) {
    return `Joined ${createdAt.toLocaleDateString()}`;
  }

  return 'No activity recorded';
}

function getInitials(user: ManagedUser): string {
  const base = user.full_name?.trim() || user.email.trim() || 'User';
  const words = base.split(/\s+/).filter(Boolean);

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return `${words[0][0] ?? ''}${words[1][0] ?? ''}`.toUpperCase();
}

export default function UserManagementScreen() {
  const ds = useScaledStyles();
  const { backTo } = useSettingsNavigationContext('manager');
  const { user: currentUser, profile, session, isInitialized } = useAuthStore();

  const metadataRole =
    typeof session?.user?.user_metadata?.role === 'string'
      ? session.user.user_metadata.role
      : typeof session?.user?.app_metadata?.role === 'string'
        ? session.user.app_metadata.role
        : null;

  const resolvedRole = currentUser?.role ?? profile?.role ?? metadataRole;
  const isManager = resolvedRole === 'manager';
  const currentUserId = currentUser?.id ?? session?.user?.id ?? null;

  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<UserFilter>('all');
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  // Phase 3 in-app mirror of the dashboard module matrix: per-user module
  // toggles, lazily loaded when a row's "Modules" section is expanded.
  const [expandedModulesUserId, setExpandedModulesUserId] = useState<string | null>(null);
  const [modulesByUser, setModulesByUser] = useState<Record<string, ModuleRowState>>({});

  const redirectedForManagerGuardRef = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim().toLowerCase());
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (!noticeMessage) return;

    const timer = setTimeout(() => {
      setNoticeMessage(null);
    }, 2200);

    return () => clearTimeout(timer);
  }, [noticeMessage]);

  useEffect(() => {
    if (!isInitialized || !session || isManager || redirectedForManagerGuardRef.current) {
      return;
    }

    redirectedForManagerGuardRef.current = true;

    if (Platform.OS === 'android') {
      ToastAndroid.show(MANAGERS_ONLY_MESSAGE, ToastAndroid.SHORT);
    } else {
      Alert.alert(MANAGERS_ONLY_MESSAGE);
    }

    router.replace('/(tabs)/settings');
  }, [isInitialized, isManager, session]);

  const loadUsers = useCallback(
    async (isRefresh = false) => {
      if (!isManager) {
        setIsLoading(false);
        return;
      }

      if (!isRefresh) {
        setIsLoading(true);
      }

      setErrorMessage(null);

      try {
        const rows = await listManagedUsers();
        setUsers(rows);
      } catch (error: any) {
        console.error('Failed to load user management list', error);
        setErrorMessage(error?.message || 'Unable to load users.');
      } finally {
        setIsLoading(false);
      }
    },
    [isManager]
  );

  useFocusEffect(
    useCallback(() => {
      if (!isManager) return;
      loadUsers();
    }, [isManager, loadUsers])
  );

  const filteredUsers = useMemo(() => {
    return users.filter((candidate) => {
      const matchesSearch =
        debouncedSearch.length === 0 ||
        candidate.email.toLowerCase().includes(debouncedSearch) ||
        (candidate.full_name ?? '').toLowerCase().includes(debouncedSearch);

      if (!matchesSearch) return false;

      switch (selectedFilter) {
        case 'employees':
          return candidate.role === 'employee';
        case 'managers':
          return candidate.role === 'manager';
        case 'active':
          return !candidate.is_suspended;
        case 'inactive':
          return isInactive30d(candidate);
        case 'suspended':
          return candidate.is_suspended;
        case 'all':
        default:
          return true;
      }
    });
  }, [debouncedSearch, selectedFilter, users]);

  const { refreshing, onRefresh: handleRefresh } = useManagedRefresh(
    useCallback(async () => {
      await loadUsers(true);
    }, [loadUsers]),
  );

  const applySuspensionUpdate = useCallback(
    async (targetUser: ManagedUser, nextSuspended: boolean) => {
      if (targetUser.id === currentUserId) {
        Alert.alert('Action blocked', 'You cannot suspend your own account.');
        return;
      }

      setUpdatingUserId(targetUser.id);

      try {
        await setManagedUserSuspended({
          userId: targetUser.id,
          isSuspended: nextSuspended,
        });

        setUsers((previous) =>
          previous.map((entry) => {
            if (entry.id !== targetUser.id) {
              return entry;
            }

            return {
              ...entry,
              is_suspended: nextSuspended,
              suspended_at: nextSuspended ? new Date().toISOString() : null,
              suspended_by: nextSuspended ? currentUserId : null,
            };
          })
        );

        setNoticeMessage(nextSuspended ? 'Employee suspended.' : 'Employee reinstated.');
      } catch (error: any) {
        console.error('Failed to change suspension state', error);
        Alert.alert('Update failed', error?.message || 'Unable to update suspension state.');
      } finally {
        setUpdatingUserId(null);
      }
    },
    [currentUserId]
  );

  const handleSuspensionPress = useCallback(
    (targetUser: ManagedUser) => {
      const nextSuspended = !targetUser.is_suspended;

      if (nextSuspended) {
        Alert.alert('Suspend employee?', SUSPEND_CONFIRM_MESSAGE, [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Suspend',
            style: 'destructive',
            onPress: () => {
              applySuspensionUpdate(targetUser, true);
            },
          },
        ]);
        return;
      }

      Alert.alert('Reinstate employee?', 'They will be able to sign in again.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reinstate',
          onPress: () => {
            applySuspensionUpdate(targetUser, false);
          },
        },
      ]);
    },
    [applySuspensionUpdate]
  );

  const loadModulesForUser = useCallback(async (targetUser: ManagedUser) => {
    setModulesByUser((previous) => ({
      ...previous,
      [targetUser.id]: {
        isLoading: true,
        error: null,
        modules: previous[targetUser.id]?.modules ?? null,
        pendingKey: null,
      },
    }));

    try {
      const states = await getModulesForUser(targetUser.id);
      setModulesByUser((previous) => ({
        ...previous,
        [targetUser.id]: {
          isLoading: false,
          error: null,
          modules: resolveEffectiveModules(targetUser.role, states),
          pendingKey: null,
        },
      }));
    } catch (error: any) {
      console.error('Failed to load user modules', error);
      setModulesByUser((previous) => ({
        ...previous,
        [targetUser.id]: {
          isLoading: false,
          error: error?.message || 'Unable to load modules.',
          modules: previous[targetUser.id]?.modules ?? null,
          pendingKey: null,
        },
      }));
    }
  }, []);

  const handleModulesTogglePress = useCallback(
    (targetUser: ManagedUser) => {
      setExpandedModulesUserId((previous) => {
        const next = previous === targetUser.id ? null : targetUser.id;
        return next;
      });

      const existing = modulesByUser[targetUser.id];
      if (expandedModulesUserId !== targetUser.id && !existing?.modules && !existing?.isLoading) {
        void loadModulesForUser(targetUser);
      }
    },
    [expandedModulesUserId, loadModulesForUser, modulesByUser]
  );

  const handleModuleValueChange = useCallback(
    async (targetUser: ManagedUser, moduleKey: ModuleKey, nextEnabled: boolean) => {
      const current = modulesByUser[targetUser.id];
      if (!current?.modules || current.pendingKey) return;

      const previousModules = current.modules;

      // Optimistic flip with rollback on error, mirroring the dashboard matrix.
      setModulesByUser((previous) => ({
        ...previous,
        [targetUser.id]: {
          ...current,
          modules: { ...previousModules, [moduleKey]: nextEnabled },
          pendingKey: moduleKey,
        },
      }));

      try {
        await setUserModule(targetUser.id, moduleKey, nextEnabled);
        setModulesByUser((previous) => {
          const row = previous[targetUser.id];
          if (!row) return previous;
          return {
            ...previous,
            [targetUser.id]: { ...row, pendingKey: null },
          };
        });
        setNoticeMessage(
          `${MODULE_LABELS[moduleKey]} ${nextEnabled ? 'enabled' : 'disabled'}.`
        );
      } catch (error: any) {
        console.error('Failed to change module state', error);
        setModulesByUser((previous) => {
          const row = previous[targetUser.id];
          if (!row) return previous;
          return {
            ...previous,
            [targetUser.id]: {
              ...row,
              modules: previousModules,
              pendingKey: null,
            },
          };
        });
        Alert.alert('Update failed', error?.message || 'Unable to update the module.');
      }
    },
    [modulesByUser]
  );

  const renderRow = ({ item }: { item: ManagedUser }) => {
    const isUpdating = updatingUserId === item.id;
    const inactive = isInactive30d(item);
    const moduleRow = modulesByUser[item.id];
    const loadedModules = moduleRow?.modules ?? null;
    const isModulesExpanded = expandedModulesUserId === item.id;
    const manageableKeys = getManageableModuleKeys(item.role);

    const roleLabel = item.role === 'manager' ? 'Manager' : 'Employee';

    // Account status reuses the contract pill: the same three tones the order
    // states use, relabelled, so the dot and the word always travel together.
    const status: { tone: StatusTone; label: string } = item.is_suspended
      ? { tone: 'cancelled', label: 'Suspended' }
      : inactive
        ? { tone: 'submitted', label: 'Inactive' }
        : { tone: 'fulfilled', label: 'Active' };

    return (
      <Card style={{ marginBottom: ds.spacing(space[3]) }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: ds.spacing(space[3]) }}>
          <View
            style={{
              width: ds.icon(42),
              height: ds.icon(42),
              borderRadius: radius.pill,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: color.well,
            }}
          >
            <Text
              style={{
                fontSize: ds.fontSize(typeScale.secondary),
                fontWeight: weight.bold,
                color: color.ink2,
              }}
            >
              {getInitials(item)}
            </Text>
          </View>

          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: ds.fontSize(typeScale.body),
                fontWeight: weight.semibold,
                color: color.ink,
              }}
            >
              {item.full_name || 'Unnamed user'}
            </Text>
            <Text style={{ fontSize: ds.fontSize(typeScale.secondary), color: color.ink2 }}>
              {item.email || 'No email on file'}
            </Text>
            <Text style={{ fontSize: ds.fontSize(typeScale.secondary), color: color.ink3 }}>
              {roleLabel} · {formatLastActivity(item)}
            </Text>
          </View>

          <StatusPill status={status.tone} label={status.label} />
        </View>

        {item.role === 'employee' ? (
          <Button
            variant={item.is_suspended ? 'secondary' : 'destructive'}
            label={item.is_suspended ? 'Reinstate' : 'Suspend'}
            loading={isUpdating}
            onPress={() => handleSuspensionPress(item)}
            style={{ marginTop: ds.spacing(space[3]) }}
          />
        ) : null}

        {/* Per-user module toggles (in-app mirror of the dashboard matrix). */}
        <ListRow
          title="Modules"
          onPress={() => handleModulesTogglePress(item)}
          last
          right={
            <Ionicons
              name={isModulesExpanded ? 'chevron-up' : 'chevron-down'}
              size={ds.icon(16)}
              color={color.ink3}
            />
          }
        />

        {isModulesExpanded ? (
          <View
            style={{
              borderRadius: radius.control,
              paddingHorizontal: ds.spacing(space[3]),
              backgroundColor: color.well,
            }}
          >
            {moduleRow?.isLoading && !loadedModules ? (
              <View style={{ paddingVertical: ds.spacing(space[3]) }}>
                <Loading size="inline" label="Loading modules" style={{ alignItems: 'center' }} />
              </View>
            ) : moduleRow?.error && !loadedModules ? (
              <EmptyState
                icon="alert-circle-outline"
                tone="alert"
                title="Unable to load modules"
                body={moduleRow.error}
                action={{ label: 'Retry', onPress: () => void loadModulesForUser(item) }}
                compact
              />
            ) : loadedModules ? (
              manageableKeys.map((moduleKey, index) => (
                <ListRow
                  key={moduleKey}
                  title={MODULE_LABELS[moduleKey]}
                  last={index === manageableKeys.length - 1}
                  right={
                    <Switch
                      value={loadedModules[moduleKey]}
                      disabled={moduleRow?.pendingKey != null}
                      accessibilityLabel={MODULE_LABELS[moduleKey]}
                      onValueChange={(nextEnabled) =>
                        void handleModuleValueChange(item, moduleKey, nextEnabled)
                      }
                      trackColor={{ false: color.hairlineStrong, true: color.accent }}
                      thumbColor={Platform.OS === 'android' ? color.card : undefined}
                      ios_backgroundColor={color.hairlineStrong}
                    />
                  }
                />
              ))
            ) : null}
          </View>
        ) : null}
      </Card>
    );
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace(backTo);
  };

  if (!isInitialized) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: color.page }} edges={['top', 'left', 'right']}>
        <Loading label="Loading users" />
      </SafeAreaView>
    );
  }

  if (session && !isManager) {
    return null;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.page }} edges={['left', 'right']}>
      <ManagerScaleContainer>
        <ScreenHeader
          mode="pushed"
          title="User management"
          subtitle="Manager-only account oversight"
          onBack={handleBack}
        />

        <View style={{ paddingHorizontal: ds.spacing(space[4]) }}>
          <View>
            <Input
              placeholder="Search by name or email"
              accessibilityLabel="Search by name or email"
              value={searchInput}
              onChangeText={setSearchInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchInput.length > 0 ? (
              <TouchableOpacity
                onPress={() => setSearchInput('')}
                accessibilityRole="button"
                accessibilityLabel="Clear the search"
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 0,
                  bottom: 0,
                  width: Math.max(size.touchMin, ds.icon(size.touchMin)),
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="close-circle" size={ds.icon(size.icon)} color={color.ink3} />
              </TouchableOpacity>
            ) : null}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            // Bleed past the screen gutter so the trailing chip scrolls fully
            // into view instead of being cut off at the right edge.
            style={{ marginHorizontal: -ds.spacing(space[4]) }}
            contentContainerStyle={{
              gap: ds.spacing(space[2]),
              paddingTop: ds.spacing(space[3]),
              paddingBottom: ds.spacing(space[1] - 2),
              paddingLeft: ds.spacing(space[4]),
              paddingRight: ds.spacing(space[4]),
            }}
          >
            {FILTER_OPTIONS.map((option) => (
              <Chip
                key={option.key}
                label={option.label}
                selected={option.key === selectedFilter}
                onPress={() => setSelectedFilter(option.key)}
              />
            ))}
          </ScrollView>
        </View>

        {noticeMessage ? (
          <Text
            accessibilityRole="alert"
            style={{
              marginHorizontal: ds.spacing(space[4]),
              marginTop: ds.spacing(space[2]),
              fontSize: ds.fontSize(typeScale.secondary),
              fontWeight: weight.semibold,
              color: color.good,
            }}
          >
            {noticeMessage}
          </Text>
        ) : null}

        {errorMessage ? (
          <EmptyState
            icon="alert-circle-outline"
            tone="alert"
            title="Unable to load users"
            body={errorMessage}
            action={{ label: 'Retry', onPress: () => loadUsers() }}
            compact
          />
        ) : null}

        {isLoading && users.length === 0 ? (
          <Loading label="Loading users" />
        ) : (
          <FlatList
            data={filteredUsers}
            renderItem={renderRow}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{
              paddingHorizontal: ds.spacing(space[4]),
              paddingTop: ds.spacing(space[3]),
              paddingBottom: ds.spacing(space[6]),
              flexGrow: 1,
            }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={color.accent}
              />
            }
            ListEmptyComponent={
              <EmptyState
                icon="people-outline"
                title="No users found"
                body="Try adjusting your search or filters."
              />
            }
          />
        )}
      </ManagerScaleContainer>
    </SafeAreaView>
  );
}
