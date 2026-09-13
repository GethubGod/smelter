export const AppleAuthenticationScope = {
  FULL_NAME: 0,
  EMAIL: 1,
} as const;

export const AppleAuthenticationOperation = {
  LOGIN: 0,
  REFRESH: 1,
  LOGOUT: 2,
  IMPLICIT: 3,
} as const;

export const isAvailableAsync = jest.fn(async () => true);
export const signInAsync = jest.fn();
