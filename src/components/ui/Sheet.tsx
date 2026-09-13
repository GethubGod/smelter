import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheetShell } from '@/components/BottomSheetShell';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { color, radius, space, tracking, typeScale, weight } from '@/theme/tokens';
import { Button, type ButtonProps } from './Button';

export interface SheetProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children?: React.ReactNode;
  /** The single action at the foot of the sheet. */
  primary?: Pick<ButtonProps, 'label' | 'onPress' | 'loading' | 'disabled' | 'variant'>;
  /** Review and order-detail sheets can expand to 88% height. */
  expandable?: boolean;
  /** Use `embedded` when the sheet already sits inside a native modal. */
  presentation?: 'modal' | 'embedded';
  /**
   * Scrim tap, close button and drag-to-dismiss, on by default. Pass false
   * while the sheet holds unsaved input so its explicit Cancel action is the
   * only way out.
   */
  dismissible?: boolean;
  testID?: string;
}

/** Shared title, scrolling body and footer for every app sheet. */
export function Sheet({
  visible,
  title,
  subtitle,
  onClose,
  children,
  primary,
  expandable = false,
  presentation = 'modal',
  dismissible = true,
  testID,
}: SheetProps) {
  const ds = useScaledStyles();
  const insets = useSafeAreaInsets();
  const sidePadding = ds.spacing(space[5]);

  const header = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: ds.spacing(10),
        paddingTop: ds.spacing(space[1]),
        paddingHorizontal: sidePadding,
        paddingBottom: ds.spacing(space[2]),
      }}
    >
      <View style={{ flex: 1 }}>
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
        {subtitle ? (
          <Text
            style={{
              marginTop: ds.spacing(3),
              fontSize: ds.fontSize(typeScale.secondary),
              color: color.ink2,
            }}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {dismissible ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Close ${title}`}
          hitSlop={ds.spacing(6)}
          onPress={onClose}
          style={{
            width: ds.spacing(space[8]),
            height: ds.spacing(space[8]),
            borderRadius: ds.radius(radius.pill),
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: color.card,
          }}
        >
          <Ionicons name="close" size={ds.icon(space[4])} color={color.ink} />
        </Pressable>
      ) : null}
    </View>
  );

  const footer = primary ? (
    <View
      style={{
        paddingTop: ds.spacing(10),
        paddingHorizontal: sidePadding,
        paddingBottom: Math.max(insets.bottom, ds.spacing(34)),
      }}
    >
      <Button
        variant={primary.variant ?? 'primary'}
        label={primary.label}
        onPress={primary.onPress}
        loading={primary.loading}
        disabled={primary.disabled}
      />
    </View>
  ) : (
    <View style={{ height: ds.spacing(22) }} />
  );

  return (
    <BottomSheetShell
      visible={visible}
      presentation={presentation}
      onClose={onClose}
      header={header}
      footer={footer}
      scrollable
      expandable={expandable}
      horizontalPadding={sidePadding}
      bottomPadding={Math.max(insets.bottom, ds.spacing(34))}
      dismissible={dismissible}
    >
      <View testID={testID} style={{ gap: ds.spacing(space[3]) }}>
        {children}
      </View>
    </BottomSheetShell>
  );
}
