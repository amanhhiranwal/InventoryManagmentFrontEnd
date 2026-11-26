"use client";

/**
 * The gate passes of an order or a dispatch: preview the sheet, download
 * the PDF, and - for Logistics, on an order already out for delivery with
 * none yet - make one. Passes are otherwise made by the server when goods
 * leave (out for delivery, or a dispatch committed).
 */

import { useCallback, useEffect, useState } from "react";
import { FiDownload, FiEye, FiPlus } from "react-icons/fi";

import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import type { Letterhead } from "@/features/stock/api/grn.api";
import {
  GatePass,
  downloadGatePassPdfApi,
  getGatePassApi,
  listGatePassesApi,
  makeGatePassApi,
} from "@/features/stock/api/gatePass.api";
import FitToWidth from "@/features/stock/components/FitToWidth";
import { letterheadLines } from "@/features/stock/components/GrnSheet";
import { errorText, qty } from "@/features/stock/components/stockUi";
import { formatDateNumeric } from "@/lib/datetime";
import { useUIStore } from "@/lib/store/ui.store";

/* The warehouse's Gate Pass workbook, cell for cell: its column widths in
   pixels, fonts, fills and row heights, the logo in the letterhead, item
   rows filled out to 23 and the three department sign-offs. The PDF
   (gate_pass.py) draws the same. */
const COLS = [52, 261, 239, 52, 98, 161, 145];
const TITLE = "#DEEAF6";
const TOTAL = "#BCD6ED";
const ITEM_ROWS = 23;
const CELL = "border border-black px-1";
const CALIBRI = "font-[Calibri,Carlito,Helvetica,sans-serif]";

export function GatePassSheet({ pass, letterhead }: { pass: GatePass; letterhead: Letterhead }) {
  const head = letterheadLines(letterhead);
  const small = `${CELL} ${CALIBRI} align-top text-[9pt] font-bold`;
  const vehicle = `Vehicle No : ${pass.vehicle_number || ""}${pass.driver_name ? `  |  Driver : ${pass.driver_name}` : ""}`;
  const info: [string, string, string, number][] = [
    ["Gate Pass No. :-", `G.P. No- ${pass.gate_pass_no}`, `Transport Mode: ${pass.transporter || ""}`, 33],
    [
      "Gate Pass Date :-",
      pass.gate_pass_date ? formatDateNumeric(pass.gate_pass_date) : "",
      `Transport ID- ${pass.docket_no || ""}`,
      29,
    ],
    ["DC  /  Invoice No :-", pass.dc_invoice_no || "", `E-way bill No- ${pass.eway_bill_no || ""}`, 29],
    ["DC  /  Invoice Date:", pass.dc_invoice_date ? formatDateNumeric(pass.dc_invoice_date) : "", vehicle, 29],
  ];
  const party: [string, "name" | "address" | "gstin", string, number][] = [
    ["Name : ", "name", "text-[10pt]", 28],
    ["Address : ", "address", "text-[10pt]", 49],
    ["GSTIN/UIN: ", "gstin", "text-[9pt]", 36],
  ];
  /* Each line, then its model on a row of its own, as the sheet writes it. */
  const lines = pass.lines.flatMap((line, index) => {
    const rows = [{ key: `l-${index}`, number: index + 1, line, detail: false }];
    if (line.detail && line.detail !== line.description)
      rows.push({ key: `d-${index}`, number: 0, line, detail: true });
    return rows;
  });
  const blanks = Math.max(0, ITEM_ROWS - lines.length);
  const row12 = `${CELL} ${CALIBRI} text-[12pt]`;
  const row11 = `${CELL} ${CALIBRI} text-[11pt]`;

  return (
    <div className="bg-white p-4 text-black">
      <FitToWidth width={COLS.reduce((a, b) => a + b, 0)}>
        <table className="border-collapse border-2 border-black" style={{ width: COLS.reduce((a, b) => a + b, 0) }}>
          <colgroup>
            {COLS.map((w, i) => (
              <col key={i} style={{ width: w }} />
            ))}
          </colgroup>
          <tbody>
            <tr style={{ height: 147 }}>
              <td
                colSpan={7}
                className={`${CELL} font-[Times_New_Roman,Times,serif] text-[11pt] leading-snug text-[#1F3864]`}
              >
                <div className="flex items-center justify-between gap-4">
                  <p>
                    {[head.name, head.address, head.cin, head.gst, head.contact].filter(Boolean).map((line) => (
                      <span key={line} className="block">
                        {line}
                      </span>
                    ))}
                  </p>
                  <img src="/sheet-logo.png" alt="Synergy" className="h-[136px] w-auto" />
                </div>
              </td>
            </tr>
            <tr style={{ height: 31 }}>
              <td
                colSpan={7}
                className={`${CELL} ${CALIBRI} align-top text-center text-[18pt] font-bold`}
                style={{ background: TITLE }}
              >
                Gate Pass
              </td>
            </tr>
            {info.map(([label, value, right, height]) => (
              <tr key={label} style={{ height }}>
                <td colSpan={2} className={small}>
                  {label}
                </td>
                <td colSpan={3} className={small}>
                  {value}
                </td>
                <td colSpan={2} className={small}>
                  {right}
                </td>
              </tr>
            ))}
            <tr style={{ height: 34 }}>
              <td colSpan={3} className={small} style={{ background: TITLE }}>
                Bill To
              </td>
              <td colSpan={4} className={small} style={{ background: TITLE }}>
                Ship To
              </td>
            </tr>
            {party.map(([label, key, size, height]) => (
              <tr key={key} style={{ height }}>
                <td colSpan={3} className={`${CELL} ${CALIBRI} align-top font-bold ${size}`}>
                  {label}
                  {pass.bill_to?.[key] || ""}
                </td>
                <td colSpan={4} className={`${CELL} ${CALIBRI} align-top font-bold ${size}`}>
                  {label}
                  {pass.ship_to?.[key] || ""}
                </td>
              </tr>
            ))}
            <tr style={{ height: 38 }}>
              <td className={`${row12} text-center font-bold`}>S. No.</td>
              <td className={`${row12} font-bold`}>Description of Materials</td>
              <td className={`${row12} font-bold`}>Serial No.</td>
              <td className={`${row12} font-bold`}>QTY</td>
              <td className={`${row12} font-bold`}>Purpose</td>
              <td colSpan={2} className={`${row12} text-center font-bold`}>
                Returnable / Non Returnable
              </td>
            </tr>
            {lines.map(({ key, number, line, detail }) =>
              detail ? (
                <tr key={key} style={{ height: 21 }}>
                  <td className={CELL} />
                  <td className={row11}>{line.detail}</td>
                  <td className={CELL} />
                  <td className={CELL} />
                  <td className={CELL} />
                  <td colSpan={2} className={CELL} />
                </tr>
              ) : (
                <tr key={key} style={{ height: 21 }}>
                  <td className={`${row12} text-center`}>{number}</td>
                  <td className={row11}>{line.description}</td>
                  <td className={row11}>{line.serial || ""}</td>
                  <td className={`${row11} text-center`}>{qty(line.qty)}</td>
                  <td className={`${row12} text-center`}>{line.purpose || ""}</td>
                  <td colSpan={2} className={`${row12} text-center`}>
                    {line.returnable || ""}
                  </td>
                </tr>
              ),
            )}
            {Array.from({ length: blanks }, (_, i) => (
              <tr key={`blank-${i}`} style={{ height: 21 }}>
                {[0, 1, 2, 3, 4].map((c) => (
                  <td key={c} className={CELL} />
                ))}
                <td colSpan={2} className={CELL} />
              </tr>
            ))}
            <tr style={{ height: 21 }}>
              <td colSpan={3} className={`${row12} text-center font-bold`} style={{ background: TOTAL }}>
                Total
              </td>
              <td className={`${row12} text-center font-bold`}>{qty(pass.total_qty)}</td>
              <td className={CELL} />
              <td colSpan={2} className={CELL} />
            </tr>
            {["Warehouse Department", "Operation Department", "Accounts Department"].map((department) => (
              <tr key={department} style={{ height: 80 }}>
                <td colSpan={7} className={`${row12} align-top font-bold`}>
                  {department}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </FitToWidth>
    </div>
  );
}

export default function GatePassPanel({
  salesOrderId,
  dispatchOrderId,
  canMake = false,
  vehicle,
}: {
  salesOrderId?: number;
  dispatchOrderId?: number;
  /** Logistics, on an order that is dispatched or already out. */
  canMake?: boolean;
  /** At Dispatched: the vehicle and driver typed above, printed on the pass. */
  vehicle?: { vehicle_number: string; driver_name: string };
}) {
  const { addToast } = useUIStore();
  const [passes, setPasses] = useState<GatePass[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [making, setMaking] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const [preview, setPreview] = useState<{ pass: GatePass; letterhead: Letterhead } | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setPasses(await listGatePassesApi({ sales_order_id: salesOrderId, dispatch_order_id: dispatchOrderId }));
    } catch (err: unknown) {
      setError(errorText(err, "Could not load the gate passes."));
    }
  }, [salesOrderId, dispatchOrderId]);

  useEffect(() => {
    load();
  }, [load]);

  const open = async (pass: GatePass) => {
    try {
      setBusy(pass.id);
      const { gatePass, letterhead } = await getGatePassApi(pass.id);
      setPreview({ pass: gatePass, letterhead });
    } catch (err: unknown) {
      addToast(errorText(err, "Could not open the gate pass."), "error");
    } finally {
      setBusy(null);
    }
  };

  const download = async (pass: GatePass) => {
    try {
      await downloadGatePassPdfApi(pass);
    } catch (err: unknown) {
      addToast(errorText(err, "Could not download the gate pass."), "error");
    }
  };

  const make = async () => {
    if (!salesOrderId) return;
    try {
      setMaking(true);
      const made = await makeGatePassApi(salesOrderId, vehicle);
      addToast(`Gate pass ${made.gate_pass_no} generated.`, "success");
      await load();
      // Straight into its preview, as a proforma invoice opens once generated.
      await open(made);
    } catch (err: unknown) {
      addToast(errorText(err, "Could not make the gate pass."), "error");
    } finally {
      setMaking(false);
    }
  };

  const missingVehicle = vehicle !== undefined && (!vehicle.vehicle_number.trim() || !vehicle.driver_name.trim());

  if (error) {
    return (
      <p role="alert" className="text-[12px] text-rose-600">
        {error}
      </p>
    );
  }
  if (passes === null) return <p className="text-[12px] text-slate-400">Loading gate passes...</p>;

  return (
    <div className="space-y-2">
      {passes.length === 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[12px] text-[#777777] dark:text-slate-400">
            {!canMake
              ? "Made when the goods leave: when the order is marked out for delivery, or the dispatch is committed."
              : missingVehicle
                ? "Enter the vehicle number and driver name above to generate the gate pass."
                : "No gate pass yet. Generate it to preview and download; marking the order out for delivery uses the same one."}
          </p>
          {canMake && (
            <Button size="sm" icon={<FiPlus />} loading={making} disabled={missingVehicle || making} onClick={make}>
              Generate Gate Pass
            </Button>
          )}
        </div>
      ) : (
        passes.map((pass) => (
          <div
            key={pass.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 p-2.5 dark:border-[#0d2336]"
          >
            <div>
              <p className="font-mono text-[12px] font-semibold text-slate-800 dark:text-white">G.P. No- {pass.gate_pass_no}</p>
              <p className="text-[11px] text-slate-500">
                {pass.gate_pass_date ? formatDateNumeric(pass.gate_pass_date) : ""} · {qty(pass.total_qty)} item(s)
                {pass.vehicle_number ? ` · ${pass.vehicle_number}` : ""}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" icon={<FiEye />} loading={busy === pass.id} onClick={() => open(pass)}>
                Preview
              </Button>
              <Button variant="outline" size="sm" icon={<FiDownload />} onClick={() => download(pass)}>
                Download PDF
              </Button>
            </div>
          </div>
        ))
      )}

      <Modal
        isOpen={preview !== null}
        onClose={() => setPreview(null)}
        title={preview ? `Gate Pass ${preview.pass.gate_pass_no}` : "Gate Pass"}
        size="xl"
      >
        {preview && (
          <div className="space-y-3">
            <div className="rounded-xl border border-slate-200 dark:border-[#17304a]">
              <GatePassSheet pass={preview.pass} letterhead={preview.letterhead} />
            </div>
            <div className="flex justify-end">
              <Button size="sm" icon={<FiDownload />} onClick={() => download(preview.pass)}>
                Download PDF
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
