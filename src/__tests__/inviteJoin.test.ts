import {
  classifyInviteFailure,
  describeInviteFailure,
  parseJoinToken,
} from '@/services/inviteLinks';

const token = 'invite_token_1234567890ab';

describe('parseJoinToken', () => {
  it('parses the canonical deep link babytunasystems://join?token=…', () => {
    expect(parseJoinToken(`babytunasystems://join?token=${token}`)).toBe(token);
  });

  it('parses the triple-slash variant babytunasystems:///join?token=…', () => {
    expect(parseJoinToken(`babytunasystems:///join?token=${token}`)).toBe(token);
  });

  it('parses a path-style deep link babytunasystems://join/<token>', () => {
    expect(parseJoinToken(`babytunasystems://join/${token}`)).toBe(token);
  });

  it('parses the public web link https://tips.babytunasystems.com/join/<token>', () => {
    expect(parseJoinToken(`https://tips.babytunasystems.com/join/${token}`)).toBe(
      token
    );
  });

  it('accepts bare tokens and both production web hosts', () => {
    expect(parseJoinToken(token)).toBe(token);
    expect(parseJoinToken(`https://smelterpos.com/join/${token}`)).toBe(token);
  });

  it('trims whitespace around the URL and the token', () => {
    expect(parseJoinToken(`  babytunasystems://join?token=${token}  `)).toBe(token);
    expect(parseJoinToken(`babytunasystems://join?token=%20${token}%20`)).toBe(token);
  });

  it('returns null for join links without a token', () => {
    expect(parseJoinToken('babytunasystems://join')).toBeNull();
    expect(parseJoinToken('babytunasystems://join?token=')).toBeNull();
    expect(parseJoinToken('https://tips.babytunasystems.com/join')).toBeNull();
  });

  it('returns null for non-join URLs', () => {
    expect(parseJoinToken('babytunasystems://auth/callback?code=x')).toBeNull();
    expect(parseJoinToken('https://tips.babytunasystems.com/e/somewhere')).toBeNull();
    expect(parseJoinToken('https://example.com/join/tok')).toBeNull();
    expect(parseJoinToken(`otherapp://join?token=${token}`)).toBeNull();
    expect(parseJoinToken('babytunasystems://join?token=short')).toBeNull();
  });

  it('returns null for garbage input', () => {
    expect(parseJoinToken('not a url')).toBeNull();
    expect(parseJoinToken('')).toBeNull();
    expect(parseJoinToken(null)).toBeNull();
    expect(parseJoinToken(undefined)).toBeNull();
  });
});

describe('classifyInviteFailure', () => {
  it('detects used invites', () => {
    expect(classifyInviteFailure('Invite has already been used')).toBe('used');
  });

  it('detects revoked invites', () => {
    expect(classifyInviteFailure('This invite was revoked by a manager')).toBe('revoked');
  });

  it('detects expired invites', () => {
    expect(classifyInviteFailure('Invite expired')).toBe('expired');
    expect(classifyInviteFailure('past its expiry window')).toBe('expired');
  });

  it('falls back to invalid for unknown or missing messages', () => {
    expect(classifyInviteFailure('Invite not found')).toBe('invalid');
    expect(classifyInviteFailure(null)).toBe('invalid');
    expect(classifyInviteFailure(undefined)).toBe('invalid');
  });
});

describe('describeInviteFailure', () => {
  it('always tells the user to ask their manager for a new link', () => {
    (['used', 'expired', 'revoked', 'invalid'] as const).forEach((reason) => {
      expect(describeInviteFailure(reason)).toContain('Ask your manager for a new one');
    });
  });

  it('names the specific failure', () => {
    expect(describeInviteFailure('used')).toContain('already used');
    expect(describeInviteFailure('expired')).toContain('expired');
    expect(describeInviteFailure('revoked')).toContain('revoked');
  });
});
