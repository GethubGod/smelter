// Shared sign-in form behavior and existing keyboard/loading guarantees:
//
// 1. tapping the background of the shared sign-in dismisses the keyboard,
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

const mockNameSignIn = jest.fn(async (_name: string, _secret: string) => undefined);
const mockResetPassword = jest.fn(async (_email: string) => ({ error: null }));
const mockParams: { method?: string; email?: string; notice?: string } = {};

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
    useLocalSearchParams: () => mockParams,
    useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
    router: { push: jest.fn(), replace: jest.fn() },
  };
});
jest.mock('@/services/loginCredentials', () => ({ signInWithName: (...args: [string, string]) => mockNameSignIn(...args), getLoginFailureCode: () => null }));
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
  supabase: { auth: { resetPasswordForEmail: (email: string) => mockResetPassword(email) } },
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
import LoginScreen from '../features/auth/SignInScreen';
// eslint-disable-next-line import/first -- same ordering requirement
import LoginRedirect from '../../app/(auth)/login';
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
    Object.keys(mockParams).forEach((key) => Reflect.deleteProperty(mockParams, key));
    mockParams.method = 'email';
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


  test('name and email tabs dispatch only to their own auth service and clear the secret', async () => {
    delete mockParams.method;
    const component = renderScreen(React.createElement(LoginScreen));
    const fields = () => component.root.findAllByType('TextInput' as unknown as TestElement);
    await renderer.act(async () => {
      fields()[0].props.onChangeText(' Alex ');
      fields()[1].props.onChangeText('1234');
    });
    await renderer.act(async () => { await fields()[1].props.onSubmitEditing(); });
    expect(mockNameSignIn).toHaveBeenCalledWith('Alex', '1234');
    expect(mockSignIn).not.toHaveBeenCalled();
    const emailTab = component.root.findAllByProps({ accessibilityRole: 'radio', accessibilityLabel: 'Email' })[0];
    renderer.act(() => emailTab.props.onPress());
    expect(fields()[1].props.value).toBe('');
    expect(fields()[0].props.keyboardType).toBe('email-address');
    await renderer.act(async () => {
      fields()[0].props.onChangeText(' alex@example.com ');
      fields()[1].props.onChangeText('TestPassword1!');
    });
    await renderer.act(async () => { await fields()[1].props.onSubmitEditing(); });
    expect(mockSignIn).toHaveBeenCalledWith('alex@example.com', 'TestPassword1!');
    expect(mockNameSignIn).toHaveBeenCalledTimes(1);
    renderer.act(() => component.unmount());
  });

  test('two submissions in the same render dispatch only once', async () => {
    const component = renderScreen(React.createElement(LoginScreen));
    const fields = component.root.findAllByType('TextInput' as unknown as TestElement);
    renderer.act(() => { fields[0].props.onChangeText('alex@example.com'); fields[1].props.onChangeText('TestPassword1!'); });
    await renderer.act(async () => {
      const submit = fields[1].props.onSubmitEditing;
      await Promise.all([submit(), submit()]);
    });
    expect(mockSignIn).toHaveBeenCalledTimes(1);
    renderer.act(() => component.unmount());
  });

  test('confirmation links select Email and preserve the address and notice', () => {
    delete mockParams.method;
    mockParams.email = 'alex@example.com';
    mockParams.notice = 'confirm-email';
    const component = renderScreen(React.createElement(LoginScreen));
    const fields = component.root.findAllByType('TextInput' as unknown as TestElement);
    expect(fields[0].props.value).toBe('alex@example.com');
    expect(fields[0].props.keyboardType).toBe('email-address');
    expect(JSON.stringify(component.toJSON())).toContain('Check your email and confirm your account');
    renderer.act(() => component.unmount());
  });

  test('legacy URLs redirect to the shared screen with email parameters intact', () => {
    mockParams.email = 'alex@example.com';
    mockParams.notice = 'confirm-email';
    const component = renderScreen(React.createElement(LoginRedirect));
    const redirect = component.root.findByType('Redirect' as unknown as TestElement);
    expect(redirect.props.href).toEqual({ pathname: '/(auth)/sign-in', params: { method: 'email', email: 'alex@example.com', notice: 'confirm-email' } });
    renderer.act(() => component.unmount());
  });


  test('a name login failure remains inline and never falls back to email auth', async () => {
    delete mockParams.method;
    mockNameSignIn.mockRejectedValueOnce(new Error('Unable to sign in right now. Check your connection.'));
    const component = renderScreen(React.createElement(LoginScreen));
    const fields = component.root.findAllByType('TextInput' as unknown as TestElement);
    renderer.act(() => { fields[0].props.onChangeText('Alex'); fields[1].props.onChangeText('1234'); });
    await renderer.act(async () => { await fields[1].props.onSubmitEditing(); });
    expect(mockSignIn).not.toHaveBeenCalled();
    expect(JSON.stringify(component.toJSON())).toContain('Unable to sign in right now. Check your connection.');
    expect(fields[1].props.editable).toBe(true);
    renderer.act(() => component.unmount());
  });

  test('email recovery uses the entered email and is unavailable in Name mode', async () => {
    const component = renderScreen(React.createElement(LoginScreen));
    const fields = component.root.findAllByType('TextInput' as unknown as TestElement);
    renderer.act(() => fields[0].props.onChangeText(' alex@example.com '));
    const recovery = component.root.findAllByType('Pressable' as unknown as TestElement)
      .find((node) => node.props.accessibilityRole === 'button');
    expect(recovery).toBeDefined();
    await renderer.act(async () => { await recovery?.props.onPress(); });
    expect(mockResetPassword).toHaveBeenCalledWith('alex@example.com');
    const nameTab = component.root.findAllByProps({ accessibilityRole: 'radio', accessibilityLabel: 'Name' })[0];
    renderer.act(() => nameTab.props.onPress());
    expect(component.root.findAllByType('Pressable' as unknown as TestElement)
      .filter((node) => node.props.accessibilityRole === 'button')).toHaveLength(0);
    renderer.act(() => component.unmount());
  });

  test('the light loading state stays light for the post-auth layouts', () => {
    const component = renderScreen(React.createElement(AuthLoadingScreen));

    const root = component.root.findAllByType('View' as unknown as TestElement)[0];
    expect(flatten(root.props.style).backgroundColor).not.toBe(auth.bg);

    renderer.act(() => component.unmount());
  });
});
