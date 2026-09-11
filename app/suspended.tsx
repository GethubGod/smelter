// Suspended account. Post-auth, so this is a daily-work surface, not a black
// auth screen: the contract's EmptyState carries the explanation and the one
// action is a Button.

import React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect } from 'expo-router';
import { useAuthStore } from '@/store';
import { useSignOutAction } from '@/hooks/useSignOutAction';
import { AuthLoadingScreen } from '@/components';
import { Button, EmptyState } from '@/components/ui';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { color, space } from '@/theme/tokens';

export default function SuspendedScreen() {
  const ds = useScaledStyles();
  const { session, profile, isLoading, isInitialized } = useAuthStore();
  const { isSigningOut, performSignOut } = useSignOutAction({ requireConfirmation: false });

  if (!isInitialized || isLoading) {
    return <AuthLoadingScreen />;
  }

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  if (!profile?.is_suspended) {
    return <Redirect href="/" />;
  }

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: color.page }}
      edges={['top', 'left', 'right']}
    >
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: ds.spacing(space[5]),
        }}
      >
        <EmptyState
          tone="alert"
          icon="ban-outline"
          title="Account Suspended"
          body="Your account has been suspended. Contact your manager."
        />
        <Button
          label="Sign Out"
          onPress={() => {
            void performSignOut();
          }}
          loading={isSigningOut}
          disabled={isSigningOut}
          style={{ alignSelf: 'stretch', marginTop: ds.spacing(space[4]) }}
        />
      </View>
    </SafeAreaView>
  );
}
