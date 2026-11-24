import { FiCheck, FiClipboard } from "react-icons/fi";

import type { GrnStatus } from "@/features/stock/api/grn.api";

/**
 * The "Stock-In Process" panel from the design: where this GRN has got to.
 * A step is done, the current one, or still to come.
 */
export default function GrnProcess({
  status,
  poChosen,
  poNumber,
}: {
  status: GrnStatus;
  poChosen: boolean;
  poNumber?: string | null;
}) {
  const reached =
    status === "POSTED" ? 5 : status === "QC_PENDING" ? 4 : status === "SUBMITTED" ? 3 : poChosen ? 2 : 1;
  const steps = [
    { title: "Purchase Order & Vendor Details", note: poNumber ? `${poNumber} chosen` : "Choose the PO or supplier" },
    { title: "Receiving", note: "Quantities received entered" },
    { title: "Receipt Posted", note: "Goods in stock, in quarantine" },
    { title: "Quality Check", note: "Accepted, rejected and damaged per product" },
    { title: "Goods Receipt Note", note: "Accepted goods are available" },
  ];

  return (
    <aside className="h-fit rounded-xl border border-slate-200 bg-white p-5 dark:border-[#17304a] dark:bg-[#071929]">
      <h2 className="mb-4 flex items-center gap-2 text-[15px] font-semibold text-slate-900 dark:text-white">
        <FiClipboard /> Stock-In Process
      </h2>
      {status === "CANCELLED" ? (
        <p className="text-[13px] text-[#777777]">This GRN was cancelled. No stock moved.</p>
      ) : (
        <ol className="space-y-4">
          {steps.map((step, index) => {
            const number = index + 1;
            const done = number < reached || (status === "POSTED" && number === 5);
            const current = number === reached && !done;
            return (
              <li key={step.title} className="flex gap-3">
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                    done
                      ? "bg-emerald-500 text-white"
                      : current
                        ? "bg-amber-400 text-white"
                        : "bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-300"
                  }`}
                  aria-hidden
                >
                  {done ? <FiCheck /> : number}
                </span>
                <div>
                  <p className={`text-[13px] font-semibold ${done || current ? "text-slate-900 dark:text-white" : "text-slate-400"}`}>
                    {step.title}
                    <span className="sr-only">{done ? " (done)" : current ? " (current step)" : " (to come)"}</span>
                  </p>
                  {(done || current) && <p className="text-[12px] text-[#777777]">{step.note}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </aside>
  );
}
