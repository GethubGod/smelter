import React from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheetShell } from '@/components/BottomSheetShell';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { color, space, tracking, typeScale, weight } from '@/theme/tokens';
import { Button, type ButtonProps } from './Button';

export interface SheetProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  children?: React.ReactNode;
  /** The single action at the foot of the sheet. */
  primary?: Pick<ButtonProps, 'label' | 'onPress' | 'loading' | 'disabled' | 'variant'>;
  /** Use `embedded` when the sheet already sits inside a native modal. */
  presentation?: 'modal' | 'embedded';
  /**
   * Scrim tap and drag-to-dismiss, on by default. Pass false while the sheet
   * holds unsaved input: a graze on the backdrop must not discard a draft, so
   * the sheet's own Cancel action becomes the only way out.
   */
  dismissible?: boolean;
  testID?: string;
}

/**
 * Every modal in the app is this: quantity, note, confirm order, station
 * picker, credential editor, reminders.
 *
 * `BottomSheetShell` is the single host of the native `Modal` and owns the
 * handle, the scrim and the drag-to-dismiss gesture. This wrapper adds the
 * title and the one primary action so screens stop rolling their own.
 *
 * The sheet also clears the home indicator: screens that host the shell
 * directly pass their own `bottomPadding`, so this keeps the same floor for
 * every screen that moved onto the primitive.
 */
export function Sheet({
  visible,
  title,
  onClose,
  children,
  primary,
  presentation = 'modal',
  dismissible = true,
  testID,
}: SheetProps) {
  const ds = useScaledStyles();
  const insets = useSafeAreaInsets();

  return (
    <BottomSheetShell
      visible={visible}
      presentation={presentation}
      onClose={onClose}
      dismissible={dismissible}
      bottomPadding={Math.max(insets.bottom, ds.spacing(space[3] + 2))}
    >
      <View testID={testID} style={{ gap: ds.spacing(space[3]) }}>
        <Text
          accessibilityRole="header"
          style={{
            fontSize: ds.fontSize(typeScale.title),
            fontWeight: weight.bold,
            letterSpacing: tracking.title,
            color: color.ink,
          }}
        >
          {title}
        </Text>
        {children}
        {primary ? (
          <Button
            variant={primary.variant ?? 'primary'}
            label={primary.label}
            onPress={primary.onPress}
            loading={primary.loading}
            disabled={primary.disabled}
          />
        ) : null}
      </View>
    </BottomSheetShell>
  );
}
