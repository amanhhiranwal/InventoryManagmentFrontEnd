"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  type ReactNode,
} from "react";

import { useUIStore } from "@/lib/store/ui.store";

import {
  ListPage,
  ListPageHeader,
  ListToolbar,
  PrimaryAction,
  StatGrid,
  TableCard,
  Th,
} from "@/components/crm/ListPageShell";
import StatCard from "@/components/crm/StatCard";
import Pagination from "@/components/crm/Pagination";
import { StatusPill } from "@/components/crm/Pill";
import { FormCard, FormSectionBlock, BillingShippingHeader } from "@/components/crm/FormCard";
import RichTextEditor, { textToHtml } from "@/components/crm/RichTextEditor";
import FormPageHeader, {
  CancelButton,
  DraftButton,
} from "@/components/crm/FormPageHeader";

import {
  PRODUCT_CATALOG,
  PRODUCT_CATEGORIES,
  productSku,
  type CatalogProduct,
} from "@/features/catalog/productCatalog";

import {
  createQuotationApi,
  getQuotationSenderApi,
  getQuotationsApi,
  sendQuotationApi,
  updateQuotationStatusApi,
  nextQuotationStatuses,
  quotationStatusLabel,
  QUOTATION_STATUS,
  type QuotationItem,
  type QuotationModel,
  type QuotationSender,
  type QuotationStatus,
} from "@/features/quotations/api/quotations.api";

import {
  getOpportunitiesApi,
  type OpportunityModel,
} from "@/features/opportunities/api/opportunities.api";

import { getUsersApi } from "@/features/users/api/users.api";
import { getStatesApi, type StateModel } from "@/features/locations/api/locations.api";
import { getCustomerTypesApi, type CustomerTypeModel } from "@/features/inventory/api/inventory.api";

import {
  FiPlus,
  FiSearch,
  FiX,
  FiInfo,
  FiMapPin,
  FiFileText,
  FiShield,
  FiTrash2,
  FiDownload,
  FiMail,
  FiMoreVertical,
  FiSend,
  FiEdit2,
  FiGrid,
  FiUploadCloud,
  FiBookmark,
  FiMinus,
  FiUser,
} from "react-icons/fi";

import { CgSpinner } from "react-icons/cg";

/* ============================================================================
   TYPES
============================================================================ */

interface LineItem {
  key: string;
  productId: string;
  product: string;
  model: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  tax: number;
}

interface AddressState {
  street: string;
  state: string;
  city: string;
  country: string;
  zipCode: string;
}

interface AttachmentState {
  name: string;
  size: number;
  type: string;
}

interface TermState {
  label: string;
  checked: boolean;
}

interface QuotationFilters {
  dateFrom: string;
  dateTo: string;
  customerType: string;
  assignedTo: string;
  status: string;
  state: string;
}

/* ============================================================================
   CONSTANTS
============================================================================ */

const EMPTY_ADDRESS: AddressState = {
  street: "",
  state: "",
  city: "",
  country: "",
  zipCode: "",
};

const EMPTY_FILTERS: QuotationFilters = {
  dateFrom: "",
  dateTo: "",
  customerType: "",
  assignedTo: "",
  status: "",
  state: "",
};

/** Status tabs, matching the canonical vocabulary on the backend. */
const STATUS_TABS: { label: string; value: "All" | QuotationStatus }[] = [
  { label: "All", value: "All" },
  { label: "Draft", value: QUOTATION_STATUS.DRAFT },
  { label: "Sent", value: QUOTATION_STATUS.SENT },
  { label: "Accepted", value: QUOTATION_STATUS.ACCEPTED },
  { label: "Rejected", value: QUOTATION_STATUS.REJECTED },
  { label: "Expired", value: QUOTATION_STATUS.EXPIRED },
];

/** Default Statutory & Operational Clauses on the create form. */
const DEFAULT_TERMS: TermState[] = [
  {
    label:
      "Taxes & Duties: Prices indicated are exclusive of GST. Prevailing GST (18% / 28%) will be charged at actual rate on date of invoice.",
    checked: true,
  },
  {
    label:
      "Offer Validity: This quotation remains firm for 30 calendar days from issue date. Subject to reconfirmation thereafter.",
    checked: true,
  },
  {
    label:
      "Inspection & FAT: Factory Acceptance Testing (FAT) to be conducted by client engineers at our works prior to dispatch.",
    checked: true,
  },
  {
    label:
      "Liquidated Damages (LD): Penalty clause capped at 0.5% per week of delay, subject to an overall ceiling of 5% contract value.",
    checked: true,
  },
];

/** Toggles in the Send Quotation dialog. */
const SEND_OPTIONS: { key: SendOptionKey; label: string }[] = [
  { key: "track_opens", label: "Track Email Opens (Read Receipt)" },
  { key: "alert_on_download", label: "Instant Alert on Quotation PDF Download" },
  { key: "attach_gst_audit_trail", label: "Attach GST Digital Signature Audit Trail" },
  { key: "notify_lead_owner", label: "Notify Lead Owner upon Client Interaction" },
];

type SendOptionKey =
  | "track_opens"
  | "alert_on_download"
  | "attach_gst_audit_trail"
  | "notify_lead_owner";

const ROWS_PER_PAGE = 10;

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

/* ============================================================================
   HELPERS
============================================================================ */

const money = (value: number | null | undefined) =>
  `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

/** Compact form used by the KPI cards, e.g. ₹4.82 Cr / ₹52.4 L. */
function compactMoney(value: number) {
  const amount = Number(value || 0);

  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)} L`;

  return money(amount);
}

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-GB").replace(/\//g, "/");
}

/** Today, as a yyyy-mm-dd value for a date input. */
function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

/** Default offer validity: 30 days out, matching the form's label. */
function validityInput() {
  return new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
}

function toInputDate(value?: string | null) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toISOString().slice(0, 10);
}

function getInitials(name?: string | null) {
  if (!name) return "NA";

  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

/**
 * Mirrors compute_totals in app/services/quotation_service.py so the form can
 * show live figures while typing. The backend recomputes on save, and its
 * values are what get stored - this is only for immediate feedback.
 */
function computeTotals(
  items: LineItem[],
  orcAmount: number,
  freight: number,
  installation: number,
  gstPercent: number,
  advancePercent: number,
) {
  let subtotal = 0;
  let discountAmount = 0;

  for (const item of items) {
    const lineTotal = (item.quantity || 0) * (item.unitPrice || 0);

    subtotal += lineTotal;
    discountAmount += (lineTotal * (item.discount || 0)) / 100;
  }

  const orcPercent = subtotal ? (orcAmount / subtotal) * 100 : 0;

  const taxableAmount =
    subtotal - discountAmount + orcAmount + freight + installation;

  const gstAmount = (taxableAmount * gstPercent) / 100;
  const totalPayable = taxableAmount + gstAmount;
  const advanceAmount = (totalPayable * advancePercent) / 100;

  return {
    subtotal,
    discountAmount,
    orcPercent,
    orcAmount,
    freight,
    installation,
    taxableAmount,
    gstAmount,
    totalPayable,
    advanceAmount,
    onDeliveryAmount: totalPayable - advanceAmount,
  };
}

/**
 * How the total's tax is described in the email.
 *
 * Total Payable = taxable amount + GST, so the figure is inclusive; this
 * states the actual amount and rate held on the quotation rather than
 * assuming 18%, and says nothing at all when no GST applies.
 */
function gstClause(quotation: QuotationModel) {
  const percent = Number(quotation.gst_percent || 0);

  if (percent <= 0) return " (GST not applicable)";

  const amount = Number(quotation.gst_amount || 0);
  const rate = `${Number(percent.toFixed(2))}%`;

  return amount > 0
    ? ` (inclusive of ${money(amount)} GST at ${rate})`
    : ` (inclusive of ${rate} GST)`;
}

function splitAddresses(raw: string) {
  return raw
    .split(/[,;\n]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ============================================================================
   PAGE
============================================================================ */

export default function QuotationPage() {
  const { addToast } = useUIStore();

  const [quotations, setQuotations] = useState<QuotationModel[]>([]);
  const [opportunities, setOpportunities] = useState<OpportunityModel[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [states, setStates] = useState<StateModel[]>([]);
  const [customerTypes, setCustomerTypes] = useState<CustomerTypeModel[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [pageMode, setPageMode] = useState<"list" | "create">("list");

  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState<"All" | QuotationStatus>("All");
  const [currentPage, setCurrentPage] = useState(1);

  const [showFilter, setShowFilter] = useState(false);
  const [filters, setFilters] = useState<QuotationFilters>(EMPTY_FILTERS);
  const [draftFilters, setDraftFilters] = useState<QuotationFilters>(EMPTY_FILTERS);

  const [showPageMenu, setShowPageMenu] = useState(false);
  const [rowMenuId, setRowMenuId] = useState<number | null>(null);

  /* ---- create form ---- */
  const [opportunityId, setOpportunityId] = useState<number | null>(null);
  const [opportunityName, setOpportunityName] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [contactName, setContactName] = useState("");
  const [designation, setDesignation] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [email, setEmail] = useState("");
  const [assignedToId, setAssignedToId] = useState("");
  /* Lazy initialisers: reading the clock during render would produce a new
     value on every re-render. */
  const [quotationDate, setQuotationDate] = useState(() => todayInput());
  const [validationDate, setValidationDate] = useState(() => validityInput());

  const [billing, setBilling] = useState<AddressState>(EMPTY_ADDRESS);
  const [shipping, setShipping] = useState<AddressState>(EMPTY_ADDRESS);
  const [sameAsBilling, setSameAsBilling] = useState(false);

  const [items, setItems] = useState<LineItem[]>([]);
  const [editingItemKey, setEditingItemKey] = useState<string | null>(null);

  const [orcAmount, setOrcAmount] = useState(0);
  const [freight, setFreight] = useState(0);
  const [installation, setInstallation] = useState(0);
  const [gstPercent, setGstPercent] = useState(18);
  const [advancePercent] = useState(30);

  const [attachments, setAttachments] = useState<AttachmentState[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [terms, setTerms] = useState<TermState[]>(DEFAULT_TERMS);
  const [remarks, setRemarks] = useState("");

  /* ---- product picker ---- */
  const [showProductModal, setShowProductModal] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [productCategory, setProductCategory] = useState("All");
  const [picked, setPicked] = useState<LineItem[]>([]);

  /* ---- send dialog ---- */
  const [sendTarget, setSendTarget] = useState<QuotationModel | null>(null);
  const [sender, setSender] = useState<QuotationSender | null>(null);

  const filterRef = useRef<HTMLDivElement | null>(null);
  const pageMenuRef = useRef<HTMLDivElement | null>(null);

  /* --------------------------------------------------------------------------
     FETCH
  -------------------------------------------------------------------------- */

  const fetchQuotations = useCallback(async () => {
    try {
      const data = await getQuotationsApi();
      setQuotations(data || []);
    } catch (error) {
      console.error(error);
      addToast("Unable to load quotations.", "error");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  const fetchSupporting = useCallback(async () => {
    /* Each of these only enriches the form; a failure must not stop the
       quotation list from rendering. */
    try {
      setOpportunities((await getOpportunitiesApi()) || []);
    } catch (error) {
      console.error(error);
    }

    try {
      const response = await getUsersApi(1, 100);
      const list = Array.isArray(response?.data) ? response.data : [];

      setUsers(
        list.map((user) => ({
          id: String(user.id),
          name:
            `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
            user.email,
        })),
      );
    } catch (error) {
      console.error(error);
    }

    try {
      setStates((await getStatesApi()) || []);
    } catch (error) {
      console.error(error);
    }

    try {
      setCustomerTypes((await getCustomerTypesApi()) || []);
    } catch (error) {
      console.error(error);
    }

    try {
      setSender(await getQuotationSenderApi());
    } catch (error) {
      console.error(error);
    }
  }, []);

  useEffect(() => {
    fetchQuotations();
    fetchSupporting();
  }, [fetchQuotations, fetchSupporting]);

  useEffect(() => {
    function handleOutside(event: MouseEvent) {
      const target = event.target as Element;

      if (filterRef.current && !filterRef.current.contains(target)) {
        setShowFilter(false);
      }

      if (pageMenuRef.current && !pageMenuRef.current.contains(target)) {
        setShowPageMenu(false);
      }

      /* Only close the row menu for clicks outside it: closing on every
         mousedown unmounts the button before its click can land. */
      if (target instanceof Element && target.closest("[data-row-menu]")) {
        return;
      }

      setRowMenuId(null);
    }

    document.addEventListener("mousedown", handleOutside);

    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const refresh = async () => {
    setRefreshing(true);
    await fetchQuotations();
    setRefreshing(false);
    addToast("Quotation list refreshed.", "success");
  };

  /* --------------------------------------------------------------------------
     DERIVED
  -------------------------------------------------------------------------- */

  const stats = useMemo(() => {
    const count = (status: QuotationStatus) =>
      quotations.filter((q) => q.status === status).length;

    const valueOf = (status: QuotationStatus) =>
      quotations
        .filter((q) => q.status === status)
        .reduce((sum, q) => sum + (q.total_payable || 0), 0);

    return {
      total: quotations.length,
      grossValue: quotations.reduce((sum, q) => sum + (q.total_payable || 0), 0),
      drafts: count(QUOTATION_STATUS.DRAFT),
      draftValue: valueOf(QUOTATION_STATUS.DRAFT),
      sent: count(QUOTATION_STATUS.SENT),
      sentValue: valueOf(QUOTATION_STATUS.SENT),
      accepted: count(QUOTATION_STATUS.ACCEPTED),
      expired: count(QUOTATION_STATUS.EXPIRED),
      rejected: count(QUOTATION_STATUS.REJECTED),
    };
  }, [quotations]);

  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { All: quotations.length };

    for (const tab of STATUS_TABS) {
      if (tab.value === "All") continue;
      counts[tab.value] = quotations.filter((q) => q.status === tab.value).length;
    }

    return counts;
  }, [quotations]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    return quotations.filter((quotation) => {
      if (statusTab !== "All" && quotation.status !== statusTab) return false;

      if (term) {
        const haystack = [
          quotation.quote_number,
          quotation.contact_name,
          quotation.organization_name,
          quotation.opportunity_name,
          quotation.email,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(term)) return false;
      }

      const rowDate = toInputDate(quotation.quotation_date || quotation.created_at);

      if (filters.dateFrom && rowDate && rowDate < filters.dateFrom) return false;
      if (filters.dateTo && rowDate && rowDate > filters.dateTo) return false;

      if (filters.customerType && quotation.customer_type !== filters.customerType) {
        return false;
      }

      if (filters.assignedTo && quotation.assigned_to_id !== filters.assignedTo) {
        return false;
      }

      if (filters.status && quotation.status !== filters.status) return false;

      if (filters.state && String(quotation.state_id || "") !== filters.state) {
        return false;
      }

      return true;
    });
  }, [quotations, search, statusTab, filters]);

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * ROWS_PER_PAGE;
    return filtered.slice(start, start + ROWS_PER_PAGE);
  }, [filtered, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusTab, filters]);

  const activeFilterCount = useMemo(
    () => Object.values(filters).filter(Boolean).length,
    [filters],
  );

  const totals = useMemo(
    () =>
      computeTotals(items, orcAmount, freight, installation, gstPercent, advancePercent),
    [items, orcAmount, freight, installation, gstPercent, advancePercent],
  );

  const userName = useCallback(
    (id?: string | null) => users.find((user) => user.id === id)?.name || "Unassigned",
    [users],
  );

  /* --------------------------------------------------------------------------
     FORM
  -------------------------------------------------------------------------- */

  const resetForm = () => {
    setOpportunityId(null);
    setOpportunityName("");
    setOrganizationName("");
    setContactName("");
    setDesignation("");
    setMobileNumber("");
    setEmail("");
    setAssignedToId("");
    setQuotationDate(todayInput());
    setValidationDate(validityInput());
    setBilling(EMPTY_ADDRESS);
    setShipping(EMPTY_ADDRESS);
    setSameAsBilling(false);
    setItems([]);
    setOrcAmount(0);
    setFreight(0);
    setInstallation(0);
    setGstPercent(18);
    setAttachments([]);
    setTerms(DEFAULT_TERMS);
    setRemarks("");
  };

  const openCreate = () => {
    resetForm();
    setPageMode("create");
  };

  /** Prefills the form from the opportunity the quotation is raised against. */
  const applyOpportunity = (id: string) => {
    if (!id) {
      setOpportunityId(null);
      return;
    }

    const opportunity = opportunities.find((o) => String(o.id) === id);

    if (!opportunity) return;

    setOpportunityId(Number(opportunity.id));
    setOpportunityName(opportunity.title || "");
    setOrganizationName(opportunity.organization_name || "");
    setContactName(opportunity.contact_name || "");
    setDesignation(opportunity.designation || "");
    setEmail(opportunity.email || "");
    setMobileNumber(opportunity.mobile_number || "");
    setAssignedToId(opportunity.assigned_to_id || "");

    setBilling({
      street: opportunity.office_address || "",
      state: opportunity.state_name || "",
      city: opportunity.city || "",
      country: opportunity.country || "",
      zipCode: opportunity.zip_code || "",
    });

    setShipping({
      street: opportunity.shipping_address || "",
      state: opportunity.shipping_state || "",
      city: opportunity.shipping_city || "",
      country: opportunity.shipping_country || "",
      zipCode: opportunity.shipping_zip_code || "",
    });
  };

  useEffect(() => {
    if (sameAsBilling) setShipping(billing);
  }, [sameAsBilling, billing]);

  const addFiles = (files: FileList | File[]) => {
    const accepted: AttachmentState[] = [];

    for (const file of Array.from(files)) {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        addToast(`${file.name} is larger than 10MB and was skipped.`, "warning");
        continue;
      }

      accepted.push({ name: file.name, size: file.size, type: file.type });
    }

    if (accepted.length) {
      setAttachments((current) => [...current, ...accepted]);
      addToast(`${accepted.length} document(s) attached.`, "success");
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);

    if (event.dataTransfer.files?.length) addFiles(event.dataTransfer.files);
  };

  const handleFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files?.length) addFiles(event.target.files);
    event.target.value = "";
  };

  const toPayload = (status: QuotationStatus) => ({
    opportunity_id: opportunityId,
    status,

    opportunity_name: opportunityName.trim() || undefined,
    organization_name: organizationName.trim() || undefined,
    contact_name: contactName.trim() || undefined,
    designation: designation.trim() || undefined,
    email: email.trim() || undefined,
    mobile_number: mobileNumber.trim() || undefined,

    quotation_date: quotationDate ? new Date(quotationDate).toISOString() : undefined,
    validation_date: validationDate ? new Date(validationDate).toISOString() : undefined,

    billing_address: {
      street: billing.street,
      state: billing.state,
      city: billing.city,
      country: billing.country,
      zip_code: billing.zipCode,
    },
    shipping_address: {
      street: shipping.street,
      state: shipping.state,
      city: shipping.city,
      country: shipping.country,
      zip_code: shipping.zipCode,
    },
    shipping_same_as_billing: sameAsBilling,

    items: items.map<QuotationItem>((item) => ({
      product: item.product,
      model: item.model,
      sku: item.sku,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      discount: item.discount,
      tax: item.tax,
    })),

    orc_amount: orcAmount,
    freight_charges: freight,
    installation_lumpsum: installation,
    gst_percent: gstPercent,
    advance_percent: advancePercent,

    attachments,
    terms,
    remarks: remarks.trim() || undefined,

    assigned_to_id: assignedToId || undefined,
  });

  const validate = () => {
    if (!organizationName.trim()) {
      addToast("Organization Name is required.", "warning");
      return false;
    }

    if (!contactName.trim()) {
      addToast("Contact Person is required.", "warning");
      return false;
    }

    if (email.trim() && !EMAIL_PATTERN.test(email.trim())) {
      addToast("Enter a valid email address.", "warning");
      return false;
    }

    if (!items.length) {
      addToast("Add at least one product before saving the quotation.", "warning");
      return false;
    }

    return true;
  };

  const saveQuotation = async (event?: FormEvent) => {
    event?.preventDefault();

    if (!validate()) return;

    setSaving(true);

    try {
      const created = await createQuotationApi(toPayload(QUOTATION_STATUS.DRAFT));

      addToast(
        `Quotation ${created.quote_number} saved as draft.`,
        "success",
      );

      if (opportunityId) {
        addToast(
          "Linked opportunity moved to Proposal / Price Quote.",
          "info",
        );
      }

      await fetchQuotations();
      setPageMode("list");
      resetForm();

      return created;
    } catch (error) {
      const detail =
        (error as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Failed to save the quotation.";

      console.error(error);
      addToast(detail, "error");

      return null;
    } finally {
      setSaving(false);
    }
  };

  /** Save as Draft, then open the send dialog on the saved record. */
  const saveAndEmail = async () => {
    if (!validate()) return;

    setSaving(true);

    try {
      const created = await createQuotationApi(toPayload(QUOTATION_STATUS.DRAFT));

      addToast(`Quotation ${created.quote_number} saved as draft.`, "success");

      await fetchQuotations();
      setPageMode("list");
      resetForm();
      setSendTarget(created);
    } catch (error) {
      const detail =
        (error as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Failed to save the quotation.";

      console.error(error);
      addToast(detail, "error");
    } finally {
      setSaving(false);
    }
  };

  /* --------------------------------------------------------------------------
     PRODUCTS
  -------------------------------------------------------------------------- */

  const filteredProducts = useMemo(() => {
    const term = productSearch.trim().toLowerCase();

    return PRODUCT_CATALOG.filter((product) => {
      if (productCategory !== "All" && product.category !== productCategory) {
        return false;
      }

      if (!term) return true;

      return (
        product.name.toLowerCase().includes(term) ||
        product.id.toLowerCase().includes(term) ||
        productSku(product.id).toLowerCase().includes(term)
      );
    });
  }, [productSearch, productCategory]);

  const openProductModal = () => {
    setPicked([]);
    setProductSearch("");
    setProductCategory("All");
    setShowProductModal(true);
  };

  const togglePicked = (product: CatalogProduct) => {
    setPicked((current) => {
      const existing = current.find((item) => item.productId === product.id);

      if (existing) {
        return current.filter((item) => item.productId !== product.id);
      }

      return [
        ...current,
        {
          key: `${product.id}-${Date.now()}-${current.length}`,
          productId: product.id,
          product: product.category,
          model: product.name,
          sku: productSku(product.id),
          quantity: 1,
          unitPrice: product.price,
          discount: 0,
          tax: 18,
        },
      ];
    });
  };

  const updatePicked = (key: string, patch: Partial<LineItem>) => {
    setPicked((current) =>
      current.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    );
  };

  const confirmProducts = () => {
    if (!picked.length) {
      addToast("Select at least one product.", "warning");
      return;
    }

    setItems((current) => [...current, ...picked]);
    addToast(`${picked.length} product(s) added to the quotation.`, "success");

    setShowProductModal(false);
    setPicked([]);
  };

  const updateItem = (key: string, patch: Partial<LineItem>) => {
    setItems((current) =>
      current.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    );
  };

  const removeItem = (key: string) => {
    setItems((current) => current.filter((item) => item.key !== key));
    addToast("Product removed from the quotation.", "info");
  };

  /* --------------------------------------------------------------------------
     ROW ACTIONS
  -------------------------------------------------------------------------- */

  const changeStatus = async (
    quotation: QuotationModel,
    status: QuotationStatus,
  ) => {
    setRowMenuId(null);

    try {
      await updateQuotationStatusApi(quotation.id, status);

      addToast(
        `${quotation.quote_number} marked as ${quotationStatusLabel(status)}.`,
        "success",
      );

      await fetchQuotations();
    } catch (error) {
      const detail =
        (error as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Failed to update the quotation status.";

      console.error(error);
      addToast(detail, "error");
    }
  };

  const exportCsv = () => {
    if (!filtered.length) {
      addToast("No quotations available for export.", "warning");
      return;
    }

    const header = [
      "Quote ID",
      "Customer Name",
      "Email",
      "Opportunity",
      "Order Value",
      "Assigned To",
      "Date",
      "Status",
    ];

    const rows = filtered.map((quotation) => [
      quotation.quote_number || "",
      quotation.contact_name || "",
      quotation.email || "",
      quotation.opportunity_name || "",
      String(quotation.total_payable || 0),
      userName(quotation.assigned_to_id),
      formatDate(quotation.quotation_date || quotation.created_at),
      quotationStatusLabel(quotation.status),
    ]);

    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const link = document.createElement("a");

    link.href = url;
    link.download = `quotations-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();

    URL.revokeObjectURL(url);
    setShowPageMenu(false);
    addToast("Quotations exported.", "success");
  };

  /** Renders the status breakdown to a PNG, matching the Opportunity page. */
  const downloadChart = () => {
    if (!quotations.length) {
      addToast("No quotations available to chart.", "warning");
      return;
    }

    const bars = STATUS_TABS.filter((tab) => tab.value !== "All").map((tab) => ({
      label: tab.label,
      count: quotations.filter((q) => q.status === tab.value).length,
      value: quotations
        .filter((q) => q.status === tab.value)
        .reduce((sum, q) => sum + (q.total_payable || 0), 0),
    }));

    const width = 900;
    const height = 460;
    const canvas = document.createElement("canvas");

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");

    if (!ctx) {
      addToast("This browser cannot render the chart.", "error");
      return;
    }

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = "#233353";
    ctx.font = "bold 20px Arial";
    ctx.fillText("Quotation Pipeline", 40, 46);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px Arial";
    ctx.fillText(
      `${quotations.length} quotations · ${compactMoney(stats.grossValue)} gross value`,
      40,
      68,
    );

    const chartTop = 100;
    const chartBottom = height - 70;
    const chartHeight = chartBottom - chartTop;
    const maxCount = Math.max(...bars.map((bar) => bar.count), 1);

    const slot = (width - 100) / bars.length;
    const barWidth = Math.min(80, slot - 30);

    /* Same tones the StatusPill uses, so the export reads like the screen. */
    const tones: Record<string, string> = {
      Draft: "#94a3b8",
      Sent: "#f59e0b",
      Accepted: "#10b981",
      Rejected: "#f43f5e",
      Expired: "#cbd5e1",
    };

    ctx.strokeStyle = "#e2e8f0";
    ctx.beginPath();
    ctx.moveTo(40, chartBottom);
    ctx.lineTo(width - 40, chartBottom);
    ctx.stroke();

    bars.forEach((bar, index) => {
      const barHeight = (bar.count / maxCount) * (chartHeight - 30);
      const x = 60 + index * slot;
      const y = chartBottom - barHeight;

      ctx.fillStyle = tones[bar.label] || "#94a3b8";
      ctx.fillRect(x, y, barWidth, barHeight);

      ctx.fillStyle = "#233353";
      ctx.font = "bold 13px Arial";
      ctx.textAlign = "center";
      ctx.fillText(String(bar.count), x + barWidth / 2, y - 8);

      ctx.fillStyle = "#64748b";
      ctx.font = "12px Arial";
      ctx.fillText(bar.label, x + barWidth / 2, chartBottom + 20);

      ctx.fillStyle = "#94a3b8";
      ctx.font = "10px Arial";
      ctx.fillText(compactMoney(bar.value), x + barWidth / 2, chartBottom + 38);

      ctx.textAlign = "left";
    });

    const link = document.createElement("a");

    link.href = canvas.toDataURL("image/png");
    link.download = `quotation-chart-${new Date().toISOString().slice(0, 10)}.png`;
    link.click();

    setShowPageMenu(false);
    addToast("Chart downloaded.", "success");
  };

  /* --------------------------------------------------------------------------
     RENDER - CREATE
  -------------------------------------------------------------------------- */

  if (pageMode === "create") {
    return (
      <div className="min-h-full pb-8">
        <FormPageHeader
          title="New Quotation"
          parentLabel="Quotation"
          actions={
            <>
              <CancelButton
                onClick={() => {
                  setPageMode("list");
                  resetForm();
                }}
              />

              <DraftButton
                onClick={() => saveQuotation()}
                disabled={saving}
                withIcon
              >
                {saving ? "Saving..." : "Save as Draft"}
              </DraftButton>
            </>
          }
        />

        <form
          id="quotation-form"
          onSubmit={saveQuotation}
          className="grid grid-cols-1 gap-5 px-5 lg:grid-cols-[minmax(0,1fr)_360px]"
        >
          {/* ---------------- LEFT ---------------- */}

          <FormCard>
            <FormSectionBlock
              first
              icon={<FiInfo size={16} />}
              title="Customer & Opportunity Information"
            >
              {/* Opportunity ID and name read as facts in the design, so the
                  picker is inline rather than a full-height field. */}
              <div className="mb-5 grid grid-cols-1 gap-5 md:grid-cols-2">
                <InlineFact label="Opportunity ID:">
                  <select
                    value={opportunityId ? String(opportunityId) : ""}
                    onChange={(event) => applyOpportunity(event.target.value)}
                    className="cursor-pointer rounded-md border border-transparent bg-transparent py-0.5 text-[12px] font-bold text-slate-800 outline-none transition hover:border-slate-200 focus:border-[#233353] dark:text-white"
                  >
                    <option value="">Select opportunity</option>

                    {opportunities.map((opportunity) => (
                      <option key={opportunity.id} value={String(opportunity.id)}>
                        #{opportunity.id} — {opportunity.contact_name ||
                          opportunity.organization_name ||
                          opportunity.title}
                      </option>
                    ))}
                  </select>
                </InlineFact>

                <InlineFact label="Opportunity Name:">
                  <input
                    value={opportunityName}
                    onChange={(event) => setOpportunityName(event.target.value)}
                    placeholder="—"
                    className="w-full rounded-md border border-transparent bg-transparent py-0.5 text-[12px] font-bold text-slate-800 outline-none transition hover:border-slate-200 focus:border-[#233353] dark:text-white"
                  />
                </InlineFact>
              </div>

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <Field label="Organization Name" required>
                  <input
                    value={organizationName}
                    onChange={(event) => setOrganizationName(event.target.value)}
                    placeholder="Organization name"
                    className={INPUT}
                  />
                </Field>

                <Field label="Contact Person" required>
                  <div className="relative">
                    <input
                      value={contactName}
                      onChange={(event) => setContactName(event.target.value)}
                      placeholder="Contact person"
                      className={`${INPUT} pr-28`}
                    />

                    {designation && (
                      <span className="absolute right-2 top-1/2 max-w-[100px] -translate-y-1/2 truncate rounded-md bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600 dark:bg-[#0d2336] dark:text-slate-300">
                        {designation}
                      </span>
                    )}
                  </div>
                </Field>

                <Field label="Mobile Number" required>
                  <div className="flex items-center gap-2">
                    <span className="flex h-11 shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 dark:border-[#17304a] dark:bg-[#071929] dark:text-slate-200">
                      🇮🇳 +91 ▾
                    </span>

                    <input
                      value={mobileNumber}
                      onChange={(event) => setMobileNumber(event.target.value)}
                      placeholder="xxxxxxxxxxx"
                      className={INPUT}
                    />
                  </div>
                </Field>

                <Field label="Email Address">
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="Enter email address"
                    className={INPUT}
                  />
                </Field>

                <Field label="Assigned to" required>
                  <div className="relative">
                    {assignedToId && (
                      <span className="pointer-events-none absolute left-2 top-1/2 z-10 flex -translate-y-1/2 items-center gap-1.5 rounded-md bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-700 dark:bg-[#0d2336] dark:text-slate-200">
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#233353] text-[7px] text-white">
                          {getInitials(userName(assignedToId))}
                        </span>
                        {userName(assignedToId)}
                      </span>
                    )}

                    <select
                      value={assignedToId}
                      onChange={(event) => setAssignedToId(event.target.value)}
                      className={`${INPUT} ${assignedToId ? "text-transparent" : ""}`}
                    >
                      <option value="">Select</option>

                      {users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </Field>

                <div className="grid grid-cols-2 gap-5">
                  <Field label="Quotation Date">
                    <input
                      type="date"
                      value={quotationDate}
                      onChange={(event) => setQuotationDate(event.target.value)}
                      className={INPUT}
                    />
                  </Field>

                  <Field label="Validation Date(30 days)">
                    <input
                      type="date"
                      value={validationDate}
                      onChange={(event) => setValidationDate(event.target.value)}
                      className={INPUT}
                    />
                  </Field>
                </div>
              </div>
            </FormSectionBlock>

            {/* ADDRESSES */}

            <FormSectionBlock icon={<FiMapPin size={16} />} title="Address Details">
              <BillingShippingHeader
                sameAsBilling={sameAsBilling}
                onToggle={setSameAsBilling}
              />

              <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-2">
                <AddressFields
                  value={billing}
                  onChange={setBilling}
                  states={states}
                />

                <AddressFields
                  value={shipping}
                  onChange={setShipping}
                  states={states}
                  disabled={sameAsBilling}
                />
              </div>
            </FormSectionBlock>

            {/* PRODUCTS */}

            <FormSectionBlock
              icon={<FiGrid size={16} />}
              title="Products & Order Items"
            >
              <div className="mb-4 flex justify-end">
                <button
                  type="button"
                  onClick={openProductModal}
                  className="flex h-9 items-center gap-1.5 rounded-lg bg-[#233353] px-4 text-xs font-semibold text-white transition hover:bg-[#18243a]"
                >
                  <FiPlus size={13} />
                  Add Product
                </button>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-[#17304a]">
                <table className="w-full min-w-[720px]">
                  <thead className="border-b border-slate-200 dark:border-[#17304a]">
                    <tr>
                      <Th>Product</Th>
                      <Th>Model / Variant</Th>
                      <Th>Qty</Th>
                      <Th>Discount</Th>
                      <Th>Tax</Th>
                      <Th>Unit Price</Th>
                      <Th />
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100 dark:divide-[#0d2336]">
                    {items.length === 0 && (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-4 py-10 text-center text-xs text-slate-400"
                        >
                          No products added yet. Use Add Product to build the
                          quotation.
                        </td>
                      </tr>
                    )}

                    {items.map((item) => {
                      const editing = editingItemKey === item.key;

                      return (
                        /* The design has no pencil: clicking the row is what
                           puts its cells into edit mode. */
                        <tr
                          key={item.key}
                          onClick={() => setEditingItemKey(item.key)}
                          className={`cursor-pointer ${
                            editing
                              ? "bg-slate-50 dark:bg-[#071929]"
                              : "hover:bg-slate-50/60 dark:hover:bg-[#071929]/50"
                          }`}
                        >
                          <td className="px-4 py-3">
                            <p className="text-xs font-bold text-slate-900 dark:text-white">
                              {item.product}
                            </p>

                            <p className="mt-0.5 text-[10px] text-slate-400">
                              SKU: {item.sku}
                            </p>
                          </td>

                          <td className="px-4 py-3">
                            {editing ? (
                              <input
                                value={item.model}
                                onChange={(event) =>
                                  updateItem(item.key, { model: event.target.value })
                                }
                                className={CELL_INPUT}
                              />
                            ) : (
                              <span className="text-[11px] text-slate-600 dark:text-slate-300">
                                {item.model}
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-3">
                            {editing ? (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateItem(item.key, {
                                      quantity: Math.max(1, item.quantity - 1),
                                    })
                                  }
                                  className={STEPPER}
                                >
                                  <FiMinus size={11} />
                                </button>

                                <span className="w-6 text-center text-[11px] font-semibold">
                                  {item.quantity}
                                </span>

                                <button
                                  type="button"
                                  onClick={() =>
                                    updateItem(item.key, {
                                      quantity: item.quantity + 1,
                                    })
                                  }
                                  className={STEPPER}
                                >
                                  <FiPlus size={11} />
                                </button>
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-600 dark:text-slate-300">
                                {item.quantity}
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-3">
                            {editing ? (
                              <input
                                type="number"
                                value={item.discount}
                                onChange={(event) =>
                                  updateItem(item.key, {
                                    discount: Number(event.target.value) || 0,
                                  })
                                }
                                className={CELL_INPUT}
                              />
                            ) : (
                              <span className="text-[11px] text-slate-600 dark:text-slate-300">
                                {item.discount} %
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-3">
                            {editing ? (
                              <input
                                type="number"
                                value={item.tax}
                                onChange={(event) =>
                                  updateItem(item.key, {
                                    tax: Number(event.target.value) || 0,
                                  })
                                }
                                className={CELL_INPUT}
                              />
                            ) : (
                              <span className="text-[11px] text-slate-600 dark:text-slate-300">
                                {item.tax} %
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-3">
                            {editing ? (
                              <input
                                type="number"
                                value={item.unitPrice}
                                onChange={(event) =>
                                  updateItem(item.key, {
                                    unitPrice: Number(event.target.value) || 0,
                                  })
                                }
                                className={CELL_INPUT}
                              />
                            ) : (
                              <span className="text-[11px] text-slate-600 dark:text-slate-300">
                                {item.unitPrice.toLocaleString("en-IN")}
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end">
                              <button
                                type="button"
                                aria-label="Remove line"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  removeItem(item.key);
                                }}
                                className={`rounded-md p-1.5 text-rose-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/20 ${
                                  editing ? "bg-rose-50 dark:bg-rose-950/20" : ""
                                }`}
                              >
                                <FiTrash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* TOTALS */}

              <div className="mt-5 space-y-2.5 pl-auto">
                <TotalRow label="Subtotal:" value={money(totals.subtotal)} />

                <TotalRow
                  label="Total Discount"
                  value={`-${money(totals.discountAmount)}`}
                  tone="rose"
                  editable
                />

                <TotalRow
                  label={`ORC (${totals.orcPercent.toFixed(2)}%)`}
                  value={`+${money(totals.orcAmount)}`}
                  editable
                  onEdit={(next) => setOrcAmount(next)}
                  raw={orcAmount}
                />

                <TotalRow
                  label="Freight Charges"
                  value={`+${money(totals.freight)}`}
                  editable
                  onEdit={(next) => setFreight(next)}
                  raw={freight}
                />

                <TotalRow
                  label="Lumpsum (Installation)"
                  value={`+${money(totals.installation)}`}
                  editable
                  onEdit={(next) => setInstallation(next)}
                  raw={installation}
                />

                <TotalRow
                  label="Taxable Amount:"
                  value={money(totals.taxableAmount)}
                />

                <TotalRow
                  label={`Estimated GST (${gstPercent}%):`}
                  value={`+${money(totals.gstAmount)}`}
                />

                <div className="border-t border-slate-200 pt-2.5 dark:border-[#17304a]">
                  <TotalRow
                    label="Total Payable:"
                    value={money(totals.totalPayable)}
                    strong
                  />
                </div>
              </div>
            </FormSectionBlock>

            {/* ATTACHMENTS */}

            <FormSectionBlock
              icon={<FiFileText size={16} />}
              title="Attached Documents & Annexures"
            >
              <div
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-12 transition ${
                  isDragging
                    ? "border-[#233353] bg-slate-50 dark:bg-[#0b2034]"
                    : "border-slate-300 dark:border-[#17304a]"
                }`}
              >
                <FiUploadCloud size={22} className="text-slate-400" />

                <p className="text-xs font-medium text-slate-500">
                  Drop files or click to upload
                </p>

                <p className="text-[10px] text-slate-400">
                  PDF, DOC, XLS up to 10MB
                </p>

                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  hidden
                  onChange={handleFileInput}
                />
              </div>

              {attachments.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {attachments.map((file, index) => (
                    <span
                      key={`${file.name}-${index}`}
                      className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-medium text-slate-700 dark:border-[#17304a] dark:bg-[#071929] dark:text-slate-200"
                    >
                      <FiFileText size={12} className={fileTone(file.name)} />

                      {file.name}

                      <button
                        type="button"
                        aria-label={`Remove ${file.name}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          setAttachments((current) =>
                            current.filter((_, i) => i !== index),
                          );
                        }}
                        className="text-slate-400 transition hover:text-rose-500"
                      >
                        <FiX size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </FormSectionBlock>

            {/* TERMS */}

            <FormSectionBlock
              icon={<FiShield size={16} />}
              title="Terms, Conditions & Technical Notes"
            >
              <div className="rounded-xl bg-slate-50 p-4 dark:bg-[#0b2034]">
                <p className="mb-3 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  Statutory &amp; Operational Clauses
                </p>

                <div className="space-y-2.5">
                  {terms.map((term, index) => (
                    <label
                      key={term.label}
                      className="flex cursor-pointer items-start gap-2.5"
                    >
                      <input
                        type="checkbox"
                        checked={term.checked}
                        onChange={(event) =>
                          setTerms((current) =>
                            current.map((entry, i) =>
                              i === index
                                ? { ...entry, checked: event.target.checked }
                                : entry,
                            ),
                          )
                        }
                        className="mt-0.5 h-3.5 w-3.5 cursor-pointer rounded border-slate-300 accent-[#233353]"
                      />

                      <span className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                        {term.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="mt-5">
                <RichTextEditor
                  label="Commercial Remarks & Special Project Scope"
                  value={remarks}
                  onChange={(html) => setRemarks(html)}
                  /* The paperclip adds to the same annexure list as the
                     drop zone above, rather than being a second store. */
                  onAttach={addFiles}
                  ariaLabel="Commercial remarks"
                  minHeight={110}
                  placeholder="1. Scope excludes civil foundations..."
                />
              </div>
            </FormSectionBlock>
          </FormCard>

          {/* ---------------- RIGHT: ORDER SUMMARY ---------------- */}

          <div className="lg:sticky lg:top-4 lg:self-start">
            <FormCard>
              <FormSectionBlock
                first
                icon={<FiBookmark size={16} />}
                title="Order Summary"
              >
                <div className="rounded-xl bg-emerald-50 px-4 py-4 dark:bg-emerald-950/20">
                  <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                    Total Payable
                  </p>

                  <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
                    {money(totals.totalPayable)}
                  </p>
                </div>

                <p className="mt-5 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  Payment Terms:
                </p>

                <div className="mt-2.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-500">
                      {advancePercent}% Advance
                    </span>

                    <span className="text-[11px] font-semibold text-amber-600">
                      {money(totals.advanceAmount)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-500">
                      {100 - advancePercent}% Against Delivery
                    </span>

                    <span className="text-[11px] font-semibold text-blue-600">
                      {money(totals.onDeliveryAmount)}
                    </span>
                  </div>
                </div>

                <div className="mt-5 rounded-xl border border-dashed border-slate-300 p-3.5 dark:border-[#17304a]">
                  <div className="flex items-start gap-2.5">
                    <FiInfo size={14} className="mt-0.5 shrink-0 text-blue-500" />

                    <div>
                      <p className="text-[11px] font-bold text-slate-800 dark:text-white">
                        Opportunity Pipeline Stage
                      </p>

                      <p className="mt-1 text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">
                        {opportunityId ? (
                          <>
                            Generating this quotation will automatically move
                            Opportunity{" "}
                            <span className="font-bold text-slate-700 dark:text-slate-200">
                              #{opportunityId}
                            </span>{" "}
                            to Proposal / Price Quote.
                          </>
                        ) : (
                          "Select an opportunity above to link this quotation to the pipeline."
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="flex h-10 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-[#17304a] dark:bg-[#071929] dark:text-slate-200"
                  >
                    <FiDownload size={13} />
                    Download PDF
                  </button>

                  <button
                    type="button"
                    onClick={saveAndEmail}
                    disabled={saving}
                    className="flex h-10 items-center justify-center gap-1.5 rounded-lg bg-[#233353] text-xs font-semibold text-white transition hover:bg-[#18243a] disabled:opacity-50"
                  >
                    <FiMail size={13} />
                    Email Draft
                  </button>
                </div>
              </FormSectionBlock>
            </FormCard>
          </div>
        </form>

        {showProductModal && (
          <ProductPickerModal
            products={filteredProducts}
            picked={picked}
            search={productSearch}
            onSearch={setProductSearch}
            category={productCategory}
            onCategory={setProductCategory}
            onToggle={togglePicked}
            onUpdate={updatePicked}
            onClose={() => setShowProductModal(false)}
            onConfirm={confirmProducts}
          />
        )}
      </div>
    );
  }

  /* --------------------------------------------------------------------------
     RENDER - LIST
  -------------------------------------------------------------------------- */

  return (
    <ListPage>
      <ListPageHeader
        title="Quotation"
        refreshing={refreshing}
        onRefresh={refresh}
        actions={
          <div className="relative" ref={pageMenuRef}>
            <button
              type="button"
              aria-label="Page actions"
              onClick={() => setShowPageMenu((previous) => !previous)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 dark:border-[#17304a] dark:bg-[#071929]"
            >
              <FiMoreVertical size={15} />
            </button>

            {showPageMenu && (
              <div className="absolute right-0 top-full z-40 mt-1 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1.5 shadow-xl dark:border-[#17304a] dark:bg-[#051422]">
                <button
                  type="button"
                  onClick={exportCsv}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-[#071929]"
                >
                  <FiDownload size={14} className="text-slate-500" />
                  Export Data
                </button>

                <button
                  type="button"
                  onClick={downloadChart}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-[#071929]"
                >
                  <FiGrid size={14} className="text-slate-500" />
                  Download Chart
                </button>
              </div>
            )}
          </div>
        }
      />

      <StatGrid cols={6}>
        <StatCard
          label="Total Quotes"
          value={String(stats.total)}
          change="12.4%"
        />

        <StatCard
          label="Gross Value"
          value={compactMoney(stats.grossValue)}
          change="8.7%"
        />

        <StatCard
          label="Drafts"
          value={String(stats.drafts)}
          caption={`${compactMoney(stats.draftValue)} value`}
        />

        <StatCard
          label="Sent"
          value={String(stats.sent)}
          caption={`${compactMoney(stats.sentValue)} awaiting`}
        />

        <StatCard label="Accepted" value={String(stats.accepted)} caption="" />

        <StatCard label="Expired" value={String(stats.expired)} caption="" />
      </StatGrid>

      <div className="relative" ref={filterRef}>
        <ListToolbar
          search={search}
          onSearchChange={setSearch}
          placeholder="Search Order"
          activeFilterCount={activeFilterCount}
          onToggleFilters={() => {
            setDraftFilters(filters);
            setShowFilter((previous) => !previous);
          }}
          trailing={
            <PrimaryAction onClick={openCreate} icon={<FiPlus size={14} />}>
              Add New Quotation
            </PrimaryAction>
          }
        />

        {showFilter && (
          <FilterPopover
            value={draftFilters}
            onChange={setDraftFilters}
            customerTypes={customerTypes}
            users={users}
            states={states}
            onApply={() => {
              setFilters(draftFilters);
              setShowFilter(false);
              addToast("Quotation filters applied.", "success");
            }}
            onClear={() => {
              setDraftFilters(EMPTY_FILTERS);
              setFilters(EMPTY_FILTERS);
              setShowFilter(false);
              addToast("Filters cleared.", "info");
            }}
          />
        )}
      </div>

      {/* STATUS TABS */}

      <div className="flex flex-wrap items-center gap-2">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setStatusTab(tab.value)}
            className={`rounded-lg border px-3.5 py-2 text-[11px] font-semibold transition ${
              statusTab === tab.value
                ? "border-[#233353] bg-[#233353] text-white"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-[#17304a] dark:bg-[#071929] dark:text-slate-300"
            }`}
          >
            {tab.label} ({tabCounts[tab.value] ?? 0})
          </button>
        ))}
      </div>

      <TableCard>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px]">
            <thead className="border-b border-slate-200 dark:border-[#17304a]">
              <tr>
                <Th className="w-10">
                  <input type="checkbox" className="h-4 w-4 rounded border-slate-300" />
                </Th>
                <Th>
                  <SortLabel>Quote ID</SortLabel>
                </Th>
                <Th>
                  <SortLabel>Customer Name</SortLabel>
                </Th>
                <Th>
                  <SortLabel>Opportunity</SortLabel>
                </Th>
                <Th>
                  <SortLabel>Order Value</SortLabel>
                </Th>
                <Th>
                  <SortLabel>Assigned To</SortLabel>
                </Th>
                <Th>
                  <SortLabel>Dates</SortLabel>
                </Th>
                <Th>
                  <SortLabel>Status</SortLabel>
                </Th>
                <Th className="text-center">Actions</Th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-[#0d2336]/70">
              {loading && (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center">
                    <CgSpinner className="mx-auto animate-spin text-2xl text-slate-400" />
                  </td>
                </tr>
              )}

              {!loading && paginated.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-16 text-center text-xs text-slate-400"
                  >
                    No quotations found. Use Add New Quotation to raise one.
                  </td>
                </tr>
              )}

              {!loading &&
                paginated.map((quotation) => (
                  <tr
                    key={quotation.id}
                    className="transition hover:bg-slate-50 dark:hover:bg-[#071929]/50"
                  >
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300"
                      />
                    </td>

                    <td className="px-4 py-4">
                      <span className="font-mono text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        #{quotation.quote_number}
                      </span>
                    </td>

                    <td className="px-4 py-4">
                      <p className="text-xs font-bold text-slate-900 dark:text-white">
                        {quotation.contact_name || "—"}
                      </p>

                      <p className="mt-1 text-[10px] text-slate-400">
                        {quotation.email || "No email"}
                      </p>

                      <p className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-slate-400">
                        <FiMapPin size={9} />
                        {quotation.state_name ||
                          quotation.billing_address?.state ||
                          "No address"}
                      </p>
                    </td>

                    <td className="px-4 py-4">
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {quotation.opportunity_name ||
                          quotation.organization_name ||
                          "—"}
                      </p>

                      {quotation.opportunity_id && (
                        <p className="mt-1 text-[10px] font-semibold text-slate-400">
                          #{quotation.opportunity_id} ↗
                        </p>
                      )}
                    </td>

                    <td className="px-4 py-4">
                      <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        {compactMoney(quotation.total_payable)}
                      </span>
                    </td>

                    <td className="px-4 py-4">
                      <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 dark:border-[#0d2336] dark:bg-[#071929]">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#233353] text-[9px] font-bold text-white">
                          {getInitials(userName(quotation.assigned_to_id))}
                        </span>

                        <span className="max-w-[110px] truncate text-[10px] font-semibold text-slate-700 dark:text-slate-200">
                          {userName(quotation.assigned_to_id)}
                        </span>
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <span className="text-[10px] font-medium text-slate-400">
                        {formatDate(quotation.quotation_date || quotation.created_at)}
                      </span>
                    </td>

                    <td className="px-4 py-4">
                      <StatusPill status={quotation.status} />
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          title="Send Quotation"
                          disabled={
                            !nextQuotationStatuses(quotation.status).includes(
                              QUOTATION_STATUS.SENT,
                            )
                          }
                          onClick={() => setSendTarget(quotation)}
                          className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-[#071929]"
                        >
                          <FiSend size={14} />
                        </button>

                        <div className="relative" data-row-menu>
                          <button
                            type="button"
                            title="More Actions"
                            onClick={() =>
                              setRowMenuId((previous) =>
                                previous === quotation.id ? null : quotation.id,
                              )
                            }
                            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-[#071929]"
                          >
                            <FiMoreVertical size={14} />
                          </button>

                          {rowMenuId === quotation.id && (
                            <div className="absolute right-0 top-full z-40 mt-1 w-48 rounded-xl border border-slate-200 bg-white p-1 shadow-xl dark:border-[#0d2336] dark:bg-[#051422]">
                              {nextQuotationStatuses(quotation.status).length ===
                                0 && (
                                <p className="px-3 py-2 text-[11px] text-slate-400">
                                  No further actions —{" "}
                                  {quotationStatusLabel(quotation.status).toLowerCase()}{" "}
                                  is final.
                                </p>
                              )}

                              {nextQuotationStatuses(quotation.status).map(
                                (status) => (
                                  <button
                                    key={status}
                                    type="button"
                                    onClick={() => {
                                      if (status === QUOTATION_STATUS.SENT) {
                                        setRowMenuId(null);
                                        setSendTarget(quotation);
                                        return;
                                      }

                                      changeStatus(quotation, status);
                                    }}
                                    className="flex w-full items-center rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-[#071929]"
                                  >
                                    {status === QUOTATION_STATUS.SENT
                                      ? "Send to Client"
                                      : `Mark as ${quotationStatusLabel(status)}`}
                                  </button>
                                ),
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <Pagination
          page={currentPage}
          pageSize={ROWS_PER_PAGE}
          totalItems={filtered.length}
          totalPages={Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE))}
          onPageChange={setCurrentPage}
          noun="quotations"
        />
      </TableCard>

      {sendTarget && (
        <SendQuotationModal
          quotation={sendTarget}
          sender={sender}
          onClose={() => setSendTarget(null)}
          onSent={async (message) => {
            setSendTarget(null);
            addToast(message, "success");
            await fetchQuotations();
          }}
          onError={(message) => addToast(message, "error")}
          onNotice={(message) => addToast(message, "info")}
        />
      )}
    </ListPage>
  );
}

/* ============================================================================
   SHARED STYLES
============================================================================ */

const INPUT =
  "h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#233353] disabled:bg-slate-50 disabled:text-slate-400 dark:border-[#17304a] dark:bg-[#071929] dark:text-white";

const CELL_INPUT =
  "h-8 w-full min-w-[70px] rounded-md border border-slate-200 bg-white px-2 text-[11px] text-slate-800 outline-none focus:border-[#233353] dark:border-[#17304a] dark:bg-[#071929] dark:text-white";

const STEPPER =
  "flex h-6 w-6 items-center justify-center rounded border border-slate-200 text-slate-500 transition hover:bg-slate-100 dark:border-[#17304a] dark:hover:bg-[#0d2336]";

/* ============================================================================
   SMALL COMPONENTS
============================================================================ */

/** Red for PDF/DOC, green for spreadsheets, as in the design. */
function fileTone(name: string) {
  return /\.(xls|xlsx|csv)$/i.test(name) ? "text-emerald-600" : "text-rose-500";
}

/** Column header with the sort chevrons used across the CRM tables. */
function SortLabel({ children }: { children: ReactNode }) {
  return (
    <span className="flex items-center gap-2">
      {children}

      <span className="flex flex-col leading-[6px] text-slate-300">
        <span>⌃</span>
        <span>⌄</span>
      </span>
    </span>
  );
}

/** Read-only "Label: value" pair used at the top of the create form. */
function InlineFact({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] text-slate-500 dark:text-slate-400">
        {label}
      </span>

      <span className="text-[12px] font-bold text-slate-800 dark:text-white">
        {children}
      </span>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-medium text-slate-600 dark:text-slate-300">
        {label}
        {required && <span className="text-rose-500"> *</span>}
      </label>

      {children}
    </div>
  );
}

function AddressFields({
  value,
  onChange,
  states,
  disabled,
}: {
  value: AddressState;
  onChange: (next: AddressState) => void;
  states: StateModel[];
  disabled?: boolean;
}) {
  const set = (patch: Partial<AddressState>) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Street Address" required>
          <input
            value={value.street}
            disabled={disabled}
            onChange={(event) => set({ street: event.target.value })}
            placeholder="Street Address, Building, Suite"
            className={INPUT}
          />
        </Field>

        <Field label="State / Province" required>
          <input
            value={value.state}
            disabled={disabled}
            onChange={(event) => set({ state: event.target.value })}
            placeholder="State"
            list="quotation-states"
            className={INPUT}
          />

          <datalist id="quotation-states">
            {states.map((state) => (
              <option key={state.id} value={state.name} />
            ))}
          </datalist>
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Field label="City" required>
          <input
            value={value.city}
            disabled={disabled}
            onChange={(event) => set({ city: event.target.value })}
            placeholder="Type or select"
            className={INPUT}
          />
        </Field>

        <Field label="Country" required>
          <select
            value={value.country}
            disabled={disabled}
            onChange={(event) => set({ country: event.target.value })}
            className={INPUT}
          >
            <option value="">Select here</option>
            <option value="India">India</option>
            <option value="United States">United States</option>
            <option value="China">China</option>
            <option value="Malaysia">Malaysia</option>
            <option value="Indonesia">Indonesia</option>
          </select>
        </Field>

        <Field label="PIN / ZIP Code" required>
          <input
            value={value.zipCode}
            disabled={disabled}
            onChange={(event) => set({ zipCode: event.target.value })}
            placeholder="Pin Code"
            className={INPUT}
          />
        </Field>
      </div>
    </div>
  );
}

function TotalRow({
  label,
  value,
  tone,
  strong,
  editable,
  onEdit,
  raw,
}: {
  label: string;
  value: string;
  tone?: "rose";
  strong?: boolean;
  editable?: boolean;
  onEdit?: (next: number) => void;
  raw?: number;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="flex items-center justify-end gap-6">
      <span
        className={`flex items-center gap-1.5 text-[11px] ${
          strong
            ? "font-bold text-slate-800 dark:text-white"
            : "text-slate-500 dark:text-slate-400"
        }`}
      >
        {label}

        {editable && onEdit && (
          <button
            type="button"
            aria-label={`Edit ${label}`}
            onClick={() => setEditing((previous) => !previous)}
            className="text-slate-400 transition hover:text-slate-700"
          >
            <FiEdit2 size={10} />
          </button>
        )}
      </span>

      {editing && onEdit ? (
        <input
          type="number"
          autoFocus
          value={raw ?? 0}
          onChange={(event) => onEdit(Number(event.target.value) || 0)}
          onBlur={() => setEditing(false)}
          className="h-7 w-28 rounded-md border border-slate-200 px-2 text-right text-[11px] outline-none focus:border-[#233353] dark:border-[#17304a] dark:bg-[#071929]"
        />
      ) : (
        <span
          className={`w-32 text-right text-[11px] ${
            strong
              ? "text-base font-bold text-slate-900 dark:text-white"
              : tone === "rose"
                ? "font-semibold text-rose-500"
                : "font-semibold text-slate-700 dark:text-slate-200"
          }`}
        >
          {value}
        </span>
      )}
    </div>
  );
}

/* ============================================================================
   FILTER POPOVER
============================================================================ */

function FilterPopover({
  value,
  onChange,
  customerTypes,
  users,
  states,
  onApply,
  onClear,
}: {
  value: QuotationFilters;
  onChange: (next: QuotationFilters) => void;
  customerTypes: CustomerTypeModel[];
  users: { id: string; name: string }[];
  states: StateModel[];
  onApply: () => void;
  onClear: () => void;
}) {
  const set = (patch: Partial<QuotationFilters>) => onChange({ ...value, ...patch });

  return (
    <div className="absolute right-0 top-full z-40 mt-2 w-[530px] rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-[#17304a] dark:bg-[#051422]">
      <div className="p-6">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[12px] font-semibold text-slate-600 dark:text-slate-300">
            Date Range
          </span>

          <button
            type="button"
            onClick={onClear}
            className="flex items-center gap-1 text-[11px] font-semibold text-rose-500 transition hover:text-rose-600"
          >
            <FiX size={11} />
            Clear Filter
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <input
            type="date"
            value={value.dateFrom}
            onChange={(event) => set({ dateFrom: event.target.value })}
            className={INPUT}
          />

          <input
            type="date"
            value={value.dateTo}
            onChange={(event) => set({ dateTo: event.target.value })}
            className={INPUT}
          />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4">
          <Field label="Customer Type">
            <select
              value={value.customerType}
              onChange={(event) => set({ customerType: event.target.value })}
              className={INPUT}
            >
              <option value="">All Customer Types</option>

              {customerTypes.map((type) => (
                <option key={type.id} value={type.name}>
                  {type.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Assigned To">
            <select
              value={value.assignedTo}
              onChange={(event) => set({ assignedTo: event.target.value })}
              className={INPUT}
            >
              <option value="">All Users</option>

              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4">
          <Field label="Status">
            <select
              value={value.status}
              onChange={(event) => set({ status: event.target.value })}
              className={INPUT}
            >
              <option value="">All</option>

              {STATUS_TABS.filter((tab) => tab.value !== "All").map((tab) => (
                <option key={tab.value} value={tab.value}>
                  {tab.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="State">
            <select
              value={value.state}
              onChange={(event) => set({ state: event.target.value })}
              className={INPUT}
            >
              <option value="">All</option>

              {states.map((state) => (
                <option key={state.id} value={String(state.id)}>
                  {state.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      <div className="flex items-center justify-end gap-5 border-t border-slate-200 px-6 py-4 dark:border-[#17304a]">
        <button
          type="button"
          onClick={onClear}
          className="text-xs font-semibold text-slate-600 transition hover:text-slate-900 dark:text-slate-300"
        >
          Clear All Filter
        </button>

        <button
          type="button"
          onClick={onApply}
          className="h-10 rounded-lg bg-[#233353] px-6 text-xs font-bold text-white transition hover:bg-[#18243a]"
        >
          Apply Filter
        </button>
      </div>
    </div>
  );
}

/* ============================================================================
   PRODUCT PICKER
============================================================================ */

function ProductPickerModal({
  products,
  picked,
  search,
  onSearch,
  category,
  onCategory,
  onToggle,
  onUpdate,
  onClose,
  onConfirm,
}: {
  products: CatalogProduct[];
  picked: LineItem[];
  search: string;
  onSearch: (value: string) => void;
  category: string;
  onCategory: (value: string) => void;
  onToggle: (product: CatalogProduct) => void;
  onUpdate: (key: string, patch: Partial<LineItem>) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const lineTotal = picked.reduce(
    (sum, item) =>
      sum + item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100),
    0,
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-5">
      <div className="flex h-[590px] w-full max-w-[780px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-[#051422]">
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 px-5 dark:border-[#17304a]">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-white">
            Add Products to Order
          </h2>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 transition hover:text-slate-700"
          >
            <FiX size={17} />
          </button>
        </div>

        <div className="px-5 pt-4">
          <div className="relative">
            <input
              value={search}
              onChange={(event) => onSearch(event.target.value)}
              placeholder="Search by product name, model or SKU..."
              className="h-10 w-full rounded-md border border-slate-300 px-3 pr-10 text-xs outline-none focus:border-slate-400 dark:border-[#17304a] dark:bg-[#071929] dark:text-white"
            />

            <FiSearch
              size={15}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600"
            />
          </div>
        </div>

        <div className="px-5 pt-3">
          <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-200 dark:border-[#17304a]">
            {PRODUCT_CATEGORIES.map((entry) => (
              <button
                key={entry}
                type="button"
                onClick={() => onCategory(entry)}
                className={`whitespace-nowrap px-3 py-2 text-[10px] font-medium transition ${
                  category === entry
                    ? "rounded-t-md bg-[#24395f] text-white"
                    : "text-slate-600 hover:bg-slate-50 dark:text-slate-300"
                }`}
              >
                {entry}
              </button>
            ))}
          </div>
        </div>

        <div className="grid flex-1 grid-cols-2 gap-5 overflow-hidden px-5 py-4">
          <div className="space-y-2 overflow-y-auto pr-1">
            {products.map((product) => {
              const checked = picked.some((item) => item.productId === product.id);

              return (
                <button
                  type="button"
                  key={product.id}
                  onClick={() => onToggle(product)}
                  className={`w-full rounded-xl border p-3 text-left transition ${
                    checked
                      ? "border-slate-400 bg-slate-50 dark:border-[#2a4straight] dark:bg-[#0b2034]"
                      : "border-slate-200 bg-white hover:bg-slate-50 dark:border-[#17304a] dark:bg-[#071929]"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-0.5 flex h-4 w-4 items-center justify-center rounded border text-[9px] ${
                        checked
                          ? "border-[#24395f] bg-[#24395f] text-white"
                          : "border-slate-300"
                      }`}
                    >
                      {checked ? "✓" : ""}
                    </span>

                    <div className="min-w-0">
                      <p className="truncate text-[11px] font-bold text-slate-800 dark:text-white">
                        {product.name}
                      </p>

                      <p className="mt-1 text-[10px] text-slate-500">
                        {money(product.price)} · {product.available} available
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}

            {products.length === 0 && (
              <p className="py-10 text-center text-[11px] text-slate-400">
                No products match that search.
              </p>
            )}
          </div>

          <div className="flex flex-col overflow-hidden">
            <div className="mb-2 flex items-center gap-2">
              <FiGrid size={13} className="text-slate-500" />

              <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                Selected Products
              </p>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto border-t border-slate-200 pt-3 dark:border-[#17304a]">
              {picked.length === 0 && (
                <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
                  <FiInfo size={16} className="text-slate-300" />

                  <p className="text-[11px] font-semibold text-slate-500">
                    No Product Selected
                  </p>

                  <p className="text-[10px] text-slate-400">
                    Select product to get started
                  </p>
                </div>
              )}

              {picked.map((item) => (
                <div
                  key={item.key}
                  className="rounded-xl border border-slate-200 p-3 dark:border-[#17304a]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[11px] font-bold text-slate-800 dark:text-white">
                      {item.model}
                    </p>

                    <button
                      type="button"
                      aria-label="Remove"
                      onClick={() =>
                        onToggle({
                          id: item.productId,
                          name: item.model,
                          category: item.product,
                          price: item.unitPrice,
                          available: 0,
                        })
                      }
                      className="text-rose-400 transition hover:text-rose-600"
                    >
                      <FiTrash2 size={13} />
                    </button>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-[10px] text-slate-500">Quantity</span>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          onUpdate(item.key, {
                            quantity: Math.max(1, item.quantity - 1),
                          })
                        }
                        className={STEPPER}
                      >
                        <FiMinus size={11} />
                      </button>

                      <span className="w-6 text-center text-[11px] font-semibold">
                        {item.quantity}
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          onUpdate(item.key, { quantity: item.quantity + 1 })
                        }
                        className={STEPPER}
                      >
                        <FiPlus size={11} />
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <div>
                      <label className="mb-1 block text-[9px] text-slate-500">
                        Unit Price (₹)
                      </label>

                      <input
                        type="number"
                        value={item.unitPrice}
                        onChange={(event) =>
                          onUpdate(item.key, {
                            unitPrice: Number(event.target.value) || 0,
                          })
                        }
                        className={CELL_INPUT}
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-[9px] text-slate-500">
                        Discount (%)
                      </label>

                      <input
                        type="number"
                        value={item.discount}
                        onChange={(event) =>
                          onUpdate(item.key, {
                            discount: Number(event.target.value) || 0,
                          })
                        }
                        className={CELL_INPUT}
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-[9px] text-slate-500">
                        Tax (GST %)
                      </label>

                      <select
                        value={item.tax}
                        onChange={(event) =>
                          onUpdate(item.key, { tax: Number(event.target.value) })
                        }
                        className={CELL_INPUT}
                      >
                        <option value={18}>18%</option>
                        <option value={15}>15%</option>
                        <option value={12}>12%</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3 dark:border-[#17304a]">
              <span className="text-[11px] text-slate-500">Line Total</span>

              <span className="text-[11px] font-bold text-slate-800 dark:text-white">
                {picked.length ? money(lineTotal) : 0}
              </span>
            </div>
          </div>
        </div>

        <div className="flex h-16 shrink-0 items-center justify-end gap-3 border-t border-slate-200 px-5 dark:border-[#17304a]">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-lg border border-slate-200 px-5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-[#17304a] dark:text-slate-200"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-[#233353] px-5 text-xs font-bold text-white transition hover:bg-[#18243a]"
          >
            <FiPlus size={13} />
            Add Product
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   SEND QUOTATION
============================================================================ */

function SendQuotationModal({
  quotation,
  sender,
  onClose,
  onSent,
  onError,
  onNotice,
}: {
  quotation: QuotationModel;
  sender: QuotationSender | null;
  onClose: () => void;
  onSent: (message: string) => void;
  onError: (message: string) => void;
  onNotice: (message: string) => void;
}) {
  const [to, setTo] = useState<string[]>(
    quotation.email ? [quotation.email] : [],
  );
  const [cc, setCc] = useState<string[]>([]);
  const [bcc, setBcc] = useState<string[]>([]);
  const [showBcc, setShowBcc] = useState(false);

  const [subject, setSubject] = useState(
    `Commercial & Technical Quotation [${quotation.quote_number}] — ${
      quotation.opportunity_name || quotation.organization_name || ""
    }`.trim(),
  );

  const defaultBody = useMemo(() => {
    const lines = [
      `Dear ${quotation.contact_name || "Sir/Madam"},`,
      "",
      `Please find attached the official quotation (${quotation.quote_number}) for the proposed ${
        quotation.opportunity_name || "requirement"
      }.`,
      "",
      "Key Highlights:",
      ...(quotation.items || []).map(
        (item) => `• ${item.quantity ?? 1}x ${item.model || item.product || "Item"}`,
      ),
      /* Total Payable already has GST added on top of the taxable amount,
         so it really is inclusive - but say by how much, and at what rate,
         rather than asserting a hardcoded 18%. */
      `• Total Value: ${money(quotation.total_payable)}${gstClause(quotation)}`,
      "",
      "Kindly review the attached quotation and let us know if you require any adjustments or technical clarifications.",
      "",
      "Warm regards,",
    ];

    return lines.join("\n");
  }, [quotation]);

  const [body, setBody] = useState(defaultBody);
  const [bodyHtml, setBodyHtml] = useState(() => textToHtml(defaultBody));

  const [options, setOptions] = useState<Record<SendOptionKey, boolean>>({
    track_opens: true,
    alert_on_download: false,
    attach_gst_audit_trail: false,
    notify_lead_owner: true,
  });

  const [sending, setSending] = useState(false);

  const toRef = useRef<HTMLInputElement | null>(null);

  /** Annexures the sender removed from this particular send. */
  const [dropped, setDropped] = useState<string[]>([]);

  /** Files attached from the composer's paperclip, for this send only. */
  const [extraFiles, setExtraFiles] = useState<AttachmentState[]>([]);

  const recipients = to;

  const send = async (testOnly: boolean) => {
    if (!testOnly && recipients.length === 0) {
      onError("Add at least one recipient before sending.");
      return;
    }

    const invalid = recipients.find((address) => !EMAIL_PATTERN.test(address));

    if (!testOnly && invalid) {
      onError(`"${invalid}" is not a valid email address.`);
      return;
    }

    setSending(true);

    try {
      await sendQuotationApi(quotation.id, {
        to: recipients.length ? recipients : [quotation.email || ""],
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
        setSending(false);
        return;
      }

      onSent(
        `${quotation.quote_number} emailed to ${recipients.join(", ")}.`,
      );
    } catch (error) {
      const detail =
        (error as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "The quotation could not be sent.";

      console.error(error);
      onError(detail);
      setSending(false);
    }
  };

  /* The button advertises Ctrl+Enter, so it has to actually work. */
  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        if (!sending) send(false);
      }

      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKey);

    return () => document.removeEventListener("keydown", handleKey);
  });

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-5">
      <div className="flex max-h-[92vh] w-full max-w-[920px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-[#051422]">
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 px-6 dark:border-[#17304a]">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-white">
            Send Quotation to Client
          </h2>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 transition hover:text-slate-700"
          >
            <FiX size={17} />
          </button>
        </div>

        <div className="grid flex-1 grid-cols-1 gap-5 overflow-y-auto p-6 lg:grid-cols-[minmax(0,1fr)_240px]">
          <div>
            {/* HEADERS */}

            <div className="rounded-xl bg-slate-50 p-4 dark:bg-[#0b2034]">
              {/* Read-only: every quotation leaves through the one configured
                  SMTP account, so there is no per-user sender to choose. */}
              <HeaderRow label="FROM">
                <span
                  title={
                    sender?.email
                      ? `Sent via ${sender.email}`
                      : "Sent via the configured SMTP account"
                  }
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-medium text-slate-700 dark:border-[#17304a] dark:bg-[#071929] dark:text-slate-200"
                >
                  <FiSend size={9} className="text-slate-400" />
                  {sender?.name || "Synergy CRM Portal"}
                </span>
              </HeaderRow>

              <HeaderRow
                label="TO"
                trailing={
                  <button
                    type="button"
                    onClick={() => toRef.current?.focus()}
                    className="whitespace-nowrap text-[11px] font-semibold text-blue-600"
                  >
                    + Add Recipient
                  </button>
                }
              >
                <ChipInput
                  inputRef={toRef}
                  values={to}
                  onChange={setTo}
                  placeholder="client@company.com"
                />
              </HeaderRow>

              <HeaderRow
                label="CC"
                trailing={
                  <button
                    type="button"
                    onClick={() => setShowBcc((previous) => !previous)}
                    className="whitespace-nowrap text-[11px] font-semibold text-blue-600"
                  >
                    + BCC
                  </button>
                }
              >
                <ChipInput values={cc} onChange={setCc} placeholder="Add CC" />
              </HeaderRow>

              {showBcc && (
                <HeaderRow label="BCC">
                  <ChipInput
                    values={bcc}
                    onChange={setBcc}
                    placeholder="Add BCC"
                  />
                </HeaderRow>
              )}

              <div className="flex items-start gap-3 pt-3">
                <span className="w-16 shrink-0 pt-2.5 text-right text-[10px] font-semibold text-slate-400">
                  SUBJECT
                </span>

                <input
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  className="h-10 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-[11px] text-slate-800 outline-none focus:border-[#233353] dark:border-[#17304a] dark:bg-[#071929] dark:text-white"
                />
              </div>
            </div>

            {/* BODY */}

            <div className="mt-5">
              <RichTextEditor
                label="Message Body"
                value={bodyHtml}
                onChange={(html, text) => {
                  setBodyHtml(html);
                  setBody(text);
                }}
                onAttach={(files) =>
                  setExtraFiles((current) => [
                    ...current,
                    ...files.map((file) => ({
                      name: file.name,
                      size: file.size,
                      type: file.type,
                    })),
                  ])
                }
                ariaLabel="Message body"
                minHeight={260}
              />
            </div>
          </div>

          {/* SIDE PANELS */}

          <div className="space-y-5">
            <div className="rounded-xl border border-slate-200 p-4 dark:border-[#17304a]">
              <p className="mb-3 text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                Attached Documents &amp; Annexures
              </p>

              {(quotation.attachments || []).length + extraFiles.length === 0 && (
                <p className="text-[10px] text-slate-400">
                  No annexures attached to this quotation.
                </p>
              )}

              <div className="space-y-2">
                {[...(quotation.attachments || []), ...extraFiles]
                  .filter((file) => !dropped.includes(file.name))
                  .map((file, index) => (
                    <div
                      key={`${file.name}-${index}`}
                      className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-2 dark:bg-[#0b2034]"
                    >
                      <FiFileText
                        size={12}
                        className={`shrink-0 ${fileTone(file.name)}`}
                      />

                      <span className="flex-1 truncate text-[10px] font-medium text-slate-700 dark:text-slate-200">
                        {file.name}
                      </span>

                      <button
                        type="button"
                        aria-label={`Remove ${file.name}`}
                        onClick={() =>
                          setDropped((current) => [...current, file.name])
                        }
                        className="shrink-0 text-slate-400 transition hover:text-rose-500"
                      >
                        <FiX size={11} />
                      </button>
                    </div>
                  ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-4 dark:border-[#17304a]">
              <p className="mb-3 text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                Statutory &amp; Operational Clauses
              </p>

              <div className="space-y-3">
                {SEND_OPTIONS.map((option) => (
                  <label
                    key={option.key}
                    className="flex cursor-pointer items-start gap-2.5"
                  >
                    <input
                      type="checkbox"
                      checked={options[option.key]}
                      onChange={(event) =>
                        setOptions((current) => ({
                          ...current,
                          [option.key]: event.target.checked,
                        }))
                      }
                      className="mt-0.5 h-3.5 w-3.5 cursor-pointer rounded border-slate-300 accent-[#233353]"
                    />

                    <span className="text-[10px] leading-relaxed text-slate-600 dark:text-slate-300">
                      {option.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER */}

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-6 py-4 dark:border-[#17304a]">
          <button
            type="button"
            onClick={() => send(true)}
            disabled={sending}
            className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 transition hover:text-blue-700 disabled:opacity-50"
          >
            <FiSend size={13} />
            Send Test Email To Self
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 items-center gap-1.5 rounded-lg border border-rose-200 px-5 text-xs font-semibold text-rose-500 transition hover:bg-rose-50 dark:border-rose-900/40"
            >
              <FiX size={13} />
              Cancel
            </button>

            <button
              type="button"
              onClick={onClose}
              className="flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 px-5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-[#17304a] dark:text-slate-200"
            >
              <FiBookmark size={13} />
              Save as Draft
            </button>

            <button
              type="button"
              onClick={() => send(false)}
              disabled={sending}
              className="flex h-10 items-center gap-2 rounded-lg bg-[#233353] px-5 text-xs font-bold text-white transition hover:bg-[#18243a] disabled:opacity-50"
            >
              {sending ? (
                <CgSpinner className="animate-spin" size={14} />
              ) : (
                <FiSend size={13} />
              )}
              {sending ? "Sending..." : "Send Quotation Email (Ctrl+Enter)"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Recipient field from the design: each address is a removable chip, with a
 * free-text tail that commits on Enter, comma or blur.
 */
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
    const entries = splitAddresses(draft).filter(
      (address) => !values.includes(address),
    );

    if (entries.length) onChange([...values, ...entries]);

    setDraft("");
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {values.map((address) => (
        <span
          key={address}
          className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-medium ${
            EMAIL_PATTERN.test(address)
              ? "border-slate-200 bg-white text-slate-700 dark:border-[#17304a] dark:bg-[#071929] dark:text-slate-200"
              : "border-rose-200 bg-rose-50 text-rose-600"
          }`}
        >
          <FiUser size={9} className="text-slate-400" />

          {address}

          <button
            type="button"
            aria-label={`Remove ${address}`}
            onClick={() => onChange(values.filter((entry) => entry !== address))}
            className="text-slate-400 transition hover:text-rose-500"
          >
            <FiX size={10} />
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
            return;
          }

          if (event.key === "Backspace" && !draft && values.length) {
            onChange(values.slice(0, -1));
          }
        }}
        onBlur={commit}
        placeholder={values.length ? "" : placeholder}
        className="min-w-[140px] flex-1 bg-transparent py-1 text-[11px] text-slate-700 outline-none dark:text-slate-200"
      />
    </div>
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
    <div className="flex items-center gap-3 border-b border-slate-200 py-2.5 dark:border-[#17304a]">
      <span className="w-16 shrink-0 text-right text-[10px] font-semibold text-slate-400">
        {label}
      </span>

      <div className="min-w-0 flex-1">{children}</div>

      {trailing}
    </div>
  );
}
