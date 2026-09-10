import React, { useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Text,
  ToastAndroid,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import {
  ChangePasswordModal,
  SettingsGroup,
  SettingsRow,
  SettingsScreenLayout,
  SettingsSectionLabel,
} from '@/components/settings';
import { Button, Input, Loading, Sheet } from '@/components/ui';
import { isRealAccountEmail, updateMyDisplayName } from '@/services/selfProfile';
import { useAuthStore, useSettingsStore } from '@/store';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { color, radius, size, space, typeScale, weight } from '@/theme/tokens';

/**
 * Profile — the same grouped-card language as the rest of the settings stack:
 * SettingsScreenLayout supplies the shared ScreenHeader (and its back
 * control), then an identity card followed by labelled SettingsGroup sections
 * of SettingsRows. Editing behaviour is unchanged from the previous layout.
 */

export default function ProfileSettingsScreen() {
  const ds = useScaledStyles();
  const { user, location, deleteSelfAccount, setUser } = useAuthStore();
  const { avatarUri, setAvatarUri } = useSettingsStore();
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(user?.name || '');
  const [isSavingName, setIsSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const displayName = user?.name?.trim() || 'Unnamed User';
  const initial = useMemo(
    () => (displayName.trim()[0] ?? '?').toUpperCase(),
    [displayName],
  );
  const roleLabel = user?.role || 'employee';
  const locationName = location?.name || null;
  // Invite-minted accounts carry a synthetic @members.babytunasystems.com
  // address that means nothing to the person reading it, so it is treated as
  // "no email on file" rather than shown and truncated.
  const realEmail = isRealAccountEmail(user?.email) ? user?.email?.trim() ?? null : null;

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission needed',
        'Allow photo library access to change your profile image.',
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  const openDeleteConfirmation = () => {
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
  };

  const handleSaveName = async () => {
    const trimmed = tempName.trim();
    if (!trimmed) {
      setNameError('Enter a name.');
      return;
    }
    if (trimmed === user?.name) {
      setIsEditingName(false);
      return;
    }
    setIsSavingName(true);
    setNameError(null);
    try {
      await updateMyDisplayName(trimmed);
      // Signing out or switching accounts mid-save must not be undone by this
      // write landing afterwards.
      const current = useAuthStore.getState().user;
      if (current && current.id === user?.id) {
        setUser({ ...current, name: trimmed });
      }
      setIsEditingName(false);
    } catch (error) {
      setNameError(
        error instanceof Error ? error.message : 'Could not update your name.',
      );
    } finally {
      setIsSavingName(false);
    }
  };

  const handleCancelEditName = () => {
    if (isSavingName) return;
    setNameError(null);
    setIsEditingName(false);
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE' || isDeletingAccount) {
      return;
    }

    setIsDeletingAccount(true);

    try {
      await deleteSelfAccount('DELETE');
      setShowDeleteModal(false);
      setDeleteConfirmText('');
      if (typeof ToastAndroid !== 'undefined') {
        ToastAndroid.show('Account deleted', ToastAndroid.SHORT);
      } else {
        Alert.alert('Account deleted');
      }
    } catch (error) {
      Alert.alert(
        'Unable to delete account',
        error instanceof Error ? error.message : 'Please try again in a moment.',
      );
    } finally {
      setIsDeletingAccount(false);
    }
  };

  return (
    <SettingsScreenLayout title="Profile">
      {/* Identity card: avatar, name, and the role/location summary line. */}
      <SettingsGroup>
        <TouchableOpacity
          onPress={pickImage}
          activeOpacity={0.82}
          accessibilityRole="button"
          accessibilityLabel="Change profile photo"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: ds.spacing(space[3] + 2),
            paddingVertical: ds.spacing(space[4]),
          }}
        >
          <View
            style={{
              width: Math.max(size.emptyStateIcon, ds.icon(size.emptyStateIcon)),
              height: Math.max(size.emptyStateIcon, ds.icon(size.emptyStateIcon)),
              borderRadius: radius.pill,
              overflow: 'hidden',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: color.tint,
            }}
          >
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={{ width: '100%', height: '100%' }} />
            ) : (
              <Text
                style={{
                  fontSize: ds.fontSize(typeScale.title),
                  fontWeight: weight.bold,
                  color: color.accent,
                }}
              >
                {initial}
              </Text>
            )}
          </View>

          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              numberOfLines={1}
              style={{
                fontSize: ds.fontSize(typeScale.body),
                fontWeight: weight.semibold,
                color: color.ink,
              }}
            >
              {displayName}
            </Text>
            <Text
              numberOfLines={1}
              style={{
                fontSize: ds.fontSize(typeScale.secondary),
                color: color.ink2,
                textTransform: 'capitalize',
              }}
            >
              {locationName ? `${locationName} · ${roleLabel}` : roleLabel}
            </Text>
            <Text
              style={{
                marginTop: ds.spacing(space[1]),
                fontSize: ds.fontSize(typeScale.secondary),
                fontWeight: weight.semibold,
                color: color.accent,
              }}
            >
              Change photo
            </Text>
          </View>
        </TouchableOpacity>
      </SettingsGroup>

      <SettingsSectionLabel label="Account details" />

      <SettingsGroup>
        <SettingsRow
          icon="person-outline"
          title="Full name"
          subtitle={isEditingName ? tempName || 'Not set' : user?.name || 'Not set'}
          showChevron={false}
          rightElement={
            isEditingName ? (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TouchableOpacity
                  onPress={handleCancelEditName}
                  disabled={isSavingName}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel editing your name"
                  style={{
                    width: size.headerCircle,
                    height: size.headerCircle,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="close" size={ds.icon(18)} color={color.ink2} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSaveName}
                  disabled={isSavingName}
                  accessibilityRole="button"
                  accessibilityLabel="Confirm your name"
                  style={{
                    width: size.headerCircle,
                    height: size.headerCircle,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: isSavingName ? 0.5 : 1,
                  }}
                >
                  {isSavingName ? (
                    <Loading size="inline" color={color.accent} label="Saving your name" />
                  ) : (
                    <Ionicons name="checkmark" size={ds.icon(18)} color={color.accent} />
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => {
                  setTempName(user?.name || '');
                  setIsEditingName(true);
                }}
                accessibilityRole="button"
                accessibilityLabel="Edit your name"
                style={{
                  width: size.headerCircle,
                  height: size.headerCircle,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="pencil-outline" size={ds.icon(18)} color={color.ink2} />
              </TouchableOpacity>
            )
          }
        />

        {isEditingName ? (
          <View style={{ paddingBottom: ds.spacing(space[3]) }}>
            <Input
              value={tempName}
              onChangeText={setTempName}
              autoFocus
              placeholder="Full name"
              accessibilityLabel="Full name"
              editable={!isSavingName}
              onSubmitEditing={handleSaveName}
              returnKeyType="done"
              error={nameError ?? undefined}
            />
          </View>
        ) : null}

        <SettingsRow
          icon="mail-outline"
          title="Email"
          subtitle={realEmail ?? 'Not set'}
          showChevron={false}
          rightElement={
            <Ionicons name="lock-closed" size={ds.icon(16)} color={color.ink3} />
          }
        />

        <SettingsRow
          icon="location-outline"
          title="Location"
          subtitle={locationName ?? 'Not set'}
          showChevron={false}
          showBorder={false}
          rightElement={
            <Ionicons name="lock-closed" size={ds.icon(16)} color={color.ink3} />
          }
        />
      </SettingsGroup>

      <SettingsSectionLabel label="Account" />

      <SettingsGroup>
        <SettingsRow
          icon="key-outline"
          title="Change PIN or password"
          subtitle="Update your sign-in details"
          onPress={() => setShowPasswordModal(true)}
          showBorder={false}
        />
      </SettingsGroup>

      <View style={{ paddingHorizontal: ds.spacing(space[4]), marginTop: ds.spacing(space[4]) }}>
        <Button
          variant="destructive"
          icon="trash-outline"
          label="Delete account"
          accessibilityHint="Permanently removes your account and personal data"
          loading={isDeletingAccount}
          onPress={openDeleteConfirmation}
        />
      </View>

      <ChangePasswordModal
        visible={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
      />

      <Sheet
        visible={showDeleteModal}
        title="Confirm permanent deletion"
        onClose={() => {
          if (!isDeletingAccount) setShowDeleteModal(false);
        }}
        primary={{
          label: 'Delete',
          variant: 'destructive',
          onPress: () => void handleDeleteAccount(),
          loading: isDeletingAccount,
          disabled: deleteConfirmText !== 'DELETE',
        }}
      >
        <Text style={{ fontSize: ds.fontSize(typeScale.secondary), color: color.ink2 }}>
          Type DELETE to permanently remove your account.
        </Text>
        <Input
          value={deleteConfirmText}
          onChangeText={setDeleteConfirmText}
          editable={!isDeletingAccount}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder="Type DELETE"
          accessibilityLabel="Type DELETE to confirm"
        />
        <Button
          variant="secondary"
          label="Cancel"
          disabled={isDeletingAccount}
          onPress={() => setShowDeleteModal(false)}
        />
      </Sheet>
    </SettingsScreenLayout>
  );
}
