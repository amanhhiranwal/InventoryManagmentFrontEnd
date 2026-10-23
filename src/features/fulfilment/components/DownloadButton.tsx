"use client";

import { useState } from "react";
import { CgSpinner } from "react-icons/cg";
import { FiDownload } from "react-icons/fi";

import { useUIStore } from "@/lib/store/ui.store";

/** A desk's download: shows it is working, and says so when it fails. */
export default function DownloadButton({
  label,
  download,
}: {
  label: string;
  download: () => Promise<void>;
}) {
  const addToast = useUIStore((state) => state.addToast);
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await download();
        } catch {
          addToast(`${label} could not be downloaded.`, "error");
        } finally {
          setBusy(false);
        }
      }}
      className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-[#17304a] dark:bg-[#071929] dark:text-slate-200"
    >
      {busy ? <CgSpinner className="animate-spin" size={13} /> : <FiDownload size={13} />}
      {label}
    </button>
  );
}
