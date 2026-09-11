import { Redirect, Stack } from 'expo-router';
import { AuthLoadingScreen } from '@/components';
import { useProtectedAuthGuard } from '@/hooks';
import { color } from '@/theme/tokens';

export default function SettingsLayout() {
  const guard = useProtectedAuthGuard();

  if (guard.isChecking) {
    return <AuthLoadingScreen />;
  }

  if (guard.redirectTo) {
    return <Redirect href={guard.redirectTo} />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: color.page },
        gestureEnabled: true,
        animation: 'simple_push',
      }}
    />
  );
}
