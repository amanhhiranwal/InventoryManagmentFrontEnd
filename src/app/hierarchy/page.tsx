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

interface Node {
  user: User;
  reports: Node[];
}

function fullName(user: User) {
  return `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.email;
}

/** The forest: everybody, hung off whoever they report to. */
function buildTree(users: User[]): Node[] {
  const nodes = new Map<string, Node>();

  for (const user of users) {
    nodes.set(String(user.id), { user, reports: [] });
  }

  const roots: Node[] = [];

  for (const user of users) {
    const node = nodes.get(String(user.id))!;
    const parent = user.reports_to_id
      ? nodes.get(String(user.reports_to_id))
      : undefined;

    /* Somebody whose manager is not on file hangs at the top rather than
       vanishing: a chart that quietly drops people is worse than one that
       shows an odd shape. */
    if (parent && parent !== node) {
      parent.reports.push(node);
    } else {
      roots.push(node);
    }
  }

  const byName = (a: Node, b: Node) =>
    fullName(a.user).localeCompare(fullName(b.user));

  const sort = (list: Node[]) => {
    list.sort(byName);
    list.forEach((child) => sort(child.reports));
  };

  sort(roots);

  return roots;
}

/** Everybody at or beneath this person, so nobody can report into their own line. */
function subtreeIds(node: Node): Set<string> {
  const ids = new Set<string>([String(node.user.id)]);

  for (const child of node.reports) {
    for (const id of subtreeIds(child)) ids.add(id);
  }

  return ids;
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
  const roles = (node.user.role_names || []).join(", ");
  const children = node.reports;

  /* Their own line is not a choice: making somebody report to their own
     report would take the whole branch off the chart. */
  const forbidden = subtreeIds(node);

  const inactive = node.user.is_active === false;

  return (
    <div className="flex flex-col items-center">
      <div
        className={`w-[188px] shrink-0 rounded-xl border bg-white px-3 py-2 text-center shadow-sm dark:bg-[#071929] ${
          inactive
            ? "border-dashed border-slate-300 opacity-60 dark:border-[#17304a]"
            : "border-slate-200 dark:border-[#17304a]"
        }`}
      >
        <p className="truncate text-[12px] font-bold text-slate-800 dark:text-white">
          {fullName(node.user)}
        </p>

        {roles && (
          <p className="mt-0.5 truncate text-[10px] font-semibold text-[#233353] dark:text-sky-300">
            {roles}
          </p>
        )}

        <p className="mt-0.5 truncate text-[10px] text-slate-400">
          {node.user.location || "—"}
          {inactive && " · inactive"}
        </p>

        {editable && (
          <select
            aria-label={`Who ${fullName(node.user)} reports to`}
            disabled={saving === String(node.user.id)}
            value={node.user.reports_to_id ? String(node.user.reports_to_id) : ""}
            onChange={(event) => onReassign(node.user, event.target.value)}
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
                <div key={String(child.user.id)} className="flex flex-col items-center">
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

      let walker: User | undefined = user;

      while (walker && !keep.has(String(walker.id))) {
        keep.add(String(walker.id));
        walker = walker.reports_to_id
          ? byId.get(String(walker.reports_to_id))
          : undefined;
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
        description="Who reports to whom. A discount climbs this line until it reaches the level that can sign it, and a manager sees the work of everybody beneath them and nobody else's."
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
                  key={String(node.user.id)}
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
