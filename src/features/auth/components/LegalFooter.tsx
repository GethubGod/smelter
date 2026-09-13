import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { auth, size, space, typeScale } from '@/theme/tokens';
import { openAuthBrowser, PRIVACY_URL, TERMS_URL } from '../legal';

/** Terms and Privacy policy, pinned to the bottom of every auth screen. */
export function LegalFooter() {
  const ds = useScaledStyles();
  const linkStyle = {
    fontSize: ds.fontSize(typeScale.meta),
    color: auth.faint,
    textDecorationLine: 'underline' as const,
  };
  // Caption type on its own is a 14pt target. The links carry the full 44pt
  // height and enough padding either side that the two never share a target.
  const targetStyle = {
    minHeight: ds.spacing(size.touchMin),
    justifyContent: 'center' as const,
    paddingHorizontal: ds.spacing(space[2]),
  };

  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingBottom: ds.spacing(size.authClose),
        gap: ds.spacing(space[2]),
      }}
    >
      <TouchableOpacity
        accessibilityRole="link"
        accessibilityLabel="Terms of service"
        onPress={() => void openAuthBrowser(TERMS_URL)}
        hitSlop={{ top: 6, bottom: 6 }}
        style={targetStyle}
      >
        <Text style={linkStyle}>Terms</Text>
      </TouchableOpacity>
      <Text style={{ fontSize: ds.fontSize(typeScale.meta), color: auth.faint }}>·</Text>
      <TouchableOpacity
        accessibilityRole="link"
        accessibilityLabel="Privacy policy"
        onPress={() => void openAuthBrowser(PRIVACY_URL)}
        hitSlop={{ top: 6, bottom: 6 }}
        style={targetStyle}
      >
        <Text style={linkStyle}>Privacy</Text>
      </TouchableOpacity>
    </View>
  );
}
