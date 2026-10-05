/**
 * The Synergy catalogue, shared by the Add Product pickers on the New
 * Proposal, New Sales Order and Proforma Invoice screens so all three
 * offer the same list at the same prices rather than each keeping a copy.
 *
 * Built from the pricing workbook: the END Customer Price sheet gives
 * `price`, the Dealer Price sheet gives `dtp`, and the Inventory sheet
 * gives `available`. Mirrors seed_synergy_catalogue.py, which is what
 * actually puts these on the shelf.
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
  "Service & AMC",
  "Accessories",
];

export const PRODUCT_CATALOG: CatalogProduct[] = [
  /* Interactive Flat Panel */
  {
    id: "SG-IFP-65-SPX-V100",
    hsn: "85285900",
    name: "65\" Interactive Flat Panel SPX (Lango V100)",
    category: "Interactive Flat Panel",
    price: 70000,
    dtp: 61000,
    available: 14,
  },
  {
    id: "SG-IFP-65-CPX-V100",
    hsn: "85285900",
    name: "65\" Interactive Flat Panel CPX (Lango V100)",
    category: "Interactive Flat Panel",
    price: 75000,
    dtp: 65500,
    available: 0,
  },
  {
    id: "SG-IFP-75-SPX-V100",
    hsn: "84714190",
    name: "75\" Interactive Flat Panel SPX (Lango V100)",
    category: "Interactive Flat Panel",
    price: 82000,
    dtp: 71000,
    available: 74,
  },
  {
    id: "SG-IFP-75-CPX-V100",
    hsn: "84714190",
    name: "75\" Interactive Flat Panel CPX (Lango V100)",
    category: "Interactive Flat Panel",
    price: 86000,
    dtp: 0,
    available: 0,
  },
  {
    id: "SG-IFP-86-SPX-V100",
    hsn: "85285900",
    name: "86\" Interactive Flat Panel SPX (Lango V100)",
    category: "Interactive Flat Panel",
    price: 110000,
    dtp: 90000,
    available: 40,
  },
  {
    id: "SG-IFP-86-CPX-V100",
    hsn: "85285900",
    name: "86\" Interactive Flat Panel CPX (Lango V100)",
    category: "Interactive Flat Panel",
    price: 0,
    dtp: 0,
    available: 3,
  },
  {
    id: "SG-IFP-65-SPX-EDLA",
    hsn: "85285900",
    name: "65\" Interactive Flat Panel SPX EDLA (Lango 3576)",
    category: "Interactive Flat Panel",
    price: 73000,
    dtp: 63000,
    available: 119,
  },
  {
    id: "SG-IFP-65-CPX-EDLA",
    hsn: "85285900",
    name: "65\" Interactive Flat Panel CPX EDLA NFC (YS 3576)",
    category: "Interactive Flat Panel",
    price: 77000,
    dtp: 0,
    available: 119,
  },
  {
    id: "SG-IFP-75-SPX-3576",
    hsn: "84714190",
    name: "75\" Interactive Flat Panel SPX (Lango 3576)",
    category: "Interactive Flat Panel",
    price: 85000,
    dtp: 0,
    available: 120,
  },
  {
    id: "SG-IFP-75-SPX-EDLA",
    hsn: "84714190",
    name: "75\" Interactive Flat Panel SPX EDLA (Lango 3576)",
    category: "Interactive Flat Panel",
    price: 88000,
    dtp: 0,
    available: 0,
  },
  {
    id: "SG-IFP-75-CPX-EDLA",
    hsn: "84714190",
    name: "75\" Interactive Flat Panel CPX EDLA NFC (YS 3576)",
    category: "Interactive Flat Panel",
    price: 92000,
    dtp: 78000,
    available: 12,
  },
  {
    id: "SG-IFP-86-SPX-3576",
    hsn: "85285900",
    name: "86\" Interactive Flat Panel SPX (3576)",
    category: "Interactive Flat Panel",
    price: 0,
    dtp: 93500,
    available: 0,
  },
  {
    id: "SG-IFP-86-CPX-3576",
    hsn: "85285900",
    name: "86\" Interactive Flat Panel CPX NFC (3576)",
    category: "Interactive Flat Panel",
    price: 0,
    dtp: 97000,
    available: 0,
  },
  {
    id: "SG-IFP-98-CPX",
    hsn: "85285900",
    name: "98\" Interactive Flat Panel CPX (CVTE 311D2)",
    category: "Interactive Flat Panel",
    price: 300000,
    dtp: 250000,
    available: 0,
  },
  {
    id: "SG-IFP-110-CPX",
    hsn: "85285900",
    name: "110\" Interactive Flat Panel CPX (CVTE 311D2)",
    category: "Interactive Flat Panel",
    price: 550000,
    dtp: 430000,
    available: 3,
  },

  /* OPS Module */
  {
    id: "SG-OPS-I5-12G",
    hsn: "85291029",
    name: "OPS i5 12th Gen 8GB/256GB",
    category: "OPS Module",
    price: 30000,
    dtp: 30000,
    available: 0,
  },
  {
    id: "SG-OPS-I7-13G",
    hsn: "85291029",
    name: "OPS i7 13th Gen 8GB/256GB",
    category: "OPS Module",
    price: 36000,
    dtp: 36000,
    available: 0,
  },
  {
    id: "SG-OPS-I5-NA",
    hsn: "85291029",
    name: "OPS i5 Non Assembled",
    category: "OPS Module",
    price: 30000,
    dtp: 0,
    available: 11,
  },
  {
    id: "SG-OPS-I7-NA",
    hsn: "85291029",
    name: "OPS i7 Non Assembled",
    category: "OPS Module",
    price: 30000,
    dtp: 0,
    available: 15,
  },
  {
    id: "SG-OPS-RAM-16",
    hsn: "84733099",
    name: "OPS Upgrade – 16GB RAM",
    category: "OPS Module",
    price: 6500,
    dtp: 0,
    available: 0,
  },
  {
    id: "SG-OPS-SSD-256",
    hsn: "84733099",
    name: "OPS Upgrade – 256GB SSD",
    category: "OPS Module",
    price: 4500,
    dtp: 0,
    available: 0,
  },
  {
    id: "SG-OPS-SSD-512",
    hsn: "84733099",
    name: "OPS Upgrade – 512GB SSD",
    category: "OPS Module",
    price: 7000,
    dtp: 0,
    available: 0,
  },
  {
    id: "SG-OPS-SSD-1TB",
    hsn: "84733099",
    name: "OPS Upgrade – 1TB SSD",
    category: "OPS Module",
    price: 14000,
    dtp: 0,
    available: 0,
  },
  {
    id: "SG-OPS-SSD-2TB",
    hsn: "84733099",
    name: "OPS Upgrade – 2TB SSD",
    category: "OPS Module",
    price: 24000,
    dtp: 0,
    available: 0,
  },

  /* Standee */
  {
    id: "SG-STD-TOUCH",
    hsn: "85285900",
    name: "Standee – Touch",
    category: "Standee",
    price: 60000,
    dtp: 0,
    available: 0,
  },
  {
    id: "SG-STD-NONTOUCH",
    hsn: "85285900",
    name: "Standee – Non-Touch",
    category: "Standee",
    price: 57000,
    dtp: 0,
    available: 6,
  },

  /* Camera & Audio */
  {
    id: "SG-CAM-UHDBAR",
    hsn: "85258900",
    name: "UHD All in One USB Video Bar 12V 5A",
    category: "Camera & Audio",
    price: 1949,
    dtp: 0,
    available: 4,
  },
  {
    id: "SG-CAM-360",
    hsn: "85258900",
    name: "Camera 360 Degree",
    category: "Camera & Audio",
    price: 2500,
    dtp: 0,
    available: 4,
  },
  {
    id: "SG-CAM-4KHF0V",
    hsn: "85258900",
    name: "4K Business Webcam HF0V-120 Degree",
    category: "Camera & Audio",
    price: 3000,
    dtp: 0,
    available: 6,
  },
  {
    id: "SG-MIC-CASCADE",
    hsn: "85184000",
    name: "Cascading Omnidirectional Digital Array Mic",
    category: "Camera & Audio",
    price: 50000,
    dtp: 0,
    available: 1,
  },

  /* Service & AMC */
  {
    id: "SG-AMC-2Y-65",
    hsn: "998719",
    name: "Extended Warranty 2 Years – 65″ (at purchase)",
    category: "Service & AMC",
    price: 5000,
    dtp: 0,
    available: 0,
  },
  {
    id: "SG-AMC-2Y-75",
    hsn: "998719",
    name: "Extended Warranty 2 Years – 75″ (at purchase)",
    category: "Service & AMC",
    price: 7000,
    dtp: 0,
    available: 0,
  },
  {
    id: "SG-AMC-2Y-86",
    hsn: "998719",
    name: "Extended Warranty 2 Years – 86″ (at purchase)",
    category: "Service & AMC",
    price: 8000,
    dtp: 0,
    available: 0,
  },
  {
    id: "SG-AMC-2Y-98",
    hsn: "998719",
    name: "Extended Warranty 2 Years – 98″ (at purchase)",
    category: "Service & AMC",
    price: 15000,
    dtp: 0,
    available: 0,
  },
  {
    id: "SG-AMC-P-65",
    hsn: "998719",
    name: "AMC after 3 Years – 65″",
    category: "Service & AMC",
    price: 8000,
    dtp: 0,
    available: 0,
  },
  {
    id: "SG-AMC-P-75",
    hsn: "998719",
    name: "AMC after 3 Years – 75″",
    category: "Service & AMC",
    price: 8000,
    dtp: 0,
    available: 0,
  },
  {
    id: "SG-AMC-P-86",
    hsn: "998719",
    name: "AMC after 3 Years – 86″",
    category: "Service & AMC",
    price: 10000,
    dtp: 0,
    available: 0,
  },
  {
    id: "SG-AMC-P-98",
    hsn: "998719",
    name: "AMC after 3 Years – 98″",
    category: "Service & AMC",
    price: 120000,
    dtp: 0,
    available: 0,
  },

  /* Accessories */
  {
    id: "SG-UPS",
    hsn: "85044090",
    name: "UPS",
    category: "Accessories",
    price: 5000,
    dtp: 0,
    available: 0,
  },
  {
    id: "SG-UPS-CABINET",
    hsn: "85044090",
    name: "UPS Cabinet",
    category: "Accessories",
    price: 900,
    dtp: 0,
    available: 0,
  },
  {
    id: "SG-FRAME-65-75",
    hsn: "84733099",
    name: "Frame – 65″ & 75″",
    category: "Accessories",
    price: 22000,
    dtp: 0,
    available: 0,
  },
  {
    id: "SG-FRAME-86",
    hsn: "84733099",
    name: "Frame – 86″",
    category: "Accessories",
    price: 25000,
    dtp: 0,
    available: 0,
  },
  {
    id: "SG-STAND-PANEL",
    hsn: "84733099",
    name: "Panel Stand",
    category: "Accessories",
    price: 11000,
    dtp: 0,
    available: 0,
  },
];

/**
 * SKU shown under the product name on the line items tables.
 *
 * The catalogue id *is* the SKU, so this no longer builds a reference out
 * of a product code. It used to wrap every id in an "NX-9K-...-EX" pattern
 * that matched nothing in the warehouse, which left a quotation line and
 * the stock it drew on with two different names for the same product.
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
