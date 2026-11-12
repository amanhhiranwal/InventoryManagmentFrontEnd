"use client";

/**
 * One purchase requisition. The requester edits it while it is a draft or
 * returned; the approver whose turn it is approves, returns or rejects it;
 * everyone allowed to see it sees the chain and the history. What each
 * button may do is decided by the server (can_edit / can_decide /
 * can_cancel), and checked again when it is pressed.
 */

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { FiCheck, FiCornerUpLeft, FiEdit2, FiX } from "react-icons/fi";

import Modal from "@/components/ui/Modal";
import {
  cancelRequisitionApi,
  decideRequisitionApi,
  logRequisitionActivityApi,
  errorDetail,
  getRequisitionApi,
  type Requisition,
} from "@/features/procurement/api/procurement.api";
import RequisitionForm from "@/features/procurement/components/RequisitionForm";
import {
  RequisitionLines,
  RequisitionSide,
  RequisitionSummary,
} from "@/features/procurement/components/RequisitionView";
import { ApprovalBanner, type BannerState } from "@/features/procurement/components/ApprovalAndActivity";
import { DetailHeader, ProcurementTrack } from "@/features/procurement/components/DetailParts";
import { ErrorState, INPUT, LABEL, Loading, ProcStatus, RemarksPrompt, day } from "@/features/procurement/components/shared";
import { useUIStore } from "@/lib/store/ui.store";

const BANNER: Record<string, BannerState | undefined> = {
  PENDING_APPROVAL: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  RETURNED: "RETURNED",
};

type Decision = "APPROVE" | "RETURN" | "REJECT" | "CANCEL";

const BUTTON =
  "flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-[13px] font-medium transition disabled:opacity-50";

export default function RequisitionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { addToast } = useUIStore();

  const [pr, setPr] = useState<Requisition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [asking, setAsking] = useState<Decision | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setPr(await getRequisitionApi(id));
    } catch (failure) {
      setError(errorDetail(failure, "Could not load this requisition."));
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  /* What the manager records about the budget when approving - optional. */
  const [budget, setBudget] = useState({ code: "", available: "", budgeted: "" as "" | "yes" | "no" });

  const act = async (decision: Decision, remarks: string) => {
    if (!pr) return;
    setBusy(true);
    try {
      if (decision === "CANCEL") {
        setPr((await cancelRequisitionApi(pr.id, remarks)).data);
        addToast("Requisition cancelled.", "success");
      } else {
        const answer = await decideRequisitionApi(
          pr.id,
          decision,
          remarks,
          decision === "APPROVE"
            ? {
                budget_code: budget.code.trim() || null,
                budget_available: budget.available === "" ? null : Number(budget.available),
                budgeted: budget.budgeted === "" ? null : budget.budgeted === "yes",
              }
            : undefined,
        );
        setPr(answer.data);
        addToast(answer.message || "Decision recorded.", "success");
      }
      setAsking(null);
    } catch {
      /* The reason is shown by the API client; the dialog stays open. */
    } finally {
      setBusy(false);
    }
  };

  if (error) return <ErrorState text={error} onRetry={load} />;
  if (!pr) return <Loading text="Loading requisition..." />;
  if (editing && pr.can_edit) return <RequisitionForm existing={pr} />;

  const prompts: Record<Decision, { title: string; confirm: string; required: boolean; danger?: boolean }> = {
    APPROVE: { title: `Approve ${pr.pr_number}`, confirm: "Approve", required: false },
    RETURN: { title: `Send ${pr.pr_number} back for changes`, confirm: "Send Back", required: true },
    REJECT: { title: `Reject ${pr.pr_number}`, confirm: "Reject", required: true, danger: true },
    CANCEL: { title: `Cancel ${pr.pr_number}`, confirm: "Cancel Requisition", required: false, danger: true },
  };

  /* A draft or a cancelled requisition has no approval to show. */
  const bannerState = BANNER[pr.status];

  return (
    <div className="space-y-5 pb-8">
      <DetailHeader
        back={pr.can_decide ? { href: "/procurement/approvals", label: "PR Approvals" } : { href: "/procurement/requisitions", label: "My Requisitions" }}
        title={pr.pr_number}
        status={
          <>
            <ProcStatus status={pr.status} />
            {pr.procurement_status && <ProcStatus status={pr.procurement_status} />}
          </>
        }
        subtitle={pr.purpose}
        actions={
          <>
            {pr.can_edit && (
              <button type="button" onClick={() => setEditing(true)} className={`${BUTTON} bg-[#243454] text-white hover:bg-[#18243a]`}>
                <FiEdit2 size={13} /> {pr.status === "RETURNED" ? "Edit and Resubmit" : "Edit"}
              </button>
            )}
            {pr.can_cancel && (
              <button
                type="button"
                onClick={() => setAsking("CANCEL")}
                className={`${BUTTON} border border-[#f7969e] bg-white text-[#d00517] hover:bg-rose-50 dark:bg-transparent`}
              >
                <FiX size={13} /> Cancel Requisition
              </button>
            )}
          </>
        }
        facts={[
          { label: "Purchase type", value: pr.purchase_type_label },
          { label: "Requested by", value: pr.requester_name },
          { label: "Required by", value: day(pr.required_by) },
          { label: "Items", value: pr.item_count },
          { label: pr.waiting_on ? "Waiting on" : "Procurement executive", value: pr.waiting_on ? pr.waiting_on.approver_label : pr.assigned_name || "Not assigned" },
        ]}
      />

      <ProcurementTrack pr={pr} />

      {bannerState && (pr.approvals?.length ?? 0) > 0 && (
        <ApprovalBanner
          state={bannerState}
          steps={pr.approvals || []}
          requestedBy={pr.requester_name}
          requestedAt={pr.submitted_at}
          reason={
            pr.status === "PENDING_APPROVAL"
              ? `${pr.resubmitted ? "Resubmitted after it was sent back. " : ""}${pr.requester_name}'s reporting manager confirms the need; procurement then prices it, and the purchase order is approved by amount.`
              : pr.status === "APPROVED"
                ? "The need is confirmed and the requisition is with the procurement team."
                : pr.status === "RETURNED"
                  ? "Sent back to the requester to change and resubmit."
                  : "The requisition did not go ahead."
          }
          actions={
            pr.can_decide ? (
              <>
                <button type="button" onClick={() => setAsking("REJECT")} className={`${BUTTON} border border-rose-300 bg-white text-rose-600 hover:bg-rose-50 dark:bg-transparent`}>
                  <FiX size={13} /> Reject
                </button>
                <button type="button" onClick={() => setAsking("RETURN")} className={`${BUTTON} border border-amber-300 bg-white text-amber-700 hover:bg-amber-50 dark:bg-transparent`}>
                  <FiCornerUpLeft size={13} /> Send Back
                </button>
                <button type="button" onClick={() => setAsking("APPROVE")} className={`${BUTTON} bg-[#273756] text-white hover:bg-[#18243a]`}>
                  <FiCheck size={13} /> Approve
                </button>
              </>
            ) : undefined
          }
        />
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          <RequisitionSummary pr={pr} />
          <RequisitionLines pr={pr} />
        </div>
        <div className="space-y-5">
          <RequisitionSide
            pr={pr}
            onLog={async (activity, remarks) => {
              try {
                const answer = await logRequisitionActivityApi(pr.id, activity, remarks);
                setPr(answer.data);
                addToast(answer.message || "Activity logged.", "success");
                return true;
              } catch {
                return false; // the API client shows the server's reason
              }
            }}
          />
        </div>
      </div>

      <Modal isOpen={asking !== null} onClose={() => !busy && setAsking(null)} title={asking ? prompts[asking].title : ""}>
        {asking === "APPROVE" && (
          <fieldset className="mb-4 rounded-lg border border-[#ececec] p-3 dark:border-[#17304a]">
            <legend className="px-1 text-[12px] font-medium text-[#474747] dark:text-slate-300">Budget (optional)</legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className={LABEL} htmlFor="ap-budget-code">Budget code</label>
                <input id="ap-budget-code" className={INPUT} value={budget.code} onChange={(e) => setBudget({ ...budget, code: e.target.value })} />
              </div>
              <div>
                <label className={LABEL} htmlFor="ap-budget-available">Available (₹)</label>
                <input
                  id="ap-budget-available"
                  type="number"
                  min="0"
                  step="any"
                  className={INPUT}
                  value={budget.available}
                  onChange={(e) => setBudget({ ...budget, available: e.target.value })}
                />
              </div>
              <div>
                <label className={LABEL} htmlFor="ap-budgeted">Budgeted?</label>
                <select
                  id="ap-budgeted"
                  className={INPUT}
                  value={budget.budgeted}
                  onChange={(e) => setBudget({ ...budget, budgeted: e.target.value as "" | "yes" | "no" })}
                >
                  <option value="">Not stated</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
            </div>
          </fieldset>
        )}
        {asking && (
          <RemarksPrompt
            title={prompts[asking].title}
            required={prompts[asking].required}
            confirmLabel={prompts[asking].confirm}
            danger={prompts[asking].danger}
            busy={busy}
            onCancel={() => setAsking(null)}
            onConfirm={(remarks) => act(asking, remarks)}
          />
        )}
      </Modal>
    </div>
  );
}
