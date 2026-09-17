"use client";

/**
 * Proforma Invoice detail.
 *
 * A draft opens as a working page - overview, addresses, lines, the order it
 * belongs to and its history - with Edit PI, Download PDF, Preview and
 * Generate PI. Once generated it is a document, so the page becomes the
 * invoice itself, with Download PDF and Send PI To Customer.
 */

import { ReactNode, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  LuCalendar,
  LuChevronLeft,
  LuCircleCheck,
  LuClipboardList,
  LuDownload,
  LuEye,
  LuFileSpreadsheet,
  LuFileText,
  LuGitFork,
  LuHistory,
  LuHourglass,
  LuInfo,
  LuMapPin,
  LuPackage,
  LuPencil,
  LuPlay,
  LuSend,
  LuX,
} from "react-icons/lu";
import { CgSpinner } from "react-icons/cg";

import { useUIStore } from "@/lib/store/ui.store";
import { StatusPill } from "@/components/crm/Pill";
import {
  PROFORMA_INVOICE_TRANSITIONS,
  editableProformaFields,
  generateProformaInvoiceApi,
  getCompanyProfileApi,
  getProformaInvoiceActivitiesApi,
  getProformaInvoiceApi,
  logProformaInvoiceActivityApi,
  piReference,
  proformaInvoiceStatusLabel,
  updateProformaInvoiceApi,
  type CompanyProfile,
  type ProformaAddress,
  type ProformaInvoiceActivity,
  type ProformaInvoiceModel,
} from "@/features/proformaInvoices/api/proformaInvoices.api";
import { salesOrderStatusLabel } from "@/features/salesOrders/api/salesOrders.api";
import {
  AddressFields,
  BankingDetails,
  InfoRow,
  OrderSummaryCard,
  ProductsTable,
  SectionTitle,
  TermsBlock,
  TotalsBlock,
  UserChip,
  formatDate,
  itemToLine,
} from "@/features/proformaInvoices/components/ProformaParts";
import ProformaInvoiceDocument, {
  PrintableProformaInvoice,
  usePrintProformaInvoice,
} from "@/features/proformaInvoices/components/ProformaInvoiceDocument";
import SendProformaInvoiceModal from "@/features/proformaInvoices/components/SendProformaInvoiceModal";

export default function ProformaInvoiceDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[400px] items-center justify-center">
          <CgSpinner className="animate-spin text-3xl text-[#233353]" />
        </div>
      }
    >
      <ProformaInvoiceDetail />
    </Suspense>
  );
}

function ProformaInvoiceDetail() {
  const params = useParams<{ invoiceId: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const { addToast } = useUIStore();
  const printInvoice = usePrintProformaInvoice();

  const invoiceId = params?.invoiceId;

  const [invoice, setInvoice] = useState<ProformaInvoiceModel | null>(null);
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [activities, setActivities] = useState<ProformaInvoiceActivity[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [showActivityForm, setShowActivityForm] = useState(false);

  const [showPreview, setShowPreview] = useState(false);
  const [showSend, setShowSend] = useState(false);

  const [billing, setBilling] = useState<ProformaAddress>({});
  const [shipping, setShipping] = useState<ProformaAddress>({});
  const [sameAsBilling, setSameAsBilling] = useState(false);

  const syncAddresses = (saved: ProformaInvoiceModel) => {
    setBilling(saved.billing_address || {});
    setShipping(saved.shipping_address || {});
    setSameAsBilling(false);
  };

  const loadActivities = useCallback(async () => {
    if (!invoiceId) return;

    try {
      setActivitiesLoading(true);
      setActivities(await getProformaInvoiceActivitiesApi(invoiceId));
    } catch (error) {
      console.error(error);
      setActivities([]);
    } finally {
      setActivitiesLoading(false);
    }
  }, [invoiceId]);

  const load = useCallback(async () => {
    if (!invoiceId) return;

    try {
      setLoading(true);

      const saved = await getProformaInvoiceApi(invoiceId);

      setInvoice(saved);
      syncAddresses(saved);
    } catch (error: any) {
      console.error(error);
      addToast(error?.response?.data?.detail || "Unable to load this proforma invoice.", "error");
    } finally {
      setLoading(false);
    }
  }, [invoiceId, addToast]);

  useEffect(() => {
    load();
    loadActivities();
    getCompanyProfileApi()
      .then(setProfile)
      .catch(() => setProfile(null));
  }, [load, loadActivities]);

  /* "Send PI To Customer" in the list's row menu lands here with ?send=1. */
  const sendParam = search.get("send");

  useEffect(() => {
    if (!sendParam || !invoice) return;

    if (invoice.status === "GENERATED" || invoice.status === "SENT") setShowSend(true);

    router.replace(`/sales/proforma-invoices/${invoice.id}`);
  }, [sendParam, invoice, router]);

  const addressDirty = useMemo(() => {
    if (!invoice) return false;

    const effectiveShipping = sameAsBilling ? billing : shipping;

    return (
      JSON.stringify(billing) !== JSON.stringify(invoice.billing_address || {}) ||
      JSON.stringify(effectiveShipping) !== JSON.stringify(invoice.shipping_address || {})
    );
  }, [invoice, billing, shipping, sameAsBilling]);

  /* ---------------------------------------------------------------
     ACTIONS
  --------------------------------------------------------------- */

  const run = async (
    action: () => Promise<ProformaInvoiceModel>,
    success: string,
  ) => {
    setBusy(true);

    try {
      const updated = await action();

      setInvoice(updated);
      syncAddresses(updated);
      addToast(success, "success");
      loadActivities();

      return true;
    } catch (error: any) {
      console.error(error);
      addToast(error?.response?.data?.detail || "The change could not be saved.", "error");

      return false;
    } finally {
      setBusy(false);
    }
  };

  const generate = () =>
    invoice &&
    run(() => generateProformaInvoiceApi(invoice.id), `${piReference(invoice)} generated.`);

  const saveAddresses = () =>
    invoice &&
    run(
      () =>
        updateProformaInvoiceApi(invoice.id, {
          billing_address: billing,
          shipping_address: sameAsBilling ? billing : shipping,
        }),
      "Address updated.",
    );

  const editCharge = (field: "freight" | "lumpsum" | "gstPercent" | "paid", value: number) => {
    if (!invoice) return;

    const payload = {
      freight: { freight_charges: value },
      lumpsum: { installation_lumpsum: value },
      gstPercent: { gst_percent: value },
      paid: { amount_paid: value },
    }[field];

    run(
      () => updateProformaInvoiceApi(invoice.id, payload),
      field === "paid" ? "Payment recorded." : "Invoice totals updated.",
    );
  };

  const download = () => {
    if (!invoice) return;

    printInvoice(invoice.pi_number || `PI-${invoice.id}`);
  };

  /* ---------------------------------------------------------------
     RENDER
  --------------------------------------------------------------- */

  if (loading) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-3 text-slate-400">
        <CgSpinner className="animate-spin text-3xl text-[#233353]" />
        <p className="text-xs font-semibold">Loading proforma invoice...</p>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-3">
        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
          Proforma invoice not found
        </p>
        <button
          type="button"
          onClick={() => router.push("/sales/proforma-invoices")}
          className="rounded-lg bg-[#233353] px-4 py-2 text-xs font-bold text-white"
        >
          Back to all Proforma Invoice
        </button>
      </div>
    );
  }

  const isDraft = invoice.status === "DRAFT";
  const canSend = invoice.status === "GENERATED" || invoice.status === "SENT";
  const editable = editableProformaFields(invoice.status);
  const contact = (invoice.customer_information?.primary_contact || {}) as Record<string, string>;
  const order = invoice.sales_order;

  const headerButton =
    "flex h-9 items-center gap-2 rounded-lg bg-white px-4 text-xs font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:bg-[#071929] dark:text-slate-200";

  return (
    <div className="min-h-full space-y-4 pb-8">
      {/* HEADER */}
      <div>
        <button
          type="button"
          onClick={() => router.push("/sales/proforma-invoices")}
          className="mb-2 flex items-center gap-1 text-[11px] font-medium text-slate-700 hover:text-[#233353] dark:text-slate-300 dark:hover:text-white"
        >
          <LuChevronLeft size={13} />
          Back to all Proforma Invoice
        </button>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-[26px] font-medium tracking-tight text-slate-900 dark:text-white">
              {piReference(invoice)}
              {invoice.company_name ? ` - ${invoice.company_name}` : ""}
            </h1>
            <StatusPill status={invoice.status} label={proformaInvoiceStatusLabel(invoice.status)} />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isDraft && (
              <button
                type="button"
                onClick={() => router.push(`/sales/proforma-invoices/new?edit=${invoice.id}`)}
                className={headerButton}
              >
                <LuPencil size={14} />
                Edit PI
              </button>
            )}

            <button type="button" onClick={download} className={headerButton}>
              <LuDownload size={14} />
              Download PDF
            </button>

            {isDraft && (
              <button type="button" onClick={() => setShowPreview(true)} className={headerButton}>
                <LuEye size={14} />
                Preview
              </button>
            )}

            {isDraft && (
              <button
                type="button"
                disabled={busy}
                onClick={generate}
                className="flex h-9 items-center gap-2 rounded-lg bg-[#233353] px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-[#18243a] disabled:opacity-50"
              >
                {busy ? <CgSpinner className="animate-spin" size={14} /> : <LuFileText size={14} />}
                Generate PI
              </button>
            )}

            {canSend && (
              <button
                type="button"
                onClick={() => setShowSend(true)}
                className="flex h-9 items-center gap-2 rounded-lg bg-[#233353] px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-[#18243a]"
              >
                <LuSend size={14} />
                Send PI To Customer
              </button>
            )}
          </div>
        </div>
      </div>

      {isDraft ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_300px] 2xl:grid-cols-[minmax(0,1fr)_340px]">
          {/* LEFT */}
          <div className="space-y-8 rounded-2xl bg-white px-5 py-5 dark:bg-[#071929]">
            <section>
              <SectionTitle icon={<LuInfo size={17} />} title="PI & Organization Overview" />

              <div className="grid grid-cols-1 gap-x-10 gap-y-3 md:grid-cols-2">
                <InfoRow label="PI ID" value={piReference(invoice)} />
                <div className="flex items-center">
                  <span className="w-[110px] shrink-0 text-[11px] text-slate-500">Assigned To:</span>
                  <UserChip name={invoice.assigned_to} />
                </div>
                <InfoRow
                  label="Sales Order ID"
                  value={order?.order_number ? `#${order.order_number}` : undefined}
                />
                <div className="hidden md:block" />
                <InfoRow label="PI Date (Issue)" value={formatDate(invoice.issue_date)} />
                <InfoRow label="PI Date (Due)" value={formatDate(invoice.due_date)} />
              </div>

              <p className="mb-3 mt-6 border-b border-slate-200 pb-2 text-xs font-semibold text-slate-600 dark:border-[#17304a] dark:text-slate-300">
                Organization Details
              </p>

              <div className="grid grid-cols-1 gap-x-10 gap-y-3 md:grid-cols-2">
                <InfoRow label="Customer Type" value={invoice.customer_type} />
                <InfoRow label="Organization Name" value={invoice.company_name} />
                <InfoRow label="GST" value={invoice.customer_information?.gst} />
                <InfoRow label="PAN" value={invoice.customer_information?.pan} />
                <InfoRow label="COI Number" value={invoice.customer_information?.cin} />
                <InfoRow label="Registration" value={invoice.customer_information?.registration} />
                <InfoRow label="Contact Name" value={contact.name || invoice.customer_name} />
                <InfoRow label="Designation" value={contact.designation} />
                <InfoRow label="Phone" value={contact.phone} />
                <InfoRow label="Email" value={contact.email} />
              </div>
            </section>

            <section>
              <SectionTitle
                icon={<LuMapPin size={17} />}
                title="Location Information"
                action={
                  addressDirty && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => syncAddresses(invoice)}
                        className="px-2 py-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800"
                      >
                        Discard
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={saveAddresses}
                        className="rounded-md bg-[#233353] px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50"
                      >
                        Save Address
                      </button>
                    </div>
                  )
                }
              />

              <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                <AddressFields title="Billing Address" address={billing} onChange={setBilling} />
                <AddressFields
                  title="Shipping Address"
                  address={sameAsBilling ? billing : shipping}
                  onChange={setShipping}
                  disabled={sameAsBilling}
                  header={
                    <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={sameAsBilling}
                        onChange={(event) => {
                          setSameAsBilling(event.target.checked);
                          if (event.target.checked) setShipping(billing);
                        }}
                        className="h-3.5 w-3.5 rounded border-slate-300 accent-[#233353]"
                      />
                      Same as Billing
                    </label>
                  }
                />
              </div>
            </section>

            <section>
              <SectionTitle icon={<LuPackage size={17} />} title="Products & Order Items" />
              <ProductsTable lines={invoice.items.map(itemToLine)} />
              <TotalsBlock
                figures={{
                  subtotal: invoice.total_amount,
                  discount: invoice.discount_amount,
                  orc: invoice.orc_amount,
                  freight: invoice.freight_charges,
                  lumpsum: invoice.installation_lumpsum,
                  taxable: invoice.taxable_amount,
                  gstPercent: invoice.gst_percent,
                  gst: invoice.gst_amount,
                  total: invoice.grand_total,
                  paid: invoice.amount_paid,
                  balance: invoice.balance_due,
                }}
              />
            </section>

            <BankingDetails
              profile={profile}
              reference={invoice.pi_number || `PI-${invoice.id}`}
              onCopied={(message) => addToast(message, "success")}
            />

            <TermsBlock terms={invoice.commercial_terms} notes={invoice.technical_notes} />
          </div>

          {/* RIGHT */}
          <div className="space-y-4">
            <OrderSummaryCard
              icon={<LuClipboardList size={17} />}
              total={invoice.grand_total}
              advancePercent={invoice.advance_percent}
            />

            <SideCard icon={<LuGitFork size={17} />} title="Order Process">
              <OrderProcess invoice={invoice} />
            </SideCard>

            <SideCard
              icon={<LuFileText size={17} />}
              title="Attached Documents"
              action={
                <button
                  type="button"
                  onClick={() => router.push(`/sales/proforma-invoices/new?edit=${invoice.id}`)}
                  className="whitespace-nowrap text-[10px] font-medium text-slate-600 hover:text-[#233353] dark:text-slate-300"
                >
                  + Upload Documents
                </button>
              }
            >
              <div className="space-y-2.5">
                <LinkedDocument
                  title={order?.quotation_id ? `Quotation ${order.quotation_id}` : "Quotation"}
                  subtitle={order?.quotation_id ? "Approved" : "Not linked"}
                  onView={order?.quotation_id ? () => router.push("/sales/quotations") : undefined}
                />
                <LinkedDocument
                  title={order?.po_number ? `Customer PO: ${order.po_number}` : "Customer PO"}
                  subtitle={order?.po_number ? "Received" : "Not received"}
                />
                <LinkedDocument
                  title={`Sales Order #${order?.order_number || invoice.sales_order_id || "-"}`}
                  subtitle={order ? salesOrderStatusLabel(order.status) : "Not linked"}
                  onView={order ? () => router.push(`/sales/orders/${order.id}`) : undefined}
                />
                <LinkedDocument
                  title="Proforma Invoice"
                  subtitle="Not Generated"
                  onView={() => setShowPreview(true)}
                />

                {invoice.attachments.map((file) => (
                  <div
                    key={file.name}
                    className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2.5 dark:bg-[#0b2034]"
                  >
                    {/\.(xlsx?|csv)$/i.test(file.name) ? (
                      <LuFileSpreadsheet size={13} className="shrink-0 text-emerald-600" />
                    ) : (
                      <LuFileText size={13} className="shrink-0 text-rose-500" />
                    )}
                    <span className="truncate text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                      {file.name}
                    </span>
                  </div>
                ))}
              </div>
            </SideCard>

            <SideCard
              icon={<LuHistory size={17} />}
              title="Activity History"
              action={
                <button
                  type="button"
                  onClick={() => setShowActivityForm((value) => !value)}
                  className="whitespace-nowrap text-[10px] font-medium text-slate-600 hover:text-[#233353] dark:text-slate-300"
                >
                  {showActivityForm ? "Cancel" : "+ Log Activity"}
                </button>
              }
            >
              {showActivityForm && (
                <LogActivityForm
                  status={invoice.status}
                  saving={busy}
                  onSubmit={async (payload) => {
                    setBusy(true);

                    try {
                      const result = await logProformaInvoiceActivityApi(invoice.id, payload);

                      setInvoice(result.invoice);
                      setShowActivityForm(false);
                      addToast(
                        payload.status
                          ? `Invoice moved to ${proformaInvoiceStatusLabel(result.invoice.status)}.`
                          : "Activity logged.",
                        "success",
                      );
                      loadActivities();
                    } catch (error: any) {
                      addToast(error?.response?.data?.detail || "Failed to log the activity.", "error");
                    } finally {
                      setBusy(false);
                    }
                  }}
                />
              )}

              <ActivityTimeline loading={activitiesLoading} activities={activities} />
            </SideCard>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm dark:bg-[#071929]">
          {invoice.status === "CANCELLED" && (
            <div className="border-b border-rose-100 bg-rose-50 px-6 py-3 text-[12px] font-medium text-rose-600">
              This proforma invoice has been cancelled and is kept for the record only.
            </div>
          )}

          <ProformaInvoiceDocument
            invoice={invoice}
            profile={profile}
            saving={busy}
            editable={{
              freight: editable.charges,
              lumpsum: editable.charges,
              gstPercent: editable.charges,
              paid: editable.amountPaid,
            }}
            onEdit={editCharge}
            onCopied={(message) => addToast(message, "success")}
          />
        </div>
      )}

      {showPreview && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
          <div className="flex max-h-[94vh] w-full max-w-[980px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 px-5">
              <h2 className="text-sm font-semibold text-slate-800">
                Preview · {piReference(invoice)}
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={download}
                  className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <LuDownload size={13} />
                  Download PDF
                </button>
                <button
                  type="button"
                  aria-label="Close preview"
                  onClick={() => setShowPreview(false)}
                  className="text-slate-400 hover:text-slate-700"
                >
                  <LuX size={17} />
                </button>
              </div>
            </div>
            <div className="overflow-y-auto">
              <ProformaInvoiceDocument invoice={invoice} profile={profile} />
            </div>
          </div>
        </div>
      )}

      {showSend && (
        <SendProformaInvoiceModal
          invoice={invoice}
          onClose={() => setShowSend(false)}
          onSent={(updated, message) => {
            setInvoice(updated);
            setShowSend(false);
            addToast(message, "success");
            loadActivities();
          }}
          onError={(message) => addToast(message, "error")}
          onNotice={(message) => addToast(message, "success")}
        />
      )}

      <PrintableProformaInvoice invoice={invoice} profile={profile} />
    </div>
  );
}

/* =========================================================
   ORDER PROCESS
========================================================= */

function OrderProcess({ invoice }: { invoice: ProformaInvoiceModel }) {
  const order = invoice.sales_order;
  const confirmed = !!order && ["CONFIRMED", "RELEASED", "ON_HOLD", "COMPLETED"].includes(order.status);

  const piState: StepState =
    invoice.status === "GENERATED" || invoice.status === "SENT"
      ? "done"
      : invoice.status === "DRAFT"
        ? "current"
        : "todo";

  return (
    <div className="space-y-4">
      <ProcessStep
        state={order?.quotation_id ? "done" : "todo"}
        title="Quotation Approved"
        caption={order?.quotation_id ? `${order.quotation_id} linked` : "No quotation linked"}
      />
      <ProcessStep
        state={order?.po_number ? "done" : "todo"}
        title="Customer PO Received"
        caption={order?.po_number ? `${order.po_number} recorded` : "No customer PO recorded"}
      />
      <ProcessStep
        state={confirmed ? "done" : "todo"}
        title="Sales Order"
        caption={
          order
            ? `${order.order_number || order.id} · ${salesOrderStatusLabel(order.status)}`
            : "Not linked"
        }
      />
      <ProcessStep
        state={piState}
        title="Proforma Invoice"
        caption={
          invoice.status === "DRAFT"
            ? "Not Generated"
            : invoice.status === "CANCELLED"
              ? "Cancelled"
              : proformaInvoiceStatusLabel(invoice.status)
        }
      />
      <ProcessStep
        state={order?.status === "COMPLETED" ? "done" : order?.status === "RELEASED" ? "current" : "todo"}
        title="Fulfillment"
        caption={
          order?.status === "COMPLETED"
            ? "Completed"
            : order?.status === "RELEASED"
              ? "Released for dispatch"
              : "Not Released"
        }
        last
      />
    </div>
  );
}

type StepState = "done" | "current" | "todo";

function ProcessStep({
  state,
  title,
  caption,
  last,
}: {
  state: StepState;
  title: string;
  caption: string;
  last?: boolean;
}) {
  return (
    <div className="relative flex gap-3">
      {!last && (
        <span className="absolute left-[11px] top-6 h-[calc(100%-4px)] w-px bg-slate-200 dark:bg-[#17304a]" />
      )}

      <span
        className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
          state === "done"
            ? "bg-emerald-500 text-white"
            : state === "current"
              ? "bg-amber-400 text-white"
              : "bg-slate-200 text-slate-400 dark:bg-[#17304a]"
        }`}
      >
        {state === "done" ? (
          <LuCircleCheck size={14} />
        ) : state === "current" ? (
          <LuHourglass size={12} />
        ) : (
          <span className="h-2.5 w-2.5 rounded-full bg-slate-100 dark:bg-slate-500" />
        )}
      </span>

      <div>
        <p className="text-[12px] font-semibold text-slate-800 dark:text-white">{title}</p>
        <p className="mt-0.5 text-[11px] text-slate-500">{caption}</p>
      </div>
    </div>
  );
}

/* =========================================================
   ACTIVITY
========================================================= */

function ActivityTimeline({
  loading,
  activities,
}: {
  loading: boolean;
  activities: ProformaInvoiceActivity[];
}) {
  if (loading) {
    return <p className="py-3 text-[10px] text-slate-400">Loading activity...</p>;
  }

  if (activities.length === 0) {
    return <p className="py-3 text-[10px] text-slate-400">No activity recorded yet.</p>;
  }

  const sourceLabel = { order: "Sales Order", opportunity: "Opportunity" } as Record<string, string>;

  return (
    <div className="relative ml-1 border-l border-slate-200 pl-4 dark:border-[#17304a]">
      {activities.map((activity) => (
        <div key={activity.id} className="relative mb-3 last:mb-0">
          <span className="absolute -left-[21px] top-4 h-2 w-2 rounded-full bg-[#233353] dark:bg-slate-300" />

          <div className="rounded-xl bg-slate-100 px-3 py-2.5 dark:bg-[#0b2034]">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[11px] font-semibold text-slate-800 dark:text-white">
                {activity.action}
              </p>
              <span className="shrink-0 text-[9px] text-slate-500">
                {formatDate(activity.created_at)}
              </span>
            </div>

            {activity.description && (
              <p className="mt-1 text-[10px] leading-[15px] text-slate-600 dark:text-slate-400">
                {activity.description}
              </p>
            )}

            {(activity.created_by_name || sourceLabel[activity.source]) && (
              <p className="mt-1.5 flex items-center gap-1 text-[9px] text-slate-400">
                <LuCalendar size={9} />
                {activity.created_by_name || "System"}
                {sourceLabel[activity.source] && (
                  <span className="ml-1 rounded bg-white px-1.5 py-0.5 text-[8px] font-semibold text-slate-500 dark:bg-[#071929]">
                    {sourceLabel[activity.source]}
                  </span>
                )}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function LogActivityForm({
  status,
  saving,
  onSubmit,
}: {
  status: string;
  saving: boolean;
  onSubmit: (payload: { status?: string; remarks?: string }) => Promise<void>;
}) {
  /* Sending is not offered here: an invoice only counts as sent once the
     email has actually gone, which is what Send PI To Customer does. */
  const options = (PROFORMA_INVOICE_TRANSITIONS[status as keyof typeof PROFORMA_INVOICE_TRANSITIONS] || []).filter(
    (next) => next !== "SENT",
  );

  const [next, setNext] = useState("");
  const [remarks, setRemarks] = useState("");

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        await onSubmit({ status: next || undefined, remarks: remarks.trim() || undefined });
      }}
      className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-[#17304a] dark:bg-[#0b2034]"
    >
      <label className="mb-1.5 block text-[10px] font-semibold text-slate-600 dark:text-slate-400">
        Move Status To
      </label>
      <select
        value={next}
        onChange={(event) => setNext(event.target.value)}
        className="mb-3 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-[11px] text-slate-700 outline-none dark:border-[#17304a] dark:bg-[#071929] dark:text-white"
      >
        <option value="">Keep as {proformaInvoiceStatusLabel(status)}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {proformaInvoiceStatusLabel(option)}
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
        placeholder="What happened? e.g. Customer asked for revised due date."
        className="w-full resize-none rounded-lg border border-slate-200 bg-white p-2.5 text-[11px] text-slate-800 outline-none dark:border-[#17304a] dark:bg-[#071929] dark:text-white"
      />

      <div className="mt-3 flex justify-end">
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

function SideCard({
  icon,
  title,
  action,
  children,
}: {
  icon: ReactNode;
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-white px-5 py-4 dark:bg-[#071929]">
      <SectionTitle icon={icon} title={title} action={action} />
      {children}
    </div>
  );
}

function LinkedDocument({
  title,
  subtitle,
  onView,
}: {
  title: string;
  subtitle: string;
  onView?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-100 px-3 py-2.5 dark:bg-[#0b2034]">
      <div className="min-w-0">
        <p className="truncate text-[12px] font-semibold text-slate-800 dark:text-white">{title}</p>
        <p className="text-[10px] text-slate-500">{subtitle}</p>
      </div>

      <button
        type="button"
        disabled={!onView}
        onClick={onView}
        className="flex shrink-0 items-center gap-1.5 rounded-md bg-white px-3 py-1 text-[10px] font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-transparent disabled:text-slate-400 disabled:shadow-none dark:bg-[#071929] dark:text-slate-300"
      >
        View
        <LuPlay size={9} className="fill-current" />
      </button>
    </div>
  );
}
