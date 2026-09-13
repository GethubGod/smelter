import { useOnboardingStore } from '@/features/auth/onboardingStore';
import type { InvitePreview } from '@/services/invites';

const preview: InvitePreview = {
  invitedName: 'Maya Rivera',
  invitedEmail: 'maya@example.com',
  invitedBy: 'Kevin Chen',
  role: 'employee',
  locationGroup: 'sushi',
};

beforeEach(() => {
  useOnboardingStore.getState().reset();
});

it('keeps the token and complete preview together for all wizard steps', () => {
  useOnboardingStore.getState().setInvite('invite-token', preview);

  expect(useOnboardingStore.getState()).toMatchObject({
    token: 'invite-token',
    preview,
  });
});

it('replaces stale invite details atomically', () => {
  useOnboardingStore.getState().setInvite('first-token', preview);
  const replacement: InvitePreview = {
    invitedName: 'Jordan Lee',
    invitedEmail: null,
    invitedBy: 'Kim Park',
    role: 'manager',
    locationGroup: 'both',
  };

  useOnboardingStore.getState().setInvite('second-token', replacement);

  expect(useOnboardingStore.getState()).toMatchObject({
    token: 'second-token',
    preview: replacement,
  });
});

it('clears the whole invite when the wizard closes', () => {
  useOnboardingStore.getState().setInvite('invite-token', preview);

  useOnboardingStore.getState().reset();

  expect(useOnboardingStore.getState()).toMatchObject({ token: null, preview: null });
});
