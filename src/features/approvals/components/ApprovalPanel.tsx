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
import {
  FiAlertTriangle,
  FiCheck,
  FiCheckCircle,
  FiClock,
  FiMinusCircle,
  FiX,
  FiXCircle,
} from "react-icons/fi";

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
        timeZone: "Asia/Kolkata",
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

      /* Where this document stands now, asked for directly.
         It used to be the head of the document's whole approval history,
         which meant a superseded round - withdrawn when the order was
         changed, or left behind by an order that was deleted - could
         present itself as the order's current state. An order nobody had
         decided came up "Approved", or read as cancelled, with no step
         for the CEO or the Founder in sight. */
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

  /* Steps already turned down, with what was said. The design calls this
     Previous Rejection History and it is the most useful thing on the
     panel: somebody resubmitting needs to know what was wrong last time,
     not just that it was refused. */
  /* Steps turned down on this request, with what was said. Only this
     round: a previous round's refusal belongs to an order that has since
     been changed, and showing it beside a fresh request was reading as
     the state of the fresh one. */
  const refusals = approval.steps
    .filter((step) => step.decision === "REJECTED")
    .map((step) => ({ step }));

  const heading = pending
    ? "Approval Required"
    : approval.status === "APPROVED"
      ? "Approved"
      : approval.status === "REJECTED"
        ? "Not Approved"
        : "Approval Withdrawn";

  /* The icon says how it ended, not only that there was something to do:
     a warning belongs to a request still waiting, and on one that has
     been approved it read as a problem. */
  const icon = pending ? (
    <FiAlertTriangle size={14} className="shrink-0 text-amber-500" />
  ) : approval.status === "APPROVED" ? (
    <FiCheckCircle size={15} className="shrink-0 text-emerald-600" />
  ) : approval.status === "REJECTED" ? (
    <FiXCircle size={15} className="shrink-0 text-rose-500" />
  ) : (
    <FiMinusCircle size={15} className="shrink-0 text-slate-400" />
  );

  return (
    <div className={`rounded-xl border p-4 ${tone}`}>
      <div className="flex items-center gap-2">
        {icon}
        <p className="text-[13px] font-semibold text-slate-800 dark:text-white">
          {heading}
        </p>
      </div>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-[240px] flex-1">
          <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            <span>Requested by</span>

            <span className="inline-flex items-center gap-1.5 rounded-md bg-white/70 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:bg-[#0b2034] dark:text-slate-200">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-300 text-[8px] dark:bg-[#17304a]">
                {(approval.requested_by_name || "U").charAt(0).toUpperCase()}
              </span>
              {approval.requested_by_name || "—"}
            </span>

            <span>on {when(approval.requested_at)}</span>
          </p>

          <p className="mt-1.5 max-w-[560px] text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
            {approval.reason}
          </p>

          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-slate-400">
            {approval.discount_amount ? (
              <span>
                {approval.discount_percent}% ({money(approval.discount_amount)})
              </span>
            ) : null}

            {approval.price_type === PRICE_TYPE.DP && (
              <span>{PRICE_TYPE_LABEL.DP}</span>
            )}

            {pending && <span>Waiting on the {approval.waiting_on}</span>}
          </div>
        </div>

        {/* The decision sits beside the request, as in the design, rather
            than at the bottom of everything the panel has to say. */}
        <div className="flex shrink-0 items-center gap-2">
          {mine && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => decide(false)}
                className="flex h-9 items-center gap-1.5 rounded-lg border border-rose-300 bg-white px-4 text-[12px] font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50 dark:bg-transparent"
              >
                <FiX size={13} />
                Reject
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={() => decide(true)}
                className="flex h-9 items-center gap-1.5 rounded-lg bg-[#273756] px-4 text-[12px] font-semibold text-white transition hover:bg-[#18243a] disabled:opacity-50"
              >
                {busy ? (
                  <CgSpinner className="animate-spin" size={13} />
                ) : (
                  <FiCheck size={13} />
                )}
                {documentType === "SALES_ORDER" ? "Approve SO" : "Approve"}
              </button>
            </>
          )}

          {pending && !mine && (
            <button
              type="button"
              disabled={busy}
              onClick={withdraw}
              className="h-9 rounded-lg border border-slate-200 px-3 text-[11px] font-semibold text-slate-600 transition hover:bg-white disabled:opacity-50 dark:border-[#17304a] dark:text-slate-300"
            >
              Withdraw
            </button>
          )}
        </div>
      </div>

      {refusals.length > 0 && (
        <div className="mt-3 rounded-lg border border-white/60 bg-white/60 p-3 dark:border-white/10 dark:bg-[#0b2034]/60">
          <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">
            Previous Rejection History
          </p>

          {refusals.map(({ step }, index) => (
            <div key={`${step.role}-${index}`} className="mt-2 flex gap-2">
              <FiX size={11} className="mt-0.5 shrink-0 text-rose-500" />

              <div>
                <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                  Rejected by {step.approver_name || step.role}
                  {step.decided_at ? ` - ${when(step.decided_at)}` : ""}
                </p>

                {step.remarks && (
                  <p className="mt-0.5 text-[11px] italic leading-relaxed text-slate-500 dark:text-slate-400">
                    &ldquo;{step.remarks}&rdquo;
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

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

      {/* A reason, for whoever reads the decision afterwards. Optional on
          an approval and worth insisting on in spirit for a rejection -
          "no" with nothing beside it is what sends an order round the
          loop a second time unchanged. */}
      {mine && (
        <input
          value={remarks}
          onChange={(event) => setRemarks(event.target.value)}
          placeholder="Remark - say what needs changing if you are rejecting"
          className="mt-3 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[11px] outline-none focus:border-[#233353] dark:border-[#17304a] dark:bg-[#071929] dark:text-white"
        />
      )}
    </div>
  );
}
