import { redirect } from "next/navigation";

/* An invoice is generated from its sales order's own page, so the old
   form's links land there: ?order=<id> on that order, ?edit=<invoice> on
   the order that invoice belongs to, anything else on the order list. */
export default async function NewProformaInvoiceRedirect({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; edit?: string }>;
}) {
  const { order, edit } = await searchParams;

  if (order && /^\d+$/.test(order)) redirect(`/sales/orders/${order}`);
  if (edit && /^\d+$/.test(edit)) redirect(`/sales/proforma-invoices/${edit}`);

  redirect("/sales/orders");
}
