import {
  PRICE_TYPE,
  requestApprovalApi,
  type RequestApprovalPayload,
  type SalesApproval,
} from "@/features/approvals/api/approvals.api";
import {
  SALES_ORDER_STATUS,
  logSalesOrderActivityApi,
} from "@/features/salesOrders/api/salesOrders.api";

export type SendForApprovalResult =
  | { kind: "sent"; approval: SalesApproval }
  | { kind: "confirmed" };

/**
 * Send For Approval on a saved draft order.
 *
 * The server builds the chain from the order itself (price list from the
 * customer type, the deepest line discount). When the chain is empty - no
 * discount, or one inside the sender's own authority - it raises nothing,
 * and the order is the sender's to confirm, so it is confirmed here. The
 * form used to stop at "nothing raised", which left the order in Draft
 * while the toast said it was created.
 */
export async function sendSalesOrderForApproval(
  order: { id: number; order_number?: string | null },
  figures: Pick<
    RequestApprovalPayload,
    "discount_percent" | "discount_amount" | "orc_percent" | "orc_amount" | "document_value"
  >,
): Promise<SendForApprovalResult> {
  const approval = await requestApprovalApi({
    document_type: "SALES_ORDER",
    document_id: order.id,
    document_number: order.order_number,
    // Overridden on the server from the order's customer type.
    price_type: PRICE_TYPE.ECP,
    ...figures,
  });

  if (approval) return { kind: "sent", approval };

  await logSalesOrderActivityApi(order.id, {
    status: SALES_ORDER_STATUS.CONFIRMED,
    remarks: "No discount to approve, so the order was confirmed.",
  });

  return { kind: "confirmed" };
}
