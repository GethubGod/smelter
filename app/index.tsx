import React from 'react';
import { Redirect } from 'expo-router';
import { useAuthStore } from '@/store';
import { AuthLoadingScreen } from '@/components';
import { getAuthenticatedHomeHref, useProtectedAuthGuard } from '@/hooks/useAuthGuard';

export default function Index() {
  const viewMode = useAuthStore((state) => state.viewMode);
  const guard = useProtectedAuthGuard();

  if (guard.isChecking) {
    // Cold start resolves here before redirecting, and the auth stack behind
    // it is black. Anything lighter flashes on every launch.
    return <AuthLoadingScreen onDark />;
  }

  if (guard.redirectTo) {
    return <Redirect href={guard.redirectTo} />;
  }

  return <Redirect href={getAuthenticatedHomeHref(guard.resolvedRole, viewMode)} />;
}
