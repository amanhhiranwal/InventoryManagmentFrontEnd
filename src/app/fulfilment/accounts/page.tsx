"use client";

/**
 * The accounts desk.
 *
 * Everything waiting on accounts: orders the business coordinator has
 * processed, whose advance has to be confirmed before fulfilment starts,
 * and installed orders whose balance has to be settled before they close.
 * Approving an advance hands the order to production and keeps the
 * balance on the order; rejecting it puts the order on hold with the
 * reason.
 */

import {
  DeskOrder,
  getAccountsDeskApi,
  money,
} from "@/features/fulfilment/api/fulfilment.api";
import DeskBoard from "@/features/fulfilment/components/DeskBoard";
import { FiCreditCard, FiFileText, FiPackage } from "react-icons/fi";

import { Line, Panel } from "@/features/fulfilment/components/DeskPanels";
import OrderedLines from "@/features/fulfilment/components/OrderedLines";
import DownloadButton from "@/features/fulfilment/components/DownloadButton";
import {
  downloadProformaInvoicePdfApi,
  proformaInvoiceStatusLabel,
} from "@/features/proformaInvoices/api/proformaInvoices.api";
import { downloadSalesOrderPdfApi } from "@/features/salesOrders/api/salesOrders.api";

export default function AccountsDeskPage() {
  return (
    <DeskBoard
      title="Accounts Desk"
      description="Confirm the money before an order moves, and close it when the balance is settled."
      load={getAccountsDeskApi}
      approveLabel="Verify Payment"
      askReceivedDate
      emptyNote="Every processed order has had its payment confirmed. New ones arrive here once the business coordinator processes them."
      detail={(order) => <PaymentDetail order={order} />}
    />
  );
}

function PaymentDetail({ order }: { order: DeskOrder }) {
  const invoice = order.proforma_invoice;
  const shortfall = Math.max(0, order.advance_expected - order.advance_received);

  return (
    <div className="space-y-6">
      {/* The whole order, as approved, and the invoice it was paid
          against, for collecting the advance. */}
      <div className="flex flex-wrap gap-2">
        <DownloadButton
          label="Download Sales Order"
          download={() => downloadSalesOrderPdfApi(order.id, order.order_number)}
        />
        {invoice && (
          <DownloadButton
            label={invoice.pi_number ? `Download PI (${invoice.pi_number})` : "Download PI"}
            download={() => downloadProformaInvoicePdfApi(invoice.id, invoice.pi_number)}
          />
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Panel title="Payment" icon={<FiCreditCard size={14} />}>
          {order.payment_terms && (
            <Line label="Payment terms" value={order.payment_terms} />
          )}
          <Line label="Order value" value={money(order.grand_total)} />
          <Line
            label={`Advance asked (${order.advance_percent}%)`}
            value={money(order.advance_expected)}
          />
          <Line
            label="Advance received"
            value={money(order.advance_received)}
            tone={order.advance_settled ? "good" : "warn"}
          />
          {shortfall > 0 && (
            <Line label="Short of the terms" value={money(shortfall)} tone="warn" />
          )}
          {/* Kept on the order once accounts verify, and shown on every
              screen after this one. */}
          <Line
            label="Balance after advance"
            value={money(order.grand_total - order.advance_received)}
          />
        </Panel>

        <Panel title="Proforma Invoice" icon={<FiFileText size={14} />}>
          {invoice ? (
            <>
              <Line label="Number" value={invoice.pi_number || `#${invoice.id}`} />
              <Line label="Status" value={proformaInvoiceStatusLabel(invoice.status)} />
              <Line label="Invoiced" value={money(invoice.grand_total)} />
              <Line label="Paid" value={money(invoice.amount_paid)} />
              <Line label="Balance due" value={money(invoice.balance_due)} />
            </>
          ) : (
            <p className="text-[11px] text-[#777777] dark:text-slate-400">
              No proforma invoice has been raised against this order, so
              there is nothing for the payment to have come in against.
            </p>
          )}
        </Panel>
      </div>

      <Panel title="Products & Order Items" icon={<FiPackage size={14} />}>
        <OrderedLines order={order} />
      </Panel>
    </div>
  );
}
