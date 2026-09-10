import React from 'react';
import {
  MANAGER_QUICK_ORDER_ROUTE_MODE,
  QuickOrderRouteScreen,
} from '@/features/ordering/QuickOrderRouteScreen';

export default function ManagerQuickOrderScreen() {
  return <QuickOrderRouteScreen {...MANAGER_QUICK_ORDER_ROUTE_MODE} />;
}
