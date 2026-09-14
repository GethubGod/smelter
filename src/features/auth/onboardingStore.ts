import { create } from 'zustand';
import type { InvitePreview } from '@/services/invites';

interface OnboardingState {
  token: string | null;
  preview: InvitePreview | null;
  setInvite: (token: string, preview: InvitePreview) => void;
  reset: () => void;
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  token: null,
  preview: null,
  setInvite: (token, preview) => set({ token, preview }),
  reset: () => set({ token: null, preview: null }),
}));
