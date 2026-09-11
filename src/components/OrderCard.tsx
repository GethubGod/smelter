import { View, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Order } from '@/types';
import { statusColors, ORDER_STATUS_LABELS, colors } from '@/constants';
import { color, radius, typeScale, weight } from '@/theme/tokens';

interface OrderCardProps {
  order: Order;
}

export function OrderCard({ order }: OrderCardProps) {
  const statusPalette = statusColors[order.status];
  const statusLabel = ORDER_STATUS_LABELS[order.status];

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getStatusIcon = () => {
    switch (order.status) {
      case 'draft':
        return 'create-outline';
      case 'submitted':
        return 'send-outline';
      case 'fulfilled':
        return 'checkmark-circle-outline';
      case 'cancelled':
        return 'close-circle-outline';
      default:
        return 'help-circle-outline';
    }
  };

  return (
    <TouchableOpacity
      className="p-4 shadow-sm" style={{ backgroundColor: color.card, borderRadius: radius.card }}
      onPress={() => router.push(`/orders/${order.id}`)}
      activeOpacity={0.7}
    >
      {/* Header */}
      <View className="flex-row justify-between items-start mb-3">
        <View>
          <Text className="font-bold" style={{ color: color.ink, fontSize: typeScale.title }}>
            Order #{order.order_number}
          </Text>
          <Text className="mt-1" style={{ color: color.ink2, fontSize: typeScale.body }}>
            {formatDate(order.created_at)}
          </Text>
        </View>
        <View
          className="flex-row items-center px-3 py-1"
          style={{ borderRadius: radius.pill, backgroundColor: statusPalette.bg }}
        >
          <Ionicons name={getStatusIcon()} size={14} color={statusPalette.text} />
          <Text
            className="ml-1"
            style={{ fontWeight: weight.semibold, fontSize: typeScale.body, color: statusPalette.text }}
          >
            {statusLabel}
          </Text>
        </View>
      </View>

      {/* Footer */}
      <View className="flex-row items-center justify-between pt-3 border-t" style={{ borderColor: color.hairline }}>
        <View className="flex-row items-center">
          <Ionicons name="chevron-forward" size={20} color={colors.gray[400]} />
          <Text className="ml-1" style={{ color: color.ink3, fontSize: typeScale.body }}>View Details</Text>
        </View>
        {order.fulfilled_at && (
          <Text style={{ color: color.ink3, fontSize: typeScale.secondary }}>
            Fulfilled: {formatDate(order.fulfilled_at)}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}
