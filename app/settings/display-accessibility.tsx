import React from 'react';
import { Alert, Text, View } from 'react-native';
import { useDisplayStore } from '@/store';
import {
  MultiOptionToggle,
  SettingToggle,
  SettingsGroup,
  SettingsScreenLayout,
  SettingsSectionLabel,
} from '@/components/settings';
import { Button, Card, SectionLabel } from '@/components/ui';
import { TEXT_SCALE_LABELS } from '@/types/settings';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { color, radius, space, typeScale, weight } from '@/theme/tokens';

function PreviewCard() {
  const ds = useScaledStyles();

  return (
    <View style={{ paddingHorizontal: ds.spacing(space[4]) }}>
      <Card>
        <Text
          style={{
            fontSize: ds.fontSize(typeScale.body),
            fontWeight: weight.bold,
            color: color.ink,
          }}
        >
          Live preview
        </Text>

        <View
          style={{
            marginTop: ds.spacing(space[3]),
            borderRadius: radius.control,
            backgroundColor: color.well,
            paddingHorizontal: ds.spacing(space[3] + 2),
            paddingVertical: ds.spacing(space[3]),
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: ds.spacing(space[3]),
          }}
        >
          <View style={{ flex: 1 }}>
            <Text
              numberOfLines={1}
              style={{
                fontSize: ds.fontSize(typeScale.body),
                fontWeight: weight.semibold,
                color: color.ink,
              }}
            >
              Atlantic Salmon
            </Text>
            <Text
              style={{
                marginTop: ds.spacing(space[1]),
                fontSize: ds.fontSize(typeScale.secondary),
                color: color.ink2,
              }}
            >
              Preview · 10 lb/case
            </Text>
          </View>
          {/* An illustration of the current scale, not a control: it takes no
              touches and VoiceOver never offers it as a button. */}
          <View
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Button size="small" label="Add" onPress={() => undefined} />
          </View>
        </View>
      </Card>
    </View>
  );
}

function DisplaySection() {
  const {
    textScale,
    setTextScale,
    uiScale,
    setUIScale,
    buttonSize,
    setButtonSize,
    hapticFeedback,
    setHapticFeedback,
    reduceMotion,
    setReduceMotion,
    resetToDefaults,
  } = useDisplayStore();
  const ds = useScaledStyles();

  const handleReset = () => {
    Alert.alert(
      'Reset display settings?',
      'Restore the current display and accessibility preferences to their defaults.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: resetToDefaults,
        },
      ],
    );
  };

  return (
    <>
      <PreviewCard />

      <SettingsSectionLabel label="Typography" />
      <SettingsGroup>
        <View style={{ paddingVertical: ds.spacing(space[3]) }}>
          <SectionLabel>Text size</SectionLabel>
          <MultiOptionToggle
            options={TEXT_SCALE_LABELS.map((label, index) => ({
              label,
              value: [0.8, 0.9, 1.0, 1.1, 1.4][index] as
                | 0.8
                | 0.9
                | 1.0
                | 1.1
                | 1.4,
            }))}
            value={textScale}
            onValueChange={setTextScale}
          />
          <Text
            style={{
              marginTop: ds.spacing(space[3]),
              fontSize: ds.fontSize(typeScale.secondary),
              color: color.ink2,
            }}
          >
            Preview: The quick brown fox jumps over the lazy dog.
          </Text>
        </View>
      </SettingsGroup>

      <SettingsSectionLabel label="Layout" />
      <SettingsGroup>
        <View style={{ paddingVertical: ds.spacing(space[3]) }}>
          <SectionLabel>UI scale</SectionLabel>
          <MultiOptionToggle
            options={[
              { value: 'compact', label: 'Compact' },
              { value: 'default', label: 'Default' },
              { value: 'large', label: 'Large', disabled: true },
            ]}
            value={uiScale}
            onValueChange={setUIScale}
          />

          <Text
            style={{
              marginTop: ds.spacing(space[3]),
              fontSize: ds.fontSize(typeScale.secondary),
              color: color.ink2,
            }}
          >
            Large UI scale is unavailable on the current screen size.
          </Text>

          <View
            style={{
              height: 1,
              backgroundColor: color.hairline,
              marginVertical: ds.spacing(space[4]),
            }}
          />

          <SectionLabel>Button size</SectionLabel>
          <MultiOptionToggle
            options={[
              { value: 'small', label: 'Small' },
              { value: 'medium', label: 'Medium' },
              { value: 'large', label: 'Large', disabled: true },
            ]}
            value={buttonSize}
            onValueChange={setButtonSize}
          />

          {/* Same rule as the live preview above: shows the chosen button size,
              never fires. */}
          <View
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{ marginTop: ds.spacing(space[4]), alignItems: 'center' }}
          >
            <Button label="Sample button" fullWidth={false} onPress={() => undefined} />
          </View>
        </View>
      </SettingsGroup>

      <SettingsSectionLabel label="Accessibility" />
      <SettingsGroup>
        <SettingToggle
          title="Haptic feedback"
          subtitle="Allow vibration on meaningful actions outside the quiet settings flow."
          value={hapticFeedback}
          onValueChange={setHapticFeedback}
        />
        <SettingToggle
          title="Reduce motion"
          subtitle="Minimize page and control animations when supported."
          value={reduceMotion}
          onValueChange={setReduceMotion}
          showBorder={false}
        />
      </SettingsGroup>

      <View style={{ paddingHorizontal: ds.spacing(space[4]), marginTop: ds.spacing(space[5]) }}>
        <Button
          variant="destructive"
          icon="refresh-outline"
          label="Reset to defaults"
          onPress={handleReset}
        />
      </View>
    </>
  );
}

export default function DisplayAccessibilitySettingsScreen() {
  return (
    <SettingsScreenLayout title="Display">
      <DisplaySection />
    </SettingsScreenLayout>
  );
}
