import {
  resolveAuthScreenGuard,
  resolveProtectedAuthGuard,
} from '../hooks/useAuthGuard';

jest.mock('@/store', () => ({
  useAuthStore: jest.fn(),
}));

describe('resolveAuthScreenGuard', () => {
  const baseSnapshot = {
    session: null,
    user: null,
    profile: null,
    viewMode: 'employee' as const,
    isInitialized: true,
    isLoading: false,
  };

  test('does not redirect while an authenticated auth flow is still loading', () => {
    const result = resolveAuthScreenGuard({
      ...baseSnapshot,
      session: {
        user: {
          id: 'user-1',
          email: 'employee@example.com',
          user_metadata: {},
          app_metadata: {},
        },
      } as any,
      profile: {
        id: 'user-1',
        email: 'employee@example.com',
        full_name: 'Employee One',
        role: 'employee',
        provider: 'email',
        profile_completed: true,
        is_suspended: false,
      } as any,
      isLoading: true,
    });

    expect(result.isChecking).toBe(false);
    expect(result.redirectTo).toBeNull();
    expect(result.authenticatedRedirectTo).toBeNull();
  });

  test('redirects authenticated users to home after auth loading finishes', () => {
    const result = resolveAuthScreenGuard({
      ...baseSnapshot,
      session: {
        user: {
          id: 'user-1',
          email: 'employee@example.com',
          user_metadata: {},
          app_metadata: {},
        },
      } as any,
      profile: {
        id: 'user-1',
        email: 'employee@example.com',
        full_name: 'Employee One',
        role: 'employee',
        provider: 'email',
        profile_completed: true,
        is_suspended: false,
      } as any,
    });

    expect(result.redirectTo).toBe('/(tabs)');
    expect(result.authenticatedRedirectTo).toBe('/(tabs)');
  });

  // Issue #59: `(auth)/complete-profile` was unreachable and has been
  // deleted, so `profile_completed` must not route anywhere any more.
  test('sends an incomplete profile home rather than to a deleted screen', () => {
    const result = resolveAuthScreenGuard({
      ...baseSnapshot,
      session: {
        user: {
          id: 'user-1',
          email: 'employee@example.com',
          user_metadata: {},
          app_metadata: {},
        },
      } as any,
      profile: {
        id: 'user-1',
        email: 'employee@example.com',
        full_name: 'Employee One',
        role: 'employee',
        provider: 'email',
        profile_completed: false,
        is_suspended: false,
      } as any,
    });

    expect(result.redirectTo).toBe('/(tabs)');
    expect(result.authenticatedRedirectTo).toBe('/(tabs)');
  });

  test('a suspended incomplete profile still routes to suspended', () => {
    const result = resolveAuthScreenGuard({
      ...baseSnapshot,
      session: {
        user: {
          id: 'user-1',
          email: 'employee@example.com',
          user_metadata: {},
          app_metadata: {},
        },
      } as any,
      profile: {
        id: 'user-1',
        email: 'employee@example.com',
        full_name: 'Employee One',
        role: 'employee',
        provider: 'email',
        profile_completed: false,
        is_suspended: true,
      } as any,
    });

    expect(result.redirectTo).toBe('/suspended');
  });
});

describe('resolveProtectedAuthGuard', () => {
  const baseSnapshot = {
    session: {
      user: {
        id: 'user-1',
        email: 'employee@example.com',
        user_metadata: {},
        app_metadata: {},
      },
    } as any,
    user: null,
    profile: {
      id: 'user-1',
      email: 'employee@example.com',
      full_name: 'Employee One',
      role: 'employee' as const,
      provider: 'email',
      profile_completed: false,
      is_suspended: false,
    } as any,
    viewMode: 'employee' as const,
    isInitialized: true,
    isLoading: false,
  };

  test('lets an incomplete profile through instead of routing to a deleted screen', () => {
    const result = resolveProtectedAuthGuard(baseSnapshot);

    expect(result.isChecking).toBe(false);
    expect(result.redirectTo).toBeNull();
  });

  test('still holds while hydration is repairing an incomplete profile', () => {
    const result = resolveProtectedAuthGuard({ ...baseSnapshot, isLoading: true });

    expect(result.isChecking).toBe(true);
    expect(result.redirectTo).toBeNull();
  });

  test('a suspended incomplete profile still routes to suspended', () => {
    const result = resolveProtectedAuthGuard({
      ...baseSnapshot,
      profile: { ...baseSnapshot.profile, is_suspended: true },
    });

    expect(result.redirectTo).toBe('/suspended');
  });
});
