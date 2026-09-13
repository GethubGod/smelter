import React from 'react';
import renderer, { type ReactTestInstance } from 'react-test-renderer';

const mockSignIn = jest.fn();
const mockSignOut = jest.fn(async () => undefined);
const mockSetReadyPending = jest.fn();
const mockResetPassword = jest.fn(async () => ({ error: null }));

const authState = {
  session: null as object | null,
  profile: { role: 'employee' as const },
  signIn: mockSignIn,
  signOut: mockSignOut,
  setReadyPending: mockSetReadyPending,
  signInWithOAuth: jest.fn(),
  signInWithApple: jest.fn(),
};

jest.mock('react-native', () => {
  const native = jest.requireActual<typeof import('./ui/nativeMocks')>('./ui/nativeMocks');
  return native.reactNative();
});
jest.mock('@expo/vector-icons', () => {
  const native = jest.requireActual<typeof import('./ui/nativeMocks')>('./ui/nativeMocks');
  return native.vectorIcons();
});
jest.mock('react-native-svg', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  const host = (name: string) => (props: Record<string, unknown>) =>
    ReactActual.createElement(name, props);
  return { __esModule: true, default: host('Svg'), Path: host('Path') };
});
jest.mock('@/hooks/useScaledStyles', () => {
  const native = jest.requireActual<typeof import('./ui/nativeMocks')>('./ui/nativeMocks');
  return native.scaledStyles();
});
jest.mock('@/components/LoadingIndicator', () => {
  const native = jest.requireActual<typeof import('./ui/nativeMocks')>('./ui/nativeMocks');
  return native.loadingIndicator();
});
jest.mock('@/components/ui/Sheet', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  return {
    Sheet: ({ visible, children, onClose }: {
      visible: boolean;
      children: React.ReactNode;
      onClose: () => void;
    }) => visible ? ReactActual.createElement('Sheet', { onClose }, children) : null,
  };
});
jest.mock('@/store/authStore', () => ({
  useAuthStore: { getState: () => authState },
}));
jest.mock('@/lib/supabase', () => ({
  supabase: { auth: { resetPasswordForEmail: mockResetPassword } },
}));

// eslint-disable-next-line import/first -- mocks must initialize before the component loads
import { SignInSheet } from '@/features/auth/components/SignInSheet';
// eslint-disable-next-line import/first -- same ordering requirement
import { AuthLoadingScreen } from '@/components/AuthLoadingScreen';
// eslint-disable-next-line import/first -- same ordering requirement
import { auth } from '@/theme/tokens';

type HostType = React.ElementType;

function render(element: React.ReactElement): renderer.ReactTestRenderer {
  let tree!: renderer.ReactTestRenderer;
  renderer.act(() => {
    tree = renderer.create(element);
  });
  return tree;
}

function flatten(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) {
    return style.reduce<Record<string, unknown>>(
      (result, item) => ({ ...result, ...flatten(item) }),
      {},
    );
  }
  return (style ?? {}) as Record<string, unknown>;
}

function fields(root: ReactTestInstance) {
  return root.findAllByType('TextInput' as unknown as HostType);
}

describe('auth screens contract', () => {
  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    authState.session = null;
    authState.profile = { role: 'employee' };
  });

  test('the keyboard Go key cannot dispatch twice while sign-in is in flight', async () => {
    let settle!: () => void;
    mockSignIn.mockImplementation(
      () => new Promise<void>((resolve) => { settle = resolve; }),
    );
    const onComplete = jest.fn();
    const tree = render(
      React.createElement(SignInSheet, { visible: true, onClose: jest.fn(), onComplete }),
    );
    const [email, password] = fields(tree.root);

    renderer.act(() => {
      email.props.onChangeText('manager@example.com');
      password.props.onChangeText('Password123');
    });
    const activePassword = fields(tree.root)[1];
    renderer.act(() => {
      activePassword.props.onSubmitEditing();
      activePassword.props.onSubmitEditing();
    });

    expect(mockSignIn).toHaveBeenCalledTimes(1);
    await renderer.act(async () => {
      settle();
      await Promise.resolve();
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
    renderer.act(() => tree.unmount());
  });

  test('a dismissed sheet ignores a late sign-in result and keeps the request lock', async () => {
    let settle!: () => void;
    mockSignIn.mockImplementation(
      () => new Promise<void>((resolve) => { settle = resolve; }),
    );
    const onComplete = jest.fn();
    const tree = render(
      React.createElement(SignInSheet, { visible: true, onClose: jest.fn(), onComplete }),
    );
    const [email, password] = fields(tree.root);

    renderer.act(() => {
      email.props.onChangeText('manager@example.com');
      password.props.onChangeText('Password123');
    });
    renderer.act(() => {
      fields(tree.root)[1].props.onSubmitEditing();
      tree.root.findByType('Sheet' as unknown as HostType).props.onClose();
      fields(tree.root)[1].props.onSubmitEditing();
    });

    expect(mockSignIn).toHaveBeenCalledTimes(1);
    authState.session = { user: { id: 'manager-1' } };
    await renderer.act(async () => {
      settle();
      await Promise.resolve();
    });
    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(onComplete).not.toHaveBeenCalled();
    renderer.act(() => tree.unmount());
  });

  test('the auth loading state uses the Studio page colour and Loading primitive', () => {
    const tree = render(React.createElement(AuthLoadingScreen, { onDark: true }));
    const root = tree.root.findAllByType('View' as unknown as HostType)[0];

    expect(flatten(root.props.style).backgroundColor).toBe(auth.bg);
    expect(tree.root.findAllByProps({ accessibilityRole: 'progressbar' }).length).toBeGreaterThan(0);
    expect(tree.root.findAllByType('LoadingIndicator' as unknown as HostType)).toHaveLength(1);
    renderer.act(() => tree.unmount());
  });
});
