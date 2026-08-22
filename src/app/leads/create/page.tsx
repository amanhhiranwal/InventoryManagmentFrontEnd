"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import api from "@/lib/axios";
import { useUIStore } from "@/lib/store/ui.store";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { getUsersApi, User } from "@/features/users/api/users.api";
import { createLeadApi } from "@/features/workflows/api/workflows.api";
import {
  FiInfo,
  FiMapPin,
  FiShield,
  FiUser,
  FiFileText,
  FiUploadCloud,
  FiArrowLeft,
  FiCheckCircle,
  FiPaperclip
} from "react-icons/fi";
import { CgSpinner } from "react-icons/cg";

export default function CreateLeadPage() {
  const router = useRouter();
  const { addToast } = useUIStore();

  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Customer Information
  const [customerType, setCustomerType] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [organizationWebsite, setOrganizationWebsite] = useState("");

  // Organization Details
  const [officeAddress, setOfficeAddress] = useState("");
  const [city, setCity] = useState("");
  const [stateProvince, setStateProvince] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [country, setCountry] = useState("India");

  // Registration & Compliance
  const [gstNumber, setGstNumber] = useState("");
  const [panNumber, setPanNumber] = useState("");
  const [coiNumber, setCoiNumber] = useState("");
  const [gstDoc, setGstDoc] = useState<string | null>(null);
  const [panDoc, setPanDoc] = useState<string | null>(null);
  const [coiDoc, setCoiDoc] = useState<string | null>(null);

  // Sales Information
  const [leadSource, setLeadSource] = useState("");
  const [assignedToId, setAssignedToId] = useState("");
  const [leadSources, setLeadSources] = useState<{ id: string; name: string }[]>([]);

  // Requirements & Files
  const [remarks, setRemarks] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);

  const fetchUsersList = useCallback(async () => {
    try {
      setLoadingUsers(true);
      const res = await getUsersApi();
      const uData = res.data || [];
      setUsers(uData);
      if (uData.length > 0) {
        setAssignedToId(uData[0].id);
      }
    } catch (err) {
      console.error("Failed to load users:", err);
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  const fetchLeadSources = useCallback(async () => {
    try {
      const res = await api.get("/api/v1/lead-sources");
      if (res.data?.success) {
        setLeadSources(res.data.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch backend lead sources:", err);
    }
  }, []);

  useEffect(() => {
    fetchUsersList();
    fetchLeadSources();
  }, [fetchUsersList, fetchLeadSources]);

  const handleFileUpload = (type: "gst" | "pan" | "coi", e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (type === "gst") setGstDoc(file.name);
    if (type === "pan") setPanDoc(file.name);
    if (type === "coi") setCoiDoc(file.name);
    addToast(`${file.name} attached for ${type.toUpperCase()}`, "success");
  };

  const handleAttachmentsDrop = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setAttachments((prev) => [...prev, ...files]);
      addToast(`${files.length} file(s) attached.`, "success");
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      addToast("Customer Name is required.", "warning");
      return;
    }
    if (!organizationName.trim()) {
      addToast("Organization Name is required.", "warning");
      return;
    }

    try {
      setSubmitting(true);

      const combinedDetails = [
        `Contact Name: ${customerName.trim()}`,
        `Email: ${customerName.toLowerCase().replace(/\s+/g, ".")}@${(organizationWebsite || "company.com").replace(/^https?:\/\//, "")}`,
        `Organization: ${organizationName.trim()}`,
        `Type: ${customerType || "Standard"}`,
        `Address: ${officeAddress || "N/A"}, ${city || "N/A"}, ${stateProvince || "N/A"} ${zipCode || ""} ${country || "India"}`.trim(),
        `GST: ${gstNumber || "N/A"} | PAN: ${panNumber || "N/A"} | COI: ${coiNumber || "N/A"}`,
        `Lead Source: ${leadSource || "Direct Inbound"}`
      ].join(" | ");

      await createLeadApi({
        title: `${customerName.trim()} (${organizationName.trim()})`,
        description: combinedDetails,
        status: "new",
        assigned_to_id: assignedToId || undefined
      });

      addToast("New lead registered successfully!", "success");
      router.push("/leads");
    } catch (err) {
      console.error(err);
      addToast("Failed to register new lead.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedAssignedUser = users.find((u) => u.id === assignedToId);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 select-none">
      {/* Top Header & Breadcrumbs */}
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
          <Link href="/leads" className="hover:text-primary transition-colors">
            Leads
          </Link>
          <span>&gt;</span>
          <span className="text-slate-800 dark:text-white font-bold">New</span>
        </div>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            New Lead
          </h1>
          <Link
            href="/leads"
            className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 px-3 py-1.5 rounded-xl transition-all border border-slate-200 dark:border-[#0d2336]"
          >
            <FiArrowLeft className="text-sm" />
            <span>Back to Leads</span>
          </Link>
        </div>
      </div>

      <form onSubmit={handleFormSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Customer Info, Address & Compliance (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Card 1: Customer Information */}
          <div className="bg-white dark:bg-[#051422] rounded-2xl border border-slate-200/80 dark:border-[#0d2336] p-6 shadow-sm space-y-5">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-[#0d2336]/60">
              <FiInfo className="text-slate-600 dark:text-slate-400 text-lg" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                Customer Information
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                  Customer Type *
                </label>
                <select
                  value={customerType}
                  onChange={(e) => setCustomerType(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-50/70 dark:bg-[#071929] px-3.5 py-2 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
                >
                  <option value="">Select the customer type</option>
                  <option value="Distributor">Distributor</option>
                  <option value="Retailer">Retailer</option>
                  <option value="Enterprise">Enterprise</option>
                  <option value="OEM">OEM Client</option>
                  <option value="Direct">Direct Customer</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                  Customer Name *
                </label>
                <Input
                  placeholder="Enter name here"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                  Organization Name *
                </label>
                <Input
                  placeholder="Enter name here"
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                  Organization Website *
                </label>
                <Input
                  placeholder="www.company.com"
                  value={organizationWebsite}
                  onChange={(e) => setOrganizationWebsite(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Card 2: Organization Details */}
          <div className="bg-white dark:bg-[#051422] rounded-2xl border border-slate-200/80 dark:border-[#0d2336] p-6 shadow-sm space-y-5">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-[#0d2336]/60">
              <FiMapPin className="text-slate-600 dark:text-slate-400 text-lg" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                Organization Details
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                  Office Address *
                </label>
                <Input
                  placeholder="Street Address, Building, Suite"
                  value={officeAddress}
                  onChange={(e) => setOfficeAddress(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                  City *
                </label>
                <Input
                  placeholder="Street Address, Building, Suite"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                  State / Province *
                </label>
                <Input
                  placeholder="State"
                  value={stateProvince}
                  onChange={(e) => setStateProvince(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                  PIN / ZIP Code *
                </label>
                <Input
                  placeholder="Pin Code"
                  value={zipCode}
                  onChange={(e) => setZipCode(e.target.value)}
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                  Country *
                </label>
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full sm:w-1/2 rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-50/70 dark:bg-[#071929] px-3.5 py-2 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
                >
                  <option value="India">India</option>
                  <option value="United States">United States</option>
                  <option value="United Arab Emirates">United Arab Emirates</option>
                  <option value="Singapore">Singapore</option>
                  <option value="Others">Others</option>
                </select>
              </div>
            </div>
          </div>

          {/* Card 3: Registration & Compliance */}
          <div className="bg-white dark:bg-[#051422] rounded-2xl border border-slate-200/80 dark:border-[#0d2336] p-6 shadow-sm space-y-5">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-[#0d2336]/60">
              <FiShield className="text-slate-600 dark:text-slate-400 text-lg" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                Registration & Compliance
              </h3>
            </div>

            <div className="space-y-4">
              {/* GST Row */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                <div className="sm:col-span-8">
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    GST Number
                  </label>
                  <Input
                    placeholder="Enter GSTIN"
                    value={gstNumber}
                    onChange={(e) => setGstNumber(e.target.value)}
                  />
                </div>
                <div className="sm:col-span-4 pt-4 sm:pt-5">
                  <label className="flex items-center justify-center gap-2 px-3 py-2 border-2 border-dashed border-slate-200 dark:border-[#0d2336] rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#071929] cursor-pointer transition-all">
                    <FiUploadCloud className="text-sm text-slate-400" />
                    <span>{gstDoc ? gstDoc.slice(0, 12) + "..." : "Upload Doc"}</span>
                    <input type="file" className="hidden" onChange={(e) => handleFileUpload("gst", e)} />
                  </label>
                </div>
              </div>

              {/* PAN Row */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                <div className="sm:col-span-8">
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    PAN Number
                  </label>
                  <Input
                    placeholder="Enter PAN"
                    value={panNumber}
                    onChange={(e) => setPanNumber(e.target.value)}
                  />
                </div>
                <div className="sm:col-span-4 pt-4 sm:pt-5">
                  <label className="flex items-center justify-center gap-2 px-3 py-2 border-2 border-dashed border-slate-200 dark:border-[#0d2336] rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#071929] cursor-pointer transition-all">
                    <FiUploadCloud className="text-sm text-slate-400" />
                    <span>{panDoc ? panDoc.slice(0, 12) + "..." : "Upload Doc"}</span>
                    <input type="file" className="hidden" onChange={(e) => handleFileUpload("pan", e)} />
                  </label>
                </div>
              </div>

              {/* COI Row */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                <div className="sm:col-span-8">
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    COI (Certificate of Incorporation)
                  </label>
                  <Input
                    placeholder="COI Number"
                    value={coiNumber}
                    onChange={(e) => setCoiNumber(e.target.value)}
                  />
                </div>
                <div className="sm:col-span-4 pt-4 sm:pt-5">
                  <label className="flex items-center justify-center gap-2 px-3 py-2 border-2 border-dashed border-slate-200 dark:border-[#0d2336] rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#071929] cursor-pointer transition-all">
                    <FiUploadCloud className="text-sm text-slate-400" />
                    <span>{coiDoc ? coiDoc.slice(0, 12) + "..." : "Upload Doc"}</span>
                    <input type="file" className="hidden" onChange={(e) => handleFileUpload("coi", e)} />
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Sales Info & Requirements (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Card 1: Sales Information */}
          <div className="bg-white dark:bg-[#051422] rounded-2xl border border-slate-200/80 dark:border-[#0d2336] p-6 shadow-sm space-y-5">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-[#0d2336]/60">
              <FiUser className="text-slate-600 dark:text-slate-400 text-lg" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                Sales Information
              </h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                  Lead Source *
                </label>
                <select
                  value={leadSource}
                  onChange={(e) => setLeadSource(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-50/70 dark:bg-[#071929] px-3.5 py-2 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
                >
                  <option value="">Select here</option>
                  {leadSources.map((ls) => (
                    <option key={ls.id} value={ls.name}>
                      {ls.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                  Assigned to *
                </label>
                <select
                  value={assignedToId}
                  onChange={(e) => setAssignedToId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-50/70 dark:bg-[#071929] px-3.5 py-2 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.first_name} {u.last_name || ""}
                    </option>
                  ))}
                </select>

                {selectedAssignedUser && (
                  <div className="mt-2.5 flex items-center gap-2 p-2 rounded-xl bg-slate-100 dark:bg-[#071929] border border-slate-200/50 dark:border-[#0d2336]">
                    <div className="w-6 h-6 rounded-full bg-[#233353] text-white flex items-center justify-center text-[10px] font-bold">
                      {selectedAssignedUser.first_name[0]}
                    </div>
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                      {selectedAssignedUser.first_name} {selectedAssignedUser.last_name}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Card 2: Requirements & Files */}
          <div className="bg-white dark:bg-[#051422] rounded-2xl border border-slate-200/80 dark:border-[#0d2336] p-6 shadow-sm space-y-5">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-[#0d2336]/60">
              <FiFileText className="text-slate-600 dark:text-slate-400 text-lg" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                Requirements & Files
              </h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                  Remarks
                </label>
                <textarea
                  rows={4}
                  placeholder="Enter specific hardware requirements or customization requests..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-50/70 dark:bg-[#071929] p-3 text-xs text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                  Attachments
                </label>
                <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 dark:border-[#0d2336] rounded-2xl bg-slate-50/50 dark:bg-[#071929]/50 hover:bg-slate-100/50 cursor-pointer transition-all text-center">
                  <FiPaperclip className="text-2xl text-slate-400 mb-2" />
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    Drop files or click to upload
                  </span>
                  <span className="text-[10px] text-slate-400 mt-1">
                    PDF, DOC, XLS up to 10MB
                  </span>
                  <input type="file" multiple className="hidden" onChange={handleAttachmentsDrop} />
                </label>

                {attachments.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {attachments.map((f, i) => (
                      <div key={i} className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                        <FiCheckCircle className="text-emerald-500 text-xs" />
                        <span>{f.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Form Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <Link
              href="/leads"
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-[#0d2336] text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
            >
              Cancel
            </Link>
            <Button type="submit" disabled={submitting} className="px-6 py-2">
              {submitting ? (
                <span className="flex items-center gap-2">
                  <CgSpinner className="animate-spin text-base" />
                  <span>Saving...</span>
                </span>
              ) : (
                <span>Save & Create Lead</span>
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
