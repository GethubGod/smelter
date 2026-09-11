import React from 'react';
import {
  BrowseInventoryRouteScreen,
  EMPLOYEE_BROWSE_ROUTE_MODE,
} from '@/features/browse/BrowseInventoryRouteScreen';

export default function InventoryBrowseTabRoute() {
  return <BrowseInventoryRouteScreen {...EMPLOYEE_BROWSE_ROUTE_MODE} />;
}
