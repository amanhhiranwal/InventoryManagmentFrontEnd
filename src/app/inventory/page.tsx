"use client";

import { useEffect, useState, useCallback } from "react";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Table from "@/components/ui/Table";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import Switch from "@/components/ui/Switch";
import api from "@/lib/axios";
import { useUIStore } from "@/lib/store/ui.store";
import {
  getInventoryItemsApi,
  createInventoryItemApi,
  deleteInventoryItemApi,
  updateInventoryItemApi,
  getTemplateApi,
  getProductTypesApi,
  InventoryItem,
  InventoryTemplate,
  ProductTypeModel,
} from "@/features/inventory/api/inventory.api";
import {
  FiPlus,
  FiTrash2,
  FiSearch,
  FiDatabase,
  FiEye,
  FiEdit2,
  FiUploadCloud,
  FiImage,
  FiX
} from "react-icons/fi";
import { CgSpinner } from "react-icons/cg";

export default function InventoryPage() {
  const { addToast } = useUIStore();

  const [productTypes, setProductTypes] = useState<ProductTypeModel[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilterCategory, setSelectedFilterCategory] = useState<string>("");

  // Masters units list
  const [unitsList, setUnitsList] = useState<string[]>([]);

  // Create Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);

  // New Item Core Fields
  const [name, setName] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [selectedTypeCode, setSelectedTypeCode] = useState("");
  const [imageBase64, setImageBase64] = useState<string | null>(null);

  // Mandatory standard attributes
  const [rate, setRate] = useState("");
  const [unit, setUnit] = useState("");
  const [instock, setInstock] = useState("");
  const [caseSize, setCaseSize] = useState("");

  // Dynamic template fields loaded for selected product type (Create Modal)
  const [activeTemplate, setActiveTemplate] = useState<InventoryTemplate | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [dynamicValues, setDynamicValues] = useState<Record<string, any>>({});

  // View modal state
  const [showViewModal, setShowViewModal] = useState(false);
  const [itemView, setItemView] = useState<InventoryItem | null>(null);

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<InventoryItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editSerialNumber, setEditSerialNumber] = useState("");
  const [editSelectedTypeCode, setEditSelectedTypeCode] = useState("");
  const [editImageBase64, setEditImageBase64] = useState<string | null>(null);

  // Mandatory standard attributes (Edit)
  const [editRate, setEditRate] = useState("");
  const [editUnit, setEditUnit] = useState("");
  const [editInstock, setEditInstock] = useState("");
  const [editCaseSize, setEditCaseSize] = useState("");

  const [editDynamicValues, setEditDynamicValues] = useState<Record<string, any>>({});
  const [editActiveTemplate, setEditActiveTemplate] = useState<InventoryTemplate | null>(null);
  const [loadingEditTemplate, setLoadingEditTemplate] = useState(false);
  const [updating, setUpdating] = useState(false);

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<InventoryItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getInventoryItemsApi({
        product_type_code: selectedFilterCategory || undefined,
        search: searchQuery || undefined,
      });
      setItems(data);
    } catch (err) {
      console.error(err);
      addToast("Failed to fetch inventory item records.", "error");
    } finally {
      setLoading(false);
    }
  }, [selectedFilterCategory, searchQuery, addToast]);

  const fetchUnits = useCallback(async () => {
    try {
      const res = await api.get("/api/v1/inventory/units/");
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
  }, [fetchProductTypes, fetchUnits]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

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

  const handleOpenEditModal = (item: InventoryItem) => {
    setItemToEdit(item);
    setEditName(item.name);
    setEditSerialNumber(item.serial_number);
    setEditSelectedTypeCode(item.product_type_code);
    setEditImageBase64(item.image_base64 || null);

    // Extract standard attributes
    setEditRate(item.attributes?.rate?.toString() || "");
    setEditUnit(item.attributes?.unit || (unitsList.length > 0 ? unitsList[0] : ""));
    setEditInstock((item.attributes?.instock ?? item.attributes?.stock ?? "").toString());
    setEditCaseSize(item.attributes?.case_size?.toString() || "");

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

    const rateVal = parseFloat(rate) ?? -1;
    const instockVal = parseFloat(instock) ?? -1;
    const caseSizeVal = parseFloat(caseSize) ?? -1;

    if (rate.trim() === "" || rateVal < 0) {
      addToast("Rate per quantity is required and must be 0 or greater.", "warning");
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

    const typeDetails = productTypes.find((t) => t.code === selectedTypeCode);
    if (!typeDetails) return;

    try {
      setCreating(true);
      const mergedAttributes = {
        ...dynamicValues,
        rate: rateVal,
        rate_per_unit: rateVal,
        unit: unit,
        instock: instockVal,
        stock: instockVal,
        case_size: caseSizeVal
      };

      await createInventoryItemApi({
        name: name.trim(),
        serial_number: serialNumber.trim().toUpperCase(),
        product_type_code: selectedTypeCode,
        category: typeDetails.category,
        attributes: mergedAttributes,
        image_base64: imageBase64 || undefined
      });

      addToast("Inventory item added successfully!", "success");
      setName("");
      setSerialNumber("");
      setRate("");
      setInstock("");
      setCaseSize("");
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

    const rateVal = parseFloat(editRate) ?? -1;
    const instockVal = parseFloat(editInstock) ?? -1;
    const caseSizeVal = parseFloat(editCaseSize) ?? -1;

    if (editRate.trim() === "" || rateVal < 0) {
      addToast("Rate per quantity is required and must be 0 or greater.", "warning");
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

    const typeDetails = productTypes.find((t) => t.code === editSelectedTypeCode);
    if (!typeDetails) return;

    try {
      setUpdating(true);
      const mergedEditAttributes = {
        ...editDynamicValues,
        rate: rateVal,
        rate_per_unit: rateVal,
        unit: editUnit,
        instock: instockVal,
        stock: instockVal,
        case_size: caseSizeVal
      };

      await updateInventoryItemApi(itemToEdit._id, {
        name: editName.trim(),
        serial_number: editSerialNumber.trim().toUpperCase(),
        product_type_code: editSelectedTypeCode,
        category: typeDetails.category,
        attributes: mergedEditAttributes,
        image_base64: editImageBase64 || undefined
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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Inventory Management"
          description="Access and track custom products data stored inside MongoDB collections."
        />
        <Button
          onClick={() => {
            if (productTypes.length === 0) {
              addToast("Please create a Product Type master first.", "warning");
              return;
            }
            setShowCreateModal(true);
          }}
          icon={<FiPlus />}
          className="shrink-0"
        >
          Add Inventory Product
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
        {/* Search Input */}
        <div className="flex items-center gap-3 max-w-md bg-white dark:bg-[#051422] rounded-xl border border-slate-200 dark:border-[#0d2336] px-3.5 py-2 flex-grow">
          <FiSearch className="text-slate-400 text-sm" />
          <input
            type="text"
            placeholder="Search items by name or serial..."
            className="w-full text-xs bg-transparent outline-none text-slate-800 dark:text-white"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Category Filters row */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-2">Filter Category:</span>
          <button
            onClick={() => setSelectedFilterCategory("")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
              selectedFilterCategory === ""
                ? "bg-primary text-white border-primary"
                : "bg-white dark:bg-[#051422] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-[#0d2336] hover:bg-slate-50"
            }`}
          >
            All
          </button>
          {productTypes.map((t) => (
            <button
              key={t.code}
              onClick={() => setSelectedFilterCategory(t.code)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                selectedFilterCategory === t.code
                  ? "bg-primary text-white border-primary"
                  : "bg-white dark:bg-[#051422] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-[#0d2336] hover:bg-slate-50"
              }`}
            >
              {t.code}
            </button>
          ))}
        </div>
      </div>

      <Card>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-slate-400">
            <CgSpinner className="animate-spin text-3xl text-primary" />
            <span className="text-xs">Connecting to MongoDB databases...</span>
          </div>
        ) : items.length > 0 ? (
          <Table headers={["Product Preview", "Item Name", "Serial Number", "Category Group", "Stock Status *", "Wholesale Rate *", "Actions"]}>
            {items.map((item) => {
              const typeName = productTypes.find((t) => t.code === item.product_type_code)?.name || item.product_type_code;
              const rateVal = item.attributes?.rate ?? 0;
              const unitVal = item.attributes?.unit ?? "Unit";
              const stockVal = item.attributes?.instock ?? item.attributes?.stock ?? 0;
              const caseSizeVal = item.attributes?.case_size ?? 1;

              return (
                <tr
                  key={item._id}
                  className="hover:bg-slate-50/50 dark:hover:bg-[#071929]/20 transition-all duration-150 border-b border-slate-100 dark:border-[#0d2336]/30"
                >
                  <td className="py-3 px-5">
                    {item.image_base64 ? (
                      <img
                        src={item.image_base64}
                        alt={item.name}
                        className="w-10 h-10 rounded-lg object-cover border border-slate-200 dark:border-[#0d2336] bg-slate-50"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg border border-slate-100 dark:border-[#0d2336]/50 bg-slate-50 dark:bg-[#071929]/20 flex items-center justify-center text-slate-400">
                        <FiImage className="text-sm" />
                      </div>
                    )}
                  </td>
                  <td className="py-4 px-5 font-bold text-slate-800 dark:text-white text-sm">
                    <div className="flex items-center gap-2">
                      <FiDatabase className="text-primary text-xs shrink-0" />
                      <div>
                        <span>{item.name}</span>
                        <span className="text-[10px] text-slate-400 block font-normal">{typeName}</span>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-5">
                    <span className="font-mono text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider bg-slate-100 dark:bg-[#0d2336] px-2 py-0.5 rounded">
                      {item.serial_number}
                    </span>
                  </td>
                  <td className="py-4 px-5 text-xs text-slate-500">
                    {item.category}
                  </td>
                  <td className="py-4 px-5 text-xs font-semibold text-slate-700 dark:text-slate-355 font-mono">
                    {stockVal.toLocaleString('en-IN')} {unitVal}
                  </td>
                  <td className="py-4 px-5 text-xs font-semibold text-primary font-mono">
                    ₹{rateVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })} / {unitVal}
                    <span className="text-[10px] text-slate-400 block font-normal font-sans">({caseSizeVal} {unitVal}/Case)</span>
                  </td>
                  <td className="py-4 px-5 text-right">
                    <div className="flex justify-end gap-1.5">
                      <button
                        onClick={() => {
                          setItemView(item);
                          setShowViewModal(true);
                        }}
                        className="p-1.5 rounded-lg border-none bg-transparent cursor-pointer text-slate-400 hover:text-slate-700"
                        title="View Specifications & QR Code"
                      >
                        <FiEye className="text-sm" />
                      </button>
                      <button
                        onClick={() => handleOpenEditModal(item)}
                        className="p-1.5 rounded-lg border-none bg-transparent cursor-pointer text-slate-400 hover:text-primary"
                        title="Edit Item"
                      >
                        <FiEdit2 className="text-sm" />
                      </button>
                      <button
                        onClick={() => {
                          setItemToDelete(item);
                          setShowDeleteModal(true);
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-slate-100 dark:hover:bg-[#0d2336] border-none bg-transparent cursor-pointer"
                        title="Delete Item"
                      >
                        <FiTrash2 className="text-sm" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </Table>
        ) : (
          <div className="text-center py-12 text-slate-400 italic text-xs">
            No inventory products found inside MongoDB matching these filters.
          </div>
        )}
      </Card>

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
                {itemView.image_base64 ? (
                  <img
                    src={itemView.image_base64}
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
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Rate per quantity</span>
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
                
                {/* Dynamically generated QR Code using public stateless API */}
                <div className="p-2.5 bg-white border border-slate-200/50 rounded-xl shadow-sm">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(
                      JSON.stringify({
                        id: itemView._id,
                        serial: itemView.serial_number,
                        name: itemView.name,
                        type: itemView.product_type_code,
                      })
                    )}`}
                    alt="Product Identity QR Code"
                    className="w-[100px] h-[100px]"
                  />
                </div>
                
                <span className="text-[9px] text-slate-400 leading-tight">
                  Scan QR code tag to read structural spec properties instantly.
                </span>
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

              <Input
                label="Product Name *"
                required
                placeholder="e.g. Fertilizer NPK 19-19-19"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />

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
            </div>

            {/* Right Column: Parameters and specifications */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">
                Mandatory Stock Parameters
              </h4>

              <div className="grid grid-cols-2 gap-3.5">
                <Input
                  label="Rate per unit (Exc. GST) *"
                  required
                  type="number"
                  placeholder="e.g. 450"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                />

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
                  label="Product Name *"
                  required
                  placeholder="e.g. Fertilizer NPK 19-19-19"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />

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
                            onClick={() => setEditImageBase64(null)}
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
              </div>

              {/* Right Column: Parameters and specifications */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">
                  Mandatory Stock Parameters
                </h4>

                <div className="grid grid-cols-2 gap-3.5">
                  <Input
                    label="Rate per unit (Exc. GST) *"
                    required
                    type="number"
                    placeholder="e.g. 450"
                    value={editRate}
                    onChange={(e) => setEditRate(e.target.value)}
                  />

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
    </div>
  );
}
