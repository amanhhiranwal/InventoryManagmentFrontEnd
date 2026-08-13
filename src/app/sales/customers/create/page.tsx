"use client";

import { useState } from "react";
import api from "@/lib/axios";
import { useRouter } from "next/navigation";
import { useUIStore } from "@/lib/store/ui.store";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import {
  FiArrowLeft,
  FiUploadCloud,
  FiPlus,
  FiTrash2,
  FiUser,
  FiHome,
  FiSave
} from "react-icons/fi";

interface ServingCompany {
  id: string;
  nameAndYear: string;
  maxCredit: number;
  creditDays: number;
  turnover: number;
}

export default function CreateCustomerPage() {
  const router = useRouter();
  const { addToast } = useUIStore();

  // Step state
  const [submitting, setSubmitting] = useState(false);

  // --- Profile Images ---
  const [userImage, setUserImage] = useState<string | null>(null);
  const [shopImage, setShopImage] = useState<string | null>(null);

  // --- Page 1: Basic Firm Details ---
  const [firmName1, setFirmName1] = useState("");
  const [firmName2, setFirmName2] = useState("");
  const [address1, setAddress1] = useState("");
  const [address2, setAddress2] = useState("");
  const [address3, setAddress3] = useState("");
  const [region, setRegion] = useState("");
  const [subRegion, setSubRegion] = useState("");
  const [territory, setTerritory] = useState("");
  const [warehouse, setWarehouse] = useState("");
  const [district, setDistrict] = useState("");
  const [pincode, setPincode] = useState("");
  const [mobileNo, setMobileNo] = useState("");
  const [email, setEmail] = useState("");

  // --- Page 2: Operational Data ---
  const [distanceHQ, setDistanceHQ] = useState("");
  const [statusOfFeed, setStatusOfFeed] = useState("Proprietorship"); // Proprietorship, Partnership, Company, Co-operative Society

  // --- Segment-wise Turnover (Fertilizer, Pesticide, Seed, Other) ---
  const [turnoverData, setTurnoverData] = useState({
    fertilizer: { wholesale: 0, retail: 0 },
    pesticide: { wholesale: 0, retail: 0 },
    seed: { wholesale: 0, retail: 0 },
    other: { wholesale: 0, retail: 0 },
  });

  const handleTurnoverChange = (row: keyof typeof turnoverData, col: "wholesale" | "retail", val: string) => {
    const num = parseFloat(val) || 0;
    setTurnoverData((prev) => ({
      ...prev,
      [row]: { ...prev[row], [col]: num },
    }));
  };

  // --- GST Type & License Registrations ---
  const [gstType, setGstType] = useState<"REGISTERED" | "UNREGISTERED">("REGISTERED");
  const [gstDetails, setGstDetails] = useState("");
  const [gstFile, setGstFile] = useState<string | null>(null);
  const [panNumber, setPanNumber] = useState("");
  const [panFile, setPanFile] = useState<string | null>(null);
  const [dateOfEstablishment, setDateOfEstablishment] = useState("");
  const [registrationNoOfFirm, setRegistrationNoOfFirm] = useState("");
  const [pesticideLicenseNo, setPesticideLicenseNo] = useState("");
  const [pesticideLicenseFile, setPesticideLicenseFile] = useState<string | null>(null);
  const [fertilizerLicenseNo, setFertilizerLicenseNo] = useState("");
  const [fertilizerLicenseFile, setFertilizerLicenseFile] = useState<string | null>(null);

  // --- Bank details ---
  const [bankAccountNo, setBankAccountNo] = useState("");
  const [bankAccountFile, setBankAccountFile] = useState<string | null>(null);
  const [ifscCode, setIfscCode] = useState("");
  const [bankersName, setBankersName] = useState("");
  const [bankersAddress, setBankersAddress] = useState("");
  const [chequeAuthName, setChequeAuthName] = useState("");

  // --- Infrastructure Details ---
  const [noOfGodown, setNoOfGodown] = useState("");
  const [sizeSqFt, setSizeSqFt] = useState("");
  const [godownOwnership, setGodownOwnership] = useState<"SELF" | "RENTED">("SELF");
  const [godownElectricityFile, setGodownElectricityFile] = useState<string | null>(null);
  const [godownWaterFile, setGodownWaterFile] = useState<string | null>(null);

  const [noOfRetailOutlets, setNoOfRetailOutlets] = useState("");
  const [outletsOwnership, setOutletsOwnership] = useState<"SELF" | "RENTED">("SELF");
  const [outletsElectricityFile, setOutletsElectricityFile] = useState<string | null>(null);
  const [outletsWaterFile, setOutletsWaterFile] = useState<string | null>(null);

  // --- Serving Companies list ---
  const [servingCompanies, setServingCompanies] = useState<ServingCompany[]>([
    { id: "1", nameAndYear: "", maxCredit: 0, creditDays: 0, turnover: 0 }
  ]);

  const addServingCompanyRow = () => {
    setServingCompanies([
      ...servingCompanies,
      { id: Date.now().toString(), nameAndYear: "", maxCredit: 0, creditDays: 0, turnover: 0 }
    ]);
  };

  const removeServingCompanyRow = (id: string) => {
    if (servingCompanies.length === 1) return;
    setServingCompanies(servingCompanies.filter((item) => item.id !== id));
  };

  const handleServingCompanyChange = (id: string, field: keyof ServingCompany, val: any) => {
    setServingCompanies(
      servingCompanies.map((item) =>
        item.id === id ? { ...item, [field]: val } : item
      )
    );
  };

  // --- Details of Security Deposit ---
  const [secChequeNo, setSecChequeNo] = useState("");
  const [secDateOfIssue, setSecDateOfIssue] = useState("");
  const [secAmount, setSecAmount] = useState("");
  const [secBankDrawn, setSecBankDrawn] = useState("");

  // --- Targets ---
  const [targetCurrentYear, setTargetCurrentYear] = useState("");
  const [targetNextYear, setTargetNextYear] = useState("");
  const [insecticidesLicenseFile, setInsecticidesLicenseFile] = useState<string | null>(null);

  // --- Page 4: KYC Upload Checklist ---
  const [fileBalSheet, setFileBalSheet] = useState<string | null>(null);
  const [fileITR, setFileITR] = useState<string | null>(null);
  const [fileResidence, setFileResidence] = useState<string | null>(null);
  const [filePhotoId, setFilePhotoId] = useState<string | null>(null);
  const [fileKYCPartners, setFileKYCPartners] = useState<string | null>(null);
  const [fileDeedOrMoA, setFileDeedOrMoA] = useState<string | null>(null);
  const [fileChequesAndLetterhead, setFileChequesAndLetterhead] = useState<string | null>(null);
  const [fileBankStatement, setFileBankStatement] = useState<string | null>(null);
  const [fileDirectorSign, setFileDirectorSign] = useState<string | null>(null);

  // Helper file uploader simulator
  const handleSimulatedUpload = (e: React.ChangeEvent<HTMLInputElement>, setter: (name: string) => void) => {
    const file = e.target.files?.[0];
    if (file) {
      setter(file.name);
      addToast(`Document '${file.name}' attached successfully.`, "success");
    }
  };

  const handleSaveDistributor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firmName1.trim()) {
      addToast("Name of Firm 1 is required.", "warning");
      return;
    }
    if (!mobileNo.trim() || !email.trim()) {
      addToast("Contact credentials (Mobile and Email) are required.", "warning");
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.post("/api/v1/customers/", {
        name: firmName1.trim(),
        email: email.trim(),
        phone: mobileNo.trim(),
        address: (address1 + " " + address2 + " " + address3).trim(),
        gst: gstDetails.trim(),
        pan: panNumber.trim(),
        category: "Agriculture Distributor",
        isRegistered: gstType === "REGISTERED",
        kycDocs: [
          gstFile,
          panFile,
          pesticideLicenseFile,
          fertilizerLicenseFile,
          bankAccountFile,
          godownElectricityFile,
          godownWaterFile,
          outletsElectricityFile,
          outletsWaterFile,
          insecticidesLicenseFile,
          fileBalSheet,
          fileITR,
          fileResidence,
          filePhotoId,
          fileKYCPartners,
          fileDeedOrMoA,
          fileChequesAndLetterhead,
          fileBankStatement,
          fileDirectorSign
        ].filter(Boolean) as string[]
      });
      if (res.data?.success) {
        // Create lead automatically
        try {
          await api.post("/api/v1/leads/", {
            title: firmName1.trim(),
            description: "Customer Profile Lead: " + firmName1.trim(),
            status: "active"
          });
        } catch (leadErr) {
          console.error("Failed to auto-create lead:", leadErr);
        }
        addToast("Customer/Distributor " + firmName1 + " registered and added as a lead successfully!", "success");
        router.push("/sales/customers");
      }
    } catch (err: any) {
      console.error(err);
      addToast(err.response?.data?.detail || "Failed to register customer distributor profile.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Calculations Turnover Segment Wise
  const fertTotal = turnoverData.fertilizer.wholesale + turnoverData.fertilizer.retail;
  const pestTotal = turnoverData.pesticide.wholesale + turnoverData.pesticide.retail;
  const seedTotal = turnoverData.seed.wholesale + turnoverData.seed.retail;
  const otherTotal = turnoverData.other.wholesale + turnoverData.other.retail;

  const totalWholesale = turnoverData.fertilizer.wholesale + turnoverData.pesticide.wholesale + turnoverData.seed.wholesale + turnoverData.other.wholesale;
  const totalRetail = turnoverData.fertilizer.retail + turnoverData.pesticide.retail + turnoverData.seed.retail + turnoverData.other.retail;
  const grandTotalTurnover = fertTotal + pestTotal + seedTotal + otherTotal;

  // Companies turnover pesticide calculation
  const totalServingTurnover = servingCompanies.reduce((acc, curr) => acc + (curr.turnover || 0), 0);

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={() => router.push("/sales/customers")} className="!p-2.5 rounded-xl">
          <FiArrowLeft className="text-sm" />
        </Button>
        <PageHeader
          title="Create Single Record"
          description="Register a new customer distributor profile with complete KYC and infrastructure documentation."
        />
      </div>

      <div className="bg-white dark:bg-[#051422] rounded-2xl border border-slate-200/50 dark:border-[#0d2336] shadow-sm">
        {/* Header Title with minimize symbol */}
        <div className="flex justify-between items-center px-6 py-4.5 border-b border-slate-100 dark:border-[#0d2336]/40">
          <h3 className="text-sm font-bold text-slate-450 dark:text-slate-300 uppercase tracking-wider font-sans">
            Create Distributor
          </h3>
          <span className="w-4.5 h-1 bg-slate-300 rounded-full cursor-pointer hover:bg-slate-500" />
        </div>

        <form onSubmit={handleSaveDistributor} className="p-6 space-y-8">
          
          {/* USER & SHOP IMAGES SECTION */}
          <div className="flex flex-wrap gap-8 items-center border-b border-slate-100 dark:border-[#0d2336]/30 pb-6">
            {/* User Image Slot */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                Upload user image
              </span>
              <div className="relative group w-28 h-28 border border-slate-200 dark:border-[#0d2336] rounded-xl flex items-center justify-center bg-slate-50 dark:bg-slate-900 overflow-hidden shadow-inner">
                {userImage ? (
                  <span className="text-xs font-mono font-semibold text-slate-500 text-center px-2 truncate">{userImage}</span>
                ) : (
                  <div className="text-center space-y-1">
                    <FiUser className="text-3xl text-slate-300 mx-auto" />
                    <span className="text-[9px] text-slate-400 font-bold block">No photo</span>
                  </div>
                )}
                <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-all">
                  <FiUploadCloud className="text-white text-lg" />
                  <input type="file" className="hidden" onChange={(e) => handleSimulatedUpload(e, setUserImage)} />
                </label>
              </div>
            </div>

            {/* Shop Image Slot */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                Upload shop image
              </span>
              <div className="relative group w-28 h-28 border border-slate-200 dark:border-[#0d2336] rounded-xl flex items-center justify-center bg-slate-50 dark:bg-slate-900 overflow-hidden shadow-inner">
                {shopImage ? (
                  <span className="text-xs font-mono font-semibold text-slate-500 text-center px-2 truncate">{shopImage}</span>
                ) : (
                  <div className="text-center space-y-1">
                    <FiHome className="text-3xl text-slate-300 mx-auto" />
                    <span className="text-[9px] text-slate-400 font-bold block">No photo</span>
                  </div>
                )}
                <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-all">
                  <FiUploadCloud className="text-white text-lg" />
                  <input type="file" className="hidden" onChange={(e) => handleSimulatedUpload(e, setShopImage)} />
                </label>
              </div>
            </div>
          </div>

          {/* PAGE 1: BASIC FIRM IDENTITY DETAILS */}
          <div className="space-y-4">
            <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-primary border-l-2 border-primary pl-2 mb-2">
              Firm Specifications
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Name of Firm 1 *"
                required
                placeholder="Name of Firm 1"
                value={firmName1}
                onChange={(e) => setFirmName1(e.target.value)}
              />
              <Input
                label="Name of Firm 2"
                placeholder="Name of Firm 2"
                value={firmName2}
                onChange={(e) => setFirmName2(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label="Address 1 *"
                required
                placeholder="Address 1"
                value={address1}
                onChange={(e) => setAddress1(e.target.value)}
              />
              <Input
                label="Address 2"
                placeholder="Address 2"
                value={address2}
                onChange={(e) => setAddress2(e.target.value)}
              />
              <Input
                label="Address 3"
                placeholder="Address 3"
                value={address3}
                onChange={(e) => setAddress3(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Region</label>
                <select
                  className="w-full rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-50/50 dark:bg-[#071929]/50 px-3.5 py-2.5 text-xs text-slate-900 dark:text-white outline-none"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                >
                  <option value="">Select Region</option>
                  <option value="North">North Zone</option>
                  <option value="West">West Zone</option>
                  <option value="Center">Center Zone</option>
                  <option value="South">South Zone</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Sub-Region</label>
                <select
                  className="w-full rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-50/50 dark:bg-[#071929]/50 px-3.5 py-2.5 text-xs text-slate-900 dark:text-white outline-none"
                  value={subRegion}
                  onChange={(e) => setSubRegion(e.target.value)}
                >
                  <option value="">Select Sub-Region</option>
                  <option value="Zone A">Zone A</option>
                  <option value="Zone B">Zone B</option>
                  <option value="Zone C">Zone C</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Territory</label>
                <select
                  className="w-full rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-50/50 dark:bg-[#071929]/50 px-3.5 py-2.5 text-xs text-slate-900 dark:text-white outline-none"
                  value={territory}
                  onChange={(e) => setTerritory(e.target.value)}
                >
                  <option value="">Select Territory</option>
                  <option value="Area 1">Area 1</option>
                  <option value="Area 2">Area 2</option>
                  <option value="Area 3">Area 3</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Ware-Houses</label>
                <select
                  className="w-full rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-50/50 dark:bg-[#071929]/50 px-3.5 py-2.5 text-xs text-slate-900 dark:text-white outline-none"
                  value={warehouse}
                  onChange={(e) => setWarehouse(e.target.value)}
                >
                  <option value="">Select Ware-House</option>
                  <option value="HQ Warehouse">HQ Warehouse</option>
                  <option value="Zonal Repository">Zonal Repository</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="md:col-span-2">
                <Input
                  label="District"
                  placeholder="District"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                />
              </div>
              <Input
                label="Pincode"
                placeholder="Pincode"
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
              />
              <Input
                label="Mobile No. *"
                required
                placeholder="Mobile No."
                value={mobileNo}
                onChange={(e) => setMobileNo(e.target.value)}
              />
              <Input
                label="Email *"
                required
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          {/* PAGE 2: SEGMENT TURNOVER & COMPLIANCE LICENSES */}
          <div className="space-y-6 pt-4 border-t border-slate-100 dark:border-[#0d2336]/30">
            <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-primary border-l-2 border-primary pl-2">
              Turnover & Registrations
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
              <Input
                label="Distance From H.Q."
                placeholder="Distance From H.Q."
                value={distanceHQ}
                onChange={(e) => setDistanceHQ(e.target.value)}
              />

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">Status of Feed</label>
                <div className="flex flex-wrap gap-4 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {["Proprietorship", "Partnership", "Company", "Co-operative Society"].map((item) => (
                    <label key={item} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="statusOfFeed"
                        checked={statusOfFeed === item}
                        onChange={() => setStatusOfFeed(item)}
                      />
                      <span>{item}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Turnover Matrix Table */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                Sales Turnover-Segment Wise (For Last Year) In Lakh:
              </label>
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-[#0d2336]/50">
                <table className="w-full text-xs text-left border-collapse font-sans">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-[#0d2336] text-[10px] font-extrabold uppercase text-slate-500">
                      <th className="p-3">Product</th>
                      <th className="p-3">Wholesale</th>
                      <th className="p-3">Retail</th>
                      <th className="p-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-[#0d2336]/35 font-semibold text-slate-700 dark:text-slate-200">
                    {[
                      { key: "fertilizer", label: "Fertilizer" },
                      { key: "pesticide", label: "Pesticide" },
                      { key: "seed", label: "Seed" },
                      { key: "other", label: "Other" },
                    ].map((row) => {
                      const rKey = row.key as keyof typeof turnoverData;
                      const lineTotal = turnoverData[rKey].wholesale + turnoverData[rKey].retail;
                      return (
                        <tr key={row.key} className="hover:bg-slate-50/20">
                          <td className="p-3 font-bold">{row.label}</td>
                          <td className="p-2">
                            <input
                              type="number"
                              className="w-full bg-slate-50/60 dark:bg-slate-900 border border-slate-200 dark:border-[#0d2336]/40 rounded-lg px-2.5 py-1 text-xs text-slate-800 dark:text-white"
                              placeholder="0.00"
                              onChange={(e) => handleTurnoverChange(rKey, "wholesale", e.target.value)}
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              className="w-full bg-slate-50/60 dark:bg-slate-900 border border-slate-200 dark:border-[#0d2336]/40 rounded-lg px-2.5 py-1 text-xs text-slate-800 dark:text-white"
                              placeholder="0.00"
                              onChange={(e) => handleTurnoverChange(rKey, "retail", e.target.value)}
                            />
                          </td>
                          <td className="p-3 text-right font-mono font-bold">₹{lineTotal.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                    {/* Total Row */}
                    <tr className="bg-slate-50/80 dark:bg-slate-900/50 font-bold border-t border-slate-200 dark:border-[#0d2336]">
                      <td className="p-3 text-primary uppercase">Total</td>
                      <td className="p-3 font-mono">₹{totalWholesale.toFixed(2)}</td>
                      <td className="p-3 font-mono">₹{totalRetail.toFixed(2)}</td>
                      <td className="p-3 text-right font-mono text-primary font-black">₹{grandTotalTurnover.toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* GST TYPE */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">GST TYPE</label>
                <div className="flex gap-4 text-xs font-semibold text-slate-700 dark:text-slate-350">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="gstType"
                      checked={gstType === "REGISTERED"}
                      onChange={() => setGstType("REGISTERED")}
                    />
                    <span>REGISTERED</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="gstType"
                      checked={gstType === "UNREGISTERED"}
                      onChange={() => setGstType("UNREGISTERED")}
                    />
                    <span>UNREGISTERED</span>
                  </label>
                </div>
              </div>

              {/* GST details */}
              {gstType === "REGISTERED" && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">GST Registration Details</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-[#0d2336]/40 rounded-xl px-3.5 py-2.5 text-xs outline-none"
                      placeholder="GSTIN"
                      value={gstDetails}
                      onChange={(e) => setGstDetails(e.target.value)}
                    />
                    <label className="p-2.5 bg-slate-100 dark:bg-[#071929] hover:bg-primary hover:text-white dark:hover:bg-primary text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[#0d2336] rounded-xl cursor-pointer transition-all shrink-0">
                      <FiUploadCloud className="text-sm" />
                      <input type="file" className="hidden" onChange={(e) => handleSimulatedUpload(e, setGstFile)} />
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* PAN & establishment dates */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">Pan Number</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-[#0d2336]/40 rounded-xl px-3.5 py-2.5 text-xs outline-none"
                    placeholder="PAN Number"
                    value={panNumber}
                    onChange={(e) => setPanNumber(e.target.value)}
                  />
                  <label className="p-2.5 bg-slate-100 dark:bg-[#071929] hover:bg-primary hover:text-white dark:hover:bg-primary text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[#0d2336] rounded-xl cursor-pointer transition-all shrink-0">
                    <FiUploadCloud className="text-sm" />
                    <input type="file" className="hidden" onChange={(e) => handleSimulatedUpload(e, setPanFile)} />
                  </label>
                </div>
              </div>

              <Input
                label="Date of Establishment of Firm"
                type="date"
                value={dateOfEstablishment}
                onChange={(e) => setDateOfEstablishment(e.target.value)}
              />

              <Input
                label="Registration No. of Firm"
                placeholder="Registration No. of Firm"
                value={registrationNoOfFirm}
                onChange={(e) => setRegistrationNoOfFirm(e.target.value)}
              />
            </div>

            {/* License Numbers */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">Pesticide License No.</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-[#0d2336]/40 rounded-xl px-3.5 py-2.5 text-xs outline-none"
                    placeholder="Pesticide License No."
                    value={pesticideLicenseNo}
                    onChange={(e) => setPesticideLicenseNo(e.target.value)}
                  />
                  <label className="p-2.5 bg-slate-100 dark:bg-[#071929] hover:bg-primary hover:text-white dark:hover:bg-primary text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[#0d2336] rounded-xl cursor-pointer transition-all shrink-0">
                    <FiUploadCloud className="text-sm" />
                    <input type="file" className="hidden" onChange={(e) => handleSimulatedUpload(e, setPesticideLicenseFile)} />
                  </label>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">Fertilizer License No.</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-[#0d2336]/40 rounded-xl px-3.5 py-2.5 text-xs outline-none"
                    placeholder="Fertilizer License No."
                    value={fertilizerLicenseNo}
                    onChange={(e) => setFertilizerLicenseNo(e.target.value)}
                  />
                  <label className="p-2.5 bg-slate-100 dark:bg-[#071929] hover:bg-primary hover:text-white dark:hover:bg-primary text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[#0d2336] rounded-xl cursor-pointer transition-all shrink-0">
                    <FiUploadCloud className="text-sm" />
                    <input type="file" className="hidden" onChange={(e) => handleSimulatedUpload(e, setFertilizerLicenseFile)} />
                  </label>
                </div>
              </div>
            </div>

            {/* Banker details */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">Bank Account No.</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-[#0d2336]/40 rounded-xl px-3.5 py-2.5 text-xs outline-none"
                    placeholder="Bank Account No."
                    value={bankAccountNo}
                    onChange={(e) => setBankAccountNo(e.target.value)}
                  />
                  <label className="p-2.5 bg-slate-100 dark:bg-[#071929] hover:bg-primary hover:text-white dark:hover:bg-primary text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[#0d2336] rounded-xl cursor-pointer transition-all shrink-0">
                    <FiUploadCloud className="text-sm" />
                    <input type="file" className="hidden" onChange={(e) => handleSimulatedUpload(e, setBankAccountFile)} />
                  </label>
                </div>
              </div>

              <Input
                label="IFSC Code"
                placeholder="IFSC Code"
                value={ifscCode}
                onChange={(e) => setIfscCode(e.target.value)}
              />

              <Input
                label="Banker's Name"
                placeholder="Banker's Name"
                value={bankersName}
                onChange={(e) => setBankersName(e.target.value)}
              />

              <Input
                label="Banker's Address"
                placeholder="Banker's Address"
                value={bankersAddress}
                onChange={(e) => setBankersAddress(e.target.value)}
              />
            </div>
          </div>

          {/* PAGE 3: INFRASTRUCTURE & SECURITY DEPOSITS */}
          <div className="space-y-6 pt-4 border-t border-slate-100 dark:border-[#0d2336]/30">
            <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-primary border-l-2 border-primary pl-2">
              Infrastructure & Security
            </h4>

            <Input
              label="Cheque Signing Auth. Name"
              placeholder="Cheque Signing Authority Name"
              value={chequeAuthName}
              onChange={(e) => setChequeAuthName(e.target.value)}
            />

            {/* Details of Infrastructure */}
            <div className="space-y-4 p-4.5 bg-slate-50/50 dark:bg-[#071929]/20 border border-slate-150/40 rounded-2xl">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                Details of Infrastructure/Facility of Distribution
              </p>
              
              {/* Godown Row */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
                <Input
                  label="No. of Godown"
                  placeholder="No. of Godown"
                  value={noOfGodown}
                  onChange={(e) => setNoOfGodown(e.target.value)}
                />
                <Input
                  label="Size Sq/Ft."
                  placeholder="Size Sq/Ft."
                  value={sizeSqFt}
                  onChange={(e) => setSizeSqFt(e.target.value)}
                />
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">Ownership</label>
                  <div className="flex gap-4 text-xs font-semibold text-slate-700 dark:text-slate-350">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="godownOwnership"
                        checked={godownOwnership === "SELF"}
                        onChange={() => setGodownOwnership("SELF")}
                      />
                      <span>SELF</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="godownOwnership"
                        checked={godownOwnership === "RENTED"}
                        onChange={() => setGodownOwnership("RENTED")}
                      />
                      <span>RENTED</span>
                    </label>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">Electricity bill</label>
                  <label className="flex items-center justify-between border border-slate-200 dark:border-[#0d2336]/40 bg-white dark:bg-slate-900 rounded-xl px-3.5 py-2.5 cursor-pointer transition-all hover:border-slate-400">
                    <span className="text-xs text-slate-400 truncate max-w-[120px]">{godownElectricityFile || "Upload File"}</span>
                    <FiUploadCloud className="text-slate-400 text-sm shrink-0" />
                    <input type="file" className="hidden" onChange={(e) => handleSimulatedUpload(e, setGodownElectricityFile)} />
                  </label>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">Water bill</label>
                  <label className="flex items-center justify-between border border-slate-200 dark:border-[#0d2336]/40 bg-white dark:bg-slate-900 rounded-xl px-3.5 py-2.5 cursor-pointer transition-all hover:border-slate-400">
                    <span className="text-xs text-slate-400 truncate max-w-[120px]">{godownWaterFile || "Upload File"}</span>
                    <FiUploadCloud className="text-slate-400 text-sm shrink-0" />
                    <input type="file" className="hidden" onChange={(e) => handleSimulatedUpload(e, setGodownWaterFile)} />
                  </label>
                </div>
              </div>

              {/* Retail Outlet Row */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center pt-2">
                <div className="md:col-span-2">
                  <Input
                    label="No. of Retail Outlets"
                    placeholder="No. of Retail Outlets"
                    value={noOfRetailOutlets}
                    onChange={(e) => setNoOfRetailOutlets(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">Ownership</label>
                  <div className="flex gap-4 text-xs font-semibold text-slate-700 dark:text-slate-350">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="outletsOwnership"
                        checked={outletsOwnership === "SELF"}
                        onChange={() => setOutletsOwnership("SELF")}
                      />
                      <span>SELF</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="outletsOwnership"
                        checked={outletsOwnership === "RENTED"}
                        onChange={() => setOutletsOwnership("RENTED")}
                      />
                      <span>RENTED</span>
                    </label>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">Electricity bill</label>
                  <label className="flex items-center justify-between border border-slate-200 dark:border-[#0d2336]/40 bg-white dark:bg-slate-900 rounded-xl px-3.5 py-2.5 cursor-pointer transition-all hover:border-slate-400">
                    <span className="text-xs text-slate-400 truncate max-w-[120px]">{outletsElectricityFile || "Upload File"}</span>
                    <FiUploadCloud className="text-slate-400 text-sm shrink-0" />
                    <input type="file" className="hidden" onChange={(e) => handleSimulatedUpload(e, setOutletsElectricityFile)} />
                  </label>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">Water bill</label>
                  <label className="flex items-center justify-between border border-slate-200 dark:border-[#0d2336]/40 bg-white dark:bg-slate-900 rounded-xl px-3.5 py-2.5 cursor-pointer transition-all hover:border-slate-400">
                    <span className="text-xs text-slate-400 truncate max-w-[120px]">{outletsWaterFile || "Upload File"}</span>
                    <FiUploadCloud className="text-slate-400 text-sm shrink-0" />
                    <input type="file" className="hidden" onChange={(e) => handleSimulatedUpload(e, setOutletsWaterFile)} />
                  </label>
                </div>
              </div>
            </div>

            {/* Serving Companies Addable Table */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Name of the Companies currently serving and their respective turnover of pesticides for the last year:
                </label>
                <Button type="button" size="sm" onClick={addServingCompanyRow} icon={<FiPlus />}>
                  Add Row
                </Button>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-[#0d2336]/50">
                <table className="w-full text-xs text-left border-collapse font-sans">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-[#0d2336] text-[10px] font-extrabold uppercase text-slate-500">
                      <th className="p-3 w-12 text-center">Sr. No.</th>
                      <th className="p-3">Name of the Company & Year of Distributorship</th>
                      <th className="p-3 w-40">Max. Credit Amount (₹)</th>
                      <th className="p-3 w-40">Maximum Credit Days</th>
                      <th className="p-3 w-40">Turnover (₹)</th>
                      <th className="p-3 w-16 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150 font-semibold text-slate-700 dark:text-slate-200">
                    {servingCompanies.map((row, idx) => (
                      <tr key={row.id}>
                        <td className="p-3 text-center font-mono">{idx + 1}</td>
                        <td className="p-2">
                          <input
                            type="text"
                            required
                            className="w-full bg-slate-50/60 dark:bg-slate-900 border border-slate-200 dark:border-[#0d2336]/40 rounded-lg px-2.5 py-1 text-xs text-slate-800 dark:text-white"
                            placeholder="Company & Year"
                            value={row.nameAndYear}
                            onChange={(e) => handleServingCompanyChange(row.id, "nameAndYear", e.target.value)}
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            className="w-full bg-slate-50/60 dark:bg-slate-900 border border-slate-200 dark:border-[#0d2336]/40 rounded-lg px-2.5 py-1 text-xs text-slate-800 dark:text-white"
                            placeholder="Credit Amount"
                            value={row.maxCredit || ""}
                            onChange={(e) => handleServingCompanyChange(row.id, "maxCredit", parseFloat(e.target.value) || 0)}
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            className="w-full bg-slate-50/60 dark:bg-slate-900 border border-slate-200 dark:border-[#0d2336]/40 rounded-lg px-2.5 py-1 text-xs text-slate-800 dark:text-white"
                            placeholder="Credit Days"
                            value={row.creditDays || ""}
                            onChange={(e) => handleServingCompanyChange(row.id, "creditDays", parseInt(e.target.value) || 0)}
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            className="w-full bg-slate-50/60 dark:bg-slate-900 border border-slate-200 dark:border-[#0d2336]/40 rounded-lg px-2.5 py-1 text-xs text-slate-800 dark:text-white"
                            placeholder="Turnover"
                            value={row.turnover || ""}
                            onChange={(e) => handleServingCompanyChange(row.id, "turnover", parseFloat(e.target.value) || 0)}
                          />
                        </td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => removeServingCompanyRow(row.id)}
                            className="p-1 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer border-none bg-transparent"
                            disabled={servingCompanies.length === 1}
                          >
                            <FiTrash2 className="text-sm" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {/* Total Row */}
                    <tr className="bg-slate-50/80 dark:bg-slate-900/50 font-bold border-t border-slate-200 dark:border-[#0d2336]">
                      <td colSpan={4} className="p-3 uppercase text-primary text-right">Total</td>
                      <td colSpan={2} className="p-3 font-mono text-primary font-black">₹{totalServingTurnover.toLocaleString('en-IN')}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Details of Security Deposit */}
            <div className="space-y-3 p-4 bg-slate-50/50 dark:bg-[#071929]/20 border border-slate-150/40 rounded-2xl">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                Details of Security Deposit
              </p>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Input
                  label="Cheque No."
                  placeholder="Cheque No."
                  value={secChequeNo}
                  onChange={(e) => setSecChequeNo(e.target.value)}
                />
                <Input
                  label="Date of Issue"
                  type="date"
                  value={secDateOfIssue}
                  onChange={(e) => setSecDateOfIssue(e.target.value)}
                />
                <Input
                  label="Amount"
                  placeholder="Amount"
                  value={secAmount}
                  onChange={(e) => setSecAmount(e.target.value)}
                />
                <Input
                  label="Bank Drawn"
                  placeholder="Bank Drawn"
                  value={secBankDrawn}
                  onChange={(e) => setSecBankDrawn(e.target.value)}
                />
              </div>
            </div>

            {/* Sales targets */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Sales target for the current year (In, Rs. Lakh)"
                placeholder="Current Year Target"
                value={targetCurrentYear}
                onChange={(e) => setTargetCurrentYear(e.target.value)}
              />
              <Input
                label="Sales target for the Next Year (In, Rs. Lakh)"
                placeholder="Next Year Target"
                value={targetNextYear}
                onChange={(e) => setTargetNextYear(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">Insecticides License</label>
              <label className="flex items-center justify-between border border-slate-200 dark:border-[#0d2336]/40 bg-white dark:bg-slate-900 rounded-xl px-3.5 py-2.5 cursor-pointer transition-all hover:border-slate-400 max-w-md">
                <span className="text-xs text-slate-400 truncate">{insecticidesLicenseFile || "Upload File"}</span>
                <FiUploadCloud className="text-slate-400 text-sm shrink-0" />
                <input type="file" className="hidden" onChange={(e) => handleSimulatedUpload(e, setInsecticidesLicenseFile)} />
              </label>
            </div>
          </div>

          {/* PAGE 4: KYC FILE COMPLIANCE CHECKLIST */}
          <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-[#0d2336]/30">
            <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-primary border-l-2 border-primary pl-2 mb-2">
              KYC Compliance Checklist (File Attachments)
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { label: "Bal. Sheet of last 2Y", val: fileBalSheet, set: setFileBalSheet },
                { label: "I.T.R of last 2 year", val: fileITR, set: setFileITR },
                { label: "Proof of Residence", val: fileResidence, set: setFileResidence },
                { label: "Proof of Photo Id", val: filePhotoId, set: setFilePhotoId },
                { label: "K.Y.C of Partners", val: fileKYCPartners, set: setFileKYCPartners },
                { label: "Partnership Deed / MoA / AoA with latest amendment", val: fileDeedOrMoA, set: setFileDeedOrMoA },
                { label: "4 Cheques (Nationalized Bank Only) & 2 Letterheads with Stamp and Sign", val: fileChequesAndLetterhead, set: setFileChequesAndLetterhead },
                { label: "Copy of Last 12 months Bank Statement (Account verified by Bank)", val: fileBankStatement, set: setFileBankStatement },
                { label: "Sign of Proprietor/Managing Partner/Director authorized to sign Cheques attested by bank", val: fileDirectorSign, set: setFileDirectorSign },
              ].map((item, idx) => (
                <div key={idx} className="p-3.5 border border-slate-200/60 dark:border-[#0d2336]/50 bg-slate-50/30 dark:bg-slate-900/10 rounded-xl flex items-center justify-between hover:border-slate-350 transition-all">
                  <div className="pr-4">
                    <p className="text-xs font-bold text-slate-800 dark:text-white leading-normal">{item.label}</p>
                    <p className="text-[9.5px] text-slate-400 mt-1 truncate max-w-[280px]">
                      {item.val ? `✓ Attached: ${item.val}` : "Awaiting document attachment"}
                    </p>
                  </div>
                  <label className="p-2 bg-slate-100 dark:bg-[#071929] hover:bg-primary hover:text-white dark:hover:bg-primary text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[#0d2336] rounded-lg cursor-pointer transition-all shrink-0">
                    <FiUploadCloud className="text-sm" />
                    <input type="file" className="hidden" onChange={(e) => handleSimulatedUpload(e, item.set)} />
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-100 dark:border-[#0d2336]/30">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/sales/customers")}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={submitting}
              icon={<FiSave />}
            >
              Save Distributor Record
            </Button>
          </div>

        </form>
      </div>
    </div>
  );
}
