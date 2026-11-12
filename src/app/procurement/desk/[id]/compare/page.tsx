"use client";

/**
 * Quotation comparison for one requisition: the latest quotation from each
 * vendor side by side, line by line, with the lowest rate, lowest landed
 * cost, fastest delivery and deviations flagged by the server. The page
 * only flags - procurement picks the vendor by creating the purchase order
 * from that vendor's quotation, for the lines it will supply, with the
 * payment terms. The PO then goes for approval by amount.
 */

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { FiArrowLeft, FiDownload } from "react-icons/fi";

import {
  errorDetail,
  getComparisonApi,
  getProcurementMetaApi,
  getWorkspaceApi,
  createPurchaseOrderApi,
  type Comparison,
  type ComparisonColumn,
  type ProcurementMeta,
  type Workspace,
} from "@/features/procurement/api/procurement.api";
import PaymentTermsFields, {
  EMPTY_TERMS,
  termsPayload,
  termsProblem,
  type TermsValue,
} from "@/features/procurement/components/PaymentTerms";
import { Empty, ErrorState, INPUT, LABEL, Loading, Panel, ProcStatus, day, money } from "@/features/procurement/components/shared";
import { useUIStore } from "@/lib/store/ui.store";

const FLAG = "rounded px-1.5 py-0.5 text-[10px] font-semibold";

/** The rows under the lines: each vendor's totals and terms. */
const SUMMARY: { label: string; render: (c: ComparisonColumn) => ReactNode }[] = [
  { label: "Taxable", render: (c) => money(c.taxable_total) },
  { label: "GST", render: (c) => money(c.gst_total) },
  { label: "Charges", render: (c) => money(c.charges_total) },
  {
    label: "Grand total",
    render: (c) => (
      <span className={`font-semibold ${c.lowest_total ? "text-emerald-700" : ""}`}>
        {money(c.grand_total)}
        {c.variance_percent != null && c.variance_percent > 0 && (
          <span className="block text-[11px] font-normal text-rose-600">
            +{money(c.difference)} ({c.variance_percent}%)
          </span>
        )}
      </span>
    ),
  },
  { label: "Payment terms", render: (c) => c.payment_terms || "—" },
  { label: "Warranty", render: (c) => c.warranty_terms || "—" },
  { label: "Valid until", render: (c) => day(c.valid_until) },
  {
    label: "Vendor win rate",
    render: (c) =>
      c.performance?.win_rate != null
        ? `${c.performance.win_rate}% of ${c.performance.quotations} quotes`
        : "No history",
  },
];

const csvCell = (value: unknown) => {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export default function ComparisonPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { addToast } = useUIStore();

  const [ws, setWs] = useState<Workspace | null>(null);
  const [cmp, setCmp] = useState<Comparison | null>(null);
  const [meta, setMeta] = useState<ProcurementMeta | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [quotationId, setQuotationId] = useState<number | null>(null);
  const [itemIds, setItemIds] = useState<number[]>([]);
  const [terms, setTerms] = useState<TermsValue>(EMPTY_TERMS);
  const [remarks, setRemarks] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [workspace, comparison] = await Promise.all([getWorkspaceApi(id), getComparisonApi(id)]);
      setWs(workspace);
      setCmp(comparison);
    } catch (failure) {
      setError(errorDetail(failure, "Could not load the comparison."));
    }
  }, [id]);

  useEffect(() => {
    load();
    getProcurementMetaApi().then(setMeta).catch(() => {});
  }, [load]);

  /** Lines already on a live PO cannot go on another. */
  const covered = useMemo(() => new Set(ws?.ordered_item_ids || []), [ws]);

  /* Choosing a vendor ticks the lines it quoted that are still open. */
  const choose = (qid: number) => {
    setQuotationId(qid);
    setItemIds(
      (cmp?.rows || [])
        .filter((row) => row.quotes[String(qid)] && !covered.has(row.requisition_item_id))
        .map((row) => row.requisition_item_id),
    );
  };

  const exportCsv = () => {
    if (!cmp) return;
    const header = ["Item", "Qty", ...cmp.columns.flatMap((c) => [`${c.vendor_name} rate`, `${c.vendor_name} total`, `${c.vendor_name} days`])];
    const lines = cmp.rows.map((row) => [
      row.product_name,
      row.quantity,
      ...cmp.columns.flatMap((c) => {
        const cell = row.quotes[String(c.quotation_id)];
        return cell ? [cell.unit_rate, cell.total, cell.delivery_days ?? ""] : ["", "", ""];
      }),
    ]);
    const totals = ["Grand total", "", ...cmp.columns.flatMap((c) => ["", c.grand_total, c.delivery_days ?? ""])];
    const body = [header, ...lines, totals].map((r) => r.map(csvCell).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([body], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `Comparison_${cmp.pr_number}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const submit = async () => {
    if (!cmp || !quotationId) return;
    const problem = termsProblem(terms);
    if (problem) return addToast(problem, "error");
    setBusy(true);
    try {
      const answer = await createPurchaseOrderApi({
        quotation_id: quotationId,
        requisition_item_ids: itemIds,
        ...termsPayload(terms),
        remarks: remarks.trim() || undefined,
      });
      addToast(answer.message || "Purchase order created.", "success");
      router.push(`/procurement/purchase-orders/${answer.data.id}`);
    } catch {
      /* reported by the API client; the form keeps its input */
    } finally {
      setBusy(false);
    }
  };

  if (error) return <ErrorState text={error} onRetry={load} />;
  if (!ws || !cmp) return <Loading text="Comparing quotations..." />;

  const manage = Boolean(meta?.permissions?.["procurement.manage"]);
  const chosen = cmp.columns.find((c) => c.quotation_id === quotationId);
  const selectedAmount = cmp.rows
    .filter((row) => itemIds.includes(row.requisition_item_id))
    .reduce((sum, row) => sum + (row.quotes[String(quotationId)]?.total || 0), 0);

  return (
    <div className="space-y-5 pb-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href={`/procurement/desk/${ws.id}`} className="mb-1 flex items-center gap-1 text-[12px] text-[#777777] hover:text-[#233353]">
            <FiArrowLeft size={12} /> {ws.pr_number}
          </Link>
          <h1 className="text-[18px] font-semibold text-slate-900 dark:text-white">Quotation Comparison</h1>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          disabled={!cmp.columns.length}
          className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-[13px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-[#17304a] dark:bg-[#071929] dark:text-slate-200"
        >
          <FiDownload size={13} /> Export CSV
        </button>
      </div>

      {cmp.columns.length === 0 ? (
        <Panel title="Comparison"><Empty text="No quotations to compare yet." /></Panel>
      ) : (
        <Panel title={`${cmp.columns.length} vendor${cmp.columns.length === 1 ? "" : "s"} compared`}>
          {cmp.columns.length < 3 && (
            <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
              Fewer than three quotations: this selection will not count as competitively sourced.
            </p>
          )}
          {/* Side by side while the vendors fit a laptop-width panel;
              one card per vendor on a phone or with more than four. */}
          <div className={cmp.columns.length <= 4 ? "hidden md:block" : "hidden"}>
            <table className="w-full table-fixed border-separate border-spacing-0 text-left text-[12px]">
              <thead>
                <tr>
                  <th className="w-[24%] bg-white px-3 py-2 align-bottom text-[#777777] dark:bg-[#071929]">Item</th>
                  {cmp.columns.map((c) => (
                    <th
                      key={c.quotation_id}
                      className={`border-l border-[#f3f3f3] px-3 py-2 align-top font-normal dark:border-[#17304a] ${
                        quotationId === c.quotation_id ? "bg-blue-50/60 dark:bg-blue-950/20" : ""
                      }`}
                    >
                      <Link href={`/procurement/desk/quotations/${c.quotation_id}`} className="text-[13px] font-semibold text-[#233353] hover:underline dark:text-sky-300">
                        {c.vendor_name}
                      </Link>
                      <span className="block text-[11px] text-[#777777]">{c.quotation_number} · {c.version_label}</span>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {c.lowest_total && <span className={`${FLAG} bg-emerald-50 text-emerald-700`}>Lowest total</span>}
                        {c.fastest_delivery && <span className={`${FLAG} bg-blue-50 text-blue-700`}>Fastest</span>}
                        {c.deviations > 0 && <span className={`${FLAG} bg-amber-50 text-amber-700`}>{c.deviations} deviation{c.deviations === 1 ? "" : "s"}</span>}
                        {c.expired && <span className={`${FLAG} bg-rose-50 text-rose-700`}>Expired</span>}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cmp.rows.map((row) => (
                  <tr key={row.requisition_item_id}>
                    <td className="border-t border-[#f3f3f3] bg-white px-3 py-2 align-top dark:border-[#17304a] dark:bg-[#071929]">
                      <span className="font-medium text-[#141414] dark:text-slate-200">{row.product_name}</span>
                      <span className="block text-[11px] text-[#777777]">{row.quantity} {row.uom}</span>
                      {covered.has(row.requisition_item_id) && <span className="block text-[11px] text-emerald-600">Already on a PO</span>}
                    </td>
                    {cmp.columns.map((c) => {
                      const cell = row.quotes[String(c.quotation_id)];
                      return (
                        <td
                          key={c.quotation_id}
                          className={`border-l border-t border-[#f3f3f3] px-3 py-2 align-top dark:border-[#17304a] ${
                            quotationId === c.quotation_id ? "bg-blue-50/60 dark:bg-blue-950/20" : ""
                          }`}
                        >
                          {!cell ? (
                            <span className="text-[#999999]">Not quoted</span>
                          ) : (
                            <div className="space-y-0.5">
                              <div className="flex justify-between gap-2"><span className="text-[#777777]">Rate</span><span className={cell.lowest_rate ? "font-semibold text-emerald-700" : ""}>{money(Number(cell.unit_rate))}</span></div>
                              <div className="flex justify-between gap-2"><span className="text-[#777777]">Landed / unit</span><span className={cell.lowest_landed ? "font-semibold text-emerald-700" : ""}>{money(cell.landed_unit_cost)}</span></div>
                              <div className="flex justify-between gap-2"><span className="text-[#777777]">Line total</span><span className="font-medium">{money(cell.total)}</span></div>
                              <div className="flex justify-between gap-2"><span className="text-[#777777]">Delivery</span><span className={cell.fastest_delivery ? "font-semibold text-blue-700" : ""}>{cell.delivery_days != null ? `${cell.delivery_days} d` : "—"}</span></div>
                              {cell.variance_percent != null && cell.variance_percent > 0 && (
                                <div className="text-[11px] text-rose-600">+{cell.variance_percent}% vs lowest</div>
                              )}
                              {cell.short_quantity && <div className="text-[11px] text-amber-700">Quoted short quantity</div>}
                              {cell.deviation_flag && <div className="text-[11px] text-amber-700">{cell.deviation || "Deviation"}</div>}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {SUMMARY.map(({ label, render }) => (
                  <tr key={label}>
                    <td className="border-t border-[#f3f3f3] bg-slate-50 px-3 py-2 text-[#777777] dark:border-[#17304a] dark:bg-[#0b2034]">{label}</td>
                    {cmp.columns.map((c) => (
                      <td key={c.quotation_id} className="border-l border-t border-[#f3f3f3] bg-slate-50 px-3 py-2 dark:border-[#17304a] dark:bg-[#0b2034]">
                        {render(c)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={cmp.columns.length <= 4 ? "space-y-3 md:hidden" : "space-y-3"}>
            {cmp.columns.map((c) => (
              <article
                key={c.quotation_id}
                className={`rounded-lg border p-4 ${quotationId === c.quotation_id ? "border-[#233353]" : "border-[#ececec] dark:border-[#17304a]"}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link href={`/procurement/desk/quotations/${c.quotation_id}`} className="text-[14px] font-semibold text-[#233353] hover:underline dark:text-sky-300">
                      {c.vendor_name}
                    </Link>
                    <p className="text-[11px] text-[#777777]">{c.quotation_number}, {c.version_label}</p>
                  </div>
                  <p className={`text-[16px] font-semibold tabular-nums ${c.lowest_total ? "text-emerald-700" : ""}`}>{money(c.grand_total)}</p>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {c.lowest_total && <span className={`${FLAG} bg-emerald-50 text-emerald-700`}>Lowest total</span>}
                  {c.fastest_delivery && <span className={`${FLAG} bg-blue-50 text-blue-700`}>Fastest</span>}
                  {c.deviations > 0 && <span className={`${FLAG} bg-amber-50 text-amber-700`}>{c.deviations} deviation{c.deviations === 1 ? "" : "s"}</span>}
                  {c.expired && <span className={`${FLAG} bg-rose-50 text-rose-700`}>Expired</span>}
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[12px]">
                  <div><dt className="text-[#777777]">Delivery</dt><dd>{c.delivery_days != null ? `${c.delivery_days} days` : "Not stated"}</dd></div>
                  <div><dt className="text-[#777777]">Payment</dt><dd>{c.payment_terms || "Not stated"}</dd></div>
                  <div><dt className="text-[#777777]">Valid until</dt><dd>{day(c.valid_until)}</dd></div>
                  <div><dt className="text-[#777777]">Over lowest</dt><dd>{c.lowest_total ? "—" : `${money(c.difference)} (${c.variance_percent}%)`}</dd></div>
                </dl>
                <ul className="mt-3 divide-y divide-[#f3f3f3] border-t border-[#f3f3f3] dark:divide-[#17304a] dark:border-[#17304a]">
                  {cmp.rows.map((row) => {
                    const cell = row.quotes[String(c.quotation_id)];
                    return (
                      <li key={row.requisition_item_id} className="flex items-start justify-between gap-3 py-2 text-[12px]">
                        <span className="min-w-0">
                          <span className="font-medium text-[#141414] dark:text-slate-200">{row.product_name}</span>
                          {cell && (
                            <span className="block text-[11px] text-[#777777]">
                              {cell.quantity} at {money(Number(cell.unit_rate))}
                              {cell.delivery_days != null ? `, ${cell.delivery_days} days` : ""}
                            </span>
                          )}
                          {cell?.deviation_flag && <span className="block text-[11px] text-amber-700">{cell.deviation || "Deviation"}</span>}
                        </span>
                        <span className={`whitespace-nowrap ${cell?.lowest_landed ? "font-semibold text-emerald-700" : ""}`}>
                          {cell ? money(cell.total) : "Not quoted"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </article>
            ))}
          </div>
        </Panel>
      )}

      {manage && cmp.columns.length > 0 && (
        <Panel title="Create Purchase Order">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <fieldset>
              <legend className={LABEL}>Vendor *</legend>
              <div className="space-y-1.5">
                {cmp.columns.map((c) => (
                  <label key={c.quotation_id} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-[13px] ${quotationId === c.quotation_id ? "border-[#233353]" : "border-slate-200 dark:border-[#17304a]"} ${c.expired ? "opacity-50" : ""}`}>
                    <input type="radio" name="vendor" disabled={c.expired} checked={quotationId === c.quotation_id} onChange={() => choose(c.quotation_id)} className="accent-[#233353]" />
                    <span className="flex-1">{c.vendor_name} <span className="text-[11px] text-[#777777]">{c.version_label}</span></span>
                    <span>{money(c.grand_total)}</span>
                    {c.expired && <ProcStatus status="EXPIRED" />}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset disabled={!quotationId}>
              <legend className={LABEL}>Lines this vendor will supply *</legend>
              <div className="space-y-1.5">
                {cmp.rows.map((row) => {
                  const quoted = quotationId ? row.quotes[String(quotationId)] : null;
                  const blocked = !quoted || covered.has(row.requisition_item_id);
                  return (
                    <label key={row.requisition_item_id} className={`flex items-center gap-2 text-[13px] ${blocked ? "opacity-50" : "cursor-pointer"}`}>
                      <input
                        type="checkbox"
                        disabled={blocked}
                        checked={itemIds.includes(row.requisition_item_id)}
                        onChange={(e) => setItemIds((c) => (e.target.checked ? [...c, row.requisition_item_id] : c.filter((x) => x !== row.requisition_item_id)))}
                        className="h-4 w-4 accent-[#233353]"
                      />
                      <span className="flex-1">{row.product_name}</span>
                      <span>{quoted ? money(quoted.total) : "Not quoted"}</span>
                    </label>
                  );
                })}
              </div>
              {chosen && <p className="mt-2 text-[13px] font-semibold">PO amount: {money(selectedAmount)}</p>}
            </fieldset>

            <div className="lg:col-span-2">
              <p className={LABEL}>Payment</p>
              <PaymentTermsFields value={terms} onChange={setTerms} meta={meta} total={selectedAmount} idPrefix="po-terms" />
              {chosen && !chosen.lowest_total && (
                <p className="mt-2 text-[11px] text-amber-700">
                  This is not the lowest total. Say why in the remarks - the approvers will see it.
                </p>
              )}
            </div>
            <div className="lg:col-span-2">
              <label className={LABEL} htmlFor="sel-remarks">Remarks</label>
              <textarea id="sel-remarks" rows={2} className={INPUT} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              disabled={busy || !quotationId || !itemIds.length || !terms.payment_term_type}
              onClick={submit}
              className="h-9 rounded-lg bg-[#243454] px-4 text-[13px] font-medium text-white hover:bg-[#18243a] disabled:opacity-50"
            >
              {busy ? "Creating..." : "Create Purchase Order"}
            </button>
          </div>
        </Panel>
      )}
    </div>
  );
}
