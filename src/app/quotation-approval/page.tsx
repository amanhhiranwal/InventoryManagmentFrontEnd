"use client";

/**
 * Quotation Approval bands.
 *
 * Who may sign off how much discount. A salesperson applies a discount and
 * it travels up until it reaches someone whose ceiling covers it, so the
 * ceilings have to climb and the last band has to be open - otherwise a
 * big enough discount would have nobody who could approve it.
 *
 * Super admin only, like the rest of Masters.
 */

import { useCallback, useEffect, useState } from "react";
import { CgSpinner } from "react-icons/cg";
import { LuPercent, LuPlus, LuSave, LuTrash2 } from "react-icons/lu";

import { useAuthStore } from "@/features/auth/store/auth.store";
import { useUIStore } from "@/lib/store/ui.store";
import {
  getApprovalMatrixApi,
  saveApprovalMatrixApi,
} from "@/features/approvals/api/approvals.api";

interface Row {
  role: string;
  to_percent: number | null;
}

const INPUT =
  "h-10 rounded-xl border border-slate-200 bg-slate-50/60 px-3 text-[13px] text-slate-800 outline-none transition focus:border-[#233353] focus:bg-white dark:border-[#17304a] dark:bg-[#071929] dark:text-white";

export default function QuotationApprovalPage() {
  const { addToast } = useUIStore();
  const user = useAuthStore((state) => state.user);
  const superAdmin = user?.is_super_admin === true;

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const matrix = await getApprovalMatrixApi();

      setRows(
        matrix.bands.map((band) => ({
          role: band.role,
          to_percent: band.to_percent,
        })),
      );
    } catch (error) {
      console.error(error);
      addToast("Could not load the approval bands.", "error");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setSaving(true);

    try {
      const matrix = await saveApprovalMatrixApi(
        /* The last band is always open, whatever was typed into it. */
        rows.map((row, index) => ({
          role: row.role.trim(),
          to_percent: index === rows.length - 1 ? null : row.to_percent,
        })),
      );

      setRows(
        matrix.bands.map((band) => ({
          role: band.role,
          to_percent: band.to_percent,
        })),
      );

      addToast(
        "Approval bands saved. New quotations use them straight away.",
        "success",
      );
    } catch (error) {
      const detail =
        (error as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "The approval bands could not be saved.";
      addToast(detail, "error");
    } finally {
      setSaving(false);
    }
  };

  if (!superAdmin) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center dark:border-[#17304a] dark:bg-[#071929]">
        <h2 className="text-lg font-bold text-slate-800 dark:text-white">
          Access Denied
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          Only a super administrator can change the approval bands.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center gap-2 text-slate-400">
        <CgSpinner className="animate-spin text-2xl text-[#233353]" />
        <span className="text-xs">Loading the approval bands...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-800 dark:text-white">
            Quotation Approval
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            How much discount each role can sign off. A discount travels up
            until it reaches someone whose ceiling covers it.
          </p>
        </div>

        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="flex h-10 shrink-0 items-center gap-2 rounded-xl bg-[#233353] px-5 text-xs font-bold text-white transition hover:bg-[#18243a] disabled:opacity-50"
        >
          {saving ? (
            <CgSpinner className="animate-spin" size={14} />
          ) : (
            <LuSave size={14} />
          )}
          {saving ? "Saving..." : "Save Bands"}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs xl:col-span-2 dark:border-[#17304a] dark:bg-[#071929]">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-[#17304a]">
            <LuPercent size={16} className="text-[#233353] dark:text-sky-400" />
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
              Discount Bands
            </h2>
          </div>

          <div className="space-y-3">
            {rows.map((row, index) => {
              const last = index === rows.length - 1;
              const floor = index === 0 ? 0 : rows[index - 1].to_percent ?? 0;

              return (
                <div key={index} className="flex flex-wrap items-center gap-3">
                  <span className="w-5 text-[11px] font-bold text-slate-400">
                    {index + 1}
                  </span>

                  <input
                    value={row.role}
                    onChange={(event) =>
                      setRows((current) =>
                        current.map((item, i) =>
                          i === index ? { ...item, role: event.target.value } : item,
                        ),
                      )
                    }
                    placeholder="Role, e.g. AVP"
                    className={`${INPUT} w-44`}
                  />

                  <span className="text-[11px] text-slate-400">
                    signs from {Number(floor)}% up to
                  </span>

                  {last ? (
                    <span className="rounded-lg bg-slate-100 px-3 py-2 text-[11px] font-semibold text-slate-500 dark:bg-[#0b2034]">
                      any discount
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={row.to_percent ?? ""}
                        onChange={(event) =>
                          setRows((current) =>
                            current.map((item, i) =>
                              i === index
                                ? { ...item, to_percent: Number(event.target.value) }
                                : item,
                            ),
                          )
                        }
                        className={`${INPUT} w-24`}
                      />
                      <span className="text-[13px] text-slate-500">%</span>
                    </span>
                  )}

                  {rows.length > 1 && (
                    <button
                      type="button"
                      aria-label={`Remove the ${row.role || "empty"} band`}
                      onClick={() =>
                        setRows((current) => current.filter((_, i) => i !== index))
                      }
                      className="ml-auto rounded-lg p-2 text-slate-300 transition hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10"
                    >
                      <LuTrash2 size={13} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() =>
              setRows((current) => {
                /* Slots in above the open band, which always stays last. */
                const head = current.slice(0, -1);
                const tail = current.slice(-1);
                return [...head, { role: "", to_percent: 0 }, ...tail];
              })
            }
            className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-4 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-[#17304a] dark:text-slate-300"
          >
            <LuPlus size={13} />
            Add Band
          </button>

          <p className="text-[11px] leading-relaxed text-slate-400">
            Ceilings must climb, and the last band is always open — a discount
            above every ceiling would otherwise have nobody who could approve
            it. Dealer price ignores the bands: it is a transfer price and the
            CEO sets it.
          </p>
        </div>

        <WorkedExample rows={rows} />
      </div>
    </div>
  );
}

/** What the bands above actually mean, at a few discounts.
 *
 *  Mirrors the backend's rule - walk the bands in order, adding each role
 *  until one of them covers the discount - so a super admin can see the
 *  effect of an edit before saving it.
 */
function WorkedExample({ rows }: { rows: Row[] }) {
  const chainFor = (percent: number): string[] => {
    const chain: string[] = [];

    for (const row of rows) {
      chain.push(row.role.trim() || "—");

      if (row.to_percent !== null && percent <= Number(row.to_percent)) break;
    }

    return chain;
  };

  /* One sample inside each band, plus one past the last ceiling. */
  const samples = rows.map((row, index) => {
    const floor = index === 0 ? 0 : Number(rows[index - 1].to_percent ?? 0);
    const ceiling = row.to_percent;

    return ceiling === null ? floor + 5 : Math.round((floor + Number(ceiling)) / 2);
  });

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-[#17304a] dark:bg-[#071929]">
      <div className="border-b border-slate-100 pb-3 dark:border-[#17304a]">
        <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
          How A Discount Travels
        </h2>
      </div>

      <div className="space-y-3">
        {samples.map((percent, index) => (
          <div key={index} className="space-y-1">
            <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
              {percent}% discount
            </p>

            <div className="flex flex-wrap items-center gap-1">
              {chainFor(percent).map((role, step) => (
                <span key={step} className="flex items-center gap-1">
                  {step > 0 && (
                    <span className="text-[10px] text-slate-300">→</span>
                  )}
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-[#0b2034] dark:text-slate-300">
                    {role}
                  </span>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <p className="border-t border-slate-100 pt-3 text-[11px] leading-relaxed text-slate-400 dark:border-[#17304a]">
        A quotation waits at each role in turn and is only released once the
        last one has signed. The request goes to the salesperson&apos;s own
        manager holding that role, so one region&apos;s discount never lands
        with another region&apos;s AVP.
      </p>
    </div>
  );
}
