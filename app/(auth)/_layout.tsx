import { Stack } from 'expo-router';
import { auth } from '@/theme/tokens';

/**
 * Every auth screen is black under the contract, legacy login and signup
 * included, so the stack sets one background instead of nine.
 */
export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: auth.bg },
      }}
    />
  );
}
