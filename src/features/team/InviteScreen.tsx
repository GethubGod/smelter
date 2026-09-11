// Invite someone: name + works-at + feature toggles with the live preview
// card directly underneath (a pure function of the form state), then Create
// link. Employee invites only — manager invites stay on the web dashboard.

import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ManagerScaleContainer } from '@/components/ManagerScaleContainer';
import { Button, Chip, Input, ScreenHeader } from '@/components/ui';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { useSettingsNavigationContext } from '@/hooks/useSettingsBackRoute';
import { color, space, typeScale } from '@/theme/tokens';
import { createInvite, type InviteLocationGroup } from '@/services/invites';
import {
  getBuiltInEmployeeDefaults,
  getEmployeeInviteDefaults,
  type EmployeeInviteDefaults,
} from '@/services/employeeDefaults';
import { deriveInvitePreview } from './invitePreview';
import { InvitePreviewCard } from './components/InvitePreviewCard';
import { ModuleToggleRow, TeamCard, TeamSectionLabel, WorksAtSegmented } from './components/TeamUI';

/** Screen-local labels per the flow spec (MODULE_LABELS stays app-wide). */
const TOGGLE_ROWS: { key: keyof EmployeeInviteDefaults & string; label: string; tag?: string }[] = [
  { key: 'ordering_simple', label: 'Ordering checklist', tag: 'DEFAULT' },
  { key: 'ordering_advanced', label: 'Advanced ordering' },
  { key: 'stock_check', label: 'Stock check' },
  { key: 'tips', label: 'Tips' },
];

const EXPIRY_OPTIONS: { hours: number; label: string }[] = [
  { hours: 24, label: '1 day' },
  { hours: 72, label: '3 days' },
  { hours: 168, label: '7 days' },
  { hours: 720, label: '30 days' },
];

export default function InviteScreen() {
  const ds = useScaledStyles();
  const { backTo } = useSettingsNavigationContext();
  const [name, setName] = useState('');
  const [group, setGroup] = useState<InviteLocationGroup>('sushi');
  const [defaultToggles, setDefaultToggles] = useState<EmployeeInviteDefaults>(
    getBuiltInEmployeeDefaults(),
  );
  const [toggles, setToggles] = useState<EmployeeInviteDefaults>(getBuiltInEmployeeDefaults());
  const [expiresInHours, setExpiresInHours] = useState(168);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Seed the toggles from the org-wide defaults (same seed create-invite
    // applies server-side when no preset is sent).
    let cancelled = false;
    getEmployeeInviteDefaults()
      .then((defaults) => {
        if (!cancelled) {
          setDefaultToggles(defaults);
          setToggles(defaults);
        }
      })
      .catch(() => {
        // Built-ins already in place.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const preview = useMemo(
    () => deriveInvitePreview(name, group, toggles),
    [name, group, toggles],
  );

  const canSubmit = name.trim().length > 0 && !busy;

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace(backTo);
  };

  const handleCreate = async () => {
    if (!canSubmit) return;
    const invitedName = name.trim();
    const selectedGroup = group;
    const selectedExpiresInHours = expiresInHours;
    setBusy(true);
    setError(null);
    try {
      const invite = await createInvite({
        invitedName,
        role: 'employee',
        expiresInHours: selectedExpiresInHours,
        modulePreset: { ...toggles },
        locationGroup: selectedGroup,
      });
      setName('');
      setGroup('sushi');
      setToggles({ ...defaultToggles });
      setExpiresInHours(168);
      const expiryLabel =
        EXPIRY_OPTIONS.find((option) => option.hours === selectedExpiresInHours)?.label ?? '7 days';
      router.replace({
        pathname: '/(manager)/manager-settings/team-invite-link',
        params: {
          name: invitedName,
          joinUrl: invite.joinUrl,
          expiryLabel,
          group: selectedGroup,
        },
      } as Parameters<typeof router.replace>[0]);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Unable to create the invite.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.page }} edges={['left', 'right']}>
      <ManagerScaleContainer>
        <ScreenHeader
          mode="pushed"
          title="Invite someone"
          subtitle="They set up their own app from the link"
          onBack={handleBack}
        />

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: ds.spacing(space[4]),
            paddingBottom: ds.spacing(space[8]),
          }}
          keyboardShouldPersistTaps="handled"
        >
          <TeamSectionLabel label="Name" />
          <Input
            value={name}
            onChangeText={(value) => {
              setName(value);
              if (error) setError(null);
            }}
            placeholder="First name, like on the schedule"
            accessibilityLabel="Name"
            autoCapitalize="words"
            autoCorrect={false}
            editable={!busy}
          />

          <TeamSectionLabel label="Works at" />
          <WorksAtSegmented value={group} onChange={setGroup} disabled={busy} />

          <TeamSectionLabel label={`What ${name.trim() || 'they'} can use`} />
          <TeamCard style={{ paddingHorizontal: ds.spacing(space[3] + 2) }}>
            {TOGGLE_ROWS.map((row, index) => (
              <ModuleToggleRow
                key={row.key}
                label={row.label}
                tag={row.tag}
                value={toggles[row.key] === true}
                disabled={busy}
                showBorder={index < TOGGLE_ROWS.length - 1}
                onChange={(value) => setToggles((current) => ({ ...current, [row.key]: value }))}
              />
            ))}
          </TeamCard>

          <View style={{ height: ds.spacing(space[2]) }} />
          <InvitePreviewCard model={preview} />

          <TeamSectionLabel label="Link expires in" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: ds.spacing(space[2]) }}>
            {EXPIRY_OPTIONS.map((option) => (
              <Chip
                key={option.hours}
                label={option.label}
                selected={option.hours === expiresInHours}
                onPress={() => {
                  if (busy) return;
                  setExpiresInHours(option.hours);
                }}
              />
            ))}
          </View>

          {error ? (
            <Text
              accessibilityRole="alert"
              style={{
                marginTop: ds.spacing(space[3]),
                fontSize: ds.fontSize(typeScale.secondary),
                color: color.alert,
              }}
            >
              {error}
            </Text>
          ) : null}

          <Button
            label="Create link"
            onPress={() => void handleCreate()}
            loading={busy}
            disabled={!canSubmit}
            style={{ marginTop: ds.spacing(space[4]) }}
          />
        </ScrollView>
      </ManagerScaleContainer>
    </SafeAreaView>
  );
}
