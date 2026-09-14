import type { Ionicons } from '@expo/vector-icons';
import type { Href } from 'expo-router';
import {
  buildSettingsHref,
  MANAGER_SETTINGS_ROOT,
} from '@/lib/settingsNavigation';

type SettingsIconName = keyof typeof Ionicons.glyphMap;

export interface SettingsItem {
  key: string;
  icon: SettingsIconName;
  title: string;
  subtitle?: string;
  rightText?: string;
  chevron?: 'right' | 'down';
  onPress: () => void;
}

export interface SettingsGroupModel {
  key: 'team' | 'ordering' | 'help' | 'employee';
  label: 'Team' | 'Ordering' | 'Help' | 'Employee';
  items: SettingsItem[];
}

interface BuildManagerSettingsGroupsOptions {
  teamCountLabel: string;
  inventoryCountLabel: string;
  reminderSubtitle: string;
  checklistSubtitle: string;
  appVersion: string;
  onNavigate: (href: Href) => void;
  onOpenReminder: () => void;
  onOpenChecklist: () => void;
  onOpenAbout: () => void;
  onContactSupport: () => void;
  onSwitchToEmployee: () => void;
}

function managerRoute(pathname: string): Href {
  return buildSettingsHref(pathname, {
    origin: 'manager',
    backTo: MANAGER_SETTINGS_ROOT,
  });
}

export function buildManagerSettingsGroups({
  teamCountLabel,
  inventoryCountLabel,
  reminderSubtitle,
  checklistSubtitle,
  appVersion,
  onNavigate,
  onOpenReminder,
  onOpenChecklist,
  onOpenAbout,
  onContactSupport,
  onSwitchToEmployee,
}: BuildManagerSettingsGroupsOptions): SettingsGroupModel[] {
  return [
    {
      key: 'team',
      label: 'Team',
      items: [
        {
          key: 'team',
          icon: 'people-outline',
          title: 'Team',
          subtitle: `${teamCountLabel} · invites and features`,
          chevron: 'right',
          onPress: () => onNavigate(managerRoute('/(manager)/manager-settings/team')),
        },
        {
          key: 'supplier-contacts',
          icon: 'call-outline',
          title: 'Supplier contacts',
          subtitle: 'Numbers and send channels',
          chevron: 'right',
          onPress: () =>
            onNavigate(managerRoute('/(manager)/manager-settings/supplier-contacts')),
        },
        {
          key: 'user-management',
          icon: 'lock-closed-outline',
          title: 'User management',
          subtitle: 'Suspend or delete accounts',
          chevron: 'right',
          onPress: () =>
            onNavigate(managerRoute('/(manager)/manager-settings/user-management')),
        },
      ],
    },
    {
      key: 'ordering',
      label: 'Ordering',
      items: [
        {
          key: 'inventory',
          icon: 'cube-outline',
          title: 'Inventory',
          subtitle: `${inventoryCountLabel} · stations and units`,
          chevron: 'right',
          onPress: () => onNavigate(managerRoute('/(manager)/inventory')),
        },
        {
          key: 'export-format',
          icon: 'document-text-outline',
          title: 'Export format',
          subtitle: 'Supplier message template',
          chevron: 'right',
          onPress: () =>
            onNavigate(managerRoute('/(manager)/manager-settings/export-format')),
        },
        {
          key: 'order-reminders',
          icon: 'notifications-outline',
          title: 'Order reminders',
          subtitle: reminderSubtitle,
          chevron: 'down',
          onPress: onOpenReminder,
        },
        {
          key: 'checklist-display',
          icon: 'options-outline',
          title: 'Checklist display',
          subtitle: checklistSubtitle,
          chevron: 'down',
          onPress: onOpenChecklist,
        },
      ],
    },
    {
      key: 'help',
      label: 'Help',
      items: [
        {
          key: 'contact-support',
          icon: 'help-circle-outline',
          title: 'Contact support',
          subtitle: 'Report a problem',
          chevron: 'right',
          onPress: onContactSupport,
        },
        {
          key: 'about-legal',
          icon: 'shield-checkmark-outline',
          title: 'About and legal',
          rightText: `v${appVersion}`,
          chevron: 'down',
          onPress: onOpenAbout,
        },
      ],
    },
    {
      key: 'employee',
      label: 'Employee',
      items: [
        {
          key: 'switch-employee',
          icon: 'swap-horizontal',
          title: 'Switch to Employee view',
          subtitle: 'Place an order from the checklist',
          chevron: 'right',
          onPress: onSwitchToEmployee,
        },
      ],
    },
  ];
}
