import React from 'react';
import renderer, { act } from 'react-test-renderer';

let mockParams: Record<string, string | string[] | undefined> = {};
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockDismissTo = jest.fn();
const mockClipboardRead = jest.fn(async () => '');
const mockFetchInvitePreview = jest.fn();
const mockAcceptInvite = jest.fn();
const mockAcceptInviteLink = jest.fn();
const mockSignIn = jest.fn();
const mockSignInWithOAuth = jest.fn();
const mockSignInWithApple = jest.fn();
const mockAdoptExternalSession = jest.fn();
const mockSignOut = jest.fn();
const mockSetReadyPending = jest.fn();
const mockSetViewMode = jest.fn();
const mockAlreadyOnTeamError = new Error('already_on_team');

jest.mock('../../assets/images/smelter-lockup.png', () => 1);

const mockAuthState: {
  signIn: typeof mockSignIn;
  signInWithOAuth: typeof mockSignInWithOAuth;
  signInWithApple: typeof mockSignInWithApple;
  adoptExternalSession: typeof mockAdoptExternalSession;
  signOut: typeof mockSignOut;
  setReadyPending: typeof mockSetReadyPending;
  user: { id: string; name: string; role: 'employee' | 'manager' } | null;
  profile: {
    full_name: string | null;
    role: 'employee' | 'manager' | null;
  } | null;
  location: { name: string } | null;
  setViewMode: typeof mockSetViewMode;
} = {
  signIn: mockSignIn,
  signInWithOAuth: mockSignInWithOAuth,
  signInWithApple: mockSignInWithApple,
  adoptExternalSession: mockAdoptExternalSession,
  signOut: mockSignOut,
  setReadyPending: mockSetReadyPending,
  user: null,
  profile: null,
  location: null,
  setViewMode: mockSetViewMode,
};

jest.mock('react-native', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  const native = jest.requireActual<typeof import('./ui/nativeMocks')>('./ui/nativeMocks');
  return {
    ...native.reactNative(),
    Image: (props: Record<string, unknown>) => ReactActual.createElement('Image', props),
  };
});
jest.mock('expo-router', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  return {
    Redirect: ({ href }: { href: unknown }) => ReactActual.createElement('Redirect', { href }),
    useLocalSearchParams: () => mockParams,
    useRouter: () => ({
      push: mockPush,
      replace: mockReplace,
      back: mockBack,
      dismissTo: mockDismissTo,
    }),
  };
});
jest.mock('expo-clipboard', () => ({ getStringAsync: () => mockClipboardRead() }));
jest.mock('@expo/vector-icons', () => {
  const native = jest.requireActual<typeof import('./ui/nativeMocks')>('./ui/nativeMocks');
  return native.vectorIcons();
});
jest.mock('@/hooks/useScaledStyles', () => {
  const native = jest.requireActual<typeof import('./ui/nativeMocks')>('./ui/nativeMocks');
  return native.scaledStyles();
});
jest.mock('@/hooks', () => ({
  useAuthScreenGuard: () => ({ isChecking: false, authenticatedRedirectTo: null }),
}));
jest.mock('@/components', () => ({ AuthLoadingScreen: () => 'AuthLoadingScreen' }));
jest.mock('@/components/ui', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  return {
    Button: (props: Record<string, unknown>) => ReactActual.createElement('Button', props),
    Loading: (props: Record<string, unknown>) => ReactActual.createElement('Loading', props),
  };
});
jest.mock('@/features/auth/components/AuthScreenShell', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  return {
    AuthScreenShell: ({ children }: { children: React.ReactNode }) =>
      ReactActual.createElement('AuthScreenShell', null, children),
  };
});
jest.mock('@/features/auth/components/AuthCloseButton', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  return {
    AuthCloseButton: (props: Record<string, unknown>) =>
      ReactActual.createElement('AuthCloseButton', props),
  };
});
jest.mock('@/features/auth/components/AuthInputWell', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  return {
    AuthInputWell: ReactActual.forwardRef((props: Record<string, unknown>, ref) =>
      ReactActual.createElement('AuthInputWell', { ...props, ref }),
    ),
  };
});
jest.mock('@/features/auth/components/WizardProgress', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  return {
    WizardProgress: (props: Record<string, unknown>) =>
      ReactActual.createElement('WizardProgress', props),
  };
});
jest.mock('@/features/auth/components/ProviderButtons', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  return {
    ProviderButtons: (props: Record<string, unknown>) =>
      ReactActual.createElement('ProviderButtons', props),
  };
});
jest.mock('@/features/auth/components/PasswordRequirements', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  const common = new Set([
    'password',
    'password1',
    '12345678',
    '123456789',
    'qwerty123',
    'iloveyou',
    'sushi1234',
    'letmein1',
  ]);
  const getPasswordRequirements = (password: string) => ({
    length: password.length >= 8,
    mixed: /[A-Za-z]/.test(password) && /\d/.test(password),
    uncommon: password.length > 0 && !common.has(password.toLowerCase()),
  });
  return {
    getPasswordRequirements,
    PasswordRequirements: (props: Record<string, unknown>) =>
      ReactActual.createElement('PasswordRequirements', props),
  };
});
jest.mock('@/features/auth/components/AuthToast', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  return {
    AuthToast: (props: Record<string, unknown>) => ReactActual.createElement('AuthToast', props),
  };
});
jest.mock('@/features/auth/components/SignInSheet', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  return {
    SignInSheet: (props: Record<string, unknown>) =>
      ReactActual.createElement('SignInSheet', props),
  };
});
jest.mock('@/features/auth/legal', () => ({
  openAuthBrowser: jest.fn(),
  SIGNUP_URL: 'https://smelterpos.com/signup',
}));
jest.mock('@/store/authStore', () => ({
  useAuthStore: (selector: (state: typeof mockAuthState) => unknown) => selector(mockAuthState),
}));
jest.mock('@/services/invites', () => ({
  acceptInvite: (...args: unknown[]) => mockAcceptInvite(...args),
  acceptInviteLink: (...args: unknown[]) => mockAcceptInviteLink(...args),
  fetchInvitePreview: (...args: unknown[]) => mockFetchInvitePreview(...args),
  getInviteErrorInvitedBy: () => null,
  getInviteFailureReason: () => null,
  getInviteServiceCode: () => null,
  isInviteAlreadyOnTeam: (error: unknown) => error === mockAlreadyOnTeamError,
  isInviteNetworkError: () => false,
}));

// eslint-disable-next-line import/first -- mocks must initialize before screen imports
import InviteLinkScreen, { inviteLinkErrorMessage } from '@/features/auth/InviteLinkScreen';
// eslint-disable-next-line import/first -- mocks must initialize before screen imports
import InviteHelloScreen, {
  abbreviatedName,
  inviteRestaurant,
} from '@/features/auth/InviteHelloScreen';
// eslint-disable-next-line import/first -- mocks must initialize before screen imports
import InviteLoginScreen, { isInviteEmailValid } from '@/features/auth/InviteLoginScreen';
// eslint-disable-next-line import/first -- mocks must initialize before screen imports
import ReadyScreen from '@/features/auth/ReadyScreen';
// eslint-disable-next-line import/first -- mocks must initialize before screen imports
import WelcomeScreen from '@/features/auth/WelcomeScreen';
// eslint-disable-next-line import/first -- shared wizard state under test
import { useOnboardingStore } from '@/features/auth/onboardingStore';

const preview = {
  invitedName: 'Maya Rivera',
  invitedEmail: 'maya@example.com',
  invitedBy: 'Kevin Chen',
  role: 'employee' as const,
  locationGroup: 'sushi' as const,
};
const validToken = 'abcdefghijklmnopqrstuvwx';

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function render(element: React.ReactElement) {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(element);
  });
  return tree;
}

function findHost(tree: renderer.ReactTestRenderer, type: string) {
  return tree.root.find((node) => String(node.type) === type);
}

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  mockSignIn.mockResolvedValue({ id: 'user-1' });
  mockSignInWithOAuth.mockResolvedValue({ access_token: 'provider-session' });
  mockSignInWithApple.mockResolvedValue({ access_token: 'provider-session' });
  mockAdoptExternalSession.mockResolvedValue({ id: 'user-1' });
  mockSignOut.mockResolvedValue(undefined);
  mockAcceptInvite.mockResolvedValue({ role: 'employee', locationGroup: 'sushi' });
  mockAcceptInviteLink.mockResolvedValue({ role: 'employee', locationGroup: 'sushi' });
  mockFetchInvitePreview.mockResolvedValue(preview);
  mockAuthState.user = null;
  mockAuthState.profile = null;
  mockAuthState.location = null;
  useOnboardingStore.getState().reset();
});

it('constrains the Welcome lockup to its delivered aspect ratio', () => {
  const tree = render(React.createElement(WelcomeScreen));
  const lockup = findHost(tree, 'Image');

  expect(lockup.props.style).toMatchObject({
    width: 112,
    height: 112 * (257 / 1198),
  });
  act(() => tree.unmount());
});

it('keeps invalid input local and shows the exact link error without a request', () => {
  const tree = render(React.createElement(InviteLinkScreen));
  const input = tree.root.findByProps({ testID: 'invite-link-input' });

  act(() => input.props.onChangeText('not an invite'));
  act(() => tree.root.findByProps({ label: 'Continue' }).props.onPress());

  expect(mockFetchInvitePreview).not.toHaveBeenCalled();
  expect(tree.root.findByProps({ testID: 'invite-link-input' }).props.error).toBe(
    "That doesn't look like an invite link. Paste the whole link from your manager.",
  );
  act(() => tree.unmount());
});

it('dismisses the whole wizard to Welcome and clears invite state from X', () => {
  useOnboardingStore.getState().setInvite(validToken, preview);
  const tree = render(React.createElement(InviteLinkScreen));

  act(() => findHost(tree, 'AuthCloseButton').props.onPress());

  expect(mockDismissTo).toHaveBeenCalledWith('/(auth)/welcome');
  expect(useOnboardingStore.getState()).toMatchObject({ token: null, preview: null });
  expect(mockReplace).not.toHaveBeenCalledWith('/(auth)/welcome');
  act(() => tree.unmount());
});

it('reads the clipboard only from Paste and carries the full preview into step two', async () => {
  mockClipboardRead.mockResolvedValue(validToken);
  const tree = render(React.createElement(InviteLinkScreen));
  expect(mockClipboardRead).not.toHaveBeenCalled();

  await act(async () => {
    tree.root.findByProps({ testID: 'invite-link-input' }).props.onTrailingPress();
    await flushPromises();
  });
  expect(mockClipboardRead).toHaveBeenCalledTimes(1);

  await act(async () => {
    tree.root.findByProps({ label: 'Continue' }).props.onPress();
    await flushPromises();
  });

  expect(mockFetchInvitePreview).toHaveBeenCalledWith(validToken);
  expect(useOnboardingStore.getState()).toMatchObject({ token: validToken, preview });
  expect(mockPush).toHaveBeenCalledWith({
    pathname: '/(auth)/invite-hello',
    params: { token: validToken },
  });
  act(() => tree.unmount());
});

it('locks an invited email and enables Finish only after every password rule passes', () => {
  useOnboardingStore.getState().setInvite(validToken, preview);
  const tree = render(React.createElement(InviteLoginScreen));

  expect(tree.root.findByProps({ testID: 'invite-email-input' }).props.locked).toBe(true);
  expect(tree.root.findByProps({ label: 'Finish' }).props.disabled).toBe(true);

  act(() => {
    tree.root.findByProps({ testID: 'invite-password-input' }).props.onChangeText('Maya2026');
  });

  expect(tree.root.findByProps({ label: 'Finish' }).props.disabled).toBe(false);
  act(() => tree.unmount());
});

it('accepts the email invite before signing in and replacing the wizard with Ready', async () => {
  useOnboardingStore.getState().setInvite(validToken, preview);
  const tree = render(React.createElement(InviteLoginScreen));
  act(() => {
    tree.root.findByProps({ testID: 'invite-password-input' }).props.onChangeText('Maya2026');
  });

  await act(async () => {
    tree.root.findByProps({ label: 'Finish' }).props.onPress();
    await flushPromises();
  });

  expect(mockSetReadyPending).toHaveBeenCalledWith(true);
  expect(mockAcceptInvite).toHaveBeenCalledWith({
    token: validToken,
    email: 'maya@example.com',
    password: 'Maya2026',
  });
  expect(mockSignIn).toHaveBeenCalledWith('maya@example.com', 'Maya2026');
  expect(mockReplace).toHaveBeenCalledWith('/(auth)/ready');
  act(() => tree.unmount());
});

it('blocks a second Finish dispatch before React can render the busy state', async () => {
  useOnboardingStore.getState().setInvite(validToken, preview);
  let finishAccept: ((value: { role: 'employee'; locationGroup: 'sushi' }) => void) | null = null;
  mockAcceptInvite.mockImplementation(
    () =>
      new Promise((resolve) => {
        finishAccept = resolve;
      }),
  );
  const tree = render(React.createElement(InviteLoginScreen));
  act(() => {
    tree.root.findByProps({ testID: 'invite-password-input' }).props.onChangeText('Maya2026');
  });
  const finish = tree.root.findByProps({ label: 'Finish' }).props.onPress;

  act(() => {
    finish();
    finish();
  });

  expect(mockAcceptInvite).toHaveBeenCalledTimes(1);
  await act(async () => {
    finishAccept?.({ role: 'employee', locationGroup: 'sushi' });
    await flushPromises();
  });
  act(() => tree.unmount());
});

it('signs out a provider account that already belongs to a team and stays on step two', async () => {
  mockParams = { token: validToken };
  useOnboardingStore.getState().setInvite(validToken, preview);
  mockAcceptInviteLink.mockRejectedValue(mockAlreadyOnTeamError);
  const tree = render(React.createElement(InviteHelloScreen));

  await act(async () => {
    findHost(tree, 'ProviderButtons').props.onGoogle();
    await flushPromises();
  });

  expect(mockSignOut).toHaveBeenCalledTimes(1);
  expect(mockSetReadyPending).toHaveBeenNthCalledWith(1, true);
  expect(mockSetReadyPending).toHaveBeenLastCalledWith(false);
  expect(mockReplace).not.toHaveBeenCalledWith('/(auth)/ready');
  expect(findHost(tree, 'AuthToast').props.message).toBe(
    'That account is already on a team. Sign in instead.',
  );
  act(() => tree.unmount());
});

it('enters the role home from Ready without exposing the prior wizard stack', () => {
  useOnboardingStore.getState().setInvite(validToken, {
    ...preview,
    role: 'manager',
    locationGroup: 'both',
  });
  mockAuthState.user = { id: 'manager-1', name: 'Maya Rivera', role: 'manager' };
  mockAuthState.profile = { full_name: 'Maya Rivera', role: 'manager' };
  mockAuthState.location = { name: 'Babytuna Sushi' };
  const tree = render(React.createElement(ReadyScreen));

  act(() => tree.root.findByProps({ label: 'Open your dashboard' }).props.onPress());

  expect(mockSetViewMode).toHaveBeenCalledWith('manager');
  expect(mockReplace).toHaveBeenCalledWith('/(manager)');
  expect(mockSetReadyPending).toHaveBeenCalledWith(false);
  expect(mockSetViewMode.mock.invocationCallOrder[0]).toBeLessThan(
    mockSetReadyPending.mock.invocationCallOrder[0],
  );
  expect(useOnboardingStore.getState()).toMatchObject({ token: null, preview: null });
  act(() => tree.unmount());
});

it('formats approved wizard data and validation without placeholder business data', () => {
  expect(inviteRestaurant('sushi')).toBe('Babytuna Sushi');
  expect(inviteRestaurant('poki')).toBe('Babytuna Poki & Pho');
  expect(inviteRestaurant('both')).toBe('Babytuna');
  expect(abbreviatedName('Kevin Chen')).toBe('Kevin C.');
  expect(isInviteEmailValid('maya@example.com')).toBe(true);
  expect(isInviteEmailValid('maya@localhost')).toBe(false);
  expect(inviteLinkErrorMessage('expired', 'Kevin Chen')).toBe(
    'This invite has expired. Ask Kevin to send a new one.',
  );
});
