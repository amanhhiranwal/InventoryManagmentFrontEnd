"use client";

/**
 * Payment Calendar: every approved PO's instalments, week by week - the
 * due date, the PO and vendor, which bank or cheque, the amount, and
 * whether it has been paid. Unpaid instalments from before the chosen
 * weeks always show, marked overdue, so a missed payment cannot drop off
 * the page. An instalment is marked paid on its PO, where the cheque or
 * transfer details are entered; the row opens it.
 *
 * The server allows purchase_order.read or purchase_order.pay. A daily
 * reminder (send_payment_reminders.py, run by cron) tells the people who
 * pay about each unpaid instalment until it is marked paid.
 */

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { ListPage, ListPageHeader, StatGrid, TableCard } from "@/components/crm/ListPageShell";
import QueueTabs from "@/components/crm/QueueTabs";
import StatCard from "@/components/crm/StatCard";
import {
  errorDetail,
  getPaymentCalendarApi,
  type CalendarPayment,
  type PaymentCalendar,
} from "@/features/procurement/api/procurement.api";
import DataList, { type Column } from "@/features/procurement/components/DataList";
import { Empty, ErrorState, INPUT, LABEL, Loading, ProcStatus, day, money } from "@/features/procurement/components/shared";
import { toDateInput } from "@/lib/datetime";

const SUB = "mt-0.5 block text-[11px] text-[#777777] dark:text-slate-400";

const TABS: { value: string | null; label: string }[] = [
  { value: "PENDING", label: "To Pay" },
  { value: "PAID", label: "Paid" },
  { value: null, label: "All" },
];

/** Monday of the week ``date`` falls in. */
const mondayOf = (date: Date) => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() - ((copy.getDay() + 6) % 7));
  return copy;
};

const addDays = (date: Date, days: number) => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
};

/** "Week 46 · 9 Nov – 15 Nov 2026" */
const weekTitle = (weekStart: string | null, week: number | null) => {
  if (!weekStart) return "No due date yet";
  const start = new Date(`${weekStart}T00:00:00`);
  const end = addDays(start, 6);
  const short = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  return `Week ${week} · ${short(start)} – ${short(end)} ${end.getFullYear()}`;
};

const COLUMNS: Column<CalendarPayment>[] = [
  {
    header: "Due Date",
    primary: true,
    nowrap: true,
    cell: (p) => (
      <>
        {day(p.due_date)}
        {p.overdue && <span className="mt-0.5 block text-[11px] font-medium text-rose-600 dark:text-rose-400">Overdue</span>}
      </>
    ),
  },
  {
    header: "Purchase Order",
    primary: true,
    cell: (p) => (
      <>
        <Link href={p.link} className="font-semibold text-[#233353] hover:underline dark:text-sky-300">
          {p.po_number}
        </Link>
        <span className={SUB}>{p.vendor_name || "Vendor not named"}</span>
      </>
    ),
  },
  {
    header: "Instalment",
    cell: (p) => (
      <>
        {p.label}
        <span className={SUB}>{p.percent}% of the PO</span>
      </>
    ),
  },
  {
    header: "Bank / Cheque",
    cell: (p) =>
      p.mode === "PDC" ? (
        <>
          Cheque {p.cheque_number || <span className="text-[#999999]">number not entered</span>}
          <span className={SUB}>
            {[p.bank_name, p.cheque_date && `dated ${day(p.cheque_date)}`].filter(Boolean).join(", ") ||
              "Bank and date not entered"}
          </span>
        </>
      ) : (
        <>
          Bank transfer
          <span className={SUB}>{[p.bank_name, p.reference].filter(Boolean).join(", ") || "Bank not entered"}</span>
        </>
      ),
  },
  { header: "Amount", align: "right", nowrap: true, cell: (p) => money(p.amount) },
  {
    header: "Paid",
    primary: true,
    cell: (p) =>
      p.status === "PAID" ? (
        <>
          <ProcStatus status="PAID" label="✓ Paid" />
          {p.paid_by_name && <span className={SUB}>by {p.paid_by_name}</span>}
        </>
      ) : p.overdue ? (
        <ProcStatus status="ON_HOLD" label="Overdue" />
      ) : (
        <ProcStatus status="PENDING" label="To pay" />
      ),
  },
];

export default function PaymentCalendarPage() {
  const thisWeek = mondayOf(new Date());
  const [start, setStart] = useState(toDateInput(thisWeek));
  const [end, setEnd] = useState(toDateInput(addDays(thisWeek, 8 * 7 - 1)));
  const [status, setStatus] = useState<string | null>("PENDING");
  const [data, setData] = useState<PaymentCalendar | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(0);

  const load = useCallback(async () => {
    const request = ++latest.current;
    setLoading(true);
    setError(null);
    try {
      /* Both statuses in one request; the tabs filter it here, so each
         tab can show its count. */
      const answer = await getPaymentCalendarApi({
        start: start || undefined,
        end: end || undefined,
      });
      if (request === latest.current) setData(answer);
    } catch (failure) {
      if (request === latest.current) setError(errorDetail(failure, "Could not load the payment calendar."));
      throw failure;
    } finally {
      if (request === latest.current) setLoading(false);
    }
  }, [start, end]);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  const summary = data?.summary;
  const all = data?.weeks.flatMap((week) => week.rows) || [];
  const counts: Record<string, number> = {
    PENDING: all.filter((p) => p.status !== "PAID").length,
    PAID: all.filter((p) => p.status === "PAID").length,
  };
  const weeks = (data?.weeks || [])
    .map((week) => ({
      ...week,
      rows: status ? week.rows.filter((p) => (status === "PAID" ? p.status === "PAID" : p.status !== "PAID")) : week.rows,
    }))
    .filter((week) => week.rows.length > 0);

  return (
    <ListPage>
      <ListPageHeader title="Payment Calendar" refreshing={loading} onRefresh={load} />

      <StatGrid cols={4}>
        <StatCard label="To Pay" value={summary ? money(summary.pending) : "—"} caption="in these weeks and overdue" />
        <StatCard label="Overdue" value={summary ? money(summary.overdue) : "—"} caption="past its due date, unpaid" />
        <StatCard label="Paid" value={summary ? money(summary.paid) : "—"} caption="in these weeks" />
        <StatCard label="Instalments" value={summary ? String(summary.count) : "—"} caption="shown below" />
      </StatGrid>

      <div className="flex flex-wrap items-end gap-3 rounded-xl bg-white p-4 dark:border dark:border-[#17304a] dark:bg-[#071929]">
        <div>
          <label className={LABEL} htmlFor="pc-from">From</label>
          <input id="pc-from" type="date" className={INPUT} value={start} max={end || undefined} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div>
          <label className={LABEL} htmlFor="pc-to">To</label>
          <input id="pc-to" type="date" className={INPUT} value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} />
        </div>
        <p className="min-w-[14rem] flex-1 pb-2 text-[12px] text-[#777777] dark:text-slate-400">
          Unpaid instalments from before these dates always show, as overdue. Open a row to record its payment on the PO.
        </p>
      </div>

      <TableCard>
        <QueueTabs
          tabs={TABS.map((tab) => ({ ...tab, count: tab.value ? counts[tab.value] : all.length }))}
          active={status}
          onChange={setStatus}
          fit
        />

        {loading && !data && !error ? (
          <Loading text="Loading the payment calendar..." />
        ) : error ? (
          <ErrorState text={error} onRetry={() => load().catch(() => {})} />
        ) : weeks.length === 0 ? (
          <Empty
            text={
              status === "PAID"
                ? "Nothing paid in these weeks."
                : "Nothing to pay in these weeks. Instalments appear here once a purchase order is approved."
            }
          />
        ) : (
          <div className="divide-y divide-[#f3f3f3] dark:divide-[#17304a]">
            {weeks.map((week) => (
              <section key={week.week_start || "undated"} aria-label={weekTitle(week.week_start, week.week)}>
                <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 pb-1 pt-4">
                  <h2 className="text-[14px] font-medium text-[#474747] dark:text-white">
                    {weekTitle(week.week_start, week.week)}
                  </h2>
                  <p className="text-[12px] tabular-nums text-[#777777] dark:text-slate-400">
                    {week.pending > 0 ? (
                      <>
                        <span className="font-semibold text-[#141414] dark:text-white">{money(week.pending)}</span> to pay
                        {week.total !== week.pending && <> of {money(week.total)}</>}
                      </>
                    ) : (
                      <>All paid · {money(week.total)}</>
                    )}
                  </p>
                </div>
                <DataList rows={week.rows} columns={COLUMNS} rowKey={(p) => p.id} rowHref={(p) => p.link} dense />
              </section>
            ))}
          </div>
        )}
      </TableCard>
    </ListPage>
  );
}
