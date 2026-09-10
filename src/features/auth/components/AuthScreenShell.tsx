import type { ReactNode } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { auth, space } from '@/theme/tokens';
import { LegalFooter } from './LegalFooter';

interface AuthScreenShellProps {
  children: ReactNode;
  /** The Ready screen omits the footer, matching the flow spec. */
  showLegalFooter?: boolean;
  /** Screens that scroll their own content opt out of the dismiss-on-press wrapper. */
  dismissKeyboardOnPress?: boolean;
}

/** Black full-bleed shell shared by the auth and setup screens. */
export function AuthScreenShell({
  children,
  showLegalFooter = true,
  dismissKeyboardOnPress = true,
}: AuthScreenShellProps) {
  const ds = useScaledStyles();
  const content = {
    flex: 1,
    paddingHorizontal: ds.spacing(space[4]),
    paddingTop: ds.spacing(space[4]),
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: auth.bg }}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, backgroundColor: auth.bg }}
      >
        {dismissKeyboardOnPress ? (
          <Pressable style={content} onPress={Keyboard.dismiss} accessible={false}>
            {children}
          </Pressable>
        ) : (
          <View style={content}>{children}</View>
        )}
        {showLegalFooter ? <LegalFooter /> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
