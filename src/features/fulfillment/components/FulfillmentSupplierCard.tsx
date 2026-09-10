import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import {
  glassColors,
  glassHairlineWidth,
  glassRadii,
} from '@/theme/design';
import { FulfillmentExpandedSupplierItems } from './FulfillmentExpandedSupplierItems';
import { color, radius, typeScale, weight } from '@/theme/tokens';

const AVATAR_PALETTE = [
  { background: color.well, text: color.ink2 },
  { background: color.well, text: color.ink2 },
  { background: color.well, text: color.ink2 },
  { background: color.well, text: color.ink2 },
] as const;

export interface FulfillmentSupplierEmployee {
  id: string;
  name: string;
  initials: string;
  count: number;
}

export interface FulfillmentSupplierPreviewItem {
  id: string;
  name: string;
  quantityLabel: string;
  summaryLabel: string | null;
  badgeLabel: string | null;
  badgeOverflowCount: number;
  badgeToneIndex: number;
  isRemaining: boolean;
  onPress?: (() => void) | null;
}

interface FulfillmentSupplierCardProps {
  name: string;
  statusLabel?: string | null;
  employees: FulfillmentSupplierEmployee[];
  employeeSummary: string;
  summaryStats: string;
  items: FulfillmentSupplierPreviewItem[];
  isExpanded: boolean;
  orderLabel: string;
  onToggle: () => void;
  onOrderPress: () => void;
}

function AvatarStack({ employees }: { employees: FulfillmentSupplierEmployee[] }) {
  const ds = useScaledStyles();

  if (employees.length === 0) return null;

  const visibleEmployees = employees.slice(0, 3);

  return (
    <View style={{ flexDirection: 'row', marginRight: 12 }}>
      {visibleEmployees.map((employee, index) => {
        const palette = AVATAR_PALETTE[index % AVATAR_PALETTE.length];
        return (
          <View
            key={employee.id}
            style={{
              width: 20,
              height: 20,
              borderRadius: radius.control,
              backgroundColor: palette.background,
              borderWidth: 1.5,
              borderColor: color.card,
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: index === 0 ? 0 : -5,
              zIndex: visibleEmployees.length - index,
            }}
          >
            <Text style={{ color: palette.text, fontSize: ds.fontSize(typeScale.caption), fontWeight: weight.bold }}>
              {employee.initials}
            </Text>
          </View>
        );
      })}

      {employees.length > 3 ? (
        <View
          style={{
            width: 20,
            height: 20,
            borderRadius: radius.control,
            backgroundColor: color.well,
            borderWidth: 1.5,
            borderColor: color.card,
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: -5,
          }}
        >
          <Text style={{ color: color.ink2, fontSize: ds.fontSize(typeScale.caption), fontWeight: weight.bold }}>
            +{employees.length - 3}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export function FulfillmentSupplierCard({
  name,
  statusLabel,
  employees,
  employeeSummary,
  summaryStats,
  items,
  isExpanded,
  orderLabel,
  onToggle,
  onOrderPress,
}: FulfillmentSupplierCardProps) {
  const ds = useScaledStyles();
  const chevronProgress = useRef(new Animated.Value(isExpanded ? 1 : 0)).current;
  const contentProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(chevronProgress, {
      toValue: isExpanded ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [chevronProgress, isExpanded]);

  useEffect(() => {
    if (!isExpanded) return;

    contentProgress.setValue(0);
    Animated.timing(contentProgress, {
      toValue: 1,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [contentProgress, isExpanded]);

  const chevronStyle = useMemo(
    () => ({
      transform: [
        {
          rotate: chevronProgress.interpolate({
            inputRange: [0, 1],
            outputRange: ['0deg', '180deg'],
          }),
        },
      ],
    }),
    [chevronProgress]
  );

  const contentStyle = useMemo(
    () => ({
      opacity: contentProgress,
      transform: [
        {
          translateY: contentProgress.interpolate({
            inputRange: [0, 1],
            outputRange: [6, 0],
          }),
        },
      ],
    }),
    [contentProgress]
  );

  return (
    <View
      style={{
        backgroundColor: colors.gray[100],
        borderRadius: glassRadii.surface,
        overflow: 'hidden',
      }}
    >
      <TouchableOpacity
        onPress={onToggle}
        activeOpacity={0.94}
        style={{
          paddingHorizontal: ds.spacing(20),
          paddingTop: ds.spacing(20),
          paddingBottom: isExpanded ? ds.spacing(16) : ds.spacing(20),
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1, paddingRight: ds.spacing(12) }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Animated.View
                style={[
                  {
                    marginRight: ds.spacing(8),
                    alignItems: 'center',
                    justifyContent: 'center',
                  },
                  chevronStyle,
                ]}
              >
                <Ionicons
                  name="chevron-down"
                  size={14}
                  color={glassColors.textSecondary}
                />
              </Animated.View>

              <Text
                numberOfLines={1}
                style={{
                  color: glassColors.textPrimary,
                  fontSize: ds.fontSize(typeScale.title),
                  fontWeight: weight.bold,
                  flexShrink: 1,
                }}
              >
                {name}
              </Text>
              {statusLabel ? (
                <View
                  style={{
                    marginLeft: ds.spacing(8),
                    paddingHorizontal: ds.spacing(8),
                    paddingVertical: 3,
                    borderRadius: radius.pill,
                    backgroundColor: glassColors.warningSoft,
                    borderWidth: glassHairlineWidth,
                    borderColor: glassColors.accentBorder,
                  }}
                >
                  <Text
                    style={{
                      color: glassColors.warningText,
                      fontSize: ds.fontSize(typeScale.caption),
                      fontWeight: weight.bold,
                    }}
                  >
                    {statusLabel}
                  </Text>
                </View>
              ) : null}
            </View>

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginTop: ds.spacing(14),
                marginLeft: 22,
              }}
            >
              <AvatarStack employees={employees} />
              <Text
                numberOfLines={1}
                style={{
                  color: glassColors.textSecondary,
                  fontSize: ds.fontSize(typeScale.secondary),
                  fontWeight: weight.semibold,
                  flex: 1,
                }}
              >
                {employeeSummary}
              </Text>
            </View>

            <Text
              style={{
                color: glassColors.textSecondary,
                fontSize: ds.fontSize(typeScale.secondary),
                fontWeight: weight.semibold,
                marginTop: ds.spacing(12),
                marginLeft: 22,
              }}
            >
              {summaryStats}
            </Text>
          </View>

          {!isExpanded ? (
            <TouchableOpacity
              onPress={(event) => {
                event.stopPropagation();
                onOrderPress();
              }}
              activeOpacity={0.88}
              style={{
                minHeight: Math.max(42, ds.buttonH),
                paddingHorizontal: ds.spacing(15),
                paddingVertical: ds.spacing(10),
                borderRadius: glassRadii.pill,
                backgroundColor: glassColors.accent,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: color.ink,
                shadowOpacity: 0.12,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 6 },
                elevation: 2,
              }}
            >
              <Text
                style={{
                  color: glassColors.textOnPrimary,
                  fontSize: ds.fontSize(typeScale.body),
                  fontWeight: weight.bold,
                }}
              >
                Order
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </TouchableOpacity>

      {isExpanded ? (
        <Animated.View
          style={[
            contentStyle,
            {
              paddingTop: 0,
            },
          ]}
        >
          <FulfillmentExpandedSupplierItems
            items={items}
            orderLabel={orderLabel}
            onOrderPress={onOrderPress}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}
