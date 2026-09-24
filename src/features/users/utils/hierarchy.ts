import { Role } from "@/features/rbac/api/rbac.api";
import { User } from "@/features/users/api/users.api";

/* The reporting hierarchy, as the Reports To picker needs it.

   The chart drawn on the Workflows page gives every role a level, 1 at the
   top: CEO 1, AVP 2, Zonal Head 3, Area Manager 4. Together with Reports To
   it decides whose records each manager sees - a Zonal Head sees the Area
   Managers reporting to them and not another Zonal Head's. The backend
   enforces the same rule; this only keeps impossible choices off the list. */

/** The most senior level among these roles, or null when none is charted. */
export function topLevel(roleIds: string[], roles: Role[]): number | null {
  const levels = roleIds
    .map((id) => roles.find((r) => r.id === id)?.level)
    .filter((level): level is number => typeof level === "number");

  return levels.length ? Math.min(...levels) : null;
}

/** "Priya Nair (Zonal Head)" - the name, and the role placing them. */
export function userLabel(user: User, roles: Role[]): string {
  const name = `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.email;

  const roleName = user.is_super_admin
    ? "Super Admin"
    : user.role_names?.[0] ||
      roles.find((r) => user.role_ids?.includes(r.id))?.name;

  return roleName ? `${name} (${roleName})` : name;
}

/**
 * The users who may be picked as manager for someone holding `roleIds`.
 *
 * Only people above them in the hierarchy qualify, plus super admins, who
 * sit outside the chart. Until a role is chosen there is nothing to compare
 * against, so everyone is offered and the backend has the final say.
 */
export function eligibleManagers(
  candidates: User[],
  roleIds: string[],
  roles: Role[],
  excludeUserId?: string,
): User[] {
  const level = topLevel(roleIds, roles);
  const pool = candidates.filter((u) => u.id !== excludeUserId);

  if (level === null) return pool;

  return pool.filter((u) => {
    if (u.is_super_admin) return true;

    const theirs = topLevel(u.role_ids || [], roles);
    return theirs !== null && theirs < level;
  });
}
