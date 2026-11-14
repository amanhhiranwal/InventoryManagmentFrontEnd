"use client";

/**
 * My Purchase Requisitions: every PR the signed-in person raised, sliced
 * by status, with a way to raise a new one - and "To Approve":
 * the requisitions and purchase orders waiting on this person's approval.
 * The decision itself is made on the requisition or PO page. Anyone signed
 * in may raise a PR; the server decides what each person may see and do.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { FiPlus } from "react-icons/fi";

import {
  ListPage,
  ListPageHeader,
  ListToolbar,
  PrimaryAction,
  TableCard,
  StatGrid,
} from "@/components/crm/ListPageShell";
import StatCard from "@/components/crm/StatCard";
import { hasPermission } from "@/features/auth/utils/permissions";
import Pagination from "@/components/crm/Pagination";
import QueueTabs from "@/components/crm/QueueTabs";
import {
  errorDetail,
  getApprovalQueueApi,
  getMyRequisitionsApi,
  getRequisitionMetaApi,
  type PurchaseOrder,
  type Requisition,
} from "@/features/procurement/api/procurement.api";
import DataList, {
  type Column,
} from "@/features/procurement/components/DataList";
import {
  Empty,
  ErrorState,
  Loading,
  Panel,
  ProcStatus,
  day,
  money,
} from "@/features/procurement/components/shared";

const PAGE_SIZE = 20;

/** The tab of things waiting on the signed-in person's approval. */
const WAITING = "WAITING_ON_ME";

const TABS: { value: string | null; label: string }[] = [
  { value: WAITING, label: "To Approve" },
  { value: null, label: "All" },
  { value: "DRAFT", label: "Draft" },
  { value: "PENDING_APPROVAL", label: "Pending Approval" },
  { value: "RETURNED", label: "Returned" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "CANCELLED", label: "Cancelled" },
];

const SUB = "mt-0.5 block text-[11px] text-[#777777] dark:text-slate-400";

const COLUMNS: Column<Requisition>[] = [
  {
    header: "Requisition",
    primary: true,
    width: "w-[20%]",
    cell: (row) => (
      <>
        <Link
          href={`/procurement/requisitions/${row.id}`}
          className="font-semibold text-[#233353] hover:underline dark:text-sky-300"
        >
          {row.pr_number}
        </Link>
        <span className={SUB}>
          {day(row.pr_date)}, {row.purchase_type_label}
        </span>
        {row.resubmitted && (
          <span className="mt-0.5 block text-[11px] text-amber-600">
            Resubmitted
          </span>
        )}
      </>
    ),
  },
  {
    header: "Purpose",
    cell: (row) => <span className="line-clamp-2">{row.purpose || "—"}</span>,
  },
  { header: "Required By", nowrap: true, cell: (row) => day(row.required_by) },
  {
    header: "Status",
    primary: true,
    cell: (row) => (
      <div className="flex flex-col items-start gap-1">
        <ProcStatus status={row.status} />
        {row.procurement_status && (
          <ProcStatus status={row.procurement_status} />
        )}
      </div>
    ),
  },
  {
    header: "Waiting On",
    cell: (row) =>
      row.waiting_on ? (
        <>
          {row.waiting_on.step_label}
          <span className={SUB}>{row.waiting_on.approver_label}</span>
        </>
      ) : (
        "—"
      ),
  },
];

/** PRs waiting on this person: confirming a need. */
const WAITING_PRS: Column<Requisition>[] = [
  {
    header: "Requisition",
    primary: true,
    cell: (row) => (
      <>
        <Link
          href={`/procurement/requisitions/${row.id}`}
          className="font-semibold text-[#233353] hover:underline dark:text-sky-300"
        >
          {row.pr_number}
        </Link>
        <span className={SUB}>{row.purchase_type_label}</span>
        {row.resubmitted && (
          <span className="mt-0.5 block text-[11px] text-amber-600">
            Resubmitted
          </span>
        )}
      </>
    ),
  },
  {
    header: "Requested By",
    cell: (row) => (
      <>
        {row.requester_name}
        <span className={SUB}>{row.department_name || "No department"}</span>
      </>
    ),
  },
  {
    header: "Purpose",
    cell: (row) => <span className="line-clamp-2">{row.purpose || "—"}</span>,
  },
  { header: "Required By", nowrap: true, cell: (row) => day(row.required_by) },
  {
    header: "Waiting",
    primary: true,
    nowrap: true,
    cell: (row) =>
      `${row.pending_days} day${row.pending_days === 1 ? "" : "s"}`,
  },
];

/** POs waiting on this person: the amount approval. */
const WAITING_POS: Column<PurchaseOrder>[] = [
  {
    header: "Purchase Order",
    primary: true,
    cell: (po) => (
      <>
        <Link
          href={`/procurement/purchase-orders/${po.id}`}
          className="font-semibold text-[#233353] hover:underline dark:text-sky-300"
        >
          {po.po_number}
        </Link>
        <span className={SUB}>
          {po.pr_number}
          {po.requester_name ? `, for ${po.requester_name}` : ""}
        </span>
      </>
    ),
  },
  { header: "Vendor", cell: (po) => po.vendor_name },
  { header: "Your Step", cell: (po) => po.waiting_on?.step_label || "—" },
  {
    header: "Amount",
    align: "right",
    nowrap: true,
    primary: true,
    cell: (po) => money(po.grand_total, po.currency),
  },
];

export default function MyRequisitionsPage() {
  const router = useRouter();
  /* Asked of the server, which knows the rule (the My Requisitions tick,
     or no role at all). Until it answers, the token's permissions decide. */
  const [canRaise, setCanRaise] = useState(() => hasPermission("requisition.create"));
  useEffect(() => {
    getRequisitionMetaApi()
      .then((meta) => setCanRaise(meta.me.can_raise !== false))
      .catch(() => {
        /* The API client has shown why; keep the token's answer. */
      });
  }, []);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  /* Once a tab has been chosen, the page stops choosing for the person. */
  const picked = useRef(false);
  const [waiting, setWaiting] = useState<{
    pending: Requisition[];
    purchase_orders: PurchaseOrder[];
  } | null>(null);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Requisition[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [summary, setSummary] = useState<{
    raised: number;
    awaiting_approval: number;
    returned: number;
    with_procurement: number;
    ordered: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    const request = ++latest.current;
    setLoading(true);
    setError(null);
    try {
      /* The waiting list is always loaded, for its tab's count; the PR
         list is not asked for while that tab is open. */
      const [queue, answer] = await Promise.all([
        getApprovalQueueApi(),
        status === WAITING
          ? Promise.resolve(null)
          : getMyRequisitionsApi({
              status: status ?? undefined,
              search: query || undefined,
              page,
              size: PAGE_SIZE,
            }),
      ]);
      if (request !== latest.current) return;
      setWaiting({
        pending: queue.pending,
        purchase_orders: queue.purchase_orders || [],
      });
      // Open on what waits on them, when anything does.
      if (!picked.current && queue.pending.length + (queue.purchase_orders || []).length > 0) {
        picked.current = true;
        setStatus(WAITING);
      }
      picked.current = true;
      if (answer) {
        setRows(answer.data);
        setTotal(answer.total);
        setCounts(answer.counts || {});
        setSummary(answer.summary || null);
      }
    } catch (failure) {
      if (request === latest.current)
        setError(errorDetail(failure, "Could not load your requisitions."));
      throw failure;
    } finally {
      if (request === latest.current) setLoading(false);
    }
  }, [status, query, page]);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  const all = Object.values(counts).reduce((sum, n) => sum + n, 0);
  const waitingCount =
    (waiting?.pending.length ?? 0) + (waiting?.purchase_orders.length ?? 0);
  const onWaiting = status === WAITING;

  return (
    <ListPage>
      <ListPageHeader
        title="My Purchase Requisitions"
        refreshing={loading}
        onRefresh={load}
      />

      <StatGrid cols={5}>
        <StatCard label="Raised" value={summary ? summary.raised : "—"} caption="by you, not cancelled" />
        <StatCard
          label="Awaiting Approval"
          value={summary ? summary.awaiting_approval : "—"}
          caption={summary?.returned ? `${summary.returned} sent back to you` : "with your manager"}
        />
        <StatCard label="With Procurement" value={summary ? summary.with_procurement : "—"} caption="approved, being sourced" />
        <StatCard label="Ordered" value={summary ? summary.ordered : "—"} caption="on approved purchase orders" />
        <StatCard label="To Approve" value={waiting ? waitingCount : "—"} caption="requisitions and POs waiting on you" />
      </StatGrid>

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        placeholder="Search by PR number or purpose"
        trailing={
          /* The My Requisitions tick on Roles & Access. An approver whose
             role lacks it still has this page for what waits on them. */
          canRaise ? (
            <PrimaryAction
              icon={<FiPlus size={14} />}
              onClick={() => router.push("/procurement/requisitions/new")}
            >
              New Requisition
            </PrimaryAction>
          ) : undefined
        }
      />

      <TableCard>
        <QueueTabs
          tabs={TABS.map((tab) => ({
            ...tab,
            count:
              tab.value === WAITING
                ? waitingCount
                : tab.value
                  ? counts[tab.value] || 0
                  : all,
          }))}
          active={status}
          onChange={(value) => {
            picked.current = true;
            setStatus(value);
            setPage(1);
          }}
          fit
        />

        {onWaiting ? (
          loading && !waiting && !error ? (
            <Loading text="Loading what you have to approve..." />
          ) : error ? (
            <ErrorState text={error} onRetry={() => load().catch(() => {})} />
          ) : waitingCount === 0 ? (
            <Empty text="Nothing to approve right now." />
          ) : (
            <div className="space-y-5 p-4">
              {(waiting?.pending.length ?? 0) > 0 && (
                <Panel
                  title={`Requisitions to approve (${waiting?.pending.length})`}
                >
                  <DataList
                    dense
                    rows={waiting?.pending || []}
                    columns={WAITING_PRS}
                    rowKey={(row) => row.id}
                    rowHref={(row) => `/procurement/requisitions/${row.id}`}
                  />
                </Panel>
              )}
              {(waiting?.purchase_orders.length ?? 0) > 0 && (
                <Panel
                  title={`Purchase orders to approve (${waiting?.purchase_orders.length})`}
                >
                  <DataList
                    dense
                    rows={waiting?.purchase_orders || []}
                    columns={WAITING_POS}
                    rowKey={(po) => po.id}
                    rowHref={(po) => `/procurement/purchase-orders/${po.id}`}
                  />
                </Panel>
              )}
            </div>
          )
        ) : loading && !rows.length && !error ? (
          <Loading text="Loading requisitions..." />
        ) : error ? (
          <ErrorState text={error} onRetry={() => load().catch(() => {})} />
        ) : rows.length === 0 ? (
          <Empty
            text={
              query || status
                ? "No requisitions match."
                : canRaise
                  ? "You have not raised a purchase requisition yet. Use New Requisition to raise one."
                  : "Your role does not raise purchase requisitions. Ask a super admin if you need to."
            }
          />
        ) : (
          <DataList
            rows={rows}
            columns={COLUMNS}
            rowKey={(row) => row.id}
            rowHref={(row) => `/procurement/requisitions/${row.id}`}
          />
        )}

        {!onWaiting && (
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            totalItems={total}
            totalPages={Math.max(1, Math.ceil(total / PAGE_SIZE))}
            onPageChange={setPage}
            noun="requisitions"
          />
        )}
      </TableCard>
    </ListPage>
  );
}
