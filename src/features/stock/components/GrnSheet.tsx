import type { Grn, Letterhead } from "@/features/stock/api/grn.api";
import FitToWidth from "@/features/stock/components/FitToWidth";
import { qty } from "@/features/stock/components/stockUi";
import { formatDateNumeric } from "@/lib/datetime";

/* The warehouse's GRN SHEET workbook, cell for cell: column widths in the
   workbook's pixels, its fonts, fills and row heights, the logo in the
   letterhead, 8 item rows at least. The PDF (grn_pdf.py) draws the same. */
const COLS = [43, 226, 64, 66, 66, 66, 66, 134];
const LETTERHEAD = "#D9E1F2";
const TITLE = "#D0CFCF";
const HEADER = "#DEEBF7";
const ITEM_ROWS = 8;

const CELL = "border border-black px-1 align-middle";
const ARIAL = "font-[Arial,Helvetica,sans-serif]";
const CALIBRI = "font-[Calibri,Carlito,Helvetica,sans-serif]";

export function letterheadLines(letterhead: Letterhead) {
  const contact = [letterhead.phone_number, letterhead.email].filter(Boolean).join(" | ");
  return {
    name: (letterhead.company_name || "").toUpperCase(),
    address: letterhead.address || "",
    cin: letterhead.cin_number ? `CIN : ${letterhead.cin_number}` : "",
    gst: letterhead.gst_number ? `GST No : ${letterhead.gst_number}` : "",
    contact,
  };
}

/** The GRN as printed; id "grn-sheet" is the print area. */
export default function GrnSheet({ grn, letterhead }: { grn: Grn; letterhead: Letterhead }) {
  const head = letterheadLines(letterhead);
  const received = `${formatDateNumeric(grn.receipt_date)}${grn.warehouse_name ? ` at ${grn.warehouse_name}` : ""}`;
  const note = grn.delivery_note_no
    ? `${grn.delivery_note_no}${grn.delivery_note_date ? `  /  ${formatDateNumeric(grn.delivery_note_date)}` : ""}`
    : "N/A";
  const supplier = [grn.supplier_name, grn.supplier_address].filter(Boolean).join("\n") || "N/A";
  const rows: [string, string, number | undefined, boolean][] = [
    ["GRN Number:", grn.grn_number, undefined, false],
    ["Date of Receipt:", received, undefined, false],
    grn.do_number
      ? ["Returned Against Dispatch:", grn.do_number, undefined, false]
      : ["Purchase Order (PO) Number:", grn.po_number || "N/A", undefined, false],
    ["Supplier Name & Address:", supplier, 50, true],
    ["Delivery Note / Invoice Number & Date:", note, undefined, false],
  ];
  const item = `${CELL} ${ARIAL} text-center text-[7pt] font-bold`;
  const blanks = Math.max(0, ITEM_ROWS - grn.lines.length);

  return (
    <div id="grn-sheet" className="bg-white p-4 text-black">
      <FitToWidth width={COLS.reduce((a, b) => a + b, 0)}>
        <table className="border-collapse border-2 border-black" style={{ width: COLS.reduce((a, b) => a + b, 0) }}>
          <colgroup>
            {COLS.map((w, i) => (
              <col key={i} style={{ width: w }} />
            ))}
          </colgroup>
          <tbody>
            <tr style={{ height: 55 }}>
              <td
                colSpan={8}
                className={`${CELL} ${CALIBRI} align-top text-[9pt] leading-tight`}
                style={{ background: LETTERHEAD }}
              >
                <div className="flex items-start justify-between gap-3">
                  <p>
                    {head.name}
                    <br />
                    {[head.address, head.cin].filter(Boolean).join(" ")}
                    <br />
                    {[head.gst, head.contact].filter(Boolean).join(" ")}
                  </p>
                  <img src="/sheet-logo.png" alt="Synergy" className="h-[48px] w-auto" />
                </div>
              </td>
            </tr>
            <tr>
              <td
                colSpan={8}
                className={`${CELL} ${ARIAL} text-center text-[10pt] font-bold`}
                style={{ background: TITLE }}
              >
                GOODS RECEIVED NOTE (GRN)
              </td>
            </tr>
            {rows.map(([label, value, height, top]) => (
              <tr key={label} style={height ? { height } : undefined}>
                <td
                  colSpan={3}
                  className={`${CELL} ${ARIAL} text-right text-[9pt] font-bold ${top ? "align-top" : ""}`}
                >
                  {label}
                </td>
                <td colSpan={5} className={`${CELL} ${CALIBRI} whitespace-pre-line text-[11pt]`}>
                  {value}
                </td>
              </tr>
            ))}
            <tr style={{ height: 36 }}>
              <td className={`${CELL} ${CALIBRI} text-[10pt]`} style={{ background: LETTERHEAD }}>
                S.No.
              </td>
              {[
                "Item Code / SKU",
                "Description of Goods",
                "Qty Ordered",
                "Qty Received",
                "Qty Accepted",
                "Qty Rejected",
                "Remarks / Reason for Rejection",
              ].map((h) => (
                <td key={h} className={item} style={{ background: HEADER }}>
                  {h}
                </td>
              ))}
            </tr>
            {grn.lines.map((line) => (
              <tr key={line.id} style={{ height: 36 }}>
                <td className={`${CELL} ${CALIBRI} text-center text-[11pt]`}>{line.line_no}</td>
                <td className={item}>{line.sku || "N/A"}</td>
                <td className={item}>
                  {line.description}
                  {line.serials.length > 0 && <span className="block font-normal">S/N: {line.serials.join(", ")}</span>}
                </td>
                <td className={item}>
                  {line.qty_ordered === null || line.qty_ordered === undefined ? "-" : qty(line.qty_ordered)}
                </td>
                <td className={item}>{qty(line.qty_received)}</td>
                <td className={item}>
                  {line.qty_accepted === null || line.qty_accepted === undefined ? "-" : qty(line.qty_accepted)}
                </td>
                <td className={item}>
                  {line.qty_rejected === null || line.qty_rejected === undefined
                    ? "-"
                    : qty(line.qty_rejected + (line.qty_damaged || 0))}
                </td>
                <td className={item}>
                  {line.remarks || ""}
                  {line.qty_damaged ? <span className="block">({qty(line.qty_damaged)} damaged)</span> : null}
                </td>
              </tr>
            ))}
            {Array.from({ length: blanks }, (_, i) => (
              <tr key={`blank-${i}`} style={{ height: 20 }}>
                {COLS.map((_, c) => (
                  <td key={c} className={CELL} />
                ))}
              </tr>
            ))}
            {(
              [
                ["Received By:", grn.received_by_name || "", 20],
                ["Signature:", "", 48],
                ["Inspected & Approved By:", grn.inspected_by_name || "", 20],
                ["Signature:", "", 39],
                ["Date:", grn.posted_at ? formatDateNumeric(grn.posted_at) : "", 21],
              ] as [string, string, number][]
            ).map(([label, value, height], i) => (
              <tr key={`${label}-${i}`} style={{ height }}>
                <td className={CELL} />
                <td className={`${CELL} ${ARIAL} text-right text-[9pt] font-bold`}>{label}</td>
                <td colSpan={6} className={`${CELL} ${ARIAL} text-center text-[8pt] font-bold`}>
                  {value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </FitToWidth>
    </div>
  );
}
