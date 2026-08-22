import { redirect } from "next/navigation";

export default function NewLeadRedirectPage() {
  redirect("/leads/create");
}
