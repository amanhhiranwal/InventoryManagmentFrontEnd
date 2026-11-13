"use client";

/**
 * Payment Calendar: a month, like a wall calendar - each PO instalment on
 * the day it falls due, coloured by where it stands. Click one to see its
 * cheque or transfer and take the next step: procurement fill it in and
 * submit it, accounts approve it (or return it with a reason) and mark it
 * paid. Unpaid instalments from earlier months sit in a strip above the
 * month, so a missed payment never drops out of sight. On a phone the
 * month becomes a list of the days that have payments.
 *
 * In both menus, Procurement and Accounts. The server checks every action
 * (purchase_order.manage to submit, purchase_order.pay to approve and pay);
 * the buttons only follow what it says this person may do. The reminder
 * (send_payment_reminders.py, by cron) puts each unpaid instalment in both
 * teams' bell every day until it is paid.
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";

import Modal from "@/components/ui/Modal";
import {
  errorDetail,
  getPaymentCalendarApi,
  paymentActionApi,
  type CalendarPayment,
  type PaymentAction,
  type PaymentCalendar,
} from "@/features/procurement/api/procurement.api";
import { ErrorState, INPUT, LABEL, PaymentStatusPill, day, money } from "@/features/procurement/components/shared";
import { toDateInput } from "@/lib/datetime";
import { useUIStore } from "@/lib/store/ui.store";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
/** How many payments a day shows before "+N more". */
const PER_DAY = 3;

/** A chip's colour: where the instalment stands, red once it is late. */
const CHIP: Record<string, string> = {
  PENDING: "border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-200",
  RETURNED: "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300",
  SUBMITTED: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  APPROVED: "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300",
  PAID: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
};
const LATE = "border-rose-400 bg-rose-50 text-rose-700 dark:border-rose-700 dark:bg-rose-950/40 dark:text-rose-300";

const LEGEND = [
  { status: "PENDING", label: "To submit" },
  { status: "SUBMITTED", label: "With accounts" },
  { status: "APPROVED", label: "Approved" },
  { status: "PAID", label: "Paid" },
];

const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
const addDays = (date: Date, days: number) => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
};
const mondayOf = (date: Date) => addDays(date, -((date.getDay() + 6) % 7));

/** ₹1.2L / ₹45K - short enough for a calendar chip. */
const short = (value: number) =>
  value >= 1e7 ? `₹${(value / 1e7).toFixed(1)}Cr` : value >= 1e5 ? `₹${(value / 1e5).toFixed(1)}L`
    : value >= 1e3 ? `₹${Math.round(value / 1e3)}K` : `₹${Math.round(value)}`;

function Chip({ payment, onOpen }: { payment: CalendarPayment; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      title={`${payment.po_number} · ${payment.vendor_name || ""} · ${money(payment.amount)} · ${payment.stage}`}
      className={`flex w-full items-center justify-between gap-1 truncate rounded border-l-[3px] px-1.5 py-0.5 text-left text-[10px] font-medium leading-4 transition hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#233353] ${
        payment.overdue ? LATE : CHIP[payment.status] || CHIP.PENDING
      }`}
    >
      <span className="truncate">{payment.po_number.replace(/^PO-\d{4}-/, "PO-")}</span>
      <span className="shrink-0 tabular-nums">{short(payment.amount)}</span>
    </button>
  );
}

export default function PaymentCalendarPage() {
  const { addToast } = useUIStore();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [data, setData] = useState<PaymentCalendar | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<CalendarPayment | null>(null);
  const [dayOpen, setDayOpen] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const latest = useRef(0);

  /* Six weeks from the Monday on or before the 1st: every day of the
     month, in whole weeks. */
  const gridStart = useMemo(() => mondayOf(month), [month]);
  const gridDays = useMemo(() => Array.from({ length: 42 }, (_, i) => addDays(gridStart, i)), [gridStart]);
  const first = toDateInput(gridStart);
  const last = toDateInput(gridDays[41]);

  const load = useCallback(async () => {
    const request = ++latest.current;
    setLoading(true);
    setError(null);
    try {
      const answer = await getPaymentCalendarApi({ start: first, end: last });
      if (request === latest.current) setData(answer);
    } catch (failure) {
      if (request === latest.current) setError(errorDetail(failure, "Could not load the payment calendar."));
    } finally {
      if (request === latest.current) setLoading(false);
    }
  }, [first, last]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo(() => data?.weeks.flatMap((week) => week.rows) || [], [data]);
  const byDay = useMemo(() => {
    const map: Record<string, CalendarPayment[]> = {};
    for (const row of rows) if (row.due_date && row.due_date >= first) (map[row.due_date] ||= []).push(row);
    return map;
  }, [rows, first]);
  /* Unpaid from before the month on screen. */
  const earlier = rows.filter((row) => row.due_date && row.due_date < first);

  const monthKey = toDateInput(month).slice(0, 7);
  const inMonth = rows.filter((row) => row.due_date?.startsWith(monthKey));
  const toPay = inMonth.filter((row) => row.status !== "PAID").reduce((sum, row) => sum + row.amount, 0);
  const overdue = rows.filter((row) => row.overdue).reduce((sum, row) => sum + row.amount, 0);
  const today = toDateInput(new Date());
  const canApprove = Boolean(data?.can_approve);
  const canSubmit = Boolean(data?.can_submit);

  const openPayment = (row: CalendarPayment) => {
    setReason("");
    setDayOpen(null);
    setOpen(row);
  };

  const step = async (action: PaymentAction) => {
    if (!open) return;
    if (action === "REJECT" && !reason.trim()) return addToast("Say why it is being returned.", "error");
    setBusy(true);
    try {
      const answer = await paymentActionApi(open.purchase_order_id, open.id, action, action === "REJECT" ? reason.trim() : undefined);
      addToast(answer.message || "Payment updated.", "success");
      setOpen(null);
      await load();
    } catch {
      /* the API client shows the server's reason */
    } finally {
      setBusy(false);
    }
  };

  const shift = (months: number) => setMonth((current) => new Date(current.getFullYear(), current.getMonth() + months, 1));
  const title = month.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  return (
    <div className="space-y-3 pb-8">
      {/* One line: the month and how to move through it, and what it owes. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className="text-[18px] font-semibold text-slate-900 dark:text-white">Payment Calendar</h1>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setMonth(startOfMonth(new Date()))} className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[12px] font-medium text-slate-700 hover:bg-slate-50 dark:border-[#17304a] dark:bg-[#071929] dark:text-slate-200">
            Today
          </button>
          <button type="button" aria-label="Previous month" onClick={() => shift(-1)} className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-[#0b2034]">
            <FiChevronLeft size={16} />
          </button>
          <button type="button" aria-label="Next month" onClick={() => shift(1)} className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-[#0b2034]">
            <FiChevronRight size={16} />
          </button>
          <h2 className="min-w-[9rem] text-[15px] font-medium text-[#474747] dark:text-slate-200" aria-live="polite">{title}</h2>
        </div>
        <p className="text-[12px] text-[#777777] dark:text-slate-400">
          <span className="font-semibold text-[#141414] dark:text-white">{money(toPay)}</span> to pay this month
          {overdue > 0 && (
            <>
              {" · "}
              <span className="font-semibold text-rose-600 dark:text-rose-400">{money(overdue)} overdue</span>
            </>
          )}
          {loading && " · loading..."}
        </p>
        <ul className="ml-auto flex flex-wrap gap-3 text-[11px] text-[#777777] dark:text-slate-400" aria-label="Colours">
          {LEGEND.map((item) => (
            <li key={item.status} className="flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-sm border ${CHIP[item.status]}`} />
              {item.label}
            </li>
          ))}
          <li className="flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-sm border ${LATE}`} />
            Overdue
          </li>
        </ul>
      </div>

      {error && <ErrorState text={error} onRetry={load} />}

      {earlier.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-rose-200 bg-rose-50/60 px-3 py-2 dark:border-rose-900 dark:bg-rose-950/20">
          <span className="text-[12px] font-medium text-rose-700 dark:text-rose-300">Still unpaid from earlier:</span>
          {earlier.map((row) => (
            <span key={row.id} className="w-36">
              <Chip payment={row} onOpen={() => openPayment(row)} />
            </span>
          ))}
        </div>
      )}

      {/* The month: seven columns from tablet width up. */}
      <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white md:block dark:border-[#17304a] dark:bg-[#071929]">
        <div className="grid grid-cols-7 border-b border-slate-200 dark:border-[#17304a]">
          {WEEKDAYS.map((name) => (
            <div key={name} className="px-2 py-1.5 text-center text-[11px] font-medium text-[#777777] dark:text-slate-400">{name}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {gridDays.map((date) => {
            const key = toDateInput(date);
            const items = byDay[key] || [];
            const outside = date.getMonth() !== month.getMonth();
            return (
              <div
                key={key}
                className={`min-h-[96px] border-b border-r border-slate-100 p-1 dark:border-[#17304a] ${outside ? "bg-slate-50/60 dark:bg-[#051422]" : ""}`}
              >
                <div className="mb-1 flex justify-end">
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] ${
                      key === today
                        ? "bg-[#233353] font-semibold text-white"
                        : outside
                          ? "text-slate-400 dark:text-slate-600"
                          : "text-[#474747] dark:text-slate-300"
                    }`}
                  >
                    {date.getDate()}
                  </span>
                </div>
                <div className="space-y-0.5">
                  {items.slice(0, PER_DAY).map((row) => (
                    <Chip key={row.id} payment={row} onOpen={() => openPayment(row)} />
                  ))}
                  {items.length > PER_DAY && (
                    <button type="button" onClick={() => setDayOpen(key)} className="w-full px-1.5 text-left text-[10px] font-medium text-[#233353] hover:underline dark:text-sky-300">
                      +{items.length - PER_DAY} more
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* A phone: only the days that have payments, as a list. */}
      <div className="space-y-2 md:hidden">
        {Object.keys(byDay).filter((key) => key.startsWith(monthKey)).sort().length === 0 && !loading ? (
          <p className="rounded-xl bg-white px-4 py-8 text-center text-[13px] text-[#777777] dark:bg-[#071929] dark:text-slate-400">
            No payments due in {title}.
          </p>
        ) : (
          Object.keys(byDay)
            .filter((key) => key.startsWith(monthKey))
            .sort()
            .map((key) => (
              <div key={key} className="rounded-xl bg-white p-3 dark:border dark:border-[#17304a] dark:bg-[#071929]">
                <p className={`mb-2 text-[12px] font-medium ${key === today ? "text-[#233353] dark:text-sky-300" : "text-[#474747] dark:text-slate-300"}`}>
                  {new Date(`${key}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
                  {key === today && " · Today"}
                </p>
                <div className="space-y-1">
                  {byDay[key].map((row) => (
                    <button
                      key={row.id}
                      type="button"
                      onClick={() => openPayment(row)}
                      className={`flex w-full items-center justify-between gap-2 rounded-md border-l-[3px] px-2.5 py-2 text-left text-[12px] ${row.overdue ? LATE : CHIP[row.status] || CHIP.PENDING}`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{row.po_number}</span>
                        <span className="block truncate text-[11px] opacity-80">{row.vendor_name} · {row.stage}</span>
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums">{money(row.amount)}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))
        )}
      </div>

      {/* Every payment of a busy day. */}
      <Modal
        isOpen={dayOpen !== null}
        onClose={() => setDayOpen(null)}
        title={dayOpen ? new Date(`${dayOpen}T00:00:00`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" }) : ""}
      >
        <div className="space-y-1">
          {(dayOpen ? byDay[dayOpen] || [] : []).map((row) => (
            <Chip key={row.id} payment={row} onOpen={() => openPayment(row)} />
          ))}
        </div>
      </Modal>

      {/* One payment: what it is, how it is paid, and the next step. */}
      <Modal
        isOpen={open !== null}
        onClose={() => !busy && setOpen(null)}
        title={open ? `${open.po_number} · ${open.label}` : ""}
      >
        {open && (
          <div className="space-y-3 text-[13px]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <PaymentStatusPill status={open.status} overdue={open.overdue} />
              <span className="text-[18px] font-semibold tabular-nums text-[#141414] dark:text-white">{money(open.amount)}</span>
            </div>
            <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1.5">
              <dt className="text-[#777777]">Vendor</dt>
              <dd>{open.vendor_name || "—"}</dd>
              <dt className="text-[#777777]">Due</dt>
              <dd>{day(open.due_date)}{open.overdue && <span className="ml-1 text-rose-600">· overdue</span>}</dd>
              <dt className="text-[#777777]">Paid by</dt>
              <dd>
                {open.mode === "PDC"
                  ? `Cheque ${open.cheque_number || "(number not entered)"}${open.bank_name ? `, ${open.bank_name}` : ""}${open.cheque_date ? `, dated ${day(open.cheque_date)}` : ""}`
                  : `Bank transfer${open.bank_name ? `, ${open.bank_name}` : ""}${open.reference ? ` (${open.reference})` : ""}`}
              </dd>
              {open.submitted_by_name && (
                <>
                  <dt className="text-[#777777]">Submitted by</dt>
                  <dd>{open.submitted_by_name}</dd>
                </>
              )}
              {open.approved_by_name && (
                <>
                  <dt className="text-[#777777]">Approved by</dt>
                  <dd>{open.approved_by_name}</dd>
                </>
              )}
              {open.paid_by_name && (
                <>
                  <dt className="text-[#777777]">Paid by</dt>
                  <dd>{open.paid_by_name}</dd>
                </>
              )}
            </dl>
            {open.status === "RETURNED" && open.returned_reason && (
              <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-[12px] text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
                Returned by {open.returned_by_name || "accounts"}: {open.returned_reason}
              </p>
            )}
            {canApprove && open.status === "SUBMITTED" && (
              <div>
                <label className={LABEL} htmlFor="cal-reason">Reason, if returning it to procurement</label>
                <input id="cal-reason" className={INPUT} value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>
            )}
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#f3f3f3] pt-3 dark:border-[#17304a]">
              <Link href={open.link} className="mr-auto text-[12px] font-medium text-[#233353] hover:underline dark:text-sky-300">
                Open the PO
              </Link>
              {canSubmit && (open.status === "PENDING" || open.status === "RETURNED") && (
                <Link href={open.link} className="rounded-lg bg-[#243454] px-3.5 py-2 text-[13px] font-medium text-white hover:bg-[#18243a]">
                  Fill in &amp; submit
                </Link>
              )}
              {canApprove && open.status === "SUBMITTED" && (
                <>
                  <button
                    type="button"
                    disabled={busy || !reason.trim()}
                    title={reason.trim() ? undefined : "Enter the reason first"}
                    onClick={() => step("REJECT")}
                    className="rounded-lg border border-[#f7969e] px-3.5 py-2 text-[13px] text-[#d00517] disabled:opacity-50"
                  >
                    Return
                  </button>
                  <button type="button" disabled={busy} onClick={() => step("APPROVE")} className="rounded-lg bg-[#243454] px-3.5 py-2 text-[13px] font-medium text-white hover:bg-[#18243a] disabled:opacity-50">
                    Approve
                  </button>
                </>
              )}
              {canApprove && open.status === "APPROVED" && (
                <button type="button" disabled={busy} onClick={() => step("MARK_PAID")} className="rounded-lg bg-emerald-600 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
                  Mark Paid
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
