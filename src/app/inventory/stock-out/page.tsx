"use client";

/**
 * Stock Out, under SCM: the record of everything that left the warehouse.
 *
 *   Issued Units     unit by unit: which serial, for which order, who sent
 *                    it. Orders themselves go out from the Logistics desk.
 *   Dispatch Orders  only once the stock ledger is live: reserve, pick,
 *                    pack and commit (the one moment stock goes out). Until
 *                    then Logistics sends orders out and this view stays
 *                    hidden, so the same order is never sent out twice.
 *
 * Each view keeps its own permission (dispatch.read, stock_out.read), and
 * the server checks every request again.
 */

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { ListPage, ListPageHeader } from "@/components/crm/ListPageShell";
import { hasPermission } from "@/features/auth/utils/permissions";
import IssuedUnits from "@/features/inventory/components/IssuedUnits";
import { getLedgerLiveApi } from "@/features/stock/api/dispatch.api";
import DispatchOrders from "@/features/stock/components/DispatchOrders";
import { errorText } from "@/features/stock/components/stockUi";

type View = "dispatch" | "issued";

const VIEWS: { value: View; label: string; permission: string; ledgerOnly?: boolean }[] = [
  { value: "issued", label: "Issued Units", permission: "stock_out.read" },
  { value: "dispatch", label: "Dispatch Orders", permission: "dispatch.read", ledgerOnly: true },
];

function StockOut() {
  const router = useRouter();
  const params = useSearchParams();
  const [live, setLive] = useState<boolean | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);

  useEffect(() => {
    getLedgerLiveApi()
      .then(setLive)
      .catch((err: unknown) => setLiveError(errorText(err, "Could not tell whether the stock ledger is live.")));
  }, []);

  if (liveError) {
    return (
      <ListPage>
        <ListPageHeader title="Stock Out" />
        <p role="alert" className="rounded-xl bg-white p-8 text-center text-[13px] text-rose-600 dark:bg-[#071929]">
          {liveError}
        </p>
      </ListPage>
    );
  }
  if (live === null) return null;

  const allowed = VIEWS.filter((v) => hasPermission(v.permission) && (!v.ledgerOnly || live));
  const asked = params.get("view");
  const view = allowed.find((v) => v.value === asked)?.value ?? allowed[0]?.value;

  if (!view && hasPermission("dispatch.read") && !live) {
    return (
      <ListPage>
        <ListPageHeader title="Stock Out" />
        <p className="rounded-xl bg-white p-8 text-center text-[13px] text-[#777777] dark:bg-[#071929] dark:text-slate-400">
          Orders go out from the{" "}
          <Link href="/fulfilment/logistics" className="font-semibold text-[#233353] hover:underline dark:text-sky-300">
            Logistics desk
          </Link>
          . Dispatch orders open here once the stock ledger is switched on.
        </p>
      </ListPage>
    );
  }

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
