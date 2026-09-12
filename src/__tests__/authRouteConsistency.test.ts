import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = (path: string) => readFileSync(resolve(__dirname, '../..', path), 'utf8');

describe('sign-in route consistency', () => {
  test('returning from sign-up uses the same sign-in route as welcome', () => {
    const welcome = source('src/features/auth/WelcomeScreen.tsx');
    const signup = source('app/(auth)/signup.tsx');
    expect(welcome).toContain("router.push('/(auth)/sign-in'");
    expect(signup).toContain('<Link href="/(auth)/sign-in"');
  });

  test('the old login URL redirects instead of rendering a second sign-in form', () => {
    const login = source('app/(auth)/login.tsx');
    expect(login).toContain('<Redirect');
    expect(login).toContain("pathname: '/(auth)/sign-in'");
    expect(login).not.toContain('<Input');
  });
});
