"use client";

/* Entering a vendor's quotation by hand, as received offline (email,
 * WhatsApp, paper). Used for a new quotation and for a revision of one;
 * a revision is saved as a new version and the earlier one is kept.
 * The line arithmetic shown here is a preview - the server prices every
 * line again and its figures are the ones stored. */

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { FiBox, FiFileText } from "react-icons/fi";

import { FormCard, FormSectionBlock } from "@/components/crm/FormCard";
import FormPageHeader, { CancelButton, DraftButton, SubmitButton } from "@/components/crm/FormPageHeader";
import type { StoredAttachment } from "@/features/attachments/attachments.api";
import { toDateInput } from "@/lib/datetime";
import { useUIStore } from "@/lib/store/ui.store";

import {
  createQuotationApi,
  getProcurementMetaApi,
  getVendorsApi,
  reviseQuotationApi,
  type Quotation,
  type QuotationItem,
  type Vendor,
  type Workspace,
} from "../api/procurement.api";
import { AttachmentsField, humanize, money } from "./shared";

const LABEL = "mb-1.5 block";
const FIELD = "w-full rounded-lg border bg-white px-3 outline-none focus:border-[#233353] dark:bg-[#071929]";
const AREA = "w-full rounded-lg border px-3 py-2 outline-none focus:border-[#233353]";
const LINE_LABEL = "mb-1 block text-[11px] text-[#777777] dark:text-slate-400";
const CELL =
  "field-compact w-full rounded-md border border-[#d1d1d1] bg-white px-2 py-1.5 text-[12px] outline-none focus:border-[#233353] dark:border-[#17304a] dark:bg-[#071929] dark:text-white";

type Line = QuotationItem & { include: boolean };

const n = (value: unknown) => (value === "" || value === null || value === undefined ? 0 : Number(value) || 0);

export function priceLine(line: QuotationItem) {
  const gross = n(line.quantity) * n(line.unit_rate);
  const discount = line.discount_type === "AMOUNT" ? n(line.discount_value) : (gross * n(line.discount_value)) / 100;
  const taxable = gross - discount;
  const gst = (taxable * n(line.gst_rate)) / 100;
  const total = taxable + gst + n(line.freight) + n(line.packing) + n(line.other_charges);
  return { gross, discount, taxable, gst, total };
}

const str = (value: unknown) => (value === null || value === undefined ? "" : String(value));

export default function QuotationForm({ pr, base }: { pr: Workspace; base?: Quotation | null }) {
  const router = useRouter();
  const { addToast } = useUIStore();

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [compliance, setCompliance] = useState<string[]>(["COMPLIANT", "PARTIAL", "NON_COMPLIANT"]);
  const [vendorId, setVendorId] = useState(base ? String(base.vendor_id) : "");
  const [header, setHeader] = useState({
    vendor_reference: base?.vendor_reference || "",
    quotation_date: toDateInput(base?.quotation_date) || "",
    valid_until: toDateInput(base?.valid_until) || "",
    received_date: toDateInput(new Date()),
    payment_terms: base?.payment_terms || "",
    delivery_terms: base?.delivery_terms || "",
    freight_terms: base?.freight_terms || "",
    delivery_days: str(base?.delivery_days),
    warranty_terms: base?.warranty_terms || "",
    remarks: "",
  });
  const [final, setFinal] = useState(false);
  const [files, setFiles] = useState<StoredAttachment[]>([]);
  const [saving, setSaving] = useState<"draft" | "save" | null>(null);

  /* One row per requisition line; a revision starts from the figures of
     the version it revises. */
  const [lines, setLines] = useState<Line[]>(() =>
    (pr.items || []).map((item) => {
      const previous = base?.items?.find((q) => q.requisition_item_id === item.id);
      return {
        include: base ? Boolean(previous) : true,
        requisition_item_id: item.id,
        product_name: item.product_name,
        sku: item.sku,
        vendor_product_name: previous?.vendor_product_name || "",
        vendor_model: previous?.vendor_model || "",
        brand: previous?.brand || item.brand || "",
        hsn: previous?.hsn || "",
        quantity: str(previous?.quantity ?? item.effective_quantity ?? item.quantity),
        uom: previous?.uom || item.uom,
        unit_rate: str(previous?.unit_rate),
        discount_type: previous?.discount_type || "PERCENT",
        discount_value: str(previous?.discount_value ?? 0),
        gst_rate: str(previous?.gst_rate ?? item.tax_percent ?? 18),
        freight: str(previous?.freight ?? 0),
        packing: str(previous?.packing ?? 0),
        other_charges: str(previous?.other_charges ?? 0),
        delivery_days: str(previous?.delivery_days),
        warranty: previous?.warranty || "",
        compliance: previous?.compliance || "COMPLIANT",
        deviation: previous?.deviation || "",
      };
    }),
  );

  useEffect(() => {
    if (!base) {
      getVendorsApi({ usable: true, size: 100 })
        .then((answer) => setVendors(answer.data))
        .catch(() => setVendors([]));
    }
    getProcurementMetaApi()
      .then((meta) => meta.compliance?.length && setCompliance(meta.compliance))
      .catch(() => {});
  }, [base]);

  /* A vendor quotes for the lines they were asked about; a line nobody
     was asked about yet stays ticked. Either can be changed by hand. */
  const chooseVendor = (value: string) => {
    setVendorId(value);
    const asked = new Map((pr.items || []).map((item) => [item.id, item.rfq_vendor_ids || []]));
    setLines((current) =>
      current.map((line) => {
        const vendors = asked.get(line.requisition_item_id ?? -1) || [];
        return { ...line, include: !value || vendors.length === 0 || vendors.includes(Number(value)) };
      }),
    );
  };

  const setLine = (index: number, patch: Partial<Line>) =>
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));

  const totals = useMemo(
    () =>
      lines
        .filter((line) => line.include)
        .reduce(
          (sum, line) => {
            const p = priceLine(line);
            return {
              taxable: sum.taxable + p.taxable,
              gst: sum.gst + p.gst,
              charges: sum.charges + n(line.freight) + n(line.packing) + n(line.other_charges),
              total: sum.total + p.total,
            };
          },
          { taxable: 0, gst: 0, charges: 0, total: 0 },
        ),
    [lines],
  );

  const save = async (draft: boolean) => {
    const included = lines.filter((line) => line.include);
    if (!base && !vendorId) return addToast("Choose the vendor this quotation is from.", "error");
    if (!included.length) return addToast("Include at least one line.", "error");
    if (!draft && !files.length) return addToast("Attach the vendor's quotation document.", "error");

    const payload = {
      ...header,
      delivery_days: header.delivery_days === "" ? null : Number(header.delivery_days),
      attachments: files,
      items: included.map(({ include: _include, ...line }) => ({
        ...line,
        quantity: line.quantity === "" ? null : Number(line.quantity),
        unit_rate: line.unit_rate === "" ? null : Number(line.unit_rate),
        discount_value: n(line.discount_value),
        gst_rate: n(line.gst_rate),
        freight: n(line.freight),
        packing: n(line.packing),
        other_charges: n(line.other_charges),
        delivery_days: line.delivery_days === "" || line.delivery_days == null ? null : Number(line.delivery_days),
      })),
    };

    setSaving(draft ? "draft" : "save");
    try {
      const answer = base
        ? await reviseQuotationApi(base.id, { ...payload, final })
        : await createQuotationApi({
            ...payload,
            requisition_id: pr.id,
            vendor_id: Number(vendorId),
            status: draft ? "DRAFT" : "RECEIVED",
          });
      addToast(answer.message || "Quotation saved.", "success");
      router.push(`/procurement/desk/quotations/${answer.data.id}`);
    } catch {
      /* the API client shows the server's reason; the form keeps its input */
    } finally {
      setSaving(null);
    }
  };

  const set = (key: keyof typeof header, value: string) => setHeader((c) => ({ ...c, [key]: value }));

  return (
    <div className="space-y-5 pb-8">
      <FormPageHeader
        title={base ? `Revise ${base.quotation_number}` : "Enter Vendor Quotation"}
        parentLabel={pr.pr_number}
        currentLabel={base ? `${base.vendor_name} — revision` : "New Quotation"}
        badge={base ? base.version_label : "Offline"}
        actions={
          <>
            <CancelButton onClick={() => router.push(`/procurement/desk/${pr.id}`)} />
            {!base && (
              <DraftButton onClick={() => save(true)} disabled={saving !== null}>
                {saving === "draft" ? "Saving..." : "Save as Draft"}
              </DraftButton>
            )}
            <SubmitButton onClick={() => save(false)} disabled={saving !== null}>
              {saving === "save" ? "Saving..." : base ? "Save Revision" : "Save Quotation"}
            </SubmitButton>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <FormCard>
          <FormSectionBlock first icon={<FiFileText />} title="Quotation Details">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className={LABEL} htmlFor="q-vendor">Vendor *</label>
                {base ? (
                  <input id="q-vendor" className={FIELD} value={base.vendor_name} readOnly />
                ) : (
                  <select id="q-vendor" className={FIELD} value={vendorId} onChange={(e) => chooseVendor(e.target.value)}>
                    <option value="">{vendors.length ? "Select vendor" : "No approved vendors"}</option>
                    {vendors.map((v) => <option key={v.id} value={v.id}>{v.name} ({v.vendor_code})</option>)}
                  </select>
                )}
              </div>
              <div>
                <label className={LABEL} htmlFor="q-ref">Vendor Quotation No.</label>
                <input id="q-ref" className={FIELD} value={header.vendor_reference} onChange={(e) => set("vendor_reference", e.target.value)} />
              </div>
              <div>
                <label className={LABEL} htmlFor="q-date">Quotation Date</label>
                <input id="q-date" type="date" className={FIELD} value={header.quotation_date} onChange={(e) => set("quotation_date", e.target.value)} />
              </div>
              <div>
                <label className={LABEL} htmlFor="q-valid">Valid Until</label>
                <input id="q-valid" type="date" className={FIELD} value={header.valid_until} onChange={(e) => set("valid_until", e.target.value)} />
              </div>
              <div>
                <label className={LABEL} htmlFor="q-received">Received On</label>
                <input id="q-received" type="date" className={FIELD} value={header.received_date} onChange={(e) => set("received_date", e.target.value)} />
              </div>
              <div>
                <label className={LABEL} htmlFor="q-days">Delivery (days)</label>
                <input id="q-days" type="number" min="0" className={FIELD} value={header.delivery_days} onChange={(e) => set("delivery_days", e.target.value)} />
              </div>
              <div>
                <label className={LABEL} htmlFor="q-payment">Payment Terms</label>
                <input id="q-payment" className={FIELD} value={header.payment_terms} onChange={(e) => set("payment_terms", e.target.value)} />
              </div>
              <div>
                <label className={LABEL} htmlFor="q-delivery">Delivery Terms</label>
                <input id="q-delivery" className={FIELD} value={header.delivery_terms} onChange={(e) => set("delivery_terms", e.target.value)} />
              </div>
              <div>
                <label className={LABEL} htmlFor="q-freight">Freight Terms</label>
                <input id="q-freight" className={FIELD} value={header.freight_terms} onChange={(e) => set("freight_terms", e.target.value)} />
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <label className={LABEL} htmlFor="q-warranty">Warranty Terms</label>
                <input id="q-warranty" className={FIELD} value={header.warranty_terms} onChange={(e) => set("warranty_terms", e.target.value)} />
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <label className={LABEL} htmlFor="q-remarks">{base ? "What changed in this revision" : "Remarks"}</label>
                <textarea id="q-remarks" rows={2} className={AREA} value={header.remarks} onChange={(e) => set("remarks", e.target.value)} />
              </div>
              {base && (
                <label className="flex items-center gap-2 text-[13px] text-slate-700 dark:text-slate-200 sm:col-span-2 lg:col-span-3">
                  <input type="checkbox" checked={final} onChange={(e) => setFinal(e.target.checked)} className="h-4 w-4 accent-[#233353]" />
                  This is the final negotiated quotation
                </label>
              )}
            </div>
          </FormSectionBlock>

          <FormSectionBlock icon={<FiBox />} title="Line Items">
            {/* One block per requisition line; untick a line the vendor did
                not quote. Fields reflow with the width instead of a table
                that only fitted by scrolling sideways. */}
            <ol className="space-y-3">
              {lines.map((line, i) => {
                const off = !line.include;
                const p = priceLine(line);
                const label = line.product_name || `Line ${i + 1}`;
                return (
                  <li key={line.requisition_item_id} className={`rounded-lg border p-3 ${off ? "border-dashed border-slate-300 dark:border-[#17304a]" : "border-[#ececec] dark:border-[#17304a]"}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="flex min-w-0 items-center gap-2 text-[13px]">
                        <input
                          type="checkbox"
                          checked={line.include}
                          onChange={(e) => setLine(i, { include: e.target.checked })}
                          className="h-4 w-4 accent-[#233353]"
                        />
                        <span className="font-medium text-[#141414] dark:text-slate-200">{label}</span>
                        <span className="text-[11px] text-[#777777]">{line.sku ? `${line.sku}, ` : ""}{off ? "not quoted" : "quoted"}</span>
                      </label>
                      <span className="text-[13px] font-semibold tabular-nums text-[#141414] dark:text-white">{off ? "—" : money(p.total)}</span>
                    </div>

                    {!off && (
                      <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-6">
                        <label className="col-span-2 block">
                          <span className={LINE_LABEL}>Vendor product</span>
                          <input className={CELL} value={line.vendor_product_name || ""} onChange={(e) => setLine(i, { vendor_product_name: e.target.value })} />
                        </label>
                        <label className="block">
                          <span className={LINE_LABEL}>Model</span>
                          <input className={CELL} value={line.vendor_model || ""} onChange={(e) => setLine(i, { vendor_model: e.target.value })} />
                        </label>
                        <label className="block">
                          <span className={LINE_LABEL}>HSN</span>
                          <input className={CELL} value={line.hsn || ""} onChange={(e) => setLine(i, { hsn: e.target.value })} />
                        </label>
                        <label className="block">
                          <span className={LINE_LABEL}>Qty ({line.uom})</span>
                          <input type="number" min="0" step="any" className={CELL} value={line.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} />
                        </label>
                        <label className="block">
                          <span className={LINE_LABEL}>Rate (₹) *</span>
                          <input type="number" min="0" step="any" className={CELL} value={line.unit_rate} onChange={(e) => setLine(i, { unit_rate: e.target.value })} />
                        </label>
                        <div className="block">
                          <span className={LINE_LABEL}>Discount</span>
                          <div className="flex gap-1">
                            <select aria-label={`${label} discount type`} className={`${CELL} w-14 shrink-0`} value={line.discount_type} onChange={(e) => setLine(i, { discount_type: e.target.value as "PERCENT" | "AMOUNT" })}>
                              <option value="PERCENT">%</option>
                              <option value="AMOUNT">₹</option>
                            </select>
                            <input aria-label={`${label} discount`} type="number" min="0" step="any" className={CELL} value={line.discount_value} onChange={(e) => setLine(i, { discount_value: e.target.value })} />
                          </div>
                        </div>
                        <label className="block">
                          <span className={LINE_LABEL}>GST %</span>
                          <input type="number" min="0" step="any" className={CELL} value={line.gst_rate} onChange={(e) => setLine(i, { gst_rate: e.target.value })} />
                        </label>
                        <label className="block">
                          <span className={LINE_LABEL}>Freight (₹)</span>
                          <input type="number" min="0" step="any" className={CELL} value={line.freight} onChange={(e) => setLine(i, { freight: e.target.value })} />
                        </label>
                        <label className="block">
                          <span className={LINE_LABEL}>Packing (₹)</span>
                          <input type="number" min="0" step="any" className={CELL} value={line.packing} onChange={(e) => setLine(i, { packing: e.target.value })} />
                        </label>
                        <label className="block">
                          <span className={LINE_LABEL}>Other (₹)</span>
                          <input type="number" min="0" step="any" className={CELL} value={line.other_charges} onChange={(e) => setLine(i, { other_charges: e.target.value })} />
                        </label>
                        <label className="block">
                          <span className={LINE_LABEL}>Delivery days</span>
                          <input type="number" min="0" className={CELL} value={line.delivery_days ?? ""} onChange={(e) => setLine(i, { delivery_days: e.target.value })} />
                        </label>
                        <label className="block">
                          <span className={LINE_LABEL}>Compliance</span>
                          <select className={CELL} value={line.compliance} onChange={(e) => setLine(i, { compliance: e.target.value })}>
                            {compliance.map((c) => <option key={c} value={c}>{humanize(c)}</option>)}
                          </select>
                        </label>
                        {line.compliance !== "COMPLIANT" && (
                          <label className="col-span-2 block sm:col-span-3">
                            <span className={LINE_LABEL}>Deviation</span>
                            <input className={CELL} value={line.deviation || ""} onChange={(e) => setLine(i, { deviation: e.target.value })} />
                          </label>
                        )}
                        <p className="col-span-2 self-end text-[11px] text-[#777777] sm:col-span-4 lg:col-span-6">
                          Taxable {money(p.taxable)} + GST {money(p.gst)} + charges {money(n(line.freight) + n(line.packing) + n(line.other_charges))}
                        </p>
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
            <p className="mt-2 text-[11px] text-[#999999]">
              Taxable = Qty × Rate − Discount. Total = Taxable + GST + Freight + Packing + Other.
            </p>
          </FormSectionBlock>
        </FormCard>

        <div className="space-y-5 xl:sticky xl:top-[var(--form-header-offset,0px)] xl:self-start">
          <FormCard>
            <dl className="space-y-2 text-[13px]">
              <div className="flex justify-between"><dt className="text-[#777777]">Taxable</dt><dd>{money(totals.taxable)}</dd></div>
              <div className="flex justify-between"><dt className="text-[#777777]">GST</dt><dd>{money(totals.gst)}</dd></div>
              <div className="flex justify-between"><dt className="text-[#777777]">Charges</dt><dd>{money(totals.charges)}</dd></div>
              <div className="flex justify-between border-t border-[#f3f3f3] pt-2 text-[16px] font-semibold dark:border-[#17304a]">
                <dt>Grand Total</dt><dd>{money(totals.total)}</dd>
              </div>
            </dl>
          </FormCard>
          <FormCard>
            <AttachmentsField value={files} onChange={setFiles} label="Vendor Quotation Document *" hint="The PDF, image or email the vendor sent. Required." />
          </FormCard>
        </div>
      </div>
    </div>
  );
}
