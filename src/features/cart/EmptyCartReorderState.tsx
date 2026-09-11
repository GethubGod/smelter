import React from 'react';
import { Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card, getTabBarClearance } from '@/components/ui';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { color, radius, space, typeScale } from '@/theme/tokens';

interface EmptyCartReorderStateProps {
  quickOrderRoute: string;
  browseRoute: string;
}

export function EmptyCartReorderState({
  quickOrderRoute,
  browseRoute,
}: EmptyCartReorderStateProps) {
  const ds = useScaledStyles();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const heroMinHeight = Math.min(
    Math.max(ds.spacing(286), Math.round(height * 0.38)),
    ds.spacing(356),
  );
  const actionButtonHeight = Math.max(52, Math.min(ds.buttonH + ds.spacing(6), 60));
  const actionButtonRadius = radius.pill;
  const actionButtonHorizontalPadding = ds.spacing(16);
  const actionIconSize = ds.icon(16);
  const actionTextSize = ds.fontSize(typeScale.body);
  const supportTextMaxWidth = ds.spacing(280);
  const actionGroupMaxWidth = ds.spacing(332);

  return (
    <View
      style={{
        flex: 1,
        paddingHorizontal: space[4],
        paddingTop: ds.spacing(8),
        paddingBottom: getTabBarClearance(insets.bottom) + ds.spacing(space[5]),
      }}
    >
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: heroMinHeight,
          paddingTop: ds.spacing(20),
          paddingBottom: ds.spacing(26),
        }}
      >
        <View
          style={{
            width: ds.icon(64),
            height: ds.icon(64),
            borderRadius: radius.pill,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: color.card,
            borderWidth: 1,
            borderColor: color.hairline,
          }}
        >
          <Ionicons
            name="bag-outline"
            size={ds.icon(28)}
            color={color.ink3}
          />
        </View>

        <Text
          style={{
            marginTop: ds.spacing(20),
            fontSize: ds.fontSize(typeScale.title),
            fontWeight: '700',
            color: color.ink,
            textAlign: 'center',
          }}
        >
          No items in cart
        </Text>

        <Text
          style={{
            marginTop: ds.spacing(8),
            maxWidth: supportTextMaxWidth,
            fontSize: ds.fontSize(typeScale.secondary),
            lineHeight: ds.fontSize(typeScale.title),
            color: color.ink2,
            textAlign: 'center',
          }}
        >
          Browse inventory or use Quick to start a new order.
        </Text>

        <View
          style={{
            width: '100%',
            maxWidth: actionGroupMaxWidth,
            alignSelf: 'center',
            marginTop: ds.spacing(24),
            flexDirection: 'row',
            gap: ds.spacing(10),
          }}
        >
          <TouchableOpacity
            onPress={() => router.push(browseRoute as never)}
            style={{
              flex: 1.35,
              minHeight: actionButtonHeight,
              borderRadius: actionButtonRadius,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              backgroundColor: color.accent,
              paddingHorizontal: actionButtonHorizontalPadding,
            }}
            activeOpacity={0.85}
          >
            <Ionicons
              name="grid-outline"
              size={actionIconSize}
              color={color.onAccent}
            />
            <Text
              style={{
                marginLeft: ds.spacing(6),
                fontSize: actionTextSize,
                fontWeight: '700',
                color: color.onAccent,
              }}
            >
              Browse
            </Text>
          </TouchableOpacity>

          <Card
            flush
            style={{
              flex: 1,
              borderRadius: actionButtonRadius,
              overflow: 'hidden',
            }}
          >
            <TouchableOpacity
              onPress={() => router.push(quickOrderRoute as never)}
              style={{
                minHeight: actionButtonHeight,
                borderRadius: actionButtonRadius,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                paddingHorizontal: actionButtonHorizontalPadding,
              }}
              activeOpacity={0.85}
            >
              <Ionicons
                name="flash-outline"
                size={actionIconSize}
                color={color.ink}
              />
              <Text
                style={{
                  marginLeft: ds.spacing(6),
                  fontSize: actionTextSize,
                  fontWeight: '700',
                  color: color.ink,
                }}
              >
                Quick
              </Text>
            </TouchableOpacity>
          </Card>
        </View>
      </View>
    </View>
  );
}
