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
}

const mockSignOut = jest.fn(async () => undefined);

const mockUseAuthStore = create<AuthSnapshot>(() => ({
  session: null,
  user: null,
  profile: null,
  viewMode: 'employee',
  isInitialized: true,
  isLoading: false,
  signOut: mockSignOut,
}));

const mockRedirect = jest.fn();

jest.mock('@/store', () => ({ useAuthStore: mockUseAuthStore }));
jest.mock('expo-router', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  return {
    Redirect: ({ href }: { href: string }) => {
      mockRedirect(href);
      return ReactActual.createElement('Redirect', { href });
    },
  };
});
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
  // The @/components/ui barrel reaches design.ts through Sheet.
  StyleSheet: {
    hairlineWidth: 1,
    create: <T,>(styles: T) => styles,
    flatten: <T,>(styles: T) => styles,
  },
}));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('@/constants', () => ({
  colors: { background: '#fff', errorBg: '#fee', error: '#c00', text: '#111' },
}));
// The screen now composes the contract primitives (EmptyState, Button). They
// read the display store through useScaledStyles and pull in the single
// ActivityIndicator host, neither of which this stubbed react-native supports.
jest.mock('@/hooks/useScaledStyles', () => ({
  useScaledStyles: () => ({
    spacing: (value: number) => value,
    fontSize: (value: number) => value,
    radius: (value: number) => value,
    icon: (value: number) => value,
  }),
}));
jest.mock('@/components/LoadingIndicator', () => ({ LoadingIndicator: 'LoadingIndicator' }));

// eslint-disable-next-line import/first -- the mocked stores above must be initialized before the real screens load
import Index from '../../app/index';
// eslint-disable-next-line import/first -- same ordering requirement as the import above
import SuspendedScreen from '../../app/suspended';

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
});
