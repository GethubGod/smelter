// Link ready: single-use personalized link, copy or send by text
// (recipient-less sms: body prefill, the manager picks the thread).

import React, { useState } from 'react';
import { Linking, Platform, Share, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { ManagerScaleContainer } from '@/components/ManagerScaleContainer';
// Deep imports: the `@/components/ui` barrel still re-exports the legacy
// GlassView, which reads the old design module at import time.
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { triggerNotificationHaptic, NotificationFeedbackType } from '@/lib/haptics';
import { color, radius, size, space, tracking, typeScale, weight } from '@/theme/tokens';
import { parseInviteReadyMetadata, validateCreatedInviteUrl } from './inviteReadyParams';
import { LOCATION_GROUP_LABELS } from './invitePreview';
import { buildInviteMessageBody, buildInviteSmsUrl } from './teamService';

function param(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? '';
}

const TEAM_ROUTE = '/(manager)/manager-settings/team' as Parameters<typeof router.replace>[0];

export default function InviteLinkReadyScreen() {
  const ds = useScaledStyles();
  const params = useLocalSearchParams<{
    name?: string | string[];
    joinUrl?: string | string[];
    expiryLabel?: string | string[];
    group?: string | string[];
  }>();

  const name = param(params.name);
  const joinUrl = validateCreatedInviteUrl(param(params.joinUrl));
  const { expiryLabel, locationGroup } = parseInviteReadyMetadata(param(params.expiryLabel), param(params.group));
  const details = [
    'One use',
    expiryLabel ? `expires in ${expiryLabel}` : null,
    locationGroup ? LOCATION_GROUP_LABELS[locationGroup] : null,
  ].filter((detail) => detail !== null).join(' · ');

  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!joinUrl) return;
    await Clipboard.setStringAsync(joinUrl);
    triggerNotificationHaptic(NotificationFeedbackType.Success);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  const handleSend = async () => {
    if (!joinUrl) return;
    const body = buildInviteMessageBody(name, joinUrl);
    const url = buildInviteSmsUrl(body, Platform.OS === 'android' ? 'android' : 'ios');
    try {
      await Linking.openURL(url);
    } catch {
      // Messages unavailable (simulator, iPad without SMS): share sheet fallback.
      await Share.share({ message: body });
    }
  };

  if (!joinUrl) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: color.page }} edges={['left', 'right']}>
        <ManagerScaleContainer>
          <ScreenHeader
            mode="pushed"
            title="Invitation unavailable"
            onBack={() => router.replace(TEAM_ROUTE)}
          />
          <View style={{ padding: ds.spacing(space[4]) }}>
            <EmptyState
              icon="link-outline"
              title="No invitation link to share"
              body="The invitation link is missing or invalid. Return to Team to create an invitation."
              action={{ label: 'Back to Team', onPress: () => router.replace(TEAM_ROUTE) }}
            />
          </View>
        </ManagerScaleContainer>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.page }} edges={['left', 'right']}>
      <ManagerScaleContainer>
        <ScreenHeader mode="pushed" title="Link ready" onBack={() => router.replace(TEAM_ROUTE)} />

        <View style={{ flex: 1, paddingHorizontal: ds.spacing(space[4]), justifyContent: 'center' }}>
          <View style={{ alignItems: 'center', marginBottom: ds.spacing(space[4]) }}>
            <View
              style={{
                width: ds.icon(size.emptyStateIcon),
                height: ds.icon(size.emptyStateIcon),
                borderRadius: radius.pill,
                backgroundColor: color.tint,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: ds.spacing(space[3]),
              }}
            >
              <Ionicons name="link-outline" size={ds.icon(24)} color={color.accent} />
            </View>
            <Text
              accessibilityRole="header"
              style={{
                fontSize: ds.fontSize(typeScale.title),
                fontWeight: weight.bold,
                letterSpacing: tracking.title,
                color: color.ink,
              }}
            >
              {name ? `${name}'s link is ready` : 'The link is ready'}
            </Text>
            <Text
              style={{
                fontSize: ds.fontSize(typeScale.secondary),
                color: color.ink2,
                marginTop: ds.spacing(space[1] + 1),
              }}
            >
              {details}
            </Text>
          </View>

          <Card style={{ marginBottom: ds.spacing(space[3]) }}>
            <Text style={{ fontSize: ds.fontSize(typeScale.secondary), color: color.ink2 }}>
              {joinUrl}
            </Text>
          </Card>

          <View style={{ flexDirection: 'row', gap: ds.spacing(space[2]) }}>
            <Button
              variant="secondary"
              label={copied ? 'Copied' : 'Copy'}
              accessibilityHint="Copies the invitation link"
              onPress={() => void handleCopy()}
              style={{ flex: 1 }}
            />
            <Button
              label="Send via Messages"
              onPress={() => void handleSend()}
              style={{ flex: 2 }}
            />
          </View>

          <Button
            variant="secondary"
            size="small"
            label="Done"
            onPress={() => router.replace(TEAM_ROUTE)}
            style={{ alignSelf: 'center', marginTop: ds.spacing(space[5]) }}
          />
        </View>
      </ManagerScaleContainer>
    </SafeAreaView>
  );
}
