import React from 'react';
import { router } from 'expo-router';
import { useSettingsStore } from '@/store';
import {
  SettingToggle,
  SettingsGroup,
  SettingsRow,
  SettingsScreenLayout,
  SettingsSectionLabel,
} from '@/components/settings';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { buildSettingsHref } from '@/lib/settingsNavigation';
import { useSettingsNavigationContext } from '@/hooks/useSettingsBackRoute';
import { space } from '@/theme/tokens';

function StockWarningsSection() {
  const { stockSettings, setStockSettings } = useSettingsStore();

  return (
    <SettingToggle
      icon="warning-outline"
      title="Flag unusual quantities"
      subtitle="Highlight suspiciously high stock counts in confirmation"
      value={stockSettings.flagUnusualQuantities}
      onValueChange={(value) => setStockSettings({ flagUnusualQuantities: value })}
      showBorder={false}
    />
  );
}

function StockPreferencesSection() {
  const { stockSettings, setStockSettings } = useSettingsStore();

  return (
    <SettingToggle
      icon="notifications-outline"
      title="Resume reminders"
      subtitle="Send a local reminder after pausing stock count"
      value={stockSettings.resumeReminders}
      onValueChange={(value) => setStockSettings({ resumeReminders: value })}
      showBorder={false}
    />
  );
}

export default function StockSettingsScreen() {
  const ds = useScaledStyles();
  const { origin } = useSettingsNavigationContext();

  const openStockCheck = () => {
    router.push(
      buildSettingsHref('/(tabs)/stock-check', {
        origin,
        backTo: buildSettingsHref('/settings/stock-settings', { origin }),
      }),
    );
  };

  return (
    <SettingsScreenLayout title="Stock settings">
      <SettingsGroup>
        <SettingsRow
          icon="clipboard-outline"
          title="Stock"
          subtitle="Count and update inventory by station"
          onPress={openStockCheck}
          showBorder={false}
        />
      </SettingsGroup>

      <SettingsSectionLabel label="Stock warnings" />
      <SettingsGroup>
        <StockWarningsSection />
      </SettingsGroup>

      <SettingsSectionLabel label="Preferences" />
      <SettingsGroup style={{ marginBottom: ds.spacing(space[3]) }}>
        <StockPreferencesSection />
      </SettingsGroup>
    </SettingsScreenLayout>
  );
}
