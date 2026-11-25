import { redirect } from "next/navigation";

/** Dispatch orders now live on the Stock Out page. */
export default function DispatchRedirect() {
  redirect("/inventory/stock-out?view=dispatch");
}
