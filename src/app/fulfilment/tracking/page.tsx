"use client";

/**
 * Order Tracking.
 *
 * Where every order has got to, and whose move it is. Read-only on
 * purpose: moving an order is the desk's job, and this exists so a CEO,
 * an AVP or a Zonal Head can answer "where is that order?" without asking
 * two departments.
 *
 * Laid out the way an operations board is: the numbers, then the pipeline
 * as a row of stages that can be clicked to filter, then a table with one
 * line per order. A card list looked fine with six orders and would be
 * unreadable with six hundred.
 *
 * It only ever shows orders the caller could already open - the sales
 * roles see their own reporting line, the desks and the super admin see
 * everything.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { CgSpinner } from "react-icons/cg";
import { FiRefreshCw, FiSearch } from "react-icons/fi";
import { LuArrowRight, LuTriangleAlert } from "react-icons/lu";
import { useRouter } from "next/navigation";

import { StatusPill } from "@/components/crm/Pill";
import StatCard from "@/components/crm/StatCard";
import { StatGrid, TableCard } from "@/components/crm/ListPageShell";
import { useUIStore } from "@/lib/store/ui.store";
import {
  TrackingBoard,
  TrackedOrder,
  formatKpi,
  getTrackingBoardApi,
  money,
  stageLabel,
} from "@/features/fulfilment/api/fulfilment.api";

/** Orders sitting this long at one stage are worth a second look. */
const STALE_DAYS = 7;

export default function OrderTrackingPage() {
  const router = useRouter();
  const { addToast } = useUIStore();

  const [board, setBoard] = useState<TrackingBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState<string | null>(null);
  const [desk, setDesk] = useState<"ALL" | "Accounts" | "Inventory">("ALL");

  const refresh = useCallback(
    async (quiet = false) => {
      try {
        if (quiet) setRefreshing(true);
        else setLoading(true);

        setBoard(await getTrackingBoardApi());
      } catch (error) {
        console.error(error);
        addToast("Could not load the tracking board.", "error");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [addToast],
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  const all = useMemo(() => board?.orders || [], [board]);

  /** How many orders sit at each stage, for the pipeline strip. */
  const perStage = useMemo(() => {
    const counts: Record<string, number> = {};

    for (const order of all) {
      counts[order.status] = (counts[order.status] || 0) + 1;
    }

    return counts;
  }, [all]);

  const orders = useMemo(() => {
    const term = search.trim().toLowerCase();

    return all.filter((order) => {
      if (stage && order.status !== stage) return false;
      if (desk !== "ALL" && order.with_desk !== desk) return false;
      if (!term) return true;

      return [order.order_number, order.customer_name, order.company_name]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(term));
    });
  }, [all, search, stage, desk]);

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center gap-2 text-slate-400">
        <CgSpinner className="animate-spin text-2xl text-[#233353]" />
        <span className="text-xs">Loading the board...</span>
      </div>
    );
  }

  const pipeline = board?.pipeline || [];

  return (
    <div className="min-h-full space-y-5 pb-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[18px] font-semibold text-slate-900 dark:text-white">
              Order Tracking
            </h1>

            <button
              type="button"
              onClick={() => refresh(true)}
              aria-label="Refresh Order Tracking"
              className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 dark:border-[#17304a] dark:bg-[#071929]"
            >
              <FiRefreshCw size={11} className={refreshing ? "animate-spin" : ""} />
            </button>
          </div>

          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Every order and whose move it is. Read-only — accounts and
            procurement move them from their own desks.
          </p>
        </div>

        <div className="flex gap-1.5">
          {(["ALL", "Accounts", "Inventory"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setDesk(option)}
              className={`h-[34px] rounded-lg px-3.5 text-[12px] font-semibold transition ${
                desk === option
                  ? "bg-[#273756] text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-[#17304a] dark:bg-[#071929] dark:text-slate-300"
              }`}
            >
              {option === "ALL" ? "Everything" : `With ${option}`}
            </button>
          ))}
        </div>
      </div>

      <StatGrid cols={6}>
        {(board?.kpis || []).map((kpi) => (
          <StatCard
            key={kpi.key}
            compact
            label={kpi.label}
            value={formatKpi(kpi)}
            caption={kpi.hint || ""}
          />
        ))}
      </StatGrid>

      {/* The journey itself, as a row of stages. Clicking one filters the
          table below, which is how people actually use a board like this:
          "show me everything stuck in procurement". */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-[#17304a] dark:bg-[#071929]">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            The Journey
          </p>

          {stage && (
            <button
              type="button"
              onClick={() => setStage(null)}
              className="text-[11px] font-semibold text-[#233353] hover:underline dark:text-sky-400"
            >
              Clear filter
            </button>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-stretch gap-1.5">
          {pipeline.map((step, index) => {
            const count = perStage[step] || 0;
            const selected = stage === step;

            return (
              <div key={step} className="flex items-stretch gap-1.5">
                <button
                  type="button"
                  onClick={() => setStage(selected ? null : step)}
                  className={`min-w-[104px] rounded-lg border px-3 py-2 text-left transition ${
                    selected
                      ? "border-[#233353] bg-[#233353] text-white"
                      : count > 0
                        ? "border-slate-200 bg-white hover:border-slate-300 dark:border-[#17304a] dark:bg-[#0b2034]"
                        : "border-dashed border-slate-200 bg-white dark:border-[#17304a] dark:bg-transparent"
                  }`}
                >
                  <p
                    className={`text-[10px] leading-tight ${
                      selected ? "text-white/70" : "text-slate-400"
                    }`}
                  >
                    {stageLabel(step)}
                  </p>
                  <p
                    className={`mt-0.5 text-[17px] font-semibold leading-none ${
                      selected
                        ? "text-white"
                        : count > 0
                          ? "text-[#233353] dark:text-white"
                          : "text-slate-300 dark:text-slate-600"
                    }`}
                  >
                    {count}
                  </p>
                </button>

                {index < pipeline.length - 1 && (
                  <LuArrowRight
                    size={12}
                    className="self-center text-slate-300 dark:text-slate-600"
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="relative">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by order, customer or company"
          className="h-[39px] w-full rounded-lg border border-[#cccccc] bg-[#f3f3f3] pl-3.5 pr-10 text-[13px] text-[#141414] outline-none transition placeholder:text-[#aaaaaa] focus:border-[#233353] dark:border-[#17304a] dark:bg-[#071929] dark:text-white"
        />
        <FiSearch
          size={15}
          className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[#131313] dark:text-slate-400"
        />
      </div>

      <TableCard>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left">
            <thead>
              <tr className="border-b border-slate-200 dark:border-[#17304a]">
                <Th>Order</Th>
                <Th>Customer</Th>
                <Th className="text-right">Value</Th>
                <Th className="text-right">Outstanding</Th>
                <Th>Stage</Th>
                <Th>With</Th>
                <Th className="text-right">Ageing</Th>
                <Th className="w-[220px]">Progress</Th>
              </tr>
            </thead>

            <tbody>
              {orders.map((order) => (
                <tr
                  key={order.id}
                  onClick={() => router.push(`/sales/orders/${order.id}`)}
                  className="cursor-pointer border-b border-slate-100 transition last:border-0 hover:bg-slate-50/70 dark:border-[#0f2942] dark:hover:bg-[#0b2034]"
                >
                  <td className="whitespace-nowrap px-4 py-3 text-[12px] font-semibold text-slate-800 dark:text-slate-100">
                    {order.order_number || `#${order.id}`}
                  </td>

                  <td className="px-4 py-3">
                    <p className="text-[12px] text-slate-800 dark:text-slate-100">
                      {order.customer_name}
                    </p>
                    {order.company_name && (
                      <p className="mt-0.5 text-[10px] text-slate-400">
                        {order.company_name}
                      </p>
                    )}
                  </td>

                  <td className="whitespace-nowrap px-4 py-3 text-right text-[12px] text-slate-700 dark:text-slate-200">
                    {money(order.grand_total)}
                  </td>

                  <td
                    className={`whitespace-nowrap px-4 py-3 text-right text-[12px] ${
                      order.outstanding_balance > 0
                        ? "text-slate-700 dark:text-slate-200"
                        : "text-emerald-600 dark:text-emerald-400"
                    }`}
                  >
                    {order.outstanding_balance > 0
                      ? money(order.outstanding_balance)
                      : "Settled"}
                  </td>

                  <td className="px-4 py-3">
                    <StatusPill status={order.status} />
                  </td>

                  <td className="whitespace-nowrap px-4 py-3 text-[12px] text-slate-600 dark:text-slate-300">
                    {order.with_desk || (
                      <span className="text-slate-300 dark:text-slate-600">—</span>
                    )}
                  </td>

                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <span
                      className={`inline-flex items-center gap-1 text-[12px] ${
                        order.waiting_days >= STALE_DAYS
                          ? "font-semibold text-amber-600 dark:text-amber-400"
                          : "text-slate-500 dark:text-slate-400"
                      }`}
                    >
                      {order.waiting_days >= STALE_DAYS && (
                        <LuTriangleAlert size={11} />
                      )}
                      {order.waiting_days}d
                    </span>
                  </td>

                  <td className="px-4 py-3">
                    <Progress pipeline={board?.pipeline || []} order={order} />
                  </td>
                </tr>
              ))}

              {orders.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-14 text-center">
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                      Nothing to show
                    </p>
                    <p className="mx-auto mt-1 max-w-sm text-xs text-slate-400">
                      No order matches that filter, or none has reached
                      fulfilment yet.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </TableCard>
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
      className={`whitespace-nowrap px-4 py-3 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 ${className}`}
    >
      {children}
    </th>
  );
}

/** One order's journey as a bar, with the stage reached filled in. */
function Progress({
  pipeline,
  order,
}: {
  pipeline: string[];
  order: TrackedOrder;
}) {
  const reached = order.stage_index;

  return (
    <div>
      <div className="flex gap-0.5">
        {pipeline.map((step, index) => {
          const done = reached !== null && index < reached;
          const here = reached !== null && index === reached;

          return (
            <span
              key={step}
              title={stageLabel(step)}
              className={`h-1.5 flex-1 rounded-full ${
                here
                  ? "bg-[#233353] dark:bg-sky-400"
                  : done
                    ? "bg-emerald-400"
                    : "bg-slate-200 dark:bg-[#17304a]"
              }`}
            />
          );
        })}
      </div>

      <p className="mt-1 text-[10px] text-slate-400">
        {order.waiting_for
          ? order.waiting_for
          : reached === null
            ? stageLabel(order.status)
            : `Step ${reached + 1} of ${pipeline.length}`}
      </p>
    </div>
  );
}
