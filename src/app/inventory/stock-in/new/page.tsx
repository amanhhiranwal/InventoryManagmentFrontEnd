"use client";

/** New Stock-In: record goods received at a warehouse as a draft GRN. */

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CgSpinner } from "react-icons/cg";

import { ListPage } from "@/components/crm/ListPageShell";
import { hasPermission } from "@/features/auth/utils/permissions";
import { getMyWarehousesApi, MyWarehouse } from "@/features/locations/api/locations.api";
import GrnForm from "@/features/stock/components/GrnForm";
import { errorText } from "@/features/stock/components/stockUi";

export default function NewStockInPage() {
  const router = useRouter();
  const canCreate = hasPermission("grn.create");
  const [warehouses, setWarehouses] = useState<MyWarehouse[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canCreate) return;
    getMyWarehousesApi()
      .then(setWarehouses)
      .catch((err: unknown) => setError(errorText(err, "Could not load your warehouses.")));
  }, [canCreate]);

  if (!canCreate) {
    return (
      <ListPage>
        <p className="rounded-xl bg-white p-8 text-center text-[13px] text-[#777777] dark:bg-[#071929]">
          You cannot record goods received. Ask a super admin for &quot;Record Goods Received (GRN)&quot; in Roles &amp; Access.
        </p>
      </ListPage>
    );
  }

  return (
    <ListPage>
      {error ? (
        <p role="alert" className="rounded-xl bg-white p-8 text-center text-[13px] text-rose-600 dark:bg-[#071929]">
          {error}
        </p>
      ) : warehouses === null ? (
        <div className="flex justify-center py-16 text-slate-400">
          <CgSpinner className="animate-spin text-3xl" />
        </div>
      ) : warehouses.length === 0 ? (
        <p className="rounded-xl bg-white p-8 text-center text-[13px] text-[#777777] dark:bg-[#071929]">
          You have no warehouses yet. Ask a super admin to give you warehouse access in Users.
        </p>
      ) : (
        <GrnForm
          warehouses={warehouses}
          editing={null}
          onCancel={() => router.push("/inventory/stock-in")}
          onSaved={(grn) => router.push(`/inventory/stock-in/${grn.id}`)}
        />
      )}
    </ListPage>
  );
}
