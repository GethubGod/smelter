import fs from 'fs';
import path from 'path';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

describe('manager Team detail Studio contract', () => {
  const team = read('features/team/TeamScreen.tsx');
  const detail = read('features/team/MemberDetailScreen.tsx');
  const defaults = read('features/team/DefaultsScreen.tsx');
  const invite = read('features/team/InviteScreen.tsx');

  it('matches the member detail anatomy and only exposes Checklist and Tips', () => {
    expect(detail).toContain("const DETAIL_MODULE_KEYS: readonly ModuleKey[] = ['ordering_simple', 'tips']");
    expect(detail).toContain("ordering_simple: 'Checklist ordering'");
    expect(detail).toContain("tips: 'Tips'");
    expect(detail).toContain('<TeamSectionLabel label="Works at" />');
    expect(detail).toContain('<TeamSectionLabel label="Features" />');
    expect(detail).toContain('label={`Preview as ${firstName}`}');
    expect(detail.match(/variant="secondary"/g)).toHaveLength(1);
    expect(detail).not.toContain('ordering_advanced');
    expect(detail).not.toContain('stock_check');
    expect(detail).not.toContain('ManagerScaleContainer');
  });

  it('has no PIN reset and flags legacy name logins for a new invite', () => {
    expect(detail).not.toContain('PIN');
    expect(detail).not.toContain('resetUserCredential');
    expect(detail).toContain("? 'Needs a new invite'");
    expect(detail).not.toContain('Alert.alert');
  });

  it('exposes only Checklist and Tips in defaults while preserving the stored object', () => {
    expect(defaults).toContain("{ key: 'ordering_simple', label: 'Checklist ordering' }");
    expect(defaults).toContain("{ key: 'tips', label: 'Tips' }");
    expect(defaults).toContain('const next = { ...defaults, [key]: value }');
    expect(defaults).not.toContain('ordering_advanced');
    expect(defaults).not.toContain('stock_check');
    expect(defaults).not.toContain('ManagerScaleContainer');
  });

  it('exposes only Checklist and Tips in invites while preserving the complete preset', () => {
    expect(invite).toContain("{ key: 'ordering_simple', label: 'Checklist ordering', tag: 'DEFAULT' }");
    expect(invite).toContain("{ key: 'tips', label: 'Tips' }");
    expect(invite).toContain('setToggles((current) => ({ ...current, [row.key]: value }))');
    expect(invite).toContain('modulePreset: { ...toggles }');
    expect(invite).not.toContain('ordering_advanced');
    expect(invite).not.toContain('stock_check');
    expect(invite).not.toContain('ManagerScaleContainer');
  });

  it('preserves manager origin and back context on pushed team routes', () => {
    expect(detail).toContain("pathname: '/(manager)/manager-settings/team-preview'");
    expect(detail).toContain("origin: 'manager'");
    expect(detail).toContain('backTo: String(backTo)');
    expect(invite).toContain("pathname: '/(manager)/manager-settings/team-invite-link'");
    expect(invite).toContain("origin: 'manager'");
    expect(invite).toContain('backTo: String(backTo)');
  });

  it('keeps hidden overrides out of roster and defaults summaries', () => {
    expect(team).toContain("user.role === 'manager'");
    expect(team).toContain("? 'Manager'");
    expect(team).toContain("defaults.tips ? 'Tips' : null");
    expect(team).not.toContain('Advanced ordering');
    expect(team).not.toContain('Stock check');
  });
});
