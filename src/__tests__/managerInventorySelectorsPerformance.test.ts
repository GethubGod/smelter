import React from 'react';
import renderer from 'react-test-renderer';
import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { selectManagerInventoryOrderState } from '@/features/inventory/managerInventorySelectors';
import type { OrderState } from '@/store/orderStore.types';

type TestOrderState = Pick<OrderState, 'addToCart' | 'getTotalCartCount'> & {
  managerCount: number;
  unrelatedRevision: number;
};

describe('manager inventory order selector', () => {
  test('ignores unrelated updates and keeps the derived manager cart count live', () => {
    const initialAddToCart: OrderState['addToCart'] = () => undefined;
    const replacementAddToCart: OrderState['addToCart'] = () => undefined;
    const useTestOrderStore = create<TestOrderState>((_set, get) => ({
      addToCart: initialAddToCart,
      getTotalCartCount: (context) => (context === 'manager' ? get().managerCount : 0),
      managerCount: 0,
      unrelatedRevision: 0,
    }));
    const snapshots: ReturnType<typeof selectManagerInventoryOrderState>[] = [];

    function Probe() {
      snapshots.push(useTestOrderStore(useShallow(selectManagerInventoryOrderState)));
      return React.createElement('Probe');
    }

    let component!: renderer.ReactTestRenderer;
    renderer.act(() => {
      component = renderer.create(React.createElement(Probe));
    });
    renderer.act(() => {
      useTestOrderStore.setState({ unrelatedRevision: 1 });
    });
    expect(snapshots).toHaveLength(1);

    renderer.act(() => {
      useTestOrderStore.setState({ managerCount: 3 });
    });
    expect(snapshots).toHaveLength(2);
    expect(snapshots[1].cartCount).toBe(3);

    renderer.act(() => {
      useTestOrderStore.setState({ addToCart: replacementAddToCart });
    });
    expect(snapshots).toHaveLength(3);
    expect(snapshots[2].addToCart).toBe(replacementAddToCart);

    renderer.act(() => component.unmount());
  });
});
