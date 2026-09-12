import fs from 'fs';
import path from 'path';
import { buildManagerSettingsGroups } from '@/features/settings/settingsSections';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

describe('manager Home Studio contract', () => {
  const home = read('features/home/HomeScreenView.tsx');

  it('renders the exact manager modules and removes the legacy Home surface', () => {
    expect(home).toContain('Fulfillment');
    expect(home).toContain('Review orders ›');
    expect(home).toContain('<SectionLabel>Quick actions</SectionLabel>');
    expect(home).toContain('Reorder last ${new Date(recentOrder.createdAt)');
    expect(home).toContain('Browse inventory');
    expect(home).toContain('Switch to Employee view');
    expect(home).toContain('<SectionLabel>Suggestions</SectionLabel>');
    expect(home).toContain('Collecting more data');
    expect(home).toContain('Suggestions appear here as more orders are placed.');
    expect(home).not.toContain('GlassSurface');
    expect(home).not.toContain('@/theme/design');
    expect(home).not.toContain('Quick Order');
    expect(home).not.toContain('Search all');
  });

  it('uses real overview, location history, and inventory values, then stages checklist reorders', () => {
    expect(home).toContain('useManagerFulfillmentOverview()');
    expect(home).toContain('activeInventory.length');
    expect(home).toContain('categoryCount');
    expect(home).toContain('recentManagerArchive(pastOrders, location.id, locationGroup)');
    expect(home).toContain('buildReorderItemsFromPayload(payload)');
    expect(home).toContain('listMyOrderHistory(location.id, locationGroup)');
    expect(home).toContain('recentLoadGeneration.current');
    expect(home).toContain('setPendingReorder({');
    expect(home).toContain("switchViewMode('employee', { announce: false })");
  });
});

describe('manager Settings Studio contract', () => {
  const screen = read('../app/(manager)/profile.tsx');
  const noop = () => undefined;
  const navigate = jest.fn();
  const groups = buildManagerSettingsGroups({
    teamCountLabel: '4 people',
    inventoryCountLabel: '240 items',
    reminderSubtitle: 'Fri · 3:00 PM',
    checklistSubtitle: 'Compact · categories on',
    appVersion: '2.3',
    onNavigate: navigate,
    onOpenReminder: noop,
    onOpenChecklist: noop,
    onOpenAbout: noop,
    onContactSupport: noop,
    onSwitchToEmployee: noop,
  });

  beforeEach(() => navigate.mockClear());

  it('contains only the approved groups and rows in reference order', () => {
    expect(groups.map((group) => group.label)).toEqual([
      'Team',
      'Ordering',
      'Help',
      'Employee',
    ]);
    expect(groups.flatMap((group) => group.items.map((item) => item.title))).toEqual([
      'Team',
      'Access codes',
      'Supplier contacts',
      'User management',
      'Inventory',
      'Export format',
      'Order reminders',
      'Checklist display',
      'Contact support',
      'About and legal',
      'Switch to Employee view',
    ]);
  });

  it('keeps manager origin and back route on pushed settings screens', () => {
    groups[1].items[0].onPress();
    expect(navigate).toHaveBeenCalledWith({
      pathname: '/(manager)/inventory',
      params: {
        origin: 'manager',
        backTo: '/(manager)/profile',
      },
    });
  });

  it('uses sheet disclosures, real count loaders, the profile avatar, and footer', () => {
    expect(groups[1].items.slice(2).map((item) => item.chevron)).toEqual([
      'down',
      'down',
    ]);
    expect(groups[2].items[1]).toMatchObject({ rightText: 'v2.3', chevron: 'down' });
    expect(screen).toContain('width: ds.icon(46)');
    expect(screen).toContain('<BrandFooter name={displayName} />');
    expect(screen).toContain('listManagedUsers()');
    expect(screen).toContain('activeInventoryCount');
    expect(screen).not.toContain('GlassSurface');
    expect(screen).not.toContain('ManagerScaleContainer');
    expect(screen).not.toContain('@/theme/design');
  });
});

describe('manager Team Studio contract', () => {
  const team = read('features/team/TeamScreen.tsx');
  const teamUi = read('features/team/components/TeamUI.tsx');

  it('groups roster rows and keeps the exact pushed-screen actions', () => {
    expect(team).toContain('title="Team"');
    expect(team).toContain('size="small"');
    expect(team).toContain('label="Invite"');
    expect(team).toContain('<Card flush>');
    expect(team).toContain('<SectionLabel>Defaults</SectionLabel>');
    expect(team).toContain('title="New employee defaults"');
    expect(team).toContain("'everything else off'");
    expect(team).not.toContain('ManagerScaleContainer');
  });

  it('uses 38pt tint avatars and location plus feature summaries', () => {
    expect(teamUi).toContain('const avatar = ds.icon(38)');
    expect(teamUi).toContain('backgroundColor: color.tint');
    expect(team).toContain('`${locationSummary} · ${');
    expect(teamUi).not.toContain('marginBottom');
  });
});
