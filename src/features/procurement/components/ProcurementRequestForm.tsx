"use client";

/* New Procurement: the purchase team raising a requisition straight onto
 * the desk - for itself or on someone's behalf - with what it already
 * knows: the quantity, the GST, and which vendors to ask for each item
 * (several per item). Saving records the requisition, assigned to whoever
 * raised it, and the quotation requests for those vendors in one go.
 *
 * The employee's own form (New Requisition) asks only for what is needed;
 * this one is the procurement team's, so it carries the buying details. */

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { FiBox, FiFileText, FiPlus, FiTrash2 } from "react-icons/fi";

import { FormCard, FormSectionBlock } from "@/components/crm/FormCard";
import SearchableSelect from "@/components/ui/SearchableSelect";
import FormPageHeader, { CancelButton, SubmitButton } from "@/components/crm/FormPageHeader";
import type { StoredAttachment } from "@/features/attachments/attachments.api";
import { toDateInput } from "@/lib/datetime";
import { useUIStore } from "@/lib/store/ui.store";

import {
  getRequisitionMetaApi,
  raiseDirectRequisitionApi,
  requesterOptionsApi,
  vendorOptionsApi,
  type RequisitionMeta,
} from "../api/procurement.api";
import SalesOrderFields, { costCentersFor } from "./SalesOrderFields";
import { AttachmentsField, ErrorState, Loading, money } from "./shared";

const LABEL = "mb-1.5 block";
const FIELD = "w-full rounded-lg border bg-white px-3 outline-none focus:border-[#233353] dark:bg-[#071929]";
const AREA = "w-full rounded-lg border px-3 py-2 outline-none focus:border-[#233353]";
const LINE_LABEL = "mb-1 block text-[11px] text-[#777777] dark:text-slate-400";
const CELL =
  "field-compact w-full rounded-md border border-[#d1d1d1] bg-white px-2 py-1.5 text-[12px] outline-none focus:border-[#233353] dark:border-[#17304a] dark:bg-[#071929] dark:text-white";
/** Item, qty, unit, est. price, GST %, remove - one row from tablet width up. */
const LINE_GRID = "md:grid-cols-[minmax(0,1fr)_88px_80px_112px_80px_32px]";

type Line = {
  product_name: string;
  sku: string;
  brand: string;
  model: string;
  specification: string;
  uom: string;
  quantity: string;
  est_unit_price: string;
  tax_percent: string;
  vendor_ids: number[];
  details: boolean;
};

const blankLine = (): Line => ({
  product_name: "",
  sku: "",
  brand: "",
  model: "",
  specification: "",
  uom: "Nos",
  quantity: "",
  est_unit_price: "",
  tax_percent: "18",
  vendor_ids: [],
  details: false,
});

type Person = {
  id: string;
  name: string;
  employee_id?: string | null;
  department_id?: number | null;
  department_name?: string | null;
};

export default function ProcurementRequestForm() {
  const router = useRouter();
  const { addToast } = useUIStore();

  const [meta, setMeta] = useState<RequisitionMeta | null>(null);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [vendors, setVendors] = useState<{ id: number; name: string; vendor_code: string }[]>([]);

  const [forId, setForId] = useState("");
  const [header, setHeader] = useState({
    purchase_type: "STOCK",
    priority: "NORMAL",
    required_by: "",
    department_id: "",
    cost_center_id: "",
    project_code: "",
    sales_order_id: "",
    delivery_location: "",
    purpose: "",
    remarks: "",
  });
  const [lines, setLines] = useState<Line[]>([blankLine()]);
  const [files, setFiles] = useState<StoredAttachment[]>([]);
  const [saving, setSaving] = useState(false);

  const loadMeta = () => {
    setMetaError(null);
    getRequisitionMetaApi()
      .then((answer) => {
        setMeta(answer);
        setHeader((c) => ({ ...c, department_id: c.department_id || (answer.me.department_id ? String(answer.me.department_id) : "") }));
      })
      .catch(() => setMetaError("Could not load the form. Check your connection and try again."));
  };

  useEffect(() => {
    loadMeta();
    requesterOptionsApi()
      .then(setPeople)
      .catch(() => setPeople([]));
    vendorOptionsApi()
      .then(setVendors)
      .catch(() => setVendors([]));
  }, []);

  const set = (key: keyof typeof header, value: string) => setHeader((c) => ({ ...c, [key]: value }));
  const setLine = (index: number, patch: Partial<Line>) =>
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  const toggleVendor = (index: number, vendorId: number) =>
    setLines((current) =>
      current.map((line, i) =>
        i !== index
          ? line
          : {
              ...line,
              vendor_ids: line.vendor_ids.includes(vendorId)
                ? line.vendor_ids.filter((v) => v !== vendorId)
                : [...line.vendor_ids, vendorId],
            },
      ),
    );

  /* Choosing who it is for brings their department along. */
  const chooseFor = (id: string) => {
    setForId(id);
    const person = people.find((p) => p.id === id);
    const department = person ? person.department_id : meta?.me.department_id;
    setHeader((c) => ({ ...c, department_id: department ? String(department) : "", cost_center_id: "" }));
  };

  const askedVendors = useMemo(() => new Set(lines.flatMap((l) => l.vendor_ids)).size, [lines]);
  /* As the server works it out: quantity x price, plus GST. */
  const estimate = lines.reduce(
    (sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.est_unit_price) || 0) * (1 + (Number(l.tax_percent) || 0) / 100),
    0,
  );
  const today = toDateInput(new Date());
  const costCenters = costCentersFor(meta?.cost_centers, header.department_id);

  const save = async () => {
    if (!lines.some((l) => l.product_name.trim())) return addToast("Add at least one item.", "error");
    if (lines.some((l) => l.product_name.trim() && !(Number(l.quantity) > 0)))
      return addToast("Every item needs a quantity.", "error");
    if (header.required_by && header.required_by < today) return addToast("Required by date cannot be before today.", "error");

    const num = (v: string) => (v === "" ? null : Number(v));
    setSaving(true);
    try {
      const answer = await raiseDirectRequisitionApi({
        ...header,
        requested_for: forId || null,
        department_id: num(header.department_id),
        cost_center_id: num(header.cost_center_id),
        sales_order_id: header.purchase_type === "SALES_ORDER" ? num(header.sales_order_id) : null,
        attachments: files,
        items: lines
          .filter((l) => l.product_name.trim())
          .map(({ details: _details, ...l }) => ({
            ...l,
            quantity: num(l.quantity),
            est_unit_price: num(l.est_unit_price),
            tax_percent: num(l.tax_percent),
          })),
      });
      addToast(answer.message || "Raised on the procurement desk.", "success");
      router.push(`/procurement/desk/${answer.data.id}`);
    } catch {
      /* the API client shows the server's reason; the form keeps its input */
    } finally {
      setSaving(false);
    }
  };

  if (metaError) return <ErrorState text={metaError} onRetry={loadMeta} />;
  if (!meta) return <Loading text="Loading the form..." />;

  const forName = people.find((p) => p.id === forId)?.name;

  return (
    <div className="space-y-5 pb-8">
      <FormPageHeader
        title="New Procurement"
        parentLabel="Procurement Desk"
        currentLabel="New"
        badge=""
        actions={
          <>
            <CancelButton onClick={() => router.push("/procurement/desk")} />
            <SubmitButton onClick={save} disabled={saving}>
              {saving ? "Raising..." : askedVendors ? "Raise and Request Quotes" : "Raise on Desk"}
            </SubmitButton>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <FormCard>
          <FormSectionBlock first icon={<FiFileText />} title="Request">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <span className={LABEL}>For</span>
                <SearchableSelect
                  value={forId}
                  onChange={chooseFor}
                  placeholder={`Myself (${meta.me.name})`}
                  emptyLabel="Nobody by that name."
                  options={[
                    { id: "", name: `Myself (${meta.me.name})` },
                    ...people
                      .filter((p) => p.id !== meta.me.id)
                      .map((p) => ({
                        id: p.id,
                        name: p.name,
                        hint: [p.employee_id, p.department_name].filter(Boolean).join(", ") || undefined,
                        keywords: `${p.employee_id || ""} ${p.department_name || ""}`,
                      })),
                  ]}
                />
              </div>
              <div>
                <label className={LABEL} htmlFor="np-type">Purchase Type *</label>
                <select id="np-type" className={FIELD} value={header.purchase_type} onChange={(e) => set("purchase_type", e.target.value)}>
                  {meta.purchase_types.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={LABEL} htmlFor="np-priority">Priority *</label>
                <select id="np-priority" className={FIELD} value={header.priority} onChange={(e) => set("priority", e.target.value)}>
                  {meta.priorities.map((p) => (
                    <option key={p} value={p}>{p.charAt(0) + p.slice(1).toLowerCase()}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={LABEL} htmlFor="np-required">Required By *</label>
                <input id="np-required" type="date" min={today} className={FIELD} value={header.required_by} onChange={(e) => set("required_by", e.target.value)} />
              </div>
              <div>
                <label className={LABEL} htmlFor="np-dept">Department{meta.departments.length ? " *" : ""}</label>
                <select
                  id="np-dept"
                  className={FIELD}
                  value={header.department_id}
                  onChange={(e) => setHeader((c) => ({ ...c, department_id: e.target.value, cost_center_id: "" }))}
                >
                  <option value="">{meta.departments.length ? "Select department" : "No departments set up"}</option>
                  {meta.departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={LABEL} htmlFor="np-cc">Cost Center{meta.cost_centers.length ? " *" : ""}</label>
                <select id="np-cc" className={FIELD} value={header.cost_center_id} onChange={(e) => set("cost_center_id", e.target.value)}>
                  <option value="">{meta.cost_centers.length ? "Select cost center" : "No cost centers set up"}</option>
                  {costCenters.map((c) => (
                    <option key={c.id} value={c.id}>{c.code}: {c.name}</option>
                  ))}
                </select>
              </div>
              {header.purchase_type === "SALES_ORDER" && (
                <SalesOrderFields
                  idPrefix="np"
                  value={header.sales_order_id}
                  onChange={(orderId) => set("sales_order_id", orderId)}
                  fieldClass={FIELD}
                  labelClass={LABEL}
                />
              )}
              <div>
                <label className={LABEL} htmlFor="np-project">Project Code</label>
                <input id="np-project" className={FIELD} value={header.project_code} onChange={(e) => set("project_code", e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label className={LABEL} htmlFor="np-delivery">Delivery Location *</label>
                <input id="np-delivery" className={FIELD} value={header.delivery_location} onChange={(e) => set("delivery_location", e.target.value)} />
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <label className={LABEL} htmlFor="np-purpose">Purpose *</label>
                <textarea id="np-purpose" rows={2} className={AREA} value={header.purpose} onChange={(e) => set("purpose", e.target.value)} />
              </div>
            </div>
          </FormSectionBlock>

          <FormSectionBlock
            icon={<FiBox />}
            title="Items and Vendors"
            action={
              <button
                type="button"
                onClick={() => setLines((c) => [...c, blankLine()])}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12px] font-medium text-slate-700 hover:bg-slate-50 dark:border-[#17304a] dark:text-slate-200"
              >
                <FiPlus size={12} /> Add Item
              </button>
            }
          >
            <div className={`hidden gap-2 px-[9px] pb-1.5 text-[11px] text-[#777777] md:grid dark:text-slate-400 ${LINE_GRID}`}>
              <span>Item *</span>
              <span>Qty *</span>
              <span>Unit</span>
              <span>Est. Price (₹)</span>
              <span>GST %</span>
              <span className="sr-only">Remove</span>
            </div>
            <ol className="space-y-2">
              {lines.map((line, index) => {
                const n = index + 1;
                return (
                  <li key={index} className="rounded-lg border border-[#ececec] p-2 dark:border-[#17304a]">
                    <div className={`grid grid-cols-2 items-end gap-2 ${LINE_GRID}`}>
                      <label className="col-span-2 block md:col-span-1">
                        <span className={`${LINE_LABEL} md:sr-only`}>Item {n} *</span>
                        <input className={CELL} placeholder="What is being bought" value={line.product_name} onChange={(e) => setLine(index, { product_name: e.target.value })} />
                      </label>
                      <label className="block">
                        <span className={`${LINE_LABEL} md:sr-only`}>Qty *</span>
                        <input type="number" min="0" step="any" className={CELL} value={line.quantity} onChange={(e) => setLine(index, { quantity: e.target.value })} />
                      </label>
                      <label className="block">
                        <span className={`${LINE_LABEL} md:sr-only`}>Unit</span>
                        <input className={CELL} value={line.uom} onChange={(e) => setLine(index, { uom: e.target.value })} />
                      </label>
                      <label className="block">
                        <span className={`${LINE_LABEL} md:sr-only`}>Est. Price (₹)</span>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          inputMode="decimal"
                          placeholder="Per unit"
                          className={CELL}
                          value={line.est_unit_price}
                          onChange={(e) => setLine(index, { est_unit_price: e.target.value })}
                        />
                      </label>
                      <label className="block">
                        <span className={`${LINE_LABEL} md:sr-only`}>GST %</span>
                        <select className={CELL} value={line.tax_percent} onChange={(e) => setLine(index, { tax_percent: e.target.value })}>
                          {["0", "5", "12", "18", "28"].map((g) => (
                            <option key={g} value={g}>{g}%</option>
                          ))}
                        </select>
                      </label>
                      <button
                        type="button"
                        aria-label={`Remove item ${n}`}
                        disabled={lines.length === 1}
                        onClick={() => setLines((c) => c.filter((_, i) => i !== index))}
                        className="col-span-2 justify-self-end rounded-md p-1.5 text-rose-500 hover:bg-rose-50 disabled:opacity-30 md:col-span-1 dark:hover:bg-rose-950/20"
                      >
                        <FiTrash2 size={13} />
                      </button>
                    </div>

                    <fieldset className="mt-2 border-t border-dashed border-[#ececec] pt-2 dark:border-[#17304a]">
                      <legend className="sr-only">Vendors to ask for item {n}</legend>
                      <p className={LINE_LABEL}>
                        Ask for quotations from{line.vendor_ids.length ? ` (${line.vendor_ids.length})` : ""}
                      </p>
                      {vendors.length === 0 ? (
                        <p className="text-[11px] text-[#999999]">No approved vendors yet. Add them under Vendors; you can ask later from the desk.</p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {vendors.map((v) => {
                            const on = line.vendor_ids.includes(v.id);
                            return (
                              <label
                                key={v.id}
                                className={`flex cursor-pointer items-center rounded-full border px-2.5 py-1 text-[12px] transition focus-within:ring-2 focus-within:ring-[#233353]/40 ${
                                  on
                                    ? "border-[#233353] bg-[#233353] text-white"
                                    : "border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-[#17304a] dark:text-slate-200"
                                }`}
                              >
                                <input type="checkbox" className="sr-only" checked={on} onChange={() => toggleVendor(index, v.id)} />
                                {v.name}
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </fieldset>

                    {line.details ? (
                      <div className="mt-2 grid grid-cols-2 gap-2 border-t border-dashed border-[#ececec] pt-2 sm:grid-cols-4 dark:border-[#17304a]">
                        <label className="block">
                          <span className={LINE_LABEL}>SKU</span>
                          <input className={CELL} value={line.sku} onChange={(e) => setLine(index, { sku: e.target.value })} />
                        </label>
                        <label className="block">
                          <span className={LINE_LABEL}>Brand</span>
                          <input className={CELL} value={line.brand} onChange={(e) => setLine(index, { brand: e.target.value })} />
                        </label>
                        <label className="block">
                          <span className={LINE_LABEL}>Model</span>
                          <input className={CELL} value={line.model} onChange={(e) => setLine(index, { model: e.target.value })} />
                        </label>
                        <label className="col-span-2 block sm:col-span-1">
                          <span className={LINE_LABEL}>Specification</span>
                          <input className={CELL} value={line.specification} onChange={(e) => setLine(index, { specification: e.target.value })} />
                        </label>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setLine(index, { details: true })}
                        className="mt-1.5 text-[11px] font-medium text-[#233353] hover:underline dark:text-sky-300"
                      >
                        + Add details (SKU, brand, model, specification)
                      </button>
                    )}
                  </li>
                );
              })}
            </ol>
          </FormSectionBlock>
        </FormCard>

        <div className="space-y-5 xl:sticky xl:top-[var(--form-header-offset,0px)] xl:self-start">
          <FormCard>
            <p className="text-[12px] text-[#777777] dark:text-slate-400">Summary</p>
            <dl className="mt-2 space-y-2 text-[13px]">
              {[
                ["For", forName || `Myself (${meta.me.name})`],
                ["Approval", "Not needed"],
                ["Items", String(lines.length)],
                ["Vendors to ask", askedVendors ? String(askedVendors) : "Later, from the desk"],
              ].map(([label, value]) => (
                <div key={label} className="flex items-baseline justify-between gap-3">
                  <dt className="text-[#777777] dark:text-slate-400">{label}</dt>
                  <dd className="truncate text-right font-medium text-[#141414] dark:text-white">{value}</dd>
                </div>
              ))}
            </dl>
            {estimate > 0 && (
              <p className="mt-3 flex items-baseline justify-between gap-3 border-t border-[#f3f3f3] pt-3 text-[13px] dark:border-[#17304a]">
                <span className="text-[#777777] dark:text-slate-400">Est. total incl. GST</span>
                <span className="font-semibold tabular-nums text-[#141414] dark:text-white">{money(estimate)}</span>
              </p>
            )}
          </FormCard>
          <FormCard>
            <AttachmentsField value={files} onChange={setFiles} label="Supporting Documents" hint="Optional: specifications, drawings, an existing quote." />
          </FormCard>
        </div>
      </div>
    </div>
  );
}
