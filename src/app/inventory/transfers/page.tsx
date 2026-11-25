import { redirect } from "next/navigation";

/** Transfers now live on the Stock page. */
export default function Redirect() {
  redirect("/inventory/stock?tab=transfers");
}
