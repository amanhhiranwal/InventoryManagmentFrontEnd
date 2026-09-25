"use client";

/**
 * The procurement desk.
 *
 * Orders that accounts have released, each shown against what the shelf
 * can actually cover. Approving walks the order on one step - into
 * procurement, then ready, then out, then delivered - and rejecting puts
 * it on hold with the reason, which is what happens when the stock is not
 * there.
 */

import {
  DeskOrder,
  getProcurementDeskApi,
  stageLabel,
} from "@/features/fulfilment/api/fulfilment.api";
import DeskBoard from "@/features/fulfilment/components/DeskBoard";

export default function ProcurementDeskPage() {
  return (
    <DeskBoard
      title="Procurement Desk"
      description="Confirm the stock, take the order in, and send it out. Each approval moves it one step."
      load={getProcurementDeskApi}
      approveLabel="Confirm & Move On"
      emptyNote="Nothing has been released to inventory. Orders arrive here once accounts have verified the payment."
      detail={(order) => <StockDetail order={order} />}
    />
  );
}

function StockDetail({ order }: { order: DeskOrder }) {
  const lines = order.stock || [];

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-[#17304a]">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/70 dark:border-[#17304a] dark:bg-[#0b2034]">
              <Th>Product</Th>
              <Th>SKU</Th>
              <Th className="text-right">Ordered</Th>
              <Th className="text-right">In Stock</Th>
              <Th className="text-right">Position</Th>
            </tr>
          </thead>

          <tbody>
            {lines.map((line, index) => (
              <tr
                key={index}
                className="border-b border-slate-100 last:border-0 dark:border-[#0f2942]"
              >
                <td className="px-4 py-2.5 text-[12px] text-slate-800 dark:text-slate-100">
                  {line.product}
                </td>
                <td className="px-4 py-2.5 text-[11px] text-slate-400">
                  {line.sku || "—"}
                </td>
                <td className="px-4 py-2.5 text-right text-[12px] text-slate-700 dark:text-slate-200">
                  {line.wanted}
                </td>
                <td className="px-4 py-2.5 text-right text-[12px] text-slate-700 dark:text-slate-200">
                  {line.known ? line.available : "—"}
                </td>
                <td className="px-4 py-2.5 text-right">
                  {!line.known ? (
                    <Tag tone="neutral">Not in the catalogue</Tag>
                  ) : line.short ? (
                    <Tag tone="warn">
                      Short by {Number(line.wanted) - Number(line.available || 0)}
                    </Tag>
                  ) : (
                    <Tag tone="good">Covered</Tag>
                  )}
                </td>
              </tr>
            ))}

            {lines.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-[12px] text-slate-400">
                  No lines on this order.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-slate-400">
        A line that is short does not stop you — confirm it if the stock is
        on order, or reject it so the reason is on the record. Approving
        moves this order to {stageLabel(order.approves_to || "")}.
      </p>
    </div>
  );
}

function Th({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`whitespace-nowrap px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 ${className}`}
    >
      {children}
    </th>
  );
}

function Tag({
  tone,
  children,
}: {
  tone: "good" | "warn" | "neutral";
  children: React.ReactNode;
}) {
  const tones = {
    good: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400",
    warn: "bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400",
    neutral: "bg-slate-100 text-slate-500 dark:bg-slate-800/60 dark:text-slate-300",
  };

  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-1 text-[10px] font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
