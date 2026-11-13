/**
 * The arithmetic tying a line's unit price, its discount and the price it
 * actually sells at.
 *
 * A salesperson does not usually think "fifteen percent off". They think
 * "I can let it go at 1,70,000", and the discount is what falls out of
 * that. Both ways of saying it describe one line, so both are offered and
 * each is worked out from the other.
 *
 * The discount stays the stored figure, as a percentage, because that is
 * what the approval bands are written in and what the API expects. The
 * selling price is a view onto it rather than a second thing to persist:
 * storing both invites them to disagree, and then the question is which
 * one the customer was quoted.
 */

/** What the line sells at once its discount is taken off. */
export function sellingPriceFor(unitPrice: number, discountPercent: number): number {
  const price = Number(unitPrice) || 0;
  const percent = clampPercent(discountPercent);

  return round(price - (price * percent) / 100);
}

/**
 * The discount a selling price implies, as a percentage.
 *
 * A selling price above the unit price is not a negative discount - it is
 * somebody typing while they think - so it reads as no discount rather
 * than as a markup the approval chain would have to have an opinion on.
 */
export function discountPercentFor(unitPrice: number, sellingPrice: number): number {
  const price = Number(unitPrice) || 0;
  const selling = Number(sellingPrice) || 0;

  if (price <= 0) return 0;

  return clampPercent(round(((price - selling) / price) * 100));
}

/** A line's price once a selling price is typed, allowing a markup. */
export interface LinePrice {
  /** What the line is sold at per unit, before any discount. */
  unitPrice: number;
  discount: number;
  /** Sold above its list price: no discount, and the unit price is the
      selling price on every page and document. */
  markedUp: boolean;
}

/**
 * A typed selling price, against the list price.
 *
 * Up to the list price it is a discount, as it always was. Above it the
 * line is marked up: the selling price becomes the unit price and the line
 * takes no discount - the server refuses one (settle_line_price).
 */
export function priceFromSelling(listPrice: number, sellingPrice: number): LinePrice {
  const list = Number(listPrice) || 0;
  const selling = Number(sellingPrice) || 0;

  if (list > 0 && selling > list) {
    return { unitPrice: round(selling), discount: 0, markedUp: true };
  }

  return { unitPrice: list, discount: discountPercentFor(list, selling), markedUp: false };
}

/** The rupees off one unit, for a discount entered as an amount. */
export function discountAmountFor(unitPrice: number, discountPercent: number): number {
  const price = Number(unitPrice) || 0;

  return round((price * clampPercent(discountPercent)) / 100);
}

/** The percentage a flat rupee discount comes to on this line. */
export function percentForDiscountAmount(unitPrice: number, amount: number): number {
  const price = Number(unitPrice) || 0;

  if (price <= 0) return 0;

  return clampPercent(round(((Number(amount) || 0) / price) * 100));
}

/** Nothing below free, nothing above the whole price. */
export function clampPercent(value: number): number {
  const percent = Number(value) || 0;

  if (percent < 0) return 0;
  if (percent > 100) return 100;

  return percent;
}

/** Two decimal places, so a third of a rupee does not become 0.3333333. */
function round(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}
