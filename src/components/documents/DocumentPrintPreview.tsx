"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import api from "@/lib/axios";
import { FiPrinter, FiEdit, FiBriefcase } from "react-icons/fi";
import DocumentAnnotationModal from "./DocumentAnnotationModal";

export interface CompanyInfo {
  id: string;
  company_name: string;
  company_code: string;
  email: string;
  phone_number: string;
  address_line_1: string;
  city: string;
  state: string;
  postal_code: string;
  gst_number?: string;
  logo_url?: string;
}

export interface DocumentPrintPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  documentType: "PROFORMA INVOICE (PI)" | "PURCHASE ORDER (PO)" | "PURCHASE INDENT";
  documentNumber: string;
  dateStr: string;
  vendorName: string;
  items: Array<{ item: string; qty: number; price: number }>;
}

export default function DocumentPrintPreview({
  isOpen,
  onClose,
  documentType,
  documentNumber,
  dateStr,
  vendorName,
  items,
}: DocumentPrintPreviewProps) {
  const [companies, setCompanies] = useState<CompanyInfo[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<CompanyInfo | null>(null);
  const [showAnnotationModal, setShowAnnotationModal] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const fetchCompanies = async () => {
      try {
        const res = await api.get("/api/v1/companies/");
        if (res.data?.data) {
          const list = res.data.data;
          setCompanies(list);
          if (list.length > 0) {
            setSelectedCompany(list[0]);
          }
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchCompanies();
  }, [isOpen]);

  const calculateSubtotal = () =>
    items.reduce((sum, i) => sum + (i.qty || 1) * (i.price || 0), 0);

  const subtotal = calculateSubtotal();
  const gst = subtotal * 0.18; // 18% GST default
  const grandTotal = subtotal + gst;

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title={`Document Preview: ${documentType}`} size="xl">
        <div className="flex flex-col gap-6">
          {/* Header Controls */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <FiBriefcase className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Purchasing Company:
              </label>
              <select
                value={selectedCompany?.id || ""}
                onChange={(e) => {
                  const comp = companies.find((c) => c.id === e.target.value);
                  if (comp) setSelectedCompany(comp);
                }}
                className="px-3 py-1.5 text-sm border rounded-lg bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 dark:text-white"
              >
                {companies.length === 0 && <option value="">Default Purchasing Firm</option>}
                {companies.map((comp) => (
                  <option key={comp.id} value={comp.id}>
                    {comp.company_name} ({comp.company_code})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setShowAnnotationModal(true)}>
                <FiEdit className="w-4 h-4 mr-1.5" /> Annotate Document
              </Button>
              <Button variant="primary" onClick={handlePrint}>
                <FiPrinter className="w-4 h-4 mr-1.5" /> Print / Save PDF
              </Button>
            </div>
          </div>

          {/* Printable Document Box */}
          <div
            id="printable-document"
            className="p-8 bg-white text-slate-800 border border-slate-300 shadow-md rounded-lg flex flex-col gap-6"
          >
            {/* Header with Registered Company Logo */}
            <div className="flex justify-between items-start border-b pb-6 border-slate-200">
              <div className="flex items-center gap-4">
                {selectedCompany?.logo_url ? (
                  <img
                    src={selectedCompany.logo_url}
                    alt={selectedCompany.company_name}
                    className="h-16 w-auto max-w-[180px] object-contain rounded border border-slate-100 p-1"
                  />
                ) : (
                  <div className="h-16 w-16 bg-indigo-600 text-white rounded-lg flex items-center justify-center font-bold text-2xl shadow">
                    {selectedCompany?.company_name?.[0] || "C"}
                  </div>
                )}
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    {selectedCompany?.company_name || "REGISTERED PURCHASING ENTITY"}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {selectedCompany?.address_line_1 || "Corporate Office Headquarters"}
                    {selectedCompany?.city ? `, ${selectedCompany.city}` : ""}
                    {selectedCompany?.state ? `, ${selectedCompany.state}` : ""}
                  </p>
                  <p className="text-xs text-slate-500">
                    Email: {selectedCompany?.email || "billing@company.com"} | Phone:{" "}
                    {selectedCompany?.phone_number || "+91 9876543210"}
                  </p>
                  {selectedCompany?.gst_number && (
                    <p className="text-xs font-semibold text-indigo-700 mt-1">
                      GSTIN: {selectedCompany.gst_number}
                    </p>
                  )}
                </div>
              </div>

              <div className="text-right">
                <span className="inline-block px-3 py-1 bg-indigo-100 text-indigo-800 text-xs font-extrabold rounded uppercase tracking-wider mb-2">
                  {documentType}
                </span>
                <p className="text-sm font-semibold text-slate-700">Ref: #{documentNumber}</p>
                <p className="text-xs text-slate-500">Date: {dateStr}</p>
              </div>
            </div>

            {/* Vendor / Supplier details */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded border border-slate-200">
              <div>
                <h4 className="text-xs font-bold uppercase text-slate-500">Vendor / Supplier</h4>
                <p className="text-sm font-bold text-slate-900 mt-1">{vendorName}</p>
                <p className="text-xs text-slate-600">Registered Commercial Distributor</p>
              </div>
              <div className="text-right">
                <h4 className="text-xs font-bold uppercase text-slate-500">Issued By</h4>
                <p className="text-sm font-bold text-slate-900 mt-1">
                  {selectedCompany?.company_name || "Central Purchase Dept"}
                </p>
                <p className="text-xs text-slate-600">Authorized Inventory Manager</p>
              </div>
            </div>

            {/* Itemized Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-slate-300 text-xs font-bold uppercase text-slate-600 bg-slate-100">
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Item Description</th>
                    <th className="py-2.5 px-3 text-center">Qty</th>
                    <th className="py-2.5 px-3 text-right">Unit Price (₹)</th>
                    <th className="py-2.5 px-3 text-right">Total (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {items.map((it, idx) => {
                    const rowTotal = (it.qty || 1) * (it.price || 0);
                    return (
                      <tr key={idx}>
                        <td className="py-2.5 px-3 font-medium text-slate-500">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-800">
                          {it.item || "Standard Inventory Unit"}
                        </td>
                        <td className="py-2.5 px-3 text-center font-medium">{it.qty || 1}</td>
                        <td className="py-2.5 px-3 text-right">₹{(it.price || 0).toLocaleString("en-IN")}</td>
                        <td className="py-2.5 px-3 text-right font-semibold">
                          ₹{rowTotal.toLocaleString("en-IN")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Totals Summary */}
            <div className="flex justify-end pt-4 border-t border-slate-200">
              <div className="w-64 flex flex-col gap-2">
                <div className="flex justify-between text-sm text-slate-600">
                  <span>Subtotal:</span>
                  <span className="font-semibold">₹{subtotal.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between text-sm text-slate-600">
                  <span>GST (18%):</span>
                  <span className="font-semibold">₹{gst.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between text-base font-bold text-slate-900 border-t pt-2 border-slate-300">
                  <span>Grand Total:</span>
                  <span className="text-indigo-700">₹{grandTotal.toLocaleString("en-IN")}</span>
                </div>
              </div>
            </div>

            {/* Signatures & Footer */}
            <div className="flex justify-between items-end pt-12 text-xs text-slate-500">
              <div>
                <p className="italic">This is a system generated document.</p>
                <p>Terms & Conditions Apply.</p>
              </div>
              <div className="text-center border-t border-slate-400 pt-2 w-48">
                <p className="font-bold text-slate-800">Authorized Signatory</p>
                <p className="text-[10px] text-slate-500">{selectedCompany?.company_name}</p>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* Annotation Modal overlay */}
      <DocumentAnnotationModal
        isOpen={showAnnotationModal}
        onClose={() => setShowAnnotationModal(false)}
        documentTitle={`${documentType} #${documentNumber}`}
      />
    </>
  );
}
