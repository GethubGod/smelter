import React from 'react';
import renderer from 'react-test-renderer';
import { create } from 'zustand';

interface AuthSnapshot {
  initialize: () => Promise<void>;
  isInitialized: boolean;
  isLoading: boolean;
  session: { user: { id: string } } | null;
  locations: string[];
}

const mockUseAuthStore = create<AuthSnapshot>(() => ({
  initialize: jest.fn(async () => undefined),
  isInitialized: true,
  isLoading: false,
  session: null,
  locations: [],
}));
const mockUseDisplayStore = create(() => ({ theme: 'system', reduceMotion: false }));
const mockStackRender = jest.fn();
const mockInventorySubscription = jest.fn();
const mockOrderSubscription = jest.fn();
const mockInventoryCleanup = jest.fn();
const mockOrderCleanup = jest.fn();

jest.mock('@/store', () => ({
  useAuthStore: mockUseAuthStore,
  useDisplayStore: mockUseDisplayStore,
}));
jest.mock('@/hooks', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    useInventorySubscription: () => {
      mockInventorySubscription();
      React.useEffect(() => mockInventoryCleanup, []);
    },
    useOrderSubscription: () => {
      mockOrderSubscription();
      React.useEffect(() => mockOrderCleanup, []);
    },
  };
});
jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  Platform: { OS: 'ios', select: (options: { default: string }) => options.default },
  LogBox: { ignoreLogs: jest.fn() },
  Appearance: { setColorScheme: jest.fn() },
  AppState: {
    currentState: 'background',
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  },
}));
jest.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: 'GestureHandlerRootView',
}));
jest.mock('expo-status-bar', () => ({ StatusBar: 'StatusBar' }));
jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Stack = Object.assign(
    ({ children }: { children?: React.ReactNode }) => {
      mockStackRender();
      return React.createElement('Stack', null, children);
    },
    { Screen: () => null },
  );
  return { Stack };
});
jest.mock('@/lib/supabase', () => ({
  supabaseConfigError: null,
  supabase: { auth: { startAutoRefresh: jest.fn(), stopAutoRefresh: jest.fn() } },
}));
jest.mock('@/services/notificationService', () => ({
  refreshCurrentDevicePushTokenIfStale: jest.fn(async () => undefined),
}));
jest.mock('@/theme/design', () => ({
  colors: { background: '#fff', textPrimary: '#111', textMuted: '#666' },
}));
jest.mock('../../global.css', () => ({}));

// eslint-disable-next-line import/first -- initialize mocked stores before importing the real layout
import RootLayout from '../../app/_layout';

describe('root layout store subscriptions', () => {
  let component: renderer.ReactTestRenderer;

  beforeEach(() => {
    mockUseAuthStore.setState({ session: null, locations: [], isInitialized: true });
    jest.clearAllMocks();
    renderer.act(() => { component = renderer.create(React.createElement(RootLayout)); });
  });

  afterEach(() => {
    renderer.act(() => component.unmount());
  });

  test('does not rerender navigation when only the location catalog changes', () => {
    expect(mockStackRender).toHaveBeenCalledTimes(1);
    renderer.act(() => { mockUseAuthStore.setState({ locations: ['location-1'] }); });
    expect(mockStackRender).toHaveBeenCalledTimes(1);
  });

  test('still mounts subscriptions on sign-in and removes them on sign-out', () => {
    expect(mockInventorySubscription).not.toHaveBeenCalled();
    renderer.act(() => {
      mockUseAuthStore.setState({ session: { user: { id: 'test-user' } } });
    });
    expect(mockInventorySubscription).toHaveBeenCalledTimes(1);
    expect(mockOrderSubscription).toHaveBeenCalledTimes(1);
    expect(mockStackRender).toHaveBeenCalledTimes(2);

    renderer.act(() => { mockUseAuthStore.setState({ session: null }); });
    expect(mockInventorySubscription).toHaveBeenCalledTimes(1);
    expect(mockStackRender).toHaveBeenCalledTimes(3);
    expect(mockInventoryCleanup).toHaveBeenCalledTimes(1);
    expect(mockOrderCleanup).toHaveBeenCalledTimes(1);
  });
});
