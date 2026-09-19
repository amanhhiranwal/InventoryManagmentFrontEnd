"use client";

import { ChangeEvent, DragEvent, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  FiAlertTriangle,
  FiCheckCircle,
  FiDownload,
  FiFileText,
  FiUploadCloud,
  FiX,
} from "react-icons/fi";
import { CgSpinner } from "react-icons/cg";

import Modal from "@/components/ui/Modal";
import {
  CustomerImportResult,
  CustomerImportRow,
  importCustomersApi,
} from "@/features/customers/api/customers.api";

/* Sheet column -> field. Headers are matched case-insensitively and
   ignoring spaces and punctuation, so "PIN / ZIP Code", "pin code" and
   "Pincode" all land in the same place. */
const COLUMN_ALIASES: Record<keyof CustomerImportRow, string[]> = {
  name: ["company", "companyname", "organization", "organizationname", "firmname", "customer", "accountname"],
  contact_name: ["customername", "contactname", "contactperson", "fullname", "name"],
  designation: ["designation", "title", "jobtitle"],
  email: ["email", "emailaddress", "emailid"],
  phone: ["phone", "phonenumber", "mobile", "mobilenumber", "mobileno", "contactnumber"],
  address: ["address", "officeaddress", "street"],
  city: ["city", "town"],
  state: ["state", "region", "province"],
  pin_code: ["pin", "pincode", "zip", "zipcode", "pinzipcode", "postalcode"],
  country: ["country"],
  gst: ["gst", "gstnumber", "gstin", "gstno"],
  pan: ["pan", "pannumber", "panno"],
  customer_type: ["customertype", "type"],
  category: ["category", "dealingcategory"],
  status: ["status"],
  assigned_to: ["assignedto", "owner", "assignee", "salesexecutive"],
};

const SAMPLE_HEADERS = [
  "Company",
  "Customer Name",
  "Designation",
  "Email",
  "Mobile",
  "Address",
  "City",
  "State",
  "PIN Code",
  "Country",
  "GST Number",
  "PAN Number",
  "Customer Type",
  "Category",
  "Status",
  "Assigned To",
];

const SAMPLE_ROW = [
  "Mehra Education Group",
  "Rajiv Mehra",
  "Procurement Head",
  "rajiv@mehragroup.com",
  "9876543210",
  "MG Road",
  "Bengaluru",
  "Karnataka",
  "560001",
  "India",
  "29ABCDE1234F1Z5",
  "ABCDE1234F",
  "Institution",
  "Education",
  "Active",
  "",
];

const normalizeHeader = (header: string) =>
  header.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Turn the first sheet of a workbook into import rows. */
async function readRows(file: File): Promise<CustomerImportRow[]> {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const sheetName = workbook.SheetNames[0];

  if (!sheetName) throw new Error("The file has no sheets.");

  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(
    workbook.Sheets[sheetName],
    { defval: "", raw: false },
  );

  const fields = Object.keys(COLUMN_ALIASES) as (keyof CustomerImportRow)[];

  return (
    raw
      .map((record) => {
        const byHeader = new Map(
          Object.entries(record).map(([key, value]) => [
            normalizeHeader(key),
            String(value ?? "").trim(),
          ]),
        );

        const row: CustomerImportRow = {};

        fields.forEach((field) => {
          const match = COLUMN_ALIASES[field].find((alias) => byHeader.get(alias));
          if (match) row[field] = byHeader.get(match);
        });

        return row;
      })
      /* Blank lines at the bottom of a sheet are not customers. */
      .filter((row) => Object.values(row).some(Boolean))
  );
}

export default function CustomerImportModal({
  onClose,
  onImported,
}: {
  onClose: () => void;
  /** Called after a successful upload so the list can reload. */
  onImported: (result: CustomerImportResult) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<CustomerImportRow[]>([]);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [reading, setReading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<CustomerImportResult | null>(null);

  const acceptFile = async (next: File) => {
    setError("");
    setResult(null);
    setRows([]);

    const extension = next.name.split(".").pop()?.toLowerCase();

    if (!extension || !["csv", "xlsx", "xls"].includes(extension)) {
      setError("Please upload a .xlsx, .xls or .csv file.");
      return;
    }

    if (next.size > 10 * 1024 * 1024) {
      setError("The file is larger than 10 MB.");
      return;
    }

    setFile(next);

    try {
      setReading(true);
      const parsed = await readRows(next);

      if (!parsed.length) {
        setError("No customer rows were found in the file.");
        return;
      }

      if (!parsed.some((row) => row.name || row.contact_name)) {
        setError(
          "No Company or Customer Name column was found. Download the sample file to see the expected headers.",
        );
        return;
      }

      setRows(parsed);
    } catch (err) {
      console.error(err);
      setError("The file could not be read. Check it opens in Excel and try again.");
    } finally {
      setReading(false);
    }
  };

  const clearFile = () => {
    setFile(null);
    setRows([]);
    setError("");
    setResult(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const downloadSample = () => {
    const sheet = XLSX.utils.aoa_to_sheet([SAMPLE_HEADERS, SAMPLE_ROW]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Customers");
    XLSX.writeFile(workbook, "sample-customers-import.xlsx");
  };

  const runImport = async () => {
    if (!rows.length) return;

    try {
      setImporting(true);
      setError("");
      const outcome = await importCustomersApi(rows);
      setResult(outcome);
      if (outcome.created > 0) onImported(outcome);
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.detail || "The import failed. Please try again.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="Add Customers From Excel" size="lg">
      <div className="space-y-5">
        {!result && (
          <>
            <div
              onClick={() => inputRef.current?.click()}
              onDragOver={(event) => event.preventDefault()}
              onDragEnter={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                setDragging(false);
              }}
              onDrop={(event: DragEvent<HTMLDivElement>) => {
                event.preventDefault();
                setDragging(false);
                const dropped = event.dataTransfer.files?.[0];
                if (dropped) acceptFile(dropped);
              }}
              className={`flex min-h-[124px] w-full cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-6 py-6 text-center transition ${
                dragging
                  ? "border-[#233353] bg-[#233353]/5"
                  : "border-[#d1d1d1] bg-white hover:bg-slate-50 dark:border-[#17304a] dark:bg-[#051422] dark:hover:bg-[#071929]"
              }`}
            >
              <FiUploadCloud className="text-2xl text-slate-400" />

              <p className="mt-3 text-[13px] text-slate-600 dark:text-slate-200">
                Drag and drop your file here, or{" "}
                <span className="font-semibold text-[#233353] underline dark:text-sky-400">
                  Browse
                </span>
              </p>

              <p className="mt-1 text-[11px] text-slate-400">
                .xlsx, .xls or .csv · up to 10 MB · first row must be the headers
              </p>

              <input
                ref={inputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                  const picked = event.target.files?.[0];
                  if (picked) acceptFile(picked);
                }}
              />
            </div>

            {file && (
              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-[#17304a] dark:bg-[#071929]">
                <div className="flex min-w-0 items-center gap-2">
                  {reading ? (
                    <CgSpinner className="shrink-0 animate-spin text-slate-400" />
                  ) : (
                    <FiFileText className="shrink-0 text-slate-500" />
                  )}

                  <span className="truncate text-[12px] font-medium text-slate-700 dark:text-slate-200">
                    {file.name}
                  </span>

                  {rows.length > 0 && (
                    <span className="shrink-0 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
                      {rows.length} customer{rows.length === 1 ? "" : "s"} found
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={clearFile}
                  aria-label="Remove file"
                  className="rounded-md p-1 text-slate-400 hover:text-rose-500"
                >
                  <FiX />
                </button>
              </div>
            )}

            {/* The first few rows as they will be saved, so a wrong column
                mapping is caught before anything is created. */}
            {rows.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-[#17304a]">
                <table className="w-full min-w-[560px] text-left text-[11px]">
                  <thead className="bg-slate-50 text-[#777777] dark:bg-[#071929] dark:text-slate-400">
                    <tr>
                      {["Company", "Customer", "Email", "Mobile", "State", "Status"].map((label) => (
                        <th key={label} className="px-3 py-2 font-normal">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 5).map((row, index) => (
                      <tr key={index} className="border-t border-slate-100 text-slate-700 dark:border-[#17304a] dark:text-slate-200">
                        <td className="px-3 py-2">{row.name || row.contact_name || "—"}</td>
                        <td className="px-3 py-2">{row.contact_name || "—"}</td>
                        <td className="px-3 py-2">{row.email || "—"}</td>
                        <td className="px-3 py-2">{row.phone || "—"}</td>
                        <td className="px-3 py-2">{row.state || "—"}</td>
                        <td className="px-3 py-2">{row.status || "Active"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {rows.length > 5 && (
                  <p className="border-t border-slate-100 px-3 py-2 text-[11px] text-slate-400 dark:border-[#17304a]">
                    …and {rows.length - 5} more
                  </p>
                )}
              </div>
            )}
          </>
        )}

        {result && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[13px] text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-400">
              <FiCheckCircle className="shrink-0" />
              {result.created} of {result.total} customer
              {result.total === 1 ? "" : "s"} imported.
            </div>

            {result.skipped.length > 0 && (
              <div className="rounded-lg border border-amber-200 dark:border-amber-900/40">
                <p className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-3 py-2 text-[12px] font-medium text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-400">
                  <FiAlertTriangle className="shrink-0" />
                  {result.skipped.length} row
                  {result.skipped.length === 1 ? " was" : "s were"} skipped. Fix them
                  and upload just those rows again.
                </p>

                <div className="max-h-56 overflow-y-auto">
                  <table className="w-full text-left text-[11px]">
                    <thead className="text-[#777777] dark:text-slate-400">
                      <tr>
                        <th className="px-3 py-2 font-normal">Row</th>
                        <th className="px-3 py-2 font-normal">Customer</th>
                        <th className="px-3 py-2 font-normal">Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.skipped.map((item) => (
                        <tr key={`${item.row}-${item.name}`} className="border-t border-slate-100 text-slate-700 dark:border-[#17304a] dark:text-slate-200">
                          <td className="px-3 py-2">{item.row}</td>
                          <td className="px-3 py-2">{item.name}</td>
                          <td className="px-3 py-2">{item.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {error && (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-[12px] text-rose-600 dark:bg-rose-950/20 dark:text-rose-400">
            {error}
          </p>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-[#17304a]">
          <button
            type="button"
            onClick={downloadSample}
            className="inline-flex items-center gap-2 text-[12px] font-medium text-[#233353] hover:underline dark:text-sky-400"
          >
            <FiDownload />
            Download sample file
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-[39px] rounded-lg border border-[#d1d1d1] bg-white px-4 text-[13px] text-slate-700 transition hover:bg-slate-50 dark:border-[#17304a] dark:bg-[#071929] dark:text-slate-200"
            >
              {result ? "Close" : "Cancel"}
            </button>

            {result ? (
              <button
                type="button"
                onClick={clearFile}
                className="h-[39px] rounded-lg bg-[#273756] px-4 text-[13px] font-medium text-white transition hover:bg-[#18243a]"
              >
                Upload Another File
              </button>
            ) : (
              <button
                type="button"
                onClick={runImport}
                disabled={!rows.length || importing || reading}
                className="inline-flex h-[39px] items-center gap-2 rounded-lg bg-[#273756] px-4 text-[13px] font-medium text-white transition hover:bg-[#18243a] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {importing && <CgSpinner className="animate-spin" />}
                {rows.length
                  ? `Import ${rows.length} Customer${rows.length === 1 ? "" : "s"}`
                  : "Import"}
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
