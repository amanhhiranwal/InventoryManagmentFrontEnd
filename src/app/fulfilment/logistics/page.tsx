"use client";

/**
 * The logistics desk, under SCM.
 *
 * Orders production have made ready. Logistics upload the invoice copy,
 * the insurance copy and the docket slip - all three, before the order can
 * be dispatched - then mark it dispatched, out for delivery, and
 * delivered. Live courier tracking will come from Safexpress later; until
 * then these are the desk's own buttons. Rejecting puts the order on hold
 * with the reason.
 */

import { useEffect, useRef, useState } from "react";
import { CgSpinner } from "react-icons/cg";
import { FiFileText, FiTruck } from "react-icons/fi";
import { LuCheck, LuUpload } from "react-icons/lu";

import { useUIStore } from "@/lib/store/ui.store";
import {
  ATTACHMENT_ACCEPT,
  MAX_ATTACHMENT_BYTES,
  uploadAttachment,
} from "@/features/attachments/attachments.api";
import { useAttachmentPreview } from "@/features/attachments/AttachmentList";
import {
  DeskOrder,
  DispatchDocument,
  attachDispatchDocumentApi,
  getLogisticsDeskApi,
} from "@/features/fulfilment/api/fulfilment.api";
import DeskBoard, {
  DeskDetailContext,
} from "@/features/fulfilment/components/DeskBoard";
import { Panel } from "@/features/fulfilment/components/DeskPanels";
import { DeskWithHistory } from "@/features/fulfilment/components/DeskHistory";
import StockDetail from "@/features/fulfilment/components/StockDetail";
import { SALES_ORDER_STATUS } from "@/features/salesOrders/api/salesOrders.api";

const BUTTON: Record<string, string> = {
  [SALES_ORDER_STATUS.READY]: "Mark As Dispatched",
  [SALES_ORDER_STATUS.DISPATCHED]: "Mark Out For Delivery",
  [SALES_ORDER_STATUS.OUT_FOR_DELIVERY]: "Mark As Delivered",
};

export default function LogisticsDeskPage() {
  return (
    <DeskWithHistory desk="logistics">
      <DeskBoard
        title="Logistics"
        description="Upload the dispatch documents, send ready orders out, and mark them out for delivery and delivered."
        load={getLogisticsDeskApi}
        approveLabel={(order) => BUTTON[order.status] || "Confirm & Move On"}
        emptyNote="Nothing is ready to go out. Orders arrive here once production have marked them ready to dispatch."
        detail={(order, context) => (
          <LogisticsDetail key={order.id} order={order} context={context} />
        )}
      />
    </DeskWithHistory>
  );
}

function LogisticsDetail({
  order,
  context,
}: {
  order: DeskOrder;
  context: DeskDetailContext;
}) {
  const documents = order.documents || [];
  const missing = documents
    .filter((doc) => !doc.uploaded)
    .map((doc) => doc.label)
    .join(", ");
  const ready = order.status === SALES_ORDER_STATUS.READY;
  const goingOut = order.status === SALES_ORDER_STATUS.DISPATCHED;

  /* Out for delivery needs the vehicle and the driver taking it; the
     server refuses the move without both. */
  const [vehicle, setVehicle] = useState(order.delivery_vehicle_number || "");
  const [driver, setDriver] = useState(order.delivery_driver_name || "");
  const needs = [!vehicle.trim() && "vehicle number", !driver.trim() && "driver name"].filter(Boolean).join(" and ");

  const { setAction } = context;

  useEffect(() => {
    setAction({
      label: BUTTON[order.status],
      blocked: ready && missing
        ? `Upload the ${missing} first.`
        : goingOut && needs
          ? `Enter the ${needs} first.`
          : null,
      extra: goingOut ? { vehicle_number: vehicle.trim(), driver_name: driver.trim() } : undefined,
    });
  }, [order.status, missing, ready, goingOut, needs, vehicle, driver, setAction]);

  return (
    <div className="space-y-6">
      {goingOut && (
        <Panel title="Vehicle & Driver" icon={<FiTruck size={14} />}>
          <p className="text-[11px] text-[#777777] dark:text-slate-400">
            Both are needed to mark the order out for delivery. They are kept on the sales order.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="ld-vehicle" className="mb-1 block text-[10px] font-semibold text-slate-600 dark:text-slate-400">
                Vehicle Number <span className="text-rose-500">*</span>
              </label>
              <input
                id="ld-vehicle"
                required
                maxLength={30}
                value={vehicle}
                onChange={(event) => setVehicle(event.target.value.toUpperCase())}
                placeholder="e.g. DL 01 AB 1234"
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-[12px] uppercase text-slate-700 outline-none focus:border-[#233353] dark:border-[#17304a] dark:bg-[#071929] dark:text-white"
              />
            </div>
            <div>
              <label htmlFor="ld-driver" className="mb-1 block text-[10px] font-semibold text-slate-600 dark:text-slate-400">
                Driver Name <span className="text-rose-500">*</span>
              </label>
              <input
                id="ld-driver"
                required
                maxLength={120}
                value={driver}
                onChange={(event) => setDriver(event.target.value)}
                placeholder="Full name"
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-[12px] text-slate-700 outline-none focus:border-[#233353] dark:border-[#17304a] dark:bg-[#071929] dark:text-white"
              />
            </div>
          </div>
        </Panel>
      )}

      {order.status === SALES_ORDER_STATUS.OUT_FOR_DELIVERY && order.delivery_vehicle_number && (
        <Panel title="Vehicle & Driver" icon={<FiTruck size={14} />}>
          <p className="text-[12px] text-[#474747] dark:text-slate-200">
            {order.delivery_vehicle_number} · {order.delivery_driver_name}
          </p>
        </Panel>
      )}

      <Panel title="Dispatch Documents" icon={<FiFileText size={14} />}>
        <p className="text-[11px] text-[#777777] dark:text-slate-400">
          All three are needed before the order can be dispatched. They are kept
          on the sales order too.
        </p>

        <div className="space-y-2">
          {documents.map((doc) => (
            <DocumentSlot
              key={doc.kind}
              order={order}
              document={doc}
              onSaved={context.reload}
            />
          ))}
        </div>
      </Panel>

      {order.status === SALES_ORDER_STATUS.OUT_FOR_DELIVERY && (
        <p className="text-[11px] text-slate-400">
          Live tracking from Safexpress will show here once it is connected.
          Until then, mark the order delivered when the client has it.
        </p>
      )}

      <StockDetail order={order} desk="logistics" />
    </div>
  );
}

function DocumentSlot({
  order,
  document,
  onSaved,
}: {
  order: DeskOrder;
  document: DispatchDocument;
  onSaved: () => Promise<void>;
}) {
  const { addToast } = useUIStore();
  const preview = useAttachmentPreview();
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const choose = async (file?: File) => {
    if (!file) return;

    if (file.size > MAX_ATTACHMENT_BYTES) {
      addToast(`${file.name} is over 10MB.`, "error");
      return;
    }

    setUploading(true);

    try {
      const stored = await uploadAttachment(file);
      await attachDispatchDocumentApi(order.id, document.kind, stored);
      addToast(`${document.label} uploaded.`, "success");
      await onSaved();
    } catch (error) {
      addToast(
        (error as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || `${document.label} could not be uploaded.`,
        "error",
      );
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg bg-slate-50 px-3 py-2.5 dark:bg-[#0b2034]">
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
          document.uploaded
            ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
            : "bg-slate-200 text-slate-400 dark:bg-slate-800"
        }`}
      >
        {document.uploaded && <LuCheck size={12} />}
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium text-slate-800 dark:text-slate-100">
          {document.label}
        </p>

        {document.uploaded ? (
          <button
            type="button"
            onClick={() =>
              preview.open({
                name: document.name || document.label,
                key: document.key,
                size: document.size,
                type: document.type,
              })
            }
            className="max-w-full truncate text-left text-[11px] text-[#233353] hover:underline dark:text-sky-400"
          >
            {document.name || "Open"}
          </button>
        ) : (
          <p className="text-[11px] text-slate-400">Not uploaded</p>
        )}
      </div>

      <input
        ref={input}
        type="file"
        accept={ATTACHMENT_ACCEPT}
        className="hidden"
        aria-label={`Upload ${document.label}`}
        onChange={(event) => choose(event.target.files?.[0])}
      />

      <button
        type="button"
        disabled={uploading}
        onClick={() => input.current?.click()}
        className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-medium text-[#141414] transition hover:bg-slate-50 disabled:opacity-50 dark:border-[#17304a] dark:bg-[#071929] dark:text-slate-200"
      >
        {uploading ? (
          <CgSpinner className="animate-spin" size={12} />
        ) : (
          <LuUpload size={12} />
        )}
        {uploading ? "Uploading..." : document.uploaded ? "Replace" : "Upload"}
      </button>

      {preview.preview}
    </div>
  );
}
