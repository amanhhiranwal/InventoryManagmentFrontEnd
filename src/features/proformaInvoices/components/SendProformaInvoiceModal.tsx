"use client";

import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { LuFileSpreadsheet, LuFileText, LuSend, LuUser, LuX } from "react-icons/lu";
import { CgSpinner } from "react-icons/cg";

import RichTextEditor, { textToHtml } from "@/components/crm/RichTextEditor";
import {
  getQuotationSenderApi,
  type QuotationSender,
} from "@/features/quotations/api/quotations.api";
import {
  sendProformaInvoiceApi,
  type ProformaInvoiceModel,
} from "@/features/proformaInvoices/api/proformaInvoices.api";
import { money } from "@/features/proformaInvoices/components/ProformaParts";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type OptionKey =
  | "track_opens"
  | "alert_on_download"
  | "attach_gst_audit_trail"
  | "notify_lead_owner";

const SEND_OPTIONS: { key: OptionKey; label: string }[] = [
  { key: "track_opens", label: "Track Email Opens (Read Receipt)" },
  { key: "alert_on_download", label: "Instant Alert on Proforma Invoice PDF Download" },
  { key: "attach_gst_audit_trail", label: "Attach GST Digital Signature Audit Trail" },
  { key: "notify_lead_owner", label: "Notify Lead Owner upon Client Interaction" },
];

export default function SendProformaInvoiceModal({
  invoice,
  onClose,
  onSent,
  onError,
  onNotice,
}: {
  invoice: ProformaInvoiceModel;
  onClose: () => void;
  onSent: (updated: ProformaInvoiceModel, message: string) => void;
  onError: (message: string) => void;
  onNotice: (message: string) => void;
}) {
  const contact = (invoice.customer_information?.primary_contact || {}) as Record<
    string,
    string
  >;

  const reference = invoice.pi_number || `PI-${invoice.id}`;
  const company = invoice.company_name || invoice.customer_name;

  const [sender, setSender] = useState<QuotationSender | null>(null);
  const [to, setTo] = useState<string[]>(contact.email ? [contact.email] : []);
  const [cc, setCc] = useState<string[]>([]);
  const [bcc, setBcc] = useState<string[]>([]);
  const [showBcc, setShowBcc] = useState(false);

  const [subject, setSubject] = useState(
    `Proforma Invoice #${reference} — ${company} [Payment Mobilization Request]`,
  );

  const defaultBody = useMemo(
    () =>
      [
        `Dear ${contact.name || invoice.customer_name || "Sir/Madam"},`,
        "",
        `Please find attached the official Proforma Invoice (#${reference}) for ${company}.`,
        "",
        "Key Highlights:",
        ...invoice.items.map(
          (item) =>
            `• ${item.quantity_case ?? item.qty ?? 1}x ${
              item.model || item.description || item.product || "Item"
            }`,
        ),
        `• Total Value: ${money(invoice.grand_total)} (inclusive of ${Number(
          invoice.gst_percent,
        )}% GST)`,
        "",
        "Kindly review the attached proforma invoice and let us know if you require any adjustments or technical clarifications.",
        "",
        "Warm regards,",
      ].join("\n"),
    [contact.name, invoice, reference, company],
  );

  const [body, setBody] = useState(defaultBody);
  const [bodyHtml, setBodyHtml] = useState(() => textToHtml(defaultBody));

  const [options, setOptions] = useState<Record<OptionKey, boolean>>({
    track_opens: true,
    alert_on_download: true,
    attach_gst_audit_trail: true,
    notify_lead_owner: true,
  });

  const [dropped, setDropped] = useState<string[]>([]);
  const [sending, setSending] = useState(false);

  const toRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    getQuotationSenderApi()
      .then(setSender)
      .catch(() => setSender(null));
  }, []);

  const send = async (testOnly: boolean) => {
    if (!testOnly) {
      if (to.length === 0) {
        onError("Add at least one recipient before sending.");
        return;
      }

      const invalid = [...to, ...cc, ...bcc].find((address) => !EMAIL_PATTERN.test(address));

      if (invalid) {
        onError(`"${invalid}" is not a valid email address.`);
        return;
      }
    }

    setSending(true);

    try {
      const updated = await sendProformaInvoiceApi(invoice.id, {
        to,
        cc,
        bcc,
        subject,
        body,
        body_html: bodyHtml,
        ...options,
        test_only: testOnly,
      });

      if (testOnly) {
        onNotice("Test email sent to your own address.");
        return;
      }

      onSent(updated, `#${reference} emailed to ${to.join(", ")}.`);
    } catch (error) {
      const detail =
        (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "The proforma invoice could not be sent.";

      onError(detail);
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKey);

    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const files = (invoice.attachments || []).filter((file) => !dropped.includes(file.name));

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-5">
      <div className="flex max-h-[92vh] w-full max-w-[920px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-[#051422]">
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 px-6 dark:border-[#17304a]">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-white">
            Send Proforma Invoice to Client
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="text-slate-400 transition hover:text-slate-700"
          >
            <LuX size={17} />
          </button>
        </div>

        <div className="grid flex-1 grid-cols-1 gap-5 overflow-y-auto p-6 lg:grid-cols-[minmax(0,1fr)_220px]">
          <div>
            <div className="rounded-xl bg-slate-100 px-4 py-1 dark:bg-[#0b2034]">
              {/* Every invoice leaves through the one configured SMTP account,
                  so the sender is shown rather than chosen. */}
              <HeaderRow label="FROM">
                <Chip>
                  {sender?.name || "Synergy CRM Portal"}
                  {sender?.email ? `(${sender.email})` : ""}
                </Chip>
              </HeaderRow>

              <HeaderRow
                label="TO"
                trailing={
                  <button
                    type="button"
                    onClick={() => toRef.current?.focus()}
                    className="whitespace-nowrap text-[10px] font-medium text-blue-600"
                  >
                    + Add Recipient
                  </button>
                }
              >
                <ChipInput inputRef={toRef} values={to} onChange={setTo} placeholder="client@company.com" />
              </HeaderRow>

              <HeaderRow
                label="CC"
                trailing={
                  <button
                    type="button"
                    onClick={() => setShowBcc((value) => !value)}
                    className="whitespace-nowrap text-[10px] font-medium text-blue-600"
                  >
                    + BCC
                  </button>
                }
              >
                <ChipInput values={cc} onChange={setCc} placeholder="Add CC" />
              </HeaderRow>

              {showBcc && (
                <HeaderRow label="BCC">
                  <ChipInput values={bcc} onChange={setBcc} placeholder="Add BCC" />
                </HeaderRow>
              )}

              <div className="flex items-center gap-3 py-2.5">
                <span className="w-16 shrink-0 text-right text-[10px] text-slate-500">SUBJECT</span>
                <input
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  className="h-11 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-[12px] text-slate-800 outline-none focus:border-[#233353] dark:border-[#17304a] dark:bg-[#071929] dark:text-white"
                />
              </div>
            </div>

            <div className="mt-5">
              <RichTextEditor
                label="Message Body"
                value={bodyHtml}
                onChange={(html, text) => {
                  setBodyHtml(html);
                  setBody(text);
                }}
                ariaLabel="Message body"
                minHeight={210}
              />
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-xl border border-slate-200 p-3 dark:border-[#17304a]">
              <p className="mb-3 border-b border-slate-200 pb-2 text-[11px] font-semibold text-slate-600 dark:border-[#17304a] dark:text-slate-300">
                Attached Documents &amp; Annexures
              </p>

              {files.length === 0 ? (
                <p className="text-[10px] text-slate-400">
                  No annexures attached to this invoice.
                </p>
              ) : (
                <div className="space-y-2">
                  {files.map((file) => {
                    const sheet = /\.(xlsx?|csv)$/i.test(file.name);

                    return (
                      <div
                        key={file.name}
                        className={`flex items-center gap-2 rounded-lg px-2.5 py-2 ${
                          sheet ? "bg-emerald-50" : "bg-rose-50"
                        }`}
                      >
                        {sheet ? (
                          <LuFileSpreadsheet size={14} className="shrink-0 text-emerald-600" />
                        ) : (
                          <LuFileText size={14} className="shrink-0 text-rose-500" />
                        )}
                        <span className="flex-1 truncate text-[10px] font-semibold text-slate-800">
                          {file.name}
                        </span>
                        <button
                          type="button"
                          aria-label={`Remove ${file.name}`}
                          onClick={() => setDropped((current) => [...current, file.name])}
                          className="shrink-0 text-slate-700 hover:text-rose-500"
                        >
                          <LuX size={12} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 p-3 dark:border-[#17304a]">
              <p className="mb-3 border-b border-slate-200 pb-2 text-[11px] font-semibold text-slate-600 dark:border-[#17304a] dark:text-slate-300">
                Statutory &amp; Operational Clauses
              </p>

              <div className="space-y-2.5">
                {SEND_OPTIONS.map((option) => (
                  <label key={option.key} className="flex cursor-pointer items-start gap-2.5">
                    <input
                      type="checkbox"
                      checked={options[option.key]}
                      onChange={(event) =>
                        setOptions((current) => ({ ...current, [option.key]: event.target.checked }))
                      }
                      className="mt-0.5 h-3.5 w-3.5 cursor-pointer rounded border-slate-300 accent-[#233353]"
                    />
                    <span className="text-[10px] leading-relaxed text-slate-700 dark:text-slate-300">
                      {option.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 dark:border-[#17304a] dark:bg-[#071929]">
          <button
            type="button"
            onClick={() => send(true)}
            disabled={sending}
            className="flex items-center gap-2 text-xs font-semibold text-blue-600 transition hover:text-blue-700 disabled:opacity-50"
          >
            <LuSend size={14} />
            Send Test Email To Self
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-5 text-xs font-semibold text-rose-500 transition hover:bg-rose-50"
            >
              <LuX size={14} />
              Cancel
            </button>

            <button
              type="button"
              onClick={() => send(false)}
              disabled={sending}
              className="flex h-10 items-center gap-2 rounded-lg bg-[#233353] px-5 text-xs font-bold text-white transition hover:bg-[#18243a] disabled:opacity-50"
            >
              {sending ? <CgSpinner className="animate-spin" size={14} /> : <LuSend size={14} />}
              {sending ? "Sending..." : "Send Proforma Invoice"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-200 px-2 py-1 text-[10px] text-slate-700 dark:bg-[#071929] dark:text-slate-200">
      <LuUser size={10} className="text-slate-500" />
      {children}
    </span>
  );
}

function HeaderRow({
  label,
  children,
  trailing,
}: {
  label: string;
  children: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-slate-200 py-2 dark:border-[#17304a]">
      <span className="w-16 shrink-0 text-right text-[10px] text-slate-500">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
      {trailing}
    </div>
  );
}

/** Each address is a removable chip; the tail commits on Enter, comma or blur. */
function ChipInput({
  values,
  onChange,
  placeholder,
  inputRef,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}) {
  const [draft, setDraft] = useState("");

  const commit = () => {
    const entries = draft
      .split(/[,;\s]+/)
      .map((part) => part.trim())
      .filter((part) => part && !values.includes(part));

    if (entries.length) onChange([...values, ...entries]);

    setDraft("");
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {values.map((address) => (
        <span
          key={address}
          className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] ${
            EMAIL_PATTERN.test(address)
              ? "bg-slate-200 text-slate-700 dark:bg-[#071929] dark:text-slate-200"
              : "bg-rose-50 text-rose-600"
          }`}
        >
          <LuUser size={10} className="text-slate-500" />
          {address}
          <button
            type="button"
            aria-label={`Remove ${address}`}
            onClick={() => onChange(values.filter((entry) => entry !== address))}
            className="text-slate-600 hover:text-rose-500"
          >
            <LuX size={10} />
          </button>
        </span>
      ))}

      <input
        ref={inputRef}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === ",") {
            event.preventDefault();
            commit();
          } else if (event.key === "Backspace" && !draft && values.length) {
            onChange(values.slice(0, -1));
          }
        }}
        onBlur={commit}
        placeholder={values.length ? "" : placeholder}
        className="min-w-[120px] flex-1 bg-transparent py-1 text-[11px] text-slate-700 outline-none dark:text-slate-200"
      />
    </div>
  );
}
