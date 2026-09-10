// New employee defaults: the org-wide preset every new invite starts with.
// Applies to invites only. Existing team members keep what they have.

import { useCallback, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { ManagerScaleContainer } from '@/components/ManagerScaleContainer';
import { Card, EmptyState, Loading, ScreenHeader } from '@/components/ui';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { useSettingsNavigationContext } from '@/hooks/useSettingsBackRoute';
import { color, space, typeScale, weight } from '@/theme/tokens';
import {
  getEmployeeInviteDefaults,
  setEmployeeInviteDefaults,
  type EmployeeInviteDefaults,
} from '@/services/employeeDefaults';
import { ModuleToggleRow, TeamCard } from './components/TeamUI';

const ROWS: { key: string; label: string }[] = [
  { key: 'ordering_simple', label: 'Ordering checklist' },
  { key: 'ordering_advanced', label: 'Advanced ordering' },
  { key: 'stock_check', label: 'Stock check' },
  { key: 'tips', label: 'Tips' },
];

export default function DefaultsScreen() {
  const ds = useScaledStyles();
  const { backTo } = useSettingsNavigationContext();
  const [defaults, setDefaults] = useState<EmployeeInviteDefaults | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setDefaults(await getEmployeeInviteDefaults());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load the defaults.');
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

  const handleToggle = async (key: string, value: boolean) => {
    if (!defaults || saving) return;
    const previous = defaults;
    const next = { ...defaults, [key]: value };
    setDefaults(next);
    setSaving(true);
    try {
      await setEmployeeInviteDefaults(next);
    } catch (saveError) {
      setDefaults(previous);
      Alert.alert(
        'Update failed',
        saveError instanceof Error ? saveError.message : 'Try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.page }} edges={['left', 'right']}>
      <ManagerScaleContainer>
        <ScreenHeader
          mode="pushed"
          title="New employee defaults"
          subtitle="Every new invite starts with these. You can still change any person later."
          onBack={handleBack}
        />

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: ds.spacing(space[4]),
            paddingTop: ds.spacing(space[2]),
            paddingBottom: ds.spacing(space[8]),
            gap: ds.spacing(space[3]),
          }}
        >
          {error ? (
            <EmptyState
              icon="alert-circle-outline"
              tone="alert"
              title="Unable to load the defaults"
              body={error}
              action={{ label: 'Retry', onPress: () => void load() }}
              compact
            />
          ) : defaults === null ? (
            <View style={{ paddingVertical: ds.spacing(space[8]) }}>
              <Loading size="inline" label="Loading the defaults" style={{ alignItems: 'center' }} />
            </View>
          ) : (
            <>
              <TeamCard style={{ paddingHorizontal: ds.spacing(space[3] + 2) }}>
                {ROWS.map((row, index) => (
                  <ModuleToggleRow
                    key={row.key}
                    label={row.label}
                    value={defaults[row.key] === true}
                    disabled={saving}
                    showBorder={index < ROWS.length - 1}
                    onChange={(value) => void handleToggle(row.key, value)}
                  />
                ))}
              </TeamCard>

              <Card>
                <Text style={{ fontSize: ds.fontSize(typeScale.secondary), color: color.ink2 }}>
                  <Text style={{ fontWeight: weight.semibold, color: color.ink }}>
                    Applies to invites only.{' '}
                  </Text>
                  Current team members keep what they have.
                </Text>
              </Card>
            </>
          )}
        </ScrollView>
      </ManagerScaleContainer>
    </SafeAreaView>
  );
}
