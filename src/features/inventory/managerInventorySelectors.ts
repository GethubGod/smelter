import type { OrderState } from '@/store/orderStore.types';

type ManagerInventoryOrderSource = Pick<
  OrderState,
  'addToCart' | 'getTotalCartCount'
>;

export function selectManagerInventoryOrderState(state: ManagerInventoryOrderSource) {
  return {
    addToCart: state.addToCart,
    cartCount: state.getTotalCartCount('manager'),
  };
}
