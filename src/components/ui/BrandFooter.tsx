import React from 'react';
import { Image, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { color, typeScale } from '@/theme/tokens';

const lockup = require('../../../assets/images/smelter-lockup.png');

/** Uses the delivered image without tint, cropping, or a backing container. */
export function BrandLockup({ height = 22 }: { height?: number }) {
  const { width: imageWidth, height: imageHeight } = Image.resolveAssetSource(lockup);
  return <Image source={lockup} accessibilityLabel="Smelter" resizeMode="contain" style={{ height, width: height * imageWidth / imageHeight }} />;
}

export function BrandFooter({ name }: { name: string }) {
  const version = Constants.expoConfig?.version ?? '';
  const build = Constants.expoConfig?.ios?.buildNumber ?? '';
  return <View style={{ alignItems: 'center', gap: 6, paddingTop: 26, paddingBottom: 6 }}>
    <BrandLockup />
    <Text style={{ color: color.ink3, fontSize: typeScale.meta, textAlign: 'center' }}>Smelter {version} ({build}) · Signed in as {name}</Text>
  </View>;
}
