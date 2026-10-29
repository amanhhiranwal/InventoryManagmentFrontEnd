"use client";

/* A proforma invoice is not a page of its own: it belongs to the sales
   order that raised it, and is generated, previewed, downloaded and sent
   from there. A link to an invoice - from a notification, an email or a
   bookmark - opens that order instead. */

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CgSpinner } from "react-icons/cg";

import { getProformaInvoiceApi } from "@/features/proformaInvoices/api/proformaInvoices.api";

export default function ProformaInvoiceRedirect() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const router = useRouter();
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    getProformaInvoiceApi(invoiceId)
      .then((invoice) => {
        if (cancelled) return;

        if (invoice?.sales_order_id) {
          router.replace(`/sales/orders/${invoice.sales_order_id}`);
        } else {
          setMissing(true);
        }
      })
      .catch(() => {
        if (!cancelled) setMissing(true);
      });

    return () => {
      cancelled = true;
    };
  }, [invoiceId, router]);

  if (missing) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
        <p className="text-sm font-medium text-[#141414] dark:text-white">
          This proforma invoice is not attached to a sales order you can open.
        </p>
        <button
          type="button"
          onClick={() => router.replace("/sales/orders")}
          className="rounded-lg bg-[#273756] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#18243a]"
        >
          Go to Sales Orders
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-[50vh] items-center justify-center gap-2 text-slate-400">
      <CgSpinner className="animate-spin text-2xl text-[#233353]" />
      <span className="text-xs">Opening the sales order...</span>
    </div>
  );
}
