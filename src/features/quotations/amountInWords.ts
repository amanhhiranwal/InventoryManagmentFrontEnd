/**
 * An amount as a customer-facing document has to state it.
 *
 * A figure in digits can be altered with a pen; the same figure in words
 * cannot, which is why an invoice carries both — and why both have to be
 * built from the same number rather than typed separately.
 *
 * The Indian system groups in lakh and crore rather than millions, so the
 * words are built the same way the digits are grouped.
 *
 * Mirrors _words in quotation_pdf_service.py, so the preview on screen and
 * the PDF the client receives cannot read differently.
 */

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight",
  "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen",
  "Sixteen", "Seventeen", "Eighteen", "Nineteen",
];

const TENS = [
  "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy",
  "Eighty", "Ninety",
];

function underThousand(value: number): string {
  if (value < 20) return ONES[value];

  if (value < 100) {
    return `${TENS[Math.floor(value / 10)]}${
      value % 10 ? ` ${ONES[value % 10]}` : ""
    }`;
  }

  return `${ONES[Math.floor(value / 100)]} Hundred${
    value % 100 ? ` ${underThousand(value % 100)}` : ""
  }`;
}

/** A crore or lakh count can itself run past a thousand. */
function groupCount(value: number): string {
  if (value >= 1000) {
    return `${underThousand(Math.floor(value / 1000))} Thousand${
      value % 1000 ? ` ${underThousand(value % 1000)}` : ""
    }`;
  }

  return underThousand(value);
}

export function amountInWords(value?: number | null): string {
  const amount = Math.round((Number(value) || 0) * 100) / 100;

  if (amount < 0) return `Minus ${amountInWords(-amount)}`;

  let rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);

  let head: string;

  if (rupees === 0) {
    head = "Zero";
  } else {
    const parts: string[] = [];

    for (const [divisor, label] of [
      [10000000, "Crore"],
      [100000, "Lakh"],
      [1000, "Thousand"],
    ] as const) {
      if (rupees >= divisor) {
        parts.push(`${groupCount(Math.floor(rupees / divisor))} ${label}`);
        rupees %= divisor;
      }
    }

    if (rupees) parts.push(underThousand(rupees));

    head = parts.join(" ");
  }

  return `Rupees ${head}${
    paise ? ` and ${underThousand(paise)} Paise` : ""
  } Only`;
}
