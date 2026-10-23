import api from "@/lib/axios";

/** Fetch a file from the API and hand it to the browser as a download. */
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
