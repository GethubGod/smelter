/**
 * Smelter UI tokens, the single source of truth.
 *
 * Transcribed from the approved UI contract at
 * `docs/mockups/app-redesign-2026-09/SPEC.md` and reference-glide.html.
 * Nothing here is invented: every value appears in that document.
 *
 * Rules:
 * - Screens import these. Screens never write a hex string, an rgba string, a
 *   numeric `fontSize`, or a numeric `borderRadius`. The `smelter/no-design-drift`
 *   ESLint rule enforces that outside `src/theme` and `src/components/ui`.
 * - Status colours (`good`, `warning`, `alert`) belong to StatusPill and inline
 *   validation only. They never colour a button, a chip, or a title.
 * - The legacy sets in `./design.ts` are deprecated. Sweeps #33 to #36 migrate
 *   screens off them; when the last import is gone, `design.ts` goes with it.
 */

import { Platform } from 'react-native';

/* ── Colour: daily work surfaces ───────────────────────────────────── */

export const color = {
  /** Screen background. */
  page: '#F3F3F1',
  /** White cards. */
  card: '#FFFFFF',
  /** Inputs, tracks, icon tiles, segment tracks. */
  well: '#EAEAE8',
  /** Row separators and card borders. */
  hairline: 'rgba(0, 0, 0, 0.05)',
  /** Heavier divider, used inside the tab bar pill. */
  hairlineStrong: 'rgba(0, 0, 0, 0.14)',
  /** The only action colour. */
  accent: '#E84D38',
  /** Selected and active fills behind the accent. */
  tint: '#FBEAE7',
  /** Text and icons on top of `accent`. */
  onAccent: '#FFFFFF',
  /** Destructive and error text. */
  alert: '#C03520',
  alertBg: '#FBE7E7',
  /** Titles and body copy. */
  ink: '#1A1A1A',
  /** Secondary text. */
  ink2: '#5F5F5F',
  /** Captions, placeholders, inactive glyphs. */
  ink3: '#9C9890',
  /** Disabled controls. */
  disabled: '#C9C5BC',
  /** Status only. */
  good: '#22883E',
  goodBg: '#E6F4EA',
  /** Status only. */
  warning: '#B45309',
  warningBg: '#FFF4DC',
  /** Sheet and modal backdrop. */
  scrim: 'rgba(20, 18, 14, 0.5)',
  /** Inactive tab glyph inside the floating pill. */
  tabInactive: 'rgba(255, 255, 255, 0.62)',
  dockBg: '#1A1A1A',
  dockFg: 'rgba(255, 255, 255, 0.62)',
  dockDivider: 'rgba(255, 255, 255, 0.18)',
  sheetBg: '#F3F3F1',
  sheetHandle: 'rgba(0, 0, 0, 0.2)',
} as const;

/* ── Colour: auth surfaces (black) ─────────────────────────────────── */

/** Setup and sign-in are black. Daily work is `color.page`. One auth look. */
export const auth = {
  bg: '#000000',
  text: '#FFFFFF',
  dim: 'rgba(255, 255, 255, 0.55)',
  well: 'rgba(255, 255, 255, 0.09)',
  wellBorder: 'rgba(255, 255, 255, 0.18)',
  /** Secondary buttons on black use a brighter border than the wells. */
  buttonBorder: 'rgba(255, 255, 255, 0.35)',
  accent: color.accent,
} as const;

/* ── Type: semantic sizes, three weights ───────────────────────────────── */

/**
 * Named `typeScale` rather than `type`: `import { type }` collides with
 * TypeScript's type-only import syntax.
 */
export const typeScale = {
  /** Root screen titles. */
  display: 30,
  /** Pushed screen titles, sheet titles, big numbers. */
  title: 20,
  /** Item names, row titles, inputs, buttons. */
  body: 15,
  /** Row subtitles, chips, tab labels, helper text. */
  secondary: 13,
  /** Section labels, status pills, badges. Always uppercase. */
  caption: 11,
  itemComfort: 16,
  itemDense: 14,
  meta: 12,
  quantityComfort: 19,
  hero: 17,
  stat: 22,
  time: 26,
} as const;

/** The only three weights. 500, 800 and 900 are gone. */
export const weight = {
  regular: '400',
  semibold: '600',
  bold: '700',
} as const;

/** Tracking, in points, matching the contract's em values at each size. */
export const tracking = {
  display: -0.9,
  title: -0.2,
  caption: 0.88,
} as const;

/* ── Radius and spacing ────────────────────────────────────────────── */

export const radius = {
  /** Buttons, chips, segments, tab bar, badges, avatars. */
  pill: 999,
  /** Cards, list groups, stat tiles. */
  card: 22,
  /** Inputs, icon tiles, small thumbnails. */
  control: 14,
  /** Bottom sheet top corners only. */
  sheet: 30,
  tile: 12,
  checkComfort: 11,
  checkCompact: 9,
  checkDense: 8,
  addBar: 26,
} as const;

export const space = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
} as const;

/* ── Control sizes ─────────────────────────────────────────────────── */

/** Fixed heights and hit targets read off the contract's rendered primitives. */
export const size = {
  button: 50,
  buttonSmall: 34,
  chip: 32,
  input: 48,
  /** The pushed-header back circle, and header icon actions. */
  headerCircle: 40,
  /** iOS minimum touch target; controls never render smaller. */
  touchMin: 44,
  icon: 20,
  emptyStateIcon: 56,
  sheetHandleWidth: 36,
  sheetHandleHeight: 4,
  badge: 15,
  tabDivider: 22,
} as const;

/* ── Elevation ─────────────────────────────────────────────────────── */

/** The three shadows in the Studio contract. Everything else is flat. */
export const shadow = {
  /** Floating pill tab bar: 0 10px 28px rgba(20,18,14,.16). */
  tabBar: {
    shadowColor: '#14120E',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 28,
    elevation: Platform.OS === 'android' ? 10 : 0,
  },
  addBar: {
    shadowColor: '#14120E',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.16,
    shadowRadius: 34,
    elevation: Platform.OS === 'android' ? 10 : 0,
  },
  /** Bottom sheet: 0 -10px 30px rgba(0,0,0,.12). */
  sheet: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.12,
    shadowRadius: 30,
    elevation: Platform.OS === 'android' ? 12 : 0,
  },
} as const;

/* ── Status ────────────────────────────────────────────────────────── */

/** The five order states StatusPill renders. Fixed mapping, no others. */
export type StatusTone =
  | 'draft'
  | 'submitted'
  | 'processing'
  | 'fulfilled'
  | 'cancelled';

export const statusTone: Record<StatusTone, { background: string; text: string; label: string }> = {
  draft: { background: color.well, text: color.ink3, label: 'Draft' },
  submitted: { background: color.warningBg, text: color.warning, label: 'Submitted' },
  processing: { background: color.well, text: color.ink, label: 'Processing' },
  fulfilled: { background: color.goodBg, text: color.good, label: 'Fulfilled' },
  cancelled: { background: color.alertBg, text: color.alert, label: 'Cancelled' },
};

/** Cubic-bezier control points shared by Animated and Reanimated. */
export const motion = {
  ease: [0.2, 0.8, 0.2, 1],
  dur: 280,
  pop: [0.34, 1.5, 0.64, 1],
} as const;
