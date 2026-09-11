import React from 'react';
import {
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors,
  glassColors,
  glassHairlineWidth,
  glassRadii,
} from '@/theme/design';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { Sheet } from './ui/Sheet';
import { GlassSurface } from './ui/GlassSurface';
import { color, typeScale, weight } from '@/theme/tokens';

export interface ItemActionSheetItem {
  id: string;
  label: string;
  icon?: string;
  onPress: () => void;
  disabled?: boolean;
  destructive?: boolean;
  detail?: string;
}

export interface ItemActionSheetSection {
  id: string;
  title?: string;
  items: ItemActionSheetItem[];
}

interface ItemActionSheetProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  sections: ItemActionSheetSection[];
  onClose: () => void;
  cancelLabel?: string;
  showCancelAction?: boolean;
}

export function ItemActionSheet({
  visible,
  title,
  subtitle,
  sections,
  onClose,
  cancelLabel = 'Cancel',
  showCancelAction = true,
}: ItemActionSheetProps) {
  const ds = useScaledStyles();
  const hasActions = sections.some((section) => section.items.length > 0);

  return (
    <Sheet
      visible={visible}
      title={title}
      onClose={onClose}
      primary={
        showCancelAction
          ? { label: cancelLabel, onPress: onClose, variant: 'secondary' }
          : undefined
      }
    >
      {subtitle ? (
        <GlassSurface
          intensity="subtle"
          style={{
            borderRadius: glassRadii.surface,
          }}
        >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: ds.spacing(14),
                    paddingVertical: ds.spacing(12),
                  }}
                >
                  <View
                    style={{
                      width: ds.icon(38),
                      height: ds.icon(38),
                      borderRadius: ds.icon(19),
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: glassColors.accentSoft,
                    }}
                  >
                    <Ionicons name="cube-outline" size={ds.icon(18)} color={glassColors.accent} />
                  </View>
                  <View style={{ flex: 1, marginLeft: ds.spacing(12) }}>
                    <Text
                      style={{
                        fontSize: ds.fontSize(typeScale.caption),
                        fontWeight: weight.bold,
                        letterSpacing: 0.7,
                        textTransform: 'uppercase',
                        color: glassColors.textSecondary,
                      }}
                    >
                      Current Item
                    </Text>
                    <Text
                      style={{
                        marginTop: ds.spacing(4),
                        fontSize: ds.fontSize(typeScale.body),
                        color: glassColors.textPrimary,
                        lineHeight: ds.fontSize(typeScale.title),
                      }}
                    >
                      {subtitle}
                    </Text>
                  </View>
                </View>
        </GlassSurface>
      ) : null}

      <ScrollView
        style={{ maxHeight: ds.spacing(432) }}
        contentContainerStyle={{ paddingHorizontal: ds.spacing(6), paddingBottom: ds.spacing(4) }}
        showsVerticalScrollIndicator={false}
      >
        {hasActions ? (
          sections.map((section, sectionIndex) => {
            const visibleItems = section.items.filter((item) => Boolean(item));
            if (visibleItems.length === 0) return null;

            return (
              <View key={section.id} style={sectionIndex > 0 ? { marginTop: ds.spacing(16) } : undefined}>
                {section.title ? (
                  <Text
                    style={{
                      fontSize: ds.fontSize(typeScale.caption),
                      marginBottom: ds.spacing(8),
                      marginLeft: ds.spacing(6),
                      fontWeight: weight.bold,
                      letterSpacing: 0.8,
                      textTransform: 'uppercase',
                      color: glassColors.textSecondary,
                    }}
                  >
                    {section.title}
                  </Text>
                ) : null}

                <View style={{ gap: ds.spacing(10) }}>
                  {visibleItems.map((item, itemIndex) => {
                    const disabled = item.disabled === true;
                    const iconBackground = item.destructive
                      ? glassColors.dangerSoft
                      : sectionIndex === 0
                        ? glassColors.accentSoft
                        : glassColors.mediumFill;
                    const iconColor = item.destructive
                      ? glassColors.dangerText
                      : sectionIndex === 0
                        ? glassColors.accent
                        : glassColors.textPrimary;
                    const labelColor = item.destructive ? glassColors.dangerText : glassColors.textPrimary;

                    return (
                      <GlassSurface
                        key={item.id}
                        intensity="subtle"
                        style={{
                          borderRadius: glassRadii.button,
                          borderWidth: 1,
                          borderColor: item.destructive ? color.alert : glassColors.cardBorder,
                          overflow: 'hidden',
                        }}
                      >
                        <TouchableOpacity
                          disabled={disabled}
                          onPress={item.onPress}
                          activeOpacity={0.78}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'flex-start',
                            minHeight: Math.max(64, ds.rowH),
                            paddingHorizontal: ds.spacing(16),
                            paddingVertical: ds.spacing(14),
                            opacity: disabled ? 0.45 : 1,
                          }}
                        >
                          {item.icon ? (
                            <View
                              style={{
                                width: ds.icon(40),
                                height: ds.icon(40),
                                borderRadius: ds.icon(20),
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: iconBackground,
                                borderWidth: glassHairlineWidth,
                                borderColor: item.destructive
                                  ? color.alertBg
                                  : glassColors.cardBorder,
                              }}
                            >
                              <Ionicons name={item.icon as any} size={ds.icon(18)} color={iconColor} />
                            </View>
                          ) : (
                            <View style={{ width: ds.icon(40), height: ds.icon(40) }} />
                          )}
                          <View style={{ flex: 1, marginLeft: ds.spacing(12), paddingTop: ds.spacing(2) }}>
                            <Text
                              style={{
                                fontSize: ds.fontSize(typeScale.body),
                                fontWeight: weight.semibold,
                                color: labelColor,
                              }}
                            >
                              {item.label}
                            </Text>
                            {item.detail ? (
                              <Text
                                style={{
                                  fontSize: ds.fontSize(typeScale.secondary),
                                  marginTop: ds.spacing(4),
                                  color: glassColors.textSecondary,
                                  lineHeight: ds.fontSize(typeScale.title),
                                }}
                              >
                                {item.detail}
                              </Text>
                            ) : null}
                          </View>

                          <View style={{ paddingTop: ds.spacing(8), marginLeft: ds.spacing(8) }}>
                            <Ionicons
                              name="chevron-forward"
                              size={ds.icon(16)}
                              color={glassColors.textSecondary}
                            />
                          </View>
                        </TouchableOpacity>
                      </GlassSurface>
                    );
                  })}
                </View>
              </View>
            );
          })
        ) : (
          <GlassSurface
            intensity="subtle"
            style={{
              borderRadius: glassRadii.surface,
              paddingHorizontal: ds.spacing(16),
              paddingVertical: ds.spacing(24),
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                fontSize: ds.fontSize(typeScale.body),
                color: colors.textSecondary,
                textAlign: 'center',
              }}
            >
              No actions available.
            </Text>
          </GlassSurface>
        )}

      </ScrollView>
    </Sheet>
  );
}
