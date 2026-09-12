import { useCallback, useState } from 'react';
import { showNotice } from '@/components/ui/NoticeSheet';
import { showStudioToast } from '@/components/ui/StudioToast';
import { useAuthStore } from '@/store';

interface UseSignOutActionOptions {
  requireConfirmation?: boolean;
}

export function useSignOutAction({
  requireConfirmation = true,
}: UseSignOutActionOptions = {}) {
  const signOut = useAuthStore((state) => state.signOut);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const performSignOut = useCallback(async () => {
    if (isSigningOut) {
      return;
    }

    try {
      setIsSigningOut(true);
      await signOut();
      showStudioToast('Signed out');
    } catch (error) {
      console.error('Failed to complete sign out.', error);

      showNotice('Unable to sign out', 'Please try again.');
    } finally {
      setIsSigningOut(false);
    }
  }, [isSigningOut, signOut]);

  const requestSignOut = useCallback(() => {
    if (isSigningOut) {
      return;
    }

    if (!requireConfirmation) {
      void performSignOut();
      return;
    }

    showNotice('Sign out?', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => {
          void performSignOut();
        },
      },
    ]);
  }, [isSigningOut, performSignOut, requireConfirmation]);

  return {
    isSigningOut,
    performSignOut,
    requestSignOut,
  };
}
