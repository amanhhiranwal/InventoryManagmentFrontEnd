import { redirect } from "next/navigation";

/** Warehouse stock now live on the Stock page. */
export default function Redirect() {
  redirect("/inventory/stock");
}
