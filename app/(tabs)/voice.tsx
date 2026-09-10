import React from 'react';
import {
  EMPLOYEE_SMART_ORDER_ROUTE_MODE,
  SmartOrderRouteScreen,
} from '@/features/smart/SmartOrderRouteScreen';

export default function VoiceScreen() {
  return <SmartOrderRouteScreen {...EMPLOYEE_SMART_ORDER_ROUTE_MODE} />;
}
