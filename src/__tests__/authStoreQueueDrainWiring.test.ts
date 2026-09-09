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
  multiRemove: jest.fn(async () => undefined),
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

describe('authStore notifies the stock-check queue gate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    onAuthStateChangeMock.mockImplementation(() => ({
      data: { subscription: { unsubscribe: jest.fn() } },
    }));
    rpcMock.mockResolvedValue({
      data: null,
      error: { code: 'PGRST202', message: 'Function not found' },
    });
    useAuthStore.setState(useAuthStore.getInitialState(), true);
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
  });

  test('a cold launch with no session never reports a restored session', async () => {
    getSessionMock.mockResolvedValue({ data: { session: null } });

    await useAuthStore.getState().initialize();

    expect(notifyAuthSessionRestoredMock).not.toHaveBeenCalled();
    expect(notifyAuthSessionClearedMock).toHaveBeenCalled();
  });
});
