"use client";

/**
 * The reporting chart — people, not roles.
 *
 * Workflows draws the chart of roles, which is what decides seniority: a
 * CEO outranks an AVP there. This draws the chart of people, which is
 * what decides two other things entirely.
 *
 * Who approves: a discount climbs the raiser's own line until it reaches
 * somebody holding the level the band names, so two area managers under
 * different AVPs send the same discount to different desks.
 *
 * Who sees what: a manager sees the work of everybody beneath them and
 * nobody else's. Lucky's area managers are not Leo's, and neither can see
 * into the other's branch.
 *
 * Both read one field - who a person reports to - so that is what this
 * screen edits. There is no second chart to keep in step with the first.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { FiUsers } from "react-icons/fi";

import PageHeader from "@/components/ui/PageHeader";
import { ListPage, ListToolbar } from "@/components/crm/ListPageShell";
import Button from "@/components/ui/Button";
import { getUsersApi, updateUserApi, User } from "@/features/users/api/users.api";
import { useUIStore } from "@/lib/store/ui.store";
import { useAuthStore } from "@/features/auth/store/auth.store";

/** One place on the chart: usually one person, or several managers at the
    same level who share someone beneath them (two Directors over the
    Founder), drawn side by side over their combined line. */
interface Node {
  members: User[];
  reports: Node[];
}

function fullName(user: User) {
  return `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.email;
}

/** The forest: everybody, hung off whoever they report to.
 *
 * Someone who also reports to other managers (Users > Also Reports To)
 * joins those managers into one group when they all stand at the same
 * place - the same manager above them, or all at the top. Managers in
 * different parts of the chart are not merged; the person stays under
 * their main manager and their card says who else they report to. */
function buildTree(users: User[]): Node[] {
  const byId = new Map(users.map((u) => [String(u.id), u]));
  const parentOf = (u: User) => (u.reports_to_id && byId.has(String(u.reports_to_id)) ? String(u.reports_to_id) : "");

  // Which people share a place: a small union-find over user ids.
  const leader = new Map<string, string>();
  const find = (id: string): string => {
    const up = leader.get(id) ?? id;
    if (up === id) return id;
    const top = find(up);
    leader.set(id, top);
    return top;
  };
  for (const u of users) {
    const managers = [u.reports_to_id, ...(u.also_reports_to_ids || [])]
      .map((id) => (id ? String(id) : ""))
      .filter((id, i, all) => id && byId.has(id) && all.indexOf(id) === i);
    if (managers.length < 2) continue;
    const place = parentOf(byId.get(managers[0])!);
    if (managers.every((id) => parentOf(byId.get(id)!) === place)) {
      managers.slice(1).forEach((id) => leader.set(find(id), find(managers[0])));
    }
  }

  const nodes = new Map<string, Node>();
  const nodeOf = (id: string) => {
    const key = find(id);
    if (!nodes.has(key)) nodes.set(key, { members: [], reports: [] });
    return nodes.get(key)!;
  };
  for (const u of users) nodeOf(String(u.id)).members.push(u);

  const roots: Node[] = [];
  const placed = new Set<Node>();
  for (const u of users) {
    const node = nodeOf(String(u.id));
    if (placed.has(node)) continue;
    placed.add(node);
    const parentId = parentOf(node.members[0]);
    const parent = parentId ? nodeOf(parentId) : undefined;

    /* Somebody whose manager is not on file hangs at the top rather than
       vanishing: a chart that quietly drops people is worse than one that
       shows an odd shape. */
    if (parent && parent !== node) {
      parent.reports.push(node);
    } else {
      roots.push(node);
    }
  }

  const label = (n: Node) => fullName(n.members[0]);
  const sort = (list: Node[]) => {
    list.forEach((n) => n.members.sort((a, b) => fullName(a).localeCompare(fullName(b))));
    list.sort((a, b) => label(a).localeCompare(label(b)));
    list.forEach((child) => sort(child.reports));
  };

  sort(roots);

  return roots;
}

/** Everybody at or beneath this place, so nobody can report into their own line. */
function subtreeIds(node: Node): Set<string> {
  const ids = new Set<string>(node.members.map((m) => String(m.id)));

  for (const child of node.reports) {
    for (const id of subtreeIds(child)) ids.add(id);
  }

  return ids;
}

/** One person's card, with the Reports To picker for a super admin. */
function PersonCard({
  user,
  editable,
  everyone,
  forbidden,
  onReassign,
  saving,
}: {
  user: User;
  editable: boolean;
  everyone: User[];
  forbidden: Set<string>;
  onReassign: (user: User, managerId: string) => void;
  saving: string | null;
}) {
  const roles = (user.role_names || []).join(", ");
  const inactive = user.is_active === false;
  const names = new Map(everyone.map((u) => [String(u.id), fullName(u)]));
  const also = (user.also_reports_to_ids || []).map((id) => names.get(String(id))).filter(Boolean);

  return (
    <div
      className={`w-[188px] shrink-0 rounded-xl border bg-white px-3 py-2 text-center shadow-sm dark:bg-[#071929] ${
        inactive
          ? "border-dashed border-slate-300 opacity-60 dark:border-[#17304a]"
          : "border-slate-200 dark:border-[#17304a]"
      }`}
    >
      <p className="truncate text-[12px] font-bold text-slate-800 dark:text-white">{fullName(user)}</p>

      {roles && (
        <p className="mt-0.5 truncate text-[10px] font-semibold text-[#233353] dark:text-sky-300">{roles}</p>
      )}

      <p className="mt-0.5 truncate text-[10px] text-slate-400">
        {user.designation || user.location || "—"}
        {inactive && " · inactive"}
      </p>

      {also.length > 0 && (
        <p className="mt-0.5 truncate text-[10px] text-slate-500 dark:text-slate-400" title={`Also reports to ${also.join(", ")}`}>
          Also reports to {also.join(", ")}
        </p>
      )}

      {editable && (
        <select
          aria-label={`Who ${fullName(user)} reports to`}
          disabled={saving === String(user.id)}
          value={user.reports_to_id ? String(user.reports_to_id) : ""}
          onChange={(event) => onReassign(user, event.target.value)}
          className="mt-1.5 h-6 w-full rounded border border-slate-200 bg-slate-50 px-1 text-[10px] text-slate-600 outline-none focus:border-[#233353] disabled:opacity-50 dark:border-[#17304a] dark:bg-[#0b2034] dark:text-slate-300"
        >
          <option value="">— top —</option>

          {everyone
            .filter((candidate) => !forbidden.has(String(candidate.id)))
            .map((candidate) => (
              <option key={candidate.id} value={String(candidate.id)}>
                {fullName(candidate)}
              </option>
            ))}
        </select>
      )}
    </div>
  );
}

/**
 * One person, drawn as a card with their reports beneath them.
 *
 * Top-down rather than an indented list, because this is read as a shape:
 * the sketch it comes from is four AVPs side by side under one CEO, and
 * that is the thing somebody is checking at a glance. An indented list
 * says the same and shows none of it.
 *
 * The connecting lines are borders on spacer divs rather than SVG - the
 * tree is as wide as it needs to be and scrolls, and borders reflow with
 * it where drawn coordinates would not.
 */
function Branch({
  node,
  editable,
  everyone,
  onReassign,
  saving,
}: {
  node: Node;
  editable: boolean;
  everyone: User[];
  onReassign: (user: User, managerId: string) => void;
  saving: string | null;
}) {
  const children = node.reports;

  /* Their own line is not a choice: making somebody report to their own
     report would take the whole branch off the chart. */
  const forbidden = subtreeIds(node);
  const group = node.members.length > 1;

  return (
    <div className="flex flex-col items-center">
      {group ? (
        /* Managers at the same level, side by side, joined by one bracket
           that runs down to the people they share. */
        <div className="flex items-start" role="group" aria-label={`Shared managers: ${node.members.map(fullName).join(", ")}`}>
          {node.members.map((member, index) => {
            const first = index === 0;
            const last = index === node.members.length - 1;
            return (
              <div key={String(member.id)} className="flex flex-col items-center">
                <div className="px-1.5">
                  <PersonCard user={member} editable={editable} everyone={everyone} forbidden={forbidden}
                    onReassign={onReassign} saving={saving} />
                </div>
                <div className="flex h-5 w-full items-end">
                  <div className={`h-px flex-1 ${!first ? "bg-slate-300 dark:bg-[#17304a]" : ""}`} />
                  <div className="h-5 w-px bg-slate-300 dark:bg-[#17304a]" />
                  <div className={`h-px flex-1 ${!last ? "bg-slate-300 dark:bg-[#17304a]" : ""}`} />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <PersonCard user={node.members[0]} editable={editable} everyone={everyone} forbidden={forbidden}
          onReassign={onReassign} saving={saving} />
      )}

      {children.length > 0 && (
        <>
          {/* Down out of the parent. */}
          <div className="h-5 w-px bg-slate-300 dark:bg-[#17304a]" />

          <div className="flex items-start">
            {children.map((child, index) => {
              const first = index === 0;
              const last = index === children.length - 1;
              const only = children.length === 1;

              return (
                <div key={String(child.members[0].id)} className="flex flex-col items-center">
                  {/* The horizontal rail: half-width stubs on the outer
                      children so it starts and stops at the cards rather
                      than hanging past them. */}
                  <div className="flex h-5 w-full items-start">
                    <div
                      className={`h-px flex-1 ${
                        !only && !first ? "bg-slate-300 dark:bg-[#17304a]" : ""
                      }`}
                    />
                    <div className="h-5 w-px bg-slate-300 dark:bg-[#17304a]" />
                    <div
                      className={`h-px flex-1 ${
                        !only && !last ? "bg-slate-300 dark:bg-[#17304a]" : ""
                      }`}
                    />
                  </div>

                  <div className="px-2">
                    <Branch
                      node={child}
                      editable={editable}
                      everyone={everyone}
                      onReassign={onReassign}
                      saving={saving}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export default function HierarchyPage() {
  const { addToast } = useUIStore();

  /* The chart is maintained by the super admin; everyone else reads it. */
  const superAdmin = useAuthStore((state) => state.user?.is_super_admin === true);

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const page = await getUsersApi(1, 500);
      setUsers(page.data);
    } catch (error) {
      console.error(error);
      addToast("Could not load the reporting chart.", "error");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    load();
  }, [load]);

  const term = search.trim().toLowerCase();

  /* Searching narrows to the people who match and everybody above them,
     so a result is never shown adrift from the line it sits in. */
  const shown = useMemo(() => {
    if (!term) return users;

    const byId = new Map(users.map((u) => [String(u.id), u]));
    const keep = new Set<string>();

    for (const user of users) {
      const hit = [fullName(user), user.email, user.location, (user.role_names || []).join(" ")]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(term));

      if (!hit) continue;

      // Everybody above them, through every manager they report to.
      const queue: User[] = [user];
      while (queue.length) {
        const walker = queue.pop()!;
        if (keep.has(String(walker.id))) continue;
        keep.add(String(walker.id));
        for (const id of [walker.reports_to_id, ...(walker.also_reports_to_ids || [])]) {
          const above = id ? byId.get(String(id)) : undefined;
          if (above) queue.push(above);
        }
      }
    }

    return users.filter((user) => keep.has(String(user.id)));
  }, [users, term]);

  const tree = useMemo(() => buildTree(shown), [shown]);

  const reassign = async (user: User, managerId: string) => {
    setSaving(String(user.id));

    try {
      await updateUserApi(String(user.id), {
        first_name: user.first_name,
        last_name: user.last_name,
        phone_number: user.phone_number || "",
        employee_id: user.employee_id || "",
        location: user.location || "",
        role_ids: user.role_ids || [],
        company_ids: user.company_ids || [],
        reports_to_id: managerId || null,
      });

      addToast(`${fullName(user)} moved.`, "success");

      await load();
    } catch (error) {
      const detail =
        (error as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "That move could not be saved.";
      addToast(detail, "error");
    } finally {
      setSaving(null);
    }
  };

  return (
    <ListPage>
      <PageHeader
        title="Reporting Chart"
        description="Who reports to whom. A discount climbs this line until it reaches the level that can sign it, and a manager sees the work of everybody beneath them and nobody else's. Someone with two managers at the same level (two Directors over the Founder) shows both side by side: set it under Users with Also Reports To."
      />

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        placeholder="Search by name, role or location"
        trailing={
          <Button variant="outline" onClick={load} disabled={loading}>
            Refresh
          </Button>
        }
      />

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-4 dark:border-[#0d2336] dark:bg-[#051422]">
        {loading ? (
          <p className="py-10 text-center text-xs text-slate-400">
            Loading the chart...
          </p>
        ) : tree.length === 0 ? (
          <div className="flex flex-col items-center gap-1 py-12 text-center">
            <FiUsers size={18} className="text-slate-300" />
            <p className="text-xs font-semibold text-slate-500">
              Nobody to show
            </p>
            <p className="text-[11px] text-slate-400">
              {term ? "No one matches that search." : "No users on file yet."}
            </p>
          </div>
        ) : (
          <>
            {/* Several roots are normal: anybody whose manager is not on
                file stands at the top of their own tree rather than
                vanishing. They sit side by side and the whole thing
                scrolls, because an org chart is wider than a screen. */}
            <div className="flex min-w-max items-start gap-10 px-2 pb-2">
              {tree.map((node) => (
                <Branch
                  key={String(node.members[0].id)}
                  node={node}
                  editable={superAdmin}
                  everyone={users}
                  onReassign={reassign}
                  saving={saving}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {!superAdmin && (
        <p className="mt-2 text-[11px] text-slate-400">
          Read-only. The reporting chart is maintained by a super admin.
        </p>
      )}
    </ListPage>
  );
}
