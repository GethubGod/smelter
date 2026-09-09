const mockAsyncStorage = {
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
};

const signOutMock = jest.fn(async () => undefined);
const listInventoryMock = jest.fn();
const supabaseMock = {
  from: jest.fn(),
};

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);
jest.mock('../lib/supabase', () => ({
  supabase: supabaseMock,
}));
jest.mock('../lib/api/client', () => ({
  listInventory: listInventoryMock,
}));
jest.mock('../store/authStore', () => ({
  useAuthStore: {
    getState: () => ({
      signOut: signOutMock,
    }),
  },
}));

// eslint-disable-next-line import/first -- must load after the jest.mock() calls above so their mock vars are initialized first
import {
  invalidatePendingInventoryRequests,
  useInventoryStore,
} from '../store/inventoryStore';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function inventoryItem(id: string, name: string) {
  return {
    id,
    name,
    category: 'fish',
    supplier_category: 'fish_supplier',
    supplier_id: 'supplier-1',
    location_id: null,
    base_unit: 'lb',
    pack_unit: 'case',
    pack_size: 1,
    active: true,
    created_at: '2026-03-23T00:00:00.000Z',
    created_by: 'user-1',
  };
}

function createInventoryQueryResult(result: { data: unknown; error: unknown }) {
  const query: {
    select: jest.Mock;
    eq: jest.Mock;
    limit: jest.Mock;
  } = {
    select: jest.fn(),
    eq: jest.fn(),
    limit: jest.fn(async () => result),
  };

  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);

  return query;
}

describe('useInventoryStore.fetchItems', () => {
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    invalidatePendingInventoryRequests();
    listInventoryMock.mockReset();
    signOutMock.mockReset();
    supabaseMock.from.mockReset();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    useInventoryStore.setState(useInventoryStore.getInitialState(), true);
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  test('surfaces the auth error without forcing sign-out when the API reports an expired session', async () => {
    listInventoryMock.mockResolvedValue({
      data: null,
      error: 'Session expired. Please sign in again.',
    });

    await expect(useInventoryStore.getState().fetchItems()).resolves.toBeUndefined();

    expect(signOutMock).not.toHaveBeenCalled();
    expect(useInventoryStore.getState().error).toBe(
      'Session expired. Please sign in again.'
    );
    expect(useInventoryStore.getState().isLoading).toBe(false);
  });

  test('captures non-auth inventory errors without rejecting', async () => {
    listInventoryMock.mockResolvedValue({
      data: null,
      error: 'Network error — please check your connection.',
    });
    const fallbackQuery = createInventoryQueryResult({
      data: null,
      error: new Error('fallback failed'),
    });
    supabaseMock.from.mockReturnValue(fallbackQuery);

    await expect(useInventoryStore.getState().fetchItems()).resolves.toBeUndefined();

    expect(signOutMock).not.toHaveBeenCalled();
    expect(useInventoryStore.getState().error).toBe(
      'Network error — please check your connection.'
    );
    expect(useInventoryStore.getState().isLoading).toBe(false);
  });

  test('falls back to a direct inventory query when the API returns no items', async () => {
    listInventoryMock.mockResolvedValue({
      data: [],
      error: null,
    });
    const fallbackQuery = createInventoryQueryResult({
      data: [
        {
          id: 'item-1',
          name: 'Salmon',
          category: 'fish',
          supplier_category: 'fish_supplier',
          supplier_id: 'supplier-1',
          base_unit: 'lb',
          pack_unit: 'case',
          pack_size: 1,
          active: true,
          created_at: '2026-03-23T00:00:00.000Z',
          created_by: 'user-1',
        },
      ],
      error: null,
    });
    supabaseMock.from.mockReturnValue(fallbackQuery);

    await expect(useInventoryStore.getState().fetchItems()).resolves.toBeUndefined();

    expect(listInventoryMock).toHaveBeenCalledWith({
      limit: 5000,
    });
    expect(supabaseMock.from).toHaveBeenCalledWith('inventory_items');
    expect(fallbackQuery.eq.mock.calls).toContainEqual(['active', true]);
    expect(useInventoryStore.getState().items).toEqual([
      {
        id: 'item-1',
        name: 'Salmon',
        category: 'fish',
        supplier_category: 'fish_supplier',
        supplier_id: 'supplier-1',
        base_unit: 'lb',
        pack_unit: 'case',
        pack_size: 1,
        active: true,
        location_id: null,
        created_at: '2026-03-23T00:00:00.000Z',
        created_by: 'user-1',
      },
    ]);
    expect(useInventoryStore.getState().error).toBeNull();
  });

  test('shares one inventory request across concurrent callers', async () => {
    const request = deferred<{ data: ReturnType<typeof inventoryItem>[]; error: null }>();
    listInventoryMock.mockReturnValue(request.promise);

    const first = useInventoryStore.getState().fetchItems();
    const second = useInventoryStore.getState().fetchItems();

    await Promise.resolve();
    expect(listInventoryMock).toHaveBeenCalledTimes(1);

    request.resolve({ data: [inventoryItem('item-1', 'Salmon')], error: null });
    await Promise.all([first, second]);
    expect(useInventoryStore.getState().items.map((item) => item.id)).toEqual(['item-1']);
  });

  test('runs one follow-up refresh when force arrives during a request', async () => {
    const firstRequest = deferred<{ data: ReturnType<typeof inventoryItem>[]; error: null }>();
    listInventoryMock
      .mockReturnValueOnce(firstRequest.promise)
      .mockResolvedValueOnce({ data: [inventoryItem('item-2', 'Tuna')], error: null });

    const initial = useInventoryStore.getState().fetchItems();
    await Promise.resolve();
    expect(listInventoryMock).toHaveBeenCalledTimes(1);
    const forced = useInventoryStore.getState().fetchItems({ force: true });

    firstRequest.resolve({ data: [inventoryItem('item-1', 'Salmon')], error: null });
    await Promise.all([initial, forced]);

    expect(listInventoryMock).toHaveBeenCalledTimes(2);
    expect(useInventoryStore.getState().items.map((item) => item.id)).toEqual(['item-2']);
  });

  test('does not join or publish an inventory request from a cleared session', async () => {
    const oldRequest = deferred<{ data: ReturnType<typeof inventoryItem>[]; error: null }>();
    const newRequest = deferred<{ data: ReturnType<typeof inventoryItem>[]; error: null }>();
    listInventoryMock
      .mockReturnValueOnce(oldRequest.promise)
      .mockReturnValueOnce(newRequest.promise);

    const oldLoad = useInventoryStore.getState().fetchItems();
    invalidatePendingInventoryRequests();
    const newLoad = useInventoryStore.getState().fetchItems();

    await Promise.resolve();
    expect(listInventoryMock).toHaveBeenCalledTimes(2);
    newRequest.resolve({ data: [inventoryItem('new-item', 'Tuna')], error: null });
    await newLoad;
    oldRequest.resolve({ data: [inventoryItem('old-item', 'Salmon')], error: null });
    await oldLoad;

    expect(useInventoryStore.getState().items.map((item) => item.id)).toEqual(['new-item']);
  });

  test('does not persist loading or error updates when cached items are unchanged', async () => {
    const items = Array.from({ length: 2_001 }, (_, index) =>
      inventoryItem(`item-${index}`, `Item ${index}`),
    );
    useInventoryStore.setState({ items });
    await Promise.resolve();
    mockAsyncStorage.setItem.mockClear();

    useInventoryStore.setState({ isLoading: true });
    useInventoryStore.setState({ error: 'network down' });
    await Promise.resolve();

    expect(mockAsyncStorage.setItem).not.toHaveBeenCalled();

    useInventoryStore.setState({
      items: [...items, inventoryItem('item-new', 'New item')],
    });
    await Promise.resolve();

    expect(mockAsyncStorage.setItem).toHaveBeenCalledTimes(1);
  });
});
