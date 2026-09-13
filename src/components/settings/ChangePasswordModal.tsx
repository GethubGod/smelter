import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheetShell } from '@/components/BottomSheetShell';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { changeEmailPassword } from '@/services/changePassword';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { color, size, space, tracking, typeScale, weight } from '@/theme/tokens';

interface ChangePasswordModalProps {
  visible: boolean;
  onClose: () => void;
}

/** Email-account password editor. */
export function ChangePasswordModal({ visible, onClose }: ChangePasswordModalProps) {
  const ds = useScaledStyles();
  const insets = useSafeAreaInsets();
  const [isBusy, setIsBusy] = useState(false);
  const closeSheet = () => {
    if (!isBusy) onClose();
  };

  return (
    <BottomSheetShell
      visible={visible}
      onClose={closeSheet}
      bottomPadding={Math.max(insets.bottom, ds.spacing(space[3] + 2))}
    >
      {visible ? <EmailPasswordContent onClose={onClose} onBusyChange={setIsBusy} /> : null}
    </BottomSheetShell>
  );
}

interface PasswordFieldProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  revealed: boolean;
  onToggleReveal: () => void;
  helper?: string;
}

/**
 * `Input` has no trailing accessory slot, so the show and hide control is laid
 * over the field's right edge. Everything else is the contract input.
 */
function PasswordField({
  label,
  value,
  onChangeText,
  placeholder,
  revealed,
  onToggleReveal,
  helper,
}: PasswordFieldProps) {
  const ds = useScaledStyles();
  const control = Math.max(size.touchMin, ds.icon(size.touchMin));

  return (
    <View>
      <SectionLabel>{label}</SectionLabel>
      <View>
        <Input
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={!revealed}
          placeholder={placeholder}
          accessibilityLabel={label}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity
          onPress={onToggleReveal}
          accessibilityRole="button"
          accessibilityLabel={revealed ? `Hide ${label}` : `Show ${label}`}
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            width: control,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name={revealed ? 'eye-off' : 'eye'} size={ds.icon(size.icon)} color={color.ink3} />
        </TouchableOpacity>
      </View>
      {helper ? (
        <Text
          style={{
            marginTop: ds.spacing(space[1]),
            fontSize: ds.fontSize(typeScale.secondary),
            color: color.ink3,
          }}
        >
          {helper}
        </Text>
      ) : null}
    </View>
  );
}

interface EmailPasswordContentProps extends Pick<ChangePasswordModalProps, 'onClose'> {
  /** Lets the sheet refuse to dismiss while the password is being written. */
  onBusyChange?: (busy: boolean) => void;
}

function EmailPasswordContent({ onClose, onBusyChange }: EmailPasswordContentProps) {
  const ds = useScaledStyles();
  const { height: windowHeight } = useWindowDimensions();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const operation = useRef<AbortController | null>(null);
  useEffect(() => () => operation.current?.abort(), []);
  useEffect(() => {
    onBusyChange?.(isLoading);
  }, [isLoading, onBusyChange]);

  const resetForm = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
  };

  const handleClose = () => {
    operation.current?.abort();
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (newPassword.length < 8) {
      Alert.alert('Error', 'New password must be at least 8 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }

    if (isLoading) return;
    const controller = new AbortController();
    operation.current = controller;
    setIsLoading(true);

    try {
      await changeEmailPassword(currentPassword, newPassword, controller.signal);
      if (controller.signal.aborted) return;

      Alert.alert('Success', 'Your password has been updated', [
        { text: 'OK', onPress: handleClose },
      ]);
    } catch (error: unknown) {
      if (!controller.signal.aborted) Alert.alert('Error', error instanceof Error ? error.message : 'Failed to update password');
    } finally {
      if (!controller.signal.aborted) setIsLoading(false);
    }
  };

  return (
    // The three fields sit above the keyboard on a small phone only while the
    // sheet lifts with it, and only scroll while the sheet is capped.
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={{ gap: ds.spacing(space[3]) }}>
        <Text
          accessibilityRole="header"
          style={{
            fontSize: ds.fontSize(typeScale.title),
            fontWeight: weight.bold,
            letterSpacing: tracking.title,
            color: color.ink,
          }}
        >
          Change password
        </Text>

        <ScrollView
          style={{ maxHeight: windowHeight * 0.5 }}
          contentContainerStyle={{ gap: ds.spacing(space[3]) }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <PasswordField
            label="Current password"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            placeholder="Enter current password"
            revealed={showCurrentPassword}
            onToggleReveal={() => setShowCurrentPassword(!showCurrentPassword)}
          />
          <PasswordField
            label="New password"
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="Enter new password"
            revealed={showNewPassword}
            onToggleReveal={() => setShowNewPassword(!showNewPassword)}
            helper="Must be at least 8 characters"
          />
          <PasswordField
            label="Confirm new password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Confirm new password"
            revealed={showConfirmPassword}
            onToggleReveal={() => setShowConfirmPassword(!showConfirmPassword)}
          />
        </ScrollView>

        <Button
          variant="primary"
          label="Update Password"
          loading={isLoading}
          onPress={() => void handleSubmit()}
        />
        <Button
          variant="secondary"
          label="Cancel"
          disabled={isLoading}
          accessibilityHint="Stops changing your password"
          onPress={handleClose}
        />
      </View>
    </KeyboardAvoidingView>
  );
}
