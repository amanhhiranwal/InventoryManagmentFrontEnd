import { redirect } from "next/navigation";

/* The procurement desk is now Production, under Technology. Kept so a
   bookmark or an older email link still lands on the desk. */
export default function ProcurementDeskPage() {
  redirect("/fulfilment/production");
}
