"use client";

/**
 * Payment Calendar: every approved PO's instalments, week by week - the
 * due date, the PO and vendor, which bank or cheque, the amount, and where
 * it stands. In both menus: Procurement, who fill in each instalment's
 * cheque or transfer and submit it, and Accounts, who approve it (or
 * return it with a reason) and then mark it paid - from the row itself.
 *
 * Unpaid instalments from before the chosen weeks always show, marked
 * overdue, so a missed payment cannot drop off the page. The server
 * checks every action (purchase_order.manage to submit, purchase_order.pay
 * to approve and pay); the buttons only follow what it says this person
 * may do. A reminder (send_payment_reminders.py, run by cron) tells both
 * teams about each unpaid instalment every day until it is paid.
 */

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { ListPage, ListPageHeader, StatGrid, TableCard } from "@/components/crm/ListPageShell";
import QueueTabs from "@/components/crm/QueueTabs";
import StatCard from "@/components/crm/StatCard";
import Modal from "@/components/ui/Modal";
import {
  errorDetail,
  getPaymentCalendarApi,
  paymentActionApi,
  type CalendarPayment,
  type PaymentAction,
  type PaymentCalendar,
} from "@/features/procurement/api/procurement.api";
import DataList, { type Column } from "@/features/procurement/components/DataList";
import {
  Empty,
  ErrorState,
  INPUT,
  LABEL,
  Loading,
  PaymentStatusPill,
  RemarksPrompt,
  day,
  money,
} from "@/features/procurement/components/shared";
import { toDateInput } from "@/lib/datetime";
import { useUIStore } from "@/lib/store/ui.store";

const SUB = "mt-0.5 block text-[11px] text-[#777777] dark:text-slate-400";
const LINK_BUTTON = "text-[12px] font-medium text-[#233353] hover:underline disabled:opacity-50 dark:text-sky-300";

/** The tabs, each the statuses it shows. */
const TABS: { value: string; label: string; statuses: string[] | null }[] = [
  { value: "TODO", label: "To Submit", statuses: ["PENDING", "RETURNED"] },
  { value: "SUBMITTED", label: "With Accounts", statuses: ["SUBMITTED"] },
  { value: "APPROVED", label: "Approved", statuses: ["APPROVED"] },
  { value: "PAID", label: "Paid", statuses: ["PAID"] },
  { value: "ALL", label: "All", statuses: null },
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

export default function PaymentCalendarPage() {
  const { addToast } = useUIStore();
  const thisWeek = mondayOf(new Date());
  const [start, setStart] = useState(toDateInput(thisWeek));
  const [end, setEnd] = useState(toDateInput(addDays(thisWeek, 8 * 7 - 1)));
  /* Unset until chosen: accounts open on what waits for them, procurement
     on what they have to submit. */
  const [chosenTab, setChosenTab] = useState<string | null>(null);
  const [data, setData] = useState<PaymentCalendar | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [returning, setReturning] = useState<CalendarPayment | null>(null);
  const latest = useRef(0);

  const load = useCallback(async () => {
    const request = ++latest.current;
    setLoading(true);
    setError(null);
    try {
      /* Every status in one request; the tabs filter it here, so each tab
         can show its count. */
      const answer = await getPaymentCalendarApi({ start: start || undefined, end: end || undefined });
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

  /** Accounts' steps, straight from the row; the list reloads after. */
  const step = async (row: CalendarPayment, action: PaymentAction, remarks?: string) => {
    setBusyId(row.id);
    try {
      const answer = await paymentActionApi(row.purchase_order_id, row.id, action, remarks);
      addToast(answer.message || "Payment updated.", "success");
      setReturning(null);
      await load();
    } catch {
      /* the API client shows the server's reason */
    } finally {
      setBusyId(null);
    }
  };

  const canApprove = Boolean(data?.can_approve);
  const canSubmit = Boolean(data?.can_submit);
  const tab = chosenTab ?? (canApprove && !canSubmit ? "SUBMITTED" : "TODO");
  const current = TABS.find((t) => t.value === tab) || TABS[0];

  const all = data?.weeks.flatMap((week) => week.rows) || [];
  const countOf = (statuses: string[] | null) =>
    statuses ? all.filter((p) => statuses.includes(p.status)).length : all.length;
  const weeks = (data?.weeks || [])
    .map((week) => ({
      ...week,
      rows: current.statuses ? week.rows.filter((p) => current.statuses?.includes(p.status)) : week.rows,
    }))
    .filter((week) => week.rows.length > 0);

  const columns: Column<CalendarPayment>[] = [
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
      header: "Status",
      primary: true,
      cell: (p) => (
        <>
          <PaymentStatusPill status={p.status} overdue={p.overdue} />
          {p.status === "PAID" && p.paid_by_name ? (
            <span className={SUB}>by {p.paid_by_name}</span>
          ) : p.status === "APPROVED" && p.approved_by_name ? (
            <span className={SUB}>approved by {p.approved_by_name}</span>
          ) : p.status === "SUBMITTED" && p.submitted_by_name ? (
            <span className={SUB}>from {p.submitted_by_name}</span>
          ) : p.status === "RETURNED" && p.returned_reason ? (
            <span className={SUB}>{p.returned_reason}</span>
          ) : null}
        </>
      ),
    },
    {
      header: "",
      align: "right",
      cell: (p) => {
        const busy = busyId === p.id;
        if (canApprove && p.status === "SUBMITTED") {
          return (
            <span className="flex flex-wrap justify-end gap-3">
              <button type="button" disabled={busy} onClick={() => setReturning(p)} className="text-[12px] font-medium text-[#d00517] hover:underline disabled:opacity-50">
                Return
              </button>
              <button type="button" disabled={busy} onClick={() => step(p, "APPROVE")} className={LINK_BUTTON}>
                Approve
              </button>
            </span>
          );
        }
        if (canApprove && p.status === "APPROVED") {
          return (
            <button type="button" disabled={busy} onClick={() => step(p, "MARK_PAID")} className="text-[12px] font-medium text-emerald-700 hover:underline disabled:opacity-50 dark:text-emerald-400">
              Mark Paid
            </button>
          );
        }
        if (canSubmit && (p.status === "PENDING" || p.status === "RETURNED")) {
          return (
            <Link href={p.link} className={LINK_BUTTON}>
              Fill in &amp; submit
            </Link>
          );
        }
        return null;
      },
    },
  ];

  const summary = data?.summary;

  return (
    <ListPage>
      <ListPageHeader title="Payment Calendar" refreshing={loading} onRefresh={load} />

      <StatGrid cols={5}>
        <StatCard compact label="To Submit" value={summary ? money(summary.with_procurement) : "—"} caption="procurement to send" />
        <StatCard compact label="With Accounts" value={summary ? money(summary.with_accounts) : "—"} caption="waiting for approval" />
        <StatCard compact label="Approved" value={summary ? money(summary.approved) : "—"} caption="to be paid" />
        <StatCard compact label="Overdue" value={summary ? money(summary.overdue) : "—"} caption="past due, unpaid" />
        <StatCard compact label="Paid" value={summary ? money(summary.paid) : "—"} caption="in these weeks" />
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
          Procurement submit each instalment&apos;s cheque or transfer; accounts approve it, then mark it paid. Unpaid
          instalments from before these dates always show, as overdue.
        </p>
      </div>

      <TableCard>
        <QueueTabs
          tabs={TABS.map((t) => ({ value: t.value, label: t.label, count: countOf(t.statuses) }))}
          active={tab}
          onChange={(value) => setChosenTab(value || "ALL")}
          fit
        />

        {loading && !data && !error ? (
          <Loading text="Loading the payment calendar..." />
        ) : error ? (
          <ErrorState text={error} onRetry={() => load().catch(() => {})} />
        ) : weeks.length === 0 ? (
          <Empty
            text={
              all.length === 0
                ? "Nothing to pay in these weeks. Instalments appear here once a purchase order is approved."
                : `Nothing ${current.label.toLowerCase()} in these weeks.`
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
                <DataList rows={week.rows} columns={columns} rowKey={(p) => p.id} dense />
              </section>
            ))}
          </div>
        )}
      </TableCard>

      <Modal
        isOpen={returning !== null}
        onClose={() => busyId === null && setReturning(null)}
        title={returning ? `Return ${returning.po_number} · ${returning.label} to procurement` : ""}
      >
        {returning && (
          <RemarksPrompt
            title="Return to procurement"
            label="Why is it being returned?"
            required
            danger
            confirmLabel="Return to Procurement"
            busy={busyId === returning.id}
            onCancel={() => setReturning(null)}
            onConfirm={(remarks) => step(returning, "REJECT", remarks)}
          />
        )}
      </Modal>
    </ListPage>
  );
}
