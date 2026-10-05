/**
 * The Synergy catalogue, shared by the Add Product pickers on the New
 * Proposal, New Sales Order and Proforma Invoice screens so all three
 * offer the same list at the same prices rather than each keeping a copy.
 *
 * Built from the Noida 65 stock dashboard: the panels as they are actually
 * stocked, the OPS modules, the standees, the cameras and the stand. The
 * rates and the HSN codes are the ones written on that sheet - nothing
 * here is indicative. A line the sheet prices at nothing carries 0, which
 * the picker shows as "price not set", because a figure nobody wrote down
 * is worse on a customer's quotation than a visible blank.
 *
 * Reading the dashboard's model codes:
 *
 *     CPX carries a camera, SPX does not
 *     6 = 65", 7 = 75", 8 = 86", 9 = 98", 11 = 110"
 */

export interface CatalogProduct {
  id: string;
  name: string;
  category: string;
  /** End Customer Price. What an end customer is quoted, and the figure a
      discount comes off. */
  price: number;
  /** Dealer Transfer Price: the fixed figure the channel is bought
      through at. Zero means none has been set on the Product List yet,
      not that it is free — a document written at DTP keeps the end
      customer rate and says so rather than quoting nothing. */
  dtp?: number;
  available: number;
  /** HSN for goods, SAC for a service. Every line of a GST invoice has to
      carry one, so it travels with the product rather than being typed
      onto each document. */
  hsn: string;
}

export const PRODUCT_CATEGORIES = [
  "All",
  "Interactive Flat Panel",
  "OPS Module",
  "Standee",
  "Camera & Audio",
  "Accessories",
];

export const PRODUCT_CATALOG: CatalogProduct[] = [
  /* Panels. Priced by the dashboard column, which already carries the
     camera's cost on the CPX variants. */
  {
    id: "SG-SPX6-LANGOV100",
    hsn: "85285900",
    name: '65" Interactive Flat Panel SPX6 (LangoV100)',
    category: "Interactive Flat Panel",
    price: 68000,
    available: 14,
  },
  {
    id: "SG-CPX6-YS3576",
    hsn: "85285900",
    name: '65" Interactive Flat Panel CPX6 (YS 3576)',
    category: "Interactive Flat Panel",
    price: 70000,
    available: 118,
  },
  {
    id: "SG-SPX6-LANGO3576",
    hsn: "85285900",
    name: '65" Interactive Flat Panel SPX6 (Lango 3576)',
    category: "Interactive Flat Panel",
    price: 68000,
    available: 119,
  },
  {
    id: "SG-SPX7-CVT9679",
    hsn: "84714190",
    name: '75" Interactive Flat Panel SPX7 (CVT 9679)',
    category: "Interactive Flat Panel",
    price: 75000,
    available: 68,
  },
  {
    id: "SG-SPX7-LANGOV100",
    hsn: "84714190",
    name: '75" Interactive Flat Panel SPX7 (LangoV100)',
    category: "Interactive Flat Panel",
    price: 75000,
    available: 74,
  },
  {
    id: "SG-SPX7-LANGO3576",
    hsn: "84714190",
    name: '75" Interactive Flat Panel SPX7 (Lango 3576)',
    category: "Interactive Flat Panel",
    price: 75000,
    available: 120,
  },
  {
    id: "SG-CPX7-CVT9679",
    hsn: "84714190",
    name: '75" Interactive Flat Panel CPX7 (CVT 9679)',
    category: "Interactive Flat Panel",
    price: 77000,
    available: 6,
  },
  {
    id: "SG-CPX7-YS3576",
    hsn: "84714190",
    name: '75" Interactive Flat Panel CPX7 (YS 3576)',
    category: "Interactive Flat Panel",
    price: 77000,
    available: 12,
  },
  {
    id: "SG-SPX8-LANGOV100",
    hsn: "85285900",
    name: '86" Interactive Flat Panel SPX8 (LangoV100)',
    category: "Interactive Flat Panel",
    price: 85000,
    available: 40,
  },
  {
    id: "SG-CPX8-LANGOV100",
    hsn: "85285900",
    name: '86" Interactive Flat Panel CPX8 (LangoV100)',
    category: "Interactive Flat Panel",
    price: 88000,
    available: 3,
  },
  {
    id: "SG-CPX9-LANGOV100",
    hsn: "85285900",
    name: '98" Interactive Flat Panel CPX9 (LangoV100)',
    category: "Interactive Flat Panel",
    price: 150000,
    available: 6,
  },
  {
    id: "SG-CPX11-CVT311D2",
    hsn: "85285900",
    name: '110" Interactive Flat Panel CPX11 (CVT 311D2)',
    category: "Interactive Flat Panel",
    price: 150000,
    available: 3,
  },

  /* OPS compute modules, by processor, memory and generation. */
  {
    id: "SG-OPS-I5-8-256-G10",
    hsn: "85291029",
    name: "OPS i5 8GB/256GB 10th Gen",
    category: "OPS Module",
    price: 22000,
    available: 0,
  },
  {
    id: "SG-OPS-I5-8-256-G11",
    hsn: "85291029",
    name: "OPS i5 8GB/256GB 11th Gen",
    category: "OPS Module",
    price: 23000,
    available: 0,
  },
  {
    id: "SG-OPS-I5-8-256-G12",
    hsn: "85291029",
    name: "OPS i5 8GB/256GB 12th Gen",
    category: "OPS Module",
    price: 23500,
    available: 0,
  },
  {
    id: "SG-OPS-I5-8-512-G10",
    hsn: "85291029",
    name: "OPS i5 8GB/512GB 10th Gen",
    category: "OPS Module",
    price: 26000,
    available: 0,
  },
  {
    id: "SG-OPS-I5-8-512-G11",
    hsn: "85291029",
    name: "OPS i5 8GB/512GB 11th Gen",
    category: "OPS Module",
    price: 26500,
    available: 0,
  },
  {
    id: "SG-OPS-I5-8-512-G12",
    hsn: "85291029",
    name: "OPS i5 8GB/512GB 12th Gen",
    category: "OPS Module",
    price: 32000,
    available: 0,
  },
  {
    id: "SG-OPS-I7-8-256-G10",
    hsn: "85291029",
    name: "OPS i7 8GB/256GB 10th Gen",
    category: "OPS Module",
    price: 28000,
    available: 0,
  },
  {
    id: "SG-OPS-I7-8-256-G11",
    hsn: "85291029",
    name: "OPS i7 8GB/256GB 11th Gen",
    category: "OPS Module",
    price: 30000,
    available: 0,
  },
  {
    id: "SG-OPS-I7-8-512-G10",
    hsn: "85291029",
    name: "OPS i7 8GB/512GB 10th Gen",
    category: "OPS Module",
    price: 35000,
    available: 0,
  },
  {
    id: "SG-OPS-I7-8-512-G11",
    hsn: "85291029",
    name: "OPS i7 8GB/512GB 11th Gen",
    category: "OPS Module",
    price: 40000,
    available: 0,
  },

  /* Bare units with stock on the shelf. They were left out of the picker
     while they had no price; now that they have one they can be quoted. */
  {
    id: "SG-OPS-I5-NA",
    hsn: "85291029",
    name: "OPS i5 Non Assembled",
    category: "OPS Module",
    price: 30000,
    available: 11,
  },
  {
    id: "SG-OPS-I7-NA",
    hsn: "85291029",
    name: "OPS i7 Non Assembled",
    category: "OPS Module",
    price: 30000,
    available: 15,
  },

  /* Standees, priced by the panel inside rather than by cabinet size. */
  {
    id: "SG-STD-TOUCH",
    hsn: "85285900",
    name: "Standee Touch",
    category: "Standee",
    price: 60000,
    available: 0,
  },
  {
    id: "SG-STD-NONTOUCH",
    hsn: "85285900",
    name: "Standee Non-Touch",
    category: "Standee",
    price: 57000,
    available: 6,
  },

  /* The cameras, the array mic and the stand. Named on the dashboard
     without a figure and carried at 0 until the rates came through - an
     invented price on a customer's quotation is worse than a visible
     blank, so they showed as "Price not set" in the meantime. */
  {
    id: "SG-CAM-UHDBAR",
    hsn: "85258900",
    name: "UHD All in One USB Video Bar 12V 5A",
    category: "Camera & Audio",
    price: 1949,
    available: 4,
  },
  {
    id: "SG-CAM-360",
    hsn: "85258900",
    name: "Camera 360 Degree",
    category: "Camera & Audio",
    price: 2500,
    available: 4,
  },
  {
    id: "SG-CAM-4KHF0V",
    hsn: "85258900",
    name: "4K Business Webcam HF0V-120 Degree",
    category: "Camera & Audio",
    price: 3000,
    available: 6,
  },
  {
    id: "SG-MIC-CASCADE",
    hsn: "85184000",
    name: "Cascading Omnidirectional Digital Array Mic",
    category: "Camera & Audio",
    price: 50000,
    available: 1,
  },
  {
    id: "SG-STAND-PANEL",
    hsn: "84733099",
    name: "Panel Stand",
    category: "Accessories",
    price: 11000,
    available: 0,
  },
];

/**
 * SKU shown under the product name on the line items tables.
 *
 * The catalogue id *is* the SKU now that the lines are the real ones, so
 * this no longer builds a reference out of a product code. It used to
 * wrap every id in an "NX-9K-...-EX" pattern that matched nothing in the
 * warehouse, which left a quotation line and the stock it drew on with
 * two different names for the same product.
 */
export const productSku = (productId: string) => productId;


/* =========================================================
   WHICH PRICE A DOCUMENT IS WRITTEN AGAINST
========================================================= */

export const PRICE_BASIS = {
  /** End Customer Price. Discountable, up the approval chain. */
  ECP: "ECP",
  /** Dealer Transfer Price. Fixed; only the CEO may move it. */
  DTP: "DTP",
} as const;

export type PriceBasis = (typeof PRICE_BASIS)[keyof typeof PRICE_BASIS];

export const PRICE_BASIS_LABEL: Record<PriceBasis, string> = {
  ECP: "End Customer Price",
  DTP: "Dealer Transfer Price",
};

/** The one customer type that buys at end customer price. */
const END_CUSTOMER = ["end customer", "end-customer", "endcustomer"];

/**
 * Which price list a document is written against.
 *
 * Decided by who is buying rather than chosen on a form. It used to be a
 * dropdown beside the discount, which asked the salesperson a question the
 * customer record already answers — and let a dealer be quoted at end
 * customer price by leaving the picker alone.
 *
 * An unknown or missing type is treated as an end customer: quoting the
 * higher price by mistake is a conversation, quoting the transfer price by
 * mistake is a loss. Mirrors price_type_for() on the server, which is what
 * actually decides the approval chain.
 */
export const priceBasisFor = (customerType?: string | null): PriceBasis => {
  const name = String(customerType || "").trim().toLowerCase();

  if (!name) return PRICE_BASIS.ECP;

  return END_CUSTOMER.includes(name) ? PRICE_BASIS.ECP : PRICE_BASIS.DTP;
};

/**
 * The rate a line takes, given who is buying.
 *
 * Falls back to the end customer price when a product has no transfer
 * price set, because a line at zero would otherwise reach a customer's
 * document as a free product. The pickers mark those lines so the gap is
 * visible rather than silent.
 */
export const rateFor = (
  product: Pick<CatalogProduct, "price" | "dtp">,
  basis: PriceBasis,
): number => {
  if (basis === PRICE_BASIS.ECP) return product.price;

  return product.dtp && product.dtp > 0 ? product.dtp : product.price;
};

/** True when this line is being quoted at ECP only because no DTP exists. */
export const missingDtp = (
  product: Pick<CatalogProduct, "dtp">,
  basis: PriceBasis,
): boolean => basis === PRICE_BASIS.DTP && !(product.dtp && product.dtp > 0);
