import React, { useState } from 'react';
import { Alert, Share, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ManagerScaleContainer } from '@/components/ManagerScaleContainer';
import { Button, Card, Input, ScreenHeader, SectionLabel } from '@/components/ui';
import { SettingsSectionLabel } from '@/components/settings';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { useSettingsNavigationContext } from '@/hooks/useSettingsBackRoute';
import { color, size, space, typeScale, weight } from '@/theme/tokens';
import { updateAccessCodes } from '@/services';
import { useAuthStore } from '@/store';

const ACCESS_CODE_REGEX = /^\d{4}$/;

function AccessCodeField({
  label,
  value,
  onChangeText,
  secureTextEntry,
  onToggleSecureEntry,
  onShare,
  canShare,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  secureTextEntry: boolean;
  onToggleSecureEntry: () => void;
  icon: keyof typeof Ionicons.glyphMap;
  onShare: () => void;
  canShare: boolean;
}) {
  const ds = useScaledStyles();
  const control = Math.max(size.touchMin, ds.icon(size.touchMin));

  return (
    <View style={{ marginBottom: ds.spacing(space[4]) }}>
      <SectionLabel>{label}</SectionLabel>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: ds.spacing(space[2]) }}>
        <Input
          value={value}
          onChangeText={onChangeText}
          keyboardType="number-pad"
          maxLength={4}
          secureTextEntry={secureTextEntry}
          // The field carries wide tracking, so keep the hint short enough
          // to fit; the label above stays fully descriptive.
          placeholder="4-digit code"
          accessibilityLabel={label}
          containerStyle={{ flex: 1 }}
        />
        <TouchableOpacity
          onPress={onToggleSecureEntry}
          activeOpacity={0.82}
          accessibilityRole="button"
          accessibilityLabel={secureTextEntry ? `Show ${label}` : `Hide ${label}`}
          style={{ width: control, height: control, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons
            name={secureTextEntry ? 'eye-outline' : 'eye-off-outline'}
            size={ds.icon(size.icon)}
            color={color.ink2}
          />
        </TouchableOpacity>
        {canShare ? (
          <TouchableOpacity
            onPress={onShare}
            activeOpacity={0.82}
            accessibilityRole="button"
            accessibilityLabel={`Share ${label}`}
            style={{ width: control, height: control, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="share-outline" size={ds.icon(size.icon)} color={color.accent} />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

export default function ManagerAccessCodesScreen() {
  const ds = useScaledStyles();
  const { backTo } = useSettingsNavigationContext('manager');
  const { user } = useAuthStore();
  const [employeeAccessCode, setEmployeeAccessCode] = useState('');
  const [managerAccessCode, setManagerAccessCode] = useState('');
  const [showEmployeeAccessCode, setShowEmployeeAccessCode] = useState(false);
  const [showManagerAccessCode, setShowManagerAccessCode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);

  const sanitizeCode = (value: string) => value.replace(/\D/g, '').slice(0, 4);
  const canShare = (code: string) => ACCESS_CODE_REGEX.test(code);

  const handleShare = async (role: 'employee' | 'manager') => {
    const code = role === 'employee' ? employeeAccessCode : managerAccessCode;
    const roleLabel = role === 'employee' ? 'Employee' : 'Manager';

    try {
      await Share.share({
        message: `Your ${roleLabel.toLowerCase()} access code for Smelter is: ${code}\n\nUse this code when creating your account.`,
      });
    } catch {
      // Share sheet dismissed.
    }
  };

  const handleUpdateCodes = async () => {
    if (user?.role !== 'manager') {
      Alert.alert('Access denied', 'Only managers can update access codes.');
      return;
    }

    if (
      !ACCESS_CODE_REGEX.test(employeeAccessCode) ||
      !ACCESS_CODE_REGEX.test(managerAccessCode)
    ) {
      setErrorMessage('Both access codes must be exactly 4 digits.');
      return;
    }

    if (employeeAccessCode === managerAccessCode) {
      setErrorMessage('Employee and manager codes cannot be the same.');
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage(null);
      await updateAccessCodes({
        employeeAccessCode,
        managerAccessCode,
      });
      setIsSaved(true);

      Alert.alert('Access codes updated', 'Share the employee code if needed.', [
        {
          text: 'Share Employee Code',
          onPress: () => {
            void handleShare('employee');
          },
        },
        { text: 'Done' },
      ]);
    } catch (error: any) {
      Alert.alert(
        'Update failed',
        error?.message || 'Unable to update access codes.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace(backTo);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.page }} edges={['left', 'right']}>
      <ManagerScaleContainer>
        <ScreenHeader
          mode="pushed"
          title="Access codes"
          subtitle="Manager-only sign-up access for employees and managers."
          onBack={handleBack}
        />

        <View style={{ flex: 1 }}>
          <SettingsSectionLabel label="Security" />

          <View style={{ paddingHorizontal: ds.spacing(space[4]), gap: ds.spacing(space[4]) }}>
            <Card>
              <AccessCodeField
                label="Employee access code"
                value={employeeAccessCode}
                onChangeText={(value) => {
                  setEmployeeAccessCode(sanitizeCode(value));
                  setIsSaved(false);
                  if (errorMessage) {
                    setErrorMessage(null);
                  }
                }}
                secureTextEntry={!showEmployeeAccessCode}
                onToggleSecureEntry={() =>
                  setShowEmployeeAccessCode((current) => !current)
                }
                icon="person-outline"
                canShare={canShare(employeeAccessCode)}
                onShare={() => {
                  void handleShare('employee');
                }}
              />

              <AccessCodeField
                label="Manager access code"
                value={managerAccessCode}
                onChangeText={(value) => {
                  setManagerAccessCode(sanitizeCode(value));
                  setIsSaved(false);
                  if (errorMessage) {
                    setErrorMessage(null);
                  }
                }}
                secureTextEntry={!showManagerAccessCode}
                onToggleSecureEntry={() =>
                  setShowManagerAccessCode((current) => !current)
                }
                icon="shield-checkmark-outline"
                canShare={canShare(managerAccessCode)}
                onShare={() => {
                  void handleShare('manager');
                }}
              />

              {errorMessage ? (
                <Text
                  accessibilityRole="alert"
                  style={{
                    marginBottom: ds.spacing(space[3]),
                    fontSize: ds.fontSize(typeScale.secondary),
                    fontWeight: weight.semibold,
                    color: color.alert,
                  }}
                >
                  {errorMessage}
                </Text>
              ) : null}

              {isSaved ? (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: ds.spacing(space[2]),
                    marginBottom: ds.spacing(space[3]),
                  }}
                >
                  <Ionicons name="checkmark-circle" size={ds.icon(18)} color={color.good} />
                  <Text
                    style={{
                      fontSize: ds.fontSize(typeScale.secondary),
                      fontWeight: weight.semibold,
                      color: color.good,
                    }}
                  >
                    Codes saved successfully.
                  </Text>
                </View>
              ) : null}

              <Button
                label="Update codes"
                loading={isSaving}
                onPress={() => void handleUpdateCodes()}
              />
            </Card>

            <Card>
              <Text
                style={{
                  fontSize: ds.fontSize(typeScale.body),
                  fontWeight: weight.semibold,
                  color: color.ink,
                }}
              >
                Keep codes separate
              </Text>
              <Text
                style={{
                  marginTop: ds.spacing(space[2]),
                  fontSize: ds.fontSize(typeScale.secondary),
                  color: color.ink2,
                }}
              >
                Employee and manager codes should stay distinct so sign-up access
                remains intentional and role boundaries stay clear.
              </Text>
            </Card>
          </View>
        </View>
      </ManagerScaleContainer>
    </SafeAreaView>
  );
}
