import React from 'react';
import { Linking, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { Sheet } from '@/components/ui';
import { BrandLockup } from '@/components/ui/BrandFooter';
import { showNotice } from '@/components/ui/NoticeSheet';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { color, typeScale } from '@/theme/tokens';
import { PRIVACY_URL, SUPPORT_URL, TERMS_URL } from '@/features/auth/legal';
import { SettingsCard, SettingsCardRow } from './SettingsCardRow';

/**
 * About and legal: privacy policy, terms, open-source licenses, contact
 * support, app version. App Store compliance set — every row works.
 */

export async function openExternalUrl(url: string): Promise<void> {
  try {
    const supported = await Linking.canOpenURL(url);
    if (!supported) throw new Error('unsupported');
    await Linking.openURL(url);
  } catch {
    showNotice('Unable to open the link', url);
  }
}

interface AboutLegalSheetProps {
  visible: boolean;
  onClose: () => void;
  onShowLicenses: () => void;
}

export function AboutLegalSheet({ visible, onClose, onShowLicenses }: AboutLegalSheetProps) {
  const ds = useScaledStyles();
  const appVersion = Constants.expoConfig?.version || '1.0.0';
  const buildNumber = Constants.expoConfig?.ios?.buildNumber ?? '';

  return (
    <Sheet
      visible={visible}
      title="About and legal"
      subtitle={`Smelter ${appVersion} (${buildNumber})`}
      onClose={onClose}
    >
      <View
        style={{
          alignItems: 'center',
          paddingTop: ds.spacing(6),
          paddingBottom: ds.spacing(14),
        }}
      >
        <BrandLockup height={30} />
      </View>

      <SettingsCard>
        <SettingsCardRow
          title="Privacy policy"
          onPress={() => void openExternalUrl(PRIVACY_URL)}
        />
        <SettingsCardRow
          title="Terms of service"
          onPress={() => void openExternalUrl(TERMS_URL)}
        />
        <SettingsCardRow
          title="Open-source licenses"
          onPress={onShowLicenses}
        />
        <SettingsCardRow
          title="Contact support"
          onPress={() => void openExternalUrl(SUPPORT_URL)}
          isLast
        />
      </SettingsCard>
    </Sheet>
  );
}

const LICENSED_PACKAGES: { name: string; license: string }[] = [
  { name: 'React & React Native', license: 'MIT License · Meta Platforms, Inc.' },
  { name: 'Expo SDK & Expo Router', license: 'MIT License · 650 Industries, Inc.' },
  { name: 'Supabase JS', license: 'MIT License · Supabase, Inc.' },
  { name: 'Zustand', license: 'MIT License · Poimandres' },
  { name: 'React Native Reanimated', license: 'MIT License · Software Mansion' },
  { name: 'React Navigation', license: 'MIT License · React Navigation contributors' },
  { name: 'Ionicons (@expo/vector-icons)', license: 'MIT License · Ionic' },
  { name: 'react-native-safe-area-context', license: 'MIT License · Th3rd Wave' },
  { name: 'react-native-svg', license: 'MIT License · Software Mansion' },
  { name: 'AsyncStorage', license: 'MIT License · React Native Community' },
];

interface LicensesSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function LicensesSheet({ visible, onClose }: LicensesSheetProps) {
  const ds = useScaledStyles();

  return (
    <Sheet visible={visible} title="Open-source licenses" onClose={onClose}>
      <Text
        style={{
          fontSize: ds.fontSize(typeScale.secondary),
          color: color.ink2,
        }}
      >
        This app is built with open-source software, including:
      </Text>

      <SettingsCard>
        {LICENSED_PACKAGES.map((pkg, index) => (
          <SettingsCardRow
            key={pkg.name}
            icon="cube-outline"
            title={pkg.name}
            subtitle={pkg.license}
            isLast={index === LICENSED_PACKAGES.length - 1}
            showChevron={false}
          />
        ))}
      </SettingsCard>

      <Text
        style={{
          fontSize: ds.fontSize(typeScale.secondary),
          color: color.ink3,
        }}
      >
        Plus other MIT-licensed packages listed in the app{'\u2019'}s package manifest.
        License texts are available from each project{'\u2019'}s repository.
      </Text>
    </Sheet>
  );
}
