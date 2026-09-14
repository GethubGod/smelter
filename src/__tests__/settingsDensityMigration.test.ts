import {
  normalizePersistedSimpleOrderDensity,
  useSettingsStore,
} from '@/store/settingsStore';
import { DEFAULT_SIMPLE_ORDER_DENSITY } from '@/types/settings';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));

describe('simple order density settings', () => {
  it('starts new settings at Compact', () => {
    expect(DEFAULT_SIMPLE_ORDER_DENSITY).toBe('compact');
    expect(useSettingsStore.getInitialState().simpleOrderDensity).toBe('compact');
  });

  it('moves the legacy dense value to Compact', () => {
    expect(normalizePersistedSimpleOrderDensity('dense', 0)).toBe('compact');
    expect(normalizePersistedSimpleOrderDensity('comfort', 0)).toBe('comfort');
  });

  it('keeps all three current values and repairs invalid persisted data', () => {
    expect(normalizePersistedSimpleOrderDensity('comfort', 1)).toBe('comfort');
    expect(normalizePersistedSimpleOrderDensity('compact', 1)).toBe('compact');
    expect(normalizePersistedSimpleOrderDensity('dense', 1)).toBe('dense');
    expect(normalizePersistedSimpleOrderDensity('unknown', 1)).toBe('compact');
    expect(normalizePersistedSimpleOrderDensity(undefined, 1)).toBe('compact');
  });
});
