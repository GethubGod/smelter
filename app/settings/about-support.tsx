import React from 'react';
import { View, Text, Alert } from 'react-native';
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { BrandLogo } from '@/components';
import { ListRow } from '@/components/ui';
import {
  SettingsGroup,
  SettingsRow,
  SettingsScreenLayout,
  SettingsSectionLabel,
} from '@/components/settings';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { color, space, typeScale } from '@/theme/tokens';

const APPSTORE_COMPLIANCE_LINKS = {
  support: 'https://smelterpos.com/support',
  contact: 'https://smelterpos.com/contact',
  privacy: 'https://smelterpos.com/privacy',
} as const;

function AboutSection() {
  const appVersion = Constants.expoConfig?.version || '1.0.0';
  const ds = useScaledStyles();

  const openExternalUrl = async (url: string) => {
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) {
        Alert.alert('Unable to open link.');
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert('Unable to open link.');
    }
  };

  return (
    <SettingsGroup>
      <ListRow
        title="App version"
        right={
          <Text style={{ fontSize: ds.fontSize(typeScale.body), color: color.ink2 }}>
            {appVersion}
          </Text>
        }
      />

      <SettingsRow
        icon="mail-outline"
        title="Contact support"
        subtitle="Get help with the app"
        onPress={() => {
          void openExternalUrl(APPSTORE_COMPLIANCE_LINKS.support);
        }}
      />

      <SettingsRow
        icon="chatbubble-outline"
        title="Send feedback"
        subtitle="Tell us what you think"
        onPress={() => {
          void openExternalUrl(APPSTORE_COMPLIANCE_LINKS.contact);
        }}
      />

      <SettingsRow
        icon="shield-outline"
        title="Privacy policy"
        onPress={() => {
          void openExternalUrl(APPSTORE_COMPLIANCE_LINKS.privacy);
        }}
        showBorder={false}
      />
    </SettingsGroup>
  );
}

export default function AboutSupportSettingsScreen() {
  const ds = useScaledStyles();
  return (
    <SettingsScreenLayout
      title="About and support"
      subtitle="App details, support, and our policies."
    >
      <SettingsSectionLabel label="Support" />
      <AboutSection />
      <View
        style={{
          alignItems: 'center',
          paddingHorizontal: ds.spacing(space[6]),
          paddingTop: ds.spacing(space[6]),
          paddingBottom: ds.spacing(space[8]),
        }}
      >
        <BrandLogo variant="footer" size={40} />
      </View>
    </SettingsScreenLayout>
  );
}
