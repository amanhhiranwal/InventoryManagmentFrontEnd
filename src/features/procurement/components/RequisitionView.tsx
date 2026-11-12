"use client";

/* A requisition read-only: its details, lines, documents, approval chain
 * and activity. Shared by the PR detail page and the procurement
 * workspace, which adds its own panels around it.
 *
 * Details are grouped by what they answer, and a field left blank is not
 * shown at all - a grid of dashes made the filled ones hard to find. */

import Link from "next/link";
import { ReactNode } from "react";

import { AttachmentList } from "@/features/attachments/AttachmentList";

import type { Requisition, RequisitionItem } from "../api/procurement.api";
import DataList, { Totals, type Column } from "./DataList";
import { ActivityHistory } from "./ApprovalAndActivity";
import { Field, Panel, day, money } from "./shared";

type Entry = [label: string, value: ReactNode, wide?: boolean];

const filled = (entries: Entry[]) =>
  entries.filter(([, value]) => value !== null && value !== undefined && value !== "" && value !== "—" && value !== false);

function Group({ title, entries }: { title: string; entries: Entry[] }) {
  const shown = filled(entries);
  if (!shown.length) return null;
  return (
    <div>
      <h3 className="mb-2.5 text-[12px] font-medium text-[#474747] dark:text-slate-300">{title}</h3>
      <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map(([label, value, wide]) => (
          <div key={label} className={wide ? "sm:col-span-2 lg:col-span-3" : ""}>
            <Field label={label}>{value}</Field>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RequisitionSummary({ pr }: { pr: Requisition }) {
  return (
    <Panel title="Details">
      <div className="space-y-5">
        <Group
          title="Request"
          entries={[
            ["Purpose", pr.purpose, true],
            ["Purchase type", pr.purchase_type_label],
            ["Priority", pr.priority.charAt(0) + pr.priority.slice(1).toLowerCase()],
            ["Required by", day(pr.required_by)],
            ["Delivery location", pr.delivery_location, true],
            ["Special requirements", pr.special_requirements, true],
            ["Remarks", pr.remarks, true],
          ]}
        />
        <Group
          title="Requester"
          entries={[
            ["Requested by", `${pr.requester_name}${pr.employee_id ? ` (${pr.employee_id})` : ""}`],
            ["Designation", pr.designation],
            ["Reporting manager", pr.reporting_manager_name],
            ["Department", pr.department_name],
            ["Cost center", pr.cost_center_code],
            ["Raised on", day(pr.pr_date)],
          ]}
        />
        <Group
          title="Linked to"
          entries={[
            [
              "Sales order",
              pr.sales_order_id ? (
                <Link href={`/sales/orders/${pr.sales_order_id}`} className="font-semibold text-[#233353] hover:underline dark:text-sky-300">
                  {pr.sales_order_number}
                </Link>
              ) : null,
            ],
            ["Customer", pr.customer_name],
            ["Project code", pr.project_code],
          ]}
        />
        <Group
          title="Budget and vendor"
          entries={[
            ["Budget code", pr.budget_code],
            ["Budget available", pr.budget_available != null ? money(pr.budget_available) : null],
            ["Budgeted", pr.budgeted === true ? "Yes" : pr.budgeted === false ? "No" : null],
            ["Preferred vendor", pr.preferred_vendor_name],
            ["Why this vendor", pr.preferred_vendor_reason, true],
            ["Alternatives considered", pr.alternatives_considered, true],
          ]}
        />
      </div>
    </Panel>
  );
}

const SUB = "mt-0.5 block text-[11px] text-[#777777] dark:text-slate-400";

export function RequisitionLines({
  pr,
  action,
  showVendors,
}: {
  pr: Requisition;
  action?: (itemId: number) => ReactNode;
  /** Show who was asked to quote for each line (the procurement workspace). */
  showVendors?: boolean;
}) {
  /* A requisition carries no prices unless procurement raised it with some. */
  const priced = (pr.items || []).some((item) => item.est_unit_price != null && Number(item.est_unit_price) > 0);
  const columns: Column<RequisitionItem>[] = [
    {
      header: "Item",
      primary: true,
      width: "w-[30%]",
      cell: (item) => (
        <>
          <span className="font-medium">{item.line_no}. {item.product_name}</span>
          {[item.sku, item.brand, item.model].some(Boolean) && (
            <span className={SUB}>{[item.sku, item.brand, item.model].filter(Boolean).join(", ")}</span>
          )}
          {(item.specification || item.description) && (
            <span className="mt-0.5 block text-[12px] text-[#555555] dark:text-slate-300">{item.specification || item.description}</span>
          )}
        </>
      ),
    },
    {
      header: "Qty",
      nowrap: true,
      cell: (item) =>
        item.approved_quantity != null && item.approved_quantity !== Number(item.quantity) ? (
          <span title={item.quantity_change_reason || ""}>
            <s className="text-[#999999]">{item.quantity}</s> {item.approved_quantity} {item.uom}
            <span className="mt-0.5 block text-[11px] text-amber-600">Changed by procurement</span>
          </span>
        ) : (
          `${item.quantity} ${item.uom}`
        ),
    },
  ];
  if (showVendors) {
    columns.push({
      header: "Vendors asked",
      cell: (item) =>
        item.rfq_vendors?.length ? (
          <span className="text-[12px]">{item.rfq_vendors.map((v) => v.name).join(", ")}</span>
        ) : (
          <span className="text-[12px] text-[#999999]">None yet</span>
        ),
    });
  }
  if (priced) {
    columns.push(
      { header: "Est. Price", align: "right", nowrap: true, cell: (item) => (item.est_unit_price != null ? money(Number(item.est_unit_price)) : "—") },
      { header: "Total", align: "right", nowrap: true, cell: (item) => <span className="font-medium">{money(item.est_total)}</span> },
    );
  }
  if (action) columns.push({ header: "", align: "right", cell: (item) => (item.id ? action(item.id) : null) });

  return (
    <Panel title={`Items (${pr.items?.length || 0})`}>
      <DataList
        dense
        rows={pr.items || []}
        columns={columns}
        rowKey={(item) => item.id ?? item.line_no ?? item.product_name}
        footer={priced ? <Totals rows={[{ label: "Estimated total", value: money(pr.estimated_total, pr.currency), strong: true }]} /> : undefined}
      />
    </Panel>
  );
}

/** The side column: documents and the activity history. The approval
 *  itself is the banner at the top of the page. */
export function RequisitionSide({
  pr,
  onLog,
}: {
  pr: Requisition;
  onLog?: (activity: string, remarks: string) => Promise<boolean>;
}) {
  return (
    <>
      <Panel title="Documents">
        <AttachmentList files={pr.attachments || []} empty="Nothing attached." />
      </Panel>

      <ActivityHistory rows={pr.activity} onLog={onLog} />
    </>
  );
}
