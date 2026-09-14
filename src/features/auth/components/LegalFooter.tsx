import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { auth, typeScale } from '@/theme/tokens';
import { openAuthBrowser, PRIVACY_URL, TERMS_URL } from '../legal';

/** Terms and Privacy policy, pinned to the bottom of every auth screen. */
export function LegalFooter() {
  const ds = useScaledStyles();
  const linkStyle = {
    fontSize: ds.fontSize(typeScale.meta),
    lineHeight: ds.fontSize(typeScale.meta) * 1.5,
    color: auth.faint,
    textDecorationLine: 'underline' as const,
  };

  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: ds.spacing(14),
        paddingHorizontal: ds.spacing(4),
        paddingBottom: ds.spacing(30),
      }}
    >
      <TouchableOpacity
        accessibilityRole="link"
        accessibilityLabel="Terms of service"
        onPress={() => void openAuthBrowser(TERMS_URL)}
        hitSlop={{ top: 13, right: 3, bottom: 13, left: 6 }}
      >
        <Text style={linkStyle}>Terms</Text>
      </TouchableOpacity>
      <Text
        style={{
          fontSize: ds.fontSize(typeScale.meta),
          lineHeight: ds.fontSize(typeScale.meta) * 1.5,
          color: auth.faint,
        }}
      >
        {' · '}
      </Text>
      <TouchableOpacity
        accessibilityRole="link"
        accessibilityLabel="Privacy policy"
        onPress={() => void openAuthBrowser(PRIVACY_URL)}
        hitSlop={{ top: 13, right: 6, bottom: 13, left: 3 }}
      >
        <Text style={linkStyle}>Privacy</Text>
      </TouchableOpacity>
    </View>
  );
}
