import React from 'react';
import { Modal } from 'react-native';

export type FullScreenSheetPresentation = 'page' | 'overlay';

export interface FullScreenSheetProps {
  visible: boolean;
  /** Hardware back on Android, and whatever dismissal the caller wires up. */
  onClose: () => void;
  /**
   * `page` is the opaque iOS card: a full form with its own header and
   * scrolling body. `overlay` is transparent, for the screens that draw their
   * own scrim and keyboard-aware bottom sheet inside it.
   */
  presentation?: FullScreenSheetPresentation;
  children: React.ReactNode;
}

/**
 * The second designated host of the native `Modal`, alongside
 * `BottomSheetShell`.
 *
 * `Sheet` covers the common case: a short, fixed-height bottom sheet with a
 * title and one action. It cannot host a full form, because `BottomSheetShell`
 * has no internal scroll container, and it cannot host a sheet that manages
 * its own keyboard avoidance. Those two shapes used to reach for `Modal`
 * directly, which is what the design-drift rule reports.
 *
 * This primitive owns the presentation and nothing else. The caller keeps its
 * own body: a `SafeAreaView` form for `page`, a scrim plus
 * `KeyboardAvoidingView` for `overlay`.
 */
export function FullScreenSheet({
  visible,
  onClose,
  presentation = 'page',
  children,
}: FullScreenSheetProps) {
  if (presentation === 'overlay') {
    return (
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        {children}
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      {children}
    </Modal>
  );
}
