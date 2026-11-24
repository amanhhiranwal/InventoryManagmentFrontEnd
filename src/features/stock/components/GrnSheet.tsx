import type { Grn, Letterhead } from "@/features/stock/api/grn.api";
import { qty } from "@/features/stock/components/stockUi";
import { formatDateNumeric } from "@/lib/datetime";

const CELL = "border border-black px-2 py-1.5 align-top";

/**
 * The GRN in the warehouse's own sheet format: company letterhead, the
 * GOODS RECEIVED NOTE heading, number, receipt date, PO, supplier and
 * delivery note; a location row with how the goods came in; one row per
 * product with ordered, received, accepted and rejected; and who received
 * and who inspected it. Printed as it is shown (id "grn-sheet" is the
 * print area).
 */
export default function GrnSheet({ grn, letterhead }: { grn: Grn; letterhead: Letterhead }) {
  const head = (label: string, value: React.ReactNode) => (
    <tr>
      <td className={`${CELL} w-[34%] font-semibold`} colSpan={3}>
        {label}
      </td>
      <td className={CELL} colSpan={5}>
        {value}
      </td>
    </tr>
  );

  return (
    <div id="grn-sheet" className="overflow-x-auto bg-white p-4 text-black">
      <table className="w-full min-w-[760px] border-collapse text-[12px]">
        <tbody>
          <tr>
            <td className={`${CELL} py-3 text-center`} colSpan={8}>
              <p className="text-[15px] font-bold uppercase">{letterhead.company_name}</p>
              <p>{letterhead.address}</p>
              <p>
                {letterhead.gst_number ? `GST No : ${letterhead.gst_number}` : ""}
                {letterhead.phone_number ? `  ${letterhead.phone_number}` : ""}
                {letterhead.email ? ` | ${letterhead.email}` : ""}
              </p>
            </td>
          </tr>
          <tr>
            <td className={`${CELL} text-center text-[14px] font-bold`} colSpan={8}>
              GOODS RECEIVED NOTE (GRN)
            </td>
          </tr>
          {head("GRN Number:", grn.grn_number)}
          {head("Date of Receipt:", formatDateNumeric(grn.receipt_date))}
          {grn.do_number
            ? head("Returned Against Dispatch:", grn.do_number)
            : head("Purchase Order (PO) Number:", grn.po_number || "N/A")}
          {head(
            "Supplier Name & Address:",
            <>
              {grn.supplier_name}
              {grn.supplier_address && <span className="block">{grn.supplier_address}</span>}
            </>,
          )}
          {head(
            "Delivery Note / Invoice Number & Date:",
            grn.delivery_note_no
              ? `${grn.delivery_note_no}${grn.delivery_note_date ? `  /  ${formatDateNumeric(grn.delivery_note_date)}` : ""}`
              : "N/A",
          )}
          <tr className="bg-slate-100 font-semibold">
            <td className={CELL}>S.No.</td>
            <td className={CELL}>Location / Item Code</td>
            <td className={CELL}>Description of Goods</td>
            <td className={`${CELL} text-right`}>Qty Ordered</td>
            <td className={`${CELL} text-right`}>Qty Received</td>
            <td className={`${CELL} text-right`}>Qty Accepted</td>
            <td className={`${CELL} text-right`}>Qty Rejected</td>
            <td className={CELL}>Remarks / Reason for Rejection</td>
          </tr>
          <tr>
            <td className={CELL} />
            <td className={`${CELL} font-semibold`} colSpan={2}>
              {grn.warehouse_name}
              {grn.warehouse_code ? ` (${grn.warehouse_code})` : ""}
            </td>
            <td className={CELL} colSpan={4} />
            <td className={CELL}>{grn.transport_remarks || ""}</td>
          </tr>
          {grn.lines.map((line) => (
            <tr key={line.id}>
              <td className={CELL}>{line.line_no}</td>
              <td className={`${CELL} font-mono text-[11px]`}>{line.sku}</td>
              <td className={CELL}>
                {line.description}
                {line.serials.length > 0 && (
                  <span className="block font-mono text-[10px]">S/N: {line.serials.join(", ")}</span>
                )}
              </td>
              <td className={`${CELL} text-right`}>{line.qty_ordered === null || line.qty_ordered === undefined ? "-" : qty(line.qty_ordered)}</td>
              <td className={`${CELL} text-right`}>{qty(line.qty_received)}</td>
              <td className={`${CELL} text-right`}>{line.qty_accepted === null || line.qty_accepted === undefined ? "-" : qty(line.qty_accepted)}</td>
              <td className={`${CELL} text-right`}>
                {line.qty_rejected === null || line.qty_rejected === undefined
                  ? "-"
                  : qty(line.qty_rejected + (line.qty_damaged || 0))}
              </td>
              <td className={CELL}>
                {line.remarks || ""}
                {line.qty_damaged ? <span className="block">({qty(line.qty_damaged)} damaged)</span> : null}
              </td>
            </tr>
          ))}
          <tr>
            <td className={CELL} />
            <td className={`${CELL} font-semibold`}>Received By:</td>
            <td className={CELL} colSpan={6}>
              {grn.received_by_name || ""}
            </td>
          </tr>
          <tr>
            <td className={CELL} />
            <td className={`${CELL} font-semibold`}>Signature:</td>
            <td className={`${CELL} h-8`} colSpan={6} />
          </tr>
          <tr>
            <td className={CELL} />
            <td className={`${CELL} font-semibold`}>Inspected &amp; Approved By:</td>
            <td className={CELL} colSpan={6}>
              {grn.inspected_by_name || ""}
            </td>
          </tr>
          <tr>
            <td className={CELL} />
            <td className={`${CELL} font-semibold`}>Signature:</td>
            <td className={`${CELL} h-8`} colSpan={6} />
          </tr>
          <tr>
            <td className={CELL} />
            <td className={`${CELL} font-semibold`}>Date:</td>
            <td className={CELL} colSpan={6}>
              {grn.posted_at ? formatDateNumeric(grn.posted_at) : ""}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
