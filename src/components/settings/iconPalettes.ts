import { color } from '@/theme/tokens';

/**
 * The contract has one icon tile: the well fill with an ink2 glyph
 * (`docs/mockups/ui-contract/index.html`, ListRow). Destructive rows are the
 * single exception and take the alert pair.
 *
 * The palette names survive because screens outside this sweep still import
 * them. They all resolve to the same contract tile now, so no screen can put a
 * one-off colour behind a settings icon.
 */
const tile = { background: color.well, icon: color.ink2 } as const;
const danger = { background: color.alertBg, icon: color.alert } as const;

export const settingsSectionPalettes = {
  account: tile,
  preferences: tile,
  orderingInventory: tile,
  management: tile,
  supportHistory: tile,
  viewSwitching: tile,
  auth: danger,
} as const;

export const settingsIconPalettes = {
  profile: tile,
  display: tile,
  notifications: tile,
  reminders: tile,
  stock: tile,
  support: tile,
  orders: tile,
  quickSearch: tile,
  users: tile,
  switchView: tile,
  accessCodes: tile,
  inventory: tile,
  neutral: tile,
  danger,
} as const;
