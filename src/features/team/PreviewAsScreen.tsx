// Preview as <Name>: renders the employee tab/module state for the target
// user, driven by their live get_effective_modules result through the SAME
// getVisibleEmployeeTabs logic the employee layout uses, a live render that
// cannot drift. Strictly read-only: this screen never writes anything.

import { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  Button,
  Card,
  EmptyState,
  ListRow,
  Loading,
  TabBar,
  getTabBarClearance,
  type TabBarItem,
} from '@/components/ui';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { auth, color, radius, size, space, tracking, typeScale, weight } from '@/theme/tokens';
import { getModulesForUser } from '@/services/userModules';
import {
  getVisibleEmployeeTabs,
  resolveEffectiveModules,
  type EffectiveModules,
} from '@/store/moduleStore.helpers';
import type { InviteLocationGroup } from '@/services/invites';
import { EMPLOYEE_TAB_META, LOCATION_GROUP_LABELS } from './invitePreview';

function param(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? '';
}

const TAB_DESCRIPTIONS: Record<string, string> = {
  'simple-order': 'Order: the daily checklist with usual amounts',
  'quick-order': 'Advanced: free-form ordering with the parser',
  cart: 'Cart: items staged before sending',
  history: 'History: past sent orders with one-tap reorder',
  settings: 'Settings: profile, reminders, and sign out',
};

export default function PreviewAsScreen() {
  const ds = useScaledStyles();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    userId?: string | string[];
    name?: string | string[];
    group?: string | string[];
  }>();
  const userId = param(params.userId);
  const name = param(params.name) || 'this person';
  const firstName = name.split(' ')[0];
  const groupParam = param(params.group);
  const group: InviteLocationGroup =
    groupParam === 'sushi' || groupParam === 'poki' || groupParam === 'both' ? groupParam : 'both';

  const [modules, setModules] = useState<EffectiveModules | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setError(null);
    try {
      const states = await getModulesForUser(userId);
      setModules(resolveEffectiveModules('employee', states));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load their settings.');
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const tabKeys = modules ? getVisibleEmployeeTabs(modules) : [];
  // The preview shows the real pill, in the real order, from the same list the
  // rows above use. It is an illustration, so it takes no touches and is not
  // announced twice: the rows above already read out every tab.
  const previewTabs: TabBarItem[] = tabKeys.map((key) => ({
    name: key,
    label: EMPLOYEE_TAB_META[key]?.label ?? key,
    icon: (EMPLOYEE_TAB_META[key]?.icon ?? 'ellipse-outline') as TabBarItem['icon'],
  }));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: auth.bg }} edges={['top', 'left', 'right']}>
      {/* Dark exit bar: the only chrome that is not part of the preview. */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: ds.spacing(space[2]),
          paddingHorizontal: ds.spacing(space[4]),
          paddingVertical: ds.spacing(space[2]),
          backgroundColor: auth.bg,
        }}
      >
        <Ionicons name="eye-outline" size={ds.icon(size.icon)} color={auth.text} />
        <Text
          style={{
            flex: 1,
            fontSize: ds.fontSize(typeScale.secondary),
            fontWeight: weight.semibold,
            color: auth.text,
          }}
        >
          Viewing as {firstName} · {LOCATION_GROUP_LABELS[group]}
        </Text>
        <Button
          variant="secondary"
          size="small"
          onDark
          label="Exit"
          accessibilityHint="Leaves the preview"
          onPress={() => router.back()}
        />
      </View>

      <View style={{ flex: 1, backgroundColor: color.page }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            padding: ds.spacing(space[4]),
            paddingBottom: getTabBarClearance(insets.bottom),
          }}
        >
          <Text
            accessibilityRole="header"
            style={{
              fontSize: ds.fontSize(typeScale.title),
              fontWeight: weight.bold,
              letterSpacing: tracking.title,
              color: color.ink,
            }}
          >
            {`What ${firstName} sees`}
          </Text>
          <Text
            style={{
              fontSize: ds.fontSize(typeScale.secondary),
              color: color.ink2,
              marginBottom: ds.spacing(space[3]),
            }}
          >
            Live from their current settings. Nothing here changes their data.
          </Text>

          {error ? (
            <EmptyState
              icon="alert-circle-outline"
              tone="alert"
              title="Unable to load their settings"
              body={error}
              action={{ label: 'Retry', onPress: () => void load() }}
              compact
            />
          ) : modules === null ? (
            <View style={{ paddingVertical: ds.spacing(space[8]) }}>
              <Loading size="inline" label="Loading their settings" style={{ alignItems: 'center' }} />
            </View>
          ) : (
            <>
              <Card flush style={{ paddingHorizontal: ds.spacing(space[3] + 2) }}>
                {tabKeys.map((key, index) => (
                  <ListRow
                    key={key}
                    icon={
                      (EMPLOYEE_TAB_META[key]?.icon ?? 'ellipse-outline') as keyof typeof Ionicons.glyphMap
                    }
                    title={TAB_DESCRIPTIONS[key] ?? EMPLOYEE_TAB_META[key]?.label ?? key}
                    last={index === tabKeys.length - 1}
                  />
                ))}
              </Card>

              {modules.stock_check ? (
                <View
                  style={{
                    backgroundColor: color.well,
                    borderRadius: radius.card,
                    padding: ds.spacing(space[3]),
                    marginTop: ds.spacing(space[3]),
                  }}
                >
                  <Text style={{ fontSize: ds.fontSize(typeScale.secondary), color: color.ink2 }}>
                    Stock check is on. It opens from inside the app, not as a tab.
                  </Text>
                </View>
              ) : null}
            </>
          )}
        </ScrollView>

        {/* The real tab list, rendered from the same visible-tab list. */}
        {modules !== null && previewTabs.length ? (
          <View
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          >
            <TabBar tabs={previewTabs} active={previewTabs[0].name} onPress={() => undefined} />
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
