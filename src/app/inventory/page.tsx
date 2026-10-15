"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  LIST_TABLE,
  ListPage,
  ListPageHeader,
  ListToolbar,
  PrimaryAction,
  StatGrid,
  TableCard,
} from "@/components/crm/ListPageShell";
import StatCard from "@/components/crm/StatCard";
import Pagination from "@/components/crm/Pagination";
import QueueTabs from "@/components/crm/QueueTabs";
import ListActionsMenu, {
  DropdownButton,
  DropdownMenu,
  ExportColumn,
} from "@/components/crm/ListActions";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import Switch from "@/components/ui/Switch";
import api from "@/lib/axios";
import { useUIStore } from "@/lib/store/ui.store";
import {
  useWarrantyTerms,
  type ProductWarrantyRates,
} from "@/features/pricing/warrantyTerms";
import WarrantyRatesPanel from "@/features/pricing/WarrantyRatesPanel";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { hasPermission } from "@/features/auth/utils/permissions";
import BulkUploadModal from "@/features/inventory/components/BulkUploadModal";
import {
  getInventoryItemsApi,
  createInventoryItemApi,
  deleteInventoryItemApi,
  updateInventoryItemApi,
  getTemplateApi,
  getProductTypesApi,
  getInventoryCompaniesApi,
  getInventoryImageApi,
  InventoryItem,
  InventorySummary,
  InventoryTemplate,
  ProductTypeModel,
  ScopeCompany,
} from "@/features/inventory/api/inventory.api";
import {
  FiPlus,
  FiTrash2,
  FiDatabase,
  FiEye,
  FiEdit2,
  FiPrinter,
  FiUploadCloud,
  FiImage,
  FiX,
  FiBox,
  FiFileText,
} from "react-icons/fi";
import { CgSpinner } from "react-icons/cg";

/** The catalogue as a spreadsheet: what a stock take is done against. */
const INVENTORY_COLUMNS: ExportColumn<InventoryItem>[] = [
  { header: "Model Number", value: (item) => String(item.attributes?.model_number ?? "") },
  { header: "Item Name", value: (item) => item.name },
  {
    header: "Specification",
    value: (item) => String(item.attributes?.specification ?? ""),
  },
  { header: "Serial Number", value: (item) => item.serial_number },
  { header: "Product Type", value: (item) => item.product_type_code },
  { header: "Category Group", value: (item) => item.category },
  { header: "Company", value: (item) => item.company_name || "All companies" },
  {
    header: "In Stock",
    value: (item) => Number(item.attributes?.instock ?? item.attributes?.stock ?? 0),
  },
  { header: "Unit", value: (item) => String(item.attributes?.unit ?? "") },
  { header: "ECP Rate", value: (item) => Number(item.attributes?.rate ?? 0) },
  { header: "DTP Rate", value: (item) => Number(item.attributes?.dtp_rate ?? 0) },
  { header: "Case Size", value: (item) => Number(item.attributes?.case_size ?? 1) },
  { header: "HSN / SAC", value: (item) => String(item.attributes?.hsn_code ?? "") },
  {
    header: "Stock Value",
    value: (item) =>
      Number(item.attributes?.instock ?? item.attributes?.stock ?? 0) *
      Number(item.attributes?.rate ?? 0),
  },
];

export default function InventoryPage() {
  const { addToast } = useUIStore();

  /* The lengths come from Masters; what each costs on this product is
     held here and saved onto the product record.

     Only a super admin may move those figures. The warehouse maintains
     products - counts, codes, case sizes - and what cover costs is a
     commercial decision that happens to live on the same record, so it is
     shown to everyone and editable by the people who hold Masters. The
     API enforces the same rule; this only keeps the screen honest about
     it. */
  const superAdmin = useAuthStore(
    (state) => state.user?.is_super_admin === true,
  );

  const { terms: warrantyTerms } = useWarrantyTerms();

  const [warrantyRates, setWarrantyRates] = useState<ProductWarrantyRates>({});

  /** Sets one term's rate or unit, dropping it when the figure is cleared. */
  const setWarrantyRate = (
    name: string,
    patch: { rate?: string; mode?: string },
  ) => {
    setWarrantyRates((current) => {
      const existing = current[name] || { mode: "PERCENT" as const, rate: 0 };

      const next = {
        mode: (patch.mode ?? existing.mode) as "PERCENT" | "AMOUNT",
        rate: patch.rate === undefined ? existing.rate : Number(patch.rate) || 0,
      };

      /* A term with no figure is not offered on this product, which is a
         different thing from one offered at nothing. */
      if (!next.rate) {
        const { [name]: _dropped, ...rest } = current;
        return rest;
      }

      return { ...current, [name]: next };
    });
  };

  const [productTypes, setProductTypes] = useState<ProductTypeModel[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilterCategory, setSelectedFilterCategory] = useState<string>("");

  /* A page at a time. A catalogue is forty products until somebody
     uploads a supplier's price list, and then it is a thousand. */
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [totalItems, setTotalItems] = useState(0);

  /* The figures across the top and the count on each category tab, as the
     server worked them out over the whole catalogue. */
  const [summary, setSummary] = useState<InventorySummary>({
    products: 0,
    units: 0,
    value: 0,
    thin: 0,
    out: 0,
    categories: 0,
  });

  const [typeCounts, setTypeCounts] = useState<Record<string, number>>({});

  /* Typing a search is one request, not one per keystroke. */
  const [appliedSearch, setAppliedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setAppliedSearch(searchQuery.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  /* Products belong to the company that stocks them, so two companies can
     carry the same product without seeing each other's. These are the
     companies this user may file a product under: the ones on their
     profile, or every company for a super admin. */
  const [scopeCompanies, setScopeCompanies] = useState<ScopeCompany[]>([]);
  const [anyCompany, setAnyCompany] = useState(false);
  const [selectedFilterCompany, setSelectedFilterCompany] = useState<string>("");

  /* A narrower catalogue has fewer pages, and page 7 of a search that
     matches one product is empty. */
  useEffect(() => {
    setCurrentPage(1);
  }, [appliedSearch, selectedFilterCompany, selectedFilterCategory, pageSize]);
  const [companyId, setCompanyId] = useState("");
  const [editCompanyId, setEditCompanyId] = useState("");

  // Masters units list
  const [unitsList, setUnitsList] = useState<string[]>([]);

  // Create Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);

  /* Loading a supplier's sheet. Its own permission, so the menu only
     offers it to somebody who could use it. */
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const canBulkUpload = hasPermission("inventory.bulk_upload");

  /* Add Single Product / Add From Excel, off the one Add button. */
  const [showAddMenu, setShowAddMenu] = useState(false);
  const addMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!showAddMenu) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!addMenuRef.current?.contains(event.target as Node)) {
        setShowAddMenu(false);
      }
    };

    document.addEventListener("click", closeOnOutsideClick);
    return () => document.removeEventListener("click", closeOnOutsideClick);
  }, [showAddMenu]);

  // New Item Core Fields
  const [name, setName] = useState("");
  /* The manufacturer's model, kept apart from the name: the name says
     what a thing is, the model says which one. */
  const [modelNumber, setModelNumber] = useState("");
  /* Free text. What matters about a panel and what matters about a
     fertiliser have nothing in common, so anything worth filtering or
     pricing on belongs in the category's own fields instead. */
  const [specification, setSpecification] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [selectedTypeCode, setSelectedTypeCode] = useState("");
  const [imageBase64, setImageBase64] = useState<string | null>(null);

  // Mandatory standard attributes
  const [rate, setRate] = useState("");

  /* The fixed transfer price the channel is bought through at. "rate" is
     the end customer price; which of the two a document uses follows from
     the customer type on it. Blank means none is set, and a dealer
     document then keeps the end customer rate and says so — rather
     than quoting zero. */
  const [dtpRate, setDtpRate] = useState("");
  const [unit, setUnit] = useState("");
  const [instock, setInstock] = useState("");
  const [caseSize, setCaseSize] = useState("");
  /* HSN for goods, SAC for a service. Kept as text: it is a code, and a
     leading zero in it is not a rounding error. */
  const [hsnCode, setHsnCode] = useState("");

  // Dynamic template fields loaded for selected product type (Create Modal)
  const [activeTemplate, setActiveTemplate] = useState<InventoryTemplate | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [dynamicValues, setDynamicValues] = useState<Record<string, any>>({});

  // View modal state
  const [showViewModal, setShowViewModal] = useState(false);
  const [itemView, setItemView] = useState<InventoryItem | null>(null);

  /* The product's label, as this server draws it - the same markup that
     prints. Fetched rather than linked because the endpoint needs the
     auth header the axios client already holds. */
  const [labelSvg, setLabelSvg] = useState("");

  /* The product's photo, fetched for whichever one is open. */
  const [viewImage, setViewImage] = useState<string | null>(null);

  useEffect(() => {
    if (!showViewModal || !itemView) {
      setLabelSvg("");
      setViewImage(null);
      return;
    }

    let current = true;

    (async () => {
      try {
        const { data } = await api.get(
          `/api/v1/inventory/items/${itemView._id}/label`,
          { responseType: "text" },
        );

        if (current) setLabelSvg(typeof data === "string" ? data : "");
      } catch {
        if (current) setLabelSvg("");
      }

      try {
        const picture = itemView.image_base64 || (await getInventoryImageApi(itemView._id));
        if (current) setViewImage(picture || null);
      } catch {
        if (current) setViewImage(null);
      }
    })();

    return () => {
      current = false;
    };
  }, [showViewModal, itemView]);

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<InventoryItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editModelNumber, setEditModelNumber] = useState("");
  const [editSpecification, setEditSpecification] = useState("");
  const [editSerialNumber, setEditSerialNumber] = useState("");
  const [editSelectedTypeCode, setEditSelectedTypeCode] = useState("");
  const [editImageBase64, setEditImageBase64] = useState<string | null>(null);

  /* Whether the picture was changed or cleared in this edit. The list no
     longer carries images - a data: URI per row is megabytes - so the
     form loads the one it is editing, and sends it back only when
     somebody actually touched it. Otherwise saving a change of name
     would quietly erase the photo. */
  const [editImageTouched, setEditImageTouched] = useState(false);

  // Mandatory standard attributes (Edit)
  const [editRate, setEditRate] = useState("");
  const [editDtpRate, setEditDtpRate] = useState("");
  const [editUnit, setEditUnit] = useState("");
  const [editInstock, setEditInstock] = useState("");
  const [editCaseSize, setEditCaseSize] = useState("");
  const [editHsnCode, setEditHsnCode] = useState("");

  const [editDynamicValues, setEditDynamicValues] = useState<Record<string, any>>({});
  const [editActiveTemplate, setEditActiveTemplate] = useState<InventoryTemplate | null>(null);
  const [loadingEditTemplate, setLoadingEditTemplate] = useState(false);
  const [updating, setUpdating] = useState(false);

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<InventoryItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  /* One page of the catalogue, with the figures across the top and the
     count behind each category tab worked out by the server over the
     whole of it.

     It used to read every product into the browser and add them up here.
     That is fine for forty and it is a 470 KB response and a table of a
     thousand rows for a catalogue somebody has just uploaded a price list
     into. The totals still describe the whole catalogue, because they are
     no longer made of the rows on screen. */
  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);

      const page = await getInventoryItemsApi({
        search: appliedSearch || undefined,
        company_id: selectedFilterCompany || undefined,
        product_type_code: selectedFilterCategory || undefined,
        page: currentPage,
        size: pageSize,
      });

      setItems(page.items);
      setTotalItems(page.total);
      setSummary(page.summary);
      setTypeCounts(page.counts);
    } catch (err) {
      console.error(err);
      addToast("Failed to fetch inventory item records.", "error");
    } finally {
      setLoading(false);
    }
  }, [
    appliedSearch,
    selectedFilterCompany,
    selectedFilterCategory,
    currentPage,
    pageSize,
    addToast,
  ]);

  const fetchUnits = useCallback(async () => {
    try {
      const res = await api.get("/api/v1/inventory/units");
      if (res.data?.success) {
        const uList = res.data.data || [];
        setUnitsList(uList);
        if (uList.length > 0) {
          setUnit(uList[0]);
          setEditUnit(uList[0]);
        }
      }
    } catch (err) {
      console.error("Failed to load units:", err);
    }
  }, []);

  const fetchCompanies = useCallback(async () => {
    try {
      const { companies, unrestricted } = await getInventoryCompaniesApi();
      setScopeCompanies(companies);
      setAnyCompany(unrestricted);

      // With a single company there is nothing to choose, so the form
      // fills it in rather than asking every time.
      if (companies.length === 1 && !unrestricted) {
        setCompanyId(companies[0].id);
      }
    } catch (err) {
      console.error("Failed to load companies:", err);
    }
  }, []);

  const fetchProductTypes = useCallback(async () => {
    try {
      const data = await getProductTypesApi();
      setProductTypes(data);
      if (data.length > 0) {
        setSelectedTypeCode(data[0].code);
      }
    } catch (err) {
      console.error(err);
      addToast("Failed to fetch product types for categories dropdown.", "error");
    }
  }, [addToast]);

  useEffect(() => {
    fetchProductTypes();
    fetchUnits();
    fetchCompanies();
  }, [fetchProductTypes, fetchUnits, fetchCompanies]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  /* Where the QR on the sticker lands: /inventory?product=<serial> opens
     that product's details. Scanning the box and pressing the eye on the
     row are then the same gesture - which is the only thing that makes
     printing the code worth doing.

     Read off the address rather than through useSearchParams, so this
     page carries on being prerendered. */
  const [deepLinked, setDeepLinked] = useState(false);

  useEffect(() => {
    if (deepLinked || items.length === 0) return;

    const wanted = new URLSearchParams(window.location.search).get("product");

    if (!wanted) return;

    const found = items.find(
      (item) =>
        item.serial_number?.toUpperCase() === wanted.trim().toUpperCase() ||
        item._id === wanted,
    );

    setDeepLinked(true);

    if (found) {
      setItemView(found);
      setShowViewModal(true);
    } else {
      addToast(`No product here has the serial number ${wanted}.`, "warning");
    }
  }, [items, deepLinked, addToast]);

  /* --------------------------------------------------------------------
     What the shelf holds

     The numbers across the top and the count on each category tab are
     worked out by the database over the whole catalogue, so choosing a
     category or turning a page narrows the table without moving the
     totals - the point of the header is what the warehouse holds
     altogether, which a sum of the hundred rows on screen is not.
  -------------------------------------------------------------------- */
  const stockOf = (item: InventoryItem): number =>
    Number(item.attributes?.instock ?? item.attributes?.stock ?? 0);

  /* A tab per product type, plus "All Products", counted by the server
     over the whole catalogue. Only types that are actually stocked get a
     tab: a catalogue of seven types and one empty one is a row of tabs
     that never does anything. */
  const categoryTabs = useMemo(() => {
    const counted = productTypes
      .map((type) => ({
        value: type.code,
        label: type.name,
        count: typeCounts[type.code] || 0,
      }))
      .filter((tab) => tab.count > 0);

    return [
      { value: "", label: "All Products", count: summary.products },
      ...counted,
    ];
  }, [productTypes, typeCounts, summary.products]);

  /* The server already sent this category's page, so there is nothing
     left to filter here. */
  const visibleItems = items;

  const money = (value: number) =>
    `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

  // Load template when product type selection changes in form (Create)
  const loadFormTemplate = useCallback(async (code: string) => {
    try {
      setLoadingTemplate(true);
      const template = await getTemplateApi(code);
      setActiveTemplate(template);
      
      // Initialize dynamic values with defaults
      const defaults: Record<string, any> = {};
      (template.fields || []).forEach((f) => {
        if (f.type === "boolean") defaults[f.name] = false;
        else if (f.type === "number") defaults[f.name] = 0;
        else defaults[f.name] = "";
      });
      setDynamicValues(defaults);
    } catch (err) {
      console.error(err);
      addToast("Failed to load category form specifications.", "error");
    } finally {
      setLoadingTemplate(false);
    }
  }, [addToast]);

  useEffect(() => {
    if (showCreateModal && selectedTypeCode) {
      loadFormTemplate(selectedTypeCode);
    }
  }, [selectedTypeCode, showCreateModal, loadFormTemplate]);

  // Load template when product type selection changes in form (Edit)
  useEffect(() => {
    const loadEditFormTemplate = async () => {
      if (!editSelectedTypeCode) return;
      
      try {
        setLoadingEditTemplate(true);
        const template = await getTemplateApi(editSelectedTypeCode);
        setEditActiveTemplate(template);

        // If we switched to a different product type, initialize defaults. Otherwise preserve existing attributes.
        if (itemToEdit && editSelectedTypeCode === itemToEdit.product_type_code) {
          setEditDynamicValues(itemToEdit.attributes || {});
        } else {
          const defaults: Record<string, any> = {};
          (template.fields || []).forEach((f) => {
            if (f.type === "boolean") defaults[f.name] = false;
            else if (f.type === "number") defaults[f.name] = 0;
            else defaults[f.name] = "";
          });
          setEditDynamicValues(defaults);
        }
      } catch (err) {
        console.error(err);
        addToast("Failed to load category form specifications.", "error");
      } finally {
        setLoadingEditTemplate(false);
      }
    };

    if (showEditModal && editSelectedTypeCode) {
      loadEditFormTemplate();
    }
  }, [editSelectedTypeCode, showEditModal, itemToEdit, addToast]);

  /* The label is drawn on the server, so the barcode a scanner reads is
     the same one the PDF would carry. Fetched rather than linked, because
     the endpoint needs the auth header the axios client already holds -
     a plain window.open would arrive signed out. */
  const printLabel = async (item: InventoryItem) => {
    try {
      const { data } = await api.get(
        `/api/v1/inventory/items/${item._id}/label`,
        { responseType: "text" },
      );

      const sheet = window.open("", "_blank");

      if (!sheet) {
        addToast("Allow pop-ups to print the label.", "warning");
        return;
      }

      sheet.document.write(
        `<!doctype html><title>${item.serial_number || "Label"}</title>` +
          `<style>body{margin:0;display:flex;align-items:center;` +
          `justify-content:center;height:100vh}svg{width:75mm}` +
          `@media print{body{height:auto}}</style>${data}` +
          `<script>window.onload=function(){window.print()}<\/script>`,
      );
      sheet.document.close();
    } catch (error) {
      console.error(error);
      addToast("Could not build the label for this product.", "error");
    }
  };

  const handleOpenEditModal = (item: InventoryItem) => {
    setItemToEdit(item);
    setEditName(item.name);
    setEditModelNumber(item.attributes?.model_number?.toString() || "");
    setEditSpecification(item.attributes?.specification?.toString() || "");
    setEditSerialNumber(item.serial_number);
    setEditSelectedTypeCode(item.product_type_code);
    setEditImageBase64(item.image_base64 || null);
    setEditImageTouched(false);

    if (!item.image_base64) {
      getInventoryImageApi(item._id)
        .then((picture) => picture && setEditImageBase64(picture))
        .catch(() => undefined);
    }
    setEditCompanyId(item.company_id || "");

    // Extract standard attributes
    setEditRate(item.attributes?.rate?.toString() || "");
    setEditDtpRate(item.attributes?.dtp_rate?.toString() || "");
    setEditUnit(item.attributes?.unit || (unitsList.length > 0 ? unitsList[0] : ""));
    setEditInstock((item.attributes?.instock ?? item.attributes?.stock ?? "").toString());
    setEditCaseSize(item.attributes?.case_size?.toString() || "");
    setEditHsnCode(item.attributes?.hsn_code?.toString() || "");

    /* What this product charges for each term, as saved. */
    setWarrantyRates(
      (item.attributes?.warranty_rates as ProductWarrantyRates) || {},
    );

    setEditDynamicValues(item.attributes || {});
    setShowEditModal(true);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, isEdit: boolean) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        addToast("Image size must be less than 2MB.", "warning");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        if (isEdit) {
          setEditImageTouched(true);
          setEditImageBase64(reader.result as string);
        } else {
          setImageBase64(reader.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !serialNumber.trim()) {
      addToast("Name and Serial Number are required.", "warning");
      return;
    }

    /* Both go on the sticker on the box and on the proposal line a
       customer reads, so a product without them is one nobody downstream
       can identify. */
    if (!modelNumber.trim() || !specification.trim()) {
      addToast("Model Number and Specification are required.", "warning");
      return;
    }

    const rateVal = parseFloat(rate) ?? -1;
    const instockVal = parseFloat(instock) ?? -1;
    const caseSizeVal = parseFloat(caseSize) ?? -1;

    if (rate.trim() === "" || rateVal < 0) {
      addToast("The ECP rate is required and must be 0 or greater.", "warning");
      return;
    }
    if (!unit) {
      addToast("Units specification is required.", "warning");
      return;
    }
    if (instock.trim() === "" || instockVal < 0) {
      addToast("In-stock inventory count is required and must be 0 or greater.", "warning");
      return;
    }
    if (caseSize.trim() === "" || caseSizeVal < 1) {
      addToast("Wholesale case size is required and must be 1 or greater.", "warning");
      return;
    }

    if (!anyCompany && scopeCompanies.length > 1 && !companyId) {
      addToast("Choose which company stocks this product.", "warning");
      return;
    }

    const typeDetails = productTypes.find((t) => t.code === selectedTypeCode);
    if (!typeDetails) return;

    try {
      setCreating(true);
      const mergedAttributes = {
        ...dynamicValues,
        model_number: modelNumber.trim(),
        specification: specification.trim(),
        rate: rateVal,
        rate_per_unit: rateVal,
        dtp_rate: Number(dtpRate) || 0,
        unit: unit,
        instock: instockVal,
        stock: instockVal,
        case_size: caseSizeVal,
        hsn_code: hsnCode.trim(),
        warranty_rates: warrantyRates,
      };

      await createInventoryItemApi({
        name: name.trim(),
        serial_number: serialNumber.trim().toUpperCase(),
        product_type_code: selectedTypeCode,
        category: typeDetails.category,
        attributes: mergedAttributes,
        image_base64: imageBase64 || undefined,
        company_id: companyId || null,
      });

      addToast("Inventory item added successfully!", "success");
      setName("");
      setModelNumber("");
      setSpecification("");
      setSerialNumber("");
      setRate("");
      setInstock("");
      setCaseSize("");
      setHsnCode("");
      setWarrantyRates({});
      setDynamicValues({});
      setImageBase64(null);
      setShowCreateModal(false);
      fetchItems();
    } catch (err: any) {
      console.error(err);
      addToast(err.response?.data?.detail || "Failed to create inventory item.", "error");
    } finally {
      setCreating(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemToEdit) return;
    if (!editName.trim() || !editSerialNumber.trim()) {
      addToast("Name and Serial Number are required.", "warning");
      return;
    }

    if (!editModelNumber.trim() || !editSpecification.trim()) {
      addToast("Model Number and Specification are required.", "warning");
      return;
    }

    const rateVal = parseFloat(editRate) ?? -1;
    const instockVal = parseFloat(editInstock) ?? -1;
    const caseSizeVal = parseFloat(editCaseSize) ?? -1;

    if (editRate.trim() === "" || rateVal < 0) {
      addToast("The ECP rate is required and must be 0 or greater.", "warning");
      return;
    }
    if (!editUnit) {
      addToast("Units specification is required.", "warning");
      return;
    }
    if (editInstock.trim() === "" || instockVal < 0) {
      addToast("In-stock inventory count is required and must be 0 or greater.", "warning");
      return;
    }
    if (editCaseSize.trim() === "" || caseSizeVal < 1) {
      addToast("Wholesale case size is required and must be 1 or greater.", "warning");
      return;
    }

    if (!anyCompany && scopeCompanies.length > 1 && !editCompanyId) {
      addToast("Choose which company stocks this product.", "warning");
      return;
    }

    const typeDetails = productTypes.find((t) => t.code === editSelectedTypeCode);
    if (!typeDetails) return;

    try {
      setUpdating(true);
      const mergedEditAttributes = {
        ...editDynamicValues,
        model_number: editModelNumber.trim(),
        specification: editSpecification.trim(),
        rate: rateVal,
        rate_per_unit: rateVal,
        dtp_rate: Number(editDtpRate) || 0,
        unit: editUnit,
        instock: instockVal,
        stock: instockVal,
        case_size: caseSizeVal,
        hsn_code: editHsnCode.trim(),
        warranty_rates: warrantyRates,
      };

      await updateInventoryItemApi(itemToEdit._id, {
        name: editName.trim(),
        serial_number: editSerialNumber.trim().toUpperCase(),
        product_type_code: editSelectedTypeCode,
        category: typeDetails.category,
        attributes: mergedEditAttributes,
        // Left out entirely unless it changed, which is what tells the
        // server to keep the picture it already has.
        ...(editImageTouched ? { image_base64: editImageBase64 } : {}),
        company_id: editCompanyId || null,
      });

      addToast("Inventory item updated successfully!", "success");
      setShowEditModal(false);
      setItemToEdit(null);
      setEditImageBase64(null);
      fetchItems();
    } catch (err: any) {
      console.error(err);
      addToast(err.response?.data?.detail || "Failed to update inventory item.", "error");
    } finally {
      setUpdating(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      setDeleting(true);
      await deleteInventoryItemApi(itemToDelete._id);
      addToast("Inventory item deleted successfully.", "success");
      setShowDeleteModal(false);
      setItemToDelete(null);
      fetchItems();
    } catch (err) {
      console.error(err);
      addToast("Failed to delete inventory item.", "error");
    } finally {
      setDeleting(false);
    }
  };

  const handleDynamicChange = (key: string, val: any) => {
    setDynamicValues({
      ...dynamicValues,
      [key]: val,
    });
  };

  const handleEditDynamicChange = (key: string, val: any) => {
    setEditDynamicValues({
      ...editDynamicValues,
      [key]: val,
    });
  };

  return (
    <ListPage>
      <ListPageHeader
        title="Inventory Management"
        refreshing={loading}
        onRefresh={fetchItems}
        actions={
          <ListActionsMenu
            name="Inventory"
            rows={visibleItems}
            columns={INVENTORY_COLUMNS}
            chart={[
              { label: "Products", value: summary.products },
              { label: "In Stock", value: summary.units },
              { label: "Categories", value: summary.categories },
              { label: "Running Thin", value: summary.thin },
              { label: "Out Of Stock", value: summary.out },
            ]}
          />
        }
      />

      <p className="-mt-3 text-[13px] text-[#777777] dark:text-slate-400">
        Everything on the shelf, what it is worth, and what is running out.
      </p>

      <StatGrid cols={6}>
        <StatCard compact label="Products" value={summary.products} caption="in the catalogue" />
        <StatCard compact label="Units In Stock" value={summary.units} caption="across every line" />
        <StatCard compact label="Stock Value" value={money(summary.value)} caption="at wholesale rate" />
        <StatCard compact label="Categories" value={summary.categories} caption="product types stocked" />
        <StatCard
          compact
          label="Running Thin"
          value={summary.thin}
          caption="3 or fewer left"
          change={summary.thin > 0 ? "reorder" : undefined}
          positive={false}
        />
        <StatCard
          compact
          label="Out Of Stock"
          value={summary.out}
          caption="nothing to send"
          change={summary.out > 0 ? "action" : undefined}
          positive={false}
        />
      </StatGrid>

      <ListToolbar
        search={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="Search products by name or serial number"
        trailing={
          /* One button, two ways in - the same shape as Add New Lead:
             a product typed in, or a sheet of them. */
          <div
            ref={addMenuRef}
            className="relative"
            onClick={(event) => event.stopPropagation()}
          >
            <PrimaryAction
              onClick={() => {
                if (productTypes.length === 0) {
                  addToast("Please create a Product Type master first.", "warning");
                  return;
                }
                setShowAddMenu((previous) => !previous);
              }}
              icon={<FiPlus size={14} />}
            >
              Add Inventory Product
            </PrimaryAction>

            {showAddMenu && (
              <DropdownMenu>
                <DropdownButton
                  icon={<FiBox className="text-primary" />}
                  onClick={() => {
                    setShowAddMenu(false);
                    setShowCreateModal(true);
                  }}
                >
                  Add Single Product
                </DropdownButton>

                {/* Putting forty products in at once is its own
                    privilege, ticked in Roles & Access - one row of a
                    sheet can become several records. */}
                {canBulkUpload && (
                  <DropdownButton
                    icon={<FiFileText className="text-emerald-500" />}
                    onClick={() => {
                      setShowAddMenu(false);
                      setShowBulkUpload(true);
                    }}
                  >
                    Add From Excel
                  </DropdownButton>
                )}
              </DropdownMenu>
            )}
          </div>
        }
      >
        {/* Which company's shelf. Only worth showing when there is more
            than one to choose between. */}
        {scopeCompanies.length > 1 && (
          <select
            value={selectedFilterCompany}
            onChange={(e) => setSelectedFilterCompany(e.target.value)}
            aria-label="Company"
            className="h-[39px] shrink-0 rounded-lg border border-[#cccccc] bg-[#f3f3f3] px-3 text-[13px] text-[#141414] outline-none transition focus:border-[#233353] dark:border-[#17304a] dark:bg-[#071929] dark:text-white"
          >
            <option value="">{anyCompany ? "All companies" : "All my companies"}</option>
            {scopeCompanies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.company_name}
              </option>
            ))}
          </select>
        )}
      </ListToolbar>

      <TableCard>
        {/* Which part of the catalogue, on the table rather than beside
            the search box: these are not actions, and a row of product
            type codes read as one. */}
        <QueueTabs
          tabs={categoryTabs}
          active={selectedFilterCategory}
          onChange={(value) => setSelectedFilterCategory(value ?? "")}
        />

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-slate-400">
            <CgSpinner className="animate-spin text-3xl text-primary" />
            <span className="text-xs">Loading inventory items...</span>
          </div>
        ) : visibleItems.length > 0 ? (
          <div className="overflow-x-auto">
            {/* The same fields as the form, in the same order: the model
                says which one it is, the name says what it is, the
                specification says what is in it. Reading them off the row
                is the point - they were only visible by opening the
                product. */}
            <table className={`w-full min-w-[1240px] text-left ${LIST_TABLE}`}>
              <thead>
                <tr>
                  <th className="px-5 py-3">Product</th>
                  <th className="px-5 py-3">Model Number</th>
                  <th className="px-5 py-3">Item Name</th>
                  <th className="px-5 py-3">Specification</th>
                  <th className="px-5 py-3">Serial Number</th>
                  <th className="px-5 py-3">Category Group</th>
                  <th className="px-5 py-3">Company</th>
                  <th className="px-5 py-3">HSN / SAC</th>
                  <th className="px-5 py-3">In Stock</th>
                  <th className="px-5 py-3">ECP Rate</th>
                  <th className="px-5 py-3">DTP Rate</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
            {visibleItems.map((item) => {
              const typeName = productTypes.find((t) => t.code === item.product_type_code)?.name || item.product_type_code;
              const rateVal = item.attributes?.rate ?? 0;
              const dtpVal = Number(item.attributes?.dtp_rate ?? 0);
              const unitVal = item.attributes?.unit ?? "Unit";
              const stockVal = item.attributes?.instock ?? item.attributes?.stock ?? 0;
              const caseSizeVal = item.attributes?.case_size ?? 1;
              const hsnVal = item.attributes?.hsn_code ?? "";
              const modelVal = String(item.attributes?.model_number ?? "").trim();
              const specVal = String(item.attributes?.specification ?? "").trim();

              /* The one number the warehouse acts on, so it is the one
                 thing on the row that carries a colour. */
              const stockTone =
                stockVal === 0
                  ? "bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400"
                  : stockVal <= 3
                    ? "bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400"
                    : "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400";

              return (
                <tr
                  key={item._id}
                  className="border-t border-slate-100 transition hover:bg-slate-50/60 dark:border-[#0d2336]/40 dark:hover:bg-[#0b2034]/40"
                >
                  <td className="px-5 py-3">
                    {item.image_base64 ? (
                      <img
                        src={item.image_base64}
                        alt={item.name}
                        className="h-10 w-10 rounded-lg border border-slate-200 bg-slate-50 object-cover dark:border-[#0d2336]"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-100 bg-slate-50 text-slate-400 dark:border-[#0d2336]/50 dark:bg-[#071929]/20">
                        <FiImage className="text-sm" />
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    {modelVal ? (
                      <span className="font-mono text-[12px] font-semibold text-slate-700 dark:text-slate-200">
                        {modelVal}
                      </span>
                    ) : (
                      <span className="text-[12px] text-slate-400">—</span>
                    )}
                  </td>

                  <td className="max-w-[240px] px-5 py-3">
                    <p className="text-[13px] font-semibold text-slate-900 dark:text-white">
                      {item.name}
                    </p>
                    <p className="text-[11px] text-[#777777] dark:text-slate-400">
                      {typeName}
                    </p>
                  </td>

                  {/* Long by nature, so it is clamped to two lines with the
                      whole of it on hover rather than pushing every other
                      column off the screen. */}
                  <td className="max-w-[280px] px-5 py-3">
                    {specVal ? (
                      <p
                        title={specVal}
                        className="line-clamp-2 text-[12px] leading-snug text-slate-600 dark:text-slate-300"
                      >
                        {specVal}
                      </p>
                    ) : (
                      <span className="text-[12px] text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-700 dark:bg-[#0d2336] dark:text-white">
                      {item.serial_number}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-[13px] text-slate-600 dark:text-slate-300">
                    {item.category}
                  </td>
                  <td className="px-5 py-3 text-[13px]">
                    {item.company_name ? (
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-[#0d2336] dark:text-slate-300">
                        {item.company_name}
                      </span>
                    ) : (
                      <span className="text-[13px] text-slate-400">All companies</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    {hsnVal ? (
                      <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-700 dark:bg-[#0d2336] dark:text-slate-200">
                        {hsnVal}
                      </span>
                    ) : (
                      <span className="text-[12px] text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-[11px] font-semibold ${stockTone}`}>
                      {stockVal.toLocaleString("en-IN")} {unitVal}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <p className="text-[13px] font-semibold text-slate-900 dark:text-white">
                      ₹{rateVal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      <span className="font-normal text-[#777777] dark:text-slate-400"> / {unitVal}</span>
                    </p>
                    <p className="text-[11px] text-[#777777] dark:text-slate-400">
                      {caseSizeVal} {unitVal}/case
                    </p>
                  </td>
                  {/* The transfer price beside the end customer one, so a
                      product sold through the channel can be checked at a
                      glance. Unset is said rather than shown as zero. */}
                  <td className="px-5 py-3">
                    {dtpVal > 0 ? (
                      <span className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">
                        ₹{dtpVal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </span>
                    ) : (
                      <span className="text-[12px] text-amber-600">Not set</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex justify-end gap-1.5">
                      <button
                        onClick={() => {
                          setItemView(item);
                          setShowViewModal(true);
                        }}
                        className="cursor-pointer rounded-lg border-none bg-transparent p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white"
                        title="View specifications and QR code"
                      >
                        <FiEye className="text-sm" />
                      </button>
                      {/* The sticker for the box: a Code128 of the SKU for
                          a desk scanner and a QR a phone can read. Opened
                          in a tab so the browser's own print dialog does
                          the printing. */}
                      <button
                        onClick={() => printLabel(item)}
                        className="cursor-pointer rounded-lg border-none bg-transparent p-1.5 text-slate-400 hover:text-primary"
                        title="Print label (barcode and QR)"
                      >
                        <FiPrinter className="text-sm" />
                      </button>

                      <button
                        onClick={() => handleOpenEditModal(item)}
                        className="cursor-pointer rounded-lg border-none bg-transparent p-1.5 text-slate-400 hover:text-primary"
                        title="Edit product"
                      >
                        <FiEdit2 className="text-sm" />
                      </button>
                      <button
                        onClick={() => {
                          setItemToDelete(item);
                          setShowDeleteModal(true);
                        }}
                        className="cursor-pointer rounded-lg border-none bg-transparent p-1.5 text-slate-400 hover:bg-slate-100 hover:text-rose-500 dark:hover:bg-[#0d2336]"
                        title="Delete product"
                      >
                        <FiTrash2 className="text-sm" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-5 py-12 text-center text-[13px] text-slate-400">
            {items.length === 0
              ? "No products on the shelf yet."
              : "Nothing in this category."}
          </div>
        )}

        {/* A page at a time, with how many to a page. A thousand rows in
            one table is a browser the warehouse cannot scroll. */}
        <div className="flex flex-col gap-2 border-t border-slate-100 px-5 py-2 sm:flex-row sm:items-center dark:border-[#17304a]">
          <label className="flex items-center gap-2 text-[12px] text-[#777777] dark:text-slate-400">
            Show
            <select
              value={pageSize}
              onChange={(event) => setPageSize(Number(event.target.value))}
              aria-label="Products per page"
              className="h-[30px] rounded-md border border-[#cccccc] bg-white px-2 text-[12px] text-[#141414] outline-none focus:border-[#233353] dark:border-[#17304a] dark:bg-[#071929] dark:text-white"
            >
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
            per page
          </label>

          <div className="flex-1">
            <Pagination
              page={currentPage}
              pageSize={pageSize}
              totalItems={totalItems}
              totalPages={Math.max(1, Math.ceil(totalItems / pageSize))}
              onPageChange={setCurrentPage}
              noun="products"
            />
          </div>
        </div>
      </TableCard>

      {/* View Details Modal */}
      {showViewModal && itemView && (
        <Modal
          isOpen={showViewModal}
          onClose={() => {
            setShowViewModal(false);
            setItemView(null);
          }}
          title="Product Technical Specifications & Identity"
          size="lg"
        >
          <div className="space-y-5">
            {/* Top Row: Product image and info */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 pb-4 border-b border-slate-100 dark:border-[#0d2336]">
              {/* Product Image preview */}
              <div className="md:col-span-4 flex items-center justify-center bg-slate-50 dark:bg-[#071929]/30 rounded-xl border border-slate-100 dark:border-[#0d2336] p-2 min-h-[140px]">
                {viewImage ? (
                  <img
                    src={viewImage}
                    alt={itemView.name}
                    className="max-h-[130px] rounded-lg object-contain w-full"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-1.5 text-slate-400">
                    <FiImage className="text-2xl" />
                    <span className="text-[10px] italic">No product image</span>
                  </div>
                )}
              </div>

              {/* Product Info */}
              <div className="md:col-span-8 grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Product Name</span>
                  <span className="text-xs font-semibold text-slate-800 dark:text-white flex items-center gap-1.5 mt-0.5">
                    <FiDatabase className="text-primary text-xs shrink-0" />
                    {itemView.name}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Serial Number</span>
                  <span className="text-xs font-mono font-bold text-slate-800 dark:text-white uppercase tracking-wider bg-slate-100 dark:bg-[#0d2336] px-2 py-0.5 rounded inline-block mt-0.5">
                    {itemView.serial_number}
                  </span>
                </div>
                <div className="mt-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Product Type</span>
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-355 mt-0.5 block">
                    {productTypes.find((t) => t.code === itemView.product_type_code)?.name || itemView.product_type_code}
                  </span>
                </div>
                <div className="mt-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Category Group</span>
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-355 mt-0.5 block">
                    {itemView.category}
                  </span>
                </div>
              </div>
            </div>

            {/* Bottom Row: Specs & QR Code */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
              {/* Left specifications (8 cols) */}
              <div className="md:col-span-8 space-y-3">
                <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">
                  Technical Attributes
                </h4>

                {itemView.attributes && Object.keys(itemView.attributes).length > 0 ? (
                  <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-[#071929]/40 border border-slate-100 dark:border-[#0d2336] rounded-xl p-4 text-xs">
                    {Object.entries(itemView.attributes).map(([key, value]) => {
                      if (["rate", "rate_per_unit", "unit", "instock", "stock", "case_size"].includes(key)) return null;
                      return (
                        <div key={key} className="flex flex-col gap-0.5">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{key.replace(/_/g, " ")}</span>
                          <span className="font-semibold text-slate-800 dark:text-white text-xs">
                            {typeof value === "boolean" ? (value ? "Enabled" : "Disabled") : String(value)}
                          </span>
                        </div>
                      );
                    })}
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ECP Rate</span>
                      <span className="font-semibold text-primary font-mono text-xs">
                        ₹{(itemView.attributes.rate ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} / {itemView.attributes.unit ?? "Unit"}
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">In stock inventory</span>
                      <span className="font-semibold text-slate-800 dark:text-white font-mono text-xs">
                        {(itemView.attributes.instock ?? itemView.attributes.stock ?? 0).toLocaleString('en-IN')} {itemView.attributes.unit ?? "Unit"}
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Case Packaging</span>
                      <span className="font-semibold text-slate-800 dark:text-white text-xs">
                        {itemView.attributes.case_size ?? 1} {itemView.attributes.unit ?? "Unit"}/Case
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic py-2">
                    No custom technical attributes defined for this item.
                  </p>
                )}
              </div>

              {/* Right QR Code (4 cols) */}
              <div className="md:col-span-4 bg-slate-50 dark:bg-[#071929]/30 border border-slate-150 dark:border-[#0d2336] rounded-2xl p-4 flex flex-col items-center text-center gap-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Identity QR Label
                </span>
                
                {/* The very label that prints, drawn by this server from
                    the product's own serial number.

                    It used to be an <img> from api.qrserver.com, which
                    sent this product's id, serial, name and type to a
                    third party every time somebody opened the panel, drew
                    a different code from the printed one, and reloaded on
                    every render. */}
                <div className="w-full rounded-xl border border-slate-200/50 bg-white p-2.5 shadow-sm [&_svg]:h-auto [&_svg]:w-full">
                  {labelSvg ? (
                    <div dangerouslySetInnerHTML={{ __html: labelSvg }} />
                  ) : (
                    <div className="flex h-[90px] items-center justify-center text-slate-300">
                      <CgSpinner className="animate-spin text-xl" />
                    </div>
                  )}
                </div>

                <span className="text-[9px] leading-tight text-slate-400">
                  The same sticker that prints. Scan the QR to open this
                  product; the barcode carries the serial number for a desk
                  scanner.
                </span>

                <Button
                  variant="outline"
                  type="button"
                  onClick={() => printLabel(itemView)}
                >
                  <span className="flex items-center gap-1.5 text-[12px]">
                    <FiPrinter size={12} /> Print Label
                  </span>
                </Button>
              </div>
            </div>
            
            <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-[#0d2336]">
              <Button
                variant="outline"
                onClick={() => {
                  setShowViewModal(false);
                  setItemView(null);
                }}
              >
                Close Details
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* A sheet of products, read and shown before anything is saved. */}
      <BulkUploadModal
        open={showBulkUpload}
        onClose={() => setShowBulkUpload(false)}
        onLoaded={fetchItems}
      />

      {/* Create Product Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setImageBase64(null);
        }}
        title="Add Inventory Product"
        size="xl"
        hasUnsavedChanges={name.trim() !== "" || serialNumber.trim() !== "" || imageBase64 !== null || rate !== "" || instock !== "" || caseSize !== ""}
      >
        <form onSubmit={handleCreate} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Left Column: Product Identity details */}
            <div className="space-y-4 pr-0 md:pr-6 border-r-0 md:border-r border-slate-100 dark:border-[#0d2336]">
              <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">
                Product Identity
              </h4>

              {/* The manufacturer's model, which is what a customer reads
                  on a proposal line and what a service call is logged
                  against. Kept apart from the name: "Interactive Flat
                  Panel" is what it is, "SPX-75 V100" is which one. */}
              <Input
                label="Model Number *"
                required
                placeholder="e.g. SPX-75 (Lango V100)"
                value={modelNumber}
                onChange={(e) => setModelNumber(e.target.value)}
              />

              <Input
                label="Product Name *"
                required
                placeholder="e.g. Fertilizer NPK 19-19-19"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />

              {/* Free text, because what matters about a panel and what
                  matters about a fertiliser have nothing in common. The
                  category's own fields are below for anything that is
                  worth filtering or pricing on. */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Specification *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. 75&quot; 4K UHD, 20-point touch, Android 13, 8GB / 128GB"
                  value={specification}
                  onChange={(e) => setSpecification(e.target.value)}
                  className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary/10 dark:border-[#0d2336] dark:bg-[#071929]/50 dark:text-white"
                />
              </div>

              <Input
                label="Hardware Serial Number (Unique) *"
                required
                placeholder="e.g. FT-NPK-12903"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
              />

              {/* IMAGE UPLOAD FIELD */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Product Image
                </label>
                <div className="grid grid-cols-12 gap-3 items-center">
                  <div className="col-span-8">
                    <label className="flex flex-col items-center justify-center border border-dashed border-slate-200 dark:border-[#0d2336] rounded-xl p-4 bg-slate-50/50 hover:bg-slate-50 hover:border-primary/50 transition-all cursor-pointer">
                      <FiUploadCloud className="text-xl text-slate-400 mb-1" />
                      <span className="text-[10px] font-bold text-slate-600 dark:text-slate-355">Upload Image</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleImageUpload(e, false)}
                      />
                    </label>
                  </div>
                  <div className="col-span-4 flex items-center justify-center bg-slate-100 dark:bg-[#071929]/50 border border-slate-200/50 dark:border-[#0d2336] rounded-xl h-20 relative">
                    {imageBase64 ? (
                      <>
                        <img
                          src={imageBase64}
                          alt="Uploaded Preview"
                          className="max-h-[70px] max-w-[90%] rounded object-contain"
                        />
                        <button
                          type="button"
                          onClick={() => setImageBase64(null)}
                          className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white rounded-full p-1 border-none hover:bg-rose-600 cursor-pointer shadow"
                        >
                          <FiX className="text-[10px]" />
                        </button>
                      </>
                    ) : (
                      <span className="text-[9px] text-slate-400 italic">No image</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Product Category / Type
                </label>
                <select
                  className="w-full rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-50/50 dark:bg-[#071929]/50 px-3.5 py-2.5 text-xs text-slate-900 dark:text-white outline-none"
                  value={selectedTypeCode}
                  onChange={(e) => setSelectedTypeCode(e.target.value)}
                >
                  {productTypes.map((t) => (
                    <option key={t.code} value={t.code}>
                      {t.name} ({t.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Which company stocks this product. The same product can be
                  added again under another company, with its own stock and
                  rate, and neither side sees the other's. */}
              {(scopeCompanies.length > 1 || anyCompany) && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Company {anyCompany ? "" : "*"}
                  </label>
                  <select
                    className="w-full rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-50/50 dark:bg-[#071929]/50 px-3.5 py-2.5 text-xs text-slate-900 dark:text-white outline-none"
                    value={companyId}
                    onChange={(e) => setCompanyId(e.target.value)}
                  >
                    <option value="">
                      {anyCompany ? "All companies (shared)" : "Select a company..."}
                    </option>
                    {scopeCompanies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.company_name}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-400">
                    Only people assigned to this company will see the product.
                  </p>
                </div>
              )}
            </div>

            {/* Right Column: Parameters and specifications */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">
                Mandatory Stock Parameters
              </h4>

              {/* THE TWO PRICE LISTS, SIDE BY SIDE

                  ECP is what an end customer pays; DTP is the fixed
                  figure a dealer, distributor or OEM is bought through
                  at. Which one a document uses follows from the customer
                  type on it, so nobody picks a price list by hand - and
                  seeing them together is the only way to notice that one
                  of them is wrong. Left blank, a dealer document falls
                  back to the ECP rate and marks the line rather than
                  quoting nothing. */}
              <div className="grid grid-cols-2 gap-3.5">
                <Input
                  label="ECP Rate (End Customer Price) *"
                  required
                  type="number"
                  placeholder="e.g. 450"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                />

                <Input
                  label="DTP Rate (Dealer Transfer Price)"
                  type="number"
                  placeholder="Blank if not sold through the channel"
                  value={dtpRate}
                  onChange={(e) => setDtpRate(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <Input
                  label="In-Stock Inventory (Qty) *"
                  required
                  type="number"
                  placeholder="e.g. 150"
                  value={instock}
                  onChange={(e) => setInstock(e.target.value)}
                />

                <Input
                  label="Case Size (Qty/Case) *"
                  required
                  type="number"
                  placeholder="e.g. 25"
                  value={caseSize}
                  onChange={(e) => setCaseSize(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Select Unit *
                  </label>
                  <select
                    className="w-full rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-50/50 dark:bg-[#071929]/50 px-3.5 py-2.5 text-xs text-slate-900 dark:text-white outline-none"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                  >
                    {unitsList.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                    {unitsList.length === 0 && (
                      <option value="">No units created in master...</option>
                    )}
                  </select>
                </div>

                {/* Every line of a GST invoice has to carry one, and it is
                    a property of the product rather than of the sale - so
                    it is captured here once and travels onto every
                    document the product appears on. */}
                <Input
                  label="HSN / SAC Code"
                  placeholder="e.g. 8528"
                  value={hsnCode}
                  onChange={(e) => setHsnCode(e.target.value)}
                />
              </div>

              <WarrantyRatesPanel
                terms={warrantyTerms}
                rates={warrantyRates}
                onChange={setWarrantyRate}
                editable={superAdmin}
              />

              {/* DYNAMIC FORM SECTION */}
              <div className="border-t border-slate-100 dark:border-[#0d2336] pt-4 space-y-4">
                <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">
                  Category Technical Specifications (Dynamic Fields)
                </h4>

                {loadingTemplate ? (
                  <div className="flex justify-center items-center py-4 gap-2 text-slate-400">
                    <CgSpinner className="animate-spin text-xl text-primary" />
                    <span className="text-[10px]">Loading dynamic layout...</span>
                  </div>
                ) : activeTemplate && activeTemplate.fields && activeTemplate.fields.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3.5">
                    {activeTemplate.fields.map((f) => {
                      const val = dynamicValues[f.name] ?? "";
                      return (
                        <div key={f.name} className="space-y-1.5 col-span-2 sm:col-span-1">
                          {f.type === "boolean" ? (
                            <div className="flex items-center justify-between p-2 rounded-xl border border-slate-100 dark:border-[#0d2336] bg-slate-50/30">
                              <span className="text-xs font-semibold text-slate-700 dark:text-slate-350">
                                {f.label} {f.required && <span className="text-rose-500 font-bold">*</span>}
                              </span>
                              <Switch
                                checked={!!val}
                                onChange={(checked) => handleDynamicChange(f.name, checked)}
                              />
                            </div>
                          ) : f.type === "select" ? (
                            <div className="space-y-1.5">
                              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                                {f.label} {f.required && <span className="text-rose-500 font-bold">*</span>}
                              </label>
                              <select
                                className="w-full rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-50/50 dark:bg-[#071929]/50 px-3.5 py-2.5 text-xs text-slate-900 dark:text-white outline-none"
                                value={val}
                                onChange={(e) => handleDynamicChange(f.name, e.target.value)}
                              >
                                <option value="">Select Option...</option>
                                {f.options?.map((opt) => (
                                  <option key={opt} value={opt}>
                                    {opt}
                                  </option>
                                ))}
                              </select>
                            </div>
                          ) : (
                            <Input
                              label={`${f.label}${f.required ? " *" : ""}`}
                              type={f.type === "number" ? "number" : "text"}
                              placeholder={`Enter ${f.label.toLowerCase()}...`}
                              value={val}
                              onChange={(e) => handleDynamicChange(f.name, e.target.value)}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic py-2">
                    No custom specifications defined for this product category. Go to Product Types Master to add specs!
                  </p>
                )}
              </div>
            </div>

          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-[#0d2336]">
            <Button
              variant="outline"
              type="button"
              onClick={() => {
                setShowCreateModal(false);
                setImageBase64(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" loading={creating}>
              Save Product
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Product Modal */}
      {showEditModal && itemToEdit && (
        <Modal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setItemToEdit(null);
            setEditImageBase64(null);
          }}
          title="Edit Inventory Product"
          size="xl"
          hasUnsavedChanges={editName !== itemToEdit.name || editSerialNumber !== itemToEdit.serial_number || editImageBase64 !== (itemToEdit.image_base64 || null) || editSelectedTypeCode !== itemToEdit.product_type_code || editRate !== (itemToEdit.attributes?.rate?.toString() || "") || editUnit !== (itemToEdit.attributes?.unit || "") || editInstock !== ((itemToEdit.attributes?.instock ?? itemToEdit.attributes?.stock ?? "").toString()) || editCaseSize !== (itemToEdit.attributes?.case_size?.toString() || "") || JSON.stringify(editDynamicValues) !== JSON.stringify(itemToEdit.attributes || {})}
        >
          <form onSubmit={handleUpdate} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Left Column: Product Identity details */}
              <div className="space-y-4 pr-0 md:pr-6 border-r-0 md:border-r border-slate-100 dark:border-[#0d2336]">
                <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">
                  Product Identity
                </h4>

                <Input
                  label="Model Number *"
                  required
                  placeholder="e.g. SPX-75 (Lango V100)"
                  value={editModelNumber}
                  onChange={(e) => setEditModelNumber(e.target.value)}
                />

                <Input
                  label="Product Name *"
                  required
                  placeholder="e.g. Fertilizer NPK 19-19-19"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Specification *
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder="e.g. 75&quot; 4K UHD, 20-point touch, Android 13, 8GB / 128GB"
                    value={editSpecification}
                    onChange={(e) => setEditSpecification(e.target.value)}
                    className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary/10 dark:border-[#0d2336] dark:bg-[#071929]/50 dark:text-white"
                  />
                </div>

                <Input
                  label="Hardware Serial Number (Unique) *"
                  required
                  placeholder="e.g. FT-NPK-12903"
                  value={editSerialNumber}
                  onChange={(e) => setEditSerialNumber(e.target.value)}
                />

                {/* IMAGE UPLOAD FIELD (EDIT) */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Product Image
                  </label>
                  <div className="grid grid-cols-12 gap-3 items-center">
                    <div className="col-span-8">
                      <label className="flex flex-col items-center justify-center border border-dashed border-slate-200 dark:border-[#0d2336] rounded-xl p-4 bg-slate-50/50 hover:bg-slate-50 hover:border-primary/50 transition-all cursor-pointer">
                        <FiUploadCloud className="text-xl text-slate-400 mb-1" />
                        <span className="text-[10px] font-bold text-slate-600 dark:text-slate-355">Change Image</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleImageUpload(e, true)}
                        />
                      </label>
                    </div>
                    <div className="col-span-4 flex items-center justify-center bg-slate-100 dark:bg-[#071929]/50 border border-slate-200/50 dark:border-[#0d2336] rounded-xl h-20 relative">
                      {editImageBase64 ? (
                        <>
                          <img
                            src={editImageBase64}
                            alt="Uploaded Preview"
                            className="max-h-[70px] max-w-[90%] rounded object-contain"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setEditImageTouched(true);
                              setEditImageBase64(null);
                            }}
                            className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white rounded-full p-1 border-none hover:bg-rose-600 cursor-pointer shadow animate-fadeIn"
                          >
                            <FiX className="text-[10px]" />
                          </button>
                        </>
                      ) : (
                        <span className="text-[9px] text-slate-400 italic">No image</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Product Category / Type
                  </label>
                  <select
                    className="w-full rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-50/50 dark:bg-[#071929]/50 px-3.5 py-2.5 text-xs text-slate-900 dark:text-white outline-none"
                    value={editSelectedTypeCode}
                    onChange={(e) => setEditSelectedTypeCode(e.target.value)}
                  >
                    {productTypes.map((t) => (
                      <option key={t.code} value={t.code}>
                        {t.name} ({t.code})
                      </option>
                    ))}
                  </select>
                </div>

                {(scopeCompanies.length > 1 || anyCompany) && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Company {anyCompany ? "" : "*"}
                    </label>
                    <select
                      className="w-full rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-50/50 dark:bg-[#071929]/50 px-3.5 py-2.5 text-xs text-slate-900 dark:text-white outline-none"
                      value={editCompanyId}
                      onChange={(e) => setEditCompanyId(e.target.value)}
                    >
                      <option value="">
                        {anyCompany ? "All companies (shared)" : "Select a company..."}
                      </option>
                      {scopeCompanies.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.company_name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Right Column: Parameters and specifications */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">
                  Mandatory Stock Parameters
                </h4>

                {/* The two price lists together, as on the add form. */}
                <div className="grid grid-cols-2 gap-3.5">
                  <Input
                    label="ECP Rate (End Customer Price) *"
                    required
                    type="number"
                    placeholder="e.g. 450"
                    value={editRate}
                    onChange={(e) => setEditRate(e.target.value)}
                  />

                  <Input
                    label="DTP Rate (Dealer Transfer Price)"
                    type="number"
                    placeholder="Blank if not sold through the channel"
                    value={editDtpRate}
                    onChange={(e) => setEditDtpRate(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <Input
                    label="In-Stock Inventory (Qty) *"
                    required
                    type="number"
                    placeholder="e.g. 150"
                    value={editInstock}
                    onChange={(e) => setEditInstock(e.target.value)}
                  />

                  <Input
                    label="Case Size (Qty/Case) *"
                    required
                    type="number"
                    placeholder="e.g. 25"
                    value={editCaseSize}
                    onChange={(e) => setEditCaseSize(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Select Unit *
                    </label>
                    <select
                      className="w-full rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-50/50 dark:bg-[#071929]/50 px-3.5 py-2.5 text-xs text-slate-900 dark:text-white outline-none"
                      value={editUnit}
                      onChange={(e) => setEditUnit(e.target.value)}
                    >
                      {unitsList.map((u) => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                      {unitsList.length === 0 && (
                        <option value="">No units created in master...</option>
                      )}
                    </select>
                  </div>

                  <Input
                    label="HSN / SAC Code"
                    placeholder="e.g. 8528"
                    value={editHsnCode}
                    onChange={(e) => setEditHsnCode(e.target.value)}
                  />
                </div>

                <WarrantyRatesPanel
                  terms={warrantyTerms}
                  rates={warrantyRates}
                  onChange={setWarrantyRate}
                  editable={superAdmin}
                />

                {/* DYNAMIC FORM SECTION */}
                <div className="border-t border-slate-100 dark:border-[#0d2336] pt-4 space-y-4">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">
                    Category Technical Specifications (Dynamic Fields)
                  </h4>

                  {loadingEditTemplate ? (
                    <div className="flex justify-center items-center py-4 gap-2 text-slate-400">
                      <CgSpinner className="animate-spin text-xl text-primary" />
                      <span className="text-[10px]">Loading dynamic layout...</span>
                    </div>
                  ) : editActiveTemplate && editActiveTemplate.fields && editActiveTemplate.fields.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3.5">
                      {editActiveTemplate.fields.map((f) => {
                        const val = editDynamicValues[f.name] ?? "";
                        return (
                          <div key={f.name} className="space-y-1.5 col-span-2 sm:col-span-1">
                            {f.type === "boolean" ? (
                              <div className="flex items-center justify-between p-2 rounded-xl border border-slate-100 dark:border-[#0d2336] bg-slate-50/30">
                                <span className="text-xs font-semibold text-slate-755 dark:text-slate-350">
                                  {f.label} {f.required && <span className="text-rose-500 font-bold">*</span>}
                                </span>
                                <Switch
                                  checked={!!val}
                                  onChange={(checked) => handleEditDynamicChange(f.name, checked)}
                                />
                              </div>
                            ) : f.type === "select" ? (
                              <div className="space-y-1.5">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                                  {f.label} {f.required && <span className="text-rose-500 font-bold">*</span>}
                                </label>
                                <select
                                  className="w-full rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-50/50 dark:bg-[#071929]/50 px-3.5 py-2.5 text-xs text-slate-900 dark:text-white outline-none"
                                  value={val}
                                  onChange={(e) => handleEditDynamicChange(f.name, e.target.value)}
                                >
                                  <option value="">Select Option...</option>
                                  {f.options?.map((opt) => (
                                    <option key={opt} value={opt}>
                                      {opt}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            ) : (
                              <Input
                                label={`${f.label}${f.required ? " *" : ""}`}
                                type={f.type === "number" ? "number" : "text"}
                                placeholder={`Enter ${f.label.toLowerCase()}...`}
                                value={val}
                                onChange={(e) => handleEditDynamicChange(f.name, e.target.value)}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic py-2">
                      No custom specifications defined for this product category. Go to Product Types Master to add specs!
                    </p>
                  )}
                </div>
              </div>

            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-[#0d2336]">
              <Button
                variant="outline"
                type="button"
                onClick={() => {
                  setShowEditModal(false);
                  setItemToEdit(null);
                  setEditImageBase64(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" loading={updating}>
                Save Product
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && itemToDelete && (
        <Modal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setItemToDelete(null);
          }}
          title="Delete Inventory Product"
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Are you sure you want to delete product item <span className="font-bold text-slate-800 dark:text-white">{itemToDelete.name}</span> (Serial: {itemToDelete.serial_number})? This is permanent.
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-[#0d2336]">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteModal(false);
                  setItemToDelete(null);
                }}
              >
                Cancel
              </Button>
              <Button variant="danger" onClick={handleConfirmDelete} loading={deleting}>
                Delete Item
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </ListPage>
  );
}
