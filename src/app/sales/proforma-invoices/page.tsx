import { redirect } from "next/navigation";

/* Proforma invoices live on the sales order that raised them, so there is
   no list of them to browse. Kept so an old link lands on the orders. */
export default function ProformaInvoicesRedirect() {
  redirect("/sales/orders");
}
