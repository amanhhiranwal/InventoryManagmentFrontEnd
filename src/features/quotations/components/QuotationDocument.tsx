"use client";

/**
 * The quotation as the client receives it.
 *
 * Mirrors app/services/quotation_pdf_service on the backend page for page:
 * the cover with the product photo, the white logo and PROPOSAL, the About
 * text, the document details and the two parties; then, on the tinted
 * pages, the supply summary, the totals, the payment schedule beside the
 * terms, and who issued it. The brand details and images come from the
 * same endpoints the PDF reads, so what is previewed and what is sent
 * cannot drift apart.
 *
 * Laid out at a fixed A4 width rather than responsively, because the
 * printed page is narrower than the screen breakpoints - a responsive
 * layout previewed differently from how it printed.
 */

import {
  QuotationModel,
  quotationBrandLogoUrl,
} from "@/features/quotations/api/quotations.api";
import type { QuotationBrand } from "@/features/quotations/api/quotations.api";
import { amountInWords } from "@/features/quotations/amountInWords";
import {
  companyCoverImageUrl,
  companyCoverLogoUrl,
} from "@/features/settings/api/companyProfile.api";

/** The printed proposal's colours, as the PDF draws them. */
const NAVY = "#233353";
const MAROON = "#a3324c";
const TEAL = "#4a8190";
const LABEL = "#5b7590";
const TINT = "#eff4f8";
const BOX = "#eef3f7";
const PANEL = "#f6f9fb";
const RULE = "#dde4ea";

/** Indian grouping, as the printed proposal uses: 1,23,456.00 */
const money = (value?: number | null) =>
  Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const shownDate = (value?: string | null) =>
  value
    ? new Date(value).toLocaleDateString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

/** A name over a designation that reads the same is printed once. */
const withoutRepeats = (lines: (string | null | undefined)[]) => {
  const seen = new Set<string>();

  return lines.filter((line) => {
    const value = (line || "").trim();

    if (!value || seen.has(value.toLowerCase())) return false;

    seen.add(value.toLowerCase());

    return true;
  }) as string[];
};

export default function QuotationDocument({
  quotation,
  brand,
}: {
  quotation: QuotationModel;
  brand: QuotationBrand | null;
}) {
  const company = brand?.name || "Synergy Group";
  const brandName = brand?.brand_name || company.split(" ")[0];
  const logo = quotationBrandLogoUrl(quotation.id, quotation.company_id);
  const items = quotation.items || [];
  const gstPercent = Number(quotation.gst_percent || 0);

  /* Who the client has actually been dealing with, not the company's
     standing signatory. */
  const sender = brand?.sender;

  const address =
    quotation.billing_address && typeof quotation.billing_address === "object"
      ? (quotation.billing_address as Record<string, unknown>)
      : {};
  const text = (value: unknown) => String(value ?? "").trim();

  const billTo = {
    name: quotation.organization_name || quotation.contact_name || "—",
    attention:
      quotation.organization_name && quotation.contact_name
        ? `Attn: ${quotation.contact_name}`
        : null,
    lines: [
      text(address.street),
      [
        text(address.city),
        [text(address.state), text(address.zipCode ?? address.zip_code)]
          .filter(Boolean)
          .join(" "),
        text(address.country),
      ]
        .filter(Boolean)
        .join(", "),
    ].filter(Boolean),
  };

  const preparedName = sender?.name || brand?.signatory || company;
  const preparedLines = withoutRepeats([
    preparedName,
    sender ? sender.title : brand?.signatory ? brand?.signatory_title : null,
    company.toUpperCase(),
    sender
      ? [sender.phone, sender.email].filter(Boolean).join("  |  ")
      : [brand?.phone, brand?.email].filter(Boolean).join("  |  "),
  ]).slice(1);

  const advance = Number(quotation.advance_percent || 0);
  const total = Number(quotation.total_payable || 0);
  const advanceAmount = Number(quotation.advance_amount || (total * advance) / 100);
  const balance = Number(quotation.on_delivery_amount ?? total - advanceAmount);

  /* Delivery and installation are only listed when there are any;
     discount and ORC are internal margin and never appear. */
  const charges =
    Number(quotation.freight_charges) > 0 ||
    Number(quotation.installation_lumpsum) > 0;

  const terms = [
    `Offer valid through ${shownDate(quotation.validation_date)}; reconfirm thereafter.`,
    `Taxes shown at ${gstPercent}%; final tax will be charged at the rate applicable on the tax invoice date.`,
    ...(quotation.terms || [])
      .filter((term) => term?.checked && term?.label)
      .map((term) => String(term.label)),
  ];

  const issuedBy = withoutRepeats([
    sender?.name || brand?.signatory || company,
    sender?.title || brand?.signatory_title,
  ]).join("  |  ");

  const services = (brand?.services_line || "")
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean)
    .join("  |  ")
    .toUpperCase();

  return (
    <div className="mx-auto w-[794px] text-[#1f2937]">
      {/* ---------------- COVER ---------------- */}
      <section className="relative h-[1123px] overflow-hidden bg-white">
        <div className="absolute inset-x-0 top-0">
          <img
            src={companyCoverImageUrl()}
            alt=""
            className="block w-full"
            onError={(event) => {
              (event.target as HTMLImageElement).style.visibility = "hidden";
            }}
          />
          {/* The foot of the photo fades into the page, as printed. */}
          <span
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-[28%]"
            style={{ background: "linear-gradient(to bottom, rgba(255,255,255,0), #fff)" }}
          />
        </div>

        <img
          src={companyCoverLogoUrl()}
          alt=""
          className="absolute left-1/2 top-[60px] max-h-[60px] max-w-[295px] -translate-x-1/2 object-contain"
          onError={(event) => {
            (event.target as HTMLImageElement).style.display = "none";
          }}
        />

        <h1 className="absolute inset-x-0 top-[548px] text-center text-[61px] font-bold leading-none tracking-tight text-[#111]">
          PROPOSAL
        </h1>

        <div className="absolute inset-x-[38px] top-[643px]">
          <h2 className="text-[21px] font-bold leading-[27px]">About {brandName}</h2>

          {(brand?.about || []).map((paragraph, index) => (
            <p
              key={index}
              className="mt-[8px] text-justify text-[13.7px] leading-[22.4px]"
            >
              {paragraph}
            </p>
          ))}

          {brand?.tagline && (
            <p className="mt-[19px] text-[13.7px] font-bold">{brand.tagline}</p>
          )}

          <div className="mx-[11px] mt-[30px] flex items-end justify-between gap-6">
            <p className="pb-[2px] pl-[6px] text-[12.5px]">
              For order confirmation and advance payment processing
            </p>

            <div
              className="w-[265px] shrink-0 border px-[19px] py-[19px] text-[11px] leading-[14px]"
              style={{ background: BOX, borderColor: RULE }}
            >
              <p className="text-[10px] font-bold" style={{ color: NAVY }}>
                DOCUMENT DETAILS
              </p>
              {[
                ["Proposal No.", String(quotation.quote_number || quotation.id)],
                ["Issue Date", shownDate(quotation.quotation_date)],
                ["Valid Until", shownDate(quotation.validation_date)],
              ].map(([label, value]) => (
                <p key={label} className="grid grid-cols-[115px_1fr]">
                  <span className="font-bold" style={{ color: LABEL }}>
                    {label}
                  </span>
                  <span>{value}</span>
                </p>
              ))}
            </div>
          </div>

          <div
            className="mx-[11px] mt-[9px] grid grid-cols-2 border"
            style={{ background: PANEL, borderColor: RULE }}
          >
            <Party label="BILL TO" name={billTo.name}>
              {billTo.attention && (
                <p className="font-bold" style={{ color: NAVY }}>
                  {billTo.attention}
                </p>
              )}
              {billTo.lines.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </Party>

            <Party label="PREPARED BY" name={preparedName} divided>
              {preparedLines.map((line) => (
                <p
                  key={line}
                  className={line === company.toUpperCase() ? "font-bold" : undefined}
                  style={line === company.toUpperCase() ? { color: NAVY } : undefined}
                >
                  {line}
                </p>
              ))}
            </Party>
          </div>
        </div>
      </section>

      {/* ---------------- THE OFFER ---------------- */}
      <section
        className="relative min-h-[1123px] px-[49px] pb-[110px] pt-[121px]"
        style={{ background: TINT }}
      >
        {/* Letterhead: the logo over the maroon rule, the company beside it. */}
        <img
          src={logo}
          alt=""
          className="absolute left-[49px] top-[38px] max-h-[64px] max-w-[181px] object-contain mix-blend-multiply"
          onError={(event) => {
            (event.target as HTMLImageElement).style.display = "none";
          }}
        />
        <div className="absolute right-[49px] top-[48px] text-right">
          <p className="text-[12.8px] font-bold" style={{ color: NAVY }}>
            {company.toUpperCase()}
          </p>
          {services && <p className="text-[9.7px] text-slate-500">{services}</p>}
        </div>
        <span
          aria-hidden
          className="absolute inset-x-[49px] top-[98px] h-[1.6px]"
          style={{ background: MAROON }}
        />

        <h3 className="mt-[15px] text-[11.5px] font-bold" style={{ color: NAVY }}>
          SUPPLY SUMMARY
        </h3>

        <table className="mt-[7px] w-full border-collapse bg-white text-[10.4px]">
          <colgroup>
            {[25, 191, 56, 30, 68, 33, 118].map((width, index) => (
              <col key={index} style={{ width: `${(width / 521) * 100}%` }} />
            ))}
          </colgroup>
          <thead>
            <tr className="text-white" style={{ background: NAVY }}>
              {["#", "PRODUCT / MODEL", "HSN", "QTY", "UNIT PRICE (INR)", "GST", "LINE AMOUNT (INR)"].map(
                (heading) => (
                  <th
                    key={heading}
                    className="border px-2 py-[7px] text-center text-[9.3px] font-bold"
                    style={{ borderColor: RULE }}
                  >
                    {heading}
                  </th>
                ),
              )}
            </tr>
          </thead>

          <tbody>
            {items.length === 0 ? (
              <tr>
                <td className="border" style={{ borderColor: RULE }} />
                <td
                  colSpan={6}
                  className="border px-2 py-4 font-bold"
                  style={{ borderColor: RULE }}
                >
                  No items on this proposal.
                </td>
              </tr>
            ) : (
              items.map((item, index) => {
                const quantity = Number(item.quantity || 1);
                const unitPrice = Number(item.unit_price || 0);
                const discount = Number(item.discount || 0);
                const tax = Number(item.tax ?? gstPercent);

                /* Before tax: GST is its own column and its own total. */
                const net = quantity * unitPrice * (1 - discount / 100);

                const product = text(item.product);
                const model = text(item.model);
                const code = text(item.sku);

                /* The category over a model that already says it is the
                   same words twice, so the model alone is shown. */
                const described =
                  model && product && model.toLowerCase().includes(product.toLowerCase())
                    ? [model]
                    : withoutRepeats([product || model || "—", model]);

                return (
                  <tr key={`${item.sku || item.product || "line"}-${index}`}>
                    <Cell center>{index + 1}</Cell>
                    <Cell bold>
                      {described.map((line) => (
                        <span key={line} className="block">
                          {line}
                        </span>
                      ))}
                      {code && <span className="block">Model: {code}</span>}
                    </Cell>
                    <Cell center>{item.hsn || "—"}</Cell>
                    <Cell center>{quantity}</Cell>
                    <Cell right>{money(unitPrice)}</Cell>
                    <Cell center>{tax}%</Cell>
                    <Cell right>{money(net)}</Cell>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        <table
          className="mt-[23px] w-full border-collapse text-[11.2px]"
          style={{ background: PANEL }}
        >
          <colgroup>
            <col style={{ width: "69%" }} />
            <col style={{ width: "31%" }} />
          </colgroup>
          <tbody>
            {charges && <TotalRow label="Subtotal" value={quotation.subtotal} />}
            {Number(quotation.freight_charges) > 0 && (
              <TotalRow label="Delivery" value={quotation.freight_charges} />
            )}
            {Number(quotation.installation_lumpsum) > 0 && (
              <TotalRow label="Installation" value={quotation.installation_lumpsum} />
            )}
            <TotalRow label="Taxable Subtotal" value={quotation.taxable_amount} />
            <TotalRow label={`GST @ ${gstPercent}%`} value={quotation.gst_amount} />
            <TotalRow
              label="GRAND TOTAL"
              value={quotation.total_payable}
              background={NAVY}
              color="#fff"
              bold
            />
            <TotalRow
              label={`${advance}% Advance Due with Purchase Order`}
              value={advanceAmount}
              background={BOX}
              color={NAVY}
              bold
            />
            {/* The same figure in words, from the same number. Both appear
                because digits can be altered with a pen and words cannot. */}
            <tr className="bg-white">
              <td
                colSpan={2}
                className="border px-[14px] py-[8px] text-[11.7px] font-bold"
                style={{ borderColor: RULE, color: NAVY }}
              >
                <span className="mr-2 text-[9.9px]" style={{ color: MAROON }}>
                  AMOUNT IN WORDS
                </span>
                {amountInWords(quotation.total_payable)}
              </td>
            </tr>
          </tbody>
        </table>

        <h3 className="mt-[23px] text-[11.5px] font-bold" style={{ color: NAVY }}>
          PAYMENT &amp; COMMERCIAL TERMS
        </h3>

        <div
          className="mt-[7px] grid grid-cols-2 border"
          style={{ background: PANEL, borderColor: RULE }}
        >
          <div className="flex flex-col justify-center px-[14px] py-[11px] text-[10.9px] leading-[14.7px]">
            <p className="text-[9.9px] font-bold" style={{ color: TEAL }}>
              PAYMENT SCHEDULE
            </p>
            <p className="font-bold" style={{ color: NAVY }}>
              {advance}% with Purchase Order&nbsp; - &nbsp;INR {money(advanceAmount)}
            </p>
            <p>
              {100 - advance}% against delivery&nbsp; - &nbsp;INR {money(balance)}
            </p>
          </div>

          <div
            className="border-l px-[14px] py-[11px] text-[9.7px] leading-[12.5px]"
            style={{ borderColor: RULE }}
          >
            <p className="mb-[3px] text-[9.9px] font-bold" style={{ color: TEAL }}>
              TERMS &amp; CONDITIONS
            </p>
            {terms.map((term) => (
              <p key={term} className="pl-[9px] -indent-[9px]">
                •&nbsp; {term}
              </p>
            ))}
          </div>
        </div>

        {quotation.remarks && (
          <div
            className="mt-[11px] border px-[14px] py-[11px] text-[10.9px]"
            style={{ background: PANEL, borderColor: RULE }}
          >
            <p className="text-[9.9px] font-bold" style={{ color: TEAL }}>
              REMARKS
            </p>
            <div dangerouslySetInnerHTML={{ __html: quotation.remarks }} />
          </div>
        )}

        <p className="mt-[26px] text-[11.2px] font-bold" style={{ color: NAVY }}>
          Issued by:&nbsp;&nbsp;{issuedBy}
        </p>
        <p className="mt-[26px] pr-[4px] text-right text-[11.2px] font-bold text-slate-500">
          Authorised Signatory
        </p>

        <footer className="absolute inset-x-0 bottom-[30px] text-center">
          <p className="text-[9.7px] text-slate-500">
            {[
              (brand?.address || []).join(", "),
              brand?.gstin ? `GSTIN: ${brand.gstin}` : null,
            ]
              .filter(Boolean)
              .join("  |  ")}
          </p>
          <p className="mt-[6px] text-[14px] font-bold" style={{ color: NAVY }}>
            {[brand?.phone, brand?.email, brand?.website].filter(Boolean).join("  |  ")}
          </p>
        </footer>
      </section>
    </div>
  );
}

function Party({
  label,
  name,
  divided,
  children,
}: {
  label: string;
  name: string;
  divided?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`px-[17px] py-[9px] text-[10.4px] leading-[12.8px] ${divided ? "border-l" : ""}`}
      style={divided ? { borderColor: RULE } : undefined}
    >
      <p className="text-[9.3px] font-bold" style={{ color: MAROON }}>
        {label}
      </p>
      <p className="text-[15px] font-bold leading-[18px]" style={{ color: NAVY }}>
        {name}
      </p>
      {children}
    </div>
  );
}

function Cell({
  children,
  center,
  right,
  bold,
}: {
  children: React.ReactNode;
  center?: boolean;
  right?: boolean;
  bold?: boolean;
}) {
  return (
    <td
      className={`border px-2 py-[9px] align-middle leading-[13px] ${
        center ? "text-center" : right ? "whitespace-nowrap text-right" : ""
      } ${bold ? "font-bold" : ""}`}
      style={{ borderColor: RULE }}
    >
      {children}
    </td>
  );
}

function TotalRow({
  label,
  value,
  background,
  color,
  bold,
}: {
  label: string;
  value?: number | null;
  background?: string;
  color?: string;
  bold?: boolean;
}) {
  const style = { borderColor: RULE, background, color };

  return (
    <tr>
      <td
        className={`border px-[14px] py-[5px] ${bold ? "font-bold" : "text-slate-500"}`}
        style={style}
      >
        {label}
      </td>
      <td
        className={`border px-[12px] py-[5px] text-right ${bold ? "font-bold" : ""}`}
        style={style}
      >
        INR {money(value)}
      </td>
    </tr>
  );
}
