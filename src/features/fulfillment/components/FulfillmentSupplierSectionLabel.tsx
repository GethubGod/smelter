import React from 'react';
import { Text } from 'react-native';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { color, typeScale, weight } from '@/theme/tokens';

interface FulfillmentSupplierSectionLabelProps {
  readyCount: number;
}

export function FulfillmentSupplierSectionLabel({
  readyCount,
}: FulfillmentSupplierSectionLabelProps) {
  const ds = useScaledStyles();

  return (
    <Text
      style={{
        color: color.ink3,
        fontSize: ds.fontSize(typeScale.caption),
        fontWeight: weight.bold,
        letterSpacing: 1.5,
        marginTop: ds.spacing(32),
        marginBottom: ds.spacing(20),
        textTransform: 'uppercase',
      }}
    >
      SUPPLIERS · {readyCount} READY
    </Text>
  );
}
