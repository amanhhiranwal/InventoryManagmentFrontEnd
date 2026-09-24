"use client";

/**
 * Discount Approvals.
 *
 * Two lists: what this user is holding up, and everything their team has
 * raised. A discount is applied by a salesperson and signed for above
 * them - the AVP carries the first 15%, the CEO the next 5%, and past 20%
 * only the founder. Dealer price is a transfer price and is the CEO's
 * alone.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CgSpinner } from "react-icons/cg";
import {
  FiAlertCircle,
  FiCheck,
  FiChevronRight,
  FiClock,
  FiExternalLink,
  FiX,
} from "react-icons/fi";

import { useUIStore } from "@/lib/store/ui.store";
import {
  ListPage,
  ListPageHeader,
  StatGrid,
} from "@/components/crm/ListPageShell";
import StatCard from "@/components/crm/StatCard";
import { StatusPill } from "@/components/crm/Pill";
import {
  ApprovalBand,
  PRICE_TYPE,
  PRICE_TYPE_LABEL,
  SalesApproval,
  approvalDocumentLabel,
  approvalDocumentLink,
  decideApprovalApi,
  getApprovalMatrixApi,
  getApprovalsApi,
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
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

export default function ApprovalsPage() {
  const { addToast } = useUIStore();

  const [pending, setPending] = useState<SalesApproval[]>([]);
  const [team, setTeam] = useState<SalesApproval[]>([]);
  const [bands, setBands] = useState<ApprovalBand[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);

  /** Which row has its remarks box open, and what is in it. */
  const [remarksFor, setRemarksFor] = useState<number | null>(null);
  const [remarks, setRemarks] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);

      const [mine, everyone, matrix] = await Promise.all([
        getPendingApprovalsApi(),
        getApprovalsApi(),
        getApprovalMatrixApi().catch(() => null),
      ]);

      setPending(mine);
      setTeam(everyone);
      setBands(matrix?.bands || []);
    } catch (error) {
      console.error(error);
      addToast("Could not load approvals.", "error");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    load();
  }, [load]);

  const decide = async (approval: SalesApproval, approve: boolean) => {
    setBusy(approval.id);

    try {
      const updated = await decideApprovalApi(
        approval.id,
        approve,
        remarksFor === approval.id ? remarks.trim() || undefined : undefined,
      );

      addToast(
        updated.status === "APPROVED"
          ? `${approvalDocumentLabel(approval.document_type)} ${
              approval.document_number || `#${approval.document_id}`
            } is fully approved.`
          : updated.status === "REJECTED"
            ? "Rejected, and the requester has been told."
            : `Approved. It now needs the ${updated.waiting_on}.`,
        approve ? "success" : "info",
      );

      setRemarksFor(null);
      setRemarks("");
      await load();
    } catch (error) {
      const detail =
        (error as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "That decision could not be recorded.";
      addToast(detail, "error");
    } finally {
      setBusy(null);
    }
  };

  const withdraw = async (approval: SalesApproval) => {
    setBusy(approval.id);

    try {
      await withdrawApprovalApi(approval.id);
      addToast("Approval request withdrawn.", "info");
      await load();
    } catch (error) {
      const detail =
        (error as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "That request could not be withdrawn.";
      addToast(detail, "error");
    } finally {
      setBusy(null);
    }
  };

  const awaiting = team.filter((a) => a.status === "PENDING").length;
  const approved = team.filter((a) => a.status === "APPROVED").length;
  const rejected = team.filter((a) => a.status === "REJECTED").length;

  return (
    <ListPage>
      <ListPageHeader title="Discount Approvals" refreshing={loading} onRefresh={load} />

      <StatGrid>
        <StatCard label="Waiting On You" value={String(pending.length)} />
        <StatCard label="Open Across The Team" value={String(awaiting)} />
        <StatCard label="Approved" value={String(approved)} />
        <StatCard label="Rejected" value={String(rejected)} />
      </StatGrid>

      {bands.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 dark:border-[#17304a] dark:bg-[#071929]">
          <p className="mb-3 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
            Who signs for what
          </p>

          <div className="flex flex-wrap items-center gap-2">
            {bands.map((band, index) => (
              <div key={band.role} className="flex items-center gap-2">
                <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-[11px] font-semibold text-slate-700 dark:bg-[#0b2034] dark:text-slate-200">
                  {band.role}
                  <span className="ml-1.5 font-normal text-slate-400">
                    {band.label}
                  </span>
                </span>

                {index < bands.length - 1 && (
                  <FiChevronRight size={12} className="text-slate-300" />
                )}
              </div>
            ))}

            <span className="ml-2 text-[10px] italic text-slate-400">
              Dealer price is a transfer price and is set by the CEO.
            </span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-slate-400">
          <CgSpinner className="animate-spin text-2xl" />
          <span className="text-xs">Loading approvals...</span>
        </div>
      ) : (
        <>
          <Section
            title="Waiting on you"
            caption="Nothing moves until you decide."
            empty="Nothing is waiting on you."
            approvals={pending}
            renderActions={(approval) => (
              <div className="flex flex-col items-end gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={busy === approval.id}
                    onClick={() => decide(approval, true)}
                    className="flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-[11px] font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {busy === approval.id ? (
                      <CgSpinner className="animate-spin" size={12} />
                    ) : (
                      <FiCheck size={12} />
                    )}
                    Approve
                  </button>

                  <button
                    type="button"
                    disabled={busy === approval.id}
                    onClick={() => decide(approval, false)}
                    className="flex h-8 items-center gap-1.5 rounded-lg border border-rose-200 px-3 text-[11px] font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900/40"
                  >
                    <FiX size={12} />
                    Reject
                  </button>
                </div>

                {remarksFor === approval.id ? (
                  <input
                    autoFocus
                    value={remarks}
                    onChange={(event) => setRemarks(event.target.value)}
                    placeholder="Why? (recorded on the approval)"
                    className="h-8 w-64 rounded-lg border border-slate-200 px-2.5 text-[11px] outline-none focus:border-[#233353] dark:border-[#17304a] dark:bg-[#071929] dark:text-white"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setRemarksFor(approval.id);
                      setRemarks("");
                    }}
                    className="text-[10px] font-semibold text-blue-600 hover:text-blue-700"
                  >
                    + Add a remark
                  </button>
                )}
              </div>
            )}
          />

          <Section
            title="Raised by your team"
            caption="Every request from someone you can see."
            empty="Nobody has raised an approval yet."
            approvals={team}
            renderActions={(approval) =>
              approval.status === "PENDING" ? (
                <button
                  type="button"
                  disabled={busy === approval.id}
                  onClick={() => withdraw(approval)}
                  className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-[#17304a] dark:text-slate-300"
                >
                  Withdraw
                </button>
              ) : null
            }
          />
        </>
      )}
    </ListPage>
  );
}

function Section({
  title,
  caption,
  empty,
  approvals,
  renderActions,
}: {
  title: string;
  caption: string;
  empty: string;
  approvals: SalesApproval[];
  renderActions: (approval: SalesApproval) => React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white dark:border-[#17304a] dark:bg-[#071929]">
      <div className="border-b border-slate-100 px-5 py-4 dark:border-[#17304a]">
        <h2 className="text-[13px] font-semibold text-slate-800 dark:text-white">
          {title}
        </h2>
        <p className="mt-0.5 text-[11px] text-slate-400">{caption}</p>
      </div>

      {approvals.length === 0 ? (
        <p className="px-5 py-10 text-center text-xs italic text-slate-400">
          {empty}
        </p>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-[#17304a]">
          {approvals.map((approval) => (
            <ApprovalRow
              key={approval.id}
              approval={approval}
              actions={renderActions(approval)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ApprovalRow({
  approval,
  actions,
}: {
  approval: SalesApproval;
  actions: React.ReactNode;
}) {
  const reference = approval.document_number || `#${approval.document_id}`;

  return (
    <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={approvalDocumentLink(approval)}
            className="flex items-center gap-1 text-[13px] font-semibold text-slate-800 hover:text-[#233353] dark:text-white"
          >
            {approvalDocumentLabel(approval.document_type)} {reference}
            <FiExternalLink size={11} className="text-slate-400" />
          </Link>

          <StatusPill status={approval.status} />

          {approval.price_type === PRICE_TYPE.DP && (
            <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-600 dark:bg-indigo-500/10">
              {PRICE_TYPE_LABEL.DP}
            </span>
          )}
        </div>

        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
          {approval.reason}
        </p>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-slate-400">
          <span>Raised by {approval.requested_by_name || "—"}</span>
          <span>{when(approval.requested_at)}</span>

          {approval.document_value ? (
            <span>Order value {money(approval.document_value)}</span>
          ) : null}

          {approval.discount_amount ? (
            <span>
              Discount {approval.discount_percent}% ({money(approval.discount_amount)})
            </span>
          ) : null}
        </div>

        {approval.remarks && (
          <p className="mt-1.5 text-[10px] italic text-slate-400">
            “{approval.remarks}”
          </p>
        )}

        {/* The chain, step by step, so everyone can see where it has got to. */}
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {approval.steps.map((step, index) => {
            const waiting =
              approval.status === "PENDING" && index === approval.current_step;

            const tone =
              step.decision === "APPROVED"
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                : step.decision === "REJECTED"
                  ? "bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400"
                  : waiting
                    ? "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
                    : "bg-slate-50 text-slate-400 dark:bg-[#0b2034]";

            return (
              <span
                key={`${step.role}-${index}`}
                title={step.remarks || undefined}
                className={`flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold ${tone}`}
              >
                {step.decision === "APPROVED" ? (
                  <FiCheck size={9} />
                ) : step.decision === "REJECTED" ? (
                  <FiX size={9} />
                ) : waiting ? (
                  <FiClock size={9} />
                ) : (
                  <FiAlertCircle size={9} className="opacity-40" />
                )}

                {step.role}
                {step.approver_name && (
                  <span className="font-normal opacity-70">
                    · {step.approver_name}
                  </span>
                )}
              </span>
            );
          })}
        </div>
      </div>

      <div className="shrink-0">{actions}</div>
    </div>
  );
}
