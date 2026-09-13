import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { color, radius, typeScale, weight } from '@/theme/tokens';
import { Sheet } from './Sheet';

interface LocationOption { id: string; name: string }
export interface LocationPillProps<T extends LocationOption> {
  location: T | null;
  locations: T[];
  onSelect: (location: T) => void;
}

/** Location picker shared by the daily-work headers. */
export function LocationPill<T extends LocationOption>({ location, locations, onSelect }: LocationPillProps<T>) {
  const [visible, setVisible] = useState(false);
  const label = location?.name.replace(/^Babytuna\s+/i, '') ?? 'Location';
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={`Location, ${label}`} onPress={() => setVisible(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: color.card, borderRadius: radius.pill, paddingVertical: 8, paddingHorizontal: 12 }}>
      <View style={{ width: 8, height: 8, borderRadius: radius.pill, backgroundColor: color.accent }} />
      <Text style={{ color: color.ink, fontSize: typeScale.secondary, fontWeight: weight.semibold }}>{label}</Text>
      <Ionicons name="chevron-down" size={15} color={color.ink3} />
    </Pressable>
    <Sheet visible={visible} title="Location" subtitle="Which restaurant is this for?" onClose={() => setVisible(false)}>
      <View style={{ gap: 10 }}>{locations.map((option) => <Pressable key={option.id} accessibilityRole="radio" accessibilityState={{ selected: option.id === location?.id }} onPress={() => { onSelect(option); setVisible(false); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.card, borderWidth: 1.5, borderColor: option.id === location?.id ? color.accent : 'transparent', backgroundColor: option.id === location?.id ? color.tint : color.card }}>
        <View style={{ width: 22, height: 22, borderRadius: radius.pill, backgroundColor: option.id === location?.id ? color.accent : color.card, borderWidth: option.id === location?.id ? 0 : 2, borderColor: color.hairlineStrong, alignItems: 'center', justifyContent: 'center' }}>{option.id === location?.id ? <Ionicons name="checkmark" color={color.onAccent} size={13} /> : null}</View>
        <View><Text style={{ fontSize: typeScale.body, fontWeight: weight.semibold, color: color.ink }}>{option.name.replace(/^Babytuna\s+/i, '')}</Text><Text style={{ fontSize: typeScale.secondary, color: color.ink2 }}>{option.name}</Text></View>
      </Pressable>)}</View>
    </Sheet>
  </>;
}
