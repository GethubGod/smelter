import { Alert, Linking, Text, TouchableOpacity, View } from 'react-native';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { auth, space, typeScale } from '@/theme/tokens';
import { PRIVACY_URL, TERMS_URL } from '../legal';

async function openLegalUrl(url: string) {
  try {
    const supported = await Linking.canOpenURL(url);
    if (!supported) throw new Error('unsupported');
    await Linking.openURL(url);
  } catch {
    Alert.alert('Unable to open the link', url);
  }
}

/** Terms and Privacy policy, pinned to the bottom of every auth screen. */
export function LegalFooter() {
  const ds = useScaledStyles();
  const linkStyle = {
    fontSize: ds.fontSize(typeScale.caption),
    color: auth.dim,
    textDecorationLine: 'underline' as const,
  };

  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: ds.spacing(space[4]),
        gap: ds.spacing(space[2] - 2),
      }}
    >
      <TouchableOpacity
        accessibilityRole="link"
        accessibilityLabel="Terms of service"
        onPress={() => openLegalUrl(TERMS_URL)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 6 }}
      >
        <Text style={linkStyle}>Terms</Text>
      </TouchableOpacity>
      <Text style={{ fontSize: ds.fontSize(typeScale.caption), color: auth.dim }}>·</Text>
      <TouchableOpacity
        accessibilityRole="link"
        accessibilityLabel="Privacy policy"
        onPress={() => openLegalUrl(PRIVACY_URL)}
        hitSlop={{ top: 10, bottom: 10, left: 6, right: 10 }}
      >
        <Text style={linkStyle}>Privacy policy</Text>
      </TouchableOpacity>
    </View>
  );
}
