import { hasListedUserRole, resolveListedUserRole } from "./user-role.ts";

Deno.test("canonical role-null profiles are excluded from team results", () => {
  const role = resolveListedUserRole(null, true, "employee");

  if (role !== null || hasListedUserRole({ role })) {
    throw new Error(
      "Expected an unaffiliated canonical profile to be excluded",
    );
  }
});

Deno.test("legacy users without profiles retain their role fallback", () => {
  const role = resolveListedUserRole(undefined, false, "employee");

  if (role !== "employee" || !hasListedUserRole({ role })) {
    throw new Error("Expected the legacy role fallback to remain listed");
  }
});
