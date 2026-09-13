export type ListedUserRole = "manager" | "employee";

function isListedUserRole(role: unknown): role is ListedUserRole {
  return role === "manager" || role === "employee";
}

export function resolveListedUserRole(
  profileRole: unknown,
  hasProfile: boolean,
  legacyRole: unknown,
): ListedUserRole | null {
  if (isListedUserRole(profileRole)) return profileRole;
  if (hasProfile) return null;
  return isListedUserRole(legacyRole) ? legacyRole : null;
}

export function hasListedUserRole<T extends { role: ListedUserRole | null }>(
  user: T,
): user is T & { role: ListedUserRole } {
  return user.role !== null;
}
