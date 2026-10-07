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
import { FiChevronRight, FiUser, FiUsers } from "react-icons/fi";

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

function Branch({
  node,
  depth,
  editable,
  everyone,
  onReassign,
  saving,
}: {
  node: Node;
  depth: number;
  editable: boolean;
  everyone: User[];
  onReassign: (user: User, managerId: string) => void;
  saving: string | null;
}) {
  const [open, setOpen] = useState(true);
  const roles = (node.user.role_names || []).join(", ");

  /* Their own line is not a choice: making somebody report to their own
     report would take the whole branch off the chart. */
  const forbidden = subtreeIds(node);

  return (
    <div>
      <div
        className="flex items-center gap-2 border-b border-slate-100 py-2 dark:border-[#0d2336]"
        style={{ paddingLeft: `${depth * 26}px` }}
      >
        <button
          type="button"
          onClick={() => setOpen((previous) => !previous)}
          aria-label={open ? `Collapse ${fullName(node.user)}` : `Expand ${fullName(node.user)}`}
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 dark:hover:bg-[#0d2336] ${
            node.reports.length ? "" : "invisible"
          }`}
        >
          <FiChevronRight
            size={13}
            className={`transition-transform ${open ? "rotate-90" : ""}`}
          />
        </button>

        <FiUser size={13} className="shrink-0 text-slate-400" />

        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-slate-800 dark:text-white">
          {fullName(node.user)}

          {roles && (
            <span className="ml-2 text-[11px] font-normal text-slate-400">
              {roles}
            </span>
          )}

          {node.user.location && (
            <span className="ml-2 text-[11px] font-normal text-slate-400">
              · {node.user.location}
            </span>
          )}
        </span>

        {node.reports.length > 0 && (
          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-[#0d2336]">
            {node.reports.length}
          </span>
        )}

        {editable ? (
          <select
            aria-label={`Who ${fullName(node.user)} reports to`}
            disabled={saving === String(node.user.id)}
            value={node.user.reports_to_id ? String(node.user.reports_to_id) : ""}
            onChange={(event) => onReassign(node.user, event.target.value)}
            className="h-8 w-48 shrink-0 rounded-md border border-slate-200 bg-white px-2 text-[11px] text-slate-700 outline-none focus:border-[#233353] disabled:opacity-50 dark:border-[#17304a] dark:bg-[#071929] dark:text-white"
          >
            <option value="">— top of the chart —</option>

            {everyone
              .filter((candidate) => !forbidden.has(String(candidate.id)))
              .map((candidate) => (
                <option key={candidate.id} value={String(candidate.id)}>
                  {fullName(candidate)}
                </option>
              ))}
          </select>
        ) : (
          <span className="w-48 shrink-0 text-right text-[11px] text-slate-400">
            {node.user.reports_to_name || "—"}
          </span>
        )}
      </div>

      {open &&
        node.reports.map((child) => (
          <Branch
            key={String(child.user.id)}
            node={child}
            depth={depth + 1}
            editable={editable}
            everyone={everyone}
            onReassign={onReassign}
            saving={saving}
          />
        ))}
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

      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-[#0d2336] dark:bg-[#051422]">
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
            <div className="mb-1 flex items-center justify-between border-b border-slate-200 pb-2 dark:border-[#17304a]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Person
              </span>
              <span className="w-48 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Reports to
              </span>
            </div>

            {tree.map((node) => (
              <Branch
                key={String(node.user.id)}
                node={node}
                depth={0}
                editable={superAdmin}
                everyone={users}
                onReassign={reassign}
                saving={saving}
              />
            ))}
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
