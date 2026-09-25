"use client";

/**
 * The quotation as the client receives it.
 *
 * Mirrors app/services/quotation_pdf_service on the backend page for page:
 * the navy cover, the About panel, the priced table under a navy header,
 * the totals, the terms and the signature. The brand details come from the
 * same endpoint the PDF reads, so what is previewed and what is sent
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

const NAVY = "#1f477b";

/** Indian grouping, as the printed proposal uses: 1,23,456.00 */
const money = (value?: number | null) =>
  Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const shownDate = (value?: string | null) =>
  value
    ? new Date(value).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

function addressLines(address: unknown): string[] {
  if (!address || typeof address !== "object") return [];

  const record = address as Record<string, unknown>;

  return [
    record.street,
    record.city,
    record.state,
    record.zipCode ?? record.zip_code,
    record.country,
  ]
    .map((part) => String(part ?? "").trim())
    .filter(Boolean);
}

export default function QuotationDocument({
  quotation,
  brand,
}: {
  quotation: QuotationModel;
  brand: QuotationBrand | null;
}) {
  const company = brand?.name || "Synergy Group";
  const logo = quotationBrandLogoUrl(quotation.id, quotation.company_id);
  const items = quotation.items || [];
  const gstPercent = Number(quotation.gst_percent || 0);

  const headline =
    quotation.opportunity_name ||
    items[0]?.product ||
    "Commercial Proposal";

  const submittedTo = [
    quotation.organization_name || quotation.contact_name || "—",
    ...addressLines(quotation.billing_address),
  ];

  /* Who the client has actually been dealing with, not the company's
     standing signatory. */
  const sender = brand?.sender;

  const submittedBy = (
    sender
      ? [sender.name, sender.title, company, sender.email, sender.phone]
      : [
          brand?.signatory || company,
          ...(brand?.signatory ? [brand.signatory_title, company] : []),
        ]
  ).filter(Boolean) as string[];

  /* What the company sells. Falls back to what is on this quotation when
     no range has been configured, as the PDF does. */
  const offerings =
    brand?.offerings?.length
      ? brand.offerings
      : Array.from(
          new Set(
            items
              .map((item) => String(item.product || item.model || "").trim())
              .filter(Boolean),
          ),
        );

  const advance = Number(quotation.advance_percent || 0);
  const total = Number(quotation.total_payable || 0);
  const advanceAmount = Number(quotation.advance_amount || (total * advance) / 100);

  const terms = [
    `${advance}% advance with the purchase order — INR ${money(advanceAmount)}`,
    `${100 - advance}% against delivery — INR ${money(
      quotation.on_delivery_amount ?? total - advanceAmount,
    )}`,
    `This offer is valid until ${shownDate(
      quotation.validation_date,
    )} and is subject to reconfirmation thereafter.`,
    ...(quotation.terms || [])
      .filter((term) => term?.checked && term?.label)
      .map((term) => String(term.label)),
  ];

  return (
    <div className="mx-auto w-[794px] bg-white text-[#1f2d3d]">
      {/* ---------------- COVER ---------------- */}
      <section className="relative h-[1123px] overflow-hidden px-[68px] pt-[52px]">
        {/* The navy sweeps the printed cover opens with. */}
        <span
          aria-hidden
          className="absolute -right-[150px] -top-[210px] h-[420px] w-[420px] rounded-full"
          style={{ background: NAVY }}
        />
        <span
          aria-hidden
          className="absolute -bottom-[190px] -left-[210px] h-[340px] w-[340px] rounded-full"
          style={{ background: NAVY }}
        />

        <div className="relative">
          <BrandLogo src={logo} />

          <h1
            className="mt-[74px] text-[42px] font-bold leading-none"
            style={{ color: NAVY }}
          >
            PROPOSAL
          </h1>

          <p className="mt-2 text-[20px] font-bold" style={{ color: NAVY }}>
            {headline}
          </p>

          <div className="mt-[42px] grid grid-cols-2 gap-6">
            <Party label="SUBMITTED TO:" lines={submittedTo} />
            <Party label="SUBMITTED BY:" lines={submittedBy} />
          </div>

          <p className="mt-[46px] text-[11px] text-slate-500">
            Reference {quotation.quote_number || quotation.id} &nbsp;|&nbsp;{" "}
            Issued {shownDate(quotation.quotation_date)} &nbsp;|&nbsp; Valid
            until {shownDate(quotation.validation_date)}
          </p>
        </div>
      </section>

      {/* ---------------- ABOUT ---------------- */}
      <section className="relative min-h-[1123px] px-[68px] pb-[70px] pt-[40px]">
        <div className="flex justify-end">
          <BrandLogo src={logo} small />
        </div>

        <div
          className="mt-[34px] rounded-[14px] px-[42px] pb-[34px] pt-[30px] text-white"
          style={{ background: NAVY }}
        >
          <h2 className="text-center text-[19px] font-bold">About {company}</h2>

          {(brand?.about || []).map((paragraph, index) => (
            <p
              key={index}
              className="mt-5 text-justify text-[11px] leading-[17px]"
            >
              {paragraph}
            </p>
          ))}
        </div>

        {offerings.length > 0 && (
          <ul className="mt-[42px] grid grid-cols-2 gap-x-10 gap-y-2 pl-6">
            {offerings.map((offering) => (
              <li key={offering} className="list-disc text-[13px] leading-6">
                {offering}
              </li>
            ))}
          </ul>
        )}

        <FooterBar brand={brand} company={company} />
      </section>

      {/* ---------------- OFFER ---------------- */}
      <section className="relative min-h-[1123px] px-[68px] pb-[70px] pt-[40px]">
        <div className="flex justify-end">
          <BrandLogo src={logo} small />
        </div>

        <h2
          className="mt-[34px] text-center text-[19px] font-bold"
          style={{ color: NAVY }}
        >
          Proposal
        </h2>

        <div className="mt-6 text-[12px]">
          <p>To,</p>
          <p className="font-bold">
            {quotation.organization_name || quotation.contact_name || "—"}
          </p>
          {addressLines(quotation.billing_address).map((line) => (
            <p key={line} className="text-[11px] text-slate-500">
              {line}
            </p>
          ))}
        </div>

        <table className="mt-6 w-full border-collapse text-[10px]">
          <thead>
            <tr style={{ background: NAVY }} className="text-white">
              {["Sr. No", "Category", "Model", "Description", "Qty", "Price", "GST", "Amount"].map(
                (heading) => (
                  <th
                    key={heading}
                    className="border border-[#c9d2e0] px-2 py-2 text-center font-bold"
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
                <td
                  colSpan={8}
                  className="border border-[#c9d2e0] px-2 py-6 text-center italic text-slate-400"
                >
                  No items on this quotation.
                </td>
              </tr>
            ) : (
              items.map((item, index) => {
                const quantity = Number(item.quantity || 1);
                const unitPrice = Number(item.unit_price || 0);
                const discount = Number(item.discount || 0);
                const tax = Number(item.tax ?? gstPercent);

                const net = quantity * unitPrice * (1 - discount / 100);
                const taxAmount = (net * tax) / 100;

                return (
                  <tr key={`${item.sku || item.product || "line"}-${index}`}>
                    <td
                      className="border border-[#c9d2e0] px-2 py-2 text-center font-bold text-white"
                      style={{ background: NAVY }}
                    >
                      {index + 1}
                    </td>
                    <td className="border border-[#c9d2e0] px-2 py-2 text-center">
                      {item.product || "—"}
                    </td>
                    <td className="border border-[#c9d2e0] px-2 py-2 text-center">
                      {item.model || "—"}
                    </td>
                    <td className="border border-[#c9d2e0] px-2 py-2">
                      {item.sku || "—"}
                    </td>
                    <td className="border border-[#c9d2e0] px-2 py-2 text-center">
                      {quantity}
                    </td>
                    <td className="border border-[#c9d2e0] px-2 py-2 text-center">
                      INR {money(unitPrice)}
                    </td>
                    <td className="border border-[#c9d2e0] px-2 py-2 text-center">
                      {money(taxAmount)}
                    </td>
                    <td className="border border-[#c9d2e0] px-2 py-2 text-center">
                      INR {money(net + taxAmount)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Discount and ORC are internal margin and never appear here. */}
        <div className="mt-5 flex justify-end">
          <table className="w-[300px] border-collapse text-[11px]">
            <tbody>
              <TotalRow label="Subtotal" value={quotation.subtotal} />
              {Number(quotation.freight_charges) > 0 && (
                <TotalRow label="Delivery" value={quotation.freight_charges} />
              )}
              {Number(quotation.installation_lumpsum) > 0 && (
                <TotalRow
                  label="Installation"
                  value={quotation.installation_lumpsum}
                />
              )}
              <TotalRow label="Taxable Amount" value={quotation.taxable_amount} />
              <TotalRow
                label={`GST (${gstPercent}%)`}
                value={quotation.gst_amount}
              />
              <TotalRow label="Grand Total" value={quotation.total_payable} strong />
            </tbody>
          </table>
        </div>

        <h3 className="mt-8 text-[13px] font-bold">
          General Terms &amp; Conditions:
        </h3>

        <ul className="mt-2 space-y-1.5 pl-5">
          {terms.map((term) => (
            <li key={term} className="list-disc text-[11px] leading-[17px]">
              {term}
            </li>
          ))}
        </ul>

        {quotation.remarks && (
          <>
            <h3 className="mt-6 text-[13px] font-bold">Remarks</h3>
            <div
              className="mt-1.5 text-[11px] leading-[17px]"
              dangerouslySetInnerHTML={{ __html: quotation.remarks }}
            />
          </>
        )}

        <div className="mt-10 text-[12px] font-bold leading-[19px]">
          <p>Best Regards</p>
          {(sender?.name || brand?.signatory) && (
            <p>{sender?.name || brand?.signatory}</p>
          )}
          {(sender?.title || brand?.signatory_title) && (
            <p>{sender?.title || brand?.signatory_title}</p>
          )}
          <p>{company}</p>

          {[sender?.phone || brand?.phone, sender?.email || brand?.email, brand?.website]
            .filter(Boolean)
            .join(" | ") && (
            <p className="text-[11px] font-normal text-slate-500">
              {[
                sender?.phone || brand?.phone,
                sender?.email || brand?.email,
                brand?.website,
              ]
                .filter(Boolean)
                .join(" | ")}
            </p>
          )}

          {(brand?.address || []).slice(0, 2).map((line) => (
            <p key={line} className="font-normal text-[11px] text-slate-500">
              {line}
            </p>
          ))}

          {brand?.gstin && (
            <p className="font-normal text-[11px] text-slate-500">
              GSTIN: {brand.gstin}
            </p>
          )}
        </div>

        <FooterBar brand={brand} company={company} />
      </section>
    </div>
  );
}

function Party({ label, lines }: { label: string; lines: string[] }) {
  return (
    <div>
      <p className="text-[11px] font-bold" style={{ color: NAVY }}>
        {label}
      </p>

      {lines.map((line, index) => (
        <p
          key={`${line}-${index}`}
          className={index === 0 ? "mt-1 text-[12px]" : "text-[12px]"}
        >
          {line}
        </p>
      ))}
    </div>
  );
}

function TotalRow({
  label,
  value,
  strong,
}: {
  label: string;
  value?: number | null;
  strong?: boolean;
}) {
  return (
    <tr className={strong ? "bg-[#f4f7fb]" : undefined}>
      <td
        className={`border border-[#c9d2e0] px-2.5 py-1.5 ${
          strong ? "font-bold" : ""
        }`}
      >
        {label}
      </td>
      <td
        className={`border border-[#c9d2e0] px-2.5 py-1.5 text-right ${
          strong ? "font-bold" : ""
        }`}
      >
        INR {money(value)}
      </td>
    </tr>
  );
}

/** The selling company's brand mark, served by the backend so it matches
    the PDF - a proposal for one of our other companies carries that
    company's logo, not the group's. */
function BrandLogo({ src, small }: { src: string; small?: boolean }) {
  return (
    <img
      src={src}
      alt=""
      className={small ? "h-[34px] w-auto" : "h-[44px] w-auto"}
      onError={(event) => {
        (event.target as HTMLImageElement).style.display = "none";
      }}
    />
  );
}

function FooterBar({
  brand,
  company,
}: {
  brand: QuotationBrand | null;
  company: string;
}) {
  return (
    <div
      className="absolute inset-x-0 bottom-0 py-2 text-center text-[9px] tracking-wide text-white"
      style={{ background: NAVY }}
    >
      {(brand?.website || company).toUpperCase()}
    </div>
  );
}
