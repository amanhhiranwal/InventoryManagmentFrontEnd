"use client";

/**
 * Sales Order detail page.
 *
 * The list already linked here through "View Order", but the route did not
 * exist, so the link 404'd. This is that page: the order as saved, the
 * account it belongs to, where it has got to in the process, and its history.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { useUIStore } from "@/lib/store/ui.store";
import { StatusPill } from "@/components/crm/Pill";
import {
  SALES_ORDER_STATUS,
  SalesOrderModel,
  SalesOrderActivity,
  getSalesOrderActivitiesApi,
  getSalesOrderApi,
  logSalesOrderActivityApi,
  updateSalesOrderApi,
  nextSalesOrderStatuses,
  salesOrderStatusLabel,
  SALES_ORDER_STATUS_LABEL,
} from "@/features/salesOrders/api/salesOrders.api";
import {
  FiArrowLeft,
  FiCalendar,
  FiCheckCircle,
  FiChevronRight,
  FiClock,
  FiEdit2,
  FiFileText,
  FiInfo,
  FiMinus,
  FiPackage,
  FiPlus,
  FiTrash2,
  FiSend,
  FiShield,
} from "react-icons/fi";
import { CgSpinner } from "react-icons/cg";

/* =========================================================
   HELPERS
========================================================= */

const money = (value?: number | null) =>
  `₹${Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 0,
  })}`;

function formatDate(value?: string | null) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/* Recent entries read better relative, because the timeline is mostly
   consulted for what just happened. */
function formatActivityStamp(value?: string) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  const startOfDay = (input: Date) =>
    new Date(input.getFullYear(), input.getMonth(), input.getDate()).getTime();

  const dayDiff = Math.round(
    (startOfDay(new Date()) - startOfDay(date)) / 86400000,
  );

  if (dayDiff === 0) {
    return `Today, ${date.toLocaleTimeString("en-IN", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })}`;
  }

  if (dayDiff === 1) return "Yesterday";

  return formatDate(value);
}

/** The order's reference as one string. Stored numbers already carry their
    own "SO-" prefix, so prefixing again would print SO-#SO-00001. */
function orderReference(order: { order_number?: string | null; id: number }) {
  const reference = (order.order_number || "").trim();

  if (!reference) return `SO-#${order.id}`;

  return reference.toUpperCase().startsWith("SO") ? `#${reference}` : `SO-#${reference}`;
}

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === "object" ? (value as Record<string, any>) : {};
}

/** One line's own figures, matching compute_order_totals on the backend. */
function lineTotals(item: Record<string, any>) {
  const quantity = Number(item.quantity_case ?? item.qty ?? 1) || 0;
  const unitPrice = Number(item.price ?? item.rate ?? 0) || 0;

  const line = quantity * unitPrice;
  const discount = (line * (Number(item.discount) || 0)) / 100;
  const taxable = line - discount;

  return { quantity, unitPrice, line, discount, taxable };
}

/* =========================================================
   PAGE
========================================================= */

export default function SalesOrderDetailPage() {
  const params = useParams<{ orderId: string }>();
  const router = useRouter();
  const { addToast } = useUIStore();

  const orderId = params?.orderId;

  const [order, setOrder] = useState<SalesOrderModel | null>(null);
  const [loading, setLoading] = useState(true);

  const [activities, setActivities] = useState<SalesOrderActivity[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);

  const [sending, setSending] = useState(false);
  const [showActivityForm, setShowActivityForm] = useState(false);

  /* Editable copies of the addresses, held apart from the saved order so a
     failed save leaves what the user typed on screen rather than reverting
     it, and Cancel can put the originals back. */
  const [editingAddress, setEditingAddress] = useState(false);
  const [billingDraft, setBillingDraft] = useState<Record<string, any>>({});
  const [shippingDraft, setShippingDraft] = useState<Record<string, any>>({});
  const [sameAsBilling, setSameAsBilling] = useState(false);

  const loadOrder = useCallback(async () => {
    if (!orderId) return;

    try {
      setLoading(true);

      const saved = await getSalesOrderApi(orderId);

      setOrder(saved);

      setBillingDraft(asRecord(saved.billing_address));
      setShippingDraft(asRecord(saved.shipping_address));
      setEditingAddress(false);
    } catch (error: any) {
      console.error(error);

      addToast(
        error?.response?.data?.detail || "Unable to load this sales order.",
        "error",
      );
    } finally {
      setLoading(false);
    }
  }, [orderId, addToast]);

  const loadActivities = useCallback(async () => {
    if (!orderId) return;

    try {
      setActivitiesLoading(true);

      setActivities(await getSalesOrderActivitiesApi(orderId));
    } catch (error) {
      console.error(error);

      setActivities([]);
    } finally {
      setActivitiesLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    loadOrder();
    loadActivities();
  }, [loadOrder, loadActivities]);

  const customerInfo = asRecord(order?.customer_information);

  const items = useMemo(
    () => (Array.isArray(order?.items) ? (order!.items as any[]) : []),
    [order],
  );

  /* ---------------------------------------------------------------
     ACTIONS
  --------------------------------------------------------------- */

  const isDraft = order?.status === SALES_ORDER_STATUS.DRAFT;

  /** Persist one partial change and fold the response back into the page. */
  const patchOrder = async (
    payload: Record<string, unknown>,
    message: string,
  ) => {
    if (!order) return false;

    setSending(true);

    try {
      const updated = await updateSalesOrderApi(order.id, payload as never);

      setOrder(updated);

      setBillingDraft(asRecord(updated.billing_address));
      setShippingDraft(asRecord(updated.shipping_address));

      addToast(message, "success");

      return true;
    } catch (error: any) {
      console.error(error);

      addToast(
        error?.response?.data?.detail || "Failed to save the change.",
        "error",
      );

      return false;
    } finally {
      setSending(false);
    }
  };

  const saveAddresses = async () => {
    const ok = await patchOrder(
      {
        billing_address: billingDraft,
        shipping_address: sameAsBilling ? billingDraft : shippingDraft,
      },
      "Address updated.",
    );

    if (ok) setEditingAddress(false);
  };

  /* Changing a line re-derives every total on the backend, so the summary
     below can never disagree with the rows above it. */
  const patchLine = async (index: number, field: string, value: number) => {
    const next = items.map((item, position) =>
      position === index ? { ...item, [field]: value } : item,
    );

    await patchOrder({ items: next }, "Order items updated.");
  };

  const removeLine = async (index: number) => {
    await patchOrder(
      { items: items.filter((_, position) => position !== index) },
      "Line removed.",
    );
  };

  const sendForApproval = async () => {
    if (!order) return;

    setSending(true);

    try {
      const result = await logSalesOrderActivityApi(order.id, {
        status: SALES_ORDER_STATUS.CONFIRMED,
        remarks: "Sent for approval from the order detail page.",
      });

      setOrder(result.order);

      addToast("Sales order sent for approval.", "success");

      await loadActivities();
    } catch (error: any) {
      console.error(error);

      addToast(
        error?.response?.data?.detail || "Failed to send for approval.",
        "error",
      );
    } finally {
      setSending(false);
    }
  };

  const logActivity = async (payload: {
    status?: string;
    remarks?: string;
  }) => {
    if (!order) return false;

    setSending(true);

    try {
      const result = await logSalesOrderActivityApi(order.id, payload as any);

      setOrder(result.order);

      addToast(
        payload.status
          ? `Order moved to ${salesOrderStatusLabel(result.order.status)}.`
          : "Activity logged.",
        "success",
      );

      await loadActivities();

      return true;
    } catch (error: any) {
      console.error(error);

      addToast(
        error?.response?.data?.detail || "Failed to log the activity.",
        "error",
      );

      return false;
    } finally {
      setSending(false);
    }
  };

  /* ---------------------------------------------------------------
     RENDER
  --------------------------------------------------------------- */

  if (loading) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-3 text-slate-400">
        <CgSpinner className="animate-spin text-3xl text-[#233353]" />
        <p className="text-xs font-semibold">Loading sales order...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-3">
        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
          Sales order not found
        </p>

        <button
          type="button"
          onClick={() => router.push("/sales/orders")}
          className="rounded-lg bg-[#233353] px-4 py-2 text-xs font-bold text-white"
        >
          Back to all Sales Order
        </button>
      </div>
    );
  }

  /* The order stops being the step in progress once it is released, which
     is when the goods actually move. */
  const orderStepDone =
    order.status === SALES_ORDER_STATUS.RELEASED ||
    order.status === SALES_ORDER_STATUS.COMPLETED;

  const gstPercent =
    order.gst_percent === null || order.gst_percent === undefined
      ? 18
      : order.gst_percent;

  return (
    <div className="min-h-full space-y-4 pb-8">
      {/* =========================================================
          HEADER
      ========================================================= */}

      <div>
        <button
          type="button"
          onClick={() => router.push("/sales/orders")}
          className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-slate-500 hover:text-[#233353] dark:hover:text-white"
        >
          <FiArrowLeft size={12} />
          Back to all Sales Order
        </button>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
              {orderReference(order)}
              {order.company_name ? ` - ${order.company_name}` : ""}
            </h1>

            <StatusPill
              status={order.status}
              label={salesOrderStatusLabel(order.status)}
            />
          </div>

          <div className="flex items-center gap-2">
            {/* Editing reopens the New Sales Order form, which is the only
                place the order's fields can actually be changed. */}
            <button
              type="button"
              onClick={() =>
                router.push(`/sales/orders?edit=${order.id}`)
              }
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 dark:border-[#17304a] dark:bg-[#071929] dark:text-slate-200"
            >
              <FiEdit2 size={13} />
              Edit Order
            </button>

            {/* Only a draft can be sent for approval; past that the row menu
                and the activity log drive the rest of the pipeline. */}
            {isDraft && (
              <button
                type="button"
                onClick={sendForApproval}
                disabled={sending}
                className="flex items-center gap-2 rounded-lg bg-[#233353] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#18243a] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FiSend size={13} />
                {sending ? "Sending..." : "Send For Approval"}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        {/* =====================================================
            LEFT COLUMN
        ===================================================== */}

        <div className="space-y-4">
          {/* ORDER & ACCOUNT OVERVIEW */}
          <Card icon={<FiInfo size={15} />} title="Order & Account Overview">
            <div className="grid grid-cols-1 gap-x-10 gap-y-3 md:grid-cols-2">
              <Field label="Customer Type" value={order.customer_type} />
              <Field label="Organization Name" value={order.company_name} />
              <Field label="GST" value={customerInfo.gst} />
              <Field label="PAN" value={customerInfo.pan} />
              <Field label="COI Number" value={customerInfo.cin} />
              <Field label="Registration" value={customerInfo.registration} />

              <div className="flex items-center">
                <span className="w-[130px] shrink-0 text-[11px] text-slate-500">
                  Assigned To:
                </span>

                <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-700 dark:bg-[#0b2034] dark:text-slate-200">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-300 text-[8px] dark:bg-[#17304a]">
                    {(order.assigned_to || "U").charAt(0).toUpperCase()}
                  </span>
                  {order.assigned_to || "Unassigned"}
                </span>
              </div>

            </div>
          </Card>

          {/* BILLING & SHIPPING */}
          {/* Editable in place behind the design's Edit Address control:
              correcting an address is the commonest change to a saved order,
              and sending the user back to the form for it is heavy-handed. */}
          <Card
            icon={<FiInfo size={15} />}
            title="Billing & Shipping"
            action={
              editingAddress ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setBillingDraft(asRecord(order.billing_address));
                      setShippingDraft(asRecord(order.shipping_address));
                      setEditingAddress(false);
                    }}
                    className="rounded-md px-2 py-1.5 text-[10px] font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={saveAddresses}
                    disabled={sending}
                    className="rounded-md bg-[#233353] px-3 py-1.5 text-[10px] font-bold text-white disabled:opacity-40"
                  >
                    {sending ? "Saving..." : "Save Address"}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditingAddress(true)}
                  className="flex items-center gap-1 text-[10px] font-medium text-slate-500 hover:text-[#233353] dark:hover:text-white"
                >
                  <FiEdit2 size={10} />
                  Edit Address
                </button>
              )
            }
          >
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
              <AddressFieldsBlock
                title="Billing Address"
                address={billingDraft}
                disabled={!editingAddress}
                onChange={setBillingDraft}
              />

              <AddressFieldsBlock
                title="Shipping Address"
                address={sameAsBilling ? billingDraft : shippingDraft}
                disabled={sameAsBilling || !editingAddress}
                onChange={setShippingDraft}
                header={
                  <label className="flex cursor-pointer items-center gap-1.5 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={sameAsBilling}
                      disabled={!editingAddress}
                      onChange={(event) => setSameAsBilling(event.target.checked)}
                      className="h-3.5 w-3.5 rounded border-slate-300 accent-[#233353]"
                    />
                    Same as Billing
                  </label>
                }
              />
            </div>
          </Card>

          {/* PRODUCTS & ORDER ITEMS */}
          <Card icon={<FiPackage size={15} />} title="Products & Order Items">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-200 text-[10px] font-semibold text-slate-500 dark:border-[#17304a]">
                    <th className="px-3 py-2.5">Product</th>
                    <th className="px-3 py-2.5">Model / Variant</th>
                    <th className="px-3 py-2.5">Qty</th>
                    <th className="px-3 py-2.5">Discount</th>
                    <th className="px-3 py-2.5">Tax</th>
                    <th className="px-3 py-2.5 text-right">Unit Price</th>
                    <th className="w-12 px-3 py-2.5" />
                  </tr>
                </thead>

                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="py-10 text-center text-xs text-slate-400"
                      >
                        No products on this order.
                      </td>
                    </tr>
                  ) : (
                    items.map((item, index) => {
                      const totals = lineTotals(item);

                      return (
                        <tr
                          key={`${item.product_id || item.description}-${index}`}
                          className="border-b border-slate-100 dark:border-[#17304a]/70"
                        >
                          {/* Product family with its SKU beneath, and the
                              specific model alongside - the shape the design
                              uses and the quotation already stored. Orders
                              saved before those fields existed fall back to
                              the description they did carry. */}
                          <td className="px-3 py-3">
                            <p className="text-[11px] font-bold text-slate-800 dark:text-white">
                              {item.product || item.description || item.item || "Product"}
                            </p>

                            {(item.sku || item.product_id) && (
                              <p className="text-[9px] text-slate-400">
                                SKU: {item.sku || item.product_id}
                              </p>
                            )}
                          </td>

                          <td className="px-3 py-3 text-[10px] text-slate-500">
                            {item.model || item.description || "-"}
                          </td>

                          {/* Quantity, discount and tax are editable here, as
                              the design has them - every change re-derives the
                              totals below on the backend. */}
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                disabled={sending || totals.quantity <= 1}
                                onClick={() =>
                                  patchLine(
                                    index,
                                    "quantity_case",
                                    totals.quantity - 1,
                                  )
                                }
                                className="flex h-6 w-6 items-center justify-center rounded border border-slate-200 text-slate-500 disabled:opacity-30 dark:border-[#17304a]"
                              >
                                <FiMinus size={10} />
                              </button>

                              <span className="min-w-4 text-center text-[11px] text-slate-700 dark:text-slate-300">
                                {totals.quantity}
                              </span>

                              <button
                                type="button"
                                disabled={sending}
                                onClick={() =>
                                  patchLine(
                                    index,
                                    "quantity_case",
                                    totals.quantity + 1,
                                  )
                                }
                                className="flex h-6 w-6 items-center justify-center rounded border border-slate-200 text-slate-500 disabled:opacity-30 dark:border-[#17304a]"
                              >
                                <FiPlus size={10} />
                              </button>
                            </div>
                          </td>

                          <td className="px-3 py-3">
                            <PercentCell
                              value={Number(item.discount) || 0}
                              disabled={sending}
                              onCommit={(next) =>
                                patchLine(index, "discount", next)
                              }
                            />
                          </td>

                          <td className="px-3 py-3">
                            <PercentCell
                              value={Number(item.tax_rate) || 0}
                              disabled={sending}
                              onCommit={(next) =>
                                patchLine(index, "tax_rate", next)
                              }
                            />
                          </td>

                          <td className="px-3 py-3 text-right text-[11px] font-semibold text-slate-800 dark:text-white">
                            {Number(totals.unitPrice).toLocaleString("en-IN")}
                          </td>

                          <td className="px-3 py-3">
                            <button
                              type="button"
                              aria-label="Remove line"
                              disabled={sending}
                              onClick={() => removeLine(index)}
                              className="rounded-md p-1.5 text-rose-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30 dark:hover:bg-rose-950/20"
                            >
                              <FiTrash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Totals, as stored. Every figure here was computed by the
                backend from the lines and charges above. */}
            <div className="mt-5 flex justify-end">
              <div className="w-full max-w-[400px] space-y-2.5">
                <SummaryLine
                  label="Subtotal:"
                  value={money(order.total_amount)}
                />

                <SummaryLine
                  label="Total Discount:"
                  value={`-${money(order.discount_amount)}`}
                  tone="rose"
                />

                <SummaryLine
                  label={`ORC (${Number(order.orc_percent || 0).toFixed(2)}%):`}
                  value={`-${money(order.orc_amount)}`}
                  tone="rose"
                />

                <SummaryLine
                  label="Freight Charges:"
                  value={`+${money(order.freight_charges)}`}
                />

                <SummaryLine
                  label="Lumpsum (Installation):"
                  value={`+${money(order.installation_lumpsum)}`}
                />

                <div className="border-t border-slate-100 pt-2.5 dark:border-[#17304a]">
                  <SummaryLine
                    label="Taxable Amount:"
                    value={money(order.taxable_amount)}
                  />
                </div>

                <SummaryLine
                  label={`Estimated GST (${gstPercent}%):`}
                  value={`+${money(order.gst_amount)}`}
                />

                <div className="flex items-center justify-between border-t border-slate-200 pt-2.5 dark:border-[#17304a]">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    Total Payable:
                  </span>

                  <span className="text-sm font-bold text-slate-900 dark:text-white">
                    {money(order.grand_total)}
                  </span>
                </div>

                {/* What has actually come in against the order, and what is
                    still owed. Both are stored on the order. */}
                <SummaryLine
                  label="Amount Paid:"
                  value={`-${money(order.advance_received)}`}
                  tone="rose"
                />

                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-500">
                    Balance Due:
                  </span>

                  <span className="text-[11px] font-semibold text-slate-800 dark:text-white">
                    {money(order.outstanding_balance)}
                  </span>
                </div>
              </div>
            </div>
          </Card>

          {/* TERMS */}
          <Card
            icon={<FiShield size={15} />}
            title="Terms, Conditions & Technical Notes"
          >
            <div className="rounded-xl bg-slate-50 p-4 dark:bg-[#0b2034]">
              <p className="mb-3 text-[11px] font-semibold text-slate-500">
                Pre-filled Commercial Conditions
              </p>

              {order.commercial_terms?.length ? (
                <ul className="space-y-2.5">
                  {order.commercial_terms.map((term, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#24395f]" />

                      <span className="text-[11px] leading-5 text-slate-600 dark:text-slate-300">
                        {term}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[11px] text-slate-400">
                  No commercial conditions recorded on this order.
                </p>
              )}
            </div>

            {order.technical_notes && (
              <div className="mt-4">
                <p className="mb-2 text-[11px] font-medium text-slate-500">
                  Technical Scope & Deployment Notes
                </p>

                <p className="rounded-xl bg-slate-50 p-3 text-[11px] leading-5 text-slate-600 dark:bg-[#0b2034] dark:text-slate-300">
                  {order.technical_notes}
                </p>
              </div>
            )}
          </Card>
        </div>

        {/* =====================================================
            RIGHT COLUMN
        ===================================================== */}

        <div className="space-y-4">
          {/* ORDER SUMMARY

              The figure and how it splits. The order's own totals sit under
              the line items; this states the headline and the terms. */}
          <Card icon={<FiFileText size={15} />} title="Order Summary">
            <div className="rounded-xl bg-emerald-50 px-4 py-3 dark:bg-emerald-950/20">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Total Payable
                </span>

                <span className="text-[17px] font-bold text-slate-900 dark:text-white">
                  {money(order.grand_total)}
                </span>
              </div>
            </div>

            <p className="mb-2 mt-4 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
              Payment Terms:
            </p>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-500">
                  {Number(order.advance_percent ?? 30)}% Advance
                </span>

                <span className="text-[11px] font-semibold text-amber-500">
                  {money(order.advance_expected)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-500">
                  {100 - Number(order.advance_percent ?? 30)}% Against Delivery
                </span>

                <span className="text-[11px] font-semibold text-[#3b82f6]">
                  {money(order.balance_expected)}
                </span>
              </div>
            </div>
          </Card>

          {/* ORDER PROCESS */}
          <Card icon={<FiClock size={15} />} title="Order Process">
            <div className="space-y-4">
              {/* Each step reads the order rather than being a fixed picture
                  of one, so a step is only ticked once it has happened. */}
              <ProcessStep
                state={order.quotation_id ? "done" : "todo"}
                title="Quotation Approved"
                caption={
                  order.quotation_id
                    ? `${order.quotation_id} linked`
                    : "No quotation linked"
                }
              />

              <ProcessStep
                state={order.po_number ? "done" : "todo"}
                title="Customer PO Received"
                caption={
                  order.po_number
                    ? `${order.po_number} recorded${
                        order.po_date ? ` on ${formatDate(order.po_date)}` : ""
                      }`
                    : "No customer PO recorded"
                }
              />

              {/* The order itself is the step in progress until it is
                  released, which is when the goods actually move. */}
              <ProcessStep
                state={orderStepDone ? "done" : "current"}
                title="Sales Order"
                caption={`${order.order_number || order.id} · ${salesOrderStatusLabel(
                  order.status,
                )}`}
              />

              {/* Only the furthest step reached is highlighted - the design
                  never shows two at once, and two ambers reads as two things
                  happening rather than one. */}
              <ProcessStep
                state={
                  (order.advance_received || 0) > 0
                    ? "done"
                    : orderStepDone
                      ? "current"
                      : "todo"
                }
                title="Proforma Invoice"
                caption={
                  (order.advance_received || 0) > 0
                    ? `${money(order.advance_received)} received against it`
                    : order.status === SALES_ORDER_STATUS.DRAFT
                      ? "Not Generated"
                      : `Awaiting ${Number(
                          order.advance_percent ?? 30,
                        )}% advance (${money(order.advance_expected)})`
                }
              />

              <ProcessStep
                state={
                  order.status === SALES_ORDER_STATUS.COMPLETED
                    ? "done"
                    : order.status === SALES_ORDER_STATUS.RELEASED
                      ? "current"
                      : "todo"
                }
                title="Fulfillment"
                caption={
                  order.status === SALES_ORDER_STATUS.COMPLETED
                    ? "Completed"
                    : order.status === SALES_ORDER_STATUS.RELEASED
                      ? "Released for dispatch"
                      : "Not Released"
                }
                last
              />
            </div>
          </Card>

          {/* ATTACHED DOCUMENTS

              The design folds the linked records and the uploaded files into
              one list, rather than the two panels this page had. */}
          <Card
            icon={<FiFileText size={15} />}
            title="Attached Documents"
            action={
              <span
                title="Documents are attached while creating or editing the order"
                className="text-[10px] font-semibold text-slate-400"
              >
                + Upload Documents
              </span>
            }
          >
            <div className="space-y-2.5">
              <LinkedDocument
                title={
                  order.quotation_id
                    ? `Quotation ${order.quotation_id}`
                    : "Quotation"
                }
                subtitle={order.quotation_id ? "Approved" : "Not linked"}
                href={order.quotation_id ? "/sales/quotations" : undefined}
              />

              <LinkedDocument
                title={
                  order.po_number
                    ? `Customer PO: ${order.po_number}`
                    : "Customer PO"
                }
                subtitle={order.po_number ? "Received" : "Not received"}
              />

              <LinkedDocument
                title={`Sales Order ${orderReference(order)}`}
                subtitle={salesOrderStatusLabel(order.status)}
              />

              <LinkedDocument
                title="Proforma Invoice"
                subtitle={
                  order.status === SALES_ORDER_STATUS.DRAFT
                    ? "Not Generated"
                    : "Pending generation"
                }
              />

              {order.attachments?.map((file, index) => (
                <div
                  key={`${file.name}-${index}`}
                  className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2.5 dark:bg-[#0b2034]"
                >
                  <FiFileText size={12} className="shrink-0 text-rose-500" />

                  <span className="truncate text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                    {file.name}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {/* ACTIVITY HISTORY */}
          <Card
            icon={<FiClock size={15} />}
            title="Activity History"
            action={
              <button
                type="button"
                onClick={() => setShowActivityForm((value) => !value)}
                className="text-[10px] font-medium text-slate-500 hover:text-[#233353] dark:hover:text-white"
              >
                {showActivityForm ? "Cancel" : "+ Log Activity"}
              </button>
            }
          >
            {showActivityForm && (
              <LogActivityForm
                status={order.status}
                saving={sending}
                onCancel={() => setShowActivityForm(false)}
                onSubmit={async (payload) => {
                  const ok = await logActivity(payload);

                  if (ok) setShowActivityForm(false);

                  return ok;
                }}
              />
            )}

            {activitiesLoading ? (
              <p className="py-3 text-[10px] font-medium text-slate-400">
                Loading activity...
              </p>
            ) : activities.length === 0 ? (
              <p className="py-3 text-[10px] text-slate-400">
                No activity recorded yet.
              </p>
            ) : (
              <div className="relative ml-1 border-l border-slate-200 pl-4 dark:border-[#17304a]">
                {activities.map((activity, index) => (
                  <div key={activity.id} className="relative mb-4 last:mb-0">
                    <span
                      className={`absolute -left-[21px] top-2 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-[#071929] ${
                        index === 0
                          ? "bg-[#233353]"
                          : "bg-slate-300 dark:bg-slate-600"
                      }`}
                    />

                    <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-[#17304a] dark:bg-[#0b1d2e]">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[11px] font-bold text-slate-800 dark:text-white">
                          {activity.action}
                        </p>

                        <span className="shrink-0 text-[9px] text-slate-400">
                          {formatActivityStamp(activity.created_at)}
                        </span>
                      </div>

                      {activity.description && (
                        <p className="mt-1 text-[10px] leading-5 text-slate-500 dark:text-slate-400">
                          {activity.description}
                        </p>
                      )}

                      <p className="mt-1.5 flex items-center gap-1 text-[9px] text-slate-400">
                        <FiCalendar size={9} />
                        {formatDate(activity.created_at)}
                        {activity.created_by_name
                          ? ` • ${activity.created_by_name}`
                          : ""}

                        {/* The opportunity's entries are merged in, so say
                            which record each one came from. */}
                        {activity.source === "opportunity" && (
                          <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-[8px] font-semibold text-slate-500 dark:bg-[#0b2034]">
                            Opportunity
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   LOG ACTIVITY FORM
========================================================= */

function LogActivityForm({
  status,
  saving,
  onCancel,
  onSubmit,
}: {
  status: string;
  saving: boolean;
  onCancel: () => void;
  onSubmit: (payload: { status?: string; remarks?: string }) => Promise<boolean>;
}) {
  const nextStatuses = nextSalesOrderStatuses(status);

  const [next, setNext] = useState<string>(nextStatuses[0] || "");
  const [remarks, setRemarks] = useState("");

  useEffect(() => {
    setNext(nextSalesOrderStatuses(status)[0] || "");
    setRemarks("");
  }, [status]);

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();

        const ok = await onSubmit({
          status: next || undefined,
          remarks: remarks.trim() || undefined,
        });

        if (ok) setRemarks("");
      }}
      className="mb-4 rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-[#17304a] dark:bg-[#0b2034]"
    >
      <label className="mb-1.5 block text-[10px] font-semibold text-slate-600 dark:text-slate-400">
        Move Status To
      </label>

      <select
        value={next}
        onChange={(event) => setNext(event.target.value)}
        className="mb-3 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-[11px] text-slate-700 outline-none dark:border-[#17304a] dark:bg-[#071929] dark:text-white"
      >
        {/* Always available, so a note can be logged without moving the
            order on. */}
        <option value="">Keep as {salesOrderStatusLabel(status)}</option>

        {nextStatuses.map((option) => (
          <option key={option} value={option}>
            {SALES_ORDER_STATUS_LABEL[option]}
          </option>
        ))}
      </select>

      <label className="mb-1.5 block text-[10px] font-semibold text-slate-600 dark:text-slate-400">
        Remarks
      </label>

      <textarea
        rows={3}
        value={remarks}
        onChange={(event) => setRemarks(event.target.value)}
        placeholder="What happened? e.g. Advance received against PI."
        className="w-full resize-none rounded-lg border border-slate-200 bg-white p-2.5 text-[11px] text-slate-800 outline-none dark:border-[#17304a] dark:bg-[#071929] dark:text-white"
      />

      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-3 py-2 text-[10px] font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white"
        >
          Cancel
        </button>

        <button
          type="submit"
          disabled={saving || (!next && !remarks.trim())}
          className="rounded-lg bg-[#233353] px-4 py-2 text-[10px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? "Saving..." : "Submit"}
        </button>
      </div>
    </form>
  );
}

/* =========================================================
   SMALL PIECES
========================================================= */

function Card({
  icon,
  title,
  action,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 dark:border-[#17304a] dark:bg-[#071929]">
      <div className="mb-4 flex items-center justify-between gap-3 border-b border-slate-200 pb-3 dark:border-[#17304a]">
        <div className="flex items-center gap-2">
          <span className="text-slate-600 dark:text-slate-300">{icon}</span>

          <h3 className="text-[13px] font-semibold text-slate-800 dark:text-white">
            {title}
          </h3>
        </div>

        {action}
      </div>

      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value?: unknown }) {
  const text =
    value === null || value === undefined || value === "" ? "-" : String(value);

  return (
    <div className="flex items-start">
      <span className="w-[130px] shrink-0 text-[11px] text-slate-500">
        {label}:
      </span>

      <span className="text-[11px] font-semibold text-slate-800 dark:text-white">
        {text}
      </span>
    </div>
  );
}

function PercentCell({
  value,
  disabled,
  onCommit,
}: {
  value: number;
  disabled?: boolean;
  onCommit: (next: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => setDraft(String(value)), [value]);

  const commit = () => {
    const next = Math.min(100, Math.max(0, Number(draft.replace(/[^\d.]/g, "")) || 0));

    if (next !== value) onCommit(next);
    else setDraft(String(value));
  };

  return (
    <div className="flex h-8 w-[70px] items-center rounded-md border border-slate-200 px-2 focus-within:border-[#233353] dark:border-[#17304a]">
      <input
        type="text"
        inputMode="decimal"
        value={draft}
        disabled={disabled}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          /* Commit on Enter directly rather than leaning on blur() to do it
             - the field stays focused for the next edit, and Enter behaves
             the same whether or not the window has focus. */
          if (event.key === "Enter") commit();
          if (event.key === "Escape") setDraft(String(value));
        }}
        className="w-full min-w-0 border-0 bg-transparent p-0 text-[11px] text-slate-700 outline-none disabled:opacity-50 dark:text-white"
      />

      <span className="ml-1 shrink-0 text-[10px] text-slate-400">%</span>
    </div>
  );
}

function AddressFieldsBlock({
  title,
  address,
  onChange,
  disabled,
  header,
}: {
  title: string;
  address: Record<string, any>;
  onChange: (next: Record<string, any>) => void;
  /** Shipping is greyed out while it mirrors billing, and everything is
      greyed until Edit Address is pressed. */
  disabled?: boolean;
  header?: React.ReactNode;
}) {
  const set = (field: string, value: string) =>
    onChange({ ...address, [field]: value });

  const input =
    "h-9 w-full rounded-lg border border-slate-200 px-3 text-[11px] text-slate-700 outline-none transition focus:border-[#233353] disabled:border-transparent disabled:bg-transparent disabled:px-0 disabled:text-slate-700 dark:border-[#17304a] dark:bg-[#051422] dark:text-white dark:disabled:bg-transparent";

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3 border-b border-slate-100 pb-2 dark:border-[#17304a]">
        <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
          {title}
        </p>

        {header}
      </div>

      <div className="space-y-3">
        <input
          value={address.street || ""}
          disabled={disabled}
          onChange={(event) => set("street", event.target.value)}
          placeholder="Street Address, Building, Suite"
          className={input}
        />

        <div className="grid grid-cols-2 gap-3">
          <input
            value={address.state || ""}
            disabled={disabled}
            onChange={(event) => set("state", event.target.value)}
            placeholder="State"
            className={input}
          />

          <input
            value={address.city || ""}
            disabled={disabled}
            onChange={(event) => set("city", event.target.value)}
            placeholder="City"
            className={input}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <input
            value={address.country || ""}
            disabled={disabled}
            onChange={(event) => set("country", event.target.value)}
            placeholder="Country"
            className={input}
          />

          <input
            value={address.pin || ""}
            disabled={disabled}
            onChange={(event) => set("pin", event.target.value)}
            placeholder="PIN / ZIP Code"
            className={input}
          />
        </div>
      </div>
    </div>
  );
}

function ProcessStep({
  state,
  title,
  caption,
  last,
}: {
  /** "current" is the step the order is sitting on right now. */
  state: "done" | "current" | "todo";
  title: string;
  caption: string;
  last?: boolean;
}) {
  return (
    <div className="relative flex gap-3">
      {!last && (
        <span className="absolute left-[11px] top-6 h-[calc(100%-8px)] w-px bg-slate-200 dark:bg-[#17304a]" />
      )}

      <span
        className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
          state === "done"
            ? "bg-emerald-500 text-white"
            : state === "current"
              ? "bg-amber-400 text-white"
              : "border border-slate-300 bg-white text-slate-300 dark:border-[#17304a] dark:bg-[#071929]"
        }`}
      >
        {state === "done" ? (
          <FiCheckCircle size={13} />
        ) : state === "current" ? (
          <FiClock size={12} />
        ) : (
          <FiPlus size={11} />
        )}
      </span>

      <div className="pb-1">
        <p className="text-[11px] font-bold text-slate-800 dark:text-white">
          {title}
        </p>

        <p className="mt-0.5 text-[10px] text-slate-500">{caption}</p>
      </div>
    </div>
  );
}

function LinkedDocument({
  title,
  subtitle,
  href,
}: {
  title: string;
  subtitle: string;
  href?: string;
}) {
  const router = useRouter();

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2.5 dark:bg-[#0b2034]">
      <div className="min-w-0">
        <p className="truncate text-[11px] font-bold text-slate-800 dark:text-white">
          {title}
        </p>

        <p className="text-[10px] text-slate-500">{subtitle}</p>
      </div>

      <button
        type="button"
        disabled={!href}
        onClick={() => href && router.push(href)}
        className="flex shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-[#17304a] dark:bg-[#071929] dark:text-slate-300"
      >
        View
        <FiChevronRight size={11} />
      </button>
    </div>
  );
}

function SummaryLine({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "rose";
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] text-slate-500">{label}</span>

      <span
        className={`text-[11px] font-semibold ${
          tone === "rose"
            ? "text-rose-500"
            : "text-slate-800 dark:text-white"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
