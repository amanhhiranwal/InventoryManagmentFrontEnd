"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import api from "@/lib/axios";
import { useUIStore } from "@/lib/store/ui.store";
import {
  FiArrowLeft,
  FiPlus,
  FiTrash2,
  FiShoppingBag,
  FiSave
} from "react-icons/fi";

interface InventoryItem {
  _id: string;
  name: string;
  serial_number: string;
  product_type_code: string;
  category: string;
  attributes: {
    rate?: number;
    unit?: string;
    case_size?: number;
  };
}

interface OrderItem {
  product_id: string;
  description: string;
  rate: number;
  quantity_case: number;
  quantity_kg_ltr: number;
  price: number;
}

interface Order {
  _id: string;
  customer_name: string;
  created_at?: string;
  grand_total: number;
}

export default function CreateOrderPage() {
  const router = useRouter();
  const { addToast } = useUIStore();

  const [products, setProducts] = useState<InventoryItem[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // --- Database Orders for Aging Calculation ---
  const [allOrders, setAllOrders] = useState<Order[]>([]);

  // --- Header states ---
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [dbCustomers, setDbCustomers] = useState<{ id: string; name: string }[]>([]);
  const [agingData, setAgingData] = useState({
    aging_0_30: 0,
    aging_31_60: 0,
    aging_61_90: 0,
    aging_91_120: 0,
    aging_121_180: 0,
    aging_above_180: 0,
  });

  // --- Dynamic Grid Add Row fields ---
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<InventoryItem | null>(null);
  const [quantityCase, setQuantityCase] = useState("");

  // --- Items list ---
  const [items, setItems] = useState<OrderItem[]>([]);

  const updateAgingStats = useCallback((ordersList: Order[], customerName: string) => {
    const summary = {
      aging_0_30: 0,
      aging_31_60: 0,
      aging_61_90: 0,
      aging_91_120: 0,
      aging_121_180: 0,
      aging_above_180: 0,
    };

    const now = new Date();

    ordersList.forEach((o) => {
      if (o.customer_name === customerName) {
        const created = o.created_at ? new Date(o.created_at) : new Date();
        const diffTime = Math.abs(now.getTime() - created.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays <= 30) {
          summary.aging_0_30 += o.grand_total || 0;
        } else if (diffDays <= 60) {
          summary.aging_31_60 += o.grand_total || 0;
        } else if (diffDays <= 90) {
          summary.aging_61_90 += o.grand_total || 0;
        } else if (diffDays <= 120) {
          summary.aging_91_120 += o.grand_total || 0;
        } else if (diffDays <= 180) {
          summary.aging_121_180 += o.grand_total || 0;
        } else {
          summary.aging_above_180 += o.grand_total || 0;
        }
      }
    });

    setAgingData(summary);
  }, []);

  // Fetch products & historical orders from db
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [prodRes, orderRes, custRes] = await Promise.all([
          api.get("/api/v1/inventory/items"),
          api.get("/api/v1/orders/"),
          api.get("/api/v1/customers/")
        ]);

        let fetchedOrders: Order[] = [];
        if (orderRes.data?.success) {
          fetchedOrders = orderRes.data.data || [];
          setAllOrders(fetchedOrders);
        }

        if (prodRes.data?.success) {
          setProducts(prodRes.data.data || []);
        }

        if (custRes.data?.success) {
          const list = custRes.data.data || [];
          setDbCustomers(list);
          if (list.length > 0) {
            setSelectedCustomer(list[0].name);
            updateAgingStats(fetchedOrders, list[0].name);
          }
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchInitialData();
  }, [updateAgingStats]);

  const handleCustomerChange = (val: string) => {
    setSelectedCustomer(val);
    updateAgingStats(allOrders, val);
  };

  const handleProductSelect = (id: string) => {
    setSelectedProductId(id);
    const prod = products.find((p) => p._id === id) || null;
    setSelectedProduct(prod);
  };

  const handleAddItem = () => {
    if (!selectedProduct) {
      addToast("Please select a product first.", "warning");
      return;
    }
    const qty = parseFloat(quantityCase) || 0;
    if (qty <= 0) {
      addToast("Quantity must be greater than zero.", "warning");
      return;
    }

    const rate = selectedProduct.attributes?.rate || 0;
    if (rate <= 0) {
      addToast("This product does not have a valid rate in inventory. Please configure its rate in inventory first.", "error");
      return;
    }
    const caseSize = selectedProduct.attributes?.case_size || 1;
    const totalQtyLtrKg = qty * caseSize;
    const price = totalQtyLtrKg * rate;

    // Check duplicate
    if (items.some((item) => item.product_id === selectedProduct.serial_number)) {
      addToast("This product is already added to the order.", "warning");
      return;
    }

    const newItem: OrderItem = {
      product_id: selectedProduct.serial_number,
      description: selectedProduct.name,
      rate,
      quantity_case: qty,
      quantity_kg_ltr: totalQtyLtrKg,
      price,
    };

    setItems([...items, newItem]);
    setQuantityCase("");
    setSelectedProductId("");
    setSelectedProduct(null);
    addToast(`${selectedProduct.name} added to grid.`, "success");
  };

  const handleDeleteItem = (productId: string) => {
    setItems(items.filter((i) => i.product_id !== productId));
  };

  // Aggregates
  const totalAmount = items.reduce((sum, item) => sum + item.price, 0);
  const gstAmount = totalAmount * 0.18; // 18% GST standard
  const grandTotal = totalAmount + gstAmount;

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) {
      addToast("Please select a customer first.", "warning");
      return;
    }
    if (items.length === 0) {
      addToast("Order list cannot be empty.", "warning");
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        customer_name: selectedCustomer,
        aging_0_30: agingData.aging_0_30,
        aging_31_60: agingData.aging_31_60,
        aging_61_90: agingData.aging_61_90,
        aging_91_120: agingData.aging_91_120,
        aging_121_180: agingData.aging_121_180,
        aging_above_180: agingData.aging_above_180,
        items,
        total_amount: totalAmount,
        gst_amount: gstAmount,
        grand_total: grandTotal,
      };

      const res = await api.post("/api/v1/orders/", payload);
      if (res.data?.success) {
        addToast(`Order for "${selectedCustomer}" saved successfully!`, "success");
        router.push("/sales/orders");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={() => router.push("/sales/orders")} className="!p-2.5 rounded-xl">
          <FiArrowLeft className="text-sm" />
        </Button>
        <PageHeader
          title="Create Order"
          description="Register client sales orders, calculate units dynamically from wholesale cases, and track age-wise outstanding balances."
        />
      </div>

      {/* Customer Selection */}
      <div className="bg-white dark:bg-[#051422] rounded-2xl border border-slate-200/50 dark:border-[#0d2336] p-5 flex items-center justify-between gap-4">
        <div className="space-y-1 w-full max-w-sm">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">Select Customer / Client *</label>
          <select
            className="w-full rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-50/50 dark:bg-[#071929]/50 px-3.5 py-2.5 text-xs text-slate-900 dark:text-white outline-none"
            value={selectedCustomer}
            onChange={(e) => handleCustomerChange(e.target.value)}
          >
            {dbCustomers.length === 0 ? (
              <option value="">No Customers Available (Please create one first)</option>
            ) : (
              dbCustomers.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      {/* Age Wise Outstanding Block */}
      <div className="bg-white dark:bg-[#051422] rounded-2xl border border-slate-200/50 dark:border-[#0d2336] p-5 space-y-3.5">
        <p className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
          Age Wise Outstanding:
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-3.5">
          {[
            { label: "0-30 Days", val: agingData.aging_0_30 },
            { label: "31-60 Days", val: agingData.aging_31_60 },
            { label: "61-90 Days", val: agingData.aging_61_90 },
            { label: "91-120 Days", val: agingData.aging_91_120 },
            { label: "121-180 Days", val: agingData.aging_121_180 },
            { label: ">180 Days", val: agingData.aging_above_180 },
          ].map((item, idx) => (
            <div key={idx} className="p-3 bg-slate-50 dark:bg-[#071929]/20 border border-slate-200/40 rounded-xl text-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{item.label}</p>
              <p className="text-sm font-extrabold text-slate-800 dark:text-white mt-1 font-mono">
                {item.val > 0 ? `₹${item.val.toLocaleString('en-IN')}` : "₹0"}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Product Search & Selection Fields Grid */}
      <div className="bg-white dark:bg-[#051422] rounded-2xl border border-slate-200/50 dark:border-[#0d2336] p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3.5 items-end">
          
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">Select Product *</label>
            <select
              className="w-full rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-50/50 dark:bg-[#071929]/50 px-3.5 py-2.5 text-xs text-slate-900 dark:text-white outline-none"
              value={selectedProductId}
              onChange={(e) => handleProductSelect(e.target.value)}
            >
              <option value="">Choose product...</option>
              {products.map((p) => (
                <option key={p._id} value={p._id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">Product ID</label>
            <input
              type="text"
              readOnly
              className="w-full rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-100 dark:bg-slate-900 px-3.5 py-2.5 text-xs text-slate-500 font-mono outline-none"
              value={selectedProduct?.serial_number || ""}
              placeholder="Product SKU"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">Rate * (Ltr/Kg/Unit)</label>
            <input
              type="text"
              readOnly
              className="w-full rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-100 dark:bg-slate-900 px-3.5 py-2.5 text-xs text-slate-500 font-mono outline-none"
              value={selectedProduct?.attributes?.rate ? `₹${selectedProduct.attributes.rate.toFixed(2)}` : ""}
              placeholder="Rate"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">Units</label>
            <input
              type="text"
              readOnly
              className="w-full rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-100 dark:bg-slate-900 px-3.5 py-2.5 text-xs text-slate-500 font-mono outline-none"
              value={selectedProduct?.attributes?.case_size ? `${selectedProduct.attributes.case_size} ${selectedProduct.attributes.unit || "Unit"}` : ""}
              placeholder="Units per Case"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">Quantity (Case) *</label>
            <input
              type="number"
              className="w-full rounded-xl border border-slate-200 dark:border-[#0d2336] bg-white dark:bg-slate-900 px-3.5 py-2.5 text-xs text-slate-800 dark:text-white outline-none"
              value={quantityCase}
              onChange={(e) => setQuantityCase(e.target.value)}
              placeholder="Enter cases"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="text-xs font-bold text-slate-500 font-mono">
            Item Price Preview: <span className="text-slate-800 dark:text-white text-sm ml-1">
              ₹{((parseFloat(quantityCase) || 0) * (selectedProduct?.attributes?.case_size || 1) * (selectedProduct?.attributes?.rate || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>

          <Button type="button" onClick={handleAddItem} icon={<FiPlus />}>
            Add Item
          </Button>
        </div>
      </div>

      {/* running items list */}
      <div className="bg-white dark:bg-[#051422] rounded-2xl border border-slate-200/50 dark:border-[#0d2336] p-5 space-y-4">
        
        {/* Dynamic total heading */}
        <div className="flex justify-between items-center border-b border-slate-150 pb-3">
          <Button variant="outline" size="sm" type="button" icon={<FiShoppingBag />}>
            Review Grid
          </Button>
          <div className="text-xs font-bold text-slate-500">
            Total = <span className="text-primary text-sm font-extrabold font-mono ml-1">₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span> + GST
          </div>
        </div>

        {/* Table representation */}
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-[#0d2336]/50">
          <table className="w-full text-xs text-left border-collapse font-sans">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-[#0d2336] text-[10px] font-extrabold uppercase text-slate-500">
                <th className="p-3">Product ID</th>
                <th className="p-3">Description</th>
                <th className="p-3 w-40 right">Rate*(Ltr/Kg) (Exc. GST)</th>
                <th className="p-3 w-32 right">Quantity (Case)</th>
                <th className="p-3 w-40 right">Quantity (KG/LTR)</th>
                <th className="p-3 w-44 right">Price* (Exc. GST)</th>
                <th className="p-3 w-16 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150 font-semibold text-slate-700 dark:text-slate-200">
              {items.map((row) => (
                <tr key={row.product_id}>
                  <td className="p-3 font-mono text-slate-500">{row.product_id}</td>
                  <td className="p-3 text-sm font-bold text-slate-800 dark:text-white">{row.description}</td>
                  <td className="p-3 font-mono text-right">₹{row.rate.toFixed(2)}</td>
                  <td className="p-3 font-mono text-right">{row.quantity_case}</td>
                  <td className="p-3 font-mono text-right">{row.quantity_kg_ltr}</td>
                  <td className="p-3 font-mono text-right font-bold text-primary">₹{row.price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td className="p-2 text-center">
                    <button
                      type="button"
                      onClick={() => handleDeleteItem(row.product_id)}
                      className="p-1 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer border-none bg-transparent"
                    >
                      <FiTrash2 className="text-sm" />
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-400 italic text-xs">
                    No products added to order list grid.
                  </td>
                </tr>
              )}
              {/* totals */}
              {items.length > 0 && (
                <>
                  <tr className="bg-slate-50/80 dark:bg-slate-900/50 font-bold border-t border-slate-200 dark:border-[#0d2336]">
                    <td colSpan={5} className="p-3 uppercase text-right">Subtotal (Exc. GST)</td>
                    <td colSpan={2} className="p-3 font-mono text-right text-slate-800 dark:text-white">₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  </tr>
                  <tr className="bg-slate-50/80 dark:bg-slate-900/50 font-bold">
                    <td colSpan={5} className="p-3 uppercase text-right">GST (18%)</td>
                    <td colSpan={2} className="p-3 font-mono text-right text-slate-800 dark:text-white">₹{gstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  </tr>
                  <tr className="bg-slate-50/80 dark:bg-slate-900/50 font-extrabold border-t border-slate-200 dark:border-[#0d2336]">
                    <td colSpan={5} className="p-3 uppercase text-right text-primary">Grand Total (Inc. GST)</td>
                    <td colSpan={2} className="p-3 font-mono text-right text-primary text-sm font-black">₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* submit buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-[#0d2336]/30">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/sales/orders")}
          >
            Cancel
          </Button>
          <Button
            type="button"
            loading={submitting}
            onClick={handleSubmitOrder}
            icon={<FiSave />}
            disabled={items.length === 0}
          >
            Save Order
          </Button>
        </div>

      </div>

    </div>
  );
}
