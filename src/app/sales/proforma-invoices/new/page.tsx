"use client";

/**
 * Generate Proforma Invoice.
 *
 * Reached two ways: from the Create Proforma Invoice dialog with ?order=<id>,
 * where everything is prefilled from that sales order, and from Edit PI on a
 * draft with ?edit=<id>. Save as Draft keeps it editable; Send For Approval
 * generates it, after which the lines and dates are fixed.
 */

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  LuBookmark,
  LuCalendar,
  LuClipboardList,
  LuFolderOpen,
  LuInfo,
  LuMapPin,
  LuPackage,
  LuPlus,
  LuSend,
  LuX,
} from "react-icons/lu";
import { CgSpinner } from "react-icons/cg";

import { useUIStore } from "@/lib/store/ui.store";
import FormPageHeader from "@/components/crm/FormPageHeader";
import { FORM_FIELDS } from "@/components/crm/FormCard";
import {
  getSalesOrderApi,
  type SalesOrderModel,
} from "@/features/salesOrders/api/salesOrders.api";
import {
  createProformaInvoiceApi,
  generateProformaInvoiceApi,
  getCompanyProfileApi,
  getProformaInvoiceApi,
  updateProformaInvoiceApi,
  type CompanyProfile,
  type ProformaAddress,
  type ProformaInvoicePayload,
} from "@/features/proformaInvoices/api/proformaInvoices.api";
import {
  AddressFields,
  BankingDetails,
  InfoRow,
  OrderSummaryCard,
  ProductPickerModal,
  ProductsTable,
  SectionTitle,
  TermsBlock,
  TotalsBlock,
  UserChip,
  computeTotals,
  itemToLine,
  lineToItem,
  toDateInput,
  type EditableLine,
} from "@/features/proformaInvoices/components/ProformaParts";

const DEFAULT_TERMS = [
  "Payment Terms: 30% advance against Proforma Invoice; 70% balance upon delivery challan verification.",
  "Delivery Lead Time: 15 to 20 working days from receipt of initial mobilization advance and confirmed delivery slot.",
  "Warranty & Support: Standard 3-year comprehensive on-site OEM warranty on IFP panels and Core OPS compute modules.",
];

const INVOICEABLE = ["CONFIRMED", "RELEASED", "ON_HOLD", "COMPLETED"];

/** The seed every field starts from - an order for a new invoice, or the
    saved draft when editing. */
interface Source {
  piNumber?: string | null;
  orderId: number;
  orderNumber?: string | null;
  customerName: string;
  companyName?: string | null;
  customerType?: string | null;
  info: Record<string, any>;
  discountMode?: string | null;
  discountInput?: number | null;
  orcMode?: string | null;
  orcInput?: number | null;
  attachments: { name: string; size?: number; type?: string }[];
}

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

/** Midnight local time, without a zone, so the date reads back unchanged. */
const toPayloadDate = (value: string) => (value ? `${value}T00:00:00` : null);

const addressComplete = (address: ProformaAddress) =>
  Boolean(address.street && address.state && address.city && address.country && address.pin);

export default function GenerateProformaInvoicePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[400px] items-center justify-center">
          <CgSpinner className="animate-spin text-3xl text-[#233353]" />
        </div>
      }
    >
      <GenerateProformaInvoice />
    </Suspense>
  );
}

function GenerateProformaInvoice() {
  const router = useRouter();
  const params = useSearchParams();
  const { addToast } = useUIStore();

  const orderParam = params.get("order");
  const editParam = params.get("edit");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<"draft" | "generate" | null>(null);

  const [source, setSource] = useState<Source | null>(null);
  const [profile, setProfile] = useState<CompanyProfile | null>(null);

  const [assignedTo, setAssignedTo] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [dueDate, setDueDate] = useState("");

  const [billing, setBilling] = useState<ProformaAddress>({});
  const [shipping, setShipping] = useState<ProformaAddress>({});
  const [sameAsBilling, setSameAsBilling] = useState(false);

  const [lines, setLines] = useState<EditableLine[]>([]);
  const [showPicker, setShowPicker] = useState(false);

  const [freight, setFreight] = useState(0);
  const [lumpsum, setLumpsum] = useState(0);
  const [gstPercent, setGstPercent] = useState(18);
  const [amountPaid, setAmountPaid] = useState(0);
  const [advancePercent, setAdvancePercent] = useState(30);

  const [terms, setTerms] = useState<string[]>(DEFAULT_TERMS);
  const [notes, setNotes] = useState("");

  const editingId = editParam ? Number(editParam) : null;

  const seedFromOrder = (order: SalesOrderModel) => {
    setSource({
      orderId: order.id,
      orderNumber: order.order_number,
      customerName: order.customer_name,
      companyName: order.company_name,
      customerType: order.customer_type,
      info: (order.customer_information || {}) as Record<string, any>,
      discountMode: order.discount_mode,
      discountInput: order.discount_input,
      orcMode: order.orc_mode,
      orcInput: order.orc_input,
      attachments: order.attachments || [],
    });

    const today = new Date();

    setAssignedTo(order.assigned_to || "");
    setIssueDate(toDateInput(today));
    setDueDate(toDateInput(addDays(today, 30)));
    setBilling((order.billing_address || {}) as ProformaAddress);
    setShipping((order.shipping_address || {}) as ProformaAddress);
    setLines((order.items || []).map(itemToLine));
    setFreight(order.freight_charges || 0);
    setLumpsum(order.installation_lumpsum || 0);
    setGstPercent(order.gst_percent ?? 18);
    setAdvancePercent(order.advance_percent ?? 30);
    setTerms(order.commercial_terms?.length ? order.commercial_terms : DEFAULT_TERMS);
    setNotes(order.technical_notes || "");
  };

  const load = useCallback(async () => {
    try {
      setLoading(true);

      getCompanyProfileApi()
        .then(setProfile)
        .catch(() => setProfile(null));

      if (editingId) {
        const invoice = await getProformaInvoiceApi(editingId);

        /* Past Draft the lines and dates are fixed on the backend, so a
           generated invoice goes to its own page instead of a form that
           could not be saved. */
        if (invoice.status !== "DRAFT") {
          addToast("Only a draft proforma invoice can be edited.", "warning");
          router.replace(`/sales/proforma-invoices/${invoice.id}`);
          return;
        }

        setSource({
          piNumber: invoice.pi_number,
          orderId: invoice.sales_order_id || 0,
          orderNumber: invoice.sales_order?.order_number,
          customerName: invoice.customer_name,
          companyName: invoice.company_name,
          customerType: invoice.customer_type,
          info: invoice.customer_information || {},
          discountMode: invoice.discount_mode,
          discountInput: invoice.discount_input,
          orcMode: invoice.orc_mode,
          orcInput: invoice.orc_input,
          attachments: invoice.attachments || [],
        });

        setAssignedTo(invoice.assigned_to || "");
        setIssueDate(toDateInput(invoice.issue_date));
        setDueDate(toDateInput(invoice.due_date));
        setBilling(invoice.billing_address || {});
        setShipping(invoice.shipping_address || {});
        setLines(invoice.items.map(itemToLine));
        setFreight(invoice.freight_charges);
        setLumpsum(invoice.installation_lumpsum);
        setGstPercent(invoice.gst_percent);
        setAmountPaid(invoice.amount_paid);
        setAdvancePercent(invoice.advance_percent);
        setTerms(invoice.commercial_terms?.length ? invoice.commercial_terms : DEFAULT_TERMS);
        setNotes(invoice.technical_notes || "");

        return;
      }

      if (!orderParam) {
        router.replace("/sales/proforma-invoices");
        return;
      }

      const order = await getSalesOrderApi(orderParam);

      if (!INVOICEABLE.includes(order.status)) {
        addToast(
          `${order.order_number || "This order"} is not confirmed yet, so it cannot be invoiced.`,
          "warning",
        );
        router.replace("/sales/proforma-invoices");
        return;
      }

      seedFromOrder(order);
    } catch (error: any) {
      console.error(error);
      addToast(
        error?.response?.data?.detail || "Unable to open this proforma invoice.",
        "error",
      );
      router.replace("/sales/proforma-invoices");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId, orderParam]);

  useEffect(() => {
    load();
  }, [load]);

  const totals = useMemo(
    () =>
      computeTotals(lines, {
        discountMode: source?.discountMode,
        discountInput: source?.discountInput,
        orcMode: source?.orcMode,
        orcInput: source?.orcInput,
        freight,
        lumpsum,
        gstPercent,
        amountPaid,
      }),
    [lines, source, freight, lumpsum, gstPercent, amountPaid],
  );

  const save = async (asDraft: boolean) => {
    if (!source) return;

    if (!issueDate || !dueDate) {
      addToast("PI Date (Issue) and PI Date (Due) are required.", "warning");
      return;
    }

    if (dueDate < issueDate) {
      addToast("PI Date (Due) cannot be before PI Date (Issue).", "warning");
      return;
    }

    const shippingAddress = sameAsBilling ? billing : shipping;

    /* A draft can be saved half-finished; an invoice that is going out needs
       its lines and both addresses. */
    if (!asDraft) {
      if (lines.length === 0) {
        addToast("Add at least one product before generating the invoice.", "warning");
        return;
      }

      if (!addressComplete(billing) || !addressComplete(shippingAddress)) {
        addToast("Complete every required field in the billing and shipping addresses.", "warning");
        return;
      }
    }

    const payload: ProformaInvoicePayload = {
      issue_date: toPayloadDate(issueDate),
      due_date: toPayloadDate(dueDate),
      assigned_to: assignedTo || undefined,
      billing_address: billing,
      shipping_address: shippingAddress,
      items: lines.map(lineToItem),
      freight_charges: freight,
      installation_lumpsum: lumpsum,
      gst_percent: gstPercent,
      amount_paid: amountPaid,
      advance_percent: advancePercent,
      commercial_terms: terms.map((term) => term.trim()).filter(Boolean),
      technical_notes: notes,
    };

    setSaving(asDraft ? "draft" : "generate");

    try {
      let saved;

      if (editingId) {
        saved = await updateProformaInvoiceApi(editingId, payload);

        if (!asDraft) saved = await generateProformaInvoiceApi(editingId);
      } else {
        saved = await createProformaInvoiceApi({
          ...payload,
          sales_order_id: source.orderId,
          status: asDraft ? "DRAFT" : "GENERATED",
        });
      }

      addToast(
        asDraft
          ? `#${saved.pi_number} saved as draft.`
          : `#${saved.pi_number} generated.`,
        "success",
      );

      router.push(`/sales/proforma-invoices/${saved.id}`);
    } catch (error: any) {
      console.error(error);
      addToast(
        error?.response?.data?.detail || "Unable to save the proforma invoice.",
        "error",
      );
      setSaving(null);
    }
  };

  if (loading || !source) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-3 text-slate-400">
        <CgSpinner className="animate-spin text-3xl text-[#233353]" />
        <p className="text-xs font-semibold">Preparing proforma invoice...</p>
      </div>
    );
  }

  const contact = (source.info.primary_contact || {}) as Record<string, string>;

  const dateInput =
    "h-11 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-[12px] text-slate-800 outline-none focus:border-[#233353] dark:border-[#17304a] dark:bg-[#051422] dark:text-white";

  return (
    <div className="min-h-full pb-8">
      <FormPageHeader
        title={editingId ? "Edit Proforma Invoice" : "Generate Proforma Invoice"}
        parentLabel="Proforma Invoice"
        currentLabel={editingId ? "Edit" : "New"}
        actions={
          <>
            <button
              type="button"
              onClick={() =>
                router.push(
                  editingId ? `/sales/proforma-invoices/${editingId}` : "/sales/proforma-invoices",
                )
              }
              className="flex h-9 items-center gap-1.5 rounded-lg border border-[#f7969e] bg-white px-3.5 text-[13px] font-medium text-[#d00517] transition hover:bg-rose-50 dark:bg-transparent dark:text-rose-400"
            >
              <LuX size={14} />
              Cancel
            </button>

            <button
              type="button"
              disabled={saving !== null}
              onClick={() => save(true)}
              className="flex h-9 items-center gap-1.5 rounded-lg bg-white px-3.5 text-[13px] font-medium text-[#141414] transition hover:bg-slate-50 disabled:opacity-50 dark:bg-[#071929] dark:text-slate-200"
            >
              {saving === "draft" ? <CgSpinner className="animate-spin" size={14} /> : <LuBookmark size={14} />}
              Save as Draft
            </button>

            <button
              type="button"
              disabled={saving !== null}
              onClick={() => save(false)}
              className="flex h-9 items-center gap-1.5 rounded-lg bg-[#243454] px-3.5 text-[13px] font-medium text-white shadow-sm transition hover:bg-[#18243a] disabled:opacity-50"
            >
              {saving === "generate" ? <CgSpinner className="animate-spin" size={14} /> : <LuSend size={14} />}
              Send For Approval
            </button>
          </>
        }
      />

      <div>
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[minmax(0,1fr)_372px]">
          <div className={`space-y-8 rounded-xl bg-white px-5 py-5 dark:bg-[#071929] ${FORM_FIELDS}`}>
            {/* PI INFORMATION */}
            <section>
              <SectionTitle icon={<LuInfo size={17} />} title="PI Information" />

              <div className="grid grid-cols-1 gap-x-10 gap-y-4 md:grid-cols-2">
                <InfoRow
                  label="PI ID"
                  value={source.piNumber ? `#${source.piNumber}` : <span className="font-normal text-slate-400">Assigned on save</span>}
                />

                <div className="flex items-center">
                  <span className="w-[110px] shrink-0 text-[11px] text-slate-500">Assigned To:</span>
                  <UserChip name={assignedTo} />
                </div>
              </div>

              <label className="mb-1.5 mt-4 block text-[11px] text-slate-500">Sales Order ID</label>
              <input
                readOnly
                value={source.orderNumber ? `#${source.orderNumber}` : ""}
                className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-[12px] text-slate-800 outline-none dark:border-[#17304a] dark:bg-[#051422] dark:text-white"
              />

              <div className="mt-4 grid grid-cols-1 gap-5 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-[11px] text-slate-500">
                    PI Date (Issue)<span className="text-rose-500">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-300 text-slate-600 dark:border-[#17304a]">
                      <LuCalendar size={16} />
                    </span>
                    <input
                      type="date"
                      aria-label="PI Date (Issue)"
                      value={issueDate}
                      onChange={(event) => setIssueDate(event.target.value)}
                      className={dateInput}
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-[11px] text-slate-500">
                    PI Date (Due)<span className="text-rose-500">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-300 text-slate-600 dark:border-[#17304a]">
                      <LuCalendar size={16} />
                    </span>
                    <input
                      type="date"
                      aria-label="PI Date (Due)"
                      min={issueDate || undefined}
                      value={dueDate}
                      onChange={(event) => setDueDate(event.target.value)}
                      className={dateInput}
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* ORGANIZATION DETAILS */}
            <section>
              <SectionTitle icon={<LuFolderOpen size={17} />} title="Organization Details" />

              <div className="grid grid-cols-1 gap-x-10 gap-y-3 md:grid-cols-2">
                <InfoRow label="Customer Type" value={source.customerType} />
                <InfoRow label="Organization Name" value={source.companyName} />
                <InfoRow label="GST" value={source.info.gst} />
                <InfoRow label="PAN" value={source.info.pan} />
                <InfoRow label="COI Number" value={source.info.cin} />
                <InfoRow label="Registration" value={source.info.registration} />
              </div>

              <p className="mb-3 mt-5 border-b border-slate-200 pb-2 text-xs font-semibold text-slate-600 dark:border-[#17304a] dark:text-slate-300">
                Primary Contact
              </p>

              <div className="grid grid-cols-1 gap-x-10 gap-y-3 md:grid-cols-2">
                <InfoRow label="Customer" value={contact.name || source.customerName} />
                <InfoRow label="Designation" value={contact.designation} />
                <InfoRow label="Phone" value={contact.phone} />
                <InfoRow label="Email" value={contact.email} />
              </div>
            </section>

            {/* LOCATION */}
            <section>
              <SectionTitle icon={<LuMapPin size={17} />} title="Location Information" />

              <div className="grid grid-cols-1 gap-8 2xl:grid-cols-2">
                <AddressFields compact title="Billing Address" address={billing} onChange={setBilling} />

                <AddressFields
                  compact
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
                          /* Keep the copy once unticked, so the user edits
                             from billing rather than from blank. */
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

            {/* PRODUCTS */}
            <section>
              <SectionTitle
                icon={<LuPackage size={17} />}
                title="Products & Order Items"
                className="border-b-0 pb-0"
                action={
                  <button
                    type="button"
                    onClick={() => setShowPicker(true)}
                    className="flex h-9 items-center gap-2 rounded-lg bg-[#233353] px-4 text-xs font-semibold text-white hover:bg-[#18243a]"
                  >
                    <LuPlus size={15} />
                    Add Product
                  </button>
                }
              />

              <ProductsTable
                lines={lines}
                onRemove={(index) => setLines((current) => current.filter((_, i) => i !== index))}
              />

              <TotalsBlock
                figures={{
                  subtotal: totals.subtotal,
                  discount: totals.discount,
                  orc: totals.orc,
                  freight,
                  lumpsum,
                  taxable: totals.taxable,
                  gstPercent,
                  gst: totals.gst,
                  total: totals.total,
                  paid: totals.paid,
                  balance: totals.balance,
                }}
                editable={{ freight: true, lumpsum: true, gstPercent: true, paid: true }}
                onEdit={(field, value) => {
                  if (field === "freight") setFreight(value);
                  if (field === "lumpsum") setLumpsum(value);
                  if (field === "gstPercent") setGstPercent(value);
                  if (field === "paid") setAmountPaid(value);
                }}
              />
            </section>

            <BankingDetails
              profile={profile}
              reference={source.piNumber}
              onCopied={(message) => addToast(message, "success")}
            />

            <TermsBlock
              terms={terms}
              notes={notes}
              onTermsChange={setTerms}
              onNotesChange={setNotes}
            />
          </div>

          <div className="space-y-4">
            <OrderSummaryCard
              icon={<LuClipboardList size={17} />}
              total={totals.total}
              advancePercent={advancePercent}
            />
          </div>
        </div>
      </div>

      {showPicker && (
        <ProductPickerModal
          initial={lines}
          onClose={() => setShowPicker(false)}
          onConfirm={(next) => {
            setLines(next);
            setShowPicker(false);
          }}
        />
      )}
    </div>
  );
}
