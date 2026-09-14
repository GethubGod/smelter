import type { Session } from '@supabase/supabase-js';

const mockAsyncStorage = {
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
  multiRemove: jest.fn(async () => undefined),
};

const signInWithPasswordMock = jest.fn();
const signInWithOAuthMock = jest.fn();
const exchangeCodeForSessionMock = jest.fn();
const openAuthSessionAsyncMock = jest.fn();
const getSessionMock = jest.fn(
  async (): Promise<{ data: { session: Session | null } }> => ({ data: { session: null } }),
);
const onAuthStateChangeMock = jest.fn();
const signOutMock = jest.fn(async () => ({ error: null }));
const clearSupabaseStoredSessionMock = jest.fn(async () => undefined);

const profileMaybeSingleMock = jest.fn();
const profileUpdateEqMock = jest.fn(async () => ({ error: null }));
const userMaybeSingleMock = jest.fn();
const rpcMock = jest.fn();
const channelOnMock = jest.fn();
const channelSubscribeMock = jest.fn();

const createChannelMock = () => {
  channelOnMock.mockImplementation(() => ({
    on: channelOnMock,
    subscribe: channelSubscribeMock,
  }));
  return {
    on: channelOnMock,
    subscribe: channelSubscribeMock,
  };
};

const fromMock = jest.fn((table: string) => {
  if (table === 'locations') {
    return {
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          order: jest.fn(async () => ({ data: [] })),
        })),
      })),
    };
  }

  if (table === 'profiles') {
    return {
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          maybeSingle: profileMaybeSingleMock,
        })),
      })),
      update: jest.fn(() => ({
        eq: profileUpdateEqMock,
      })),
    };
  }

  if (table === 'users') {
    return {
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          maybeSingle: userMaybeSingleMock,
        })),
      })),
    };
  }

  throw new Error(`Unexpected table mock request: ${table}`);
});

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);
jest.mock('expo-auth-session', () => ({
  makeRedirectUri: jest.fn(() => 'babytunasystems://auth/callback'),
}));
jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: openAuthSessionAsyncMock,
}));

jest.mock('@/lib/api/client', () => ({
  registerSessionGetter: jest.fn(),
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: signInWithPasswordMock,
      signInWithOAuth: signInWithOAuthMock,
      exchangeCodeForSession: exchangeCodeForSessionMock,
      getSession: getSessionMock,
      onAuthStateChange: onAuthStateChangeMock,
      signOut: signOutMock,
    },
    from: fromMock,
    rpc: rpcMock,
    channel: jest.fn(() => createChannelMock()),
    removeChannel: jest.fn(),
  },
  clearSupabaseStoredSession: clearSupabaseStoredSessionMock,
}));

// eslint-disable-next-line import/first -- must load after the jest.mock() calls above so their mock vars are initialized first
import { useAuthStore } from '../store/authStore';

describe('useAuthStore auth flow reliability', () => {
  let authChangeCallback: ((event: string, session: any) => void) | null;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    authChangeCallback = null;
    onAuthStateChangeMock.mockImplementation((callback: (event: string, session: any) => void) => {
      authChangeCallback = callback;
      return {
        data: {
          subscription: {
            unsubscribe: jest.fn(),
          },
        },
      };
    });
    useAuthStore.setState(useAuthStore.getInitialState(), true);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('repairs the public.users row during sign in when auth succeeded but the app user row is missing', async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: {
        session: {
          user: {
            id: 'manager-1',
            email: 'manager@example.com',
            user_metadata: {},
            app_metadata: {},
          },
        },
      },
      error: null,
    });

    profileMaybeSingleMock.mockResolvedValue({
      data: {
        id: 'manager-1',
        email: 'manager@example.com',
        full_name: 'Manager One',
        role: 'manager',
        is_suspended: false,
        suspended_at: null,
        suspended_by: null,
        notifications_enabled: true,
        last_active_at: '2026-03-22T00:00:00.000Z',
        last_order_at: null,
        profile_completed: true,
        provider: 'email',
        created_at: '2026-03-22T00:00:00.000Z',
        updated_at: '2026-03-22T00:00:00.000Z',
      },
      error: null,
    });

    userMaybeSingleMock
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: null });
    rpcMock.mockResolvedValue({
      data: null,
      error: {
        code: 'PGRST202',
        message: 'Function ensure_current_user_identity not found',
      },
    });

    await expect(
      useAuthStore.getState().signIn('manager@example.com', 'Password123')
    ).resolves.toMatchObject({
      id: 'manager-1',
      email: 'manager@example.com',
      name: 'Manager One',
      role: 'manager',
    });

    expect(rpcMock).toHaveBeenCalledWith('ensure_current_user_identity');
    expect(useAuthStore.getState().user).toMatchObject({
      id: 'manager-1',
      name: 'Manager One',
      role: 'manager',
    });
  });

  test('defers provider hydration until the invite claim has completed', async () => {
    await useAuthStore.getState().initialize();
    const providerSession: Session = {
      access_token: 'provider-token',
      refresh_token: 'provider-refresh',
      expires_in: 3600,
      token_type: 'bearer',
      user: {
        id: 'provider-1',
        email: 'provider@example.com',
        aud: 'authenticated',
        created_at: '2026-09-13T00:00:00.000Z',
        user_metadata: {},
        app_metadata: {},
      },
    };
    signInWithOAuthMock.mockResolvedValue({
      data: { url: 'https://provider.example/authorize' },
      error: null,
    });
    openAuthSessionAsyncMock.mockResolvedValue({
      type: 'success',
      url: 'babytunasystems://auth/callback?code=provider-code',
    });
    exchangeCodeForSessionMock.mockImplementation(async () => {
      authChangeCallback?.('SIGNED_IN', providerSession);
      return { data: { session: providerSession }, error: null };
    });
    getSessionMock.mockResolvedValue({ data: { session: providerSession } });
    profileMaybeSingleMock.mockResolvedValue({
      data: {
        id: 'provider-1',
        email: 'provider@example.com',
        full_name: 'Invited Person',
        role: 'employee',
        is_suspended: false,
        suspended_at: null,
        suspended_by: null,
        notifications_enabled: true,
        last_active_at: null,
        last_order_at: null,
        order_send_mode: 'review',
        profile_completed: true,
        provider: 'google',
        created_at: '2026-09-13T00:00:00.000Z',
        updated_at: '2026-09-13T00:00:00.000Z',
      },
      error: null,
    });
    userMaybeSingleMock.mockResolvedValue({
      data: {
        id: 'provider-1',
        email: 'provider@example.com',
        name: 'Invited Person',
        role: 'employee',
        default_location_id: null,
        created_at: '2026-09-13T00:00:00.000Z',
      },
      error: null,
    });

    const session = await useAuthStore
      .getState()
      .signInWithOAuth('google', { deferHydration: true });

    expect(session).toBe(providerSession);
    expect(profileMaybeSingleMock).not.toHaveBeenCalled();
    expect(rpcMock).not.toHaveBeenCalled();

    await useAuthStore.getState().adoptExternalSession(providerSession);

    expect(useAuthStore.getState().profile).toMatchObject({
      full_name: 'Invited Person',
      role: 'employee',
    });
  });

  test('falls back to client-side hydration when the identity repair RPC is permission denied', async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: {
        session: {
          user: {
            id: 'employee-2',
            email: 'employee2@example.com',
            user_metadata: {},
            app_metadata: {},
          },
        },
      },
      error: null,
    });

    profileMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    userMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    rpcMock.mockResolvedValue({
      data: null,
      error: {
        code: '42501',
        message: 'permission denied for function ensure_current_user_identity',
      },
    });

    await expect(
      useAuthStore.getState().signIn('employee2@example.com', 'Password123')
    ).resolves.toMatchObject({
      id: 'employee-2',
      email: 'employee2@example.com',
      role: 'employee',
    });

    expect(useAuthStore.getState().profile).toMatchObject({
      id: 'employee-2',
      email: 'employee2@example.com',
      profile_completed: true,
    });
    expect(useAuthStore.getState().user).toMatchObject({
      id: 'employee-2',
      email: 'employee2@example.com',
      role: 'employee',
    });
  });

  test('cancels deferred signed-out cleanup when a newer sign-in starts', async () => {
    await useAuthStore.getState().initialize();

    expect(authChangeCallback).not.toBeNull();

    jest.clearAllMocks();

    authChangeCallback?.('SIGNED_OUT', null);

    signInWithPasswordMock.mockResolvedValue({
      data: {
        session: {
          user: {
            id: 'employee-1',
            email: 'employee@example.com',
            user_metadata: {},
            app_metadata: {},
          },
        },
      },
      error: null,
    });

    profileMaybeSingleMock.mockResolvedValue({
      data: {
        id: 'employee-1',
        email: 'employee@example.com',
        full_name: 'Employee One',
        role: 'employee',
        is_suspended: false,
        suspended_at: null,
        suspended_by: null,
        notifications_enabled: true,
        last_active_at: '2026-03-22T00:00:00.000Z',
        last_order_at: null,
        profile_completed: true,
        provider: 'email',
        created_at: '2026-03-22T00:00:00.000Z',
        updated_at: '2026-03-22T00:00:00.000Z',
      },
      error: null,
    });

    userMaybeSingleMock.mockResolvedValue({
      data: {
        id: 'employee-1',
        email: 'employee@example.com',
        name: 'Employee One',
        role: 'employee',
        default_location_id: null,
        created_at: '2026-03-22T00:00:00.000Z',
      },
      error: null,
    });

    await expect(
      useAuthStore.getState().signIn('employee@example.com', 'Password123')
    ).resolves.toMatchObject({
      id: 'employee-1',
      email: 'employee@example.com',
      role: 'employee',
    });

    jest.runOnlyPendingTimers();
    await Promise.resolve();

    expect(clearSupabaseStoredSessionMock).not.toHaveBeenCalled();
    expect(useAuthStore.getState().session?.user?.id).toBe('employee-1');
  });
  test('keeps a restored session when the profile is suspended instead of signing out', async () => {
    // Issue #62: session restore at launch must leave the suspended session in
    // place so the route guards can send the user to /suspended.
    getSessionMock.mockResolvedValueOnce({
      data: {
        session: {
          user: {
            id: 'suspended-1',
            email: 'suspended@example.com',
            user_metadata: {},
            app_metadata: {},
          },
        },
      },
    } as any);

    profileMaybeSingleMock.mockResolvedValue({
      data: {
        id: 'suspended-1',
        email: 'suspended@example.com',
        full_name: 'Suspended Employee',
        role: 'employee',
        is_suspended: true,
        suspended_at: '2026-09-08T00:00:00.000Z',
        suspended_by: 'manager-1',
        notifications_enabled: true,
        last_active_at: '2026-09-07T00:00:00.000Z',
        last_order_at: null,
        profile_completed: true,
        provider: 'email',
        created_at: '2026-03-22T00:00:00.000Z',
        updated_at: '2026-09-08T00:00:00.000Z',
      },
      error: null,
    });

    userMaybeSingleMock.mockResolvedValue({
      data: {
        id: 'suspended-1',
        email: 'suspended@example.com',
        name: 'Suspended Employee',
        role: 'employee',
        default_location_id: null,
        created_at: '2026-03-22T00:00:00.000Z',
      },
      error: null,
    });

    await useAuthStore.getState().initialize();

    const state = useAuthStore.getState();
    expect(state.session?.user?.id).toBe('suspended-1');
    expect(state.profile).toMatchObject({ id: 'suspended-1', is_suspended: true });
    expect(state.user).toMatchObject({ id: 'suspended-1', role: 'employee' });
    expect(signOutMock).not.toHaveBeenCalled();
    expect(clearSupabaseStoredSessionMock).not.toHaveBeenCalled();
  });

  test('still refuses an explicit sign-in by a suspended user', async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: {
        session: {
          user: {
            id: 'suspended-2',
            email: 'suspended2@example.com',
            user_metadata: {},
            app_metadata: {},
          },
        },
      },
      error: null,
    });

    profileMaybeSingleMock.mockResolvedValue({
      data: {
        id: 'suspended-2',
        email: 'suspended2@example.com',
        full_name: 'Suspended Two',
        role: 'employee',
        is_suspended: true,
        suspended_at: '2026-09-08T00:00:00.000Z',
        suspended_by: 'manager-1',
        notifications_enabled: true,
        last_active_at: null,
        last_order_at: null,
        profile_completed: true,
        provider: 'email',
        created_at: '2026-03-22T00:00:00.000Z',
        updated_at: '2026-09-08T00:00:00.000Z',
      },
      error: null,
    });

    await expect(
      useAuthStore.getState().signIn('suspended2@example.com', 'Password123')
    ).rejects.toThrow('Account suspended. Contact a manager.');

    expect(useAuthStore.getState().session).toBeNull();
    expect(useAuthStore.getState().profile).toBeNull();
  });
});
