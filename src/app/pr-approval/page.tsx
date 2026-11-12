"use client";

/**
 * PR Approval Matrix, under Masters.
 *
 * Which approvers a purchase requisition goes to, by its estimated total.
 * The steps in each band follow the company's PR form; what can be changed
 * here is the two amount thresholds. A change applies to requisitions
 * submitted afterwards - one already in approval keeps the chain it was
 * given. Saving needs procurement_masters.manage, checked on the server.
 */

import { useCallback, useEffect, useState } from "react";

import { ListPage } from "@/components/crm/ListPageShell";
import Button from "@/components/ui/Button";
import PageHeader from "@/components/ui/PageHeader";
import { hasPermission } from "@/features/auth/utils/permissions";
import {
  errorDetail,
  getApprovalMatrixApi,
  saveApprovalMatrixApi,
  type ApprovalMatrix,
} from "@/features/procurement/api/procurement.api";
import { ErrorState, INPUT, LABEL, Loading, money } from "@/features/procurement/components/shared";
import { useUIStore } from "@/lib/store/ui.store";

export default function ApprovalMatrixPage() {
  const { addToast } = useUIStore();
  const canManage = hasPermission("procurement_masters.manage");
  const [matrix, setMatrix] = useState<ApprovalMatrix | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lower, setLower] = useState("");
  const [upper, setUpper] = useState("");
  const [saving, setSaving] = useState(false);

  const show = (m: ApprovalMatrix) => {
    setMatrix(m);
    setLower(String(m.limits[0] ?? ""));
    setUpper(String(m.limits[1] ?? ""));
  };

  const load = useCallback(async () => {
    setError(null);
    try {
      show(await getApprovalMatrixApi());
    } catch (failure) {
      setError(errorDetail(failure, "Could not load the approval matrix."));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const a = Number(lower);
  const b = Number(upper);
  const invalid = lower === "" || upper === "" || !(a > 0) || !(b > a);
  const changed = matrix ? a !== matrix.limits[0] || b !== matrix.limits[1] : false;

  const save = async () => {
    setSaving(true);
    try {
      show(await saveApprovalMatrixApi([a, b]));
      addToast("Approval thresholds saved. New submissions follow them.", "success");
    } catch {
      /* the server's reason is shown by the API client */
    } finally {
      setSaving(false);
    }
  };

  if (error) return <ErrorState text={error} onRetry={load} />;
  if (!matrix) return <Loading text="Loading the approval matrix..." />;

  const ranges = [`Up to ${money(matrix.limits[0])}`, `${money(matrix.limits[0] + 1)} to ${money(matrix.limits[1])}`, `Above ${money(matrix.limits[1])}`];

  return (
    <ListPage>
      <PageHeader
        title="PR Approval Matrix"
        description="Who approves a purchase requisition, by its estimated total. Requisitions already in approval keep the chain they were given."
      />

      <div className="overflow-hidden rounded-xl bg-white dark:border dark:border-[#17304a] dark:bg-[#071929]">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-[#e2e2e2] dark:border-[#17304a]">
              <th className="px-5 py-3 text-[12px] font-normal text-[#777777]">Estimated Total</th>
              <th className="px-5 py-3 text-[12px] font-normal text-[#777777]">Approved By, in Order</th>
            </tr>
          </thead>
          <tbody>
            {matrix.bands.map((band, i) => (
              <tr key={i} className="align-top">
                <td className="whitespace-nowrap px-5 py-4 text-[13px] font-medium text-[#141414] dark:text-white">{ranges[i]}</td>
                <td className="px-5 py-4">
                  <ol className="flex flex-wrap items-center gap-2 text-[13px] text-slate-700 dark:text-slate-200">
                    {band.labels.map((label, j) => (
                      <li key={label} className="flex items-center gap-2">
                        {j > 0 && <span className="text-[#999999]">→</span>}
                        <span className="rounded-md bg-slate-100 px-2 py-1 dark:bg-[#0b2034]">{label}</span>
                      </li>
                    ))}
                  </ol>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="border-t border-[#f3f3f3] px-5 py-3 text-[11px] text-[#999999] dark:border-[#17304a]">
          Finance and Director approvals go to people holding the Finance and Director roles. Where no approver is set up, a super admin approves.
          The requester never approves their own requisition.
        </p>
      </div>

      {canManage && (
        <div className="rounded-xl bg-white p-5 dark:border dark:border-[#17304a] dark:bg-[#071929]">
          <h2 className="mb-4 text-[15px] font-medium text-[#474747] dark:text-white">Thresholds</h2>
          <div className="grid max-w-xl grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={LABEL} htmlFor="limit-1">Reporting manager alone up to (₹)</label>
              <input id="limit-1" type="number" min="1" className={INPUT} value={lower} onChange={(e) => setLower(e.target.value)} />
            </div>
            <div>
              <label className={LABEL} htmlFor="limit-2">Finance up to; Director above (₹)</label>
              <input id="limit-2" type="number" min="1" className={INPUT} value={upper} onChange={(e) => setUpper(e.target.value)} />
            </div>
          </div>
          {invalid && <p className="mt-2 text-[12px] text-rose-600">Both amounts are needed, and the second must be higher than the first.</p>}
          <div className="mt-4 flex gap-2">
            <Button onClick={save} loading={saving} disabled={invalid || !changed}>Save Thresholds</Button>
            <Button variant="outline" disabled={!changed} onClick={() => show(matrix)}>Reset</Button>
          </div>
        </div>
      )}
    </ListPage>
  );
}
