"use client";

/**
 * One GRN: the sheet as it will be printed, where it is in the Stock-In
 * process, and what can be done next - edit or send a draft for QC, record
 * the quality check and post it, cancel it, print it.
 */

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { CgSpinner } from "react-icons/cg";
import { FiArrowLeft, FiDownload, FiEdit2, FiFileText, FiPrinter, FiSend, FiX } from "react-icons/fi";

import { ListPage } from "@/components/crm/ListPageShell";
import Button from "@/components/ui/Button";
import { hasPermission } from "@/features/auth/utils/permissions";
import { getMyWarehousesApi, MyWarehouse } from "@/features/locations/api/locations.api";
import {
  Grn,
  Letterhead,
  cancelGrnApi,
  downloadGrnPdfApi,
  getGrnApi,
  postGrnReceiptApi,
  submitGrnApi,
} from "@/features/stock/api/grn.api";
import GrnForm from "@/features/stock/components/GrnForm";
import GrnProcess from "@/features/stock/components/GrnProcess";
import GrnQualityCheck from "@/features/stock/components/GrnQualityCheck";
import GrnSheet from "@/features/stock/components/GrnSheet";
import { GrnStatusPill, errorText } from "@/features/stock/components/stockUi";
import { useUIStore } from "@/lib/store/ui.store";

/* Only the GRN sheet prints. */
const PRINT_CSS = `@media print {
  body * { visibility: hidden; }
  #grn-sheet, #grn-sheet * { visibility: visible; }
  #grn-sheet { position: absolute; left: 0; top: 0; width: 100%; padding: 0; }
}`;

export default function StockInDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { addToast } = useUIStore();
  const id = Number(params.id);

  const canView = hasPermission("grn.read");
  const canCreate = hasPermission("grn.create");
  const canApprove = hasPermission("grn.approve");
  const canPost = hasPermission("grn.post");

  const [grn, setGrn] = useState<Grn | null>(null);
  const [letterhead, setLetterhead] = useState<Letterhead | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [warehouses, setWarehouses] = useState<MyWarehouse[]>([]);
  const [busy, setBusy] = useState<"submit" | "receive" | "cancel" | null>(null);
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async () => {
    try {
      const answer = await getGrnApi(id);
      setGrn(answer.grn);
      setLetterhead(answer.letterhead);
      setError(null);
    } catch (err: unknown) {
      setError(errorText(err, "Could not open this GRN."));
    }
  }, [id]);

  useEffect(() => {
    if (canView && Number.isFinite(id)) load();
  }, [canView, id, load]);

  const startEdit = async () => {
    try {
      setWarehouses(await getMyWarehousesApi());
      setEditing(true);
    } catch (err: unknown) {
      addToast(errorText(err, "Could not load your warehouses."), "error");
    }
  };

  const submit = async () => {
    if (!grn) return;
    try {
      setBusy("submit");
      setGrn(await submitGrnApi(grn.id));
      addToast(`GRN ${grn.grn_number} sent in for receipt posting.`, "success");
    } catch (err: unknown) {
      addToast(errorText(err, "Could not send it in."), "error");
    } finally {
      setBusy(null);
    }
  };

  const receive = async () => {
    if (!grn) return;
    try {
      setBusy("receive");
      setGrn(await postGrnReceiptApi(grn.id));
      addToast(`GRN ${grn.grn_number}: receipt posted. The goods are in quarantine for quality check.`, "success");
    } catch (err: unknown) {
      addToast(errorText(err, "Could not post the receipt."), "error");
    } finally {
      setBusy(null);
    }
  };

  const downloadPdf = async () => {
    if (!grn) return;
    try {
      setDownloading(true);
      await downloadGrnPdfApi(grn.id, grn.grn_number);
    } catch (err: unknown) {
      addToast(errorText(err, "Could not download the GRN."), "error");
    } finally {
      setDownloading(false);
    }
  };

  const cancel = async () => {
    if (!grn) return;
    const reason = window.prompt(`Why is GRN ${grn.grn_number} being cancelled?`);
    if (reason === null) return;
    if (!reason.trim()) {
      addToast("Say why it is cancelled.", "warning");
      return;
    }
    try {
      setBusy("cancel");
      setGrn(await cancelGrnApi(grn.id, reason.trim()));
      addToast(`GRN ${grn.grn_number} cancelled.`, "success");
    } catch (err: unknown) {
      addToast(errorText(err, "Could not cancel it."), "error");
    } finally {
      setBusy(null);
    }
  };

  if (!canView) {
    return (
      <ListPage>
        <p className="rounded-xl bg-white p-8 text-center text-[13px] text-[#777777] dark:bg-[#071929]">
          You do not have access to Stock In.
        </p>
      </ListPage>
    );
  }

  if (error) {
    return (
      <ListPage>
        <p role="alert" className="rounded-xl bg-white p-8 text-center text-[13px] text-rose-600 dark:bg-[#071929]">
          {error}
        </p>
        <Link href="/inventory/stock-in" className="text-[13px] text-[#233353] hover:underline">
          Back to Stock In
        </Link>
      </ListPage>
    );
  }

  if (!grn || !letterhead) {
    return (
      <div className="flex justify-center py-16 text-slate-400">
        <CgSpinner className="animate-spin text-3xl" />
      </div>
    );
  }

  if (editing) {
    return (
      <ListPage>
        <GrnForm
          warehouses={warehouses}
          editing={grn}
          onCancel={() => setEditing(false)}
          onSaved={(saved) => {
            setGrn(saved);
            setEditing(false);
          }}
        />
      </ListPage>
    );
  }

  return (
    <ListPage>
      <style>{PRINT_CSS}</style>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-label="Back to Stock In"
            onClick={() => router.push("/inventory/stock-in")}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-[#0b2034]"
          >
            <FiArrowLeft />
          </button>
          <h1 className="text-[18px] font-semibold text-slate-900 dark:text-white">GRN {grn.grn_number}</h1>
          <GrnStatusPill status={grn.status} />
        </div>
        <div className="flex flex-wrap gap-2">
          {canCreate && (grn.status === "DRAFT" || grn.status === "SUBMITTED") && (
            <Button variant="danger" size="sm" icon={<FiX />} loading={busy === "cancel"} onClick={cancel}>
              Cancel GRN
            </Button>
          )}
          {canCreate && grn.status === "DRAFT" && (
            <>
              <Button variant="outline" size="sm" icon={<FiEdit2 />} onClick={startEdit}>
                Edit
              </Button>
              <Button size="sm" icon={<FiSend />} loading={busy === "submit"} onClick={submit}>
                Send In
              </Button>
            </>
          )}
          {canPost && grn.status === "SUBMITTED" && (
            <Button size="sm" icon={<FiDownload />} loading={busy === "receive"} onClick={receive}>
              Post Receipt to Quarantine
            </Button>
          )}
          <Button variant="outline" size="sm" icon={<FiPrinter />} onClick={() => window.print()}>
            Print GRN
          </Button>
          <Button variant="outline" size="sm" icon={<FiFileText />} loading={downloading} onClick={downloadPdf}>
            Download PDF
          </Button>
        </div>
      </div>

      {grn.status === "CANCELLED" && grn.cancelled_reason && (
        <p role="note" className="rounded-xl border border-slate-300 bg-slate-50 p-3 text-[13px] text-slate-600 dark:bg-[#071929]">
          Cancelled: {grn.cancelled_reason}
        </p>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-5">
          {grn.status === "SUBMITTED" && !canPost && (
            <p className="rounded-xl border border-violet-300 bg-violet-50 p-3 text-[13px] text-violet-700 dark:bg-violet-950/20">
              Waiting for someone with &quot;Post GRN Receipt&quot; to post it. No stock has moved yet.
            </p>
          )}
          {grn.status === "QC_PENDING" && canApprove && <GrnQualityCheck grn={grn} onPosted={setGrn} />}
          {grn.status === "QC_PENDING" && !canApprove && (
            <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-[13px] text-amber-700 dark:bg-amber-950/20">
              Waiting for quality check by someone with &quot;Quality Check &amp; Post GRN to Stock&quot;.
            </p>
          )}
          <div className="rounded-xl border border-slate-200 dark:border-[#17304a]">
            <GrnSheet grn={grn} letterhead={letterhead} />
          </div>
        </div>
        <GrnProcess status={grn.status} poChosen poNumber={grn.po_number} />
      </div>
    </ListPage>
  );
}
