import React from 'react';
import { Text, View } from 'react-native';
import { create } from 'zustand';
import { color, typeScale } from '@/theme/tokens';
import { Button } from './Button';
import { Sheet } from './Sheet';

export interface NoticeAction {
  text?: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}
interface Notice { title: string; message?: string; actions: NoticeAction[] }
const useNotice = create<{ notice: Notice | null }>(() => ({ notice: null }));

/** Replaces native alert dialogs with the shared sheet, preserving each action. */
export function showNotice(title: string, message?: string, actions?: NoticeAction[]) {
  useNotice.setState({ notice: { title, message, actions: actions?.length ? actions : [{ text: 'OK' }] } });
}

export function NoticeSheet() {
  const notice = useNotice((state) => state.notice);
  const close = () => useNotice.setState({ notice: null });
  return <Sheet visible={notice !== null} title={notice?.title ?? ''} onClose={close}>
    {notice?.message ? <Text style={{ fontSize: typeScale.body, color: color.ink2 }}>{notice.message}</Text> : null}
    <View style={{ gap: 10 }}>{notice?.actions.map((action, index) => <Button key={index} label={action.text ?? 'OK'} variant={action.style === 'destructive' ? 'destructive' : action.style === 'cancel' ? 'secondary' : 'primary'} onPress={() => {
      close();
      if (action.onPress) setTimeout(action.onPress, 240);
    }} />)}</View>
  </Sheet>;
}
