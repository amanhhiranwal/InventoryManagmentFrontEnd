import { redirect } from "next/navigation";

/** Stock counts now live on the Stock page. */
export default function Redirect() {
  redirect("/inventory/stock?tab=counts");
}
