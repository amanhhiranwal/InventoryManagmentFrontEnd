import api from "@/lib/axios";
import { downloadFile } from "@/lib/downloadFile";
import type { Letterhead } from "@/features/stock/api/grn.api";

const QUIET = { skipErrorToast: true };

export interface GatePassParty {
  name?: string;
  address?: string;
  gstin?: string;
}

export interface GatePassLine {
  description: string;
  detail?: string;
  serial?: string;
  qty: number;
  purpose?: string;
  returnable?: string;
}

/** The pass goods leave the gate on: made when Logistics send an order out
 *  for delivery, or when a dispatch is committed on Stock Out. */
export interface GatePass {
  id: number;
  gate_pass_no: string;
  gate_pass_date: string | null;
  financial_year: string;
  source: "OUT_FOR_DELIVERY" | "DISPATCH";
  sales_order_id: number | null;
  dispatch_order_id: number | null;
  order_number: string | null;
  dc_invoice_no: string | null;
  dc_invoice_date: string | null;
  transporter: string | null;
  docket_no: string | null;
  eway_bill_no: string | null;
  vehicle_number: string | null;
  driver_name: string | null;
  bill_to: GatePassParty;
  ship_to: GatePassParty;
  lines: GatePassLine[];
  total_qty: number;
  created_by_name: string | null;
  created_at: string | null;
}

export const listGatePassesApi = async (params: { sales_order_id?: number; dispatch_order_id?: number }): Promise<GatePass[]> => {
  const { data } = await api.get("/api/v1/gate-passes/", { ...QUIET, params });
  return data.data || [];
};

export const getGatePassApi = async (id: number): Promise<{ gatePass: GatePass; letterhead: Letterhead }> => {
  const { data } = await api.get(`/api/v1/gate-passes/${id}`, QUIET);
  return { gatePass: data.data, letterhead: data.letterhead };
};

/** Logistics making the pass for an order already out for delivery. */
export const makeGatePassApi = async (orderId: number): Promise<GatePass> => {
  const { data } = await api.post(`/api/v1/gate-passes/orders/${orderId}`, undefined, QUIET);
  return data.data;
};

export const downloadGatePassPdfApi = (pass: Pick<GatePass, "id" | "gate_pass_no">) =>
  downloadFile(`/api/v1/gate-passes/${pass.id}/pdf`, `Gate_Pass_${pass.gate_pass_no.replace(/[^A-Za-z0-9-_]/g, "-")}.pdf`);
