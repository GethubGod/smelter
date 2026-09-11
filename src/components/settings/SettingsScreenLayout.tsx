import React from 'react';
import {
  ScrollView,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, ScreenHeader, SectionLabel } from '@/components/ui';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { useSettingsNavigationContext } from '@/hooks/useSettingsBackRoute';
import { color, space } from '@/theme/tokens';

interface SettingsScreenLayoutProps {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  scrollProps?: Omit<ScrollViewProps, 'contentContainerStyle'>;
}

interface SettingsGroupProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

interface SettingsSectionLabelProps {
  label: string;
  description?: string;
}

/**
 * Every pushed settings screen. `ScreenHeader mode="pushed"` owns the safe area
 * and the back circle; the back target is the same one `StackScreenHeader` used
 * so navigation is unchanged.
 */
export function SettingsScreenLayout({
  title,
  subtitle,
  right,
  children,
  contentContainerStyle,
  scrollProps,
}: SettingsScreenLayoutProps) {
  const ds = useScaledStyles();
  const { backTo } = useSettingsNavigationContext();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace(backTo);
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: color.page }}
      edges={['left', 'right']}
    >
      <ScreenHeader
        mode="pushed"
        title={title}
        subtitle={subtitle}
        right={right}
        onBack={handleBack}
      />
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          { paddingBottom: ds.spacing(space[8]) },
          contentContainerStyle,
        ]}
        {...scrollProps}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

/** Rows group inside a Card. The card is flush so rows carry their own padding. */
export function SettingsGroup({ children, style }: SettingsGroupProps) {
  const ds = useScaledStyles();

  return (
    <Card
      style={[
        {
          marginHorizontal: ds.spacing(space[4]),
          paddingHorizontal: ds.spacing(space[4]),
          overflow: 'hidden',
        },
        style,
      ]}
      flush
    >
      {children}
    </Card>
  );
}

export function SettingsSectionLabel({ label }: SettingsSectionLabelProps) {
  const ds = useScaledStyles();

  return (
    <View style={{ paddingHorizontal: ds.spacing(space[4]) }}>
      <SectionLabel>{label}</SectionLabel>
    </View>
  );
}
