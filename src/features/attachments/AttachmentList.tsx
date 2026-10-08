"use client";

/* The attached files on a record, as rows you can open.
 *
 * One component for every screen that lists them, so a document behaves
 * the same whether it is hanging off a lead, a proposal, an order or an
 * invoice: click it and it opens. */

import { ReactNode, useCallback, useState } from "react";
import { FiEye, FiFileText, FiX } from "react-icons/fi";

import AttachmentPreview from "./AttachmentPreview";
import {
  StoredAttachment,
  formatAttachmentSize,
} from "./attachments.api";

/** Gives a page the dialog and a way to open it, so each screen keeps
 *  its own markup and only borrows the opening. */
export function useAttachmentPreview() {
  const [showing, setShowing] = useState<StoredAttachment | null>(null);

  const close = useCallback(() => setShowing(null), []);

  return {
    open: useCallback((file: StoredAttachment) => setShowing(file), []),
    close,
    preview: <AttachmentPreview file={showing} onClose={close} /> as ReactNode,
  };
}

interface RowProps {
  file: StoredAttachment;
  onOpen: (file: StoredAttachment) => void;
  onRemove?: () => void;
  /** Shown while the file is still going up. */
  uploading?: boolean;
}

export function AttachmentRow({ file, onOpen, onRemove, uploading }: RowProps) {
  const openable = Boolean(file.key) && !uploading;

  return (
    <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2.5 dark:bg-[#0b2034]">
      <FiFileText size={12} className="shrink-0 text-rose-500" />

      <button
        type="button"
        disabled={!openable}
        onClick={() => onOpen(file)}
        title={
          openable
            ? "Open this document"
            : uploading
              ? "Uploading..."
              : "Attached before the CRM kept the file itself"
        }
        className={`min-w-0 flex-1 truncate text-left text-[11px] font-semibold ${
          openable
            ? "text-slate-700 hover:text-[#233353] hover:underline dark:text-slate-200 dark:hover:text-white"
            : "cursor-default text-slate-400"
        }`}
      >
        {file.name}
      </button>

      {file.size ? (
        <span className="shrink-0 text-[10px] text-slate-400">
          {formatAttachmentSize(file.size)}
        </span>
      ) : null}

      {uploading ? (
        <span className="shrink-0 text-[10px] font-medium text-slate-400">
          Uploading...
        </span>
      ) : openable ? (
        <button
          type="button"
          onClick={() => onOpen(file)}
          aria-label={`Preview ${file.name}`}
          className="shrink-0 rounded p-1 text-slate-400 hover:bg-white hover:text-[#233353] dark:hover:bg-[#0d2336] dark:hover:text-white"
        >
          <FiEye size={12} />
        </button>
      ) : null}

      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${file.name}`}
          className="shrink-0 rounded p-1 text-slate-400 hover:bg-white hover:text-rose-500 dark:hover:bg-[#0d2336]"
        >
          <FiX size={12} />
        </button>
      )}
    </div>
  );
}

interface ListProps {
  files: StoredAttachment[];
  onRemove?: (index: number) => void;
  uploadingCount?: number;
  empty?: string;
}

/** The whole list plus its dialog, for a page that wants both in one. */
export function AttachmentList({
  files,
  onRemove,
  uploadingCount = 0,
  empty,
}: ListProps) {
  const { open, preview } = useAttachmentPreview();

  if (!files.length && !uploadingCount) {
    return empty ? (
      <p className="py-2 text-[10px] text-slate-400">{empty}</p>
    ) : null;
  }

  return (
    <>
      <div className="space-y-2">
        {files.map((file, index) => (
          <AttachmentRow
            key={`${file.key || file.name}-${index}`}
            file={file}
            onOpen={open}
            onRemove={onRemove ? () => onRemove(index) : undefined}
          />
        ))}

        {Array.from({ length: uploadingCount }).map((_, index) => (
          <AttachmentRow
            key={`uploading-${index}`}
            file={{ name: "Uploading..." }}
            onOpen={() => {}}
            uploading
          />
        ))}
      </div>

      {preview}
    </>
  );
}
