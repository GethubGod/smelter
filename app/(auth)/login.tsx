// The legacy email and password sign-in. Under the UI contract it wears the
// same black fields as name/PIN sign-in instead of a white floating card.

import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Link, Redirect, useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '@/store';
import { AuthLoadingScreen, AuthLogoHeader } from '@/components';
import { Button, Input, SectionLabel } from '@/components/ui';
import { useAuthScreenGuard } from '@/hooks';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { supabase } from '@/lib';
import { auth, radius, space, tracking, typeScale, weight } from '@/theme/tokens';
import { AuthScreenShell } from '@/features/auth/components/AuthScreenShell';

const SIGN_IN_PASSWORD_HELPER =
  'If you recently created your password, it should be at least 8 characters and include letters and numbers.';

function getParamValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default function LoginScreen() {
  const ds = useScaledStyles();
  const params = useLocalSearchParams<{
    email?: string | string[];
    notice?: string | string[];
  }>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [signInHelper, setSignInHelper] = useState<string | null>(null);
  const { signIn, isLoading } = useAuthStore();
  const guard = useAuthScreenGuard();

  const initialEmail = getParamValue(params.email);
  const noticeMessage = useMemo(() => {
    const notice = getParamValue(params.notice);
    if (notice === 'confirm-email') {
      return 'Check your email and confirm your account before signing in.';
    }

    return null;
  }, [params.notice]);

  useEffect(() => {
    if (initialEmail) {
      setEmail(initialEmail);
    }
  }, [initialEmail]);

  if (guard.isChecking) {
    return <AuthLoadingScreen />;
  }

  if (guard.authenticatedRedirectTo) {
    return <Redirect href={guard.authenticatedRedirectTo} />;
  }

  const handleLogin = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email');
      return;
    }
    if (!password) {
      Alert.alert('Error', 'Please enter your password');
      return;
    }

    try {
      setSignInHelper(null);
      await signIn(email.trim(), password);
    } catch (error: any) {
      const message = error?.message || 'Invalid email or password';
      if (
        message.toLowerCase().includes('invalid login credentials') ||
        message.toLowerCase().includes('invalid email or password')
      ) {
        setSignInHelper(SIGN_IN_PASSWORD_HELPER);
      }
      Alert.alert('Sign In Failed', message);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      Alert.alert('Email Required', 'Enter your email first, then tap Forgot password.');
      return;
    }

    try {
      setIsResettingPassword(true);
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
      if (error) throw error;

      Alert.alert('Password Reset Email Sent', 'Check your inbox for reset instructions.');
    } catch (error: any) {
      Alert.alert('Reset Failed', error?.message || 'Unable to send reset email right now.');
    } finally {
      setIsResettingPassword(false);
    }
  };

  const noteStyle = {
    backgroundColor: auth.well,
    borderWidth: 1,
    borderColor: auth.wellBorder,
    borderRadius: radius.control,
    paddingHorizontal: ds.spacing(space[3]),
    paddingVertical: ds.spacing(space[2]),
    marginTop: ds.spacing(space[3]),
  };
  const noteTextStyle = {
    fontSize: ds.fontSize(typeScale.secondary),
    color: auth.dim,
  };
  const linkTextStyle = {
    fontSize: ds.fontSize(typeScale.secondary),
    fontWeight: weight.semibold,
    color: auth.text,
  };

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
          Welcome Back
        </Text>

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

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <SectionLabel onDark>Password</SectionLabel>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
            onPress={() => setShowPassword(!showPassword)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={linkTextStyle}>{showPassword ? 'Hide' : 'Show'}</Text>
          </TouchableOpacity>
        </View>
        <Input
          onDark
          accessibilityLabel="Password"
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            if (signInHelper) setSignInHelper(null);
          }}
          placeholder="Enter your password"
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="password"
          autoComplete="password"
          returnKeyType="go"
          onSubmitEditing={handleLogin}
        />

        <View style={{ alignItems: 'flex-end', marginTop: ds.spacing(space[3]) }}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{ disabled: isResettingPassword, busy: isResettingPassword }}
            onPress={handleForgotPassword}
            disabled={isResettingPassword}
            hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
          >
            <Text style={linkTextStyle}>
              {isResettingPassword ? 'Sending reset link...' : 'Forgot password?'}
            </Text>
          </TouchableOpacity>
        </View>

        {signInHelper ? (
          <View style={noteStyle}>
            <Text style={noteTextStyle}>{signInHelper}</Text>
          </View>
        ) : null}

        {noticeMessage ? (
          <View style={noteStyle}>
            <Text style={noteTextStyle}>{noticeMessage}</Text>
          </View>
        ) : null}

        <Button
          label="Sign In"
          onPress={handleLogin}
          loading={isLoading}
          disabled={isLoading}
          style={{ marginTop: ds.spacing(space[5]) }}
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
            Don{"'"}t have an account?
          </Text>
          <Link href="/(auth)/signup" asChild>
            <TouchableOpacity
              accessibilityRole="link"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={linkTextStyle}>Sign Up</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </AuthScreenShell>
  );
}
