/**
 * Issue #74, the other half of the fix: proves the auth store is what tells
 * the stock-check queue that a session is usable. The gate itself is covered
 * in stockCheckQueueAuthDrain.test.ts; this file only checks the wiring, so
 * the gate is mocked.
 */
const mockAsyncStorage = {
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
  multiRemove: jest.fn(async (keys: readonly string[]) => {
    void keys;
  }),
};

const signInWithPasswordMock = jest.fn();
const getSessionMock = jest.fn(async () => ({ data: { session: null } }));
const onAuthStateChangeMock = jest.fn();
const signOutMock = jest.fn(async () => ({ error: null }));
const clearSupabaseStoredSessionMock = jest.fn(async () => undefined);

const profileMaybeSingleMock = jest.fn();
const profileUpdateEqMock = jest.fn(async () => ({ error: null }));
const userMaybeSingleMock = jest.fn();
const rpcMock = jest.fn();
const channelOnMock = jest.fn();
const channelSubscribeMock = jest.fn();

const notifyAuthSessionRestoredMock = jest.fn();
const notifyAuthSessionClearedMock = jest.fn();
const deleteSelfAccountRequestMock = jest.fn();
const clearDeviceNotificationsMock = jest.fn(async () => undefined);
const deactivateCurrentDevicePushTokenMock = jest.fn(async () => undefined);

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
  openAuthSessionAsync: jest.fn(),
}));
jest.mock('@/lib/api/client', () => ({
  registerSessionGetter: jest.fn(),
  deleteSelfAccountRequest: deleteSelfAccountRequestMock,
}));
jest.mock('@/services/notificationService', () => ({
  clearDeviceNotifications: clearDeviceNotificationsMock,
  deactivateCurrentDevicePushToken: deactivateCurrentDevicePushTokenMock,
}));
jest.mock('@/services/accessCodes', () => ({
  validateAccessCode: jest.fn(),
}));
jest.mock('@/features/stock-check/queueDrainGate', () => ({
  notifyAuthSessionRestored: notifyAuthSessionRestoredMock,
  notifyAuthSessionCleared: notifyAuthSessionClearedMock,
}));
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: signInWithPasswordMock,
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

function employeeProfileRow(id: string) {
  return {
    id,
    email: `${id}@example.com`,
    full_name: 'Employee One',
    role: 'employee',
    is_suspended: false,
    suspended_at: null,
    suspended_by: null,
    notifications_enabled: true,
    last_active_at: '2026-09-08T00:00:00.000Z',
    last_order_at: null,
    profile_completed: true,
    provider: 'email',
    created_at: '2026-09-08T00:00:00.000Z',
    updated_at: '2026-09-08T00:00:00.000Z',
  };
}

function sessionFor(id: string) {
  return {
    access_token: `token-${id}`,
    refresh_token: `refresh-${id}`,
    user: {
      id,
      email: `${id}@example.com`,
      user_metadata: {},
      app_metadata: {},
    },
  };
}

describe('authStore notifies the stock-check queue gate', () => {
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    onAuthStateChangeMock.mockImplementation(() => ({
      data: { subscription: { unsubscribe: jest.fn() } },
    }));
    rpcMock.mockResolvedValue({
      data: null,
      error: { code: 'PGRST202', message: 'Function not found' },
    });
    deleteSelfAccountRequestMock.mockResolvedValue({ error: null });
    signOutMock.mockResolvedValue({ error: null });
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    useAuthStore.setState(useAuthStore.getInitialState(), true);
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  test('a successful sign in reports the restored session exactly once', async () => {
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
        last_active_at: '2026-09-08T00:00:00.000Z',
        last_order_at: null,
        profile_completed: true,
        provider: 'email',
        created_at: '2026-09-08T00:00:00.000Z',
        updated_at: '2026-09-08T00:00:00.000Z',
      },
      error: null,
    });
    userMaybeSingleMock.mockResolvedValue({ data: null, error: null });

    await useAuthStore.getState().signIn('employee@example.com', 'Password123');

    expect(notifyAuthSessionRestoredMock).toHaveBeenCalledTimes(1);
    // The gate needs the owner: it stamps queued stock counts with it.
    expect(notifyAuthSessionRestoredMock).toHaveBeenCalledWith('employee-1');
  });

  test('a cold launch with no session never reports a restored session', async () => {
    getSessionMock.mockResolvedValue({ data: { session: null } });

    await useAuthStore.getState().initialize();

    expect(notifyAuthSessionRestoredMock).not.toHaveBeenCalled();
    expect(notifyAuthSessionClearedMock).toHaveBeenCalled();
  });

  test('a relaunch into a suspended profile keeps the session but never arms the drain', async () => {
    // Issue #62 + Sol review finding 1. The suspended restore keeps the
    // session so the guards can route to /suspended, but the stock RPCs are
    // SECURITY DEFINER and only check for an authenticated owner. Arming the
    // drain here would commit counts an employee queued offline before the
    // suspension landed.
    getSessionMock.mockResolvedValue({ data: { session: sessionFor('employee-1') } } as never);
    profileMaybeSingleMock.mockResolvedValue({
      data: {
        ...employeeProfileRow('employee-1'),
        is_suspended: true,
        suspended_at: '2026-09-09T00:00:00.000Z',
        suspended_by: 'manager-1',
      },
      error: null,
    });
    userMaybeSingleMock.mockResolvedValue({ data: null, error: null });

    await useAuthStore.getState().initialize();

    expect(useAuthStore.getState().session).not.toBeNull();
    expect(useAuthStore.getState().profile?.is_suspended).toBe(true);
    expect(notifyAuthSessionRestoredMock).not.toHaveBeenCalled();
  });

  test('a sign-out during hydration is not reported as a restored session', async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: { session: sessionFor('employee-1') },
      error: null,
    });
    userMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    // The user signs out while the profile fetch is still in flight. The
    // hydration that started before it must not arm the drain afterwards:
    // the app is signed out, and the next account would inherit the flag.
    profileMaybeSingleMock.mockImplementationOnce(async () => {
      await useAuthStore.getState().signOut();
      return { data: null, error: null };
    });
    profileMaybeSingleMock.mockResolvedValue({ data: null, error: null });

    await useAuthStore.getState().signIn('employee@example.com', 'Password123');

    expect(notifyAuthSessionClearedMock).toHaveBeenCalled();
    expect(notifyAuthSessionRestoredMock).not.toHaveBeenCalled();
    expect(useAuthStore.getState().session).toBeNull();
  });

  test('an account switch during hydration is not reported for the departing user', async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: { session: sessionFor('employee-1') },
      error: null,
    });
    userMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    // A second account takes the session over mid-hydration.
    profileMaybeSingleMock.mockImplementationOnce(async () => {
      useAuthStore.setState({ session: sessionFor('employee-2') as never });
      return { data: employeeProfileRow('employee-2'), error: null };
    });
    profileMaybeSingleMock.mockResolvedValue({
      data: employeeProfileRow('employee-2'),
      error: null,
    });

    await useAuthStore.getState().signIn('employee@example.com', 'Password123');

    expect(notifyAuthSessionRestoredMock).not.toHaveBeenCalledWith('employee-1');
    expect(notifyAuthSessionRestoredMock).not.toHaveBeenCalled();
  });

  test('deleting the account clears the gate like a sign-out', async () => {
    useAuthStore.setState({
      session: sessionFor('employee-1') as never,
      user: { id: 'employee-1', email: 'employee-1@example.com' } as never,
      profile: employeeProfileRow('employee-1') as never,
    });

    await useAuthStore.getState().deleteSelfAccount('DELETE');

    // Without this the drain gate stays armed for the deleted session and
    // the next account on the device never gets its launch drain.
    expect(notifyAuthSessionClearedMock).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().session).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
    expect(clearSupabaseStoredSessionMock).toHaveBeenCalled();
  });

  test('sign out still removes the legacy draft key left behind by older installs', async () => {
    // Sol review finding 4. draftStore is gone, but a device that ran an
    // earlier build still has the previous user's draft under this key, and
    // nothing else clears it now that the store is deleted.
    useAuthStore.setState({
      session: sessionFor('employee-1') as never,
      user: { id: 'employee-1', email: 'employee-1@example.com' } as never,
      profile: employeeProfileRow('employee-1') as never,
    });

    await useAuthStore.getState().signOut();

    const removedKeys = mockAsyncStorage.multiRemove.mock.calls.flatMap(
      ([keys]) => keys as readonly string[]
    );
    expect(removedKeys).toContain('draft-storage');
  });
});
