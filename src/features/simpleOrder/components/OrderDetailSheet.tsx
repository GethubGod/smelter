import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Card, SectionLabel, Sheet } from '@/components/ui';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { color, radius, typeScale, weight } from '@/theme/tokens';
import { formatHistoryDate, formatSentTime, type RecentOrder } from '../recentOrders';

export function OrderDetailSheet({ order, onClose, onReorder }: {
  order: RecentOrder | null;
  onClose: () => void;
  onReorder: (order: RecentOrder) => void;
}) {
  const ds = useScaledStyles();
  const [showMessage, setShowMessage] = useState(false);
  useEffect(() => setShowMessage(false), [order?.id]);
  const count = order?.itemCount ?? order?.reorderItems.length ?? 0;
  return <Sheet visible={order !== null} title={order ? formatHistoryDate(order.createdAt) : 'Order'}
    subtitle={order ? `${order.supplierName} · sent ${formatSentTime(order.createdAt)}` : undefined}
    onClose={onClose} expandable primary={order?.reorderItems.length ? {
      label: `Reorder these ${count} items`, onPress: () => { onClose(); setTimeout(() => onReorder(order), 240); },
    } : undefined}>
    {order ? <>
      <View style={{ flexDirection: 'row', gap: ds.spacing(10) }}>
        {[{ value: String(count), label: 'items' }, { value: order.supplierName.split(' ')[0], label: 'supplier' }, { value: order.status ?? 'Sent', label: 'status' }].map(stat =>
          <View key={stat.label} style={{ flex: 1, backgroundColor: color.card, borderRadius: radius.control, padding: ds.spacing(12) }}>
            <Text numberOfLines={1} style={{ fontSize: ds.fontSize(typeScale.stat), fontWeight: weight.bold, color: color.ink }}>{stat.value}</Text>
            <Text style={{ fontSize: ds.fontSize(typeScale.meta), color: color.ink2 }}>{stat.label}</Text>
          </View>)}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}><SectionLabel>Items</SectionLabel><Text style={{ fontSize: ds.fontSize(typeScale.caption), fontWeight: weight.semibold, color: color.ink3 }}>{count}</Text></View>
      <Card flush>{order.reorderItems.map((item, index) => <View key={`${item.itemId ?? item.itemName}-${index}`} style={{ marginHorizontal: ds.spacing(14), paddingVertical: ds.spacing(12), flexDirection: 'row', gap: ds.spacing(12), borderBottomWidth: index === order.reorderItems.length - 1 ? 0 : 1, borderBottomColor: color.hairline }}>
        <Text style={{ flex: 1, fontSize: ds.fontSize(typeScale.itemDense), color: color.ink }}>{item.itemName}</Text>
        <Text style={{ fontSize: ds.fontSize(typeScale.itemDense), color: color.ink, fontWeight: weight.semibold }}>{item.quantity}{item.unit ? ` ${item.unit}` : ''}</Text>
      </View>)}</Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <SectionLabel>Message as sent</SectionLabel>
        <Pressable accessibilityRole="button" accessibilityLabel={showMessage ? 'Hide message' : 'Show message'} onPress={() => setShowMessage(!showMessage)} hitSlop={10}><Text style={{ fontSize: ds.fontSize(typeScale.caption), fontWeight: weight.semibold, color: color.accent }}>{showMessage ? 'Hide' : 'Show'}</Text></Pressable>
      </View>
      {showMessage ? <Card><Text style={{ fontSize: ds.fontSize(typeScale.itemDense), lineHeight: ds.fontSize(typeScale.itemDense) * 1.45, color: color.ink }}>{order.messageText || 'No message text was archived for this order.'}</Text></Card> : null}
    </> : null}
  </Sheet>;
}
