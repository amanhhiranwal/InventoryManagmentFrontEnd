"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Table from "@/components/ui/Table";
import Button from "@/components/ui/Button";
import api from "@/lib/axios";
import { useUIStore } from "@/lib/store/ui.store";
import DocumentPrintPreview from "@/components/documents/DocumentPrintPreview";
import {
  FiPlus,
  FiDownload,
  FiTrash2,
  FiUsers,
  FiChevronDown,
  FiPrinter
} from "react-icons/fi";

interface OrderItem {
  product_id: string;
  description: string;
  rate: number;
  quantity_case: number;
  quantity_kg_ltr: number;
  price: number;
}

interface Order {
  _id: string;
  customer_name: string;
  aging_0_30: number;
  aging_31_60: number;
  aging_61_90: number;
  aging_91_120: number;
  aging_121_180: number;
  aging_above_180: number;
  items: OrderItem[];
  total_amount: number;
  gst_amount: number;
  grand_total: number;
}

export default function OrdersListPage() {
  const { addToast } = useUIStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const [previewOrder, setPreviewOrder] = useState<Order | null>(null);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await api.get("/api/v1/orders/");
      if (res.data?.success) {
        setOrders(res.data.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleDeleteOrder = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete order for "${name}"?`)) return;
    try {
      const res = await api.delete(`/api/v1/orders/${id}`);
      if (res.data?.success) {
        addToast("Order deleted successfully.", "success");
        fetchOrders();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // --- Export Handlers ---
  const handleExportCSV = () => {
    if (orders.length === 0) {
      addToast("No orders available to export.", "warning");
      return;
    }
    const headers = ["Order ID", "Customer Name", "Items Count", "Subtotal (Exc. GST)", "GST (18%)", "Grand Total (Inc. GST)"];
    const rows = orders.map((o) => [
      o._id,
      `"${o.customer_name}"`,
      o.items.length,
      o.total_amount,
      o.gst_amount,
      o.grand_total,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "sales_orders_report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setExportDropdownOpen(false);
    addToast("CSV Report downloaded successfully.", "success");
  };

  const handleExportExcel = () => {
    if (orders.length === 0) {
      addToast("No orders available to export.", "warning");
      return;
    }
    // Export formatted TSV as .xls to guarantee Excel opens it perfectly
    const headers = ["Order ID", "Customer Name", "Items Count", "Subtotal (Exc. GST)", "GST (18%)", "Grand Total (Inc. GST)"];
    const rows = orders.map((o) => [
      o._id,
      o.customer_name,
      o.items.length,
      o.total_amount.toFixed(2),
      o.gst_amount.toFixed(2),
      o.grand_total.toFixed(2),
    ]);

    const tsvContent = [headers.join("\t"), ...rows.map((r) => r.join("\t"))].join("\n");
    const blob = new Blob([tsvContent], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "sales_orders_report.xls");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setExportDropdownOpen(false);
    addToast("Excel Report downloaded successfully.", "success");
  };

  const handleExportPDF = () => {
    if (orders.length === 0) {
      addToast("No orders available to export.", "warning");
      return;
    }

    // Dynamic clean styled Print layout for PDF creation
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      addToast("Failed to open print window. Please allow popups.", "error");
      return;
    }

    const html = `
      <html>
        <head>
          <title>Sales Orders Report</title>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 30px; color: #333; }
            h1 { font-size: 20px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px; color: #0f172a; }
            p { font-size: 11px; color: #64748b; margin-top: 0; margin-bottom: 25px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
            th, td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: left; }
            th { background-color: #f8fafc; font-weight: bold; color: #475569; }
            td { color: #334155; }
            .grand-total { font-weight: bold; color: #0f172a; }
            .right { text-align: right; }
          </style>
        </head>
        <body>
          <h1>Sales Orders Report</h1>
          <p>Generated on: ${new Date().toLocaleDateString()}</p>
          <table>
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Customer / Client Name</th>
                <th class="right">Total Items</th>
                <th class="right">Subtotal (Exc. GST)</th>
                <th class="right">GST Amount</th>
                <th class="right">Grand Total</th>
              </tr>
            </thead>
            <tbody>
              ${orders.map(o => `
                <tr>
                  <td>${o._id}</td>
                  <td>${o.customer_name}</td>
                  <td class="right">${o.items.length}</td>
                  <td class="right">₹${o.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td class="right">₹${o.gst_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td class="right grand-total">₹${o.grand_total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
          <script>
            window.onload = function() {
              window.print();
              window.close();
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    setExportDropdownOpen(false);
    addToast("PDF print dialog opened.", "success");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Sales Order Registry"
          description="Create, track, and manage all wholesale client product orders, view aging portfolios, and export summary analytics."
        />
        <div className="flex items-center gap-3 shrink-0">
          {/* Export Dropdown */}
          <div className="relative">
            <Button
              variant="outline"
              onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
              icon={<FiDownload />}
            >
              <span>Export Report</span>
              <FiChevronDown className="ml-1 text-xs" />
            </Button>

            {exportDropdownOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setExportDropdownOpen(false)} />
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-[#071929] border border-slate-200 dark:border-[#0d2336] rounded-xl shadow-xl z-40 py-1 font-sans">
                  <button
                    onClick={handleExportCSV}
                    className="w-full text-left px-4.5 py-2.5 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-250 flex items-center gap-2 border-none bg-transparent cursor-pointer"
                  >
                    <span>Export to CSV (.csv)</span>
                  </button>
                  <button
                    onClick={handleExportExcel}
                    className="w-full text-left px-4.5 py-2.5 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-250 flex items-center gap-2 border-none bg-transparent cursor-pointer"
                  >
                    <span>Export to Excel (.xls)</span>
                  </button>
                  <button
                    onClick={handleExportPDF}
                    className="w-full text-left px-4.5 py-2.5 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-250 flex items-center gap-2 border-none bg-transparent cursor-pointer"
                  >
                    <span>Export to PDF (.pdf)</span>
                  </button>
                </div>
              </>
            )}
          </div>

          <Link href="/sales/orders/create">
            <Button icon={<FiPlus />}>
              Create Order
            </Button>
          </Link>
        </div>
      </div>

      <Card>
        {loading ? (
          <div className="text-center py-12 text-slate-400 italic text-xs">
            Fetching order records...
          </div>
        ) : orders.length > 0 ? (
          <Table headers={["Order ID", "Customer / Client", "Items Count", "Subtotal (Exc. GST)", "GST (18%)", "Grand Total", "Action"]}>
            {orders.map((o) => (
              <tr
                key={o._id}
                className="hover:bg-slate-50/50 dark:hover:bg-[#071929]/20 transition-all duration-150"
              >
                <td className="py-4 px-5 font-mono text-xs text-slate-500">
                  {o._id}
                </td>
                <td className="py-4 px-5 text-sm font-bold text-slate-800 dark:text-white">
                  <div className="flex items-center gap-2">
                    <FiUsers className="text-primary text-sm" />
                    <span>{o.customer_name}</span>
                  </div>
                </td>
                <td className="py-4 px-5 text-xs text-slate-600 dark:text-slate-350 font-semibold text-center">
                  {o.items.length} items
                </td>
                <td className="py-4 px-5 text-xs text-slate-500 font-mono">
                  ₹{o.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>
                <td className="py-4 px-5 text-xs text-slate-500 font-mono">
                  ₹{o.gst_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>
                <td className="py-4 px-5 text-sm font-extrabold text-primary font-mono">
                  ₹{o.grand_total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>
                <td className="py-4 px-5 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => setPreviewOrder(o)}
                      title="View / Print Purchase Order (PO)"
                      className="p-1.5 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-lg transition-colors cursor-pointer border-none bg-transparent"
                    >
                      <FiPrinter className="text-base" />
                    </button>
                    <button
                      onClick={() => handleDeleteOrder(o._id, o.customer_name)}
                      title="Delete Order"
                      className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer border-none bg-transparent"
                    >
                      <FiTrash2 className="text-base" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        ) : (
          <div className="text-center py-12 text-slate-400 italic text-xs">
            No orders registered yet. Click &quot;+ Create Order&quot; to place your first order.
          </div>
        )}
      </Card>

      {/* PO / Invoice Document Print Preview with Company Logo & Annotation */}
      {previewOrder && (
        <DocumentPrintPreview
          isOpen={!!previewOrder}
          onClose={() => setPreviewOrder(null)}
          documentType="PURCHASE ORDER (PO)"
          documentNumber={previewOrder._id.slice(0, 8).toUpperCase()}
          dateStr={new Date().toLocaleDateString("en-IN")}
          vendorName={previewOrder.customer_name}
          items={previewOrder.items.map((i) => ({
            item: i.description || i.product_id,
            qty: i.quantity_case || i.quantity_kg_ltr || 1,
            price: i.rate || i.price || 0,
          }))}
        />
      )}
    </div>
  );
}
