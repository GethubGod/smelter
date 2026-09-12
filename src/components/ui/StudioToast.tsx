import React from 'react';
import { create } from 'zustand';
import { ChecklistToast, type ChecklistToastState } from '@/features/simpleOrder/components/ChecklistToast';

const useToast = create<{ toast: ChecklistToastState | null; duration: number }>(() => ({ toast: null, duration: 2200 }));
let nextToastId = 0;
export function showStudioToast(message: string, durationMs = 2200) {
  useToast.setState({ toast: { message, id: ++nextToastId }, duration: durationMs });
}
export function StudioToast() {
  const { toast, duration } = useToast();
  return <ChecklistToast toast={toast} durationMs={duration} bottom={200} onExpire={() => useToast.setState({ toast: null })} />;
}
