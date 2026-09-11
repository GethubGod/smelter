// The live preview card under the invite toggles: a pure function of the
// current form state (deriveInvitePreview), re-rendered on every flip.

import { Text, View } from 'react-native';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { color, radius, space, typeScale, weight } from '@/theme/tokens';
import type { InvitePreviewModel } from '../invitePreview';

function MiniPhoneFrame({ tabCount, warning }: { tabCount: number; warning: boolean }) {
  const ds = useScaledStyles();

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: ds.icon(46),
        height: ds.icon(82),
        backgroundColor: color.card,
        borderRadius: radius.control,
        borderWidth: 1,
        borderColor: color.hairline,
        padding: ds.spacing(space[1]),
      }}
    >
      <View
        style={{
          height: 3,
          borderRadius: radius.pill,
          backgroundColor: color.well,
          marginBottom: 3,
        }}
      />
      <View style={{ flex: 1, borderRadius: radius.control, backgroundColor: color.page }} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingTop: 3 }}>
        {Array.from({ length: Math.max(tabCount, 1) }, (_, index) => (
          <View
            key={index}
            style={{
              width: 6,
              height: 6,
              borderRadius: radius.pill,
              backgroundColor: !warning && index === 0 ? color.accent : color.disabled,
            }}
          />
        ))}
      </View>
    </View>
  );
}

export function InvitePreviewCard({ model }: { model: InvitePreviewModel }) {
  const ds = useScaledStyles();

  return (
    <View
      style={{
        backgroundColor: color.well,
        borderRadius: radius.card,
        padding: ds.spacing(space[3]),
        flexDirection: 'row',
        gap: ds.spacing(space[3]),
        alignItems: 'center',
      }}
    >
      <MiniPhoneFrame tabCount={model.tabLabels.length} warning={model.warning !== null} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: ds.fontSize(typeScale.secondary), color: color.ink2 }}>
          <Text style={{ fontWeight: weight.semibold, color: color.ink }}>{model.heading}: </Text>
          {model.opensOn} Tabs: {model.tabLabels.join(' · ')}.
          {model.extras.length > 0 ? ` ${model.extras.join(' ')}` : ''}
        </Text>
        {model.warning ? (
          <Text
            style={{
              fontSize: ds.fontSize(typeScale.secondary),
              fontWeight: weight.semibold,
              color: color.alert,
              marginTop: ds.spacing(space[1]),
            }}
          >
            {model.warning}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
