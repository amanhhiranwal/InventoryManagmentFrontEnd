"use client";

/**
 * Roles & Access: which products a role sees on the Inventory list.
 *
 * Own companies (the default), every company's (to look at; changing a
 * product stays limited to the person's own companies), or only products in
 * stock at the stores the role works in (Store Access below). A person with
 * several roles gets the widest. Only a super admin changes it; the server
 * applies it to the list.
 */

import { useEffect, useState } from "react";
import { FiCheck, FiPackage } from "react-icons/fi";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import api from "@/lib/axios";
import { errorText } from "@/features/stock/components/stockUi";
import { useUIStore } from "@/lib/store/ui.store";

type Scope = "OWN_COMPANIES" | "ALL_COMPANIES" | "STORE_STOCK";

const OPTIONS: { value: Scope; label: string; hint: string }[] = [
  { value: "OWN_COMPANIES", label: "Own companies", hint: "Products of the companies on the person's profile, and shared ones." },
  { value: "ALL_COMPANIES", label: "All companies", hint: "Every company's products, to look at. Changing one stays limited to their own companies." },
  { value: "STORE_STOCK", label: "Stock at the role's stores", hint: "Only products in stock at the stores ticked under Store Access (or open to their company)." },
];

const QUIET = { skipErrorToast: true };

export default function RoleProductScope({ roleId, roleName, canManage }: { roleId: string; roleName?: string; canManage: boolean }) {
  const { addToast } = useUIStore();
  const [saved, setSaved] = useState<Scope | null>(null);
  const [chosen, setChosen] = useState<Scope | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let current = true;
    setSaved(null);
    setChosen(null);
    setError(null);
    api
      .get(`/api/v1/rbac/roles/${roleId}/product-scope`, QUIET)
      .then(({ data }) => {
        if (!current) return;
        const scope: Scope = data.data?.scope || "OWN_COMPANIES";
        setSaved(scope);
        setChosen(scope);
      })
      .catch((err: unknown) => {
        if (current) setError(errorText(err, "Could not load the products shown."));
      });
    return () => {
      current = false;
    };
  }, [roleId]);

  const save = async () => {
    if (!chosen) return;
    try {
      setSaving(true);
      const { data } = await api.put(`/api/v1/rbac/roles/${roleId}/product-scope`, { scope: chosen }, QUIET);
      setSaved(data.data.scope);
      setChosen(data.data.scope);
      addToast(`Products shown saved for ${roleName || "the role"}.`, "success");
    } catch (err: unknown) {
      addToast(errorText(err, "Could not save the products shown."), "error");
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
              <FiPackage className="text-lg text-[#233353] dark:text-sky-400" />
              <span>Products Shown</span>
            </h3>
            <p className="text-xs font-semibold text-[#233353] dark:text-sky-400">Target Role: {roleName || "-"}</p>
          </div>
          {canManage && (
            <Button size="sm" icon={<FiCheck />} loading={saving} disabled={!chosen || chosen === saved || saving} onClick={save}>
              Save Products Shown
            </Button>
          )}
        </div>
      }
    >
      <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
        Which products this role sees on the Inventory list. A person with several roles sees the widest of them.
      </p>
      {error ? (
        <p role="alert" className="text-sm text-rose-600">
          {error}
        </p>
      ) : chosen === null ? (
        <p className="text-xs text-slate-400">Loading...</p>
      ) : (
        <fieldset className="space-y-2" disabled={!canManage}>
          <legend className="sr-only">Products shown for {roleName || "the role"}</legend>
          {OPTIONS.map((option) => (
            <label
              key={option.value}
              className={`flex items-start gap-3 rounded-xl border border-slate-100 p-2.5 dark:border-[#0d2336] ${
                canManage ? "cursor-pointer hover:bg-slate-50/50 dark:hover:bg-[#071929]/30" : "cursor-not-allowed opacity-60"
              }`}
            >
              <input
                type="radio"
                name={`product-scope-${roleId}`}
                className="mt-0.5 h-4 w-4 accent-[#233353]"
                checked={chosen === option.value}
                onChange={() => setChosen(option.value)}
              />
              <span>
                <span className="block text-xs font-bold text-slate-800 dark:text-white">{option.label}</span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">{option.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>
      )}
    </Card>
  );
}
