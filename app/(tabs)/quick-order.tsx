import React from 'react';
import { View } from 'react-native';
import { Redirect } from 'expo-router';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { QuickOrderScreen as QuickOrderChatScreen } from '@/features/ordering/QuickOrderScreen';
import { EMPLOYEE_ORDERING_MODE } from '@/features/ordering/modes';
import { useModuleAccessGuard } from '@/hooks';
import { ScreenHeader } from '@/components/ui';
import { color } from '@/theme/tokens';

export default function QuickOrderScreen() {
  // Phase 3: this surface is gated by the ordering_advanced module. Deep links
  // to a disabled module redirect home, mirroring how role guards behave.
  const guard = useModuleAccessGuard('ordering_advanced');

  if (guard.isChecking) {
    return null;
  }

  if (guard.redirectTo) {
    return <Redirect href={guard.redirectTo} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: color.page }}>
      {/* The tab bar shows the space-constrained "Advanced" label; the root
          header keeps the full name visible on the screen itself. */}
      <ScreenHeader title="Advanced ordering" />
      <ErrorBoundary title="Advanced ordering unavailable">
        <QuickOrderChatScreen mode={EMPLOYEE_ORDERING_MODE} />
      </ErrorBoundary>
    </View>
  );
}
