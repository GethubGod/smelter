// The three behavioural guarantees the auth sweep has to keep:
//
// 1. tapping the background of the legacy login dismisses the keyboard,
// 2. the keyboard's Go key cannot dispatch a second sign-in mid-request,
// 3. the auth guard's loading state is black and goes through the Loading
//    primitive, so a cold start does not flash a light screen.

import React from 'react';
import renderer from 'react-test-renderer';
import { create } from 'zustand';

const dismissKeyboard = jest.fn();
const mockSignIn = jest.fn(async (_email: string, _password: string) => undefined);

interface AuthSnapshot {
  signIn: (email: string, password: string) => Promise<void>;
  isLoading: boolean;
}

const mockUseAuthStore = create<AuthSnapshot>(() => ({
  signIn: (email: string, password: string) => mockSignIn(email, password),
  isLoading: false,
}));

const guardState = { isChecking: false };

jest.mock('react-native', () => {
  const native = jest.requireActual<typeof import('./ui/nativeMocks')>('./ui/nativeMocks');
  const base = native.reactNative();
  return {
    ...base,
    KeyboardAvoidingView: base.View,
    Keyboard: { dismiss: () => dismissKeyboard() },
    Alert: { alert: jest.fn() },
  };
});
jest.mock('@expo/vector-icons', () => {
  const native = jest.requireActual<typeof import('./ui/nativeMocks')>('./ui/nativeMocks');
  return native.vectorIcons();
});
jest.mock('@/hooks/useScaledStyles', () => {
  const native = jest.requireActual<typeof import('./ui/nativeMocks')>('./ui/nativeMocks');
  return native.scaledStyles();
});
jest.mock('@/components/LoadingIndicator', () => {
  const native = jest.requireActual<typeof import('./ui/nativeMocks')>('./ui/nativeMocks');
  return native.loadingIndicator();
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('expo-status-bar', () => ({ StatusBar: 'StatusBar' }));
jest.mock('expo-router', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  return {
    Link: ({ children }: { children: React.ReactNode }) => children,
    Redirect: ({ href }: { href: string }) => ReactActual.createElement('Redirect', { href }),
    useLocalSearchParams: () => ({}),
    useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
    router: { push: jest.fn(), replace: jest.fn() },
  };
});
jest.mock('@/store', () => ({ useAuthStore: mockUseAuthStore }));
jest.mock('@/hooks', () => ({
  useAuthScreenGuard: () => ({
    isChecking: guardState.isChecking,
    authenticatedRedirectTo: null,
    redirectTo: null,
    resolvedRole: null,
  }),
}));
jest.mock('@/lib', () => ({
  supabase: { auth: { resetPasswordForEmail: jest.fn(async () => ({ error: null })) } },
}));
jest.mock('@/components', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  const actual =
    jest.requireActual<typeof import('../components/AuthLoadingScreen')>(
      '../components/AuthLoadingScreen',
    );
  return {
    AuthLoadingScreen: actual.AuthLoadingScreen,
    AuthLogoHeader: () => ReactActual.createElement('AuthLogoHeader'),
  };
});

// eslint-disable-next-line import/first -- the mocks above must initialize before the screen loads
import LoginScreen from '../../app/(auth)/login';
// eslint-disable-next-line import/first -- same ordering requirement
import { AuthLoadingScreen } from '../components/AuthLoadingScreen';
// eslint-disable-next-line import/first -- same ordering requirement
import { auth } from '../theme/tokens';

type TestElement = React.ElementType;

function renderScreen(element: React.ReactElement) {
  let component!: renderer.ReactTestRenderer;
  renderer.act(() => {
    component = renderer.create(element);
  });
  return component;
}

function flatten(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) {
    return style.reduce<Record<string, unknown>>((acc, item) => ({ ...acc, ...flatten(item) }), {});
  }
  return (style ?? {}) as Record<string, unknown>;
}

describe('auth screens contract', () => {
  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    guardState.isChecking = false;
    mockUseAuthStore.setState({
      signIn: (email: string, password: string) => mockSignIn(email, password),
      isLoading: false,
    });
  });

  test('tapping the login background dismisses the keyboard', () => {
    const component = renderScreen(React.createElement(LoginScreen));

    const dismissSurfaces = component.root
      .findAllByType('Pressable' as unknown as TestElement)
      .filter((node) => typeof node.props.onPress === 'function');
    expect(dismissSurfaces.length).toBeGreaterThan(0);

    renderer.act(() => {
      dismissSurfaces[0].props.onPress();
    });
    expect(dismissKeyboard).toHaveBeenCalled();

    renderer.act(() => component.unmount());
  });

  test('the keyboard Go key signs in once, and never during a request in flight', async () => {
    const component = renderScreen(React.createElement(LoginScreen));

    const fields = component.root.findAllByType('TextInput' as unknown as TestElement);
    const password = fields[fields.length - 1];
    expect(typeof password.props.onSubmitEditing).toBe('function');

    await renderer.act(async () => {
      fields[0].props.onChangeText('manager@example.com');
    });
    await renderer.act(async () => {
      password.props.onChangeText('LocalQaManager1!');
    });
    await renderer.act(async () => {
      await password.props.onSubmitEditing();
    });
    expect(mockSignIn).toHaveBeenCalledTimes(1);

    // Same field, same key, while the store reports a sign-in in flight.
    await renderer.act(async () => {
      mockUseAuthStore.setState({ isLoading: true });
    });
    const busyPassword = component.root
      .findAllByType('TextInput' as unknown as TestElement)
      .slice(-1)[0];
    await renderer.act(async () => {
      await busyPassword.props.onSubmitEditing();
    });
    expect(mockSignIn).toHaveBeenCalledTimes(1);

    renderer.act(() => component.unmount());
  });

  test('the auth guard loading state is black and uses the Loading primitive', () => {
    guardState.isChecking = true;
    const component = renderScreen(React.createElement(LoginScreen));

    const root = component.root.findAllByType('View' as unknown as TestElement)[0];
    expect(flatten(root.props.style).backgroundColor).toBe(auth.bg);

    const spinner = component.root.findAllByProps({ accessibilityRole: 'progressbar' });
    expect(spinner.length).toBeGreaterThan(0);
    expect(component.root.findAllByType('LoadingIndicator' as unknown as TestElement)).toHaveLength(
      1,
    );

    renderer.act(() => component.unmount());
  });

  test('the light loading state stays light for the post-auth layouts', () => {
    const component = renderScreen(React.createElement(AuthLoadingScreen));

    const root = component.root.findAllByType('View' as unknown as TestElement)[0];
    expect(flatten(root.props.style).backgroundColor).not.toBe(auth.bg);

    renderer.act(() => component.unmount());
  });
});
