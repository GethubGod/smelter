import React from 'react';
import {
  MANAGER_SMART_ORDER_ROUTE_MODE,
  SmartOrderRouteScreen,
} from '@/features/smart/SmartOrderRouteScreen';

export default function ManagerVoiceScreen() {
  return <SmartOrderRouteScreen {...MANAGER_SMART_ORDER_ROUTE_MODE} />;
}
