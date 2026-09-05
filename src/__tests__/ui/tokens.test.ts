/**
 * The token values are transcribed from the approved contract at
 * docs/mockups/ui-contract/index.html. These assertions are the transcription
 * check: if someone edits a token, this test tells them the contract moved and
 * the HTML has to move with it.
 */
jest.mock('react-native', () => require('./nativeMocks').reactNative());

// The react-native stub must land before the tokens load.
/* eslint-disable import/first */
import {
  auth,
  color,
  radius,
  space,
  statusTone,
  typeScale,
  weight,
} from '@/theme/tokens';
/* eslint-enable import/first */

it('matches the contract palette', () => {
  expect(color).toMatchObject({
    page: '#F5F5F4',
    card: '#FFFFFF',
    well: '#EDEDEC',
    hairline: 'rgba(0, 0, 0, 0.06)',
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
    bg: '#000000',
    text: '#FFFFFF',
    dim: 'rgba(255, 255, 255, 0.55)',
    well: 'rgba(255, 255, 255, 0.09)',
    wellBorder: 'rgba(255, 255, 255, 0.18)',
  });
});

it('keeps five type sizes and three weights', () => {
  expect(typeScale).toEqual({ display: 28, title: 20, body: 15, secondary: 13, caption: 11 });
  expect(Object.values(weight).sort()).toEqual(['400', '600', '700']);
});

it('keeps four radii and the spacing grid', () => {
  expect(radius).toEqual({ pill: 999, card: 16, control: 12, sheet: 24 });
  expect(Object.values(space)).toEqual([4, 8, 12, 16, 20, 24, 32]);
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
