/**
 * The primitive set from the approved UI contract
 * (`docs/mockups/ui-contract/index.html`, header H1, tab bar T1).
 *
 * Screens compose these and nothing else. If a screen needs something that is
 * not here, file an issue against #32 and use the nearest primitive meanwhile;
 * do not invent a one-off.
 */
export { Button, type ButtonProps, type ButtonVariant, type ButtonSize } from './Button';
export { Card, type CardProps } from './Card';
export { Chip, type ChipProps } from './Chip';
export { EmptyState, type EmptyStateProps } from './EmptyState';
export { Input, type InputProps } from './Input';
export { ListRow, type ListRowProps } from './ListRow';
export { Loading, type LoadingProps } from './Loading';
export { ScreenHeader, type ScreenHeaderProps } from './ScreenHeader';
export { SectionLabel, type SectionLabelProps } from './SectionLabel';
export { Segment, type SegmentProps, type SegmentOption } from './Segment';
export { Sheet, type SheetProps } from './Sheet';
export { StatusPill, type StatusPillProps, type StatusTone } from './StatusPill';
export {
  TabBar,
  getTabBarClearance,
  type TabBarProps,
  type TabBarItem,
  type TabBarQuickActions,
} from './TabBar';

/* ── Legacy, pending the sweeps ────────────────────────────────────── */

/** @deprecated Sweeps #33 to #36 replace these with the primitives above. */
export { GlassView } from './GlassView';
/** @deprecated Use `Card`. */
export { GlassSurface } from './GlassSurface';
/** @deprecated Use `ScreenHeader mode="pushed"`. */
export { StackScreenHeader } from './StackScreenHeader';
/** @deprecated Use `Segment`. */
export {
  UnitTypeSegmentedControl,
  type UnitTypeSegmentedControlProps,
} from './UnitTypeSegmentedControl';
