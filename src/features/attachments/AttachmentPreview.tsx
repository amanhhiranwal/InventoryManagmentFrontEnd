"use client";

/* Opening an attachment without leaving the record.
 *
 * A PDF and an image are shown here, because those are what people
 * attach and glance at - a purchase order, a signed page, a photograph
 * of a site. Word and Excel cannot be drawn by a browser, so those offer
 * the download rather than pretending.
 *
 * Shown over the page rather than in a new tab: the question being asked
 * is nearly always "is this the right document", and the answer belongs
 * beside the record that raised it. */

import { useEffect, useState } from "react";
import { FiDownload, FiFileText, FiX } from "react-icons/fi";

import {
  StoredAttachment,
  attachmentKind,
  attachmentObjectUrl,
  formatAttachmentSize,
} from "./attachments.api";

interface Props {
  file: StoredAttachment | null;
  onClose: () => void;
}

export default function AttachmentPreview({ file, onClose }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const key = file?.key;

  useEffect(() => {
    if (!key) {
      setUrl(null);
      return;
    }

    let live = true;
    let made: string | null = null;

    setLoading(true);
    setError(null);

    attachmentObjectUrl(key)
      .then((objectUrl) => {
        made = objectUrl;

        // The dialog may already have been closed by the time this
        // lands; releasing it here keeps the blob from outliving it.
        if (!live) {
          URL.revokeObjectURL(objectUrl);
          return;
        }

        setUrl(objectUrl);
      })
      .catch(() => {
        if (live) setError("This file could not be opened.");
      })
      .finally(() => {
        if (live) setLoading(false);
      });

    return () => {
      live = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [key]);

  useEffect(() => {
    if (!file) return;

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onEscape);

    return () => window.removeEventListener("keydown", onEscape);
  }, [file, onClose]);

  if (!file) return null;

  const kind = attachmentKind(file);

  return (
    <div
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm"
    >
      <div className="flex h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-xl dark:bg-[#0b2034]">
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3 dark:border-[#17304a]">
          <FiFileText size={15} className="shrink-0 text-rose-500" />

          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-semibold text-slate-800 dark:text-slate-100">
              {file.name}
            </p>

            {file.size ? (
              <p className="text-[10px] text-slate-400">
                {formatAttachmentSize(file.size)}
              </p>
            ) : null}
          </div>

          {url && (
            <a
              href={url}
              download={file.name}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50 dark:border-[#17304a] dark:text-slate-300 dark:hover:bg-[#0d2336]"
            >
              <FiDownload size={12} />
              Download
            </a>
          )}

          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-[#0d2336]"
          >
            <FiX size={16} />
          </button>
        </div>

        <div className="flex flex-1 items-center justify-center overflow-auto bg-slate-50 dark:bg-[#071a2b]">
          {!file.key ? (
            <Message
              title="This file was never stored"
              detail="It was attached before the CRM kept the file itself, so only its name is on the record. Attach it again to be able to open it."
            />
          ) : loading ? (
            <Message title="Opening..." />
          ) : error ? (
            <Message title={error} />
          ) : !url ? null : kind === "pdf" ? (
            <iframe
              src={url}
              title={file.name}
              className="h-full w-full border-0 bg-white"
            />
          ) : kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt={file.name}
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <Message
              title="This one opens in its own application"
              detail="Word and Excel files cannot be shown in a browser. Download it to read it."
            />
          )}
        </div>
      </div>
    </div>
  );
}

function Message({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="max-w-sm px-6 py-10 text-center">
      <p className="text-[12px] font-semibold text-slate-600 dark:text-slate-300">
        {title}
      </p>

      {detail && (
        <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
          {detail}
        </p>
      )}
    </div>
  );
}
