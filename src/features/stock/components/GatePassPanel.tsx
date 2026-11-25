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
import { errorText, qty } from "@/features/stock/components/stockUi";
import { formatDateNumeric } from "@/lib/datetime";
import { useUIStore } from "@/lib/store/ui.store";

const CELL = "border border-black px-2 py-1.5 align-top";

export function GatePassSheet({ pass, letterhead }: { pass: GatePass; letterhead: Letterhead }) {
  const pair = (label: string, value: React.ReactNode, right: React.ReactNode) => (
    <tr>
      <td className={`${CELL} font-semibold`}>{label}</td>
      <td className={CELL} colSpan={3}>
        {value}
      </td>
      <td className={CELL} colSpan={2}>
        {right}
      </td>
    </tr>
  );
  const party = (label: string, key: "name" | "address" | "gstin") => (
    <tr>
      <td className={CELL} colSpan={3}>
        {label} : {pass.bill_to?.[key] || ""}
      </td>
      <td className={CELL} colSpan={3}>
        {label} : {pass.ship_to?.[key] || ""}
      </td>
    </tr>
  );

  return (
    <div className="overflow-x-auto bg-white p-4 text-black">
      <table className="w-full min-w-[720px] border-collapse text-[12px]">
        <tbody>
          <tr>
            <td className={`${CELL} py-3 text-center`} colSpan={6}>
              <p className="text-[15px] font-bold uppercase">{letterhead.company_name}</p>
              {letterhead.address && <p>{letterhead.address}</p>}
              <p>
                {[letterhead.gst_number && `GST No : ${letterhead.gst_number}`, letterhead.phone_number, letterhead.email]
                  .filter(Boolean)
                  .join(" | ")}
              </p>
            </td>
          </tr>
          <tr>
            <td className={`${CELL} text-center text-[14px] font-bold`} colSpan={6}>
              Gate Pass
            </td>
          </tr>
          {pair("Gate Pass No. :-", `G.P. No- ${pass.gate_pass_no}`, `Transport Mode: ${pass.transporter || ""}`)}
          {pair(
            "Gate Pass Date :-",
            pass.gate_pass_date ? formatDateNumeric(pass.gate_pass_date) : "",
            `Transport ID / Docket- ${pass.docket_no || ""}`,
          )}
          {pair("DC  /  Invoice No :-", pass.dc_invoice_no || "", `E-way bill No- ${pass.eway_bill_no || ""}`)}
          {pair(
            "DC  /  Invoice Date:",
            pass.dc_invoice_date ? formatDateNumeric(pass.dc_invoice_date) : "",
            `Vehicle No : ${pass.vehicle_number || ""}${pass.driver_name ? `  |  Driver: ${pass.driver_name}` : ""}`,
          )}
          <tr className="bg-slate-100 font-semibold">
            <td className={CELL} colSpan={3}>
              Bill To
            </td>
            <td className={CELL} colSpan={3}>
              Ship To
            </td>
          </tr>
          {party("Name", "name")}
          {party("Address", "address")}
          {party("GSTIN/UIN", "gstin")}
          <tr className="bg-slate-100 font-semibold">
            <td className={CELL}>S. No.</td>
            <td className={CELL}>Description of Materials</td>
            <td className={CELL}>Serial No.</td>
            <td className={`${CELL} text-right`}>QTY</td>
            <td className={CELL}>Purpose</td>
            <td className={CELL}>Returnable / Non Returnable</td>
          </tr>
          {pass.lines.map((line, index) => (
            <tr key={`${line.serial || line.detail}-${index}`}>
              <td className={CELL}>{index + 1}</td>
              <td className={CELL}>
                {line.description}
                {line.detail && line.detail !== line.description && <span className="block text-[11px]">{line.detail}</span>}
              </td>
              <td className={`${CELL} font-mono text-[11px]`}>{line.serial || ""}</td>
              <td className={`${CELL} text-right`}>{qty(line.qty)}</td>
              <td className={CELL}>{line.purpose || ""}</td>
              <td className={CELL}>{line.returnable || ""}</td>
            </tr>
          ))}
          <tr className="font-semibold">
            <td className={CELL} colSpan={3}>
              Total
            </td>
            <td className={`${CELL} text-right`}>{qty(pass.total_qty)}</td>
            <td className={CELL} colSpan={2} />
          </tr>
          {["Warehouse Department", "Operation Department", "Accounts Department"].map((department) => (
            <tr key={department}>
              <td className={`${CELL} h-12 font-semibold`} colSpan={6}>
                {department}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function GatePassPanel({
  salesOrderId,
  dispatchOrderId,
  canMake = false,
}: {
  salesOrderId?: number;
  dispatchOrderId?: number;
  /** Logistics, on an order that is already out for delivery. */
  canMake?: boolean;
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
      const made = await makeGatePassApi(salesOrderId);
      addToast(`Gate pass ${made.gate_pass_no} made.`, "success");
      await load();
    } catch (err: unknown) {
      addToast(errorText(err, "Could not make the gate pass."), "error");
    } finally {
      setMaking(false);
    }
  };

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
            {canMake
              ? "No gate pass yet. Make one now; it is numbered for the order's company."
              : "Made when the goods leave: when the order is marked out for delivery, or the dispatch is committed."}
          </p>
          {canMake && (
            <Button size="sm" icon={<FiPlus />} loading={making} onClick={make}>
              Make Gate Pass
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
