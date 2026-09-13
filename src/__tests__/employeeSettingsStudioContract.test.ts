import fs from 'fs';
import path from 'path';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

describe('employee Settings Studio contract', () => {
  const settings = read('features/employeeSettings/EmployeeSettingsScreen.tsx');

  it('keeps the reference groups, role tag, profile avatar, and footer', () => {
    expect(settings).toContain('<SectionLabel>Ordering</SectionLabel>');
    expect(settings).toContain('<SectionLabel>Help</SectionLabel>');
    expect(settings).toContain('<SectionLabel>Manager</SectionLabel>');
    expect(settings).toContain('Employee');
    expect(settings).toContain('width: ds.icon(46)');
    expect(settings).toContain('<BrandFooter name={displayName} />');
    expect(settings).not.toContain('Stock settings');
    expect(settings).not.toContain('useMyModules');
  });

  it('uses disclosure directions that match each destination', () => {
    expect(settings.match(/showChevron="down"/g)).toHaveLength(2);
    expect(settings).toContain('name="chevron-down"');
    expect(settings).toContain("switchViewMode('manager')");
  });
});

describe('employee Profile Studio contract', () => {
  const profile = read('features/employeeSettings/EmployeeProfileScreen.tsx');

  it('keeps the reference profile hierarchy and explicit Settings return path', () => {
    expect(profile).toContain("router.replace('/(tabs)/settings')");
    expect(profile).toContain('width: ds.icon(76)');
    expect(profile).toContain('<SectionLabel>Security</SectionLabel>');
    expect(profile).toContain('icon="lock-closed-outline"');
    expect(profile).toContain('icon="eye-outline"');
    expect(profile).toContain('backgroundColor: color.card');
  });

  it('uses the approved sheet copy and global success notices', () => {
    expect(profile).toContain('title="Your name"');
    expect(profile).toContain('title="Add email"');
    expect(profile).toContain("showStudioToast('Name saved')");
    expect(profile).toContain("showStudioToast('Check your inbox')");
    expect(profile).toContain('title="Delete your account?"');
    expect(profile).toContain('Type DELETE to confirm. This cannot be undone.');
    expect(profile).not.toContain('Alert.alert');
  });
});

describe('settings support components', () => {
  const rows = read('features/employeeSettings/components/SettingsCardRow.tsx');
  const about = read('features/employeeSettings/components/AboutLegalSheet.tsx');
  const signOut = read('hooks/useSignOutAction.ts');

  it('lets ListRow own the card padding and renders the delivered lockup', () => {
    const settingsCard = rows.slice(rows.indexOf('export function SettingsCard'));
    expect(settingsCard).not.toContain('paddingHorizontal');
    expect(about).toContain('<BrandLockup height={30} />');
    expect(about).toContain('subtitle={`Smelter ${appVersion} (${buildNumber})`}');
  });

  it('uses app-native notice and toast surfaces for sign out', () => {
    expect(signOut).toContain("showNotice('Sign out?'");
    expect(signOut).toContain("showStudioToast('Signed out')");
    expect(signOut).not.toContain('Alert');
    expect(signOut).not.toContain('globalThis.confirm');
  });
});
