import React from 'react';
import renderer from 'react-test-renderer';
import { create } from 'zustand';

type MockProfile = {
  id: string;
  email: string;
  full_name: string;
  role: 'employee' | 'manager';
  provider: string;
  profile_completed: boolean;
  is_suspended: boolean;
};

interface AuthSnapshot {
  session: { user: { id: string; email: string; user_metadata: object; app_metadata: object } } | null;
  user: { id: string; role: 'employee' | 'manager' } | null;
  profile: MockProfile | null;
  viewMode: 'employee' | 'manager';
  isInitialized: boolean;
  isLoading: boolean;
  signOut: () => Promise<void>;
  initialize: () => Promise<void>;
}

const mockSignOut = jest.fn(async () => undefined);
const mockInitialize = jest.fn(async () => undefined);

const mockUseAuthStore = create<AuthSnapshot>(() => ({
  session: null,
  user: null,
  profile: null,
  viewMode: 'employee',
  isInitialized: true,
  isLoading: false,
  signOut: mockSignOut,
  initialize: mockInitialize,
}));

const mockUseDisplayStore = create<{ theme: 'light' | 'dark' | 'system'; reduceMotion: boolean }>(
  () => ({ theme: 'light', reduceMotion: false })
);

const mockRedirect = jest.fn();
const mockUseOrderSubscription = jest.fn();
const mockUseInventorySubscription = jest.fn();
const mockRefreshPushToken = jest.fn(async () => undefined);
const mockStartAutoRefresh = jest.fn();
const mockStopAutoRefresh = jest.fn();

jest.mock('@/store', () => ({
  useAuthStore: mockUseAuthStore,
  useDisplayStore: mockUseDisplayStore,
}));
jest.mock('expo-router', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  const Stack = ({ children }: { children?: React.ReactNode }) =>
    ReactActual.createElement('Stack', null, children);
  Stack.Screen = ({ name }: { name: string }) => ReactActual.createElement('StackScreen', { name });
  return {
    Stack,
    Redirect: ({ href }: { href: string }) => {
      mockRedirect(href);
      return ReactActual.createElement('Redirect', { href });
    },
  };
});
jest.mock('@/hooks', () => ({
  useOrderSubscription: mockUseOrderSubscription,
  useInventorySubscription: mockUseInventorySubscription,
}));
jest.mock('@/services/notificationService', () => ({
  refreshCurrentDevicePushTokenIfStale: mockRefreshPushToken,
}));
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { startAutoRefresh: mockStartAutoRefresh, stopAutoRefresh: mockStopAutoRefresh },
  },
  supabaseConfigError: null,
}));
jest.mock('@/theme/design', () => ({
  colors: { background: '#fff', textPrimary: '#111', textMuted: '#666' },
  authTheme: { background: '#000' },
}));
jest.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: 'GestureHandlerRootView',
}));
jest.mock('expo-status-bar', () => ({ StatusBar: 'StatusBar' }));
jest.mock('../../global.css', () => ({}), { virtual: true });
jest.mock('@/components', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  return { AuthLoadingScreen: () => ReactActual.createElement('AuthLoadingScreen') };
});
jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  Alert: { alert: jest.fn() },
  Platform: { OS: 'ios', select: (options: { default: unknown }) => options.default },
  LogBox: { ignoreLogs: jest.fn() },
  Appearance: { setColorScheme: jest.fn() },
  AppState: {
    currentState: 'active',
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  },
}));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('@/constants', () => ({
  colors: { background: '#fff', errorBg: '#fee', error: '#c00', text: '#111' },
}));

// eslint-disable-next-line import/first -- the mocked stores above must be initialized before the real screens load
import Index from '../../app/index';
// eslint-disable-next-line import/first -- same ordering requirement as the import above
import SuspendedScreen from '../../app/suspended';
// eslint-disable-next-line import/first -- same ordering requirement as the import above
import RootLayout from '../../app/_layout';
// eslint-disable-next-line import/first -- same ordering requirement as the import above
import AuthLayout from '../../app/(auth)/_layout';

const SUSPENDED_SESSION = {
  user: {
    id: 'user-1',
    email: 'employee@example.com',
    user_metadata: {},
    app_metadata: {},
  },
};

function suspendedProfile(overrides: Partial<MockProfile> = {}): MockProfile {
  return {
    id: 'user-1',
    email: 'employee@example.com',
    full_name: 'Employee One',
    role: 'employee',
    provider: 'email',
    profile_completed: true,
    is_suspended: true,
    ...overrides,
  };
}

function renderScreen(element: React.ReactElement) {
  let component!: renderer.ReactTestRenderer;
  renderer.act(() => {
    component = renderer.create(element);
  });
  return component;
}

describe('suspended routing', () => {
  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuthStore.setState({
      session: null,
      user: null,
      profile: null,
      viewMode: 'employee',
      isInitialized: true,
      isLoading: false,
      signOut: mockSignOut,
      initialize: mockInitialize,
    });
  });

  test('a restored session whose profile is suspended lands on /suspended and is not signed out', () => {
    mockUseAuthStore.setState({
      session: SUSPENDED_SESSION as AuthSnapshot['session'],
      user: { id: 'user-1', role: 'employee' },
      profile: suspendedProfile(),
    });

    const component = renderScreen(React.createElement(Index));

    expect(mockRedirect).toHaveBeenCalledWith('/suspended');
    expect(mockRedirect).toHaveBeenCalledTimes(1);
    expect(mockSignOut).not.toHaveBeenCalled();

    renderer.act(() => component.unmount());
  });

  test('a restored session whose profile is active still lands on the employee home', () => {
    mockUseAuthStore.setState({
      session: SUSPENDED_SESSION as AuthSnapshot['session'],
      user: { id: 'user-1', role: 'employee' },
      profile: suspendedProfile({ is_suspended: false }),
    });

    const component = renderScreen(React.createElement(Index));

    expect(mockRedirect).toHaveBeenCalledWith('/(tabs)');
    expect(mockSignOut).not.toHaveBeenCalled();

    renderer.act(() => component.unmount());
  });

  test('the suspended screen explains the suspension and offers sign out', () => {
    mockUseAuthStore.setState({
      session: SUSPENDED_SESSION as AuthSnapshot['session'],
      user: { id: 'user-1', role: 'employee' },
      profile: suspendedProfile(),
    });

    const component = renderScreen(React.createElement(SuspendedScreen));

    expect(mockRedirect).not.toHaveBeenCalled();

    const text = component.root
      .findAllByType('Text' as unknown as React.ElementType)
      .flatMap((node) => node.props.children)
      .filter((child): child is string => typeof child === 'string');
    expect(text).toContain('Account Suspended');
    expect(text).toContain('Sign Out');

    renderer.act(() => component.unmount());
  });

  test('the suspended screen sign out button signs the user out', async () => {
    mockUseAuthStore.setState({
      session: SUSPENDED_SESSION as AuthSnapshot['session'],
      user: { id: 'user-1', role: 'employee' },
      profile: suspendedProfile(),
    });

    const component = renderScreen(React.createElement(SuspendedScreen));

    const button = component.root.findByType('TouchableOpacity' as unknown as React.ElementType);
    await renderer.act(async () => {
      button.props.onPress();
    });

    expect(mockSignOut).toHaveBeenCalledTimes(1);

    renderer.act(() => component.unmount());
  });

  test('the suspended screen still redirects to login when there is no session', () => {
    const component = renderScreen(React.createElement(SuspendedScreen));

    expect(mockRedirect).toHaveBeenCalledWith('/(auth)/login');
    expect(mockSignOut).not.toHaveBeenCalled();

    renderer.act(() => component.unmount());
  });

  describe('the root layout under a suspended session', () => {
    // Sol review finding 2. The suspended relaunch keeps its session so the
    // guards can route and so a reinstatement is seen live, but it must not
    // run like an active session.
    test('does not subscribe to orders or inventory and does not renew the push token', () => {
      mockUseAuthStore.setState({
        session: SUSPENDED_SESSION as AuthSnapshot['session'],
        user: { id: 'user-1', role: 'employee' },
        profile: suspendedProfile(),
      });

      const component = renderScreen(React.createElement(RootLayout));

      expect(mockUseOrderSubscription).not.toHaveBeenCalled();
      expect(mockUseInventorySubscription).not.toHaveBeenCalled();
      expect(mockRefreshPushToken).not.toHaveBeenCalled();
      // The auth store still initializes, so the auth listener and the profile
      // subscription it installs keep watching for a reinstatement.
      expect(mockStartAutoRefresh).toHaveBeenCalled();

      renderer.act(() => component.unmount());
    });

    test('still subscribes and renews the push token for an active profile', () => {
      mockUseAuthStore.setState({
        session: SUSPENDED_SESSION as AuthSnapshot['session'],
        user: { id: 'user-1', role: 'employee' },
        profile: suspendedProfile({ is_suspended: false }),
      });

      const component = renderScreen(React.createElement(RootLayout));

      expect(mockUseOrderSubscription).toHaveBeenCalled();
      expect(mockUseInventorySubscription).toHaveBeenCalled();
      expect(mockRefreshPushToken).toHaveBeenCalledWith('user-1');

      renderer.act(() => component.unmount());
    });
  });

  describe('the (auth) group guard', () => {
    // Sol review finding 3. /ready, /secure, /secure-pin and /secure-password
    // carry no guard of their own, so a deep link could show a suspended
    // session an onboarding success screen. The group layout guards them all.
    test('sends a suspended session that deep links into the group to /suspended', () => {
      mockUseAuthStore.setState({
        session: SUSPENDED_SESSION as AuthSnapshot['session'],
        user: { id: 'user-1', role: 'employee' },
        profile: suspendedProfile(),
      });

      const component = renderScreen(React.createElement(AuthLayout));

      expect(mockRedirect).toHaveBeenCalledWith('/suspended');
      expect(mockRedirect).toHaveBeenCalledTimes(1);
      expect(mockSignOut).not.toHaveBeenCalled();

      renderer.act(() => component.unmount());
    });

    test('leaves onboarding alone for an active profile', () => {
      mockUseAuthStore.setState({
        session: SUSPENDED_SESSION as AuthSnapshot['session'],
        user: { id: 'user-1', role: 'employee' },
        profile: suspendedProfile({ is_suspended: false }),
      });

      const component = renderScreen(React.createElement(AuthLayout));

      expect(mockRedirect).not.toHaveBeenCalled();
      expect(component.root.findAllByType('StackScreen' as unknown as React.ElementType).length).toBeGreaterThan(0);

      renderer.act(() => component.unmount());
    });

    test('leaves a signed-out visitor alone', () => {
      const component = renderScreen(React.createElement(AuthLayout));

      expect(mockRedirect).not.toHaveBeenCalled();

      renderer.act(() => component.unmount());
    });
  });
});
