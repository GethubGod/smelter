import { create } from 'zustand';
import { router } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { showStudioToast } from '@/components/ui/StudioToast';

export const useViewModeTransition = create<{ fading: boolean; arriving: boolean }>(() => ({ fading: false, arriving: false }));
let switchTimer: ReturnType<typeof setTimeout> | undefined;

export function switchViewMode(mode: 'employee' | 'manager') {
  if (switchTimer) clearTimeout(switchTimer);
  useViewModeTransition.setState({ fading: true });
  switchTimer = setTimeout(() => {
    switchTimer = undefined;
    useAuthStore.getState().setViewMode(mode);
    useViewModeTransition.setState({ fading: false, arriving: true });
    router.replace(mode === 'manager' ? '/(manager)' : '/(tabs)/simple-order');
    setTimeout(() => useViewModeTransition.setState({ arriving: false }), 240);
    showStudioToast(mode === 'manager' ? 'Manager view' : 'Employee view', 1300);
  }, 200);
}
