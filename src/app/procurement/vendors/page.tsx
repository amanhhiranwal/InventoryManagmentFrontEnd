"use client";

/**
 * Vendors: the vendor master, maintained by the procurement team (there is
 * no vendor portal or self-registration). Needs vendor.read; adding needs
 * vendor.manage, which the server checks again.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { FiPlus } from "react-icons/fi";

import { ListPage, ListPageHeader, ListToolbar, PrimaryAction, TableCard } from "@/components/crm/ListPageShell";
import Pagination from "@/components/crm/Pagination";
import QueueTabs from "@/components/crm/QueueTabs";
import { hasPermission } from "@/features/auth/utils/permissions";
import { errorDetail, getVendorsApi, type Vendor } from "@/features/procurement/api/procurement.api";
import DataList, { type Column } from "@/features/procurement/components/DataList";
import { Empty, ErrorState, Loading, ProcStatus, humanize } from "@/features/procurement/components/shared";

const PAGE_SIZE = 20;

const TABS = [null, "DRAFT", "PENDING_VERIFICATION", "APPROVED", "ACTIVE", "ON_HOLD", "BLOCKED", "INACTIVE"];

const SUB = "mt-0.5 block text-[11px] text-[#777777] dark:text-slate-400";

const COLUMNS: Column<Vendor>[] = [
  {
    header: "Vendor",
    primary: true,
    width: "w-[24%]",
    cell: (v) => (
      <>
        <Link href={`/procurement/vendors/${v.id}`} className="font-semibold text-[#233353] hover:underline dark:text-sky-300">
          {v.name}
        </Link>
        <span className={SUB}>{v.vendor_code}, {v.vendor_type || "Type not set"}</span>
      </>
    ),
  },
  {
    header: "Contact",
    cell: (v) => (
      <>
        {v.contact_person || "—"}
        {v.mobile && <span className={SUB}>{v.mobile}</span>}
      </>
    ),
  },
  { header: "City", cell: (v) => v.city || "—" },
  { header: "GSTIN", cell: (v) => <span className="break-all font-mono text-[12px]">{v.gstin || "—"}</span> },
  {
    header: "Documents",
    cell: (v) =>
      v.documents_verified ? (
        <span className="text-[12px] font-semibold text-emerald-600">Verified</span>
      ) : (
        <span className="text-[12px] text-[#999999]">Not verified</span>
      ),
  },
  { header: "Status", primary: true, cell: (v) => <ProcStatus status={v.status} /> },
];

export default function VendorsPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Vendor[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(0);
  const canAdd = hasPermission("vendor.manage");

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
      const answer = await getVendorsApi({ status: status ?? undefined, search: query || undefined, page, size: PAGE_SIZE });
      if (request !== latest.current) return;
      setRows(answer.data);
      setTotal(answer.total);
      setCounts(answer.counts || {});
    } catch (failure) {
      if (request === latest.current) setError(errorDetail(failure, "Could not load vendors."));
      throw failure;
    } finally {
      if (request === latest.current) setLoading(false);
    }
  }, [status, query, page]);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  const all = Object.values(counts).reduce((sum, n) => sum + n, 0);

  return (
    <ListPage>
      <ListPageHeader title="Vendors" refreshing={loading} onRefresh={load} />
      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        placeholder="Search by name, code, GSTIN, contact or city"
        trailing={
          canAdd ? (
            <PrimaryAction icon={<FiPlus size={14} />} onClick={() => router.push("/procurement/vendors/new")}>
              New Vendor
            </PrimaryAction>
          ) : undefined
        }
      />

      <TableCard>
        <QueueTabs
          tabs={TABS.map((value) => ({ value, label: value ? humanize(value) : "All", count: value ? counts[value] || 0 : all }))}
          active={status}
          onChange={(value) => { setStatus(value); setPage(1); }}
          fit
        />

        {loading && !rows.length && !error ? (
          <Loading text="Loading vendors..." />
        ) : error ? (
          <ErrorState text={error} onRetry={() => load().catch(() => {})} />
        ) : rows.length === 0 ? (
          <Empty text={query || status ? "No vendors match." : "No vendors yet. Add one with New Vendor."} />
        ) : (
          <DataList rows={rows} columns={COLUMNS} rowKey={(v) => v.id} rowHref={(v) => `/procurement/vendors/${v.id}`} />
        )}

        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          totalItems={total}
          totalPages={Math.max(1, Math.ceil(total / PAGE_SIZE))}
          onPageChange={setPage}
          noun="vendors"
        />
      </TableCard>
    </ListPage>
  );
}
