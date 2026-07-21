"use client";

import { useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Table from "@/components/ui/Table";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import Switch from "@/components/ui/Switch";
import { useUIStore } from "@/lib/store/ui.store";
import { createLeadApi } from "@/features/workflows/api/workflows.api";
import {
  FiPlus,
  FiSearch,
  FiBriefcase,
  FiUser,
  FiMail,
  FiMapPin,
  FiFileText,
  FiCreditCard,
  FiDollarSign,
  FiUploadCloud,
  FiCheckCircle,
  FiPaperclip,
  FiTrash2,
  FiPrinter,
  FiArrowUpRight,
  FiX
} from "react-icons/fi";

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
  coi?: string;
  category: string;
  kycDocs: string[]; // List of mock uploaded files
  status: "Active" | "Inactive";
}

interface InvoiceItem {
  description: string;
  qty: number;
  price: number;
  gstRate: number; // 0, 5, 12, 18
}

export default function CustomersPage() {
  const { addToast } = useUIStore();
  const [search, setSearch] = useState("");
  
  // Customers List State
  const [customers, setCustomers] = useState<Customer[]>([]);

  // Converted Lead Customer IDs Tracking
  const [convertedCustomerIds, setConvertedCustomerIds] = useState<string[]>([]);

  // Add Customer Modal Wizards States
  const [showAddModal, setShowAddModal] = useState(false);
  const [formStep, setFormStep] = useState<1 | 2 | 3>(1);

  // Form States
  const [isRegistered, setIsRegistered] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [gst, setGst] = useState("");
  const [pan, setPan] = useState("");
  const [coi, setCoi] = useState("");
  const [category, setCategory] = useState("Hardware Solutions");
  
  // KYC Files (names of files uploaded)
  const [uploadedKycFiles, setUploadedKycFiles] = useState<string[]>([]);

  // Invoice Builder States
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceCustomer, setInvoiceCustomer] = useState<Customer | null>(null);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([
    { description: "Interactive Flat Panel Smartboard 75\"", qty: 1, price: 115000, gstRate: 18 }
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
  const [convertRole, setConvertRole] = useState<"CEO" | "AVP" | "Zonal Head" | "Area Head">("Area Head");
  const [convertingLead, setConvertingLead] = useState(false);

  // Mapping role to sales representative hierarchy
  const roleAgents = {
    "CEO": "Rohan Mehta (CEO)",
    "AVP": "Aditya Singh (AVP)",
    "Zonal Head": "Suresh Raina (Zonal Head)",
    "Area Head": "Ajit Kumar (Area Head)"
  };

  const resetForm = () => {
    setFormStep(1);
    setIsRegistered(true);
    setName("");
    setEmail("");
    setPhone("");
    setAddress("");
    setContactName("");
    setContactEmail("");
    setContactPhone("");
    setGst("");
    setPan("");
    setCoi("");
    setCategory("Hardware Solutions");
    setUploadedKycFiles([]);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, docType: string) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!uploadedKycFiles.includes(file.name)) {
        setUploadedKycFiles([...uploadedKycFiles, `${docType}_${file.name}`]);
        addToast(`${docType} file '${file.name}' attached to KYC.`, "success");
      }
    }
  };

  const handleAddCustomerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !phone.trim() || !contactName.trim()) {
      addToast("Customer name, email, phone, and contact details are required.", "warning");
      return;
    }

    if (isRegistered && (!gst.trim() || !pan.trim())) {
      addToast("GST and PAN numbers are required for Registered Customers.", "warning");
      return;
    }

    const newCustomer: Customer = {
      id: Date.now().toString(),
      name: name.trim(),
      isRegistered,
      email: email.trim(),
      phone: phone.trim(),
      address: address.trim(),
      contactName: contactName.trim(),
      contactEmail: contactEmail.trim(),
      contactPhone: contactPhone.trim(),
      gst: isRegistered ? gst.trim().toUpperCase() : undefined,
      pan: pan.trim().toUpperCase() || undefined,
      coi: isRegistered ? coi.trim().toUpperCase() : undefined,
      category,
      kycDocs: uploadedKycFiles,
      status: "Active",
    };

    setCustomers([newCustomer, ...customers]);
    addToast(`Customer '${name}' registered successfully!`, "success");
    setShowAddModal(false);
    resetForm();
  };

  const openInvoiceBuilder = (cust: Customer) => {
    setInvoiceCustomer(cust);
    setInvoiceNumber(`INV-${Date.now().toString().slice(-6)}`);
    setInvoiceItems([
      { description: "Premium Interactive Display Screen", qty: 1, price: 95000, gstRate: cust.isRegistered ? 18 : 0 }
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
    setConvertDesc(`Sales Conversion from CRM Customer Registry.\n\nClient: ${cust.name}\nContact: ${cust.contactName} (${cust.contactPhone})\nEmail: ${cust.email}\nAddress: ${cust.address}\nDealing Category: ${cust.category}\nTax Registration: ${cust.isRegistered ? "GST Registered (" + cust.gst + ")" : "Unregistered (PAN: " + (cust.pan || "N/A") + ")"}`);
    setConvertRole("Area Head");
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
      
      // Call standard createLeadApi
      await createLeadApi({
        title: convertTitle.trim(),
        description: `Sales Owner: ${roleAgents[convertRole]}\n\n${convertDesc.trim()}`,
        status: "new"
      });

      addToast(`Customer converted to Sales Lead under ${roleAgents[convertRole]}!`, "success");
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

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.contactName.toLowerCase().includes(search.toLowerCase()) ||
      (c.gst || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Customer CRM Registry"
          description="Manage registered and unregistered customer accounts, track KYC uploads, and convert entries to active pipeline leads."
        />
        <Button onClick={() => setShowAddModal(true)} icon={<FiPlus />}>
          Add Customer Profile
        </Button>
      </div>

      <div className="flex items-center gap-3 max-w-md bg-white dark:bg-[#051422] rounded-xl border border-slate-200 dark:border-[#0d2336] px-3.5 py-2">
        <FiSearch className="text-slate-400 text-sm" />
        <input
          type="text"
          placeholder="Search by name, contact, or GSTIN..."
          className="w-full text-xs bg-transparent outline-none text-slate-800 dark:text-white"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card>
        {filtered.length > 0 ? (
          <Table headers={["Company Details", "Tax Details", "Deal Category", "KYC Verification", "Lead Status", "Actions"]}>
            {filtered.map((c) => {
              const isConverted = convertedCustomerIds.includes(c.id);
              return (
                <tr
                  key={c.id}
                  className="hover:bg-slate-50/50 dark:hover:bg-[#071929]/20 transition-all duration-150 border-b border-slate-100 dark:border-[#0d2336]/30"
                >
                  <td className="py-4 px-5">
                    <div>
                      <h4 className="font-bold text-slate-800 dark:text-white text-sm flex items-center gap-1.5">
                        <FiBriefcase className="text-primary text-xs shrink-0" />
                        <span>{c.name}</span>
                        {isConverted && (
                          <span className="inline-flex items-center gap-1 bg-[#1e4620]/10 text-[#1e4620] px-2 py-0.5 rounded text-[10px] font-bold">
                            ✓ Lead Converted
                          </span>
                        )}
                      </h4>
                      <p className="text-[10px] text-slate-400 mt-1 flex flex-col gap-0.5">
                        <span className="flex items-center gap-1"><FiUser className="text-[9px]" /> Rep: {c.contactName} ({c.contactPhone})</span>
                        <span className="flex items-center gap-1"><FiMail className="text-[9px]" /> Email: {c.email}</span>
                        <span className="flex items-center gap-1"><FiMapPin className="text-[9px]" /> Addr: {c.address}</span>
                      </p>
                    </div>
                  </td>
                  <td className="py-4 px-5">
                    <div className="space-y-1">
                      <span className={`inline-flex items-center rounded px-2 py-0.5 text-[9px] font-extrabold tracking-wide uppercase ${
                        c.isRegistered 
                          ? "bg-emerald-500/10 text-emerald-700" 
                          : "bg-amber-500/10 text-amber-700"
                      }`}>
                        {c.isRegistered ? "GST Registered" : "Unregistered"}
                      </span>
                      {c.isRegistered && (
                        <p className="text-[10px] text-slate-500 font-mono">
                          GSTIN: <span className="font-bold text-slate-700 dark:text-slate-350">{c.gst}</span>
                        </p>
                      )}
                      {c.pan && (
                        <p className="text-[10px] text-slate-500 font-mono">
                          PAN: <span className="font-bold text-slate-700 dark:text-slate-350">{c.pan}</span>
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {c.category}
                  </td>
                  <td className="py-4 px-5">
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-400 font-bold block">
                        Documents: ({c.kycDocs.length})
                      </span>
                      <div className="flex flex-wrap gap-1 max-w-[150px]">
                        {c.kycDocs.map((doc, i) => (
                          <span key={i} className="inline-flex items-center gap-0.5 bg-slate-100 dark:bg-[#071929] border border-slate-200/50 text-slate-500 text-[8px] px-1.5 py-0.5 rounded font-mono truncate max-w-[80px]" title={doc}>
                            <FiPaperclip className="shrink-0" />
                            {doc.split("_").pop()}
                          </span>
                        ))}
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-5">
                    <span className="inline-flex items-center rounded-full bg-emerald-500/10 text-emerald-800 px-2 py-0.5 text-xs font-semibold">
                      {c.status}
                    </span>
                  </td>
                  <td className="py-4 px-5">
                    <div className="flex justify-end gap-2">
                      {!isConverted ? (
                        <Button
                          onClick={() => openConvertLead(c)}
                          size="sm"
                          variant="outline"
                          icon={<FiArrowUpRight />}
                        >
                          Convert to Lead
                        </Button>
                      ) : (
                        <span className="text-[10px] text-emerald-700 font-bold bg-emerald-500/5 border border-emerald-500/20 px-2 py-1 rounded-xl">
                          In Pipeline
                        </span>
                      )}
                      <Button
                        onClick={() => openInvoiceBuilder(c)}
                        size="sm"
                        icon={<FiFileText />}
                      >
                        Generate Bill
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </Table>
        ) : (
          <div className="text-center py-12 text-slate-400 italic text-xs">
            No customer profiles match your search filter criteria.
          </div>
        )}
      </Card>

      {/* Add Customer Profile Wizard Modal */}
      {showAddModal && (
        <Modal
          isOpen={showAddModal}
          onClose={() => {
            setShowAddModal(false);
            resetForm();
          }}
          title="Register Customer Account"
          size="lg"
          hasUnsavedChanges={name.trim() !== "" || email.trim() !== "" || address.trim() !== "" || gst.trim() !== "" || pan.trim() !== "" || uploadedKycFiles.length > 0}
        >
          <div className="space-y-5">
            {/* Step indicator progress bar */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#0d2336] pb-3">
              {[
                { step: 1, label: "Entity Type" },
                { step: 2, label: "Tax & Details" },
                { step: 3, label: "KYC Documents" }
              ].map((s) => (
                <div key={s.step} className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-extrabold ${
                    formStep === s.step
                      ? "bg-primary text-white"
                      : formStep > s.step
                      ? "bg-emerald-500 text-white"
                      : "bg-slate-100 text-slate-400"
                  }`}>
                    {formStep > s.step ? "✓" : s.step}
                  </div>
                  <span className={`text-[10px] font-bold tracking-wide uppercase ${
                    formStep === s.step ? "text-primary" : "text-slate-400"
                  }`}>
                    {s.label}
                  </span>
                </div>
              ))}
            </div>

            {/* STEP 1: SELECT ENTITY TYPE */}
            {formStep === 1 && (
              <div className="space-y-4 py-2">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-330 font-sans">
                    Select Customer Registration Status
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    This selection dynamically formats required billing documents, compliance checklists, and invoice templates.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setIsRegistered(true)}
                    className={`p-5 rounded-2xl border text-left flex flex-col justify-between h-32 cursor-pointer transition-all duration-200 ${
                      isRegistered
                        ? "border-primary bg-primary-light/10 ring-2 ring-primary/10 shadow-sm"
                        : "border-slate-200 dark:border-[#0d2336] bg-white dark:bg-[#051422] hover:bg-slate-50"
                    }`}
                  >
                    <div>
                      <span className="inline-block bg-emerald-500/10 text-emerald-700 text-[8px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                        Tax Enabled
                      </span>
                      <h4 className="text-sm font-bold text-slate-800 dark:text-white mt-2">
                        Registered Business
                      </h4>
                    </div>
                    <p className="text-[9px] text-slate-400 leading-normal">
                      Holder of a valid corporate identity. Form formats as a Tax Invoice detailing GST breakdown.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsRegistered(false)}
                    className={`p-5 rounded-2xl border text-left flex flex-col justify-between h-32 cursor-pointer transition-all duration-200 ${
                      !isRegistered
                        ? "border-primary bg-primary-light/10 ring-2 ring-primary/10 shadow-sm"
                        : "border-slate-200 dark:border-[#0d2336] bg-white dark:bg-[#051422] hover:bg-slate-50"
                    }`}
                  >
                    <div>
                      <span className="inline-block bg-amber-500/10 text-amber-700 text-[8px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                        Retail / Cash
                      </span>
                      <h4 className="text-sm font-bold text-slate-800 dark:text-white mt-2">
                        Unregistered Entity
                      </h4>
                    </div>
                    <p className="text-[9px] text-slate-400 leading-normal">
                      Individual buyer or non-GST business. Form formats as a Retail Bill of Supply without tax credit breakdowns.
                    </p>
                  </button>
                </div>

                <div className="flex justify-end pt-3">
                  <Button type="button" onClick={() => setFormStep(2)}>
                    Next: Add Details
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 2: DETAILS & BUSINESS NUMBERS */}
            {formStep === 2 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Customer / Business Name *"
                    required
                    placeholder="e.g. Acme Corporation"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Product Categories they deal in
                    </label>
                    <select
                      className="w-full rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-50/50 dark:bg-[#071929]/50 px-3.5 py-2.5 text-xs text-slate-900 dark:text-white outline-none"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                    >
                      <option value="Hardware Solutions">Hardware Solutions</option>
                      <option value="Consumer Electronics">Consumer Electronics</option>
                      <option value="Software & Licenses">Software & Licenses</option>
                      <option value="Office Infrastructure">Office Infrastructure</option>
                    </select>
                  </div>
                </div>

                {/* Company Address Contact Details */}
                <div className="grid grid-cols-3 gap-3">
                  <Input
                    label="Customer Email *"
                    required
                    type="email"
                    placeholder="e.g. corp@acme.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <Input
                    label="Customer Phone *"
                    required
                    placeholder="e.g. +91 9988776655"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                  <Input
                    label="Physical Address / Location"
                    placeholder="e.g. Delhi, India"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </div>

                {/* Contact Person Details */}
                <div className="p-3.5 bg-slate-50/50 dark:bg-[#071929]/30 border border-slate-250/30 rounded-xl space-y-3.5">
                  <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                    Contact Person details
                  </h4>
                  <div className="grid grid-cols-3 gap-3">
                    <Input
                      label="Contact Name *"
                      required
                      placeholder="e.g. John Doe"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                    />
                    <Input
                      label="Contact Email"
                      type="email"
                      placeholder="e.g. john@acme.com"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                    />
                    <Input
                      label="Contact Phone"
                      placeholder="e.g. +91 98765..."
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                    />
                  </div>
                </div>

                {/* Tax ID Numbers */}
                <div className="grid grid-cols-3 gap-3 pt-2">
                  {isRegistered ? (
                    <>
                      <Input
                        label="GSTIN (15 Digits) *"
                        required
                        placeholder="e.g. 06AAAAA1122A1Z5"
                        value={gst}
                        onChange={(e) => setGst(e.target.value)}
                      />
                      <Input
                        label="PAN Number *"
                        required
                        placeholder="e.g. AAAAA1122A"
                        value={pan}
                        onChange={(e) => setPan(e.target.value)}
                      />
                      <Input
                        label="COI Certificate Number"
                        placeholder="e.g. U74999..."
                        value={coi}
                        onChange={(e) => setCoi(e.target.value)}
                      />
                    </>
                  ) : (
                    <div className="col-span-3">
                      <Input
                        label="PAN Number (Tax Identifier)"
                        placeholder="e.g. BBBBB2233B"
                        value={pan}
                        onChange={(e) => setPan(e.target.value)}
                      />
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 dark:border-[#0d2336] pt-4">
                  <Button variant="outline" type="button" onClick={() => setFormStep(1)}>
                    Back: Entity Type
                  </Button>
                  <Button type="button" onClick={() => setFormStep(3)}>
                    Next: KYC Documents
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 3: KYC UPLOADS */}
            {formStep === 3 && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-350">
                    Compliance checklist & KYC Uploads
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Attach copies of corporate identification to activate this customer account ledger.
                  </p>
                </div>

                {/* Checklist File Inputs list */}
                <div className="grid grid-cols-2 gap-3.5">
                  {[
                    { key: "GST", label: "GST Certificate Copy", req: isRegistered },
                    { key: "PAN", label: "PAN Card Copy", req: true },
                    { key: "Cheque", label: "Cancelled Cheque File", req: true },
                    { key: "BalanceSheet", label: "Recent Balance Sheet", req: false },
                    { key: "DirectorPAN", label: "Directors PAN Copy", req: isRegistered },
                  ].map((doc) => {
                    const isUploaded = uploadedKycFiles.some(f => f.startsWith(doc.key));
                    return (
                      <div
                        key={doc.key}
                        className={`p-3 border rounded-xl flex items-center justify-between transition-all ${
                          isUploaded
                            ? "border-emerald-500/30 bg-emerald-500/5"
                            : "border-slate-200 dark:border-[#0d2336] bg-white dark:bg-[#051422]"
                        }`}
                      >
                        <div>
                          <p className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                            <span>{doc.label}</span>
                            {doc.req && (
                              <span className="text-[8px] bg-rose-500/10 text-rose-500 px-1.5 py-0.5 rounded-full font-bold">
                                Required
                              </span>
                            )}
                          </p>
                          <p className="text-[9px] text-slate-400 mt-0.5">
                            {isUploaded ? "✓ Document validated" : "Awaiting attachment"}
                          </p>
                        </div>

                        <label className="p-2 bg-slate-100 hover:bg-primary hover:text-white rounded-lg cursor-pointer transition-all">
                          <FiUploadCloud className="text-sm" />
                          <input
                            type="file"
                            accept=".pdf,.png,.jpg,.jpeg"
                            className="hidden"
                            onChange={(e) => handleFileUpload(e, doc.key)}
                          />
                        </label>
                      </div>
                    );
                  })}
                </div>

                {/* Uploaded attachments preview list */}
                {uploadedKycFiles.length > 0 && (
                  <div className="bg-slate-50 dark:bg-[#071929]/20 border border-slate-200/50 rounded-xl p-3.5">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                      KYC Attachments ({uploadedKycFiles.length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {uploadedKycFiles.map((f, i) => (
                        <div key={i} className="flex items-center gap-1.5 bg-white border border-slate-200 px-2.5 py-1 rounded-lg text-xs font-mono">
                          <FiPaperclip className="text-slate-400" />
                          <span className="truncate max-w-[150px]">{f.split("_").pop()}</span>
                          <button
                            type="button"
                            onClick={() => setUploadedKycFiles(uploadedKycFiles.filter((_, idx) => idx !== i))}
                            className="text-slate-400 hover:text-rose-500 border-none bg-transparent cursor-pointer ml-1"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between border-t border-slate-100 dark:border-[#0d2336] pt-4">
                  <Button variant="outline" type="button" onClick={() => setFormStep(2)}>
                    Back: Form Details
                  </Button>
                  <Button type="button" onClick={handleAddCustomerSubmit}>
                    Save Customer Account
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Convert Customer to Sales Lead Modal */}
      {showConvertModal && selectedConvertCustomer && (
        <Modal
          isOpen={showConvertModal}
          onClose={() => {
            setShowConvertModal(false);
            setSelectedConvertCustomer(null);
          }}
          title="Convert Customer to Sales Lead"
          size="lg"
        >
          <form onSubmit={handleConvertLeadConfirm} className="space-y-4">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-350">
                Sales Workflow Assignment
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Qualify this customer profile and push it as a new Lead into the team sales pipeline.
              </p>
            </div>

            <Input
              label="Lead / Opportunity Title *"
              required
              placeholder="e.g. Sales Lead: Acme Corp Screen purchase"
              value={convertTitle}
              onChange={(e) => setConvertTitle(e.target.value)}
            />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                  Workflow Representative Role *
                </label>
                <select
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-3 pr-8 py-2.5 text-xs text-slate-900 outline-none"
                  value={convertRole}
                  onChange={(e) => setConvertRole(e.target.value as any)}
                >
                  <option value="CEO">CEO</option>
                  <option value="AVP">AVP</option>
                  <option value="Zonal Head">Zonal Head</option>
                  <option value="Area Head">Area Head</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                  Workflow Assigned Agent
                </label>
                <div className="w-full border border-slate-200 bg-slate-100 rounded-xl px-3.5 py-2.5 text-xs text-slate-500 font-semibold select-none">
                  {roleAgents[convertRole]}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Lead Description / Context
              </label>
              <textarea
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs text-slate-900 outline-none min-h-[100px]"
                value={convertDesc}
                onChange={(e) => setConvertDesc(e.target.value)}
              />
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-150 text-[10px] text-slate-400 leading-normal font-sans font-medium">
              Sales workflow tree: <span className="font-bold text-slate-700">CEO</span> → <span className="font-bold text-slate-700">AVP</span> → <span className="font-bold text-slate-700">Zonal Head</span> → <span className="font-bold text-slate-700">Area Head</span>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-150">
              <Button
                variant="outline"
                type="button"
                onClick={() => {
                  setShowConvertModal(false);
                  setSelectedConvertCustomer(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" loading={convertingLead}>
                Confirm Conversion to Lead
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Dynamic Invoice / Bill Creator Builder Modal */}
      {showInvoiceModal && invoiceCustomer && (
        <Modal
          isOpen={showInvoiceModal}
          onClose={() => {
            setShowInvoiceModal(false);
            setInvoiceCustomer(null);
          }}
          title={`Generate Bill: ${invoiceCustomer.name}`}
          size="xl"
        >
          <div className="space-y-5">
            {/* Header info detailing format */}
            <div className="p-3 rounded-xl border flex items-center justify-between bg-slate-50/50">
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Invoice Format</p>
                <h4 className="text-xs font-bold text-slate-800">
                  {invoiceCustomer.isRegistered ? "GST Tax Invoice Form" : "Retail Invoice / Bill of Supply"}
                </h4>
              </div>
              <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                invoiceCustomer.isRegistered ? "bg-emerald-500/10 text-emerald-700" : "bg-amber-500/10 text-amber-700"
              }`}>
                {invoiceCustomer.isRegistered ? "GST Enabled" : "No Tax Credit"}
              </span>
            </div>

            {/* Billing items list */}
            <div className="space-y-3">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                  Billing Items Ledger
                </h4>
                <Button variant="outline" size="sm" onClick={addInvoiceRow} icon={<FiPlus />}>
                  Add Item Row
                </Button>
              </div>

              <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                {invoiceItems.map((item, index) => (
                  <div key={index} className="grid grid-cols-12 gap-3 items-end bg-slate-50/30 p-2.5 rounded-xl border border-slate-200/50">
                    <div className="col-span-5">
                      <Input
                        label="Item Description"
                        placeholder="e.g. 75 Inch Interactive screen"
                        value={item.description}
                        onChange={(e) => updateInvoiceItem(index, { description: e.target.value })}
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        label="Qty"
                        type="number"
                        placeholder="1"
                        value={item.qty}
                        onChange={(e) => updateInvoiceItem(index, { qty: Number(e.target.value) || 1 })}
                      />
                    </div>
                    <div className="col-span-3">
                      <Input
                        label="Unit Price"
                        type="number"
                        placeholder="0.00"
                        value={item.price}
                        onChange={(e) => updateInvoiceItem(index, { price: Number(e.target.value) || 0 })}
                      />
                    </div>
                    
                    {invoiceCustomer.isRegistered ? (
                      <div className="col-span-2 space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          GST %
                        </label>
                        <select
                          className="w-full rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none"
                          value={item.gstRate}
                          onChange={(e) => updateInvoiceItem(index, { gstRate: Number(e.target.value) })}
                        >
                          <option value="0">0%</option>
                          <option value="5">5%</option>
                          <option value="12">12%</option>
                          <option value="18">18%</option>
                        </select>
                      </div>
                    ) : (
                      <div className="col-span-2 pb-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => removeInvoiceRow(index)}
                          className="p-2 text-slate-400 hover:text-rose-500 bg-transparent border-none cursor-pointer"
                          disabled={invoiceItems.length === 1}
                        >
                          <FiTrash2 className="text-sm" />
                        </button>
                      </div>
                    )}

                    {invoiceCustomer.isRegistered && (
                      <div className="col-span-12 flex justify-end gap-3 pt-1 border-t border-dashed border-slate-200">
                        <span className="text-[10px] text-slate-400 font-semibold">
                          Line Total: ${(item.qty * item.price).toLocaleString()}
                        </span>
                        <span className="text-[10px] text-slate-400 font-semibold">
                          Tax (${item.gstRate}%): ${((item.qty * item.price * item.gstRate) / 100).toLocaleString()}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeInvoiceRow(index)}
                          className="text-rose-500 hover:underline border-none bg-transparent cursor-pointer text-[10px]"
                          disabled={invoiceItems.length === 1}
                        >
                          Remove Line
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <Button
                variant="outline"
                type="button"
                onClick={() => {
                  setShowInvoiceModal(false);
                  setInvoiceCustomer(null);
                }}
              >
                Cancel
              </Button>
              <Button onClick={generateInvoiceBill}>
                Generate Invoice Receipt
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Print / Printable Invoice Receipt Modal Preview */}
      {showPrintModal && printedInvoice && (
        <Modal
          isOpen={showPrintModal}
          onClose={() => {
            setShowPrintModal(false);
            setPrintedInvoice(null);
          }}
          title="Printable Invoice Receipt Preview"
          size="xl"
        >
          <div className="space-y-6">
            
            {/* The printable invoice canvas card */}
            <div className="p-8 bg-white border border-slate-300 rounded-xl shadow-sm text-slate-900 font-serif select-text max-h-[500px] overflow-y-auto print:border-none print:shadow-none" id="printable-area">
              
              {/* Header brand details */}
              <div className="flex justify-between items-start pb-5 border-b-2 border-slate-900">
                <div>
                  <h2 className="text-xl font-bold uppercase tracking-wide">Meridian CRM Pvt Ltd</h2>
                  <p className="text-[10px] font-sans text-slate-500 mt-1 leading-normal">
                    GSTIN: 06AAAAA8899A1Z1 | PAN: AAAAA8899A<br />
                    Headquarters: DLF CyberCity, Gurgaon, India
                  </p>
                </div>
                <div className="text-right">
                  <h3 className="text-lg font-bold uppercase tracking-wider text-slate-800">
                    {printedInvoice.customer.isRegistered ? "TAX INVOICE" : "RETAIL INVOICE"}
                  </h3>
                  <p className="text-xs font-mono font-bold mt-1.5">No: {printedInvoice.invoiceNo}</p>
                  <p className="text-[10px] font-sans text-slate-400 mt-1">Date: {printedInvoice.date}</p>
                </div>
              </div>

              {/* Billing parties */}
              <div className="grid grid-cols-2 gap-6 py-5 text-xs font-sans leading-relaxed border-b border-slate-200">
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                    Billed To:
                  </span>
                  <p className="font-bold text-slate-900 font-serif text-sm">{printedInvoice.customer.name}</p>
                  <p className="text-slate-500 mt-1">
                    Address: {printedInvoice.customer.address}<br />
                    Phone: {printedInvoice.customer.phone} | Email: {printedInvoice.customer.email}
                  </p>
                </div>
                <div className="text-right">
                  {printedInvoice.customer.isRegistered ? (
                    <div className="inline-block text-left">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                        GSTIN Details:
                      </span>
                      <p className="font-mono font-bold text-slate-800">GSTIN: {printedInvoice.customer.gst}</p>
                      <p className="font-mono text-slate-500 mt-0.5">PAN: {printedInvoice.customer.pan}</p>
                    </div>
                  ) : (
                    <div className="inline-block text-left">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                        Customer Details:
                      </span>
                      <p className="font-mono text-slate-800">PAN: {printedInvoice.customer.pan || "N/A"}</p>
                      <p className="text-slate-500 mt-0.5">Status: Unregistered Client</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Items Table Grid */}
              <table className="w-full text-left font-sans text-xs mt-5 border-collapse">
                <thead>
                  <tr className="border-b border-slate-900 font-bold uppercase text-[9px] text-slate-500">
                    <th className="pb-2 w-10 text-center">#</th>
                    <th className="pb-2">Description</th>
                    <th className="pb-2 w-16 text-center">Qty</th>
                    <th className="pb-2 w-24 text-right">Rate ($)</th>
                    {printedInvoice.customer.isRegistered && (
                      <th className="pb-2 w-20 text-center">GST %</th>
                    )}
                    <th className="pb-2 w-28 text-right">Amount ($)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150">
                  {printedInvoice.items.map((item, i) => {
                    const amt = item.qty * item.price;
                    return (
                      <tr key={i} className="hover:bg-slate-50/50">
                        <td className="py-2.5 text-center font-mono">{i + 1}</td>
                        <td className="py-2.5 font-semibold text-slate-900">{item.description}</td>
                        <td className="py-2.5 text-center font-mono">{item.qty}</td>
                        <td className="py-2.5 text-right font-mono">${item.price.toLocaleString()}</td>
                        {printedInvoice.customer.isRegistered && (
                          <td className="py-2.5 text-center font-mono">{item.gstRate}%</td>
                        )}
                        <td className="py-2.5 text-right font-mono font-bold">${amt.toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Calculations Box */}
              <div className="flex justify-end pt-5 mt-5 border-t border-slate-200">
                <div className="w-80 space-y-2 text-xs font-sans">
                  
                  <div className="flex justify-between text-slate-500 font-medium">
                    <span>Taxable Subtotal</span>
                    <span className="font-mono font-bold">${printedInvoice.subTotal.toLocaleString()}</span>
                  </div>

                  {printedInvoice.customer.isRegistered ? (
                    <>
                      {/* Split GST dynamically for Indian corporate rules: CGST + SGST (9%+9% for 18% GST) */}
                      <div className="flex justify-between text-slate-500">
                        <span>Central GST (CGST)</span>
                        <span className="font-mono">${(printedInvoice.gstTotal / 2).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-slate-500">
                        <span>State GST (SGST)</span>
                        <span className="font-mono">${(printedInvoice.gstTotal / 2).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-slate-800 font-bold border-t border-slate-100 pt-1">
                        <span>Total Tax Amount</span>
                        <span className="font-mono">${printedInvoice.gstTotal.toLocaleString()}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between text-slate-500 italic">
                      <span>GST Component</span>
                      <span>No Tax Included (Retail Bill)</span>
                    </div>
                  )}

                  <div className="flex justify-between text-base font-bold text-slate-900 border-t-2 border-slate-900 pt-2 font-serif">
                    <span>Grand Total</span>
                    <span className="font-mono">${printedInvoice.grandTotal.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Terms and Sign-off */}
              <div className="grid grid-cols-2 gap-4 mt-8 pt-8 border-t border-slate-200 text-[10px] font-sans leading-normal">
                <div>
                  <h5 className="font-bold text-slate-800 uppercase tracking-wider mb-1">Terms & Conditions</h5>
                  <p className="text-slate-500">
                    1. Interest @18% p.a. will be charged for delayed payment beyond 15 days.<br />
                    2. All disputes are subject to local judicial jurisdictions only.
                  </p>
                </div>
                <div className="flex flex-col items-end justify-end">
                  <div className="h-10"></div>
                  <div className="border-t border-slate-800 w-44 text-center pt-1 font-bold text-slate-800">
                    Authorized Signatory
                  </div>
                </div>
              </div>

            </div>

            {/* Print actions */}
            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <Button
                variant="outline"
                onClick={() => {
                  setShowPrintModal(false);
                  setPrintedInvoice(null);
                }}
              >
                Close Preview
              </Button>
              <Button
                onClick={() => {
                  window.print();
                }}
                icon={<FiPrinter />}
              >
                Print Document
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
