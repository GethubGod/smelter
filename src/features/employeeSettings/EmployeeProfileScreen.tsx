import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/react/shallow';
import { Button, Card, Input, ScreenHeader, Sheet } from '@/components/ui';
import { getFloatingPillClearance } from '@/components/navigation';
import { useResolvedActiveLocation } from '@/hooks/useResolvedActiveLocation';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { ChangeCredentialSheet } from '@/components/settings/ChangeCredentialSheet';
import {
  isRealAccountEmail,
  updateMyDisplayName,
  updateMyEmail,
} from '@/services/selfProfile';
import { useAuthStore } from '@/store';
import { color, radius, space, typeScale, weight } from '@/theme/tokens';
import { PRIVACY_URL } from '@/features/auth/legal';
import { openExternalUrl } from './components/AboutLegalSheet';
import { SettingsCard, SettingsCardRow } from './components/SettingsCardRow';

/**
 * Employee Profile — the App Store compliance set, all rows functional:
 * Name (editable, syncs the name sign-in identity), Email (optional, for
 * account recovery), Location (read-only, set by the manager), Change PIN or
 * password, Privacy choices, Delete account (existing deletion flow).
 */

type EditSheet = 'name' | 'email' | 'credential' | 'privacy' | null;

export function EmployeeProfileScreen() {
  const ds = useScaledStyles();
  const insets = useSafeAreaInsets();
  const { user, setUser, deleteSelfAccount } = useAuthStore(
    useShallow((state) => ({
      user: state.user,
      setUser: state.setUser,
      deleteSelfAccount: state.deleteSelfAccount,
    })),
  );
  const { location } = useResolvedActiveLocation();

  const [activeSheet, setActiveSheet] = useState<EditSheet>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [emailDraft, setEmailDraft] = useState('');
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const displayName = user?.name?.trim() || 'You';
  const initial = (displayName[0] ?? '?').toUpperCase();
  const realEmail = isRealAccountEmail(user?.email) ? user?.email ?? null : null;
  const locationLabel = location?.name ?? 'Not set';

  const openSheet = useCallback(
    (sheet: EditSheet) => {
      setSheetError(null);
      setIsSaving(false);
      if (sheet === 'name') setNameDraft(user?.name ?? '');
      if (sheet === 'email') setEmailDraft(realEmail ?? '');
      setActiveSheet(sheet);
    },
    [realEmail, user?.name],
  );

  const closeSheet = useCallback(() => {
    if (isSaving) return;
    setActiveSheet(null);
  }, [isSaving]);

  const handleSaveName = useCallback(async () => {
    const trimmed = nameDraft.trim();
    if (!trimmed) {
      setSheetError('Enter a name.');
      return;
    }
    setIsSaving(true);
    setSheetError(null);
    try {
      await updateMyDisplayName(trimmed);
      if (user) setUser({ ...user, name: trimmed });
      setActiveSheet(null);
    } catch (error) {
      setSheetError(
        error instanceof Error ? error.message : 'Could not update your name.',
      );
    } finally {
      setIsSaving(false);
    }
  }, [nameDraft, setUser, user]);

  const handleSaveEmail = useCallback(async () => {
    setIsSaving(true);
    setSheetError(null);
    try {
      await updateMyEmail(emailDraft);
      setActiveSheet(null);
      Alert.alert(
        'Check your inbox',
        `We sent a confirmation link to ${emailDraft.trim()}. The change applies once you confirm it.`,
      );
    } catch (error) {
      setSheetError(
        error instanceof Error ? error.message : 'Could not update your email.',
      );
    } finally {
      setIsSaving(false);
    }
  }, [emailDraft]);

  const openDeleteConfirmation = useCallback(() => {
    Alert.alert(
      'Delete account?',
      'This permanently deletes your account and cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => {
            setDeleteConfirmText('');
            setShowDeleteModal(true);
          },
        },
      ],
    );
  }, []);

  const handleDeleteAccount = useCallback(async () => {
    if (deleteConfirmText !== 'DELETE' || isDeletingAccount) return;
    setIsDeletingAccount(true);
    try {
      await deleteSelfAccount('DELETE');
      setShowDeleteModal(false);
      setDeleteConfirmText('');
    } catch (error) {
      Alert.alert(
        'Unable to delete account',
        error instanceof Error ? error.message : 'Please try again in a moment.',
      );
    } finally {
      setIsDeletingAccount(false);
    }
  }, [deleteConfirmText, deleteSelfAccount, isDeletingAccount]);

  const bottomPadding = getFloatingPillClearance(insets.bottom) + ds.spacing(16);

  return (
    <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: color.page }}>
      <ScreenHeader
        mode="pushed"
        title="Profile"
        onBack={() => router.back()}
        backAccessibilityLabel="Back to settings"
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: ds.spacing(space[4]),
          paddingBottom: bottomPadding,
          gap: ds.spacing(space[3]),
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ alignItems: 'center', marginVertical: ds.spacing(space[3]) }}>
          <View
            style={{
              width: ds.icon(72),
              height: ds.icon(72),
              borderRadius: radius.pill,
              backgroundColor: color.tint,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              style={{
                fontSize: ds.fontSize(typeScale.display),
                fontWeight: weight.bold,
                color: color.accent,
              }}
            >
              {initial}
            </Text>
          </View>
        </View>

        <SettingsCard>
          <SettingsCardRow
            icon="person-outline"
            title="Name"
            subtitle={displayName}
            onPress={() => openSheet('name')}
          />
          <SettingsCardRow
            icon="mail-outline"
            title="Email"
            subtitle={realEmail ?? 'Optional · for account recovery'}
            onPress={() => openSheet('email')}
          />
          <SettingsCardRow
            icon="location-outline"
            title="Location"
            subtitle={`${locationLabel} · set by the manager`}
            showChevron={false}
            isLast
          />
        </SettingsCard>

        <SettingsCard>
          <SettingsCardRow
            icon="key-outline"
            title="Change PIN or password"
            onPress={() => openSheet('credential')}
          />
          <SettingsCardRow
            icon="shield-checkmark-outline"
            title="Privacy choices"
            subtitle="Data we store and why"
            onPress={() => openSheet('privacy')}
            isLast
          />
        </SettingsCard>

        <Button
          variant="destructive"
          icon="trash-outline"
          label="Delete account"
          accessibilityHint="Removes your account and personal data"
          onPress={openDeleteConfirmation}
        />
      </ScrollView>

      {/* Name */}
      <Sheet
        visible={activeSheet === 'name'}
        title="Your name"
        onClose={closeSheet}
        primary={{ label: 'Save name', onPress: () => void handleSaveName(), loading: isSaving }}
      >
        <Text style={{ fontSize: ds.fontSize(typeScale.secondary), color: color.ink2 }}>
          Also used to sign in, so it stays unique on the team.
        </Text>
        <Input
          value={nameDraft}
          onChangeText={setNameDraft}
          placeholder="Full name"
          autoCapitalize="words"
          autoCorrect={false}
          accessibilityLabel="Your name"
          error={sheetError ?? undefined}
        />
      </Sheet>

      {/* Email */}
      <Sheet
        visible={activeSheet === 'email'}
        title={realEmail ? 'Change email' : 'Add email'}
        onClose={closeSheet}
        primary={{ label: 'Save email', onPress: () => void handleSaveEmail(), loading: isSaving }}
      >
        <Text style={{ fontSize: ds.fontSize(typeScale.secondary), color: color.ink2 }}>
          Optional. Used only to help you recover your account.
        </Text>
        <Input
          value={emailDraft}
          onChangeText={setEmailDraft}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="emailAddress"
          accessibilityLabel="Recovery email"
          error={sheetError ?? undefined}
        />
      </Sheet>

      <ChangeCredentialSheet visible={activeSheet === 'credential'} onClose={closeSheet} />

      {/* Privacy choices */}
      <Sheet visible={activeSheet === 'privacy'} title="Privacy choices" onClose={closeSheet}>
        <Text style={{ fontSize: ds.fontSize(typeScale.secondary), color: color.ink2 }}>
          Data we store and why.
        </Text>
        <Card>
          <Text style={{ fontSize: ds.fontSize(typeScale.secondary), color: color.ink }}>
            We store your name, your sign-in credential (hashed, never readable), an optional
            recovery email, and the orders and stock checks you record. That is what makes the
            app work. Nothing is sold or shared outside the restaurant. Deleting your account
            removes your personal data.
          </Text>
        </Card>
        <Button
          variant="secondary"
          label="Read the full privacy policy"
          onPress={() => void openExternalUrl(PRIVACY_URL)}
        />
      </Sheet>

      {/* Delete confirmation */}
      <Sheet
        visible={showDeleteModal}
        title="Delete your account?"
        onClose={() => {
          if (!isDeletingAccount) setShowDeleteModal(false);
        }}
        primary={{
          label: 'Delete account',
          variant: 'destructive',
          onPress: () => void handleDeleteAccount(),
          loading: isDeletingAccount,
          disabled: deleteConfirmText !== 'DELETE',
        }}
      >
        <Text style={{ fontSize: ds.fontSize(typeScale.secondary), color: color.ink2 }}>
          Type DELETE to confirm. This cannot be undone.
        </Text>
        <Input
          value={deleteConfirmText}
          onChangeText={setDeleteConfirmText}
          placeholder="DELETE"
          autoCapitalize="characters"
          autoCorrect={false}
          accessibilityLabel="Type DELETE to confirm"
        />
      </Sheet>
    </SafeAreaView>
  );
}
