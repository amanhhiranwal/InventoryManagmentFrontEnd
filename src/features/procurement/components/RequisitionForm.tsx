"use client";

/* The purchase requisition form, for a new PR and for editing a draft or
 * a returned one. The requester says what is needed, how many and by
 * when - not the price: procurement prices it from vendors' quotations,
 * and the amount-based approval runs on the purchase order. A PR only
 * needs the requester's reporting manager to confirm the need.
 *
 * The procurement desk's New Procurement is its own form
 * (ProcurementRequestForm): it carries the buying details. */

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { FiBox, FiFileText, FiPlus, FiTrash2, FiUser } from "react-icons/fi";

import { FormCard, FormSectionBlock } from "@/components/crm/FormCard";
import FormPageHeader, { CancelButton, DraftButton, SubmitButton } from "@/components/crm/FormPageHeader";
import type { StoredAttachment } from "@/features/attachments/attachments.api";
import { toDateInput } from "@/lib/datetime";
import { useUIStore } from "@/lib/store/ui.store";

import {
  createRequisitionApi,
  getRequisitionMetaApi,
  updateRequisitionApi,
  type Requisition,
  type RequisitionItem,
  type RequisitionMeta,
} from "../api/procurement.api";
import SalesOrderFields, { costCentersFor } from "./SalesOrderFields";
import { AttachmentsField, ErrorState, Field, initials, Loading } from "./shared";

const blankLine = (): RequisitionItem => ({
  product_name: "",
  sku: "",
  brand: "",
  model: "",
  specification: "",
  uom: "Nos",
  quantity: "",
  required_date: "",
  remarks: "",
});

/** "" stays empty rather than becoming 0. */
const num = (value: unknown) => (value === "" || value === null || value === undefined ? null : Number(value));


type Header = {
  purchase_type: string;
  priority: string;
  required_by: string;
  department_id: string;
  cost_center_id: string;
  sales_order_id: string;
  customer_name: string;
  project_code: string;
  linked_record: string;
  delivery_location: string;
  purpose: string;
  remarks: string;
  special_requirements: string;
};

const fromRequisition = (pr?: Requisition | null): Header => ({
  purchase_type: pr?.purchase_type || "STOCK",
  priority: pr?.priority || "NORMAL",
  required_by: toDateInput(pr?.required_by) || "",
  department_id: pr?.department_id ? String(pr.department_id) : "",
  cost_center_id: pr?.cost_center_id ? String(pr.cost_center_id) : "",
  sales_order_id: pr?.sales_order_id ? String(pr.sales_order_id) : "",
  customer_name: pr?.customer_name || "",
  project_code: pr?.project_code || "",
  linked_record: pr?.linked_record || "",
  delivery_location: pr?.delivery_location || "",
  purpose: pr?.purpose || "",
  remarks: pr?.remarks || "",
  special_requirements: pr?.special_requirements || "",
});

const LABEL = "mb-1.5 block";
const FIELD = "w-full rounded-lg border bg-white px-3 outline-none focus:border-[#233353] dark:bg-[#071929]";
const AREA = "w-full rounded-lg border px-3 py-2 outline-none focus:border-[#233353]";
/** Item, qty, unit, remove - one row from tablet width up. */
const LINE_GRID = "md:grid-cols-[minmax(0,1fr)_96px_96px_32px]";
const LINE_LABEL = "mb-1 block text-[11px] text-[#777777] dark:text-slate-400";
const CELL =
  "field-compact w-full rounded-md border border-[#d1d1d1] bg-white px-2 py-1.5 text-[12px] outline-none focus:border-[#233353] dark:border-[#17304a] dark:bg-[#071929] dark:text-white";

export default function RequisitionForm({ existing }: { existing?: Requisition | null }) {
  const router = useRouter();
  const { addToast } = useUIStore();

  const [meta, setMeta] = useState<RequisitionMeta | null>(null);
  const [metaError, setMetaError] = useState<string | null>(null);

  const [header, setHeader] = useState<Header>(() => fromRequisition(existing));
  /* Which lines have their details open, by position; unset follows
     whether the line already has any. */
  const [details, setDetails] = useState<boolean[]>([]);
  const [lines, setLines] = useState<RequisitionItem[]>(() =>
    existing?.items?.length
      ? existing.items.map((item) => ({
          ...item,
          quantity: String(item.quantity ?? ""),
          required_date: toDateInput(item.required_date) || "",
        }))
      : [blankLine()],
  );
  const [files, setFiles] = useState<StoredAttachment[]>(existing?.attachments || []);
  const [saving, setSaving] = useState<"draft" | "submit" | null>(null);

  const editing = Boolean(existing);

  const loadMeta = useCallback(() => {
    setMetaError(null);
    getRequisitionMetaApi()
      .then((answer) => {
        setMeta(answer);
        if (!editing) {
          setHeader((current) => ({
            ...current,
            department_id: current.department_id || (answer.me.department_id ? String(answer.me.department_id) : ""),
          }));
        }
      })
      .catch(() => setMetaError("Could not load the requisition form. Check your connection and try again."));
  }, [editing]);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);


  const set = <K extends keyof Header>(key: K, value: Header[K]) =>
    setHeader((current) => ({ ...current, [key]: value }));

  const setLine = (index: number, patch: Partial<RequisitionItem>) =>
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));

  const costCenters = costCentersFor(meta?.cost_centers, header.department_id);

  const today = toDateInput(new Date());

  const payload = (submit: boolean) => ({
    ...header,
    department_id: num(header.department_id),
    cost_center_id: num(header.cost_center_id),
    sales_order_id: header.purchase_type === "SALES_ORDER" ? num(header.sales_order_id) : null,
    attachments: files,
    items: lines.map((line) => ({
      ...line,
      quantity: num(line.quantity),
      required_date: line.required_date || null,
    })),
    submit,
  });

  const save = async (submit: boolean) => {
    if (submit) {
      /* The quick checks, so a missing field is caught before the round
         trip. The server repeats every one of them. */
      if (!lines.some((line) => line.product_name.trim())) return addToast("Add at least one item.", "error");
      if (header.required_by && header.required_by < today)
        return addToast("Required by date cannot be before today.", "error");
    }

    setSaving(submit ? "submit" : "draft");
    try {
      const answer = existing
        ? await updateRequisitionApi(existing.id, payload(submit))
        : await createRequisitionApi(payload(submit));
      addToast(answer.message || "Saved.", "success");
      router.push(`/procurement/requisitions/${answer.data.id}`);
    } catch {
      /* The server's reason is shown by the API client; the form keeps
         everything typed so it can be corrected and sent again. */
    } finally {
      setSaving(null);
    }
  };

  if (metaError) return <ErrorState text={metaError} onRetry={loadMeta} />;
  if (!meta) return <Loading text="Loading the requisition form..." />;

  return (
    <div className="space-y-5 pb-8">
      <FormPageHeader
        title={existing ? `Edit ${existing.pr_number}` : "New Purchase Requisition"}
        parentLabel="My Requisitions"
        currentLabel={existing ? existing.pr_number : "New"}
        badge={existing?.status === "RETURNED" ? "Returned" : "Draft"}
        actions={
          <>
            <CancelButton onClick={() => router.push(existing ? `/procurement/requisitions/${existing.id}` : "/procurement/requisitions")} />
            <DraftButton onClick={() => save(false)} disabled={saving !== null}>
              {saving === "draft" ? "Saving..." : "Save as Draft"}
            </DraftButton>
            <SubmitButton withIcon onClick={() => save(true)} disabled={saving !== null}>
              {saving === "submit" ? "Submitting..." : existing?.status === "RETURNED" ? "Resubmit" : "Submit for Approval"}
            </SubmitButton>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <FormCard>
          <FormSectionBlock first icon={<FiUser />} title="Requester">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Requested By">{existing?.requester_name || meta.me.name}</Field>
              <Field label="Employee ID">{existing?.employee_id || meta.me.employee_id}</Field>
              <Field label="Designation">{existing?.designation || meta.me.designation}</Field>
              <Field label="Reporting Manager">
                {existing?.reporting_manager_name || meta.me.reporting_manager_name || "Not set — a super admin will approve"}
              </Field>
            </div>
          </FormSectionBlock>

          <FormSectionBlock icon={<FiFileText />} title="Requisition Details">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className={LABEL} htmlFor="pr-type">Purchase Type *</label>
                <select id="pr-type" className={FIELD} value={header.purchase_type} onChange={(e) => set("purchase_type", e.target.value)}>
                  {meta.purchase_types.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={LABEL} htmlFor="pr-priority">Priority *</label>
                <select id="pr-priority" className={FIELD} value={header.priority} onChange={(e) => set("priority", e.target.value)}>
                  {meta.priorities.map((p) => (
                    <option key={p} value={p}>{p.charAt(0) + p.slice(1).toLowerCase()}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={LABEL} htmlFor="pr-required">Required By *</label>
                <input id="pr-required" type="date" min={today} className={FIELD} value={header.required_by} onChange={(e) => set("required_by", e.target.value)} />
              </div>

              <div>
                <label className={LABEL} htmlFor="pr-dept">Department{meta.departments.length ? " *" : ""}</label>
                <select
                  id="pr-dept"
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
                <label className={LABEL} htmlFor="pr-cc">Cost Center{meta.cost_centers.length ? " *" : ""}</label>
                <select id="pr-cc" className={FIELD} value={header.cost_center_id} onChange={(e) => set("cost_center_id", e.target.value)}>
                  <option value="">{meta.cost_centers.length ? "Select cost center" : "No cost centers set up"}</option>
                  {costCenters.map((c) => (
                    <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={LABEL} htmlFor="pr-project">Project Code</label>
                <input id="pr-project" className={FIELD} value={header.project_code} onChange={(e) => set("project_code", e.target.value)} />
              </div>

              {header.purchase_type === "SALES_ORDER" && (
                <SalesOrderFields
                  idPrefix="pr"
                  value={header.sales_order_id}
                  customer={header.customer_name}
                  current={existing?.sales_order_id ? { id: existing.sales_order_id, number: existing.sales_order_number } : null}
                  onChange={(orderId, customerName) =>
                    setHeader((c) => ({ ...c, sales_order_id: orderId, customer_name: customerName || c.customer_name }))
                  }
                  fieldClass={FIELD}
                  labelClass={LABEL}
                />
              )}

              <div className="sm:col-span-2 lg:col-span-3">
                <label className={LABEL} htmlFor="pr-delivery">Delivery Location *</label>
                <input id="pr-delivery" className={FIELD} value={header.delivery_location} onChange={(e) => set("delivery_location", e.target.value)} />
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <label className={LABEL} htmlFor="pr-purpose">Purpose / Justification *</label>
                <textarea id="pr-purpose" rows={3} className={AREA} value={header.purpose} onChange={(e) => set("purpose", e.target.value)} />
              </div>
            </div>
          </FormSectionBlock>

          <FormSectionBlock
            icon={<FiBox />}
            title="Items"
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
            {/* One block per line, fields in a grid that reflows with the
                width - a table this wide only fitted by scrolling sideways. */}
            {/* One row per line: what is being bought, how many, at what
                price. SKU, brand, model and specification sit behind "Add
                details" under the row, open when a line already has them. */}
            <div className={`hidden gap-2 px-[9px] pb-1.5 text-[11px] text-[#777777] md:grid dark:text-slate-400 ${LINE_GRID}`}>
              <span>Item *</span>
              <span>Qty *</span>
              <span>Unit</span>
              <span className="sr-only">Remove</span>
            </div>
            <ol className="space-y-2">
              {lines.map((line, index) => {
                const n = index + 1;
                const hasDetails = Boolean(line.sku || line.brand || line.model || line.specification);
                const open = details[index] ?? hasDetails;
                return (
                  <li key={index} className="rounded-lg border border-[#ececec] p-2 dark:border-[#17304a]">
                    <div className={`grid grid-cols-2 items-end gap-2 ${LINE_GRID}`}>
                      <label className="col-span-2 block md:col-span-1">
                        <span className={`${LINE_LABEL} md:sr-only`}>Item {n} *</span>
                        <input className={CELL} placeholder="What is needed" value={line.product_name} onChange={(e) => setLine(index, { product_name: e.target.value })} />
                      </label>
                      <label className="block">
                        <span className={`${LINE_LABEL} md:sr-only`}>Qty *</span>
                        <input type="number" min="0" step="any" className={CELL} value={line.quantity} onChange={(e) => setLine(index, { quantity: e.target.value })} />
                      </label>
                      <label className="block">
                        <span className={`${LINE_LABEL} md:sr-only`}>Unit</span>
                        <input className={CELL} value={line.uom} onChange={(e) => setLine(index, { uom: e.target.value })} />
                      </label>
                      <button
                        type="button"
                        aria-label={`Remove item ${n}`}
                        disabled={lines.length === 1}
                        onClick={() => {
                          setLines((c) => c.filter((_, i) => i !== index));
                          setDetails((c) => c.filter((_, i) => i !== index));
                        }}
                        className="justify-self-end rounded-md p-1.5 text-rose-500 hover:bg-rose-50 disabled:opacity-30 dark:hover:bg-rose-950/20"
                      >
                        <FiTrash2 size={13} />
                      </button>
                    </div>

                    {open ? (
                      <div className="mt-2 grid grid-cols-2 gap-2 border-t border-dashed border-[#ececec] pt-2 sm:grid-cols-4 dark:border-[#17304a]">
                        <label className="block">
                          <span className={LINE_LABEL}>SKU</span>
                          <input className={CELL} value={line.sku || ""} onChange={(e) => setLine(index, { sku: e.target.value })} />
                        </label>
                        <label className="block">
                          <span className={LINE_LABEL}>Brand</span>
                          <input className={CELL} value={line.brand || ""} onChange={(e) => setLine(index, { brand: e.target.value })} />
                        </label>
                        <label className="block">
                          <span className={LINE_LABEL}>Model</span>
                          <input className={CELL} value={line.model || ""} onChange={(e) => setLine(index, { model: e.target.value })} />
                        </label>
                        <label className="col-span-2 block sm:col-span-1">
                          <span className={LINE_LABEL}>Specification</span>
                          <input className={CELL} value={line.specification || ""} onChange={(e) => setLine(index, { specification: e.target.value })} />
                        </label>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDetails((c) => { const next = [...c]; next[index] = true; return next; })}
                        className="mt-1.5 text-[11px] font-medium text-[#233353] hover:underline dark:text-sky-300"
                      >
                        + Add details (SKU, brand, model, specification)
                      </button>
                    )}
                  </li>
                );
              })}
            </ol>
            <p className="mt-2 text-[11px] text-[#999999]">No prices here - procurement gets them from the vendors.</p>
          </FormSectionBlock>

          {/* Vendors are the purchase team's to choose, and the budget is the
              manager's to record when approving - neither is asked here. */}
          <FormSectionBlock icon={<FiFileText />} title="Notes">
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className={LABEL} htmlFor="pr-special">Special Requirements</label>
                <textarea id="pr-special" rows={2} className={AREA} value={header.special_requirements} onChange={(e) => set("special_requirements", e.target.value)} />
              </div>
              <div>
                <label className={LABEL} htmlFor="pr-remarks">Remarks</label>
                <textarea id="pr-remarks" rows={2} className={AREA} value={header.remarks} onChange={(e) => set("remarks", e.target.value)} />
              </div>
            </div>
          </FormSectionBlock>
        </FormCard>

        <div className="space-y-5 xl:sticky xl:top-[var(--form-header-offset,0px)] xl:self-start">
          <FormCard>
            <p className="text-[12px] text-[#777777] dark:text-slate-400">Approver</p>
            <div className="mt-2 flex items-center gap-3">
              <span
                aria-hidden
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#233353] text-[12px] font-semibold text-white dark:bg-sky-600"
              >
                {initials(meta.me.reporting_manager_name || "Super Admin")}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[14px] font-medium text-[#141414] dark:text-white">
                  {meta.me.reporting_manager_name || "Super Admin"}
                </p>
                <p className="text-[12px] text-[#777777] dark:text-slate-400">
                  {meta.me.reporting_manager_name ? "Reporting Manager" : "No reporting manager set"}
                </p>
              </div>
            </div>
          </FormCard>

          <FormCard>
            <AttachmentsField
              value={files}
              onChange={setFiles}
              label="Supporting Documents"
              hint="Optional: a drawing, a sample photo, a quotation you already have."
            />
          </FormCard>
        </div>
      </div>
    </div>
  );
}
