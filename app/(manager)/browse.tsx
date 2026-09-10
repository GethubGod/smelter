import React from 'react';
import {
  BrowseInventoryRouteScreen,
  MANAGER_BROWSE_ROUTE_MODE,
} from '@/features/browse/BrowseInventoryRouteScreen';

export default function ManagerBrowseRoute() {
  return <BrowseInventoryRouteScreen {...MANAGER_BROWSE_ROUTE_MODE} />;
}
