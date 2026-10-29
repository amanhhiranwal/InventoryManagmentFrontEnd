"use client";

/**
 * What an order asks for against the shelf, and what it has already taken
 * off it. Shared by the production desk, which names a serial for every
 * unit and issues it, and the logistics desk, which sends those units out.
 */

import Link from "next/link";

import { FiCheckCircle, FiPackage } from "react-icons/fi";

import { hasPermission } from "@/features/auth/utils/permissions";
import { DeskOrder } from "@/features/fulfilment/api/fulfilment.api";
import { Panel } from "@/features/fulfilment/components/DeskPanels";
import { DeskDetailContext } from "@/features/fulfilment/components/DeskBoard";
import SerialEntry from "@/features/fulfilment/components/SerialEntry";
import { SALES_ORDER_STATUS } from "@/features/salesOrders/api/salesOrders.api";
import DownloadButton from "@/features/fulfilment/components/DownloadButton";
import { downloadProformaInvoicePdfApi } from "@/features/proformaInvoices/api/proformaInvoices.api";

export default function StockDetail({
  order,
  desk = "production",
  context,
}: {
  order: DeskOrder;
  /** Given on the production desk, where the serials set the button. */
  context?: DeskDetailContext;
  /** Production is told a short line need not stop them; logistics only
      sends out what production confirmed. */
  desk?: "production" | "logistics";
}) {
  const lines = order.stock || [];
  const moved = order.stock_movements || [];

  const invoice = order.proforma_invoice;

  return (
    <div className="space-y-6">
      {/* The invoice the order was paid against, for production and
          logistics - they work from their desks, not the order's page. */}
      {invoice && (
        <div className="flex flex-wrap gap-2">
          <DownloadButton
            label={
              invoice.pi_number
                ? `Download PI (${invoice.pi_number})`
                : "Download PI"
            }
            download={() =>
              downloadProformaInvoicePdfApi(invoice.id, invoice.pi_number)
            }
          />
        </div>
      )}

      <Panel title="Stock Against This Order" icon={<FiPackage size={14} />}>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-200 dark:border-[#17304a]">
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
                  className="border-b border-slate-100 last:border-0 dark:border-[#17304a]/70"
                >
                  <td className="px-3 py-2.5 text-[11px] font-medium text-slate-800 dark:text-slate-100">
                    {line.product}
                  </td>
                  <td className="px-3 py-2.5 text-[11px] text-slate-500 dark:text-slate-400">
                    {line.sku || "-"}
                  </td>
                  <td className="px-3 py-2.5 text-right text-[11px] text-slate-700 dark:text-slate-200">
                    {line.wanted}
                  </td>
                  <td className="px-3 py-2.5 text-right text-[11px] text-slate-700 dark:text-slate-200">
                    {line.known ? line.available : "-"}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {!line.known ? (
                      <Tag tone="neutral">Not in the catalogue</Tag>
                    ) : line.short ? (
                      <Tag tone="warn">
                        Short by{" "}
                        {Number(line.wanted) - Number(line.available || 0)}
                      </Tag>
                    ) : (
                      <Tag tone="good">Covered</Tag>
                    )}
                  </td>
                </tr>
              ))}

              {lines.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-6 text-center text-[11px] text-slate-400"
                  >
                    No lines on this order.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {desk === "production" && (
          <p className="text-[11px] text-[#777777] dark:text-slate-400">
            A short line does not stop you: carry on if the stock is on order,
            or reject the order so the reason is on record.
            {/* The catalogue is the Inventory role's page; whoever cannot
                open it is not offered a link that would refuse them. */}
            {hasPermission("inventory.read") && (
              <>
                {" "}
                <Link
                  href="/inventory"
                  className="font-medium text-[#233353] hover:underline dark:text-sky-400"
                >
                  Open the catalogue
                </Link>{" "}
                to add a product or correct a count.
              </>
            )}
          </p>
        )}
      </Panel>

      {desk === "production" &&
        context &&
        order.status === SALES_ORDER_STATUS.PROCUREMENT && (
          <SerialEntry order={order} context={context} />
        )}

      <Panel title="Issued From Stock" icon={<FiCheckCircle size={14} />}>
        {moved.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-200 dark:border-[#17304a]">
                  <Th>Serial</Th>
                  <Th>Product</Th>
                  <Th className="text-right">Stock</Th>
                  <Th>By</Th>
                  <Th>When</Th>
                </tr>
              </thead>
              <tbody>
                {moved.map((line, index) => (
                  <tr
                    key={index}
                    className="border-b border-slate-100 last:border-0 dark:border-[#17304a]/70"
                  >
                    <td className="px-3 py-2.5 text-[11px] font-medium text-slate-800 dark:text-slate-100">
                      {line.serial_number || "-"}
                      {line.direction === "IN" && (
                        <span className="ml-1.5 text-[10px] text-amber-600 dark:text-amber-400">
                          returned
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-[11px] text-slate-700 dark:text-slate-200">
                      {line.quantity} × {line.product}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right text-[11px] text-slate-700 dark:text-slate-200">
                      {line.stock_before} → {line.stock_after}
                    </td>
                    <td className="px-3 py-2.5 text-[11px] text-slate-500 dark:text-slate-400">
                      {line.actor || "-"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-[11px] text-slate-500 dark:text-slate-400">
                      {line.created_at ? formatWhen(line.created_at) : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-[11px] text-[#777777] dark:text-slate-400">
            Nothing yet. Units come off the shelf when production mark the order
            ready, one serial number at a time.
          </p>
        )}
      </Panel>
    </div>
  );
}

/** "29 Oct, 7:37 pm" - the timestamps are stored in UTC. */
function formatWhen(iso: string): string {
  const stamp = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);

  return stamp.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
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
      className={`whitespace-nowrap px-3 py-2.5 text-left text-[11px] font-medium text-slate-500 ${className}`}
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
    neutral:
      "bg-slate-100 text-slate-500 dark:bg-slate-800/60 dark:text-slate-300",
  };

  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-1 text-[10px] font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
