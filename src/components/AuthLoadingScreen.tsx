// The guard-checking placeholder. Every screen that gates on an auth guard
// renders this while the session is resolving.
//
// `onDark` paints it with the auth background so a cold start goes black to
// black instead of flashing the light daily-work page behind the auth stack.
// Post-auth layouts keep the light page and leave the prop off.

import React from 'react';
import { View } from 'react-native';
import { Loading } from '@/components/ui';
import { auth, color } from '@/theme/tokens';

export interface AuthLoadingScreenProps {
  /** Black background, for the auth stack and the cold-start root route. */
  onDark?: boolean;
}

export function AuthLoadingScreen({ onDark = false }: AuthLoadingScreenProps) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: onDark ? auth.bg : color.page,
      }}
    >
      <Loading
        label="Loading"
        color={onDark ? auth.text : color.accent}
        testID="auth-loading-screen"
      />
    </View>
  );
}
