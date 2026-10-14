"use client";

/* Loading a sheet of products instead of typing them one at a time.
 *
 * Two steps, deliberately. Choosing a file shows what it would do -
 * every product, with the row it came from - and nothing is saved until
 * that has been read and the button pressed. A sheet from a supplier is
 * the one document nobody has checked, so the check happens here rather
 * than in the catalogue afterwards.
 */

import { useRef, useState } from "react";
import {
  FiAlertCircle,
  FiCheckCircle,
  FiDownload,
  FiFileText,
  FiUploadCloud,
  FiX,
} from "react-icons/fi";

import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { useUIStore } from "@/lib/store/ui.store";
import {
  bulkUploadInventoryApi,
  downloadBulkTemplateApi,
  BulkUploadResult,
} from "@/features/inventory/api/inventory.api";

const ACCEPTED = ".xlsx,.xlsm,.csv";

export default function BulkUploadModal({
  open,
  onClose,
  onLoaded,
}: {
  open: boolean;
  onClose: () => void;
  /** Called once products have actually been saved, to refresh the list. */
  onLoaded: () => void;
}) {
  const { addToast } = useUIStore();
  const fileInput = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<BulkUploadResult | null>(null);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [dragging, setDragging] = useState(false);

  const reset = () => {
    setFile(null);
    setPreview(null);
    setReading(false);
    setSaving(false);

    if (fileInput.current) fileInput.current.value = "";
  };

  const close = () => {
    reset();
    onClose();
  };

  const detail = (error: unknown) =>
    (error as { response?: { data?: { detail?: string } } })?.response?.data
      ?.detail;

  /** Read the file without saving anything, and show what it would do. */
  const choose = async (chosen: File | null) => {
    if (!chosen) return;

    setFile(chosen);
    setPreview(null);
    setReading(true);

    try {
      const result = await bulkUploadInventoryApi(chosen, false);
      setPreview(result);
    } catch (error) {
      addToast(detail(error) || "That file could not be read.", "error");
      reset();
    } finally {
      setReading(false);
    }
  };

  const commit = async () => {
    if (!file) return;

    setSaving(true);

    try {
      const result = await bulkUploadInventoryApi(file, true);

      if (result.errors?.length) {
        // The sheet changed under us, or something clashed in between.
        setPreview(result);
        addToast(result.message || "That sheet could not be loaded.", "error");
        return;
      }

      addToast(
        result.message || `${result.created} products loaded.`,
        "success",
      );

      onLoaded();
      close();
    } catch (error) {
      addToast(detail(error) || "Those products could not be loaded.", "error");
    } finally {
      setSaving(false);
    }
  };

  const template = async () => {
    setDownloading(true);

    try {
      await downloadBulkTemplateApi();
    } catch (error) {
      addToast(detail(error) || "The template could not be downloaded.", "error");
    } finally {
      setDownloading(false);
    }
  };

  const errors = preview?.errors || [];
  const items = preview?.items || [];
  const ready = Boolean(preview) && errors.length === 0 && items.length > 0;

  return (
    <Modal
      isOpen={open}
      onClose={close}
      title="Upload Products From A Sheet"
      size="lg"
    >
      <div className="space-y-5">
        {/* The sheet to fill in. Built from the masters as they stand, so
            the product type codes and units on it are ones that exist. */}
        <div className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-[#0d2336] dark:bg-[#071929]/40">
          <div className="space-y-1">
            <p className="text-[13px] font-semibold text-slate-800 dark:text-white">
              Start from the template
            </p>
            <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
              One product per row, the same fields as the form. A row can
              carry several serial numbers separated by <strong>/</strong> —
              each one is loaded as its own product.
            </p>
          </div>

          <Button
            variant="outline"
            type="button"
            onClick={template}
            loading={downloading}
          >
            <span className="flex items-center gap-1.5">
              <FiDownload size={13} /> Template
            </span>
          </Button>
        </div>

        {/* The file itself. */}
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            choose(event.dataTransfer.files?.[0] || null);
          }}
          onClick={() => fileInput.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition ${
            dragging
              ? "border-primary bg-primary/5"
              : "border-slate-200 hover:border-primary/50 dark:border-[#0d2336]"
          }`}
        >
          <input
            ref={fileInput}
            type="file"
            accept={ACCEPTED}
            className="hidden"
            onChange={(event) => choose(event.target.files?.[0] || null)}
          />

          <FiUploadCloud className="text-2xl text-slate-400" />

          {file ? (
            <p className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-700 dark:text-slate-200">
              <FiFileText size={13} /> {file.name}
            </p>
          ) : (
            <>
              <p className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">
                Drop the sheet here, or click to choose
              </p>
              <p className="text-[11px] text-slate-400">
                Excel (.xlsx) or CSV, up to 5 MB
              </p>
            </>
          )}
        </div>

        {reading && (
          <p className="text-center text-[12px] text-slate-500">
            Reading the sheet...
          </p>
        )}

        {/* Everything wrong with it. All of it at once: fixing one row,
            uploading, and being told about the next is the same refusal
            over and over. */}
        {errors.length > 0 && (
          <div className="space-y-2 rounded-xl border border-rose-200 bg-rose-50/60 p-4 dark:border-rose-900/40 dark:bg-rose-950/20">
            <p className="flex items-center gap-1.5 text-[13px] font-semibold text-rose-700 dark:text-rose-400">
              <FiAlertCircle size={13} />
              {errors.length} problem{errors.length === 1 ? "" : "s"} in that
              sheet — nothing has been loaded
            </p>

            <ul className="max-h-44 space-y-1 overflow-y-auto pl-1">
              {errors.map((message, index) => (
                <li
                  key={index}
                  className="text-[11px] leading-relaxed text-rose-700/90 dark:text-rose-300/90"
                >
                  {message}
                </li>
              ))}
            </ul>

            <p className="text-[11px] text-rose-700/70 dark:text-rose-300/70">
              Correct the sheet and choose it again.
            </p>
          </div>
        )}

        {/* What it would create. Shown before anything is saved, because a
            row with three serial numbers becoming three products is the
            sort of thing worth seeing rather than discovering. */}
        {ready && (
          <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
            <p className="flex items-center gap-1.5 text-[13px] font-semibold text-emerald-700 dark:text-emerald-400">
              <FiCheckCircle size={13} />
              {items.length} product{items.length === 1 ? "" : "s"} from{" "}
              {preview?.rows} row{preview?.rows === 1 ? "" : "s"}
            </p>

            <div className="max-h-56 overflow-y-auto rounded-lg border border-emerald-100 bg-white dark:border-emerald-900/30 dark:bg-[#051422]">
              <table className="w-full text-left text-[11px]">
                <thead className="sticky top-0 bg-slate-50 dark:bg-[#071929]">
                  <tr className="text-slate-500 dark:text-slate-400">
                    <th className="px-2 py-1.5 font-medium">Row</th>
                    <th className="px-2 py-1.5 font-medium">Product</th>
                    <th className="px-2 py-1.5 font-medium">Serial</th>
                    <th className="px-2 py-1.5 font-medium">Type</th>
                    <th className="px-2 py-1.5 font-medium">Stock</th>
                    <th className="px-2 py-1.5 font-medium">ECP</th>
                  </tr>
                </thead>

                <tbody>
                  {items.map((item, index) => (
                    <tr
                      key={`${item.serial_number}-${index}`}
                      className="border-t border-slate-100 dark:border-[#0d2336]"
                    >
                      <td className="px-2 py-1.5 text-slate-400">{item.row}</td>
                      <td className="px-2 py-1.5 font-medium text-slate-700 dark:text-slate-200">
                        {item.name}
                      </td>
                      <td className="px-2 py-1.5 font-mono text-[10px] text-slate-600 dark:text-slate-300">
                        {item.serial_number}
                      </td>
                      <td className="px-2 py-1.5 text-slate-500">
                        {item.product_type_code}
                      </td>
                      <td className="px-2 py-1.5 text-slate-500">
                        {item.instock} {item.unit}
                      </td>
                      <td className="px-2 py-1.5 text-slate-500">
                        ₹{Number(item.rate || 0).toLocaleString("en-IN")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-[11px] text-emerald-700/70 dark:text-emerald-300/70">
              Nothing has been saved yet.
            </p>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-3 dark:border-[#0d2336]">
          {file && (
            <Button variant="outline" type="button" onClick={reset}>
              <span className="flex items-center gap-1.5">
                <FiX size={13} /> Choose another
              </span>
            </Button>
          )}

          <Button variant="outline" type="button" onClick={close}>
            Cancel
          </Button>

          <Button onClick={commit} loading={saving} disabled={!ready}>
            {ready ? `Load ${items.length} Products` : "Load Products"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
