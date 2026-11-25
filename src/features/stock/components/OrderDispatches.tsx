"use client";

/**
 * One order's dispatch orders, on the Logistics desk - shown only once the
 * stock ledger is live, when a committed dispatch is what takes stock out.
 * Until then Logistics send orders out themselves and this renders nothing.
 * The server checks dispatch.read and the store on every request.
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { FiPlus } from "react-icons/fi";

import { hasPermission } from "@/features/auth/utils/permissions";
import { DispatchOrder, getDispatchesApi, getLedgerLiveApi } from "@/features/stock/api/dispatch.api";
import { DispatchStatusPill, errorText, qty } from "@/features/stock/components/stockUi";

export default function OrderDispatches({ orderId, children }: { orderId: number; children: (body: React.ReactNode) => React.ReactNode }) {
  const canView = hasPermission("dispatch.read");
  const canManage = hasPermission("dispatch.manage");
  const [live, setLive] = useState<boolean | null>(null);
  const [rows, setRows] = useState<DispatchOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canView) return;
    let current = true;
    getLedgerLiveApi()
      .then(async (isLive) => {
        if (!current) return;
        setLive(isLive);
        if (isLive) {
          const page = await getDispatchesApi({ sales_order_id: orderId, size: 50 });
          if (current) setRows(page.data);
        }
      })
      .catch((err: unknown) => {
        if (current) setError(errorText(err, "Could not load this order's dispatch orders."));
      });
    return () => {
      current = false;
    };
  }, [canView, orderId]);

  if (!canView || live === false) return null;
  if (error) {
    return children(
      <p role="alert" className="text-[12px] text-rose-600">
        {error}
      </p>,
    );
  }
  if (live === null || rows === null) return children(<p className="text-[12px] text-slate-400">Loading dispatch orders...</p>);

  return children(
    <div className="space-y-2">
      {rows.length === 0 ? (
        <p className="text-[12px] text-[#777777] dark:text-slate-400">No dispatch order yet. Reserve, pick and pack the goods, then commit.</p>
      ) : (
        rows.map((d) => (
          <Link
            key={d.id}
            href={`/inventory/dispatch/${d.id}`}
            className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 p-2.5 hover:bg-slate-50 dark:border-[#0d2336] dark:hover:bg-[#0b2034]"
          >
            <span>
              <span className="block font-mono text-[12px] font-semibold text-[#233353] dark:text-sky-300">{d.do_number}</span>
              <span className="text-[11px] text-slate-500">
                {d.warehouse_name || ""} · {qty(d.total_qty)} unit(s)
              </span>
            </span>
            <DispatchStatusPill status={d.status} />
          </Link>
        ))
      )}
      {canManage && (
        <Link
          href={`/inventory/dispatch/new?order=${orderId}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-[12px] font-semibold text-[#233353] hover:bg-slate-50 dark:border-[#17304a] dark:text-sky-300"
        >
          <FiPlus size={13} /> New Dispatch
        </Link>
      )}
    </div>,
  );
}
