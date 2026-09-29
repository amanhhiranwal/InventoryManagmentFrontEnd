"use client";

/**
 * The accounts desk.
 *
 * Everything waiting on accounts: orders whose advance has to be confirmed
 * before fulfilment starts, and installed orders whose balance has to be
 * settled before they close. Approving an advance hands the order to
 * inventory; rejecting it puts the order on hold with the reason.
 */

import {
  DeskOrder,
  getAccountsDeskApi,
  money,
} from "@/features/fulfilment/api/fulfilment.api";
import DeskBoard from "@/features/fulfilment/components/DeskBoard";

export default function AccountsDeskPage() {
  return (
    <DeskBoard
      title="Accounts Desk"
      description="Confirm the money before an order moves, and close it when the balance is settled."
      load={getAccountsDeskApi}
      approveLabel="Verify Payment"
      emptyNote="Every approved order has had its payment confirmed. New ones arrive here the moment sales raise them."
      detail={(order) => <PaymentDetail order={order} />}
    />
  );
}

function PaymentDetail({ order }: { order: DeskOrder }) {
  const invoice = order.proforma_invoice;
  const shortfall = Math.max(0, order.advance_expected - order.advance_received);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Panel title="The money">
        <Line label="Order value" value={money(order.grand_total)} />
        <Line
          label={`Advance asked (${order.advance_percent}%)`}
          value={money(order.advance_expected)}
        />
        <Line
          label="Advance received"
          value={money(order.advance_received)}
          tone={order.advance_settled ? "good" : "warn"}
        />
        <Line
          label={shortfall > 0 ? "Still to collect" : "Balance after advance"}
          value={money(
            shortfall > 0 ? shortfall : order.grand_total - order.advance_received,
          )}
        />
      </Panel>

      <Panel title="Proforma invoice">
        {invoice ? (
          <>
            <Line label="Number" value={invoice.pi_number || `#${invoice.id}`} />
            <Line label="Status" value={invoice.status} />
            <Line label="Invoiced" value={money(invoice.grand_total)} />
            <Line label="Paid" value={money(invoice.amount_paid)} />
            <Line label="Balance due" value={money(invoice.balance_due)} />
          </>
        ) : (
          <p className="text-[12px] text-slate-400">
            No proforma invoice has been raised against this order yet, so
            there is nothing for the payment to have come in against.
          </p>
        )}
      </Panel>

      <Panel title="What was ordered">
        <ul className="space-y-1.5">
          {(order.items || []).map((item, index) => (
            <li key={index} className="text-[12px] text-slate-600 dark:text-slate-300">
              {String(item.product || item.name || "Line")}
              <span className="text-slate-400">
                {" "}
                × {String(item.qty ?? item.quantity ?? 1)}
              </span>
            </li>
          ))}

          {(order.items || []).length === 0 && (
            <li className="text-[12px] text-slate-400">No lines on this order.</li>
          )}
        </ul>
      </Panel>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-[#17304a] dark:bg-[#0b2034]">
      <p className="mb-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
        {title}
      </p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Line({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "warn";
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[11px] text-slate-500 dark:text-slate-400">
        {label}
      </span>
      <span
        className={`text-[12px] font-semibold ${
          tone === "good"
            ? "text-emerald-600 dark:text-emerald-400"
            : tone === "warn"
              ? "text-amber-600 dark:text-amber-400"
              : "text-slate-800 dark:text-slate-100"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
