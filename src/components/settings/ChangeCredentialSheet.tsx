import React, { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Segment } from '@/components/ui/Segment';
import { Sheet } from '@/components/ui/Sheet';
import { showStudioToast } from '@/components/ui/StudioToast';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import {
  isValidPassword,
  isValidPin,
  setMyCredential,
  type CredentialKind,
} from '@/services/loginCredentials';
import { color, space, tracking, typeScale, weight } from '@/theme/tokens';

interface ChangeCredentialSheetProps {
  visible: boolean;
  /**
   * `modal` presents its own sheet, `embedded` reuses a native modal that is
   * already open, and `content` renders the form bare for a caller that owns
   * the sheet itself.
   */
  presentation?: 'modal' | 'embedded' | 'content';
  onClose: () => void;
  initialKind?: CredentialKind;
  /** Lets a caller that owns the sheet refuse to dismiss mid-save. */
  onBusyChange?: (busy: boolean) => void;
}

const KIND_OPTIONS = [
  { value: 'pin' as CredentialKind, label: 'PIN' },
  { value: 'password' as CredentialKind, label: 'Password' },
];

export function ChangeCredentialSheet({
  visible,
  onClose,
  initialKind = 'pin',
  presentation = 'modal',
  onBusyChange,
}: ChangeCredentialSheetProps) {
  const ds = useScaledStyles();
  const [credentialKind, setCredentialKind] = useState<CredentialKind>(initialKind);
  const [secretDraft, setSecretDraft] = useState('');
  const [secretConfirm, setSecretConfirm] = useState('');
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setCredentialKind(initialKind);
    setSecretDraft('');
    setSecretConfirm('');
    setSheetError(null);
  }, [initialKind, visible]);

  useEffect(() => {
    onBusyChange?.(isSaving);
  }, [isSaving, onBusyChange]);

  const closeSheet = () => {
    if (!isSaving) onClose();
  };

  const handleSaveCredential = useCallback(async () => {
    const secret = secretDraft.trim();
    if (credentialKind === 'pin' && !isValidPin(secret)) {
      setSheetError('The PIN must be exactly 4 digits.');
      return;
    }
    if (credentialKind === 'password' && !isValidPassword(secret)) {
      setSheetError('The password must be at least 8 characters.');
      return;
    }
    if (secret !== secretConfirm.trim()) {
      setSheetError(
        credentialKind === 'pin' ? 'The PINs do not match.' : 'The passwords do not match.',
      );
      return;
    }
    setIsSaving(true);
    setSheetError(null);
    try {
      await setMyCredential(credentialKind, secret);
      onClose();
      showStudioToast(credentialKind === 'pin' ? 'PIN updated' : 'Password updated');
    } catch (error) {
      setSheetError(error instanceof Error ? error.message : 'Could not save your sign-in.');
    } finally {
      setIsSaving(false);
    }
  }, [credentialKind, onClose, secretConfirm, secretDraft]);

  const fields = (
    <View style={{ gap: ds.spacing(space[3]) }}>
      <Segment
        options={KIND_OPTIONS}
        value={credentialKind}
        accessibilityLabel="Sign-in method"
        onChange={(kind) => {
          setCredentialKind(kind);
          setSecretDraft('');
          setSecretConfirm('');
          setSheetError(null);
        }}
      />

      <View style={{ gap: ds.spacing(space[2]) }}>
        <Input
          value={secretDraft}
          onChangeText={setSecretDraft}
          placeholder={credentialKind === 'pin' ? 'New 4-digit PIN' : 'New password'}
          secureTextEntry
          keyboardType={credentialKind === 'pin' ? 'number-pad' : 'default'}
          maxLength={credentialKind === 'pin' ? 4 : undefined}
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="newPassword"
          accessibilityLabel={credentialKind === 'pin' ? 'New PIN' : 'New password'}
        />
        <Input
          value={secretConfirm}
          onChangeText={setSecretConfirm}
          placeholder={credentialKind === 'pin' ? 'Repeat the PIN' : 'Repeat the password'}
          secureTextEntry
          keyboardType={credentialKind === 'pin' ? 'number-pad' : 'default'}
          maxLength={credentialKind === 'pin' ? 4 : undefined}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel={
            credentialKind === 'pin' ? 'Repeat the new PIN' : 'Repeat the new password'
          }
          error={sheetError ?? undefined}
        />
      </View>
    </View>
  );

  if (presentation === 'content') {
    return visible ? (
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
          Change PIN or password
        </Text>
        {fields}
        <Button
          variant="primary"
          label={credentialKind === 'pin' ? 'Save PIN' : 'Save password'}
          loading={isSaving}
          onPress={() => void handleSaveCredential()}
        />
        <Button
          variant="secondary"
          label="Cancel"
          disabled={isSaving}
          accessibilityHint="Stops changing your sign-in details"
          onPress={closeSheet}
        />
      </View>
    ) : null;
  }

  return (
    <Sheet
      visible={visible}
      title="Change PIN or password"
      presentation={presentation}
      onClose={closeSheet}
      primary={{
        label: credentialKind === 'pin' ? 'Save PIN' : 'Save password',
        loading: isSaving,
        onPress: () => void handleSaveCredential(),
      }}
    >
      {fields}
    </Sheet>
  );
}
