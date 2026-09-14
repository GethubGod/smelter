// @ts-nocheck
import { parseWorkspaceRequest } from './validator.ts';

Deno.test('valid payload with all fields passes validation', () => {
  const input = {
    fullName: 'Alice Waters',
    email: 'alice@chezpanisse.com',
    phone: '+1 510-548-5525',
    restaurantName: 'Chez Panisse',
    city: 'Berkeley',
    website: 'https://chezpanisse.com',
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
  if (result.value.city !== 'Berkeley') {
    throw new Error(`Unexpected city: ${result.value.city}`);
  }
  if (result.value.website !== 'https://chezpanisse.com') {
    throw new Error(`Unexpected website: ${result.value.website}`);
  }
  if (result.value.primaryCategory !== 'produce') {
    throw new Error(`Unexpected primaryCategory: ${result.value.primaryCategory}`);
  }
  if (result.value.locationsCount !== 2) {
    throw new Error(`Unexpected locationsCount: ${result.value.locationsCount}`);
  }
});

Deno.test('valid payload with required fields uses defaults and snake_case', () => {
  const input = {
    full_name: '  Bob Smith  ',
    email: 'Bob.Smith@Domain.COM  ',
    restaurant_name: '  Bob Diner  ',
    city: '  Austin  ',
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
  if (result.value.city !== 'Austin') {
    throw new Error(`Expected trimmed city, got: ${result.value.city}`);
  }
  if (result.value.phone !== null) {
    throw new Error(`Expected null phone, got: ${result.value.phone}`);
  }
  if (result.value.website !== null) {
    throw new Error(`Expected null website, got: ${result.value.website}`);
  }
  if (result.value.primaryCategory !== null) {
    throw new Error(`Expected null primaryCategory, got: ${result.value.primaryCategory}`);
  }
  if (result.value.locationsCount !== 1) {
    throw new Error(`Expected default locationsCount = 1, got: ${result.value.locationsCount}`);
  }
});

Deno.test('honeypot field flags honeypot and bypasses errors', () => {
  const input = {
    hpField: 'https://spam-bot.example.com',
    fullName: '', // would normally fail
  };
  const result = parseWorkspaceRequest(input);
  if (!result.ok || !result.isHoneypot) {
    throw new Error(`Expected isHoneypot true, got: ${JSON.stringify(result)}`);
  }
});

Deno.test('invalid email returns clear validation error', () => {
  const input = {
    fullName: 'David',
    email: 'not-an-email',
    restaurantName: 'Test Place',
    city: 'San Francisco',
  };
  const result = parseWorkspaceRequest(input);
  if (result.ok) {
    throw new Error('Expected validation error for bad email');
  }
  if (!result.error.toLowerCase().includes('email')) {
    throw new Error(`Expected email error message, got: ${result.error}`);
  }
});

Deno.test('missing city returns validation error', () => {
  const input = {
    fullName: 'David',
    email: 'david@example.com',
    restaurantName: 'Test Place',
    city: '',
  };
  const result = parseWorkspaceRequest(input);
  if (result.ok) {
    throw new Error('Expected validation error for missing city');
  }
  if (!result.error.toLowerCase().includes('city')) {
    throw new Error(`Expected city error message, got: ${result.error}`);
  }
});

Deno.test('locationsCount must be between 1 and 20', () => {
  const badInputs = [0, 21, -1, 1.5, 'abc'];
  for (const count of badInputs) {
    const result = parseWorkspaceRequest({
      fullName: 'David',
      email: 'david@example.com',
      restaurantName: 'Test Place',
      city: 'Portland',
      locationsCount: count,
    });
    if (result.ok) {
      throw new Error(`Expected failure for locationsCount=${count}`);
    }
  }

  const goodResult = parseWorkspaceRequest({
    fullName: 'David',
    email: 'david@example.com',
    restaurantName: 'Test Place',
    city: 'Seattle',
    locationsCount: 20,
  });
  if (!goodResult.ok || goodResult.value.locationsCount !== 20) {
    throw new Error('Expected 20 to be accepted');
  }
});
