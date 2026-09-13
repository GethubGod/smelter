/**
 * The token values are transcribed from the approved contract at
 * docs/mockups/ui-contract/index.html. These assertions are the transcription
 * check: if someone edits a token, this test tells them the contract moved and
 * the HTML has to move with it.
 */
/* A jest.mock factory may only `require`; an import would hoist above the mock. */
/* eslint-disable @typescript-eslint/no-require-imports */
jest.mock('react-native', () => require('./nativeMocks').reactNative());
/* eslint-enable @typescript-eslint/no-require-imports */

// The react-native stub must land before the tokens load.
/* eslint-disable import/first */
import {
  auth,
  color,
  radius,
  size,
  space,
  statusTone,
  typeScale,
  weight,
} from '@/theme/tokens';
/* eslint-enable import/first */

it('matches the contract palette', () => {
  expect(color).toMatchObject({
    page: '#F3F3F1',
    card: '#FFFFFF',
    well: '#EAEAE8',
    hairline: 'rgba(0, 0, 0, 0.05)',
    accent: '#E84D38',
    tint: '#FBEAE7',
    alert: '#C03520',
    ink: '#1A1A1A',
    ink2: '#5F5F5F',
    ink3: '#9C9890',
    disabled: '#C9C5BC',
    good: '#22883E',
    warning: '#B45309',
  });
});

it('matches the contract auth palette', () => {
  expect(auth).toMatchObject({
    bg: '#F3F3F1',
    text: '#1A1A1A',
    dim: '#5F5F5F',
    faint: '#9C9890',
    well: '#FFFFFF',
    wellFocus: '#1A1A1A',
    wellError: '#C03520',
    disabled: '#C9C5BC',
    hair: 'rgba(0, 0, 0, 0.10)',
  });
});

it('keeps the contract type sizes and three weights', () => {
  expect(typeScale).toEqual({
    display: 30,
    title: 20,
    body: 15,
    secondary: 13,
    caption: 11,
    meta: 12,
    option: 16,
    link: 14,
  });
  expect(Object.values(weight).sort()).toEqual(['400', '600', '700']);
});

it('keeps four radii and the spacing grid', () => {
  expect(radius).toEqual({ pill: 999, card: 22, control: 14, sheet: 30 });
  expect(Object.values(space)).toEqual([4, 8, 12, 16, 20, 24, 32]);
});

it('keeps the auth sheet grabber distinct from the shared sheet grabber', () => {
  expect(size.sheetHandleHeight).toBe(4);
  expect(size.authSheetHandleHeight).toBe(5);
});

it('reserves the status colours for the five order states', () => {
  expect(Object.keys(statusTone)).toEqual([
    'draft',
    'submitted',
    'processing',
    'fulfilled',
    'cancelled',
  ]);
  expect(statusTone.fulfilled).toEqual({
    background: color.goodBg,
    text: color.good,
    label: 'Fulfilled',
  });
  expect(statusTone.cancelled).toEqual({
    background: color.alertBg,
    text: color.alert,
    label: 'Cancelled',
  });
  // Status colours never leak into the action colour.
  const statusValues = Object.values(statusTone).map((tone) => tone.text);
  expect(statusValues).not.toContain(color.accent);
});
