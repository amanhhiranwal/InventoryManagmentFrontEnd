"use client";

import { useState, useEffect, useCallback } from "react";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Table from "@/components/ui/Table";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import Switch from "@/components/ui/Switch";
import { useUIStore } from "@/lib/store/ui.store";
import {
  FiPlus,
  FiTrash2,
  FiSearch,
  FiBox,
  FiSliders,
  FiPlusCircle,
  FiEdit2,
  FiFileText,
  FiEye,
  FiToggleLeft,
  FiHash,
  FiList,
  FiAlertCircle
} from "react-icons/fi";
import {
  getTemplateApi,
  saveTemplateApi,
  getProductTypesApi,
  createProductTypeApi,
  deleteProductTypeApi,
  updateProductTypeApi,
  getCategoryGroupsApi,
  InventoryField,
  CategoryGroupModel,
} from "@/features/inventory/api/inventory.api";
import { CgSpinner } from "react-icons/cg";

interface ProductType {
  id: string;
  name: string;
  code: string;
  category: string;
  description?: string;
}

export default function ProductTypesPage() {
  const { addToast } = useUIStore();
  const [types, setTypes] = useState<ProductType[]>([]);
  const [categoryGroups, setCategoryGroups] = useState<CategoryGroupModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState("");
  
  // Add product type modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");

  // Edit product type modal state
  const [showEditTypeModal, setShowEditTypeModal] = useState(false);
  const [typeToEdit, setTypeToEdit] = useState<ProductType | null>(null);
  const [editTypeName, setEditTypeName] = useState("");
  const [editTypeCode, setEditTypeCode] = useState("");
  const [editTypeCategory, setEditTypeCategory] = useState("");
  const [editTypeDescription, setEditTypeDescription] = useState("");
  const [updatingType, setUpdatingType] = useState(false);

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [typeToDelete, setTypeToDelete] = useState<ProductType | null>(null);

  // Dynamic Form Builder States
  const [selectedProductType, setSelectedProductType] = useState<ProductType | null>(null);
  const [templateFields, setTemplateFields] = useState<InventoryField[]>([]);
  const [originalFields, setOriginalFields] = useState<InventoryField[]>([]);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);

  // New Field State
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [newFieldKey, setNewFieldKey] = useState("");
  const [newFieldType, setNewFieldType] = useState<"text" | "number" | "select" | "boolean">("text");
  const [newFieldRequired, setNewFieldRequired] = useState(false);
  const [newFieldOptions, setNewFieldOptions] = useState(""); // comma separated options

  const fetchProductTypes = useCallback(async () => {
    setLoading(true);
    try {
      const ptData = await getProductTypesApi();
      setTypes(Array.isArray(ptData) ? ptData : []);
    } catch (err) {
      console.error(err);
      addToast("Failed to fetch product types.", "error");
    }

    try {
      const cgData = await getCategoryGroupsApi();
      const cleanCg = Array.isArray(cgData) ? cgData : [];
      setCategoryGroups(cleanCg);
      if (cleanCg.length > 0 && !category) {
        setCategory(cleanCg[0].name);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }, [addToast, category]);

  useEffect(() => {
    fetchProductTypes();
  }, [fetchProductTypes]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim() || !category.trim()) {
      addToast("Name, Code, and Category Group are required.", "warning");
      return;
    }

    try {
      setSubmitting(true);
      await createProductTypeApi({
        name: name.trim(),
        code: code.toUpperCase().trim(),
        category,
        description: description.trim() || undefined
      });
      addToast("Product Type created successfully!", "success");
      setName("");
      setCode("");
      setDescription("");
      setShowAddModal(false);
      fetchProductTypes();
    } catch (err: any) {
      console.error(err);
      addToast(err.response?.data?.detail || "Failed to create product type.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEditType = (pt: ProductType) => {
    setTypeToEdit(pt);
    setEditTypeName(pt.name);
    setEditTypeCode(pt.code);
    setEditTypeCategory(pt.category);
    setEditTypeDescription(pt.description || "");
    setShowEditTypeModal(true);
  };

  const handleUpdateType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!typeToEdit) return;
    if (!editTypeName.trim() || !editTypeCode.trim() || !editTypeCategory.trim()) {
      addToast("Name, Code, and Category Group are required.", "warning");
      return;
    }

    try {
      setUpdatingType(true);
      await updateProductTypeApi(typeToEdit.id, {
        name: editTypeName.trim(),
        code: editTypeCode.toUpperCase().trim(),
        category: editTypeCategory.trim(),
        description: editTypeDescription.trim() || undefined
      });
      addToast("Product Type updated successfully!", "success");
      setShowEditTypeModal(false);
      setTypeToEdit(null);
      fetchProductTypes();
    } catch (err: any) {
      console.error(err);
      addToast(err.response?.data?.detail || "Failed to update product type.", "error");
    } finally {
      setUpdatingType(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!typeToDelete) return;
    try {
      setDeleting(true);
      await deleteProductTypeApi(typeToDelete.id);
      addToast("Product Type deleted successfully.", "success");
      setShowDeleteModal(false);
      setTypeToDelete(null);
      fetchProductTypes();
    } catch (err) {
      console.error(err);
      addToast("Failed to delete product type.", "error");
    } finally {
      setDeleting(false);
    }
  };

  const handleOpenBuilder = async (pt: ProductType) => {
    setSelectedProductType(pt);
    try {
      setLoadingTemplate(true);
      const data = await getTemplateApi(pt.code);
      setOriginalFields(data.fields || []);
      setTemplateFields(data.fields || []);
    } catch (err) {
      console.error(err);
      addToast("Failed to fetch custom fields template.", "error");
    } finally {
      setLoadingTemplate(false);
    }
  };

  const handleAddField = () => {
    if (!newFieldLabel.trim() || !newFieldKey.trim()) {
      addToast("Field Label and Key are required.", "warning");
      return;
    }
    const cleanKey = newFieldKey.toLowerCase().replace(/[^a-z0-9_]/g, "");

    if (templateFields.some((f) => f.name === cleanKey)) {
      addToast("A field with this identifier key already exists.", "warning");
      return;
    }

    const field: InventoryField = {
      name: cleanKey,
      label: newFieldLabel.trim(),
      type: newFieldType,
      required: newFieldRequired,
      options: newFieldType === "select" ? newFieldOptions.split(",").map((o) => o.trim()).filter(Boolean) : undefined,
    };

    setTemplateFields([...templateFields, field]);
    setNewFieldLabel("");
    setNewFieldKey("");
    setNewFieldType("text");
    setNewFieldRequired(false);
    setNewFieldOptions("");
    addToast("Field specification added.", "success");
  };

  const handleRemoveField = (index: number) => {
    setTemplateFields(templateFields.filter((_, idx) => idx !== index));
  };

  const handleSaveTemplate = async () => {
    if (!selectedProductType) return;
    try {
      setSavingTemplate(true);
      await saveTemplateApi(selectedProductType.code, templateFields);
      addToast(`Form specifications for '${selectedProductType.name}' saved.`, "success");
      setSelectedProductType(null);
    } catch (err) {
      console.error(err);
      addToast("Failed to save dynamic form specification.", "error");
    } finally {
      setSavingTemplate(false);
    }
  };

  const filtered = types.filter(
    (t) =>
      (t.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (t.code || "").toLowerCase().includes(search.toLowerCase()) ||
      (t.category || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Product Types Master"
          description="Manage inventory classifications, product categories, and build dynamic forms specifications."
        />
        <Button
          onClick={() => setShowAddModal(true)}
          icon={<FiPlus />}
          className="shrink-0"
        >
          Add Product Type
        </Button>
      </div>

      <div className="flex items-center gap-3 max-w-md bg-white dark:bg-[#051422] rounded-xl border border-slate-200 dark:border-[#0d2336] px-3.5 py-2">
        <FiSearch className="text-slate-400 text-sm" />
        <input
          type="text"
          placeholder="Search product classifications..."
          className="w-full text-xs bg-transparent outline-none text-slate-800 dark:text-white"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-slate-400">
            <CgSpinner className="animate-spin text-3xl text-primary" />
            <span className="text-xs">Fetching Product Types...</span>
          </div>
        ) : filtered.length > 0 ? (
          <Table headers={["Product Type", "Code", "Category Group", "Description", "Actions"]}>
            {filtered.map((t) => (
              <tr
                key={t.id}
                className="hover:bg-slate-50/50 dark:hover:bg-[#071929]/20 transition-all duration-150"
              >
                <td className="py-4 px-5 font-bold text-slate-800 dark:text-white text-sm">
                  <div className="flex items-center gap-2">
                    <FiBox className="text-primary" />
                    <span>{t.name}</span>
                  </div>
                </td>
                <td className="py-4 px-5">
                  <span className="inline-flex items-center rounded bg-primary-light/30 dark:bg-primary-light/5 text-primary px-2 py-0.5 text-xs font-semibold uppercase tracking-wider">
                    {t.code}
                  </span>
                </td>
                <td className="py-4 px-5 text-xs font-semibold text-slate-700 dark:text-slate-350">
                  {t.category}
                </td>
                <td className="py-4 px-5 text-xs text-slate-500 dark:text-slate-450">
                  {t.description || <span className="italic">No description</span>}
                </td>
                <td className="py-4 px-5 text-right">
                  <div className="flex justify-end gap-1.5">
                    <button
                      onClick={() => handleOpenBuilder(t)}
                      className="p-1.5 text-slate-400 hover:text-primary rounded-lg hover:bg-slate-100 dark:hover:bg-[#0d2336] border-none bg-transparent cursor-pointer"
                      title="Build Dynamic Specifications Form"
                    >
                      <FiSliders className="text-sm" />
                    </button>
                    <button
                      onClick={() => handleOpenEditType(t)}
                      className="p-1.5 text-slate-400 hover:text-primary rounded-lg hover:bg-slate-100 dark:hover:bg-[#0d2336] border-none bg-transparent cursor-pointer"
                      title="Edit Product Type"
                    >
                      <FiEdit2 className="text-sm" />
                    </button>
                    <button
                      onClick={() => {
                        setTypeToDelete(t);
                        setShowDeleteModal(true);
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-slate-100 dark:hover:bg-[#0d2336] border-none bg-transparent cursor-pointer"
                      title="Delete Product Type"
                    >
                      <FiTrash2 className="text-sm" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        ) : (
          <div className="text-center py-12 text-slate-400 italic text-xs">
            No product classifications match your filter query.
          </div>
        )}
      </Card>

      {/* Add Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Product Type"
        hasUnsavedChanges={name.trim() !== "" || code.trim() !== "" || category.trim() !== "" || description.trim() !== ""}
      >
        <form onSubmit={handleAdd} className="space-y-4">
          <Input
            label="Product Type Name *"
            required
            placeholder="e.g. Interactive Flat Panel"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <Input
            label="Identifier Code (Unique) *"
            required
            placeholder="e.g. IFP"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Category Group *
            </label>
            <div className="relative">
              <select
                required
                className="w-full appearance-none rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-50/50 dark:bg-[#071929]/50 pl-3.5 pr-8 py-2 text-xs text-slate-900 dark:text-white outline-none cursor-pointer"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">Select Category Group...</option>
                {categoryGroups.map((g) => (
                  <option key={g.id} value={g.name}>
                    {g.name}
                  </option>
                ))}
              </select>
              <span className="absolute inset-y-0 right-3.5 flex items-center pointer-events-none text-slate-400 text-[10px]">
                ▼
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Description
            </label>
            <textarea
              className="w-full rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-50/50 dark:bg-[#071929]/50 px-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 outline-none min-h-[80px]"
              placeholder="e.g. Smartboard hardware for classrooms"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-[#0d2336]">
            <Button
              variant="outline"
              type="button"
              onClick={() => setShowAddModal(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              Save Master
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      {showEditTypeModal && typeToEdit && (
        <Modal
          isOpen={showEditTypeModal}
          onClose={() => {
            setShowEditTypeModal(false);
            setTypeToEdit(null);
          }}
          title="Edit Product Type"
          hasUnsavedChanges={editTypeName !== typeToEdit.name || editTypeCode !== typeToEdit.code || editTypeCategory !== typeToEdit.category || editTypeDescription !== (typeToEdit.description || "")}
        >
          <form onSubmit={handleUpdateType} className="space-y-4">
            <Input
              label="Product Type Name *"
              required
              placeholder="e.g. Interactive Flat Panel"
              value={editTypeName}
              onChange={(e) => setEditTypeName(e.target.value)}
            />

            <Input
              label="Identifier Code (Unique) *"
              required
              placeholder="e.g. IFP"
              value={editTypeCode}
              onChange={(e) => setEditTypeCode(e.target.value)}
            />

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Category Group *
              </label>
              <div className="relative">
                <select
                  required
                  className="w-full appearance-none rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-50/50 dark:bg-[#071929]/50 pl-3.5 pr-8 py-2 text-xs text-slate-900 dark:text-white outline-none cursor-pointer"
                  value={editTypeCategory}
                  onChange={(e) => setEditTypeCategory(e.target.value)}
                >
                  <option value="">Select Category Group...</option>
                  {categoryGroups.map((g) => (
                    <option key={g.id} value={g.name}>
                      {g.name}
                    </option>
                  ))}
                </select>
                <span className="absolute inset-y-0 right-3.5 flex items-center pointer-events-none text-slate-400 text-[10px]">
                  ▼
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Description
              </label>
              <textarea
                className="w-full rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-50/50 dark:bg-[#071929]/50 px-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 outline-none min-h-[80px]"
                placeholder="e.g. Smartboard hardware for classrooms"
                value={editTypeDescription}
                onChange={(e) => setEditTypeDescription(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-[#0d2336]">
              <Button
                variant="outline"
                type="button"
                onClick={() => {
                  setShowEditTypeModal(false);
                  setTypeToEdit(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" loading={updatingType}>
                Save Changes
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Dynamic Form Builder Modal (High-Fidelity Premium UI layout) */}
      {selectedProductType && (
        <Modal
          isOpen={!!selectedProductType}
          onClose={() => setSelectedProductType(null)}
          title={`Form Builder & Specs: ${selectedProductType.name}`}
          size="xl"
          hasUnsavedChanges={JSON.stringify(templateFields) !== JSON.stringify(originalFields) || newFieldLabel.trim() !== "" || newFieldKey.trim() !== ""}
        >
          <div className="space-y-6">
            {loadingTemplate ? (
              <div className="flex justify-center items-center py-10 gap-2 text-slate-400">
                <CgSpinner className="animate-spin text-2xl text-primary" />
                <span className="text-xs">Fetching dynamic specifications...</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                {/* LEFT SIDE: Active Fields and New Field Form (7 cols) */}
                <div className="lg:col-span-7 space-y-6">
                  
                  {/* Defined Dynamic Fields list */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#0d2336] pb-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-350">
                        Defined Dynamic Fields ({templateFields.length})
                      </h4>
                      <span className="text-[10px] bg-primary-light/35 dark:bg-primary-light/5 text-primary px-2 py-0.5 rounded-full font-bold">
                        Active Schema
                      </span>
                    </div>
                    
                    {templateFields.length > 0 ? (
                      <div className="grid grid-cols-1 gap-2.5 max-h-[220px] overflow-y-auto pr-1">
                        {templateFields.map((f, index) => {
                          let badgeColorClass = "";
                          let badgeText = "";
                          let FieldIcon = FiFileText;

                          if (f.type === "number") {
                            badgeColorClass = "bg-amber-500/10 text-amber-500 border border-amber-500/20";
                            badgeText = "Number";
                            FieldIcon = FiHash;
                          } else if (f.type === "select") {
                            badgeColorClass = "bg-purple-500/10 text-purple-500 border border-purple-500/20";
                            badgeText = "Dropdown";
                            FieldIcon = FiList;
                          } else if (f.type === "boolean") {
                            badgeColorClass = "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20";
                            badgeText = "Toggle";
                            FieldIcon = FiToggleLeft;
                          } else {
                            badgeColorClass = "bg-blue-500/10 text-blue-500 border border-blue-500/20";
                            badgeText = "Text Box";
                            FieldIcon = FiFileText;
                          }
                          
                          return (
                            <div
                              key={f.name}
                              className="p-3.5 flex items-center justify-between bg-white dark:bg-[#051422] border border-slate-200/80 dark:border-[#0d2336] rounded-xl hover:border-primary/50 dark:hover:border-primary/50 hover:shadow-sm transition-all duration-150"
                            >
                              <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${badgeColorClass.split(" ")[0]} shrink-0`}>
                                  <FieldIcon className="text-base" />
                                </div>
                                <div>
                                  <p className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                                    <span>{f.label}</span>
                                    {f.required && (
                                      <span className="inline-flex items-center rounded-full bg-rose-500/10 text-rose-500 px-1.5 py-0.5 text-[8px] font-bold">
                                        Required
                                      </span>
                                    )}
                                  </p>
                                  <p className="text-[10px] text-slate-400 mt-1">
                                    Key: <span className="font-mono text-slate-500">{f.name}</span> | Type:{" "}
                                    <span className="font-semibold">{badgeText}</span>
                                    {f.options && f.options.length > 0 && (
                                      <span className="block mt-0.5 text-slate-450 truncate max-w-xs font-medium">
                                        Dropdown List: [{f.options.join(", ")}]
                                      </span>
                                    )}
                                  </p>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveField(index)}
                                className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-500/5 rounded-lg border-none bg-transparent cursor-pointer transition-all duration-150"
                                title="Remove Field"
                              >
                                <FiTrash2 className="text-sm" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center p-8 bg-slate-50/50 dark:bg-[#071929]/20 border border-dashed border-slate-200 dark:border-[#0d2336] rounded-xl text-center">
                        <FiAlertCircle className="text-slate-400 text-lg mb-1" />
                        <p className="text-xs text-slate-400 italic">
                          No dynamic attributes defined yet. Create some below!
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Add new field builder section (Premium interactive card layout) */}
                  <div className="border-t border-slate-100 dark:border-[#0d2336] pt-5 space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-350 flex items-center gap-1.5">
                      <FiPlusCircle className="text-primary text-sm" />
                      <span>Add Dynamic Attribute Field</span>
                    </h4>

                    {/* INTERACTIVE INPUT CARD SELECTION */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                        Select Input Value Type
                      </label>
                      <div className="grid grid-cols-4 gap-2.5">
                        {[
                          { id: "text", label: "Text Box", icon: FiFileText, color: "text-blue-500 border-blue-500/20 bg-blue-500/5" },
                          { id: "number", label: "Number", icon: FiHash, color: "text-amber-500 border-amber-500/20 bg-amber-500/5" },
                          { id: "select", label: "Dropdown", icon: FiList, color: "text-purple-500 border-purple-500/20 bg-purple-500/5" },
                          { id: "boolean", label: "Toggle", icon: FiToggleLeft, color: "text-emerald-500 border-emerald-500/20 bg-emerald-500/5" }
                        ].map((btn) => {
                          const isSelected = newFieldType === btn.id;
                          const IconComp = btn.icon;
                          return (
                            <button
                              key={btn.id}
                              type="button"
                              onClick={() => setNewFieldType(btn.id as any)}
                              className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 cursor-pointer transition-all duration-150 ${
                                isSelected
                                  ? "border-primary bg-primary-light/10 text-primary ring-2 ring-primary/10 shadow-sm"
                                  : "border-slate-200 dark:border-[#0d2336] bg-white dark:bg-[#051422] text-slate-500 hover:bg-slate-50 dark:hover:bg-[#071929]/50"
                              }`}
                            >
                              <IconComp className="text-lg" />
                              <span className="text-[9px] font-bold tracking-wide uppercase select-none">{btn.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <Input
                        label="Field Label (Visible to user) *"
                        required
                        placeholder="e.g. Screen Size"
                        value={newFieldLabel}
                        onChange={(e) => {
                          setNewFieldLabel(e.target.value);
                          setNewFieldKey(
                            e.target.value
                              .toLowerCase()
                              .replace(/[^a-z0-9_]/g, "_")
                              .replace(/__+/g, "_")
                          );
                        }}
                      />
                      <Input
                        label="Attribute Key (Unique code identifier) *"
                        required
                        placeholder="e.g. screen_size"
                        value={newFieldKey}
                        onChange={(e) => setNewFieldKey(e.target.value)}
                      />
                    </div>

                    {newFieldType === "select" && (
                      <Input
                        label="Dropdown List Options (Comma separated list) *"
                        required
                        placeholder="e.g. Option A, Option B, Option C"
                        value={newFieldOptions}
                        onChange={(e) => setNewFieldOptions(e.target.value)}
                      />
                    )}

                    <div className="flex items-center justify-between p-3.5 bg-slate-50/50 dark:bg-[#071929]/30 border border-slate-200/60 dark:border-[#0d2336] rounded-xl">
                      <div>
                        <p className="text-xs font-bold text-slate-800 dark:text-white">Mark Attribute Required</p>
                        <p className="text-[10px] text-slate-400">Force user to fill this in when creating inventory items.</p>
                      </div>
                      <Switch
                        checked={newFieldRequired}
                        onChange={(checked) => setNewFieldRequired(checked)}
                      />
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleAddField}
                      icon={<FiPlusCircle />}
                      className="w-full justify-center py-2.5 rounded-xl text-xs font-bold tracking-wide uppercase mt-2"
                    >
                      Add Field Specification
                    </Button>
                  </div>
                </div>

                {/* RIGHT SIDE: Dynamic Live Form Preview mockup (5 cols) */}
                <div className="lg:col-span-5 bg-slate-50 dark:bg-[#071929]/20 border border-slate-200/80 dark:border-[#0d2336] rounded-2xl p-4.5 space-y-4">
                  <div className="flex items-center gap-2.5 pb-3 border-b border-slate-200/50 dark:border-[#0d2336]">
                    <FiEye className="text-primary text-base shrink-0" />
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">
                        Live Form Preview
                      </h4>
                      <p className="text-[9px] text-slate-400">
                        See how this template renders in the Add/Edit Inventory dialog.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4 max-h-[360px] overflow-y-auto pr-1">
                    {/* Static inputs preview */}
                    <div className="space-y-1 opacity-45 select-none pointer-events-none">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Product Name *</span>
                      <div className="w-full bg-slate-100 dark:bg-[#071929]/70 border border-slate-200/40 rounded-xl py-2 px-3.5 text-xs text-slate-400 font-medium">
                        Item Name
                      </div>
                    </div>
                    <div className="space-y-1 opacity-45 select-none pointer-events-none">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Serial Number *</span>
                      <div className="w-full bg-slate-100 dark:bg-[#071929]/70 border border-slate-200/40 rounded-xl py-2 px-3.5 text-xs text-slate-400 font-mono">
                        SN-00000
                      </div>
                    </div>

                    {/* Render dynamic preview fields */}
                    {templateFields.length > 0 ? (
                      <div className="space-y-4 border-t border-slate-200/40 dark:border-[#0d2336] pt-3.5">
                        <span className="text-[9px] font-bold text-primary uppercase tracking-wider block">
                          Category Technical Specs (Dynamic Layout)
                        </span>
                        {templateFields.map((f) => (
                          <div key={f.name} className="space-y-1.5 animate-fadeIn">
                            {f.type === "boolean" ? (
                              <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200/70 dark:border-[#0d2336] bg-white dark:bg-[#051422]">
                                <span className="text-xs font-semibold text-slate-700 dark:text-slate-350">
                                  {f.label} {f.required && <span className="text-rose-500 font-bold">*</span>}
                                </span>
                                <Switch checked={false} onChange={() => {}} />
                              </div>
                            ) : f.type === "select" ? (
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                                  {f.label} {f.required && <span className="text-rose-500 font-bold">*</span>}
                                </label>
                                <div className="relative">
                                  <select
                                    disabled
                                    className="w-full appearance-none rounded-xl border border-slate-200/80 dark:border-[#0d2336] bg-white dark:bg-[#051422] px-3.5 py-2.5 text-xs text-slate-400 outline-none"
                                  >
                                    <option value="">Select Option...</option>
                                    {f.options?.map((opt) => (
                                      <option key={opt} value={opt}>
                                        {opt}
                                      </option>
                                    ))}
                                  </select>
                                  <span className="absolute inset-y-0 right-3.5 flex items-center pointer-events-none text-slate-400 text-[10px]">
                                    ▼
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                                  {f.label} {f.required && <span className="text-rose-500 font-bold">*</span>}
                                </label>
                                <input
                                  type="text"
                                  disabled
                                  placeholder={`Enter ${f.label.toLowerCase()}...`}
                                  className="w-full rounded-xl border border-slate-200/80 dark:border-[#0d2336] bg-white dark:bg-[#051422] px-3.5 py-2.5 text-xs text-slate-450 placeholder:text-slate-350 outline-none"
                                />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-[11px] text-slate-400 italic">
                        No dynamic attributes configured yet. They will appear here in real-time as you add them!
                      </div>
                    )}
                  </div>
                </div>

              </div>
            )}

            <div className="flex justify-end gap-3 border-t border-slate-100 dark:border-[#0d2336] pt-4">
              <Button variant="outline" onClick={() => setSelectedProductType(null)}>
                Cancel
              </Button>
              <Button onClick={handleSaveTemplate} loading={savingTemplate}>
                Save Fields Template
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && typeToDelete && (
        <Modal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setTypeToDelete(null);
          }}
          title="Delete Product Type"
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Are you sure you want to delete <span className="font-bold text-slate-800 dark:text-white">{typeToDelete.name}</span>? This action is permanent and cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-[#0d2336]">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteModal(false);
                  setTypeToDelete(null);
                }}
              >
                Cancel
              </Button>
              <Button variant="danger" onClick={handleConfirmDelete} loading={deleting}>
                Delete Type
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
