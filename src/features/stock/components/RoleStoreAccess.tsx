"use client";

/**
 * Roles & Access: which stores a role works in.
 *
 * A store ticked for any role is kept for those roles: only people of those
 * roles, or given it themselves under Users, can work in it. A store ticked
 * for no role stays open to everyone of its company.
 * Only a super admin changes this; the server checks the same on every
 * stock request.
 */

import { useEffect, useMemo, useState } from "react";
import { FiCheck, FiHome } from "react-icons/fi";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import api from "@/lib/axios";
import { errorText } from "@/features/stock/components/stockUi";
import { useUIStore } from "@/lib/store/ui.store";

interface RoleStore {
  id: string;
  location_name: string;
  location_code: string;
  company_id: string;
  company_name?: string | null;
  is_active: boolean;
  given: boolean;
  kept: boolean;
}

const QUIET = { skipErrorToast: true };

export default function RoleStoreAccess({ roleId, roleName, canManage }: { roleId: string; roleName?: string; canManage: boolean }) {
  const { addToast } = useUIStore();
  const [stores, setStores] = useState<RoleStore[] | null>(null);
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let current = true;
    setStores(null);
    setError(null);
    api
      .get(`/api/v1/rbac/roles/${roleId}/warehouses`, QUIET)
      .then(({ data }) => {
        if (!current) return;
        const rows: RoleStore[] = data.data || [];
        setStores(rows);
        setTicked(new Set(rows.filter((s) => s.given).map((s) => s.id)));
      })
      .catch((err: unknown) => {
        if (current) setError(errorText(err, "Could not load the stores."));
      });
    return () => {
      current = false;
    };
  }, [roleId]);

  const saved = useMemo(() => new Set((stores || []).filter((s) => s.given).map((s) => s.id)), [stores]);
  const dirty = ticked.size !== saved.size || [...ticked].some((id) => !saved.has(id));

  /* Stores grouped under their company, as the company is the place. */
  const byCompany = useMemo(() => {
    const groups = new Map<string, RoleStore[]>();
    for (const s of stores || []) {
      const key = s.company_name || "Company";
      groups.set(key, [...(groups.get(key) || []), s]);
    }
    return [...groups.entries()];
  }, [stores]);

  const toggle = (id: string) =>
    setTicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const save = async () => {
    try {
      setSaving(true);
      const { data } = await api.put(`/api/v1/rbac/roles/${roleId}/warehouses`, { warehouse_ids: [...ticked] }, QUIET);
      const rows: RoleStore[] = data.data || [];
      setStores(rows);
      setTicked(new Set(rows.filter((s) => s.given).map((s) => s.id)));
      addToast(`Store access saved for ${roleName || "the role"}.`, "success");
    } catch (err: unknown) {
      addToast(errorText(err, "Could not save store access."), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card
      title={
        <div className="flex w-full flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="space-y-0.5">
            <h3 className="flex items-center gap-2 text-base font-bold text-slate-800 dark:text-white">
              <FiHome className="text-lg text-[#233353] dark:text-sky-400" />
              <span>Store Access</span>
            </h3>
            <p className="text-xs font-semibold text-[#233353] dark:text-sky-400">Target Role: {roleName || "-"}</p>
          </div>
          {canManage && (
            <Button size="sm" icon={<FiCheck />} loading={saving} disabled={!dirty || saving} onClick={save}>
              Save Store Access
            </Button>
          )}
        </div>
      }
    >
      <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
        Tick the stores this role works in. A store ticked for any role is kept for those roles (people can also be given it
        under Users); a store ticked for no role is open to everyone of its company.
      </p>
      {error ? (
        <p role="alert" className="text-sm text-rose-600">
          {error}
        </p>
      ) : stores === null ? (
        <p className="text-xs text-slate-400">Loading stores...</p>
      ) : stores.length === 0 ? (
        <p className="text-xs text-slate-400">No stores yet. Add one under Masters &gt; Locations.</p>
      ) : (
        <div className="space-y-4">
          {byCompany.map(([company, rows]) => (
            <div key={company} className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{company}</p>
              {rows.map((s) => {
                const on = ticked.has(s.id);
                return (
                  <label
                    key={s.id}
                    className={`flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-2.5 dark:border-[#0d2336] ${
                      canManage ? "cursor-pointer hover:bg-slate-50/50 dark:hover:bg-[#071929]/30" : "cursor-not-allowed opacity-60"
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-[#233353]"
                        checked={on}
                        disabled={!canManage}
                        onChange={() => toggle(s.id)}
                      />
                      <span>
                        <span className="block text-xs font-bold text-slate-800 dark:text-white">{s.location_name}</span>
                        <span className="font-mono text-[10px] text-slate-400">{s.location_code}</span>
                      </span>
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        on
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : s.kept
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            : "bg-slate-100 text-slate-500 dark:bg-[#071929]"
                      }`}
                    >
                      {on ? "This role" : s.kept ? "Kept for others" : "Open to company"}
                    </span>
                  </label>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
