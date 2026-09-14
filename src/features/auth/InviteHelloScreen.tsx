import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { AuthLoadingScreen } from '@/components';
import { Loading } from '@/components/ui';
import { useAuthScreenGuard } from '@/hooks';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import {
  acceptInviteLink,
  fetchInvitePreview,
  getInviteErrorInvitedBy,
  getInviteFailureReason,
  isInviteAlreadyOnTeam,
  isInviteNetworkError,
  type InviteFailureReason,
  type InviteLocationGroup,
  type InvitePreview,
} from '@/services/invites';
import { useAuthStore } from '@/store/authStore';
import { auth, color, radius, space, tracking, typeScale, weight } from '@/theme/tokens';
import { AuthCloseButton } from './components/AuthCloseButton';
import { AuthScreenShell } from './components/AuthScreenShell';
import { AuthToast } from './components/AuthToast';
import { ProviderButtons } from './components/ProviderButtons';
import { WizardProgress } from './components/WizardProgress';
import { useOnboardingStore } from './onboardingStore';

type Provider = 'google' | 'apple';

function firstName(name: string | null): string {
  return name?.trim().split(/\s+/)[0] || 'there';
}

export function inviteRestaurant(locationGroup: InviteLocationGroup): string {
  switch (locationGroup) {
    case 'sushi':
      return 'Babytuna Sushi';
    case 'poki':
      return 'Babytuna Poki & Pho';
    default:
      return 'Babytuna';
  }
}

function withArticle(role: string): string {
  return `${/^[aeiou]/i.test(role) ? 'an' : 'a'} ${role.toLowerCase()}`;
}

export function inviteRole(role: InvitePreview['role']): string {
  if (role === 'manager') return 'Manager';
  if (role === 'employee') return 'Employee';
  return '';
}

export function abbreviatedName(name: string | null): string {
  if (!name?.trim()) return '';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  const last = parts[parts.length - 1];
  return `${parts[0]} ${last.length === 2 && last.endsWith('.') ? last : `${last[0].toUpperCase()}.`}`;
}

function failureMessage(reason: InviteFailureReason | null, invitedBy: string | null): string {
  const manager = firstName(invitedBy);
  switch (reason) {
    case 'expired':
      return manager === 'there'
        ? 'This invite has expired. Ask your manager to send a new one.'
        : `This invite has expired. Ask ${manager} to send a new one.`;
    case 'used':
      return manager === 'there'
        ? "This invite was already used. Ask your manager for a new one if that wasn't you."
        : `This invite was already used. Ask ${manager} for a new one if that wasn't you.`;
    default:
      return "This invite isn't valid any more. Ask your manager for a new link.";
  }
}

function SummaryRow({ label, value, first }: { label: string; value: string; first: boolean }) {
  const ds = useScaledStyles();
  return (
    <View
      style={{
        minHeight: ds.spacing(42),
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: ds.spacing(space[3]),
        paddingVertical: ds.spacing(space[3]),
        borderTopWidth: first ? 0 : 1,
        borderTopColor: color.hairline,
      }}
    >
      <Text
        style={{
          fontSize: ds.fontSize(typeScale.secondary),
          fontWeight: weight.regular,
          color: auth.dim,
        }}
      >
        {label}
      </Text>
      <Text
        numberOfLines={1}
        style={{
          flexShrink: 1,
          fontSize: ds.fontSize(typeScale.link),
          fontWeight: weight.semibold,
          color: auth.text,
          textAlign: 'right',
        }}
      >
        {value}
      </Text>
    </View>
  );
}

export default function InviteHelloScreen() {
  const router = useRouter();
  const ds = useScaledStyles();
  const guard = useAuthScreenGuard();
  const params = useLocalSearchParams<{
    token?: string | string[];
    fromJoin?: string | string[];
  }>();
  const routeToken = Array.isArray(params.token) ? params.token[0] : params.token;
  const token = routeToken?.trim() ?? '';
  const fromJoin = (Array.isArray(params.fromJoin) ? params.fromJoin[0] : params.fromJoin) === '1';
  const storedToken = useOnboardingStore((state) => state.token);
  const preview = useOnboardingStore((state) => state.preview);
  const setInvite = useOnboardingStore((state) => state.setInvite);
  const reset = useOnboardingStore((state) => state.reset);
  const signInWithOAuth = useAuthStore((state) => state.signInWithOAuth);
  const signInWithApple = useAuthStore((state) => state.signInWithApple);
  const adoptExternalSession = useAuthStore((state) => state.adoptExternalSession);
  const signOut = useAuthStore((state) => state.signOut);
  const setReadyPending = useAuthStore((state) => state.setReadyPending);
  const hasPreview = Boolean(token && storedToken === token && preview);
  const [loadingPreview, setLoadingPreview] = useState(!hasPreview);
  const [busyProvider, setBusyProvider] = useState<Provider | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const providerInFlight = useRef(false);

  useEffect(() => {
    if (!token || hasPreview) {
      setLoadingPreview(false);
      return;
    }

    let cancelled = false;
    setLoadingPreview(true);
    fetchInvitePreview(token)
      .then((nextPreview) => {
        if (cancelled) return;
        setInvite(token, nextPreview);
        setLoadingPreview(false);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const reason = getInviteFailureReason(error);
        const invitedBy = getInviteErrorInvitedBy(error);
        const failure = isInviteNetworkError(error) ? 'network' : (reason ?? 'invalid');
        reset();
        router.replace({
          pathname: '/(auth)/invite-link',
          params: { link: token, failure, invitedBy: invitedBy ?? '' },
        });
      });

    return () => {
      cancelled = true;
    };
  }, [hasPreview, reset, router, setInvite, token]);

  const closeWizard = useCallback(() => {
    if (providerInFlight.current) return;
    reset();
    router.dismissTo('/(auth)/welcome');
  }, [reset, router]);

  const handleWrongLink = useCallback(() => {
    if (fromJoin) {
      reset();
      router.replace('/(auth)/invite-link');
      return;
    }
    router.back();
  }, [fromJoin, reset, router]);

  const handleProvider = useCallback(
    async (provider: Provider) => {
      if (!token || providerInFlight.current) return;
      providerInFlight.current = true;
      setBusyProvider(provider);
      setToast(null);
      setReadyPending(true);
      let hasSession = false;

      try {
        const session =
          provider === 'apple'
            ? await signInWithApple({ deferHydration: true })
            : await signInWithOAuth('google', { deferHydration: true });
        if (!session) {
          setReadyPending(false);
          return;
        }

        hasSession = true;
        await acceptInviteLink(token);
        await adoptExternalSession(session);
        router.replace('/(auth)/ready');
      } catch (error) {
        if (hasSession) {
          try {
            await signOut();
          } catch {
            // signOut clears local auth state before surfacing a remote failure.
          }
        }
        setReadyPending(false);
        if (isInviteAlreadyOnTeam(error)) {
          setToast('That account is already on a team. Sign in instead.');
        } else if (isInviteNetworkError(error)) {
          setToast("Can't reach smelter. Check your connection and try again.");
        } else {
          const reason = getInviteFailureReason(error);
          setToast(
            reason
              ? failureMessage(reason, getInviteErrorInvitedBy(error) ?? preview?.invitedBy ?? null)
              : error instanceof Error
                ? error.message
                : "This invite isn't valid any more. Ask your manager for a new link.",
          );
        }
      } finally {
        providerInFlight.current = false;
        setBusyProvider(null);
      }
    },
    [
      adoptExternalSession,
      preview?.invitedBy,
      router,
      setReadyPending,
      signInWithApple,
      signInWithOAuth,
      signOut,
      token,
    ],
  );

  if (!token) return <Redirect href="/(auth)/invite-link" />;
  if (guard.isChecking) return <AuthLoadingScreen onDark />;
  if (guard.authenticatedRedirectTo) return <Redirect href={guard.authenticatedRedirectTo} />;

  const currentPreview = storedToken === token ? preview : null;
  const invitedName = currentPreview?.invitedName ?? null;
  const managerName = currentPreview?.invitedBy ?? null;
  const restaurant = inviteRestaurant(currentPreview?.locationGroup ?? 'both');
  const role = inviteRole(currentPreview?.role ?? null);

  return (
    <AuthScreenShell showLegalFooter={false}>
      <View
        style={{
          height: ds.spacing(30),
          marginTop: ds.spacing(space[1]),
          marginBottom: ds.spacing(14),
          alignItems: 'flex-end',
        }}
      >
        <AuthCloseButton onPress={closeWizard} label="Close invite setup" />
      </View>
      <WizardProgress step={2} startsAt={fromJoin ? 2 : 1} />

      {loadingPreview || !currentPreview ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Loading label="Checking your invite" />
        </View>
      ) : (
        <>
          <Text
            accessibilityRole="header"
            style={{
              fontSize: ds.fontSize(typeScale.display),
              fontWeight: weight.bold,
              letterSpacing: tracking.display,
              lineHeight: ds.fontSize(typeScale.display) * 1.1,
              color: auth.text,
            }}
          >
            {invitedName ? `Is this you, ${firstName(invitedName)}?` : 'Is this you?'}
          </Text>
          <Text
            style={{
              marginTop: ds.spacing(6),
              fontSize: ds.fontSize(typeScale.secondary),
              fontWeight: weight.regular,
              lineHeight: ds.fontSize(typeScale.secondary) * 1.45,
              color: auth.dim,
            }}
          >
            {managerName
              ? `${firstName(managerName)} invited you to ${restaurant}${role ? ` as ${withArticle(role)}` : ''}.`
              : `Your manager invited you to ${restaurant}${role ? ` as ${withArticle(role)}` : ''}.`}
          </Text>

          <View
            style={{
              marginTop: ds.spacing(space[4]),
              paddingVertical: ds.spacing(space[1]),
              paddingHorizontal: ds.spacing(space[4]),
              borderRadius: radius.card,
              backgroundColor: auth.well,
            }}
          >
            <SummaryRow label="Restaurant" value={restaurant} first />
            <SummaryRow label="Role" value={role} first={false} />
            <SummaryRow label="Invited by" value={abbreviatedName(managerName)} first={false} />
          </View>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: ds.spacing(space[3]),
              marginVertical: ds.spacing(space[3]),
            }}
          >
            <View style={{ flex: 1, height: 1, backgroundColor: auth.hair }} />
            <Text
              style={{
                fontSize: ds.fontSize(typeScale.meta),
                fontWeight: weight.regular,
                color: auth.faint,
              }}
            >
              Yes, sign me in with
            </Text>
            <View style={{ flex: 1, height: 1, backgroundColor: auth.hair }} />
          </View>

          <ProviderButtons
            googleLabel="Google"
            appleLabel="Apple"
            busyProvider={busyProvider}
            onGoogle={() => void handleProvider('google')}
            onApple={() => void handleProvider('apple')}
          />
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() =>
              router.push('/(auth)/invite-login')
            }
            disabled={busyProvider !== null}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ alignSelf: 'center', marginTop: ds.spacing(space[3]) }}
          >
            <Text
              style={{
                fontSize: ds.fontSize(typeScale.link),
                fontWeight: weight.semibold,
                color: auth.text,
              }}
            >
              Email and password
            </Text>
          </TouchableOpacity>

          <View
            style={{
              marginTop: 'auto',
              paddingVertical: ds.spacing(14),
              paddingBottom: ds.spacing(30),
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                fontSize: ds.fontSize(typeScale.meta),
                fontWeight: weight.regular,
                lineHeight: ds.fontSize(typeScale.meta) * 1.5,
                color: auth.faint,
              }}
            >
              {`Not ${firstName(invitedName)}? `}
              <Text
                accessibilityRole="link"
                onPress={handleWrongLink}
                style={{ textDecorationLine: 'underline' }}
              >
                Wrong link
              </Text>
            </Text>
          </View>
        </>
      )}
      <AuthToast message={toast} onHidden={() => setToast(null)} />
    </AuthScreenShell>
  );
}
