"use client";

/**
 * One stock count: enter what is on the shelf, add anything found that the
 * system did not list, submit, and have someone else approve - which posts
 * the differences as adjustments. While counting, the system quantity is
 * not shown, so the count is of the shelf and not of the screen.
 */

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CgSpinner } from "react-icons/cg";
import { FiArrowLeft, FiCheck, FiPlus, FiSave, FiSend, FiTrash2, FiX } from "react-icons/fi";

import { LIST_TABLE, ListPage } from "@/components/crm/ListPageShell";
import Button from "@/components/ui/Button";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { hasPermission } from "@/features/auth/utils/permissions";
import { CatalogueProduct, getStockCatalogueApi } from "@/features/stock/api/stock.api";
import {
  CountRecordBody,
  StockCount,
  approveCountApi,
  cancelCountApi,
  getCountApi,
  recordCountApi,
  submitCountApi,
} from "@/features/stock/api/transfers.api";
import { CountStatusPill, TH, errorText, money, qty } from "@/features/stock/components/stockUi";
import { formatDate, formatDateTime } from "@/lib/datetime";
import { useUIStore } from "@/lib/store/ui.store";

const CARD = "rounded-xl border border-slate-200 bg-white p-5 dark:border-[#17304a] dark:bg-[#071929]";
const FIELD =
  "w-full rounded-lg border border-[#cccccc] bg-white px-3 py-2 text-[13px] text-[#141414] outline-none transition focus:border-[#233353] disabled:bg-slate-50 disabled:text-slate-500 dark:border-[#17304a] dark:bg-[#071929] dark:text-white";
const LABEL = "text-[12px] text-[#777777] dark:text-slate-400";

interface Found {
  key: number;
  sku: string;
  counted: string;
  remarks: string;
}
let nextKey = 1;

export default function StockCountDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { addToast } = useUIStore();
  const userId = useAuthStore((s) => s.user?.id);
  const id = Number(params.id);

  const canView = hasPermission("stock.read");
  const canCount = hasPermission("stock.count.create");
  const canApprove = hasPermission("stock.count.approve");

  const [c, setC] = useState<StockCount | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [counted, setCounted] = useState<Record<number, string>>({});
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [found, setFound] = useState<Found[]>([]);
  const [catalogue, setCatalogue] = useState<CatalogueProduct[]>([]);

  const adopt = useCallback((next: StockCount) => {
    setC(next);
    setCounted(Object.fromEntries(next.lines.map((l) => [l.id, l.qty_counted === null || l.qty_counted === undefined ? "" : String(l.qty_counted)])));
    setNotes(Object.fromEntries(next.lines.map((l) => [l.id, l.remarks || ""])));
    setFound([]);
  }, []);

  useEffect(() => {
    if (!canView || !Number.isFinite(id)) return;
    getCountApi(id)
      .then(adopt)
      .catch((err: unknown) => setError(errorText(err, "Could not open this count.")));
  }, [canView, id, adopt]);

  const counting = !!c && c.status === "OPEN" && canCount;
  const warehouseId = c?.warehouse_id;

  /* Products, only for adding something found while counting. */
  useEffect(() => {
    if (!counting || !warehouseId) return;
    getStockCatalogueApi(warehouseId)
      .then(setCatalogue)
      .catch((err: unknown) => addToast(errorText(err, "Could not load products for found items."), "error"));
  }, [counting, warehouseId, addToast]);

  const saved = useMemo(
    () => JSON.stringify(c?.lines.map((l) => [l.qty_counted ?? "", l.remarks || ""]) ?? []),
    [c],
  );
  const dirty = !!c && (JSON.stringify(c.lines.map((l) => [counted[l.id] === "" ? "" : Number(counted[l.id]), notes[l.id] || ""])) !== saved || found.length > 0);

  const run = async (key: string, action: () => Promise<StockCount>, message: string) => {
    try {
      setBusy(key);
      adopt(await action());
      addToast(message, "success");
      return true;
    } catch (err: unknown) {
      addToast(errorText(err, "That did not go through."), "error");
      return false;
    } finally {
      setBusy(null);
    }
  };

  if (!canView) {
    return (
      <ListPage>
        <p className="rounded-xl bg-white p-8 text-center text-[13px] text-[#777777] dark:bg-[#071929]">You do not have access to warehouse stock.</p>
      </ListPage>
    );
  }
  if (error) {
    return (
      <ListPage>
        <p role="alert" className="rounded-xl bg-white p-8 text-center text-[13px] text-rose-600 dark:bg-[#071929]">
          {error}
        </p>
        <Link href="/inventory/stock?tab=counts" className="text-[13px] text-[#233353] hover:underline">
          Back to Stock
        </Link>
      </ListPage>
    );
  }
  if (!c) {
    return (
      <div className="flex justify-center py-16 text-slate-400">
        <CgSpinner className="animate-spin text-3xl" />
      </div>
    );
  }

  const blind = c.status === "OPEN";
  const countedByMe = !!userId && (c.submitted_by === userId || c.created_by === userId);

  /** The typed counts as a request, or a message saying what is wrong. */
  const body = (): CountRecordBody | string => {
    const lines = [];
    for (const line of c.lines) {
      const text = (counted[line.id] ?? "").trim();
      if (text === "") continue;
      const value = Number(text);
      if (!Number.isFinite(value) || value < 0) return `${line.sku}: a count cannot be negative.`;
      lines.push({ line_id: line.id, qty_counted: value, remarks: notes[line.id]?.trim() || undefined });
    }
    const extra = [];
    for (const f of found) {
      const sku = f.sku.trim().toUpperCase();
      const value = f.counted.trim() === "" ? null : Number(f.counted);
      if (!sku) return "Choose the product that was found.";
      if (value === null || !Number.isFinite(value) || value < 0) return `${sku}: enter how many were found.`;
      extra.push({ sku, bin_id: c.bin_id || undefined, qty_counted: value, remarks: f.remarks.trim() || undefined });
    }
    return { lines, found: extra };
  };

  const save = () => {
    const request = body();
    if (typeof request === "string") return addToast(request, "warning");
    return run("save", () => recordCountApi(c.id, request), "Counts saved.");
  };

  const submit = async () => {
    const request = body();
    if (typeof request === "string") return addToast(request, "warning");
    if (dirty && !(await run("save", () => recordCountApi(c.id, request), "Counts saved."))) return;
    return run("submit", () => submitCountApi(c.id), "Sent for approval. No stock has moved.");
  };

  const approve = () => {
    const net = c.variance_value < 0 ? `${money(-c.variance_value)} less` : `${money(c.variance_value)} more`;
    if (!window.confirm(`Approve ${c.count_number}? ${c.lines_with_variance} difference(s), ${net} stock value, will be posted to stock.`))
      return;
    return run("approve", () => approveCountApi(c.id), "Approved. The differences are posted to stock.");
  };

  const cancel = () => {
    const reason = window.prompt(`Why is ${c.count_number} being cancelled?`);
    if (reason === null) return;
    if (!reason.trim()) return addToast("Say why it is cancelled.", "warning");
    return run("cancel", () => cancelCountApi(c.id, reason.trim()), `${c.count_number} cancelled. No stock moved.`);
  };

  return (
    <ListPage>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-label="Back to Stock"
            onClick={() => router.push("/inventory/stock?tab=counts")}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-[#0b2034]"
          >
            <FiArrowLeft />
          </button>
          <h1 className="text-[18px] font-semibold text-slate-900 dark:text-white">{c.count_number}</h1>
          <CountStatusPill status={c.status} />
        </div>
        <div className="flex flex-wrap gap-2">
          {canCount && (c.status === "OPEN" || c.status === "SUBMITTED") && (
            <Button variant="danger" size="sm" icon={<FiX />} loading={busy === "cancel"} disabled={!!busy} onClick={cancel}>
              Cancel Count
            </Button>
          )}
          {counting && (
            <>
              <Button variant="outline" size="sm" icon={<FiSave />} loading={busy === "save"} disabled={!!busy || !dirty} onClick={save}>
                Save Counts
              </Button>
              <Button size="sm" icon={<FiSend />} loading={busy === "submit"} disabled={!!busy} onClick={submit}>
                Submit for Approval
              </Button>
            </>
          )}
          {canApprove && c.status === "SUBMITTED" && (
            <Button
              variant="success"
              size="sm"
              icon={<FiCheck />}
              loading={busy === "approve"}
              disabled={!!busy || countedByMe}
              title={countedByMe ? "Someone other than the counter has to approve it." : undefined}
              onClick={approve}
            >
              Approve &amp; Post
            </Button>
          )}
        </div>
      </div>

      {canApprove && c.status === "SUBMITTED" && countedByMe && (
        <p role="note" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-[13px] text-amber-700 dark:bg-amber-950/20">
          You started or counted this, so someone else has to approve it.
        </p>
      )}
      {c.status === "CANCELLED" && c.cancelled_reason && (
        <p role="note" className="rounded-xl border border-slate-300 bg-slate-50 p-3 text-[13px] text-slate-600 dark:bg-[#071929]">
          Cancelled: {c.cancelled_reason}
        </p>
      )}

      <section className={CARD}>
        <dl className="grid grid-cols-1 gap-x-8 gap-y-2 text-[13px] lg:grid-cols-3">
          {[
            ["Warehouse", `${c.warehouse_name || ""}${c.warehouse_code ? ` (${c.warehouse_code})` : ""}`],
            ["Count Date", formatDate(c.count_date)],
            ["Started By", c.created_by_name],
            ["Submitted", c.submitted_at ? `${formatDateTime(c.submitted_at)} by ${c.submitted_by_name}` : "-"],
            ["Posted", c.posted_at ? `${formatDateTime(c.posted_at)} by ${c.approved_by_name}` : "-"],
          ].map(([label, value]) => (
            <div key={label} className="flex gap-3">
              <dt className={`w-24 shrink-0 ${LABEL}`}>{label}</dt>
              <dd className="font-medium text-[#141414] dark:text-white">{value || "-"}</dd>
            </div>
          ))}
        </dl>
        {c.remarks && <p className="mt-2 text-[13px] text-[#555555]">{c.remarks}</p>}
      </section>

      <section className={`${CARD} p-0`}>
        <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pt-5">
          <h2 className="text-[15px] font-semibold text-slate-900 dark:text-white">Count Sheet</h2>
          <p className="text-[12px] text-[#777777]">
            {c.lines_counted} of {c.lines.length} counted
            {!blind && ` · ${c.lines_with_variance} difference(s) worth ${money(c.variance_value)}`}
          </p>
        </div>
        {blind && (
          <p className="px-5 pt-1 text-[12px] text-[#777777]">System quantities are hidden while counting. They appear once it is submitted.</p>
        )}
        <div className="mt-3 overflow-x-auto">
          <table className={`w-full min-w-[760px] text-left ${LIST_TABLE}`}>
            <thead>
              <tr>
                <th className={TH}>Product</th>
                {!blind && <th className={`${TH} text-right`}>System</th>}
                <th className={`${TH} text-right`}>Counted</th>
                {!blind && <th className={`${TH} text-right`}>Difference</th>}
                <th className={TH}>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {c.lines.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-[13px] text-[#777777]">
                    Nothing was on hand here when the count started. Add anything you find below.
                  </td>
                </tr>
              )}
              {c.lines.map((line) => (
                <tr key={line.id} className="align-top text-[13px] text-[#141414] dark:text-slate-200">
                  <td className="min-w-[200px] px-5 py-3">
                    <span className="block font-semibold">{line.product_name || line.sku}</span>
                    <span className="font-mono text-[11px] text-[#777777]">{line.sku}</span>
                  </td>
                  {!blind && <td className="px-5 py-3 text-right">{qty(line.qty_system)}</td>}
                  <td className="px-5 py-3 text-right">
                    {counting ? (
                      <input
                        type="number"
                        min="0"
                        step="any"
                        inputMode="decimal"
                        aria-label={`Counted ${line.sku}`}
                        className={`${FIELD} w-28 text-right`}
                        value={counted[line.id] ?? ""}
                        onChange={(e) => setCounted({ ...counted, [line.id]: e.target.value })}
                      />
                    ) : (
                      qty(line.qty_counted)
                    )}
                  </td>
                  {!blind && (
                    <td
                      className={`px-5 py-3 text-right font-semibold ${
                        (line.variance || 0) < 0 ? "text-rose-600" : (line.variance || 0) > 0 ? "text-emerald-600" : ""
                      }`}
                    >
                      {line.variance ? `${line.variance > 0 ? "+" : ""}${qty(line.variance)}` : "—"}
                      {line.variance_value ? <span className="block text-[11px] font-normal text-[#777777]">{money(line.variance_value)}</span> : null}
                    </td>
                  )}
                  <td className="min-w-[180px] px-5 py-3">
                    {counting ? (
                      <input
                        aria-label={`Remarks for ${line.sku}`}
                        className={FIELD}
                        value={notes[line.id] ?? ""}
                        onChange={(e) => setNotes({ ...notes, [line.id]: e.target.value })}
                      />
                    ) : (
                      <span className="text-[12px] text-[#555555]">{line.remarks || ""}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {counting && (
          <div className="space-y-3 border-t border-slate-100 p-5 dark:border-[#17304a]">
            <p className="text-[13px] font-semibold">Found on the shelf but not listed</p>
            <datalist id="count-catalogue">
              {catalogue.map((p) => (
                <option key={p.sku} value={p.sku}>
                  {p.name || p.sku}
                </option>
              ))}
            </datalist>
            {found.map((f) => (
              <div key={f.key} className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                <label className="space-y-1 sm:col-span-7">
                  <span className={LABEL}>Product (SKU)</span>
                  <input list="count-catalogue" className={FIELD} value={f.sku} onChange={(e) => setFound(found.map((x) => (x.key === f.key ? { ...x, sku: e.target.value } : x)))} />
                </label>
                <label className="space-y-1 sm:col-span-2">
                  <span className={LABEL}>Counted</span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    className={FIELD}
                    value={f.counted}
                    onChange={(e) => setFound(found.map((x) => (x.key === f.key ? { ...x, counted: e.target.value } : x)))}
                  />
                </label>
                <label className="space-y-1 sm:col-span-2">
                  <span className={LABEL}>Remarks</span>
                  <input className={FIELD} value={f.remarks} onChange={(e) => setFound(found.map((x) => (x.key === f.key ? { ...x, remarks: e.target.value } : x)))} />
                </label>
                <div className="flex items-end sm:col-span-1">
                  <button
                    type="button"
                    aria-label="Remove found product"
                    onClick={() => setFound(found.filter((x) => x.key !== f.key))}
                    className="flex h-[38px] w-full items-center justify-center rounded-lg text-rose-500 transition hover:bg-rose-500/10"
                  >
                    <FiTrash2 />
                  </button>
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              icon={<FiPlus />}
              onClick={() => setFound([...found, { key: nextKey++, sku: "", counted: "", remarks: "" }])}
            >
              Add Found Product
            </Button>
          </div>
        )}
      </section>
    </ListPage>
  );
}
