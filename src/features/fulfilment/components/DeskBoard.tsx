"use client";

/**
 * A desk's working screen.
 *
 * The same shape for accounts and for inventory, because the job is the
 * same one: a queue of orders waiting on you, the numbers that say how
 * badly, and one decision per order - send it on, or hold it with a
 * reason. What differs is what each desk needs in front of it to decide,
 * which is what `detail` supplies.
 *
 * Laid out like the rest of the product's list screens - KPI row, search,
 * one table - rather than as cards, so a desk with two hundred orders
 * reads the same as one with two. The decision happens in a side drawer,
 * which keeps the queue on screen behind it.
 */

import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { CgSpinner } from "react-icons/cg";
import { LuCheck, LuTriangleAlert, LuX } from "react-icons/lu";
import { FiX } from "react-icons/fi";

import { StatusPill } from "@/components/crm/Pill";
import StatCard from "@/components/crm/StatCard";
import {
  LIST_TABLE,
  ListPage,
  ListPageHeader,
  ListToolbar,
  StatGrid,
  TableCard,
} from "@/components/crm/ListPageShell";
import QueueTabs from "@/features/fulfilment/components/QueueTabs";
import { useUIStore } from "@/lib/store/ui.store";
import {
  DeskOrder,
  DeskQueue,
  decideOrderApi,
  formatKpi,
  money,
  stageLabel,
} from "@/features/fulfilment/api/fulfilment.api";

/** Orders sitting this long at one desk are worth a second look. */
const STALE_DAYS = 7;

export default function DeskBoard({
  title,
  description,
  load,
  detail,
  approveLabel = "Approve",
  emptyNote,
}: {
  title: string;
  description: string;
  load: () => Promise<DeskQueue>;
  /** What this desk needs in front of it before deciding. */
  detail: (order: DeskOrder) => ReactNode;
  approveLabel?: string;
  emptyNote: string;
}) {
  const { addToast } = useUIStore();

  const [queue, setQueue] = useState<DeskQueue | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [denied, setDenied] = useState(false);
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState<string | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [remarks, setRemarks] = useState("");
  const [deciding, setDeciding] = useState(false);

  const refresh = useCallback(
    async (quiet = false) => {
      try {
        if (quiet) setRefreshing(true);
        else setLoading(true);

        setQueue(await load());
        setDenied(false);
      } catch (error) {
        const status = (error as { response?: { status?: number } })?.response
          ?.status;

        if (status === 403) setDenied(true);
        else addToast("Could not load the queue.", "error");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [load, addToast],
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  const all = useMemo(() => queue?.orders || [], [queue]);

  const orders = useMemo(() => {
    const term = search.trim().toLowerCase();

    return all.filter((order) => {
      if (stage && order.status !== stage) return false;
      if (!term) return true;

      return [order.order_number, order.customer_name, order.company_name]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(term));
    });
  }, [all, search, stage]);

  const selected = all.find((order) => order.id === open) || null;

  const decide = async (order: DeskOrder, approve: boolean) => {
    const note = remarks.trim();

    if (!approve && !note) {
      addToast(
        "Say why it is being rejected - it goes on hold with the reason.",
        "error",
      );
      return;
    }

    setDeciding(true);

    try {
      await decideOrderApi(order.id, approve, note);

      addToast(
        approve
          ? `${order.order_number} moved to ${stageLabel(order.approves_to || "")}.`
          : `${order.order_number} put on hold.`,
        approve ? "success" : "info",
      );

      setRemarks("");
      setOpen(null);
      await refresh(true);
    } catch (error) {
      const detailText =
        (error as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "That decision could not be recorded.";
      addToast(detailText, "error");
    } finally {
      setDeciding(false);
    }
  };

  if (denied) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center rounded-xl bg-white p-8 text-center dark:border dark:border-[#17304a] dark:bg-[#071929]">
        <h2 className="mb-2 text-lg font-semibold text-[#141414] dark:text-white">
          You don&apos;t have access to this desk
        </h2>
        <p className="max-w-md text-[13px] text-[#777777] dark:text-slate-400">
          This desk is worked by a specific role. Ask your administrator to
          grant it in Masters → Roles &amp; Access.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center gap-2 text-slate-400">
        <CgSpinner className="animate-spin text-2xl text-[#233353]" />
        <span className="text-xs">Loading the queue...</span>
      </div>
    );
  }

  return (
    <ListPage>
      <ListPageHeader
        title={title}
        refreshing={refreshing}
        onRefresh={() => refresh(true)}
        actions={
          <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600 dark:bg-[#0b2034] dark:text-slate-300">
            {all.length}
          </span>
        }
      />

      <p className="-mt-3 text-[13px] text-[#777777] dark:text-slate-400">
        {description}
      </p>

      <StatGrid cols={6}>
        {(queue?.kpis || []).map((kpi) => (
          <StatCard
            key={kpi.key}
            compact
            label={kpi.label}
            value={formatKpi(kpi)}
            caption={kpi.hint || ""}
            change={
              kpi.tone === "warn" && kpi.value > 0 ? "action" : undefined
            }
            positive={false}
          />
        ))}
      </StatGrid>

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        placeholder={`Search ${title.toLowerCase()}`}
      />

      <TableCard>
        {/* Which part of the queue, on the table rather than beside the
            search box: these are not actions. */}
        <QueueTabs
          tabs={[
            { value: null, label: "All Orders", count: all.length },
            ...(queue?.stages || []).map((option) => ({
              value: option.status,
              label: option.label,
              count: option.count,
            })),
          ]}
          active={stage}
          onChange={setStage}
        />

        <div className="overflow-x-auto">
          <table className={`w-full min-w-[920px] text-left ${LIST_TABLE}`}>
            <thead>
              <tr>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3 text-right">Order Value</th>
                <th className="px-4 py-3 text-right">Advance</th>
                <th className="px-4 py-3 text-right">Outstanding</th>
                <th className="px-4 py-3">Waiting On</th>
                <th className="px-4 py-3 text-right">Ageing</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>

            <tbody>
              {orders.map((order) => (
                <tr
                  key={order.id}
                  onClick={() => {
                    setOpen(order.id);
                    setRemarks("");
                  }}
                  className="cursor-pointer border-b border-slate-100 transition last:border-0 hover:bg-slate-50/70 dark:border-[#0f2942] dark:hover:bg-[#0b2034]"
                >
                  <td className="whitespace-nowrap px-4 py-3 text-[12px] font-semibold text-slate-800 dark:text-slate-100">
                    {order.order_number || `#${order.id}`}
                  </td>

                  <td className="px-4 py-3">
                    <p className="text-[12px] text-slate-800 dark:text-slate-100">
                      {order.customer_name}
                    </p>
                    <p className="mt-0.5 text-[10px] text-slate-400">
                      {[order.company_name, order.state]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </td>

                  <td className="whitespace-nowrap px-4 py-3 text-right text-[12px] text-slate-700 dark:text-slate-200">
                    {money(order.grand_total)}
                  </td>

                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <span
                      className={`text-[12px] ${
                        order.advance_settled
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-amber-600 dark:text-amber-400"
                      }`}
                    >
                      {money(order.advance_received)}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {" "}
                      / {money(order.advance_expected)}
                    </span>
                  </td>

                  <td className="whitespace-nowrap px-4 py-3 text-right text-[12px]">
                    {order.outstanding_balance > 0 ? (
                      <span className="text-rose-500">
                        {money(order.outstanding_balance)}
                      </span>
                    ) : (
                      <span className="text-slate-300 dark:text-slate-600">—</span>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <StatusPill status={order.status} />
                      {order.stock_short && (
                        <span
                          title="At least one line the shelf cannot cover"
                          className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-600 dark:bg-amber-950/30 dark:text-amber-400"
                        >
                          <LuTriangleAlert size={10} />
                          Short
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <span
                      className={`text-[12px] ${
                        order.waiting_days >= STALE_DAYS
                          ? "font-semibold text-amber-600 dark:text-amber-400"
                          : "text-slate-500 dark:text-slate-400"
                      }`}
                    >
                      {order.waiting_days}d
                    </span>
                  </td>

                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <span className="text-[11px] font-semibold text-[#233353] dark:text-sky-400">
                      Review
                    </span>
                  </td>
                </tr>
              ))}

              {orders.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center">
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                      {all.length === 0
                        ? "Nothing waiting on you"
                        : "Nothing matches that filter"}
                    </p>
                    <p className="mx-auto mt-1 max-w-sm text-xs text-slate-400">
                      {all.length === 0 ? emptyNote : "Clear the search or the stage filter."}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {orders.length > 0 && (
          <div className="border-t border-slate-100 px-4 py-3 text-[11px] text-[#777777] dark:border-[#17304a] dark:text-slate-400">
            Showing {orders.length} of {all.length} order
            {all.length === 1 ? "" : "s"} at this desk
          </div>
        )}
      </TableCard>

      {selected && (
        <Drawer
          order={selected}
          detail={detail}
          approveLabel={approveLabel}
          remarks={remarks}
          onRemarks={setRemarks}
          deciding={deciding}
          onClose={() => setOpen(null)}
          onDecide={decide}
        />
      )}
    </ListPage>
  );
}

/** The decision, over the queue rather than instead of it. */
function Drawer({
  order,
  detail,
  approveLabel,
  remarks,
  onRemarks,
  deciding,
  onClose,
  onDecide,
}: {
  order: DeskOrder;
  detail: (order: DeskOrder) => ReactNode;
  approveLabel: string;
  remarks: string;
  onRemarks: (value: string) => void;
  deciding: boolean;
  onClose: () => void;
  onDecide: (order: DeskOrder, approve: boolean) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/30 backdrop-blur-[1px]"
      />

      <aside className="relative flex h-full w-full max-w-[720px] flex-col bg-white shadow-2xl dark:bg-[#051422]">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5 dark:border-[#17304a]">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[16px] font-semibold text-slate-900 dark:text-white">
                {order.customer_name}
              </h2>
              <StatusPill status={order.status} />
            </div>

            <p className="mt-1 text-[11px] text-slate-400">
              {order.order_number}
              {order.company_name ? ` · ${order.company_name}` : ""} ·{" "}
              {order.waiting_days}d at this desk
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 dark:hover:bg-[#0b2034]"
          >
            <FiX size={16} />
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <p className="rounded-lg bg-slate-50 px-4 py-3 text-[12px] font-medium text-slate-700 dark:bg-[#0b2034] dark:text-slate-200">
            {order.asks}
          </p>

          {detail(order)}
        </div>

        <footer className="space-y-3 border-t border-slate-200 px-6 py-4 dark:border-[#17304a]">
          <input
            value={remarks}
            onChange={(event) => onRemarks(event.target.value)}
            placeholder="Remarks — required to reject"
            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 text-[13px] text-slate-800 outline-none transition focus:border-[#233353] focus:bg-white dark:border-[#17304a] dark:bg-[#071929] dark:text-white"
          />

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={deciding}
              onClick={() => onDecide(order, true)}
              className="flex h-10 items-center gap-2 rounded-xl bg-[#273756] px-5 text-xs font-bold text-white transition hover:bg-[#18243a] disabled:opacity-50"
            >
              {deciding ? (
                <CgSpinner className="animate-spin" size={14} />
              ) : (
                <LuCheck size={14} />
              )}
              {approveLabel}
            </button>

            <button
              type="button"
              disabled={deciding}
              onClick={() => onDecide(order, false)}
              className="flex h-10 items-center gap-2 rounded-xl border border-rose-200 px-5 text-xs font-bold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900/40 dark:hover:bg-rose-950/20"
            >
              <LuX size={14} />
              Reject
            </button>

            <span className="text-[11px] text-slate-400">
              Approving moves it to {stageLabel(order.approves_to || "")};
              rejecting puts it on hold with your remarks.
            </span>
          </div>
        </footer>
      </aside>
    </div>
  );
}
