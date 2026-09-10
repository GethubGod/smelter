import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ManagerScaleContainer } from '@/components/ManagerScaleContainer';
import { Button, Card, ListRow, ScreenHeader } from '@/components/ui';
import { SettingsSectionLabel } from '@/components/settings';
import { useSettingsNavigationContext } from '@/hooks/useSettingsBackRoute';
import { useSettingsStore } from '@/store';
import { DEFAULT_EXPORT_FORMAT_SETTINGS } from '@/types/settings';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { color, radius, space, typeScale, weight } from '@/theme/tokens';

const PLACEHOLDERS: { token: string; meaning: string }[] = [
  { token: '{{supplier}}', meaning: 'Supplier name' },
  { token: '{{date}}', meaning: 'Current date' },
  { token: '{{items}}', meaning: 'Item list' },
];

export default function ExportFormatSettingsScreen() {
  const ds = useScaledStyles();
  const { exportFormat, setExportFormat } = useSettingsStore();
  const { backTo } = useSettingsNavigationContext('manager');
  const [template, setTemplate] = useState(exportFormat.template);

  const navigateBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace(backTo);
  };

  const handleSave = () => {
    setExportFormat({ template });
    navigateBack();
  };

  const handleReset = () => {
    Alert.alert(
      'Reset format',
      'Reset the message template to the default format?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => setTemplate(DEFAULT_EXPORT_FORMAT_SETTINGS.template),
        },
      ],
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.page }} edges={['left', 'right']}>
      <ManagerScaleContainer>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ScreenHeader
            mode="pushed"
            title="Export format"
            subtitle="The supplier message template used across the manager workflow."
            onBack={navigateBack}
            right={<Button size="small" variant="secondary" label="Reset" onPress={handleReset} />}
          />

          <View style={{ flex: 1 }}>
            <SettingsSectionLabel label="Template" />

            <View style={{ paddingHorizontal: ds.spacing(space[4]) }}>
              <Card>
                <Text
                  style={{
                    fontSize: ds.fontSize(typeScale.body),
                    fontWeight: weight.semibold,
                    color: color.ink,
                  }}
                >
                  Supplier message
                </Text>
                <TextInput
                  value={template}
                  onChangeText={setTemplate}
                  multiline
                  numberOfLines={12}
                  textAlignVertical="top"
                  placeholder="Write the export template"
                  placeholderTextColor={color.ink3}
                  accessibilityLabel="Supplier message template"
                  style={{
                    marginTop: ds.spacing(space[3]),
                    minHeight: 240,
                    borderRadius: radius.control,
                    backgroundColor: color.well,
                    paddingHorizontal: ds.spacing(space[3] + 2),
                    paddingVertical: ds.spacing(space[3] + 2),
                    fontSize: ds.fontSize(typeScale.body),
                    color: color.ink,
                  }}
                />
              </Card>
            </View>

            <SettingsSectionLabel label="Placeholders" />

            <View style={{ paddingHorizontal: ds.spacing(space[4]) }}>
              <Card flush style={{ paddingHorizontal: ds.spacing(space[3] + 2) }}>
                {PLACEHOLDERS.map((entry, index) => (
                  <ListRow
                    key={entry.token}
                    title={entry.token}
                    subtitle={entry.meaning}
                    last={index === PLACEHOLDERS.length - 1}
                  />
                ))}
              </Card>
            </View>
          </View>

          <View
            style={{
              paddingHorizontal: ds.spacing(space[4]),
              paddingTop: ds.spacing(space[3] + 2),
              paddingBottom: ds.spacing(space[5]),
            }}
          >
            <Button icon="save-outline" label="Save format" onPress={handleSave} />
          </View>
        </KeyboardAvoidingView>
      </ManagerScaleContainer>
    </SafeAreaView>
  );
}
