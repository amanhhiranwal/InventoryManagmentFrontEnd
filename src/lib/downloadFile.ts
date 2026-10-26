import api from "@/lib/axios";

/**
 * Fetch a document the server draws - a sales order, a proforma invoice -
 * and save it as a file. Every Download button goes through here, so what
 * is downloaded is the same PDF that is emailed, with a proper name, and
 * never depends on anybody's print settings.
 */
export async function downloadFile(path: string, filename: string): Promise<void> {
  const { data } = await api.get(path, { responseType: "blob" });

  const url = URL.createObjectURL(new Blob([data], { type: "application/pdf" }));
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}
