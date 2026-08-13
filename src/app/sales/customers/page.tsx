"use client";

import { useState, useEffect } from "react";
import api from "@/lib/axios";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Table from "@/components/ui/Table";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import DetailSideDrawer, { DrawerCustomerData } from "@/components/ui/DetailSideDrawer";
import { useUIStore } from "@/lib/store/ui.store";
import { createLeadApi } from "@/features/workflows/api/workflows.api";
import { getRolesApi, Role } from "@/features/rbac/api/rbac.api";
import {
  FiPlus,
  FiSearch,
  FiFileText,
  FiTrash2,
  FiArrowUpRight,
  FiDownload,
  FiEye
} from "react-icons/fi";
import { CgSpinner } from "react-icons/cg";

interface Customer {
  id: string;
  name: string;
  isRegistered: boolean;
  email: string;
  phone: string;
  address: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  gst?: string;
  pan?: string;
  category: string;
  kycDocs: string[];
  status: "Active" | "Inactive";
}

interface InvoiceItem {
  description: string;
  qty: number;
  price: number;
  gstRate: number;
}

export default function CustomersPage() {
  const { addToast } = useUIStore();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  
  // Customers List State
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  // Detail Side Drawer State
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerCustomer, setDrawerCustomer] = useState<DrawerCustomerData | null>(null);

  // Converted Lead Customer IDs Tracking
  const [convertedCustomerIds, setConvertedCustomerIds] = useState<string[]>([]);

  // Invoice Builder States
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceCustomer, setInvoiceCustomer] = useState<Customer | null>(null);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([
    { description: "Product Line Item", qty: 1, price: 50000, gstRate: 18 }
  ]);
  const [invoiceNumber, setInvoiceNumber] = useState("");

  // Invoice Receipt Preview States
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printedInvoice, setPrintedInvoice] = useState<{
    customer: Customer;
    items: InvoiceItem[];
    invoiceNo: string;
    subTotal: number;
    gstTotal: number;
    grandTotal: number;
    date: string;
  } | null>(null);

  // Convert to Lead Modal States
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [selectedConvertCustomer, setSelectedConvertCustomer] = useState<Customer | null>(null);
  const [convertTitle, setConvertTitle] = useState("");
  const [convertDesc, setConvertDesc] = useState("");
  const [dbRoles, setDbRoles] = useState<Role[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [convertingLead, setConvertingLead] = useState(false);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const res = await api.get("/api/v1/customers/");
      if (res.data?.success) {
        setCustomers(res.data.data || []);
      }
    } catch (err) {
      console.error(err);
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
    const fetchRoles = async () => {
      try {
        const rolesList = await getRolesApi();
        setDbRoles(rolesList || []);
        if (rolesList && rolesList.length > 0) {
          setSelectedRoleId(rolesList[0].id);
        }
      } catch (err) {
        console.error("Failed to load DB roles:", err);
      }
    };
    fetchRoles();
  }, []);

  const handleDeleteCustomer = async (id: string) => {
    const confirm = window.confirm("Are you sure you want to delete this customer profile?");
    if (!confirm) return;
    try {
      const res = await api.delete("/api/v1/customers/" + id);
      if (res.data?.success) {
        addToast("Customer profile removed successfully.", "success");
        fetchCustomers();
        if (drawerCustomer?.id === id) {
          setDrawerOpen(false);
        }
      }
    } catch (err) {
      console.error(err);
      addToast("Failed to delete customer.", "error");
    }
  };

  const handleOpenDrawer = (cust: Customer) => {
    setDrawerCustomer({
      id: cust.id,
      name: cust.name,
      contactName: cust.contactName || cust.name,
      contactEmail: cust.email,
      contactPhone: cust.phone,
      company: cust.name,
      designation: "Contact Person",
      category: cust.category,
      productInterest: cust.category || "General",
      leadValue: 0,
      stage: "Open",
      status: cust.status,
      activities: []
    });
    setDrawerOpen(true);
  };

  const openInvoiceBuilder = (cust: Customer) => {
    setInvoiceCustomer(cust);
    setInvoiceNumber(`INV-${Date.now().toString().slice(-6)}`);
    setInvoiceItems([
      { description: "Product / Service Supply", qty: 1, price: 50000, gstRate: cust.isRegistered ? 18 : 0 }
    ]);
    setShowInvoiceModal(true);
  };

  const addInvoiceRow = () => {
    setInvoiceItems([...invoiceItems, { description: "", qty: 1, price: 0, gstRate: invoiceCustomer?.isRegistered ? 18 : 0 }]);
  };

  const removeInvoiceRow = (index: number) => {
    setInvoiceItems(invoiceItems.filter((_, idx) => idx !== index));
  };

  const updateInvoiceItem = (index: number, fields: Partial<InvoiceItem>) => {
    const updated = [...invoiceItems];
    updated[index] = { ...updated[index], ...fields };
    setInvoiceItems(updated);
  };

  const generateInvoiceBill = () => {
    if (!invoiceCustomer) return;
    if (invoiceItems.some(item => !item.description.trim() || item.price <= 0 || item.qty <= 0)) {
      addToast("Please provide valid item description, price, and quantity for all rows.", "warning");
      return;
    }

    let subTotal = 0;
    let gstTotal = 0;

    invoiceItems.forEach(item => {
      const lineTotal = item.qty * item.price;
      subTotal += lineTotal;
      if (invoiceCustomer.isRegistered) {
        gstTotal += (lineTotal * item.gstRate) / 100;
      }
    });

    const grandTotal = subTotal + gstTotal;

    setPrintedInvoice({
      customer: invoiceCustomer,
      items: invoiceItems,
      invoiceNo: invoiceNumber,
      subTotal,
      gstTotal,
      grandTotal,
      date: new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    });
    
    setShowInvoiceModal(false);
    setShowPrintModal(true);
  };

  const openConvertLead = (cust: Customer) => {
    setSelectedConvertCustomer(cust);
    setConvertTitle(`Lead: ${cust.name}`);
    setConvertDesc(`Client: ${cust.name}\nContact: ${cust.contactName || cust.name} (${cust.phone})\nEmail: ${cust.email}\nAddress: ${cust.address}\nDealing Category: ${cust.category}\nTax Registration: ${cust.isRegistered ? "GST Registered (" + (cust.gst || "N/A") + ")" : "Unregistered (PAN: " + (cust.pan || "N/A") + ")"}`);
    setShowConvertModal(true);
  };

  const handleConvertLeadConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConvertCustomer) return;
    if (!convertTitle.trim()) {
      addToast("Lead Title is required.", "warning");
      return;
    }

    try {
      setConvertingLead(true);

      const selectedRole = dbRoles.find((r) => r.id === selectedRoleId);
      const roleName = selectedRole ? selectedRole.name : "Workflow Role";

      await createLeadApi({
        title: convertTitle.trim(),
        description: `Target Role: ${roleName}\n\n${convertDesc.trim()}`,
        status: "new",
      });

      addToast(`Customer converted to Sales Lead successfully!`, "success");
      setConvertedCustomerIds([...convertedCustomerIds, selectedConvertCustomer.id]);
      setShowConvertModal(false);
      setSelectedConvertCustomer(null);
    } catch (err) {
      console.error(err);
      addToast("Failed to create Lead in workflow pipeline.", "error");
    } finally {
      setConvertingLead(false);
    }
  };

  const filtered = customers.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.contactName || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.gst || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.email || "").toLowerCase().includes(search.toLowerCase());
    
    const matchesCategory = categoryFilter === "All" || c.category === categoryFilter;
    const matchesStatus = statusFilter === "All" || c.status === statusFilter;
    
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const activeCount = customers.filter(c => c.status === "Active").length;
  const gstRegisteredCount = customers.filter(c => c.isRegistered).length;

  return (
    <div className="space-y-6 select-none">
      
      {/* Sub Navigation / Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-[#051422] px-5 py-4 rounded-2xl border border-slate-200/80 dark:border-[#0d2336] shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white font-sans">
            Customer Directory
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage corporate clients, customer accounts, and billing profiles
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => addToast("Exporting customer directory...", "info")}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-50 dark:bg-[#071929] hover:bg-slate-100 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-all cursor-pointer"
          >
            <FiDownload className="text-xs" />
            <span>Export</span>
          </button>

          <Link href="/sales/customers/create">
            <button className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#233353] hover:bg-[#101725] text-white text-xs font-bold shadow-sm transition-all cursor-pointer">
              <FiPlus className="text-xs" />
              <span>Add Customer</span>
            </button>
          </Link>
        </div>
      </div>

      {/* Dynamic KPI Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Metric 1 */}
        <div className="bg-white dark:bg-[#051422] rounded-2xl border border-slate-200/80 dark:border-[#0d2336] p-5 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Customers</span>
          <div className="my-2">
            <h3 className="text-2xl font-black text-[#233353] dark:text-white font-mono">
              {customers.length.toLocaleString("en-IN")}
            </h3>
          </div>
          <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 dark:border-[#0d2336]/60">
            <span className="text-slate-400">Registered in database</span>
            <span className="font-bold text-[#233353] dark:text-sky-400 text-[10px]">{customers.length} Records</span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white dark:bg-[#051422] rounded-2xl border border-slate-200/80 dark:border-[#0d2336] p-5 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Active Accounts</span>
          <div className="my-2">
            <h3 className="text-2xl font-black text-[#233353] dark:text-white font-mono">
              {activeCount.toLocaleString("en-IN")}
            </h3>
          </div>
          <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 dark:border-[#0d2336]/60">
            <span className="text-slate-400">Active Ratio</span>
            <span className="font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full text-[10px]">
              {customers.length > 0 ? `${Math.round((activeCount / customers.length) * 100)}%` : "0%"}
            </span>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white dark:bg-[#051422] rounded-2xl border border-slate-200/80 dark:border-[#0d2336] p-5 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">GST Registered</span>
          <div className="my-2">
            <h3 className="text-2xl font-black text-[#233353] dark:text-white font-mono">
              {gstRegisteredCount.toLocaleString("en-IN")}
            </h3>
          </div>
          <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 dark:border-[#0d2336]/60">
            <span className="text-slate-400">Tax Compliance</span>
            <span className="font-bold text-blue-600 bg-blue-500/10 px-2 py-0.5 rounded-full text-[10px]">
              {customers.length > 0 ? `${Math.round((gstRegisteredCount / customers.length) * 100)}%` : "0%"}
            </span>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-white dark:bg-[#051422] rounded-2xl border border-slate-200/80 dark:border-[#0d2336] p-5 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Leads Converted</span>
          <div className="my-2">
            <h3 className="text-2xl font-black text-[#233353] dark:text-white font-mono">
              {convertedCustomerIds.length}
            </h3>
          </div>
          <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 dark:border-[#0d2336]/60">
            <span className="text-slate-400">In Active Pipeline</span>
            <span className="font-bold text-emerald-600 text-[10px]">Synced</span>
          </div>
        </div>

      </div>

      {/* Search & Filter Controls Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-[#051422] p-4 rounded-2xl border border-slate-200/80 dark:border-[#0d2336] shadow-sm">
        
        {/* Search input */}
        <div className="flex items-center gap-2.5 bg-slate-50 dark:bg-[#071929] rounded-xl border border-slate-200/80 dark:border-[#0d2336] px-3.5 py-2 w-full sm:w-72">
          <FiSearch className="text-slate-400 text-xs" />
          <input
            type="text"
            placeholder="Search Customers..."
            className="w-full text-xs bg-transparent outline-none text-slate-800 dark:text-white placeholder:text-slate-400"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-50 dark:bg-[#071929] px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
          >
            <option value="All">All Categories</option>
            <option value="Hardware Solutions">Hardware Solutions</option>
            <option value="Consumer Electronics">Consumer Electronics</option>
            <option value="Software & Licenses">Software & Licenses</option>
            <option value="Office Infrastructure">Office Infrastructure</option>
            <option value="General">General</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-50 dark:bg-[#071929] px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
          >
            <option value="All">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>

      </div>

      {/* Customers Data Table */}
      <Card>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
            <CgSpinner className="animate-spin text-3xl text-[#233353] dark:text-sky-400" />
            <span className="text-xs font-semibold">Loading registered customer accounts...</span>
          </div>
        ) : filtered.length > 0 ? (
          <Table headers={["Cust. ID", "Customer Name", "Company & Contact", "Category", "Tax Status", "Status", "Actions"]}>
            {filtered.map((c, idx) => {
              const isConverted = convertedCustomerIds.includes(c.id);
              const custId = `CUST-${(1001 + idx)}`;

              return (
                <tr
                  key={c.id}
                  className="hover:bg-slate-50/70 dark:hover:bg-[#071929]/30 transition-all border-b border-slate-100 dark:border-[#0d2336]/40 cursor-pointer"
                  onClick={() => handleOpenDrawer(c)}
                >
                  <td className="py-4 px-5 text-xs font-mono font-bold text-slate-400">
                    {custId}
                  </td>

                  <td className="py-4 px-5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-[#233353]/10 text-[#233353] dark:text-sky-400 flex items-center justify-center font-bold text-xs">
                        {c.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
                          <span>{c.contactName || c.name}</span>
                          {isConverted && (
                            <span className="bg-emerald-500/10 text-emerald-600 px-1.5 py-0.2 rounded text-[9px] font-bold">
                              ✓ In Lead Pipeline
                            </span>
                          )}
                        </h4>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {c.email} • {c.phone}
                        </p>
                      </div>
                    </div>
                  </td>

                  <td className="py-4 px-5">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{c.name}</p>
                    <p className="text-[10px] text-slate-400">{c.address || "India"}</p>
                  </td>

                  <td className="py-4 px-5 text-xs font-semibold text-slate-600 dark:text-slate-350">
                    {c.category || "General"}
                  </td>

                  <td className="py-4 px-5">
                    <span className={`inline-flex items-center rounded-lg px-2 py-0.5 text-[9px] font-extrabold uppercase ${
                      c.isRegistered
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                        : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                    }`}>
                      {c.isRegistered ? `GST: ${c.gst || "Registered"}` : "Unregistered"}
                    </span>
                  </td>

                  <td className="py-4 px-5">
                    <span className="inline-flex items-center rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-2.5 py-0.5 text-[11px] font-bold">
                      {c.status}
                    </span>
                  </td>

                  <td className="py-4 px-5 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleOpenDrawer(c)}
                        title="View Details Drawer"
                        className="p-1.5 rounded-lg border border-slate-200 dark:border-[#0d2336] hover:bg-[#233353] hover:text-white text-slate-600 dark:text-slate-300 transition-all cursor-pointer text-xs"
                      >
                        <FiEye />
                      </button>

                      {!isConverted ? (
                        <button
                          onClick={() => openConvertLead(c)}
                          title="Convert to active Lead"
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#233353] text-white text-xs font-bold hover:bg-[#101725] transition-all cursor-pointer shadow-sm"
                        >
                          <FiArrowUpRight className="text-xs" />
                          <span>To Lead</span>
                        </button>
                      ) : (
                        <span className="text-[10px] text-emerald-600 font-bold bg-emerald-500/10 px-2 py-1 rounded-lg">
                          Lead Ready
                        </span>
                      )}

                      <button
                        onClick={() => openInvoiceBuilder(c)}
                        title="Generate Bill / Quotation"
                        className="p-1.5 rounded-lg border border-slate-200 dark:border-[#0d2336] hover:bg-slate-100 text-slate-600 dark:text-slate-300 transition-all cursor-pointer text-xs"
                      >
                        <FiFileText />
                      </button>

                      <button
                        onClick={() => handleDeleteCustomer(c.id)}
                        title="Delete Profile"
                        className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-all cursor-pointer text-xs"
                      >
                        <FiTrash2 />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </Table>
        ) : (
          <div className="text-center py-16 text-slate-400 italic text-xs">
            No customer accounts found. Click &quot;Add Customer&quot; above to create one.
          </div>
        )}
      </Card>

      {/* Slide-over Detail Side Drawer */}
      <DetailSideDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        customer={drawerCustomer}
        onConvertToLead={(cust) => {
          const original = customers.find(c => c.id === cust.id);
          if (original) {
            setDrawerOpen(false);
            openConvertLead(original);
          }
        }}
        onEdit={(cust) => {
          addToast(`Customer: ${cust.name}`, "info");
        }}
        onMarkDead={(cust) => {
          handleDeleteCustomer(cust.id);
        }}
      />

      {/* Convert to Lead Modal */}
      {showConvertModal && selectedConvertCustomer && (
        <Modal
          isOpen={showConvertModal}
          onClose={() => setShowConvertModal(false)}
          title="Convert Customer Account to Lead"
        >
          <form onSubmit={handleConvertLeadConfirm} className="space-y-4">
            <Input
              label="Lead Title *"
              required
              value={convertTitle}
              onChange={(e) => setConvertTitle(e.target.value)}
            />

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Workflow Role Destination
              </label>
              <select
                className="w-full rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-50 dark:bg-[#071929] px-3.5 py-2.5 text-xs text-slate-900 dark:text-white outline-none"
                value={selectedRoleId}
                onChange={(e) => setSelectedRoleId(e.target.value)}
              >
                {dbRoles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Customer Context & Requirements
              </label>
              <textarea
                rows={4}
                value={convertDesc}
                onChange={(e) => setConvertDesc(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-50 dark:bg-[#071929] p-3 text-xs text-slate-800 dark:text-white outline-none font-mono"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-[#0d2336]">
              <Button variant="outline" type="button" onClick={() => setShowConvertModal(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={convertingLead}>
                Confirm Conversion
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Invoice Generator Modal */}
      {showInvoiceModal && invoiceCustomer && (
        <Modal
          isOpen={showInvoiceModal}
          onClose={() => setShowInvoiceModal(false)}
          title={`Generate Bill: ${invoiceCustomer.name}`}
          size="lg"
        >
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-slate-50 dark:bg-[#071929] p-3 rounded-xl">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Invoice Number:</span>
              <span className="text-xs font-mono font-bold text-primary dark:text-sky-400">{invoiceNumber}</span>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Bill Line Items</label>
                <button
                  type="button"
                  onClick={addInvoiceRow}
                  className="text-xs font-bold text-[#233353] dark:text-sky-400 hover:underline cursor-pointer"
                >
                  + Add Line Item
                </button>
              </div>

              {invoiceItems.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <input
                    type="text"
                    placeholder="Item description..."
                    className="flex-grow rounded-lg border border-slate-200 dark:border-[#0d2336] bg-slate-50 dark:bg-[#071929] px-3 py-1.5 text-xs text-slate-800 dark:text-white outline-none"
                    value={item.description}
                    onChange={(e) => updateInvoiceItem(idx, { description: e.target.value })}
                  />
                  <input
                    type="number"
                    placeholder="Qty"
                    className="w-16 rounded-lg border border-slate-200 dark:border-[#0d2336] bg-slate-50 dark:bg-[#071929] px-3 py-1.5 text-xs text-center outline-none"
                    value={item.qty}
                    onChange={(e) => updateInvoiceItem(idx, { qty: parseInt(e.target.value) || 0 })}
                  />
                  <input
                    type="number"
                    placeholder="Price"
                    className="w-24 rounded-lg border border-slate-200 dark:border-[#0d2336] bg-slate-50 dark:bg-[#071929] px-3 py-1.5 text-xs text-right outline-none font-mono"
                    value={item.price}
                    onChange={(e) => updateInvoiceItem(idx, { price: parseFloat(e.target.value) || 0 })}
                  />
                  {invoiceItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeInvoiceRow(idx)}
                      className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer"
                    >
                      <FiTrash2 />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-[#0d2336]">
              <Button variant="outline" onClick={() => setShowInvoiceModal(false)}>
                Cancel
              </Button>
              <Button onClick={generateInvoiceBill}>
                Generate Invoice
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Invoice Printable Receipt Preview Modal */}
      {showPrintModal && printedInvoice && (
        <Modal
          isOpen={showPrintModal}
          onClose={() => setShowPrintModal(false)}
          title="Invoice Document"
          size="lg"
        >
          <div className="space-y-6 p-4 bg-white dark:bg-[#051422] rounded-xl border border-slate-200 dark:border-[#0d2336]">
            <div className="flex justify-between items-start border-b pb-4">
              <div>
                <h3 className="text-xl font-black text-[#233353] dark:text-white">ENTERPRISE SAAS</h3>
                <p className="text-xs text-slate-400 mt-0.5">Synergy Platform Billing System</p>
              </div>
              <div className="text-right text-xs">
                <p className="font-mono font-bold text-slate-800 dark:text-white">INV: {printedInvoice.invoiceNo}</p>
                <p className="text-slate-400">{printedInvoice.date}</p>
              </div>
            </div>

            <div className="text-xs">
              <p className="font-bold text-slate-500 uppercase tracking-wide">Billed To:</p>
              <p className="font-bold text-sm text-slate-900 dark:text-white mt-1">{printedInvoice.customer.name}</p>
              <p className="text-slate-500">{printedInvoice.customer.email} • {printedInvoice.customer.phone}</p>
              <p className="text-slate-500">{printedInvoice.customer.address}</p>
            </div>

            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b text-slate-500 uppercase font-bold">
                  <th className="pb-2">Description</th>
                  <th className="pb-2 text-center">Qty</th>
                  <th className="pb-2 text-right">Price</th>
                  <th className="pb-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {printedInvoice.items.map((it, idx) => (
                  <tr key={idx} className="border-b">
                    <td className="py-2.5 font-medium">{it.description}</td>
                    <td className="py-2.5 text-center">{it.qty}</td>
                    <td className="py-2.5 text-right font-mono">₹{it.price.toLocaleString("en-IN")}</td>
                    <td className="py-2.5 text-right font-mono font-bold">₹{(it.qty * it.price).toLocaleString("en-IN")}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex justify-end text-xs">
              <div className="w-60 space-y-1.5">
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal:</span>
                  <span className="font-mono font-bold">₹{printedInvoice.subTotal.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>GST (18%):</span>
                  <span className="font-mono font-bold">₹{printedInvoice.gstTotal.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between text-sm font-black text-[#233353] dark:text-white pt-2 border-t">
                  <span>Grand Total:</span>
                  <span className="font-mono">₹{printedInvoice.grandTotal.toLocaleString("en-IN")}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button onClick={() => window.print()}>
                Print Invoice
              </Button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
}
