import React from 'react';
import {
  EMPLOYEE_QUICK_ORDER_ROUTE_MODE,
  QuickOrderRouteScreen,
} from '@/features/ordering/QuickOrderRouteScreen';

export default function QuickOrderScreen() {
  return <QuickOrderRouteScreen {...EMPLOYEE_QUICK_ORDER_ROUTE_MODE} />;
}
