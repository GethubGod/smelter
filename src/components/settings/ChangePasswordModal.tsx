import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheetShell } from '@/components/BottomSheetShell';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Loading } from '@/components/ui/Loading';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { changeEmailPassword } from '@/services/changePassword';
import { getMyCredentialKind, type CredentialKind } from '@/services/loginCredentials';
import { useAuthStore } from '@/store/authStore';
import { ChangeCredentialSheet } from './ChangeCredentialSheet';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { color, size, space, tracking, typeScale, weight } from '@/theme/tokens';

interface ChangePasswordModalProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * The sign-in editor. One `BottomSheetShell` hosts the native modal for every
 * branch, so the host is never remounted while the credential lookup resolves;
 * only the content inside it changes.
 */
export function ChangePasswordModal({ visible, onClose }: ChangePasswordModalProps) {
  const ds = useScaledStyles();
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((state) => state.session?.user.id ?? null);
  const [identity, setIdentity] = useState<{ userId: string; kind: CredentialKind | null } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  useEffect(() => {
    if (!visible || !userId) return;
    let active = true;
    setIdentity(null);
    setLoadError(null);
    void getMyCredentialKind(userId).then(
      (kind) => { if (active) setIdentity({ userId, kind }); },
      (error: unknown) => { if (active) setLoadError(error instanceof Error ? error.message : 'Unable to load your sign-in settings.'); },
    );
    return () => { active = false; };
  }, [userId, visible]);

  const isResolving = !identity || identity.userId !== userId;

  return (
    <BottomSheetShell
      visible={visible}
      onClose={onClose}
      bottomPadding={Math.max(insets.bottom, ds.spacing(space[3] + 2))}
    >
      {!visible ? null : isResolving ? (
        loadError || !userId ? (
          <EmptyState
            icon="lock-closed-outline"
            tone="alert"
            title="Sign-in settings unavailable"
            body={loadError ?? 'Sign in again to change your sign-in details.'}
            action={{ label: 'Close', onPress: onClose }}
          />
        ) : (
          <View style={{ alignItems: 'center', gap: ds.spacing(space[4]), paddingVertical: ds.spacing(space[6]) }}>
            <Loading size="inline" label="Loading sign-in settings" />
            <Button
              variant="secondary"
              label="Close"
              accessibilityHint="Closes sign-in settings"
              onPress={onClose}
            />
          </View>
        )
      ) : identity.kind ? (
        <ChangeCredentialSheet
          visible
          presentation="content"
          onClose={onClose}
          initialKind={identity.kind}
        />
      ) : (
        <EmailPasswordContent onClose={onClose} />
      )}
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

function EmailPasswordContent({ onClose }: Pick<ChangePasswordModalProps, 'onClose'>) {
  const ds = useScaledStyles();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const operation = useRef<AbortController | null>(null);
  useEffect(() => () => operation.current?.abort(), []);

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

      <View style={{ gap: ds.spacing(space[3]) }}>
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
      </View>

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
  );
}
