/* Files attached to a record - storing them, and reading them back.
 *
 * Every form that took a file used to keep only its name, size and type:
 * the bytes stayed in the browser and went with the tab. A sales order
 * listed the customer's PO and nobody could open it. Now the file goes to
 * the server as soon as it is chosen, and the record keeps the key that
 * comes back.
 *
 * Reading one needs the signed-in user's token, so a preview cannot be an
 * <img src> or an <iframe src> pointing at the API - the browser sends no
 * Authorization header on those. The file is fetched here instead and
 * handed over as a blob: URL, which those tags can show. */

import api from "@/lib/axios";

export interface StoredAttachment {
  /** What the person called it, which is what the list shows. */
  name: string;
  size?: number;
  type?: string;
  /** What the server stored it as. Without one there is nothing to open:
   *  a record saved before this existed carries a name and no file. */
  key?: string;
}

/** Older records hold a bare filename, or metadata with no key. Both read
 *  as an attachment with nothing behind it, which is the truth. */
export function asAttachment(
  value: string | StoredAttachment | null | undefined,
): StoredAttachment {
  if (typeof value === "string") return { name: value };

  return {
    name: value?.name || "Attachment",
    size: value?.size,
    type: value?.type,
    key: value?.key,
  };
}

export function asAttachments(
  values: Array<string | StoredAttachment> | null | undefined,
): StoredAttachment[] {
  return (values || []).map(asAttachment);
}

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export const ATTACHMENT_ACCEPT =
  ".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp";

/** Store one file. Throws with a readable message if the server refuses. */
export async function uploadAttachment(file: File): Promise<StoredAttachment> {
  const body = new FormData();
  body.append("file", file);

  const response = await api.post("/api/v1/attachments", body, {
    headers: { "Content-Type": "multipart/form-data" },
    // A 10MB file over a slow line outlasts the client's default.
    timeout: 120000,
    skipErrorToast: true,
  });

  return response.data?.data as StoredAttachment;
}

/** Store several, reporting each one that would not go rather than
 *  failing the whole set: one oversized file should not lose the rest. */
export async function uploadAttachments(
  files: File[],
  onRefused?: (file: File, reason: string) => void,
): Promise<StoredAttachment[]> {
  const stored: StoredAttachment[] = [];

  for (const file of files) {
    try {
      stored.push(await uploadAttachment(file));
    } catch (error) {
      const reason =
        (error as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Could not be uploaded.";

      onRefused?.(file, reason);
    }
  }

  return stored;
}

/** The file itself, as a URL an <iframe> or <img> can be pointed at.
 *  The caller revokes it when the preview closes. */
export async function attachmentObjectUrl(key: string): Promise<string> {
  const response = await api.get(`/api/v1/attachments/${key}`, {
    responseType: "blob",
    timeout: 120000,
    skipErrorToast: true,
  });

  return URL.createObjectURL(response.data as Blob);
}

export function formatAttachmentSize(size?: number): string {
  if (!size && size !== 0) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export type AttachmentKind = "pdf" | "image" | "office" | "other";

export function attachmentKind(file: StoredAttachment): AttachmentKind {
  const name = (file.key || file.name || "").toLowerCase();
  const type = (file.type || "").toLowerCase();

  if (type === "application/pdf" || name.endsWith(".pdf")) return "pdf";

  if (type.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/.test(name)) {
    return "image";
  }

  if (/\.(docx?|xlsx?|csv)$/.test(name) || type.includes("officedocument")) {
    return "office";
  }

  return "other";
}
