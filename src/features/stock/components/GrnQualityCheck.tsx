"use client";

import { useState } from "react";
import { FiCheckCircle } from "react-icons/fi";

import Button from "@/components/ui/Button";
import { Grn, inspectGrnApi } from "@/features/stock/api/grn.api";
import { errorText, qty } from "@/features/stock/components/stockUi";
import { useUIStore } from "@/lib/store/ui.store";

const FIELD =
  "w-full rounded-lg border border-[#cccccc] bg-white px-3 py-2 text-[13px] text-[#141414] outline-none transition focus:border-[#233353] dark:border-[#17304a] dark:bg-[#071929] dark:text-white";

interface Decision {
  accepted: string;
  damaged: string;
  serials: string;
  remarks: string;
}

const splitSerials = (text: string) =>
  text
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);

/**
 * Quality check: how many of each product are accepted (the rest are
 * rejected, with a reason) and their serial numbers. Posting moves accepted
 * goods into the company's store and sets rejected and damaged ones apart,
 * through the stock ledger.
 */
export default function GrnQualityCheck({ grn, onPosted }: { grn: Grn; onPosted: (grn: Grn) => void }) {
  const { addToast } = useUIStore();
  const [posting, setPosting] = useState(false);
  const [decisions, setDecisions] = useState<Record<number, Decision>>(() =>
    Object.fromEntries(
      grn.lines.map((l) => [l.id, { accepted: String(l.qty_received), damaged: "", serials: "", remarks: l.remarks || "" }]),
    ),
  );

  const update = (id: number, patch: Partial<Decision>) =>
    setDecisions((current) => ({ ...current, [id]: { ...current[id], ...patch } }));

  const post = async () => {
    const lines = [];
    for (const line of grn.lines) {
      const d = decisions[line.id];
      const accepted = d.accepted.trim() === "" ? null : Number(d.accepted);
      const damaged = d.damaged.trim() === "" ? 0 : Number(d.damaged);
      if (accepted === null || !Number.isFinite(accepted) || accepted < 0 || accepted > line.qty_received)
        return addToast(`Line ${line.line_no}: accepted must be between 0 and ${line.qty_received}.`, "warning");
      if (!Number.isFinite(damaged) || damaged < 0 || accepted + damaged > line.qty_received)
        return addToast(`Line ${line.line_no}: accepted and damaged together cannot exceed ${line.qty_received} received.`, "warning");
      const rejected = Number((line.qty_received - accepted - damaged).toFixed(3));
      if ((rejected > 0 || damaged > 0) && !d.remarks.trim())
        return addToast(`Line ${line.line_no}: give the reason for rejection or damage.`, "warning");
      const serials = splitSerials(d.serials);
      if (serials.length && serials.length !== accepted)
        return addToast(`Line ${line.line_no}: ${serials.length} serial(s) for ${accepted} accepted. Enter one per unit.`, "warning");
      lines.push({
        line_id: line.id,
        qty_accepted: accepted,
        qty_rejected: rejected,
        qty_damaged: damaged,
        serials,
        remarks: d.remarks.trim() || null,
      });
    }

    try {
      setPosting(true);
      const posted = await inspectGrnApi(grn.id, lines);
      addToast(`GRN ${posted.grn_number} generated. Accepted goods are now available.`, "success");
      onPosted(posted);
    } catch (err: unknown) {
      addToast(errorText(err, "Could not post the GRN."), "error");
    } finally {
      setPosting(false);
    }
  };

  return (
    <section className="rounded-xl border border-amber-300 bg-white p-5 dark:border-amber-700/60 dark:bg-[#071929]">
      <h2 className="mb-1 text-[15px] font-semibold text-slate-900 dark:text-white">Quality Check</h2>
      <p className="mb-4 text-[12px] text-[#777777]">
        The goods are in quarantine. Enter how many passed and how many are damaged; the rest are rejected. Posting makes
        accepted goods available and sets rejected and damaged goods apart, where they cannot be sold.
      </p>
      <div className="space-y-3">
        {grn.lines.map((line) => {
          const d = decisions[line.id];
          const accepted = Number(d.accepted);
          const damaged = Number(d.damaged || 0);
          const rejected =
            Number.isFinite(accepted) && Number.isFinite(damaged)
              ? Math.max(0, Number((line.qty_received - accepted - damaged).toFixed(3)))
              : 0;
          return (
            <div key={line.id} className="rounded-lg border border-slate-200 p-3 dark:border-[#17304a]">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-[13px] font-semibold">
                  {line.line_no}. {line.description || line.sku}{" "}
                  <span className="font-mono text-[11px] font-normal text-[#777777]">{line.sku}</span>
                </p>
                <p className="text-[12px] text-[#777777]">Received {qty(line.qty_received)}</p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                <label className="space-y-1">
                  <span className="text-[12px] text-[#777777]">Qty Accepted *</span>
                  <input
                    type="number"
                    min="0"
                    max={line.qty_received}
                    step="any"
                    className={FIELD}
                    value={d.accepted}
                    onChange={(e) => update(line.id, { accepted: e.target.value })}
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[12px] text-[#777777]">Qty Damaged</span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    className={FIELD}
                    value={d.damaged}
                    onChange={(e) => update(line.id, { damaged: e.target.value })}
                  />
                </label>
                <div className="space-y-1">
                  <span className="text-[12px] text-[#777777]">Qty Rejected</span>
                  <p className={`py-2 text-[13px] font-semibold ${rejected > 0 ? "text-rose-600" : ""}`}>{qty(rejected)}</p>
                </div>
                <label className="space-y-1">
                  <span className="text-[12px] text-[#777777]">{rejected > 0 || damaged > 0 ? "Reason *" : "Remarks"}</span>
                  <input className={FIELD} value={d.remarks} onChange={(e) => update(line.id, { remarks: e.target.value })} />
                </label>
              </div>
              <label className="mt-3 block space-y-1">
                <span className="text-[12px] text-[#777777]">
                  Serial Numbers of accepted units ({splitSerials(d.serials).length} of {Number.isFinite(accepted) ? accepted : 0}) - leave empty for products counted by quantity
                </span>
                <textarea
                  rows={2}
                  className={`${FIELD} font-mono text-[12px]`}
                  value={d.serials}
                  onChange={(e) => update(line.id, { serials: e.target.value })}
                />
              </label>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex justify-end">
        <Button variant="success" icon={<FiCheckCircle />} loading={posting} onClick={post}>
          Post Quality Check
        </Button>
      </div>
    </section>
  );
}
