"use client";

/**
 * Stock Out, under SCM: everything leaving the warehouse, in one place.
 *
 *   Dispatch Orders  reserve, pick, pack, documents, commit (the one
 *                    moment stock goes out), proof of delivery.
 *   Issued Units     the record the order desks write in the earlier flow,
 *                    unit by unit. It stays the record of what left until
 *                    the stock ledger is switched live.
 *
 * Each view keeps its own permission (dispatch.read, stock_out.read), and
 * the server checks every request again.
 */

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { ListPage, ListPageHeader } from "@/components/crm/ListPageShell";
import { hasPermission } from "@/features/auth/utils/permissions";
import IssuedUnits from "@/features/inventory/components/IssuedUnits";
import DispatchOrders from "@/features/stock/components/DispatchOrders";

type View = "dispatch" | "issued";

const VIEWS: { value: View; label: string; permission: string }[] = [
  { value: "dispatch", label: "Dispatch Orders", permission: "dispatch.read" },
  { value: "issued", label: "Issued Units", permission: "stock_out.read" },
];

function StockOut() {
  const router = useRouter();
  const params = useSearchParams();
  const allowed = VIEWS.filter((v) => hasPermission(v.permission));
  const asked = params.get("view");
  const view = allowed.find((v) => v.value === asked)?.value ?? allowed[0]?.value;

  if (!view) {
    return (
      <ListPage>
        <ListPageHeader title="Stock Out" />
        <p className="rounded-xl bg-white p-8 text-center text-[13px] text-[#777777] dark:bg-[#071929] dark:text-slate-400">
          You do not have access to Stock Out. Ask a super admin to tick it for your role in Roles &amp; Access.
        </p>
      </ListPage>
    );
  }

  /* The same segmented switch as the dashboard's Monthly / Yearly. */
  const switcher =
    allowed.length > 1 ? (
      <div role="tablist" aria-label="Stock Out view" className="-mt-2 inline-flex w-fit rounded-lg border border-[#E2E8F0] bg-white p-1 dark:border-[#17304a] dark:bg-[#071929]">
        {allowed.map((v) => (
          <button
            key={v.value}
            type="button"
            role="tab"
            aria-selected={view === v.value}
            onClick={() => router.replace(`/inventory/stock-out?view=${v.value}`)}
            className={`rounded-md px-4 py-1.5 text-[13px] transition ${
              view === v.value
                ? "bg-[#F1F5F9] font-semibold text-[#233353] dark:bg-[#0d2336] dark:text-white"
                : "text-[#777777] hover:text-[#233353] dark:text-slate-400"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>
    ) : null;

  return (
    <ListPage>
      {view === "dispatch" ? <DispatchOrders switcher={switcher} /> : <IssuedUnits switcher={switcher} />}
    </ListPage>
  );
}

export default function StockOutPage() {
  return (
    <Suspense fallback={null}>
      <StockOut />
    </Suspense>
  );
}
