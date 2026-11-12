"use client";

/** New Procurement: the purchase team raising a requisition straight onto the
 *  desk, with quantities, GST and the vendors to ask. The server refuses
 *  anyone without procurement.manage. */

import ProcurementRequestForm from "@/features/procurement/components/ProcurementRequestForm";

export default function NewProcurementPage() {
  return <ProcurementRequestForm />;
}
