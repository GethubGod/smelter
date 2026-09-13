// @ts-nocheck
import { parseWorkspaceRequest } from './validator.ts';

Deno.test('valid payload with all fields passes validation', () => {
  const input = {
    fullName: 'Alice Waters',
    email: 'alice@chezpanisse.com',
    phone: '+1 510-548-5525',
    restaurantName: 'Chez Panisse',
    city: 'Berkeley',
    primaryCategory: 'produce',
    locationsCount: 2,
  };
  const result = parseWorkspaceRequest(input);
  if (!result.ok || result.isHoneypot) {
    throw new Error(`Expected valid result, got: ${JSON.stringify(result)}`);
  }
  if (result.value.fullName !== 'Alice Waters') {
    throw new Error(`Unexpected fullName: ${result.value.fullName}`);
  }
  if (result.value.email !== 'alice@chezpanisse.com') {
    throw new Error(`Unexpected email: ${result.value.email}`);
  }
  if (result.value.primaryCategory !== 'produce') {
    throw new Error(`Unexpected primaryCategory: ${result.value.primaryCategory}`);
  }
  if (result.value.locationsCount !== 2) {
    throw new Error(`Unexpected locationsCount: ${result.value.locationsCount}`);
  }
});

Deno.test('valid payload with only required fields uses defaults and snake_case', () => {
  const input = {
    full_name: '  Bob Smith  ',
    email: 'Bob.Smith@Domain.COM  ',
    restaurant_name: '  Bob Diner  ',
  };
  const result = parseWorkspaceRequest(input);
  if (!result.ok || result.isHoneypot) {
    throw new Error(`Expected valid result, got: ${JSON.stringify(result)}`);
  }
  if (result.value.fullName !== 'Bob Smith') {
    throw new Error(`Expected trimmed full name, got: ${result.value.fullName}`);
  }
  if (result.value.email !== 'bob.smith@domain.com') {
    throw new Error(`Expected trimmed lowercased email, got: ${result.value.email}`);
  }
  if (result.value.restaurantName !== 'Bob Diner') {
    throw new Error(`Expected trimmed restaurant name, got: ${result.value.restaurantName}`);
  }
  if (result.value.phone !== null) {
    throw new Error(`Expected null phone, got: ${result.value.phone}`);
  }
  if (result.value.city !== null) {
    throw new Error(`Expected null city, got: ${result.value.city}`);
  }
  if (result.value.primaryCategory !== null) {
    throw new Error(`Expected null primaryCategory, got: ${result.value.primaryCategory}`);
  }
  if (result.value.locationsCount !== 1) {
    throw new Error(`Expected default locationsCount = 1, got: ${result.value.locationsCount}`);
  }
});

Deno.test('honeypot field website flags honeypot and bypasses errors', () => {
  const input = {
    website: 'https://spam-bot.example.com',
    fullName: '', // would normally fail
  };
  const result = parseWorkspaceRequest(input);
  if (!result.ok || !result.isHoneypot) {
    throw new Error(`Expected honeypot flagged, got: ${JSON.stringify(result)}`);
  }
});

Deno.test('empty honeypot field does not flag honeypot', () => {
  const input = {
    website: '   ',
    fullName: 'Charlie',
    email: 'charlie@example.com',
    restaurantName: 'Charlie Cafe',
  };
  const result = parseWorkspaceRequest(input);
  if (!result.ok || result.isHoneypot) {
    throw new Error(`Expected valid request, got: ${JSON.stringify(result)}`);
  }
});

Deno.test('missing required fields fail validation', () => {
  const missingName = parseWorkspaceRequest({ email: 'a@b.com', restaurantName: 'Rest' });
  if (missingName.ok || missingName.error !== 'Full name is required') {
    throw new Error(`Expected missing name error, got: ${JSON.stringify(missingName)}`);
  }

  const missingEmail = parseWorkspaceRequest({ fullName: 'Name', restaurantName: 'Rest' });
  if (missingEmail.ok || missingEmail.error !== 'Email is required') {
    throw new Error(`Expected missing email error, got: ${JSON.stringify(missingEmail)}`);
  }

  const badEmail = parseWorkspaceRequest({ fullName: 'Name', email: 'not-an-email', restaurantName: 'Rest' });
  if (badEmail.ok || badEmail.error !== 'A valid email address is required') {
    throw new Error(`Expected bad email error, got: ${JSON.stringify(badEmail)}`);
  }

  const missingRest = parseWorkspaceRequest({ fullName: 'Name', email: 'a@b.com' });
  if (missingRest.ok || missingRest.error !== 'Restaurant name is required') {
    throw new Error(`Expected missing rest error, got: ${JSON.stringify(missingRest)}`);
  }
});

Deno.test('category and locations count validations fail on bad input', () => {
  const badCat = parseWorkspaceRequest({
    fullName: 'Name',
    email: 'a@b.com',
    restaurantName: 'Rest',
    primaryCategory: 'electronics',
  });
  if (badCat.ok || badCat.error !== 'Invalid primary category') {
    throw new Error(`Expected bad category error, got: ${JSON.stringify(badCat)}`);
  }

  const zeroCount = parseWorkspaceRequest({
    fullName: 'Name',
    email: 'a@b.com',
    restaurantName: 'Rest',
    locationsCount: 0,
  });
  if (zeroCount.ok || !zeroCount.error.includes('Locations count')) {
    throw new Error(`Expected locations count error, got: ${JSON.stringify(zeroCount)}`);
  }

  const bigCount = parseWorkspaceRequest({
    fullName: 'Name',
    email: 'a@b.com',
    restaurantName: 'Rest',
    locationsCount: 25,
  });
  if (bigCount.ok || !bigCount.error.includes('Locations count')) {
    throw new Error(`Expected locations count error, got: ${JSON.stringify(bigCount)}`);
  }
});
