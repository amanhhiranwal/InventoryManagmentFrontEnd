"use client";

/**
 * The approval on a quotation or a sales order, shown on the record itself.
 *
 * Whoever is holding it up gets Approve and Reject here; everyone else
 * sees where it has got to and who it is with. Approvals belong on the
 * document they are about rather than on a separate queue - that is where
 * the person deciding is already looking.
 */

import { useCallback, useEffect, useState } from "react";
import { CgSpinner } from "react-icons/cg";
import { FiCheck, FiClock, FiShield, FiX } from "react-icons/fi";

import { useUIStore } from "@/lib/store/ui.store";
import {
  ApprovalDocumentType,
  PRICE_TYPE,
  PRICE_TYPE_LABEL,
  SalesApproval,
  decideApprovalApi,
  getApprovalForDocumentApi,
  getPendingApprovalsApi,
  withdrawApprovalApi,
} from "@/features/approvals/api/approvals.api";

const money = (value?: number | null) =>
  `₹${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;

const when = (value?: string | null) =>
  value
    ? new Date(value).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

export default function ApprovalPanel({
  documentType,
  documentId,
  onChanged,
}: {
  documentType: ApprovalDocumentType;
  documentId: number | string;
  /** Called after a decision, so the page can reload the document. */
  onChanged?: () => void;
}) {
  const { addToast } = useUIStore();

  const [approval, setApproval] = useState<SalesApproval | null>(null);
  const [mine, setMine] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [remarks, setRemarks] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);

      const [record, pending] = await Promise.all([
        getApprovalForDocumentApi(documentType, documentId),
        getPendingApprovalsApi().catch(() => [] as SalesApproval[]),
      ]);

      setApproval(record);
      setMine(!!record && pending.some((item) => item.id === record.id));
    } catch (error) {
      console.error(error);
      setApproval(null);
    } finally {
      setLoading(false);
    }
  }, [documentType, documentId]);

  useEffect(() => {
    load();
  }, [load]);

  const decide = async (approve: boolean) => {
    if (!approval) return;

    setBusy(true);

    try {
      const updated = await decideApprovalApi(
        approval.id,
        approve,
        remarks.trim() || undefined,
      );

      addToast(
        updated.status === "APPROVED"
          ? "Approved. This is now fully approved."
          : updated.status === "REJECTED"
            ? "Rejected, and the requester has been told."
            : `Approved. It now needs the ${updated.waiting_on}.`,
        approve ? "success" : "info",
      );

      setRemarks("");
      await load();
      onChanged?.();
    } catch (error) {
      const detail =
        (error as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "That decision could not be recorded.";
      addToast(detail, "error");
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async () => {
    if (!approval) return;

    setBusy(true);

    try {
      await withdrawApprovalApi(approval.id);
      addToast("Approval request withdrawn.", "info");
      await load();
      onChanged?.();
    } catch (error) {
      const detail =
        (error as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "That request could not be withdrawn.";
      addToast(detail, "error");
    } finally {
      setBusy(false);
    }
  };

  /* Nothing has ever been raised on this document, so there is nothing to
     say about it. */
  if (loading || !approval) return null;

  const pending = approval.status === "PENDING";

  const tone =
    approval.status === "APPROVED"
      ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/20"
      : approval.status === "REJECTED"
        ? "border-rose-200 bg-rose-50/60 dark:border-rose-900/40 dark:bg-rose-950/20"
        : "border-amber-200 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/20";

  return (
    <div className={`rounded-xl border p-4 ${tone}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <FiShield size={15} className="mt-0.5 shrink-0 text-slate-500" />

          <div>
            <p className="text-[12px] font-semibold text-slate-800 dark:text-white">
              {pending
                ? `Waiting on the ${approval.waiting_on}`
                : approval.status === "APPROVED"
                  ? "Discount approved"
                  : approval.status === "REJECTED"
                    ? "Discount not approved"
                    : "Approval withdrawn"}
            </p>

            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              {approval.reason}
            </p>

            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-slate-400">
              <span>Raised by {approval.requested_by_name || "—"}</span>
              <span>{when(approval.requested_at)}</span>

              {approval.discount_amount ? (
                <span>
                  {approval.discount_percent}% ({money(approval.discount_amount)})
                </span>
              ) : null}

              {approval.price_type === PRICE_TYPE.DP && (
                <span>{PRICE_TYPE_LABEL.DP}</span>
              )}
            </div>
          </div>
        </div>

        {pending && !mine && (
          <button
            type="button"
            disabled={busy}
            onClick={withdraw}
            className="h-8 shrink-0 rounded-lg border border-slate-200 px-3 text-[11px] font-semibold text-slate-600 transition hover:bg-white disabled:opacity-50 dark:border-[#17304a] dark:text-slate-300"
          >
            Withdraw
          </button>
        )}
      </div>

      {/* The chain, so everyone can see where it has got to. */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {approval.steps.map((step, index) => {
          const waiting = pending && index === approval.current_step;

          const chip =
            step.decision === "APPROVED"
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
              : step.decision === "REJECTED"
                ? "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400"
                : waiting
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400"
                  : "bg-white/70 text-slate-400 dark:bg-[#0b2034]";

          return (
            <span
              key={`${step.role}-${index}`}
              title={step.remarks || undefined}
              className={`flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold ${chip}`}
            >
              {step.decision === "APPROVED" ? (
                <FiCheck size={9} />
              ) : step.decision === "REJECTED" ? (
                <FiX size={9} />
              ) : waiting ? (
                <FiClock size={9} />
              ) : null}

              {step.role}
              {step.approver_name && (
                <span className="font-normal opacity-70">· {step.approver_name}</span>
              )}
            </span>
          );
        })}
      </div>

      {/* Only the person the step is waiting on can act. */}
      {mine && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/60 pt-3 dark:border-white/10">
          <input
            value={remarks}
            onChange={(event) => setRemarks(event.target.value)}
            placeholder="Remark (optional, recorded on the approval)"
            className="h-9 min-w-[220px] flex-1 rounded-lg border border-slate-200 bg-white px-3 text-[11px] outline-none focus:border-[#233353] dark:border-[#17304a] dark:bg-[#071929] dark:text-white"
          />

          <button
            type="button"
            disabled={busy}
            onClick={() => decide(true)}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-[11px] font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
          >
            {busy ? <CgSpinner className="animate-spin" size={12} /> : <FiCheck size={12} />}
            Approve
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() => decide(false)}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-rose-300 bg-white px-4 text-[11px] font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
          >
            <FiX size={12} />
            Reject
          </button>
        </div>
      )}
    </div>
  );
}
