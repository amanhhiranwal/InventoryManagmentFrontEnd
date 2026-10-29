"use client";

/**
 * The production desk, under Technology. Was the procurement desk.
 *
 * Orders that accounts have released, each shown against what the shelf
 * can actually cover. Approving takes the order into procurement; marking
 * it ready needs a serial for every unit, each checked against stock and
 * issued, after which it passes to logistics. Rejecting puts it on hold
 * with the reason, which is what happens when the stock is not there.
 */

import { getProductionDeskApi } from "@/features/fulfilment/api/fulfilment.api";
import DeskBoard from "@/features/fulfilment/components/DeskBoard";
import StockDetail from "@/features/fulfilment/components/StockDetail";
import { SALES_ORDER_STATUS } from "@/features/salesOrders/api/salesOrders.api";

export default function ProductionDeskPage() {
  return (
    <DeskBoard
      title="Production"
      description="Confirm the stock, then name a serial for every unit and mark the order ready for dispatch."
      load={getProductionDeskApi}
      approveLabel={(order) =>
        order.status === SALES_ORDER_STATUS.PAYMENT_VERIFIED
          ? "Start Production"
          : "Mark Ready For Dispatch"
      }
      emptyNote="Nothing has been released to production. Orders arrive here once accounts have verified the payment."
      detail={(order, context) => (
        <StockDetail key={order.id} order={order} context={context} />
      )}
    />
  );
}
