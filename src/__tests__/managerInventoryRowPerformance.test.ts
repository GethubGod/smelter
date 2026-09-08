import React from 'react';
import renderer from 'react-test-renderer';
import {
  ManagerInventoryRow,
  type ManagerInventoryStockItem,
} from '@/features/inventory/ManagerInventoryRow';
import type { InventoryItem } from '@/types';

jest.mock('react-native', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  const createComponent = (name: string) => {
    const Component = ({ children, ...props }: { children?: React.ReactNode }) =>
      React.createElement(name, props, children);
    Component.displayName = name;
    return Component;
  };
  return {
    View: createComponent('View'),
    Text: createComponent('Text'),
    TouchableOpacity: createComponent('TouchableOpacity'),
    Platform: {
      OS: 'ios',
      select: (values: Record<string, unknown>) => values.ios ?? values.default,
    },
    StyleSheet: { hairlineWidth: 1 },
  };
});

jest.mock('@expo/vector-icons', () => ({
  Ionicons: (props: Record<string, unknown>) => React.createElement('Ionicons', props),
}));

jest.mock('@/hooks/useScaledStyles', () => ({
  useScaledStyles: () => ({
    spacing: (value: number) => value,
    fontSize: (value: number) => value,
    icon: (value: number) => value,
  }),
}));

function makeItem(id: string, onNameRead: () => void): ManagerInventoryStockItem {
  const inventoryItem: InventoryItem = {
    id: `inventory-${id}`,
    name: `Item ${id}`,
    category: 'produce',
    supplier_category: 'main_distributor',
    base_unit: 'each',
    pack_unit: 'case',
    pack_size: 1,
    active: true,
    created_at: '2026-09-01T00:00:00Z',
  };
  Object.defineProperty(inventoryItem, 'name', {
    enumerable: true,
    get: () => {
      onNameRead();
      return `Item ${id}`;
    },
  });

  return {
    id,
    inventory_item: inventoryItem,
    location: {
      id: 'location-1',
      name: 'Sushi',
      short_code: 'SU',
      active: true,
      created_at: '2026-09-01T00:00:00Z',
    },
    area_ids: ['area-1'],
    areas: [],
    area_names: ['Walk-in'],
    current_quantity: 2,
    min_quantity: 4,
    max_quantity: 10,
    unit_type: 'case',
    last_updated_at: '2026-09-01T00:00:00Z',
    status: 'critical',
    overdue: false,
    fillPercent: 20,
    areaLabel: 'Walk-in',
  };
}

describe('ManagerInventoryRow render behavior', () => {
  test('rerenders only the row whose selection state changed', () => {
    let firstNameReads = 0;
    let secondNameReads = 0;
    const first = makeItem('first', () => { firstNameReads += 1; });
    const second = makeItem('second', () => { secondNameReads += 1; });
    const onOpen = jest.fn();
    const onEnterBulk = jest.fn();
    const onToggleBulk = jest.fn();
    const onAddToReorder = jest.fn();

    function Rows({ firstSelected }: { firstSelected: boolean }) {
      return React.createElement(
        React.Fragment,
        null,
        ...[first, second].map((item, index) =>
          React.createElement(ManagerInventoryRow, {
            key: item.id,
            item,
            variant: 'list',
            added: false,
            isBulkMode: true,
            isSelected: index === 0 && firstSelected,
            onOpen,
            onEnterBulk,
            onToggleBulk,
            onAddToReorder,
          }),
        ),
      );
    }

    let component!: renderer.ReactTestRenderer;
    renderer.act(() => {
      component = renderer.create(React.createElement(Rows, { firstSelected: false }));
    });
    const firstReadsAfterMount = firstNameReads;
    const secondReadsAfterMount = secondNameReads;

    renderer.act(() => {
      component.update(React.createElement(Rows, { firstSelected: true }));
    });

    expect(firstNameReads).toBeGreaterThan(firstReadsAfterMount);
    expect(secondNameReads).toBe(secondReadsAfterMount);
    renderer.act(() => component.unmount());
  });
});
