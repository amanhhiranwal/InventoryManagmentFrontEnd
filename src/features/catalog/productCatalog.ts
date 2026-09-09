/**
 * Product catalogue shared by the Add Product pickers on the New Sales Order
 * and New Quotation screens, so both offer the same list at the same prices
 * rather than each keeping its own copy.
 */

export interface CatalogProduct {
  id: string;
  name: string;
  category: string;
  price: number;
  available: number;
}

export const PRODUCT_CATEGORIES = [
  "All",
  "Interactive Flat Panel",
  "Active LED Display",
  "Advertising Display",
  "Kiosk",
  "Smart Display",
];

export const PRODUCT_CATALOG: CatalogProduct[] = [
  {
    id: "QIFP75",
    name: "Qonevo IFP 75 – Core – 8/128",
    category: "Interactive Flat Panel",
    price: 185000,
    available: 24,
  },
  {
    id: "QIFP86",
    name: "Qonevo IFP 86 – Core – 8/128",
    category: "Interactive Flat Panel",
    price: 265000,
    available: 12,
  },
  {
    id: "QLED25",
    name: "Qonevo Active LED Indoor P2.5",
    category: "Active LED Display",
    price: 1850000,
    available: 6,
  },
  {
    id: "QADV55",
    name: "Qonevo Advertising Display 55",
    category: "Advertising Display",
    price: 95000,
    available: 18,
  },
  {
    id: "QKIOSK22",
    name: "Qonevo Smart Kiosk 22",
    category: "Kiosk",
    price: 125000,
    available: 15,
  },
  {
    id: "QSMART65",
    name: "Qonevo Smart Display 65",
    category: "Smart Display",
    price: 145000,
    available: 20,
  },
];

/** SKU shown under the product name on the quotation line items table. */
export const productSku = (productId: string) =>
  `NX-9K-${productId.toUpperCase()}-EX`;
