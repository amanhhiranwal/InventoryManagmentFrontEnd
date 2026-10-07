/**
 * How a rupee figure is written, everywhere it is written.
 *
 * In full, grouped the Indian way: 80,000 rather than 80 K, 48,60,000
 * rather than 48.6 L. The short forms read quickly on a card but they
 * round, and a figure that has been rounded cannot be checked against
 * anything - two deals 4,000 apart both showed as "₹2.4 L", and somebody
 * reading a pipeline total had no way to tell what it actually was.
 *
 * Five separate formatters used to abbreviate, each with its own idea of
 * how many decimal places a crore deserves. They all come here now, so a
 * figure reads the same on the dashboard, the list and the document.
 */

/** "₹80,000". Rounded to whole rupees; paise are not shown. */
export function formatRupees(value?: number | null): string {
  const amount = Number(value);

  if (!Number.isFinite(amount)) return "₹0";

  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

/** "80,000", for places that draw their own currency symbol. */
export function formatAmount(value?: number | null): string {
  const amount = Number(value);

  if (!Number.isFinite(amount)) return "0";

  return Math.round(amount).toLocaleString("en-IN");
}
