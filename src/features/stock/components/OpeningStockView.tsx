"use client";

import { useState } from "react";
import { FiCheck, FiEdit2, FiSend, FiTrash2, FiX } from "react-icons/fi";

import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { hasPermission } from "@/features/auth/utils/permissions";
import {
  OpeningDocument,
  ADJUSTMENT_REASONS,
  DOC_PERMISSIONS,
  approveStockDocumentApi,
  deleteStockDocumentApi,
  kindOf,
  rejectStockDocumentApi,
  submitStockDocumentApi,
} from "@/features/stock/api/stock.api";
import { OpeningStatusPill, TH, errorText, money, qty } from "@/features/stock/components/stockUi";
import { formatDate, formatDateTime } from "@/lib/datetime";
import { useUIStore } from "@/lib/store/ui.store";

type Busy = "submit" | "approve" | "reject" | "delete" | null;

/**
 * One opening stock document, with whatever its status and the viewer's
 * permissions allow: edit, submit or delete a draft; approve (which posts
 * it to stock) or reject a submitted one. The server enforces each of
 * these too - including that the person who prepared it cannot approve it.
 */
export default function OpeningStockView({
  doc,
  onClose,
  onChanged,
  onEdit,
}: {
  doc: OpeningDocument;
  onClose: () => void;
  onChanged: (doc: OpeningDocument | null) => void;
  onEdit: (doc: OpeningDocument) => void;
}) {
  const { addToast } = useUIStore();
  const userId = useAuthStore((s) => s.user?.id);
  const [busy, setBusy] = useState<Busy>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  const kind = kindOf(doc.doc_type);
  const canCreate = hasPermission(DOC_PERMISSIONS[kind].create);
  const canApprove = hasPermission(DOC_PERMISSIONS[kind].approve);
  const preparedByMe = !!doc.created_by && doc.created_by === userId;

  const act = async (action: Exclude<Busy, null>) => {
    try {
      setBusy(action);
      if (action === "delete") {
        if (!window.confirm(`Delete draft ${doc.doc_number}? This cannot be undone.`)) return;
        await deleteStockDocumentApi(kind, doc.id);
        addToast(`${doc.doc_number} deleted.`, "success");
        onChanged(null);
        return;
      }
      if (action === "reject" && !reason.trim()) {
        addToast("Say why it is rejected.", "warning");
        return;
      }
      const next =
        action === "submit"
          ? await submitStockDocumentApi(kind, doc.id)
          : action === "approve"
            ? await approveStockDocumentApi(kind, doc.id)
            : await rejectStockDocumentApi(kind, doc.id, reason.trim());
      addToast(
        action === "submit"
          ? `${doc.doc_number} sent for approval.`
          : action === "approve"
            ? `${doc.doc_number} approved and posted to stock.`
            : `${doc.doc_number} rejected.`,
        "success",
      );
      setRejecting(false);
      onChanged(next);
    } catch (err: unknown) {
      addToast(errorText(err, "That did not go through."), "error");
    } finally {
      setBusy(null);
    }
  };

  const facts: [string, React.ReactNode][] = [
    ["Company", doc.company_name || "—"],
    ["Warehouse", `${doc.warehouse_name || "—"}${doc.warehouse_code ? ` (${doc.warehouse_code})` : ""}`],
    ["Stock As On", formatDate(doc.movement_date)],
    ["Type", doc.doc_type === "ADJUSTMENT_IN" ? "Adjustment - stock in" : doc.doc_type === "ADJUSTMENT_OUT" ? "Adjustment - stock out" : DOC_PERMISSIONS[kind].noun],
    ...(doc.reason_code
      ? [["Reason Code", ADJUSTMENT_REASONS.find(([v]) => v === doc.reason_code)?.[1] || doc.reason_code] as [string, React.ReactNode]]
      : []),
    ...(doc.grn_id ? [["Against GRN", <a key="grn" className="text-[#233353] hover:underline" href={`/inventory/stock-in/${doc.grn_id}`}>Open GRN</a>] as [string, React.ReactNode]] : []),
    ["Reason", doc.reason || "—"],
    ["Prepared By", doc.created_by_name || "—"],
    ["Submitted", doc.submitted_at ? formatDateTime(doc.submitted_at) : "—"],
    ["Approved By", doc.approved_by_name || "—"],
    ["Posted", doc.posted_at ? formatDateTime(doc.posted_at) : "—"],
  ];

  return (
    <Modal isOpen onClose={onClose} title={doc.doc_number} size="xl">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <OpeningStatusPill status={doc.status} />
          {doc.status === "SUBMITTED" && preparedByMe && (
            <span className="text-xs text-slate-500">Waiting for someone else to approve it.</span>
          )}
        </div>

        {doc.status === "REJECTED" && doc.rejection_reason && (
          <p role="note" className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-3 text-sm text-rose-600">
            Rejected by {doc.rejected_by_name || "the approver"}: {doc.rejection_reason}
          </p>
        )}

        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-xl border border-slate-200 p-4 text-[13px] dark:border-[#0d2336] sm:grid-cols-2">
          {facts.map(([label, value]) => (
            <div key={label} className="flex gap-3">
              <dt className="w-28 shrink-0 text-[#777777] dark:text-slate-400">{label}</dt>
              <dd className="font-medium text-[#141414] dark:text-white">{value}</dd>
            </div>
          ))}
        </dl>

        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-[#0d2336]">
          <table className="w-full min-w-[640px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-[#e2e2e2] dark:border-[#17304a]">
                <th className={TH}>#</th>
                <th className={TH}>Product</th>
                <th className={`${TH} text-right`}>Qty</th>
                <th className={`${TH} text-right`}>Unit Cost</th>
                <th className={TH}>Serials</th>
              </tr>
            </thead>
            <tbody>
              {doc.lines.map((line) => (
                <tr key={line.id ?? line.line_no} className="align-top">
                  <td className="px-5 py-3 text-[#777777]">{line.line_no}</td>
                  <td className="px-5 py-3">
                    <span className="block font-semibold">{line.product_name || "—"}</span>
                    <span className="font-mono text-[11px] text-[#777777]">{line.sku}</span>
                    {line.stock_status && line.stock_status !== "UNRESTRICTED" && (
                      <span className="ml-2 rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-600">
                        {line.stock_status === "BLOCKED" ? "Damaged" : "Rejected"}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">{qty(line.quantity)}</td>
                  <td className="px-5 py-3 text-right">{money(line.unit_cost)}</td>
                  <td className="max-w-[260px] px-5 py-3 font-mono text-[11px] text-[#555555] dark:text-slate-300">
                    {line.serials.length ? line.serials.join(", ") : "Counted by quantity"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-[#e2e2e2] font-semibold dark:border-[#17304a]">
                <td className="px-5 py-3" colSpan={3}>
                  Total
                </td>
                <td className="px-5 py-3 text-right">{qty(doc.total_quantity)}</td>
                <td className="px-5 py-3 text-right">{money(doc.total_value)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>

        {doc.remarks && <p className="text-[13px] text-[#555555] dark:text-slate-300">{doc.remarks}</p>}

        {rejecting && (
          <div className="space-y-1.5">
            <label htmlFor="reject-reason" className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Why is it rejected? *
            </label>
            <textarea
              id="reject-reason"
              rows={2}
              autoFocus
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm outline-none focus:border-primary dark:border-[#0d2336] dark:bg-[#071929]/50 dark:text-white"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 pt-3 dark:border-[#0d2336]">
          {doc.status === "DRAFT" && canCreate && (
            <>
              <Button variant="danger" size="sm" icon={<FiTrash2 />} loading={busy === "delete"} onClick={() => act("delete")}>
                Delete Draft
              </Button>
              <Button variant="outline" size="sm" icon={<FiEdit2 />} onClick={() => onEdit(doc)}>
                Edit
              </Button>
              <Button size="sm" icon={<FiSend />} loading={busy === "submit"} onClick={() => act("submit")}>
                Submit for Approval
              </Button>
            </>
          )}
          {doc.status === "SUBMITTED" && canApprove && !preparedByMe && (
            <>
              {rejecting ? (
                <>
                  <Button variant="outline" size="sm" onClick={() => setRejecting(false)}>
                    Cancel
                  </Button>
                  <Button variant="danger" size="sm" icon={<FiX />} loading={busy === "reject"} onClick={() => act("reject")}>
                    Confirm Reject
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="danger" size="sm" icon={<FiX />} onClick={() => setRejecting(true)}>
                    Reject
                  </Button>
                  <Button variant="success" size="sm" icon={<FiCheck />} loading={busy === "approve"} onClick={() => act("approve")}>
                    Approve &amp; Post
                  </Button>
                </>
              )}
            </>
          )}
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
