// The legacy access-code sign-up, plus the invite-link variant. Under the UI
// contract it drops the white floating card and wears the same black fields as
// the rest of auth.

import { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { Link, Redirect, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store';
import { AuthLoadingScreen, AuthLogoHeader } from '@/components';
import { Button, Input, Loading, SectionLabel } from '@/components/ui';
import { useAuthScreenGuard } from '@/hooks';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { validatePassword } from '@/lib';
import { fetchInvitePreview, type InvitePreview } from '@/services/invites';
import { auth, color, radius, size, space, tracking, typeScale, weight } from '@/theme/tokens';
import { AuthScreenShell } from '@/features/auth/components/AuthScreenShell';

const ACCESS_CODE_REGEX = /^\d{4}$/;

export default function SignUpScreen() {
  const ds = useScaledStyles();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [accessCode, setAccessCode] = useState('');
  const [showAccessCode, setShowAccessCode] = useState(false);
  const [accessCodeError, setAccessCodeError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null);

  // Invite-link mode (babytunasystems://join?token=… → /join → here). The
  // access-code path below stays fully intact and remains the default.
  const params = useLocalSearchParams<{ inviteToken?: string | string[] }>();
  const rawInviteToken = Array.isArray(params.inviteToken)
    ? params.inviteToken[0]
    : params.inviteToken;
  const inviteToken = typeof rawInviteToken === 'string' ? rawInviteToken.trim() : '';
  const [inviteDismissed, setInviteDismissed] = useState(false);
  const [invitePreview, setInvitePreview] = useState<InvitePreview | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const inviteMode = inviteToken.length > 0 && !inviteDismissed;
  const inviteChecking = inviteMode && invitePreview === null && inviteError === null;

  const { signUp, signUpWithInvite, isLoading } = useAuthStore();
  const guard = useAuthScreenGuard();

  useEffect(() => {
    if (!inviteToken) return;
    let cancelled = false;
    setInvitePreview(null);
    setInviteError(null);
    fetchInvitePreview(inviteToken)
      .then((preview) => {
        if (cancelled) return;
        setInvitePreview(preview);
        if (preview.invitedName) {
          const invitedName = preview.invitedName;
          setName((prev) => (prev.trim() ? prev : invitedName));
        }
      })
      .catch((error: any) => {
        if (!cancelled) {
          setInviteError(error?.message || 'This invite link is not valid.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [inviteToken]);

  const passwordValidation = useMemo(() => validatePassword(password), [password]);
  const isPasswordEmpty = password.length === 0;
  const hasConfirmPassword = confirmPassword.length > 0;
  const passwordsMatch = hasConfirmPassword && password === confirmPassword;

  const canCreateAccount =
    !isLoading &&
    passwordValidation.isValid &&
    passwordsMatch &&
    (!inviteMode || invitePreview !== null);

  const sanitizeAccessCode = (value: string) => value.replace(/\D/g, '').slice(0, 4);

  if (guard.isChecking) {
    return <AuthLoadingScreen onDark />;
  }

  if (guard.authenticatedRedirectTo) {
    return <Redirect href={guard.authenticatedRedirectTo} />;
  }

  const handleSignUp = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter your name');
      return;
    }
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email');
      return;
    }
    if (!passwordValidation.isValid) {
      setPasswordError('Please meet all password requirements before creating your account.');
      return;
    }
    if (!passwordsMatch) {
      setConfirmPasswordError('Passwords do not match.');
      return;
    }
    if (!inviteMode && !ACCESS_CODE_REGEX.test(accessCode)) {
      setAccessCodeError('Access code must be exactly 4 digits.');
      return;
    }

    try {
      const result = inviteMode
        ? await signUpWithInvite(inviteToken, email.trim(), password, name.trim())
        : await signUp(email.trim(), password, name.trim(), accessCode);

      if (result.status === 'confirmation_required') {
        Alert.alert(
          'Confirm Your Email',
          'Your account was created. Confirm your email before signing in.',
          [
            {
              text: 'OK',
              onPress: () => {
                router.replace({
                  pathname: '/(auth)/sign-in',
                  params: {
                    method: 'email',
                    email: result.email,
                    notice: 'confirm-email',
                  },
                });
              },
            },
          ]
        );
        return;
      }
    } catch (error: any) {
      Alert.alert('Sign Up Failed', error.message || 'Failed to create account');
    }
  };

  const noteStyle = {
    backgroundColor: auth.well,
    borderWidth: 1,
    borderColor: auth.wellBorder,
    borderRadius: radius.control,
    paddingHorizontal: ds.spacing(space[3]),
    paddingVertical: ds.spacing(space[3]),
    marginBottom: ds.spacing(space[4]),
  };
  const noteTitleStyle = {
    fontSize: ds.fontSize(typeScale.secondary),
    fontWeight: weight.semibold,
    color: auth.text,
  };
  const noteTextStyle = {
    fontSize: ds.fontSize(typeScale.secondary),
    color: auth.dim,
  };
  const helperTextStyle = {
    fontSize: ds.fontSize(typeScale.secondary),
    color: auth.dim,
    marginTop: ds.spacing(space[2] - 2),
  };
  const errorTextStyle = {
    fontSize: ds.fontSize(typeScale.secondary),
    color: color.alert,
    marginTop: ds.spacing(space[2] - 2),
  };
  const linkTextStyle = {
    fontSize: ds.fontSize(typeScale.secondary),
    fontWeight: weight.semibold,
    color: auth.text,
  };
  /** Inline text actions still have to clear the 44pt target. */
  const inlineActionStyle = {
    minHeight: ds.spacing(size.touchMin),
    justifyContent: 'center' as const,
  };

  const renderRevealLabel = (
    label: string,
    revealed: boolean,
    onToggle: () => void,
  ) => (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <SectionLabel onDark>{label}</SectionLabel>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={revealed ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
        onPress={onToggle}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        style={inlineActionStyle}
      >
        <Text style={linkTextStyle}>{revealed ? 'Hide' : 'Show'}</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <AuthScreenShell dismissKeyboardOnPress={false}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: ds.spacing(space[6]) }}
      >
        <View style={{ alignItems: 'center', marginBottom: ds.spacing(space[6]) }}>
          <AuthLogoHeader size={64} />
        </View>

        <Text
          accessibilityRole="header"
          style={{
            fontSize: ds.fontSize(typeScale.display),
            fontWeight: weight.bold,
            letterSpacing: tracking.display,
            color: auth.text,
            marginBottom: ds.spacing(space[5]),
          }}
        >
          Create Account
        </Text>

        {inviteMode ? (
          inviteChecking ? (
            <View style={[noteStyle, { flexDirection: 'row', alignItems: 'center' }]}>
              <Loading size="inline" color={auth.text} label="Checking your invite" />
              <Text style={[noteTextStyle, { marginLeft: ds.spacing(space[3]) }]}>
                Checking your invite
              </Text>
            </View>
          ) : invitePreview ? (
            <View style={noteStyle}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: ds.spacing(space[2]),
                  marginBottom: ds.spacing(space[1]),
                }}
              >
                <Ionicons
                  name="mail-open-outline"
                  size={ds.icon(size.icon)}
                  color={color.accent}
                />
                <Text style={noteTitleStyle}>
                  {invitePreview.invitedName
                    ? `You're invited, ${invitePreview.invitedName}`
                    : "You're invited"}
                </Text>
              </View>
              <Text style={noteTextStyle}>
                {invitePreview.role
                  ? `This link signs you up as ${invitePreview.role}. No access code needed.`
                  : 'No access code needed. This link is yours.'}
              </Text>
            </View>
          ) : (
            <View style={noteStyle}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: ds.spacing(space[2]),
                  marginBottom: ds.spacing(space[1]),
                }}
              >
                <Ionicons
                  name="alert-circle-outline"
                  size={ds.icon(size.icon)}
                  color={color.alert}
                />
                <Text style={noteTitleStyle}>Invite link problem</Text>
              </View>
              <Text style={noteTextStyle}>
                {inviteError ?? 'This invite link is not valid. Ask your manager for a new one.'}
              </Text>
              <TouchableOpacity
                accessibilityRole="button"
                onPress={() => setInviteDismissed(true)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={[inlineActionStyle, { marginTop: ds.spacing(space[2]) }]}
              >
                <Text style={linkTextStyle}>Use an access code instead</Text>
              </TouchableOpacity>
            </View>
          )
        ) : null}

        <Input
          label="Full name"
          onDark
          value={name}
          onChangeText={setName}
          placeholder="Enter your name"
          autoComplete="name"
        />

        <Input
          label="Email"
          onDark
          value={email}
          onChangeText={setEmail}
          placeholder="Enter your email"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          autoComplete="email"
        />

        {renderRevealLabel('Password', showPassword, () => setShowPassword(!showPassword))}
        <Input
          onDark
          accessibilityLabel="Password"
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            if (passwordError) setPasswordError(null);
            if (confirmPasswordError && value === confirmPassword) {
              setConfirmPasswordError(null);
            }
          }}
          placeholder="Create a password"
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="password-new"
        />

        <View style={[noteStyle, { marginTop: ds.spacing(space[3]) }]}>
          <Text style={[noteTitleStyle, { marginBottom: ds.spacing(space[2]) }]}>
            Password requirements
          </Text>
          {passwordValidation.checks.map((check) => {
            const isNeutral = isPasswordEmpty;
            const isMet = !isNeutral && check.ok;
            const iconName = isNeutral
              ? 'ellipse-outline'
              : isMet
                ? 'checkmark-circle'
                : 'close-circle';
            const iconColor = isNeutral ? auth.dim : isMet ? color.good : color.alert;
            const textColor = isNeutral ? auth.dim : isMet ? color.good : color.alert;

            return (
              <View
                key={check.key}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: ds.spacing(space[2]),
                  paddingVertical: ds.spacing(space[1] / 2),
                }}
              >
                <Ionicons name={iconName} size={ds.icon(size.icon)} color={iconColor} />
                <Text style={{ fontSize: ds.fontSize(typeScale.secondary), color: textColor }}>
                  {check.label}
                </Text>
              </View>
            );
          })}
          {passwordError ? <Text style={errorTextStyle}>{passwordError}</Text> : null}
        </View>

        {renderRevealLabel('Confirm password', showConfirmPassword, () =>
          setShowConfirmPassword(!showConfirmPassword),
        )}
        <Input
          onDark
          accessibilityLabel="Confirm password"
          value={confirmPassword}
          onChangeText={(value) => {
            setConfirmPassword(value);
            if (confirmPasswordError) setConfirmPasswordError(null);
          }}
          placeholder="Re-enter your password"
          secureTextEntry={!showConfirmPassword}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="password-new"
        />

        {confirmPassword.length === 0 ? (
          <Text style={helperTextStyle}>Re-enter password to confirm.</Text>
        ) : (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: ds.spacing(space[2]),
              marginTop: ds.spacing(space[2] - 2),
            }}
          >
            <Ionicons
              name={passwordsMatch ? 'checkmark-circle' : 'close-circle'}
              size={ds.icon(size.icon)}
              color={passwordsMatch ? color.good : color.alert}
            />
            <Text
              style={{
                fontSize: ds.fontSize(typeScale.secondary),
                color: passwordsMatch ? color.good : color.alert,
              }}
            >
              {passwordsMatch ? 'Passwords match' : 'Passwords do not match'}
            </Text>
          </View>
        )}

        {confirmPasswordError ? (
          <Text style={errorTextStyle}>{confirmPasswordError}</Text>
        ) : null}

        {inviteMode ? null : (
          <>
            {renderRevealLabel('Access code', showAccessCode, () =>
              setShowAccessCode(!showAccessCode),
            )}
            <Input
              onDark
              accessibilityLabel="Access code"
              value={accessCode}
              onChangeText={(value) => {
                setAccessCode(sanitizeAccessCode(value));
                if (accessCodeError) {
                  setAccessCodeError(null);
                }
              }}
              placeholder="Enter 4-digit code"
              secureTextEntry={!showAccessCode}
              keyboardType="number-pad"
              maxLength={4}
              onBlur={() => {
                if (accessCode.length > 0 && !ACCESS_CODE_REGEX.test(accessCode)) {
                  setAccessCodeError('Access code must be exactly 4 digits.');
                }
              }}
            />
            {accessCodeError ? (
              <Text style={errorTextStyle}>{accessCodeError}</Text>
            ) : (
              <Text style={helperTextStyle}>
                Enter the 4-digit code provided by your manager.
              </Text>
            )}
          </>
        )}

        <Button
          label="Create Account"
          onPress={handleSignUp}
          loading={isLoading}
          disabled={!canCreateAccount}
          style={{ marginTop: ds.spacing(space[6]) }}
        />

        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            gap: ds.spacing(space[1]),
            marginTop: ds.spacing(space[6]),
          }}
        >
          <Text style={{ fontSize: ds.fontSize(typeScale.secondary), color: auth.dim }}>
            Already have an account?
          </Text>
          <Link href="/(auth)/sign-in" replace asChild>
            <TouchableOpacity
              accessibilityRole="link"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={inlineActionStyle}
            >
              <Text style={linkTextStyle}>Sign In</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </AuthScreenShell>
  );
}
