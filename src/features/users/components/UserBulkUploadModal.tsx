"use client";

/* Users > Bulk Upload: people from HR's Excel or CSV.
 *
 * Two steps. Choosing a file shows what every row would do - add,
 * update, switch off, skip - with anything that needs a look, and nothing
 * is saved until Import is pressed. Rows are applied one by one on the
 * server, so the result screen says what happened to each, including the
 * few it could not do. The same sheet can be uploaded again later with
 * new or changed columns: a blank cell leaves that field as it is.
 */

import { useMemo, useRef, useState } from "react";
import { FiAlertCircle, FiCheckCircle, FiDownload, FiFileText, FiUploadCloud, FiX } from "react-icons/fi";

import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import {
  downloadUserTemplateApi,
  importUsersApi,
  type UserImportResult,
  type UserImportRow,
} from "@/features/users/api/users.api";
import { useUIStore } from "@/lib/store/ui.store";

const ACCEPTED = ".xlsx,.xlsm,.csv";

const ACTION: Record<UserImportRow["action"], { label: string; tone: string }> = {
  create: { label: "Add", tone: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" },
  update: { label: "Update", tone: "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300" },
  deactivate: { label: "Switch off", tone: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300" },
  skip: { label: "Skip", tone: "bg-slate-100 text-slate-500 dark:bg-[#0b2034] dark:text-slate-400" },
  error: { label: "Problem", tone: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300" },
};

/** Notes that are only information, not something to fix. */
const routine = (issue: string) =>
  issue.startsWith("read '") || issue.startsWith("matched by name") || issue === "no change" || issue.startsWith("left - ");

type Filter = "attention" | "all" | UserImportRow["action"];

export default function UserBulkUploadModal({
  open,
  onClose,
  onLoaded,
}: {
  open: boolean;
  onClose: () => void;
  /** Called once people have actually been saved, to refresh the list. */
  onLoaded: () => void;
}) {
  const { addToast } = useUIStore();
  const fileInput = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [testEmails, setTestEmails] = useState(true);
  const [sendWelcome, setSendWelcome] = useState(false);
  const [startPassword, setStartPassword] = useState("");
  const [result, setResult] = useState<UserImportResult | null>(null);
  const [stale, setStale] = useState(false);
  const [busy, setBusy] = useState<"reading" | "saving" | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [filter, setFilter] = useState<Filter>("attention");

  const options = { testEmails, sendWelcome, startPassword: startPassword.trim() || undefined };

  const reset = () => {
    setFile(null);
    setResult(null);
    setStale(false);
    setBusy(null);
    setFilter("attention");
    if (fileInput.current) fileInput.current.value = "";
  };

  const close = () => {
    reset();
    onClose();
  };

  /** Read the file without saving anything, and show what it would do. */
  const check = async (chosen: File | null = file) => {
    if (!chosen) return;
    setFile(chosen);
    setBusy("reading");
    try {
      const preview = await importUsersApi(chosen, false, options);
      setResult(preview);
      setStale(false);
      setFilter("attention");
    } catch {
      /* The API client shows why; the file stays chosen. */
    } finally {
      setBusy(null);
    }
  };

  const changeOption = (apply: () => void) => {
    apply();
    if (result && !result.applied) setStale(true);
  };

  const commit = async () => {
    if (!file) return;
    setBusy("saving");
    try {
      const done = await importUsersApi(file, true, options);
      setResult(done);
      setFilter("attention");
      addToast(done.message || "People uploaded.", "success");
      onLoaded();
    } catch {
      /* The API client shows why. */
    } finally {
      setBusy(null);
    }
  };

  const template = async () => {
    setDownloading(true);
    try {
      await downloadUserTemplateApi();
    } catch {
      /* The API client shows why. */
    } finally {
      setDownloading(false);
    }
  };

  const rows = useMemo(() => {
    const all = result?.rows || [];
    if (filter === "all") return all;
    if (filter === "attention") {
      return all.filter((r) => r.action === "error" || r.issues.some((i) => !routine(i)));
    }
    return all.filter((r) => r.action === filter);
  }, [result, filter]);

  const counts = result?.counts || {};
  const willChange = (counts.create || 0) + (counts.update || 0) + (counts.deactivate || 0);
  const attention = (result?.rows || []).filter((r) => r.action === "error" || r.issues.some((i) => !routine(i))).length;

  const tabs: { key: Filter; label: string; count: number }[] = [
    { key: "attention", label: "Needs a look", count: attention },
    { key: "create", label: "Add", count: counts.create || 0 },
    { key: "update", label: "Update", count: counts.update || 0 },
    { key: "deactivate", label: "Switch off", count: counts.deactivate || 0 },
    { key: "skip", label: "Skip", count: counts.skip || 0 },
    { key: "error", label: "Problems", count: counts.error || 0 },
    { key: "all", label: "All", count: result?.rows.length || 0 },
  ];

  return (
    <Modal isOpen={open} onClose={close} title="Upload People From A Sheet" size="xl">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[12px] text-slate-500 dark:text-slate-400">
            One person per row. People already here are updated.
          </p>
          <Button variant="outline" type="button" onClick={template} loading={downloading}>
            <span className="flex items-center gap-1.5"><FiDownload size={13} /> Template</span>
          </Button>
        </div>

        {!result?.applied && (
          <fieldset className="grid gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-2 dark:border-[#0d2336]">
            <legend className="px-1 text-[12px] font-semibold text-slate-600 dark:text-slate-300">For new people</legend>
            <label className="flex items-start gap-2 text-[12px] text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={testEmails}
                onChange={(e) => changeOption(() => setTestEmails(e.target.checked))}
              />
              <span>
                Use test emails (@mailinator.com)
                <span className="block text-[11px] text-slate-400">Nobody&apos;s email already here is changed.</span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-[12px] text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={sendWelcome}
                onChange={(e) => changeOption(() => setSendWelcome(e.target.checked))}
              />
              <span>
                Email each new person their sign-in
                <span className="block text-[11px] text-slate-400">The usual welcome email with a temporary password.</span>
              </span>
            </label>
            <div className="sm:col-span-2">
              <label htmlFor="start-password" className="mb-1 block text-[12px] text-slate-600 dark:text-slate-300">
                Starting password (optional)
              </label>
              <input
                id="start-password"
                type="password"
                autoComplete="new-password"
                value={startPassword}
                onChange={(e) => changeOption(() => setStartPassword(e.target.value))}
                className="w-full max-w-sm rounded-lg border border-slate-300 bg-white px-3 py-2 text-[13px] outline-none focus:border-[#243454] dark:border-[#17304a] dark:bg-[#071929] dark:text-white"
                placeholder="Everyone new starts on it and must change it"
              />
            </div>
          </fieldset>
        )}

        {!result?.applied && (
          <div
            role="button"
            tabIndex={0}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileInput.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); check(e.dataTransfer.files?.[0] || null); }}
            onClick={() => fileInput.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#243454] ${
              dragging ? "border-primary bg-primary/5" : "border-slate-200 hover:border-primary/50 dark:border-[#0d2336]"
            }`}
          >
            <input ref={fileInput} type="file" accept={ACCEPTED} className="hidden" onChange={(e) => check(e.target.files?.[0] || null)} />
            <FiUploadCloud className="text-2xl text-slate-400" />
            {file ? (
              <p className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-700 dark:text-slate-200">
                <FiFileText size={13} /> {file.name}
              </p>
            ) : (
              <>
                <p className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">Drop the sheet here, or click to choose</p>
                <p className="text-[11px] text-slate-400">Excel (.xlsx) or CSV, up to 5 MB</p>
              </>
            )}
          </div>
        )}

        {busy === "reading" && <p className="text-center text-[12px] text-slate-500">Reading the sheet...</p>}

        {stale && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            The options changed since the sheet was checked.
            <Button variant="outline" type="button" onClick={() => check()} loading={busy === "reading"}>Check again</Button>
          </div>
        )}

        {result && (
          <div className="space-y-3">
            <p className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-800 dark:text-white">
              {result.applied ? <FiCheckCircle className="text-emerald-600" size={14} /> : <FiAlertCircle className="text-slate-400" size={14} />}
              {result.applied
                ? `Done: ${counts.create || 0} added, ${counts.update || 0} updated, ${counts.deactivate || 0} switched off.`
                : `${result.rows.length} rows read. Nothing has been saved yet.`}
            </p>

            {result.notes.length > 0 && (
              <ul className="space-y-1 rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-600 dark:bg-[#071929] dark:text-slate-300">
                {result.notes.map((note) => <li key={note}>{note}</li>)}
              </ul>
            )}

            <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Show rows">
              {tabs.filter((t) => t.count > 0 || t.key === "attention").map((t) => (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={filter === t.key}
                  onClick={() => setFilter(t.key)}
                  className={`rounded-full px-3 py-1 text-[11px] font-medium transition ${
                    filter === t.key
                      ? "bg-[#243454] text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-[#0b2034] dark:text-slate-300"
                  }`}
                >
                  {t.label} {t.count}
                </button>
              ))}
            </div>

            <div className="max-h-[45vh] overflow-auto rounded-lg border border-slate-200 dark:border-[#0d2336]">
              {rows.length === 0 ? (
                <p className="px-4 py-6 text-center text-[12px] text-slate-500">
                  {filter === "attention" ? "Nothing needs a look." : "No rows here."}
                </p>
              ) : (
                <table className="w-full min-w-[720px] text-left text-[11px]">
                  <thead className="sticky top-0 bg-slate-50 dark:bg-[#071929]">
                    <tr className="text-slate-500 dark:text-slate-400">
                      <th className="px-2 py-1.5 font-medium">Row</th>
                      <th className="px-2 py-1.5 font-medium">Person</th>
                      <th className="px-2 py-1.5 font-medium">Action</th>
                      <th className="px-2 py-1.5 font-medium">Role / Department</th>
                      <th className="px-2 py-1.5 font-medium">What changes, and anything to check</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.row} className="border-t border-slate-100 align-top dark:border-[#0d2336]">
                        <td className="px-2 py-1.5 text-slate-400">{r.row}</td>
                        <td className="px-2 py-1.5">
                          <span className="font-medium text-slate-700 dark:text-slate-200">{r.name || "—"}</span>
                          <span className="block text-[10px] text-slate-400">{[r.employee_id, r.designation].filter(Boolean).join(" · ")}</span>
                          {r.email && <span className="block break-all text-[10px] text-slate-400">{r.email}</span>}
                        </td>
                        <td className="px-2 py-1.5">
                          <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold ${ACTION[r.action].tone}`}>
                            {ACTION[r.action].label}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 text-slate-600 dark:text-slate-300">
                          {r.role || "—"}
                          {r.department && <span className="block text-[10px] text-slate-400">{r.department}</span>}
                        </td>
                        <td className="px-2 py-1.5">
                          {r.changes.length > 0 && <span className="block text-slate-600 dark:text-slate-300">{r.changes.join("; ")}</span>}
                          {r.issues.map((issue) => (
                            <span
                              key={issue}
                              className={`block ${routine(issue) ? "text-slate-400" : "text-rose-600 dark:text-rose-400"}`}
                            >
                              {issue}
                            </span>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 pt-3 dark:border-[#0d2336]">
          {result?.applied ? (
            <Button onClick={close}>Done</Button>
          ) : (
            <>
              {file && (
                <Button variant="outline" type="button" onClick={reset}>
                  <span className="flex items-center gap-1.5"><FiX size={13} /> Choose another</span>
                </Button>
              )}
              <Button variant="outline" type="button" onClick={close}>Cancel</Button>
              <Button onClick={commit} loading={busy === "saving"} disabled={!result || stale || willChange === 0 || busy !== null}>
                {result && willChange > 0 ? `Import ${willChange} ${willChange === 1 ? "Change" : "Changes"}` : "Import"}
              </Button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
