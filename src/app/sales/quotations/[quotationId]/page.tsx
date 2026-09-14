"use client";

/**
 * Quotation detail page.
 *
 * Opened by clicking a row in the Quotation list. Shows the quotation as
 * saved - customer, addresses, lines, totals and clauses - alongside where it
 * has got to and how it got there.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { useUIStore } from "@/lib/store/ui.store";
import { StatusPill } from "@/components/crm/Pill";
import {
  getOpportunityApi,
  type OpportunityModel,
} from "@/features/opportunities/api/opportunities.api";
import {
  SALES_ORDER_STATUS,
  getSalesOrdersApi,
  salesOrderStatusLabel,
  type SalesOrderModel,
} from "@/features/salesOrders/api/salesOrders.api";
import {
  QUOTATION_STATUS,
  QUOTATION_STATUS_LABEL,
  QUOTATION_TRANSITIONS,
  QuotationActivity,
  QuotationAddress,
  QuotationModel,
  QuotationStatus,
  getQuotationActivitiesApi,
  getQuotationApi,
  logQuotationActivityApi,
  updateQuotationApi,
} from "@/features/quotations/api/quotations.api";

import {
  FiArrowLeft,
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiDownload,
  FiEdit2,
  FiFileText,
  FiInfo,
  FiPackage,
  FiPlus,
  FiRepeat,
  FiShield,
  FiX,
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

/** Quote numbers are stored with their own prefix; don't add a second one. */
function quoteReference(quotation: QuotationModel) {
  const reference = (quotation.quote_number || "").trim();

  return reference ? `#${reference}` : `#QT-${quotation.id}`;
}

/** Strips the rich-text remarks down to something safe to render as text. */
function remarksToLines(html?: string | null) {
  if (!html) return [];

  const text = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

/* =========================================================
   PAGE
========================================================= */

export default function QuotationDetailPage() {
  const params = useParams<{ quotationId: string }>();
  const router = useRouter();
  const { addToast } = useUIStore();

  const quotationId = params?.quotationId;

  const [quotation, setQuotation] = useState<QuotationModel | null>(null);
  const [loading, setLoading] = useState(true);

  const [activities, setActivities] = useState<QuotationActivity[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);

  const [saving, setSaving] = useState(false);
  const [showActivityForm, setShowActivityForm] = useState(false);

  /* Editable copies of the addresses and charges. Held apart from the saved
     quotation so nothing is written until the user says so - and so a failed
     save leaves what they typed on screen rather than reverting it. */
  /* The quotation itself stores no GST / PAN / COI - those belong to the
     account and are held on the opportunity it was raised against, so the
     overview reads them from there rather than duplicating them. */
  const [opportunity, setOpportunity] = useState<OpportunityModel | null>(null);

  /* The sales order raised against this quotation, if one exists. The order
     stores the quote number, so the link is followed from that rather than
     guessed from the customer. */
  const [linkedOrder, setLinkedOrder] = useState<SalesOrderModel | null>(null);

  const [billingDraft, setBillingDraft] = useState<QuotationAddress>({});
  const [shippingDraft, setShippingDraft] = useState<QuotationAddress>({});
  const [sameAsBilling, setSameAsBilling] = useState(false);
  const [addressDirty, setAddressDirty] = useState(false);

  const loadQuotation = useCallback(async () => {
    if (!quotationId) return;

    try {
      setLoading(true);

      const saved = await getQuotationApi(quotationId);

      setQuotation(saved);

      setBillingDraft(saved.billing_address || {});
      setShippingDraft(saved.shipping_address || {});
      setSameAsBilling(Boolean(saved.shipping_same_as_billing));
      setAddressDirty(false);
    } catch (error: any) {
      console.error(error);

      addToast(
        error?.response?.data?.detail || "Unable to load this quotation.",
        "error",
      );
    } finally {
      setLoading(false);
    }
  }, [quotationId, addToast]);

  const loadActivities = useCallback(async () => {
    if (!quotationId) return;

    try {
      setActivitiesLoading(true);

      setActivities(await getQuotationActivitiesApi(quotationId));
    } catch (error) {
      console.error(error);

      setActivities([]);
    } finally {
      setActivitiesLoading(false);
    }
  }, [quotationId]);

  useEffect(() => {
    loadQuotation();
    loadActivities();
  }, [loadQuotation, loadActivities]);

  /* Account context is a nice-to-have: a failure here must not stop the
     quotation itself from rendering. */
  useEffect(() => {
    if (!quotation?.opportunity_id) return;

    getOpportunityApi(quotation.opportunity_id)
      .then(setOpportunity)
      .catch(() => setOpportunity(null));
  }, [quotation?.opportunity_id]);

  useEffect(() => {
    const reference = quotation?.quote_number;

    if (!reference) return;

    getSalesOrdersApi()
      .then((orders) =>
        setLinkedOrder(
          orders.find((order) => order.quotation_id === reference) || null,
        ),
      )
      .catch(() => setLinkedOrder(null));
  }, [quotation?.quote_number]);

  const items = useMemo(
    () => (Array.isArray(quotation?.items) ? quotation!.items : []),
    [quotation],
  );

  /* Days left on the quotation, from its validity date. */
  const validity = useMemo(() => {
    const due = quotation?.validation_date
      ? new Date(quotation.validation_date)
      : null;

    if (!due || Number.isNaN(due.getTime())) {
      return { label: "No validity date", expired: false };
    }

    const startOfDay = (input: Date) =>
      new Date(input.getFullYear(), input.getMonth(), input.getDate()).getTime();

    const days = Math.round(
      (startOfDay(due) - startOfDay(new Date())) / 86400000,
    );

    if (days < 0) return { label: "Expired", expired: true };
    if (days === 0) return { label: "Expires Today", expired: false };

    return { label: `${days} Day${days === 1 ? "" : "s"} Left`, expired: false };
  }, [quotation]);

  /* ---------------------------------------------------------------
     ACTIONS
  --------------------------------------------------------------- */

  /** Persist one partial change and fold the response back into the page. */
  const patchQuotation = async (
    payload: Record<string, unknown>,
    message: string,
  ) => {
    if (!quotation) return false;

    setSaving(true);

    try {
      const updated = await updateQuotationApi(quotation.id, payload as never);

      setQuotation(updated);

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
      setSaving(false);
    }
  };

  /** Drops one annexure and saves the shortened list. */
  const removeAttachment = async (index: number) => {
    if (!quotation) return;

    await patchQuotation(
      {
        attachments: (quotation.attachments || []).filter(
          (_, position) => position !== index,
        ),
      },
      "Annexure removed.",
    );
  };

  const saveAddresses = async () => {
    const shippingToSave = sameAsBilling ? billingDraft : shippingDraft;

    const ok = await patchQuotation(
      {
        billing_address: billingDraft,
        shipping_address: shippingToSave,
        shipping_same_as_billing: sameAsBilling,
      },
      "Address updated.",
    );

    if (ok) setAddressDirty(false);
  };

  /* Charges and the GST rate carry pencils in the design; each saves on its
     own so a single correction does not require resubmitting the form. */
  const saveCharge = (field: string, label: string) => async (next: number) => {
    await patchQuotation({ [field]: next }, `${label} updated.`);
  };

  const logActivity = async (payload: {
    status?: QuotationStatus;
    remarks?: string;
  }) => {
    if (!quotation) return false;

    setSaving(true);

    try {
      const result = await logQuotationActivityApi(quotation.id, payload);

      setQuotation(result.quotation);

      addToast(
        payload.status
          ? `Quotation moved to ${QUOTATION_STATUS_LABEL[result.quotation.status]}.`
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
      setSaving(false);
    }
  };

  /* ---------------------------------------------------------------
     RENDER
  --------------------------------------------------------------- */

  if (loading) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-3 text-slate-400">
        <CgSpinner className="animate-spin text-3xl text-[#233353]" />
        <p className="text-xs font-semibold">Loading quotation...</p>
      </div>
    );
  }

  if (!quotation) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-3">
        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
          Quotation not found
        </p>

        <button
          type="button"
          onClick={() => router.push("/sales/quotations")}
          className="rounded-lg bg-[#233353] px-4 py-2 text-xs font-bold text-white"
        >
          Back to all Quotation
        </button>
      </div>
    );
  }

  const remarkLines = remarksToLines(quotation.remarks);

  /* How far the quote has travelled towards a fulfilled order. Everything
     before this index is done, this one is in progress, the rest are still
     ahead - so only one step is ever highlighted. */
  const reachedStep = (() => {
    if (linkedOrder?.status === SALES_ORDER_STATUS.COMPLETED) return 5;
    if (linkedOrder?.status === SALES_ORDER_STATUS.RELEASED) return 4;
    if ((linkedOrder?.advance_received || 0) > 0) return 4;
    if (linkedOrder) return 3;
    if (quotation.status === QUOTATION_STATUS.ACCEPTED) return 1;

    return 0;
  })();

  const processState = (index: number): "done" | "current" | "todo" =>
    index < reachedStep ? "done" : index === reachedStep ? "current" : "todo";

  /* The backend refuses edits once a quotation has been sent - a revision is
     raised instead - so the inline controls are only offered while it is
     still a draft, rather than presenting an edit that would 400. */
  const editable = quotation.status === QUOTATION_STATUS.DRAFT;

  return (
    <div className="min-h-full space-y-4 pb-8">
      {/* HEADER */}

      <div>
        <button
          type="button"
          onClick={() => router.push("/sales/quotations")}
          className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-slate-500 hover:text-[#233353] dark:hover:text-white"
        >
          <FiArrowLeft size={12} />
          Back to all Quotation
        </button>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
              {quoteReference(quotation)}
              {quotation.organization_name
                ? ` - ${quotation.organization_name}`
                : ""}
            </h1>

            <StatusPill
              status={quotation.status}
              label={QUOTATION_STATUS_LABEL[quotation.status]}
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 dark:border-[#17304a] dark:bg-[#071929] dark:text-slate-200"
            >
              <FiDownload size={13} />
              Download
            </button>

            {/* Carries the quotation's reference through, so the New Sales
                Order form opens knowing what it is being raised against -
                which is what ties the order back to the opportunity. */}
            <button
              type="button"
              onClick={() =>
                router.push(
                  `/sales/orders?quotation=${encodeURIComponent(
                    quotation.quote_number || "",
                  )}`,
                )
              }
              className="flex items-center gap-2 rounded-lg bg-[#233353] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#18243a]"
            >
              <FiRepeat size={13} />
              Convert To Sales Order
            </button>
          </div>
        </div>
      </div>

      {/* HEADLINE FIGURES */}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-[#17304a] dark:bg-[#071929]">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Quotation Value
          </p>

          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            {money(quotation.total_payable)}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-[#17304a] dark:bg-[#071929]">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Validity Period
          </p>

          {/* Counted from the validity date rather than printed, so an
              expired quote says so instead of showing a stale countdown. */}
          <p
            className={`mt-2 text-2xl font-bold ${
              validity.expired
                ? "text-rose-500"
                : "text-slate-900 dark:text-white"
            }`}
          >
            {validity.label}
          </p>

          <p className="mt-1 text-[10px] text-slate-400">
            Issued: {formatDate(quotation.quotation_date)} · Due:{" "}
            {formatDate(quotation.validation_date)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        {/* LEFT */}

        <div className="space-y-4">
          <Card icon={<FiInfo size={15} />} title="Order & Account Overview">
            <div className="grid grid-cols-1 gap-x-10 gap-y-3 md:grid-cols-2">
              <Field label="Customer Type" value={quotation.customer_type} />
              <Field
                label="Organization Name"
                value={quotation.organization_name}
              />
              <Field label="GST" value={opportunity?.gst_number} />
              <Field label="PAN" value={opportunity?.pan_number} />
              <Field label="COI Number" value={opportunity?.coi_number} />
              <Field
                label="Registration"
                value={opportunity?.gst_number ? "Registered" : null}
              />

              <div className="flex items-center">
                <span className="w-[130px] shrink-0 text-[11px] text-slate-500">
                  Assigned To:
                </span>

                <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-700 dark:bg-[#0b2034] dark:text-slate-200">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-300 text-[8px] dark:bg-[#17304a]">
                    {(quotation.contact_name || "U").charAt(0).toUpperCase()}
                  </span>
                  {opportunity?.assigned_to_name || "Unassigned"}
                </span>
              </div>
            </div>

            {/* The contact the quotation is addressed to. Kept below the
                account block rather than mixed into it. */}
            <div className="mt-5 border-t border-slate-100 pt-4 dark:border-[#17304a]">
              <p className="mb-3 text-xs font-semibold text-slate-600 dark:text-slate-300">
                Primary Contact
              </p>

              <div className="grid grid-cols-1 gap-x-10 gap-y-3 md:grid-cols-2">
                <Field label="Contact Person" value={quotation.contact_name} />
                <Field label="Designation" value={quotation.designation} />
                <Field label="Mobile Number" value={quotation.mobile_number} />
                <Field label="Email Address" value={quotation.email} />
              </div>
            </div>
          </Card>

          {/* Editable in place: correcting an address is the commonest
              change to a saved quotation, and the design puts the fields
              right here rather than sending the user back to the form. */}
          <Card
            icon={<FiInfo size={15} />}
            title="Billing & Shipping"
            action={
              <div className="flex items-center gap-3">
                {!editable && (
                  <span className="text-[10px] text-slate-400">
                    Locked once sent
                  </span>
                )}

                {editable && addressDirty && (
                  <button
                    type="button"
                    onClick={saveAddresses}
                    disabled={saving}
                    className="rounded-md bg-[#233353] px-3 py-1.5 text-[10px] font-bold text-white disabled:opacity-40"
                  >
                    {saving ? "Saving..." : "Save Address"}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setShowActivityForm((value) => !value)}
                  className="flex items-center gap-1 text-[10px] font-medium text-slate-500 hover:text-[#233353] dark:hover:text-white"
                >
                  <FiEdit2 size={10} />
                  {showActivityForm ? "Cancel" : "Log Activity"}
                </button>
              </div>
            }
          >
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
              <AddressFieldsBlock
                title="Billing Address"
                address={billingDraft}
                disabled={!editable}
                onChange={(next) => {
                  setBillingDraft(next);
                  setAddressDirty(true);
                }}
              />

              <AddressFieldsBlock
                title="Shipping Address"
                address={sameAsBilling ? billingDraft : shippingDraft}
                disabled={sameAsBilling || !editable}
                onChange={(next) => {
                  setShippingDraft(next);
                  setAddressDirty(true);
                }}
                header={
                  <label className="flex cursor-pointer items-center gap-1.5 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={sameAsBilling}
                      disabled={!editable}
                      onChange={(event) => {
                        setSameAsBilling(event.target.checked);
                        setAddressDirty(true);
                      }}
                      className="h-3.5 w-3.5 rounded border-slate-300 accent-[#233353]"
                    />
                    Same as Billing
                  </label>
                }
              />
            </div>
          </Card>

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
                  </tr>
                </thead>

                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-10 text-center text-xs text-slate-400"
                      >
                        No products on this quotation.
                      </td>
                    </tr>
                  ) : (
                    items.map((item, index) => (
                      <tr
                        key={`${item.sku || item.product}-${index}`}
                        className="border-b border-slate-100 dark:border-[#17304a]/70"
                      >
                        <td className="px-3 py-3">
                          <p className="text-[11px] font-bold text-slate-800 dark:text-white">
                            {item.product || "Product"}
                          </p>

                          {item.sku && (
                            <p className="text-[9px] text-slate-400">
                              SKU: {item.sku}
                            </p>
                          )}
                        </td>

                        <td className="px-3 py-3 text-[10px] text-slate-500">
                          {item.model || "-"}
                        </td>

                        <td className="px-3 py-3 text-[11px] text-slate-700 dark:text-slate-300">
                          {Number(item.quantity) || 0}
                        </td>

                        <td className="px-3 py-3 text-[11px] text-slate-700 dark:text-slate-300">
                          {Number(item.discount) || 0} %
                        </td>

                        <td className="px-3 py-3 text-[11px] text-slate-700 dark:text-slate-300">
                          {Number(item.tax) || 0} %
                        </td>

                        <td className="px-3 py-3 text-right text-[11px] font-semibold text-slate-800 dark:text-white">
                          {Number(item.unit_price ?? 0).toLocaleString("en-IN")}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Totals, as stored. Every figure was computed by the backend
                from the lines and charges above. */}
            <div className="mt-5 flex justify-end">
              <div className="w-full max-w-[400px] space-y-2.5">
                <SummaryLine label="Subtotal:" value={money(quotation.subtotal)} />

                {/* The charges and the rate carry pencils in the design, so
                    a correction can be made here rather than by reopening
                    the whole form. Each saves on its own. */}
                <SummaryLine
                  label="Freight Charges:"
                  value={`+${money(quotation.freight_charges)}`}
                  edit={editable ? {
                    amount: quotation.freight_charges || 0,
                    onSave: saveCharge("freight_charges", "Freight charges"),
                  } : undefined}
                />

                <SummaryLine
                  label="Lumpsum (Installation):"
                  value={`+${money(quotation.installation_lumpsum)}`}
                  edit={editable ? {
                    amount: quotation.installation_lumpsum || 0,
                    onSave: saveCharge("installation_lumpsum", "Lumpsum"),
                  } : undefined}
                />

                <div className="border-t border-slate-100 pt-2.5 dark:border-[#17304a]">
                  <SummaryLine
                    label="Taxable Amount:"
                    value={money(quotation.taxable_amount)}
                  />
                </div>

                <SummaryLine
                  label={`Estimated GST (${quotation.gst_percent}%):`}
                  value={`+${money(quotation.gst_amount)}`}
                  edit={editable ? {
                    amount: quotation.gst_percent || 18,
                    unit: "%",
                    onSave: saveCharge("gst_percent", "GST rate"),
                  } : undefined}
                />

                <div className="flex items-center justify-between border-t border-slate-200 pt-2.5 dark:border-[#17304a]">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    Total Payable:
                  </span>

                  <span className="text-sm font-bold text-slate-900 dark:text-white">
                    {money(quotation.total_payable)}
                  </span>
                </div>
              </div>
            </div>
          </Card>

          <Card
            icon={<FiShield size={15} />}
            title="Terms, Conditions & Technical Notes"
          >
            <div className="rounded-xl bg-slate-50 p-4 dark:bg-[#0b2034]">
              <p className="mb-3 text-[11px] font-semibold text-slate-500">
                Statutory &amp; Operational Clauses
              </p>

              {quotation.terms?.length ? (
                <ul className="space-y-2.5">
                  {quotation.terms.map((term, index) => (
                    <li key={index} className="flex items-start gap-2">
                      {/* Only the clauses that were ticked apply; the rest
                          are shown struck through rather than hidden, so it
                          is clear what was deliberately left off. */}
                      <span
                        className={`mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border text-[8px] ${
                          term.checked
                            ? "border-[#233353] bg-[#233353] text-white"
                            : "border-slate-300 text-transparent dark:border-slate-600"
                        }`}
                      >
                        ✓
                      </span>

                      <span
                        className={`text-[11px] leading-5 ${
                          term.checked
                            ? "text-slate-600 dark:text-slate-300"
                            : "text-slate-400 line-through"
                        }`}
                      >
                        {term.label}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[11px] text-slate-400">
                  No clauses recorded on this quotation.
                </p>
              )}
            </div>

            {remarkLines.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-[11px] font-medium text-slate-500">
                  Commercial Remarks &amp; Special Project Scope
                </p>

                <div className="space-y-1 rounded-xl bg-slate-50 p-3 dark:bg-[#0b2034]">
                  {remarkLines.map((line, index) => (
                    <p
                      key={index}
                      className="text-[11px] leading-5 text-slate-600 dark:text-slate-300"
                    >
                      {line}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* RIGHT */}

        <div className="space-y-4">
          <Card icon={<FiFileText size={15} />} title="Order Summary">
            <div className="rounded-xl bg-emerald-50 px-4 py-3 dark:bg-emerald-950/20">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Total Payable
                </span>

                <span className="text-[17px] font-bold text-slate-900 dark:text-white">
                  {money(quotation.total_payable)}
                </span>
              </div>
            </div>

            <p className="mb-2 mt-4 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
              Payment Terms:
            </p>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-500">
                  {Number(quotation.advance_percent ?? 30)}% Advance
                </span>

                <span className="text-[11px] font-semibold text-amber-500">
                  {money(quotation.advance_amount)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-500">
                  {100 - Number(quotation.advance_percent ?? 30)}% Against
                  Delivery
                </span>

                <span className="text-[11px] font-semibold text-[#3b82f6]">
                  {money(quotation.on_delivery_amount)}
                </span>
              </div>
            </div>
          </Card>

          {/* ORDER PROCESS

              The same lifecycle strip the sales order shows, read from the
              quotation's point of view: where this quote has got to on its
              way to a fulfilled order. */}
          <Card icon={<FiClock size={15} />} title="Order Process">
            <div className="space-y-4">
              <ProcessStep
                state={processState(0)}
                title="Quotation Approved"
                caption={
                  quotation.status === QUOTATION_STATUS.ACCEPTED
                    ? `${quotation.quote_number} accepted by the client`
                    : quotation.status === QUOTATION_STATUS.REJECTED
                      ? "Rejected by the client"
                      : quotation.status === QUOTATION_STATUS.EXPIRED
                        ? "Lapsed past its validity date"
                        : linkedOrder
                          /* An order raised against it settles the question
                             even if the quotation was never formally marked
                             accepted - so the caption must not still read
                             "awaiting" under a ticked step. */
                          ? `Order raised against ${quotation.quote_number}`
                          : `${quotation.quote_number} awaiting approval`
                }
              />

              <ProcessStep
                state={processState(1)}
                title="Customer PO Received"
                caption={
                  linkedOrder?.po_number
                    ? `${linkedOrder.po_number} recorded`
                    : "No customer PO recorded"
                }
              />

              <ProcessStep
                state={processState(2)}
                title="Sales Order"
                caption={
                  linkedOrder
                    ? `${linkedOrder.order_number} · ${salesOrderStatusLabel(
                        linkedOrder.status,
                      )}`
                    : "Not raised yet"
                }
              />

              <ProcessStep
                state={processState(3)}
                title="Proforma Invoice"
                caption={
                  (linkedOrder?.advance_received || 0) > 0
                    ? `${money(linkedOrder?.advance_received)} received against it`
                    : "Not Generated"
                }
              />

              <ProcessStep
                state={processState(4)}
                title="Fulfillment"
                caption={
                  linkedOrder?.status === SALES_ORDER_STATUS.COMPLETED
                    ? "Completed"
                    : linkedOrder?.status === SALES_ORDER_STATUS.RELEASED
                      ? "Released for dispatch"
                      : "Not Released"
                }
                last
              />
            </div>
          </Card>

          {/* ATTACHED DOCUMENTS */}
          <Card
            icon={<FiFileText size={15} />}
            title="Attached Documents & Annexures"
          >
            {quotation.attachments?.length ? (
              <div className="flex flex-wrap gap-2">
                {quotation.attachments.map((file, index) => (
                  <span
                    key={`${file.name}-${index}`}
                    className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-semibold text-slate-600 dark:border-[#17304a] dark:bg-[#0b2034] dark:text-slate-300"
                  >
                    {/* Spreadsheets get the green mark the design uses, so a
                        BOQ annexure is distinguishable at a glance. */}
                    <FiFileText
                      size={11}
                      className={`shrink-0 ${
                        /\.(xlsx?|csv)$/i.test(file.name)
                          ? "text-emerald-600"
                          : "text-rose-500"
                      }`}
                    />

                    <span className="truncate">{file.name}</span>

                    {editable && (
                      <button
                        type="button"
                        aria-label={`Remove ${file.name}`}
                        onClick={() => removeAttachment(index)}
                        disabled={saving}
                        className="shrink-0 rounded p-0.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-500 disabled:opacity-40 dark:hover:bg-rose-950/20"
                      >
                        <FiX size={11} />
                      </button>
                    )}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-slate-400">
                No annexures attached to this quotation.
              </p>
            )}
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
                status={quotation.status}
                saving={saving}
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
  status: QuotationStatus;
  saving: boolean;
  onCancel: () => void;
  onSubmit: (payload: {
    status?: QuotationStatus;
    remarks?: string;
  }) => Promise<boolean>;
}) {
  const nextStatuses = QUOTATION_TRANSITIONS[status] || [];

  const [next, setNext] = useState<string>(nextStatuses[0] || "");
  const [remarks, setRemarks] = useState("");

  useEffect(() => {
    setNext((QUOTATION_TRANSITIONS[status] || [])[0] || "");
    setRemarks("");
  }, [status]);

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();

        const ok = await onSubmit({
          status: (next as QuotationStatus) || undefined,
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
            quotation on. */}
        <option value="">Keep as {QUOTATION_STATUS_LABEL[status]}</option>

        {nextStatuses.map((option) => (
          <option key={option} value={option}>
            {QUOTATION_STATUS_LABEL[option]}
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
        placeholder="What happened? e.g. Client asked for a revised BOM."
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

function AddressFieldsBlock({
  title,
  address,
  onChange,
  disabled,
  header,
}: {
  title: string;
  address: QuotationAddress;
  onChange: (next: QuotationAddress) => void;
  /** Shipping is greyed out while it mirrors billing. */
  disabled?: boolean;
  header?: React.ReactNode;
}) {
  const set = (field: keyof QuotationAddress, value: string) =>
    onChange({ ...address, [field]: value });

  const input =
    "h-9 w-full rounded-lg border border-slate-200 px-3 text-[11px] text-slate-700 outline-none transition focus:border-[#233353] disabled:bg-slate-50 disabled:text-slate-400 dark:border-[#17304a] dark:bg-[#051422] dark:text-white dark:disabled:bg-[#0b2034]";

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
            value={address.zip_code || ""}
            disabled={disabled}
            onChange={(event) => set("zip_code", event.target.value)}
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
  /** "current" is the step the quotation is sitting on right now. */
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

function SummaryLine({
  label,
  value,
  tone,
  edit,
}: {
  label: string;
  value: string;
  tone?: "rose";
  /** Omit for a read-only line. */
  edit?: {
    amount: number;
    /** "%" for a rate, where a rupee figure makes no sense. */
    unit?: "%";
    onSave: (next: number) => void | Promise<void>;
  };
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(edit?.amount ?? 0));

  const commit = async () => {
    setEditing(false);

    const next = Number(draft.replace(/[^\d.]/g, "")) || 0;

    if (next !== edit?.amount) await edit?.onSave(next);
  };

  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
        {label}

        {edit && !editing && (
          <button
            type="button"
            aria-label={`Edit ${label}`}
            onClick={() => {
              setDraft(String(edit.amount));
              setEditing(true);
            }}
            className="text-slate-400 transition hover:text-slate-700"
          >
            <FiEdit2 size={10} />
          </button>
        )}
      </span>

      {/* Fixed width: the input replaces the figure without moving it. */}
      <div className="flex w-32 justify-end">
        {edit && editing ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              type="text"
              inputMode="decimal"
              aria-label={label}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={commit}
              onKeyDown={(event) => {
                if (event.key === "Enter") commit();
                if (event.key === "Escape") setEditing(false);
              }}
              className="h-7 w-24 rounded-md border border-slate-200 px-2 text-right text-[11px] text-slate-800 outline-none focus:border-[#233353] dark:border-[#17304a] dark:bg-[#051422] dark:text-white"
            />

            {edit.unit === "%" && (
              <span className="text-[11px] text-slate-500">%</span>
            )}
          </div>
        ) : (
          <span
            className={`text-[11px] font-semibold ${
              tone === "rose" ? "text-rose-500" : "text-slate-800 dark:text-white"
            }`}
          >
            {value}
          </span>
        )}
      </div>
    </div>
  );
}
