// Employee invite defaults parsing (the app_config JSON row folded over the
// built-in seed values).

import fs from 'fs';
import path from 'path';
import {
  EMPLOYEE_DEFAULT_KEYS,
  getBuiltInEmployeeDefaults,
  parseEmployeeDefaults,
  setEmployeeInviteDefaults,
} from '@/services/employeeDefaults';

const mockRpc = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));

const migration = fs.readFileSync(
  path.join(
    __dirname,
    '../../supabase/migrations/20260912235714_ui_studio_hidden_module_defaults.sql',
  ),
  'utf8',
);

beforeEach(() => {
  mockRpc.mockReset();
});

describe('parseEmployeeDefaults', () => {
  it('mirrors the migration seed row in its built-ins', () => {
    expect(getBuiltInEmployeeDefaults()).toEqual({
      ordering_simple: true,
      ordering_advanced: false,
      stock_check: false,
      tips: false,
    });
  });

  it('folds editable stored booleans over the built-ins', () => {
    expect(
      parseEmployeeDefaults({
        ordering_simple: false,
        ordering_advanced: true,
        stock_check: true,
        tips: true,
      }),
    ).toEqual({
      ordering_simple: false,
      ordering_advanced: false,
      stock_check: false,
      tips: true,
    });
  });

  it('does not expose hidden compatibility keys as editable defaults', () => {
    expect(EMPLOYEE_DEFAULT_KEYS).toEqual(['ordering_simple', 'tips']);
  });

  it('does not send hidden keys from the 2.4 client', async () => {
    mockRpc.mockResolvedValue({ error: null });

    await setEmployeeInviteDefaults({
      ordering_simple: false,
      ordering_advanced: true,
      stock_check: true,
      tips: true,
    });

    expect(mockRpc).toHaveBeenCalledWith('set_employee_invite_defaults', {
      p_defaults: { ordering_simple: false, tips: true },
    });
  });

  it('drops malformed entries and unknown keys', () => {
    expect(
      parseEmployeeDefaults({ ordering_simple: 'yes', fulfillment: true, junk: 1 }),
    ).toEqual(getBuiltInEmployeeDefaults());
  });

  it('returns the built-ins for a missing or non-object row', () => {
    expect(parseEmployeeDefaults(null)).toEqual(getBuiltInEmployeeDefaults());
    expect(parseEmployeeDefaults(['nope'])).toEqual(getBuiltInEmployeeDefaults());
    expect(parseEmployeeDefaults('x')).toEqual(getBuiltInEmployeeDefaults());
  });
});

describe('hidden module defaults migration', () => {
  it('defaults both compatibility modules off without deleting overrides', () => {
    expect(migration).toContain("('ordering_advanced'::text, false)");
    expect(migration).toContain("('stock_check'::text, false)");
    expect(migration).toContain("('kitchen_requests'::text, target_is_manager)");
    expect(migration).toContain("('kitchen_display'::text, target_is_manager)");
    expect(migration).toContain('left join public.user_modules as overrides');
    expect(migration).not.toContain('delete from public.user_modules');
  });

  it('preserves current invite values while forcing hidden defaults off', () => {
    expect(migration).toContain("when jsonb_typeof(config.value) = 'object'");
    expect(migration).toContain(
      `|| '{"ordering_advanced": false, "stock_check": false}'::jsonb`,
    );
  });

  it('keeps old clients accepted and preserves function authorization', () => {
    expect(migration).toContain(
      "if entry.key not in ('ordering_simple', 'ordering_advanced', 'stock_check', 'tips')",
    );
    expect(migration).toContain('if not public.current_user_is_manager() then');
    expect(migration).toContain(
      'if auth.uid() is distinct from p_user_id',
    );
    expect(migration).toContain(
      'revoke all on function public.get_effective_modules(uuid) from public, anon;',
    );
    expect(migration).toContain(
      'grant execute on function public.get_effective_modules(uuid) to authenticated;',
    );
    expect(migration).toContain(
      'revoke all on function public.set_employee_invite_defaults(jsonb) from public, anon;',
    );
    expect(migration).toContain(
      'grant execute on function public.set_employee_invite_defaults(jsonb) to authenticated, service_role;',
    );
  });
});
