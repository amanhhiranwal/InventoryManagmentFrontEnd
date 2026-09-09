"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  LuBold,
  LuItalic,
  LuUnderline,
  LuList,
  LuListOrdered,
  LuPaperclip,
  LuTable,
} from "react-icons/lu";

/**
 * Small rich-text field used by the quotation remarks and the Send Quotation
 * message body.
 *
 * The toolbar in the design was previously decorative; these buttons apply
 * real formatting. It edits a contenteditable region and reports both the
 * HTML (used for the text/html part of the outgoing email) and a plain-text
 * fallback (used for text/plain), so a mail client with HTML disabled still
 * gets a readable message.
 */

type Command =
  | "bold"
  | "italic"
  | "underline"
  | "insertUnorderedList"
  | "insertOrderedList";

interface FormatButton {
  key: string;
  label: string;
  icon: typeof LuBold;
  command: Command;
}

/* Order matches the design: B, I, U, bulleted, numbered, attach, table. */
const FORMAT_BUTTONS: FormatButton[] = [
  { key: "bold", label: "Bold", icon: LuBold, command: "bold" },
  { key: "italic", label: "Italic", icon: LuItalic, command: "italic" },
  {
    key: "underline",
    label: "Underline",
    icon: LuUnderline,
    command: "underline",
  },
  {
    key: "ul",
    label: "Bulleted list",
    icon: LuList,
    command: "insertUnorderedList",
  },
  {
    key: "ol",
    label: "Numbered list",
    icon: LuListOrdered,
    command: "insertOrderedList",
  },
];

/** Turns editor HTML back into readable plain text for the text/plain part. */
export function htmlToText(html: string) {
  if (typeof document === "undefined") return html;

  const holder = document.createElement("div");

  holder.innerHTML = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-4]|tr)>/gi, "\n")
    .replace(/<\/t[dh]>/gi, "\t")
    .replace(/<li[^>]*>/gi, "• ");

  return (holder.textContent || "").replace(/\n{3,}/g, "\n\n").trim();
}

/** Escapes plain text into the HTML the editor starts from. */
export function textToHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br/>");
}

const TABLE_HTML =
  '<table border="1" cellpadding="6" cellspacing="0" ' +
  'style="border-collapse:collapse;width:100%">' +
  "<tbody>" +
  "<tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>" +
  "<tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>" +
  "</tbody></table><br/>";

export default function RichTextEditor({
  label,
  value,
  onChange,
  onAttach,
  attachAccept = ".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg",
  placeholder,
  minHeight = 140,
  ariaLabel,
}: {
  /**
   * Field caption. Rendered on the same row as the toolbar, which is how
   * the design has it - passing it in here rather than letting the page
   * render its own heading is what keeps the two on one line.
   */
  label?: string;
  /** Current HTML. */
  value: string;
  onChange: (html: string, text: string) => void;
  /**
   * Called with the files chosen from the paperclip button. Omit to hide
   * the attach control.
   */
  onAttach?: (files: File[]) => void;
  attachAccept?: string;
  placeholder?: string;
  minHeight?: number;
  ariaLabel?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [active, setActive] = useState<Record<string, boolean>>({});

  /* Write incoming HTML only when it differs, otherwise React would reset
     the caret to the start on every keystroke. */
  useEffect(() => {
    const node = ref.current;

    if (node && node.innerHTML !== value) {
      node.innerHTML = value || "";
    }
  }, [value]);

  const refreshActive = () => {
    if (typeof document === "undefined") return;

    const next: Record<string, boolean> = {};

    for (const button of FORMAT_BUTTONS) {
      try {
        next[button.key] = document.queryCommandState(button.command);
      } catch {
        next[button.key] = false;
      }
    }

    setActive(next);
  };

  const emit = () => {
    const node = ref.current;

    if (!node) return;

    onChange(node.innerHTML, htmlToText(node.innerHTML));
  };

  const run = (command: Command | "insertTable") => {
    const node = ref.current;

    if (!node) return;

    node.focus();

    if (command === "insertTable") {
      document.execCommand("insertHTML", false, TABLE_HTML);
    } else {
      document.execCommand(command);
    }

    emit();
    refreshActive();
  };

  const handleFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);

    if (files.length && onAttach) onAttach(files);

    /* Reset so picking the same file twice still fires a change. */
    event.target.value = "";
  };

  const empty = !value || value === "<br>";

  /* Mouse-down default would blur the editor and drop the selection before
     the command could apply to it. */
  const keepSelection = (event: { preventDefault: () => void }) =>
    event.preventDefault();

  const buttonClass = (on: boolean) =>
    `flex h-7 w-7 items-center justify-center rounded border transition ${
      on
        ? "border-[#233353] bg-[#233353] text-white"
        : "border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-[#17304a] dark:hover:bg-[#0b2034]"
    }`;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        {label ? (
          <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
            {label}
          </p>
        ) : (
          <span />
        )}

        <div className="flex shrink-0 items-center gap-1">
          {FORMAT_BUTTONS.map((button) => {
          const Icon = button.icon;

          return (
            <button
              key={button.key}
              type="button"
              title={button.label}
              aria-label={button.label}
              aria-pressed={!!active[button.key]}
              onMouseDown={keepSelection}
              onClick={() => run(button.command)}
              className={buttonClass(!!active[button.key])}
            >
              <Icon size={12} />
            </button>
          );
        })}

        {onAttach && (
          <>
            <button
              type="button"
              title="Attach a file from this computer"
              aria-label="Attach file"
              onMouseDown={keepSelection}
              onClick={() => fileRef.current?.click()}
              className={buttonClass(false)}
            >
              <LuPaperclip size={12} />
            </button>

            <input
              ref={fileRef}
              type="file"
              multiple
              accept={attachAccept}
              hidden
              onChange={handleFiles}
            />
          </>
        )}

          <button
            type="button"
            title="Insert table"
            aria-label="Insert table"
            onMouseDown={keepSelection}
            onClick={() => run("insertTable")}
            className={buttonClass(false)}
          >
            <LuTable size={12} />
          </button>
        </div>
      </div>

      <div className="relative">
        {empty && placeholder && (
          <span className="pointer-events-none absolute left-3 top-3 text-[11px] text-slate-400">
            {placeholder}
          </span>
        )}

        <div
          ref={ref}
          role="textbox"
          aria-multiline="true"
          aria-label={ariaLabel}
          contentEditable
          suppressContentEditableWarning
          onInput={emit}
          onBlur={emit}
          onKeyUp={refreshActive}
          onMouseUp={refreshActive}
          style={{ minHeight }}
          className="w-full overflow-y-auto rounded-lg border border-slate-200 bg-white px-3 py-3 text-[11px] leading-relaxed text-slate-700 outline-none transition focus:border-[#233353] dark:border-[#17304a] dark:bg-[#071929] dark:text-slate-200 [&_li]:ml-4 [&_ol]:list-decimal [&_table]:my-2 [&_table]:w-full [&_td]:border [&_td]:border-slate-300 [&_td]:p-1.5 [&_ul]:list-disc"
        />
      </div>
    </div>
  );
}
