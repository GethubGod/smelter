import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants';
import { ManagerScaleContainer } from '@/components/ManagerScaleContainer';
import { ScreenHeader } from '@/components/ui';
import { useManagedRefresh } from '@/hooks/useManagedRefresh';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { ReminderDeliveryEvent, listReminderDeliveryEvents } from '@/services';
import { color, radius, typeScale, weight } from '@/theme/tokens';

function formatEventTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown time';

  const now = Date.now();
  const delta = now - date.getTime();
  const minutes = Math.floor(delta / (1000 * 60));
  const hours = Math.floor(delta / (1000 * 60 * 60));
  const days = Math.floor(delta / (1000 * 60 * 60 * 24));

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function formatEventType(type: string) {
  if (type === 'sent') return 'Sent';
  if (type === 'reminded_again') return 'Reminded Again';
  if (type === 'auto_resolved') return 'Auto Resolved';
  if (type === 'cancelled') return 'Cancelled';
  return type;
}

export default function EmployeeReminderDeliveryStatusScreen() {
  const ds = useScaledStyles();

  const [events, setEvents] = useState<ReminderDeliveryEvent[]>([]);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const loadEvents = useCallback(async () => {
    try {
      const rows = await listReminderDeliveryEvents(120);
      setEvents(rows);
    } catch (error: any) {
      Alert.alert('Unable to load delivery status', error?.message || 'Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadEvents();
    }, [loadEvents])
  );

  const { refreshing, onRefresh: handleRefresh } = useManagedRefresh(loadEvents);

  const filteredEvents = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return events;

    return events.filter((entry) => {
      const employee = (entry.reminder.employee_name || '').toLowerCase();
      const eventType = entry.event_type.toLowerCase();
      const pushStatus = String((entry.delivery_result as any)?.push?.status || '').toLowerCase();
      return employee.includes(term) || eventType.includes(term) || pushStatus.includes(term);
    });
  }, [events, query]);

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: color.page }} edges={['top', 'left', 'right']}>
      <ManagerScaleContainer>
        <ScreenHeader
          title="Delivery Status"
          subtitle="Push and in-app reminder delivery history"
          mode="pushed"
          onBack={() => router.replace('/(manager)/employee-reminders')}
          includeSafeArea={false}
          style={{ backgroundColor: color.card, borderBottomWidth: 1, borderColor: color.hairline }}
        />

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: ds.spacing(16), paddingBottom: ds.spacing(28) }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary[500]} />}
        >
          <View
            className="border flex-row items-center"
            style={{ backgroundColor: color.card, borderColor: color.hairlineStrong, borderRadius: radius.control, paddingHorizontal: ds.spacing(12),
              minHeight: Math.max(46, ds.buttonH - ds.spacing(4)),
              marginBottom: ds.spacing(12) }}
          >
            <Ionicons name="search" size={ds.icon(18)} color={colors.gray[400]} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search by employee or status"
              placeholderTextColor={colors.gray[400]}
              style={{
                flex: 1,
                marginLeft: ds.spacing(8),
                fontSize: ds.fontSize(typeScale.body),
                color: colors.gray[900],
              }}
            />
          </View>

          {isLoading ? (
            <View className="items-center" style={{ paddingVertical: ds.spacing(40) }}>
              <Text style={{ color: color.ink2, fontSize: ds.fontSize(typeScale.body) }}>
                Loading events...
              </Text>
            </View>
          ) : filteredEvents.length === 0 ? (
            <View className="border items-center" style={{ backgroundColor: color.card, borderRadius: radius.card, borderColor: color.hairline, paddingVertical: ds.spacing(36), paddingHorizontal: ds.spacing(16) }}>
              <Ionicons name="notifications-off-outline" size={ds.icon(34)} color={colors.gray[300]} />
              <Text className="font-semibold" style={{ color: color.ink2, fontSize: ds.fontSize(typeScale.body), marginTop: ds.spacing(8) }}>
                No delivery events found
              </Text>
              <Text className="text-center" style={{ color: color.ink2, fontSize: ds.fontSize(typeScale.secondary), marginTop: ds.spacing(4) }}>
                Send a reminder first to see delivery history.
              </Text>
            </View>
          ) : (
            filteredEvents.map((entry) => {
              const pushStatus = (entry.delivery_result as any)?.push?.status || 'unknown';
              const channels = entry.channels_attempted.length > 0 ? entry.channels_attempted : ['none'];
              const employeeName = entry.reminder.employee_name || entry.reminder.employee_id || 'Unknown employee';

              return (
                <View
                  key={entry.id}
                  className="border"
                  style={{ backgroundColor: color.card, borderColor: color.hairline, borderRadius: radius.card,
                    paddingHorizontal: ds.spacing(14),
                    paddingVertical: ds.spacing(12),
                    marginBottom: ds.spacing(10) }}
                >
                  <View className="flex-row items-center justify-between">
                    <Text className="font-semibold" style={{ color: color.ink, fontSize: ds.fontSize(typeScale.body), flex: 1, paddingRight: ds.spacing(8) }}>
                      {employeeName}
                    </Text>
                    <Text style={{ color: color.ink2, fontSize: ds.fontSize(typeScale.secondary) }}>
                      {formatEventTime(entry.sent_at)}
                    </Text>
                  </View>

                  <Text style={{ color: color.ink2, fontSize: ds.fontSize(typeScale.secondary), marginTop: ds.spacing(4) }}>
                    {formatEventType(entry.event_type)}
                  </Text>

                  <View className="flex-row flex-wrap" style={{ gap: ds.spacing(6), marginTop: ds.spacing(8) }}>
                    {channels.map((channel) => (
                      <View
                        key={`${entry.id}-${channel}`}
                        style={{
                          backgroundColor: colors.gray[200],
                          paddingHorizontal: ds.spacing(8),
                          paddingVertical: ds.spacing(3),
                          borderRadius: radius.pill,
                        }}
                      >
                        <Text style={{ color: colors.gray[700], fontSize: ds.fontSize(typeScale.caption), fontWeight: weight.bold }}>{channel}</Text>
                      </View>
                    ))}

                    <View
                      style={{
                        backgroundColor:
                          pushStatus === 'sent'
                            ? colors.successBg
                            : pushStatus === 'not_delivered_push_disabled'
                              ? colors.gray[200]
                              : colors.errorBg,
                        paddingHorizontal: ds.spacing(8),
                        paddingVertical: ds.spacing(3),
                        borderRadius: radius.pill,
                      }}
                    >
                      <Text
                        style={{
                          color:
                            pushStatus === 'sent'
                              ? colors.success
                              : pushStatus === 'not_delivered_push_disabled'
                                ? colors.gray[700]
                                : colors.error,
                          fontSize: ds.fontSize(typeScale.caption),
                          fontWeight: weight.bold,
                        }}
                      >
                        Push: {pushStatus}
                      </Text>
                    </View>
                  </View>

                  <Text style={{ color: color.ink3, fontSize: ds.fontSize(typeScale.caption), marginTop: ds.spacing(8) }}>
                    {new Date(entry.sent_at).toLocaleString()}
                  </Text>
                </View>
              );
            })
          )}
        </ScrollView>
      </ManagerScaleContainer>
    </SafeAreaView>
  );
}
