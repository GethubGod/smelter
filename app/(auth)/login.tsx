import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';

/** Preserve old email login links without keeping a second sign-in screen. */
export default function LoginRedirect() {
  const params = useLocalSearchParams<{ email?: string | string[]; notice?: string | string[] }>();
  return <Redirect href={{ pathname: '/(auth)/sign-in', params: { ...params, method: 'email' } }} />;
}
