import fs from 'fs';
import path from 'path';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

describe('user management module visibility', () => {
  const screen = read('../app/(manager)/manager-settings/user-management.tsx');

  it('filters hidden modules from manager-editable rows while retaining the shared contract', () => {
    expect(screen).toContain("'ordering_advanced'");
    expect(screen).toContain("'stock_check'");
    expect(screen).toContain('!HIDDEN_MANAGER_TOGGLE_KEYS.has(moduleKey)');
    expect(screen).toContain('getManageableModuleKeys(item.role).filter(');
    expect(screen).toContain('value={loadedModules[moduleKey]}');
    expect(screen).toContain('setUserModule(targetUser.id, moduleKey, nextEnabled)');
  });
});
