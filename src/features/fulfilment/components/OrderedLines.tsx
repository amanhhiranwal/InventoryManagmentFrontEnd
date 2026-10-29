/* What an order is for, as a small table in the sales order page's own
   table style: product, SKU, quantity, rate and amount. */

import { DeskOrder, money } from "@/features/fulfilment/api/fulfilment.api";

const quantityOf = (item: Record<string, unknown>) =>
  Number(item.quantity_case ?? item.qty ?? item.quantity ?? 1) || 0;

/* Orders raised from the form carry the price; ones raised elsewhere can
   carry it as the rate with a price of nought. */
const rateOf = (item: Record<string, unknown>) =>
  Number(item.price) || Number(item.rate) || 0;

export default function OrderedLines({ order }: { order: DeskOrder }) {
  const items = order.items || [];

  if (items.length === 0) {
    return (
      <p className="text-[11px] text-[#777777]">No lines on this order.</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-slate-200 dark:border-[#17304a]">
            <Th>Product</Th>
            <Th>SKU</Th>
            <Th className="text-right">Qty</Th>
            <Th className="text-right">Rate</Th>
            <Th className="text-right">Amount</Th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr
              key={index}
              className="border-b border-slate-100 last:border-0 dark:border-[#17304a]/70"
            >
              <td className="px-3 py-2.5 text-[11px] font-medium text-slate-800 dark:text-slate-100">
                {String(item.product || item.name || "Line")}
              </td>
              <td className="px-3 py-2.5 text-[11px] text-slate-500 dark:text-slate-400">
                {String(item.sku || "-")}
              </td>
              <td className="px-3 py-2.5 text-right text-[11px] text-slate-700 dark:text-slate-200">
                {quantityOf(item)}
              </td>
              <td className="px-3 py-2.5 text-right text-[11px] text-slate-700 dark:text-slate-200">
                {money(rateOf(item))}
              </td>
              <td className="px-3 py-2.5 text-right text-[11px] font-medium text-slate-800 dark:text-slate-100">
                {money(quantityOf(item) * rateOf(item))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
      className={`whitespace-nowrap px-3 py-2.5 text-[11px] font-medium text-slate-500 ${className}`}
    >
      {children}
    </th>
  );
}
