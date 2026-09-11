import React, { useMemo, useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  Text,
  ToastAndroid,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { ManagerScaleContainer } from '@/components/ManagerScaleContainer';
import {
  Button,
  Card,
  Input,
  ListRow,
  Loading,
  ScreenHeader,
  SectionLabel,
  Sheet,
  StatusPill,
} from '@/components/ui';
import { ChangePasswordModal } from '@/components/settings';
import { useAuthStore, useSettingsStore } from '@/store';
import { updateMyDisplayName } from '@/services/selfProfile';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { useSettingsNavigationContext } from '@/hooks/useSettingsBackRoute';
import { color, radius, size, space, typeScale, weight } from '@/theme/tokens';

export default function ManagerProfileSettingsScreen() {
  const ds = useScaledStyles();
  const { backTo } = useSettingsNavigationContext('manager');
  const { user, locations, deleteSelfAccount, setUser } = useAuthStore();
  const { avatarUri, setAvatarUri } = useSettingsStore();
  const [isEditingName, setIsEditingName] = useState(false);
  const [isSavingName, setIsSavingName] = useState(false);
  const [tempName, setTempName] = useState(user?.name || '');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const firstName = useMemo(
    () => user?.name?.trim().split(/\s+/)[0] || 'Manager',
    [user?.name],
  );

  const saveName = async () => {
    if (!user || isSavingName) return;
    setIsSavingName(true);
    try {
      await updateMyDisplayName(tempName);
      if (useAuthStore.getState().user?.id !== user.id) return;
      setUser({ ...user, name: tempName.trim() });
      setIsEditingName(false);
    } catch (error: unknown) {
      Alert.alert('Unable to save name', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setIsSavingName(false);
    }
  };

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
    } catch (error: any) {
      Alert.alert(
        'Unable to delete account',
        error?.message || 'Please try again in a moment.',
      );
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace(backTo);
  };

  const avatar = Math.max(84, ds.icon(88));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.page }} edges={['left', 'right']}>
      <ManagerScaleContainer>
        <ScreenHeader
          mode="pushed"
          title="Profile"
          subtitle="Your name, photo, sign-in details, and account."
          onBack={handleBack}
        />

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: ds.spacing(space[4]),
            paddingBottom: ds.spacing(space[8]),
            gap: ds.spacing(space[3]),
          }}
        >
          <Card>
            <View style={{ alignItems: 'center', paddingVertical: ds.spacing(space[2]) }}>
              <TouchableOpacity
                onPress={pickImage}
                activeOpacity={0.82}
                accessibilityRole="button"
                accessibilityLabel="Change profile photo"
                style={{ alignItems: 'center' }}
              >
                <View
                  style={{
                    width: avatar,
                    height: avatar,
                    borderRadius: radius.pill,
                    overflow: 'hidden',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: color.tint,
                  }}
                >
                  {avatarUri ? (
                    <Image
                      source={{ uri: avatarUri }}
                      style={{ width: '100%', height: '100%' }}
                    />
                  ) : (
                    <Text
                      style={{
                        fontSize: ds.fontSize(typeScale.display),
                        fontWeight: weight.bold,
                        color: color.accent,
                      }}
                    >
                      {firstName.charAt(0).toUpperCase()}
                    </Text>
                  )}
                </View>
                <Text
                  style={{
                    marginTop: ds.spacing(space[3]),
                    fontSize: ds.fontSize(typeScale.secondary),
                    fontWeight: weight.semibold,
                    color: color.accent,
                  }}
                >
                  Change photo
                </Text>
              </TouchableOpacity>

              <Text
                style={{
                  marginTop: ds.spacing(space[3]),
                  fontSize: ds.fontSize(typeScale.title),
                  fontWeight: weight.bold,
                  color: color.ink,
                }}
              >
                {user?.name || 'Unnamed manager'}
              </Text>
              <Text
                style={{
                  fontSize: ds.fontSize(typeScale.secondary),
                  color: color.ink2,
                  textTransform: 'capitalize',
                }}
              >
                {user?.role || 'manager'}
              </Text>
            </View>
          </Card>

          <Card flush style={{ paddingHorizontal: ds.spacing(space[3] + 2) }}>
            <ListRow
              icon="person-outline"
              title="Full name"
              subtitle={isEditingName ? tempName || 'Not set' : user?.name || 'Not set'}
              right={
                isEditingName ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity
                      onPress={() => setIsEditingName(false)}
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
                      onPress={() => void saveName()}
                      disabled={isSavingName}
                      accessibilityRole="button"
                      accessibilityLabel="Save name"
                      style={{
                        width: size.headerCircle,
                        height: size.headerCircle,
                        alignItems: 'center',
                        justifyContent: 'center',
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
                />
              </View>
            ) : null}

            <ListRow
              icon="mail-outline"
              title="Email"
              subtitle={user?.email || 'Not set'}
              right={<Ionicons name="lock-closed" size={ds.icon(16)} color={color.ink3} />}
            />

            <ListRow
              icon="business-outline"
              title="Managed locations"
              subtitle={locations.length ? `${locations.length} active locations` : 'No locations'}
              last
            />
          </Card>

          {locations.length ? (
            <>
              <SectionLabel>Locations</SectionLabel>
              <Card flush style={{ paddingHorizontal: ds.spacing(space[3] + 2) }}>
                {locations.map((location, index) => (
                  <ListRow
                    key={location.id}
                    icon="restaurant-outline"
                    title={location.name}
                    subtitle={location.short_code}
                    last={index === locations.length - 1}
                    right={
                      <StatusPill
                        status={location.active ? 'fulfilled' : 'draft'}
                        label={location.active ? 'Active' : 'Inactive'}
                      />
                    }
                  />
                ))}
              </Card>
            </>
          ) : null}

          <Button
            variant="secondary"
            icon="key-outline"
            label="Change PIN or password"
            onPress={() => setShowPasswordModal(true)}
          />
          <Button
            variant="destructive"
            icon="trash-outline"
            label="Delete account"
            accessibilityHint="Permanently removes your account and personal data"
            loading={isDeletingAccount}
            onPress={openDeleteConfirmation}
          />
        </ScrollView>

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
      </ManagerScaleContainer>
    </SafeAreaView>
  );
}
