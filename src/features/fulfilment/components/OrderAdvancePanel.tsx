"use client";

/**
 * The business coordinator's check, on the sales order page itself.
 *
 * Shown to the coordinator on an approved order: the payment terms, the
 * proforma invoice, and the advance that actually arrived. Accept records
 * it and enables Process Order; Hold puts the order on hold with the
 * reason. The server checks the same rules whoever presses it.
 *
 * Built from the page's own pieces - the white section, the card header
 * with its icon and hairline, the label / value rows of Order Overview and
 * the Log Activity form's fields - so it reads as part of the page.
 */

import { useState } from "react";
import { CgSpinner } from "react-icons/cg";
import { FiCheck, FiCreditCard, FiX } from "react-icons/fi";

import { useUIStore } from "@/lib/store/ui.store";
import {
  decideOrderApi,
  money,
} from "@/features/fulfilment/api/fulfilment.api";
import AdvanceEntry, {
  advanceVerdict,
} from "@/features/fulfilment/components/AdvanceEntry";

export default function OrderAdvancePanel({
  orderId,
  grandTotal,
  advancePercent,
  advanceExpected,
  advanceReceived,
  paymentTerms,
  invoice,
  onDone,
}: {
  orderId: number;
  grandTotal: number;
  advancePercent: number;
  advanceExpected: number;
  advanceReceived: number;
  paymentTerms?: string | null;
  invoice: {
    pi_number?: string | null;
    id: number;
    amount_paid: number;
  } | null;
  onDone: () => Promise<void> | void;
}) {
  const { addToast } = useUIStore();

  const [typed, setTyped] = useState(
    advanceReceived > 0 ? String(advanceReceived) : "",
  );
  const [remarks, setRemarks] = useState("");
  const [busy, setBusy] = useState<"accept" | "hold" | null>(null);

  const { amount, shortBy, blocked } = advanceVerdict(
    typed,
    advanceExpected,
    grandTotal,
    !!invoice,
  );

  const decide = async (approve: boolean) => {
    const note = remarks.trim();

    if (!approve && !note) {
      addToast("Add a remark saying why the order is on hold.", "error");
      return;
    }

    setBusy(approve ? "accept" : "hold");

    try {
      await decideOrderApi(
        orderId,
        approve,
        note || undefined,
        approve ? { advance_amount: amount } : undefined,
      );
      addToast(
        approve
          ? "Advance accepted. Process the order to send it to accounts."
          : "Order put on hold.",
        approve ? "success" : "info",
      );
      setRemarks("");
      await onDone();
    } catch (error) {
      addToast(
        (error as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "That could not be recorded.",
        "error",
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="rounded-xl bg-white p-5 dark:border dark:border-[#17304a] dark:bg-[#071929]">
      <section aria-labelledby={`advance-check-${orderId}`}>
        <div className="mb-4 flex items-center gap-2.5 border-b border-[#f3f3f3] pb-3 dark:border-[#17304a]">
          <span className="text-[18px] text-[#474747] dark:text-slate-300">
            <FiCreditCard size={15} />
          </span>
          <h3
            id={`advance-check-${orderId}`}
            className="text-[15px] font-medium text-[#474747] dark:text-white"
          >
            Advance Check
          </h3>
        </div>

        <div className="grid grid-cols-1 gap-x-10 gap-y-5 md:grid-cols-2">
          <div className="space-y-3">
            <Row
              label="Payment terms"
              value={paymentTerms || `${advancePercent}% advance`}
            />
            <Row label="Order value" value={money(grandTotal)} />
            <Row
              label={`Advance (${advancePercent}%)`}
              value={money(advanceExpected)}
            />
            <Row
              label="Proforma invoice"
              value={
                invoice
                  ? invoice.pi_number || `#${invoice.id}`
                  : "Not generated"
              }
            />
            <Row label="Paid so far" value={money(invoice?.amount_paid ?? 0)} />
          </div>

          <div>
            <AdvanceEntry
              id={`order-advance-${orderId}`}
              typed={typed}
              onType={setTyped}
              expected={advanceExpected}
              grandTotal={grandTotal}
            />

            <label
              htmlFor={`order-advance-remarks-${orderId}`}
              className="mb-1.5 mt-3 block text-[10px] font-semibold text-slate-600 dark:text-slate-400"
            >
              Remarks
            </label>
            <input
              id={`order-advance-remarks-${orderId}`}
              value={remarks}
              onChange={(event) => setRemarks(event.target.value)}
              placeholder="Needed to put the order on hold"
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-[11px] text-slate-700 outline-none focus:border-[#233353] dark:border-[#17304a] dark:bg-[#071929] dark:text-white"
            />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-[#f3f3f3] pt-4 dark:border-[#17304a]">
          <button
            type="button"
            disabled={!!busy || !!blocked}
            title={blocked || undefined}
            onClick={() => decide(true)}
            className="flex h-[39px] items-center gap-2 rounded-lg bg-[#273756] px-4 text-[13px] font-medium text-white transition hover:bg-[#18243a] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy === "accept" ? (
              <CgSpinner className="animate-spin" size={13} />
            ) : (
              <FiCheck size={13} />
            )}
            Accept Advance
          </button>

          <button
            type="button"
            disabled={!!busy}
            onClick={() => decide(false)}
            className="flex h-[39px] items-center gap-2 rounded-lg border border-rose-200 bg-white px-4 text-[13px] font-medium text-rose-600 transition hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900/40 dark:bg-[#071929] dark:hover:bg-rose-950/20"
          >
            {busy === "hold" ? (
              <CgSpinner className="animate-spin" size={13} />
            ) : (
              <FiX size={13} />
            )}
            Hold Order
          </button>

          <span className="text-[11px] text-[#777777] dark:text-slate-400">
            {blocked ? (
              <span className="text-amber-600 dark:text-amber-400">
                {blocked}
              </span>
            ) : shortBy > 0.5 ? (
              `${money(shortBy)} short of the terms. Accept only if agreed, and note it in the remarks.`
            ) : (
              "Accepting records the advance on the proforma invoice."
            )}
          </span>
        </div>
      </section>
    </div>
  );
}

/** A label / value line, as Order Overview draws them. */
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start">
      <span className="w-[120px] shrink-0 text-[11px] text-[#777777] dark:text-slate-400">
        {label}:
      </span>
      <span className="text-[11px] font-medium text-[#141414] [overflow-wrap:anywhere] dark:text-white">
        {value}
      </span>
    </div>
  );
}
