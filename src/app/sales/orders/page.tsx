"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import api from "@/lib/axios";
import { useUIStore } from "@/lib/store/ui.store";
import DocumentPrintPreview from "@/components/documents/DocumentPrintPreview";

import {
  FiRefreshCw,
  FiSearch,
  FiSliders,
  FiPlus,
  FiMoreVertical,
  FiChevronLeft,
  FiChevronRight,
  FiDownload,
  FiBarChart2,
  FiX,
  FiCalendar,
  FiTrash2,
  FiMinus,
  FiPlusCircle,
  FiBox,
  FiMapPin,
  FiCamera,
  FiUpload,
  FiChevronDown,
} from "react-icons/fi";

/* =========================================================
   TYPES
========================================================= */

interface OrderItem {
  product_id: string;
  description: string;
  rate: number;
  quantity_case: number;
  quantity_kg_ltr: number;
  price: number;
  discount?: number;
  tax_rate?: number;
  tax_amount?: number;
  line_total?: number;
}

interface Order {
  _id: string;
  customer_name: string;

  company_name?: string;
  customer_type?: string;
  assigned_to?: string;
  assigned_to_name?: string;
  state?: string;
  status?: string;
  order_date?: string;
  created_at?: string;

  aging_0_30?: number;
  aging_31_60?: number;
  aging_61_90?: number;
  aging_91_120?: number;
  aging_121_180?: number;
  aging_above_180?: number;

  items: OrderItem[];

  total_amount: number;
  gst_amount: number;
  grand_total: number;

  discount_amount?: number;
  payment_status?: string;
}

type StatusFilter =
  | "All Orders"
  | "Pending Approval"
  | "Confirmed"
  | "Payment Pending"
  | "Processing"
  | "Completed";

interface FilterState {
  orderDateFrom: string;
  orderDateTo: string;
  customerType: string;
  assignedTo: string;
  status: string;
  state: string;
}

interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  available: number;
}

interface SelectedProduct {
  id: string;
  name: string;
  category: string;
  price: number;
  quantity: number;
  discount: number;
  tax: number;
}

/* =========================================================
   CONSTANTS
========================================================= */

const PAGE_SIZE = 10;

const STATUS_TABS: StatusFilter[] = [
  "All Orders",
  "Pending Approval",
  "Confirmed",
  "Payment Pending",
  "Processing",
  "Completed",
];

const CUSTOMER_TYPES = [
  "Distributor",
  "OEM",
  "End Customer",
  "Institution",
  "Corporate",
];

const COUNTRIES = ["India", "United States", "China", "Malaysia", "Indonesia"];

const STATES = [
  "Delhi",
  "Maharashtra",
  "Pune",
  "Karnataka",
  "Gujarat",
  "Punjab",
  "Tamil Nadu",
  "Kerala",
];

const STATUS_OPTIONS = ["All", "Active", "Inactive"];

const PRODUCT_CATEGORIES = [
  "All",
  "Interactive Flat Panel",
  "Active LED Display",
  "Advertising Display",
  "Kiosk",
  "Smart Display",
];

const PRODUCT_CATALOG: Product[] = [
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

/* =========================================================
   HELPERS
========================================================= */

const money = (value: number) =>
  `₹${Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 0,
  })}`;

const normalizeStatus = (status?: string) => {
  if (!status) return "Processing";

  const normalized = status.toLowerCase();

  if (normalized.includes("pending approval")) {
    return "Pending Approval";
  }

  if (normalized.includes("payment")) {
    return "Payment Pending";
  }

  if (normalized.includes("confirm")) {
    return "Confirmed";
  }

  if (normalized.includes("complete")) {
    return "Completed";
  }

  return "Processing";
};

const getOrderDate = (order: Order) =>
  order.order_date || order.created_at || new Date().toISOString();

const getAssignedTo = (order: Order) =>
  order.assigned_to_name || order.assigned_to || "Unassigned";

const getCustomerType = (order: Order) => order.customer_type || "Distributor";

const getState = (order: Order) => order.state || "Delhi";

/* =========================================================
   COMPONENT
========================================================= */

export default function OrdersListPage() {
  const { addToast } = useUIStore();

  /* =======================================================
     ORDERS LIST STATE
  ======================================================= */

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [activeTab, setActiveTab] = useState<StatusFilter>("All Orders");

  const [search, setSearch] = useState("");

  const [showFilters, setShowFilters] = useState(false);

  const [filters, setFilters] = useState<FilterState>({
    orderDateFrom: "",
    orderDateTo: "",
    customerType: "",
    assignedTo: "",
    status: "All",
    state: "All",
  });

  const [appliedFilters, setAppliedFilters] = useState<FilterState>(filters);

  const [page, setPage] = useState(1);

  const [previewOrder, setPreviewOrder] = useState<Order | null>(null);

  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);

  /* =======================================================
     NEW SALES ORDER STATE
  ======================================================= */

  const [showCreateOrder, setShowCreateOrder] = useState(false);

  const [showProductModal, setShowProductModal] = useState(false);

  const [productSearch, setProductSearch] = useState("");

  const [productCategory, setProductCategory] = useState("All");

  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>(
    [],
  );

  const [creatingOrder, setCreatingOrder] = useState(false);

  const [newOrder, setNewOrder] = useState({
    // Order Information
    salesOrderId: "",
    opportunityId: "",
    orderDate: "",
    assignedTo: "",
    salesExecutive: "",

    // Customer Information
    customerName: "",
    companyName: "",
    customerType: "",
    gst: "",
    pan: "",
    cin: "",
    registration: "",
    primaryContact: "",
    phone: "",
    email: "",
    designation: "",
    state: "",

    // Billing Address
    billingStreet: "",
    billingCountry: "",
    billingState: "",
    billingCity: "",
    billingPin: "",

    // Shipping Address
    shippingStreet: "",
    shippingCountry: "",
    shippingState: "",
    shippingCity: "",
    shippingPin: "",

    sameAsBilling: false,

    // Requirements
    remarks: "",
  });

  /* =======================================================
     FETCH ORDERS
  ======================================================= */

  const fetchOrders = useCallback(
    async (showRefresh = false) => {
      try {
        if (showRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        const res = await api.get("/api/v1/orders/");

        if (res.data?.success) {
          setOrders(res.data.data || []);
        }
      } catch (error) {
        console.error(error);

        addToast("Unable to fetch sales orders.", "error");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [addToast],
  );

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  /* =======================================================
     ASSIGNED USERS
  ======================================================= */

  const assignedUsers = useMemo(() => {
    return Array.from(new Set(orders.map(getAssignedTo).filter(Boolean)));
  }, [orders]);

  /* =======================================================
     STATUS COUNTS
  ======================================================= */

  const statusCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = {
      "All Orders": orders.length,
      "Pending Approval": 0,
      Confirmed: 0,
      "Payment Pending": 0,
      Processing: 0,
      Completed: 0,
    };

    orders.forEach((order) => {
      const status = normalizeStatus(order.status);

      if (status in counts && status !== "All Orders") {
        counts[status as StatusFilter]++;
      }
    });

    return counts;
  }, [orders]);

  /* =======================================================
     FILTER ORDERS
  ======================================================= */

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();

    return orders.filter((order) => {
      const status = normalizeStatus(order.status);

      if (activeTab !== "All Orders" && status !== activeTab) {
        return false;
      }

      if (query) {
        const searchable = `
          ${order._id}
          ${order.customer_name}
          ${order.company_name || ""}
          ${getAssignedTo(order)}
          ${getState(order)}
        `.toLowerCase();

        if (!searchable.includes(query)) {
          return false;
        }
      }

      if (
        appliedFilters.customerType &&
        getCustomerType(order) !== appliedFilters.customerType
      ) {
        return false;
      }

      if (
        appliedFilters.assignedTo &&
        getAssignedTo(order) !== appliedFilters.assignedTo
      ) {
        return false;
      }

      if (
        appliedFilters.state &&
        appliedFilters.state !== "All" &&
        getState(order) !== appliedFilters.state
      ) {
        return false;
      }

      if (appliedFilters.status && appliedFilters.status !== "All") {
        const active = appliedFilters.status === "Active";

        const isActive = status !== "Completed";

        if (active !== isActive) {
          return false;
        }
      }

      const date = new Date(getOrderDate(order));

      if (appliedFilters.orderDateFrom) {
        const from = new Date(`${appliedFilters.orderDateFrom}T00:00:00`);

        if (date < from) {
          return false;
        }
      }

      if (appliedFilters.orderDateTo) {
        const to = new Date(`${appliedFilters.orderDateTo}T23:59:59`);

        if (date > to) {
          return false;
        }
      }

      return true;
    });
  }, [orders, activeTab, search, appliedFilters]);

  /* =======================================================
     PAGINATION
  ======================================================= */

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));

  const paginatedOrders = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;

    return filteredOrders.slice(start, start + PAGE_SIZE);
  }, [filteredOrders, page]);

  useEffect(() => {
    setPage(1);
  }, [search, activeTab, appliedFilters]);

  /* =======================================================
     KPI
  ======================================================= */

  const kpis = useMemo(() => {
    const totalProposal = orders.length;

    const orderValue = orders.reduce(
      (sum, order) => sum + Number(order.grand_total || 0),
      0,
    );

    const pendingOrders = orders.filter((order) => {
      const status = normalizeStatus(order.status);

      return status === "Pending Approval" || status === "Payment Pending";
    }).length;

    const completedOrders = orders.filter(
      (order) => normalizeStatus(order.status) === "Completed",
    ).length;

    return {
      totalProposal,
      orderValue,
      pendingOrders,
      completedOrders,
    };
  }, [orders]);

  /* =======================================================
     FILTER ACTIONS
  ======================================================= */

  const applyFilters = () => {
    setAppliedFilters(filters);
    setShowFilters(false);
  };

  const clearFilters = () => {
    const empty: FilterState = {
      orderDateFrom: "",
      orderDateTo: "",
      customerType: "",
      assignedTo: "",
      status: "All",
      state: "All",
    };

    setFilters(empty);
    setAppliedFilters(empty);
    setShowFilters(false);
  };

  /* =======================================================
     EXPORT
  ======================================================= */

  const exportData = () => {
    if (!filteredOrders.length) {
      addToast("No order data available to export.", "warning");

      return;
    }

    const headers = [
      "Order ID",
      "Customer Name",
      "Company",
      "Order Value",
      "Assigned To",
      "Order Date",
      "Status",
      "Customer Type",
      "State",
    ];

    const rows = filteredOrders.map((order) => [
      order._id,
      order.customer_name,
      order.company_name || "",
      order.grand_total,
      getAssignedTo(order),
      new Date(getOrderDate(order)).toLocaleDateString("en-IN"),
      normalizeStatus(order.status),
      getCustomerType(order),
      getState(order),
    ]);

    const csv = [
      headers.join(","),
      ...rows.map((row) =>
        row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","),
      ),
    ].join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;
    link.download = "sales-orders.csv";

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);

    setHeaderMenuOpen(false);

    addToast("Sales order data exported successfully.", "success");
  };

  /* =======================================================
     DOWNLOAD CHART
  ======================================================= */

  const downloadChart = () => {
    const width = 900;
    const height = 500;

    const values = [
      statusCounts["Pending Approval"],
      statusCounts["Confirmed"],
      statusCounts["Payment Pending"],
      statusCounts["Processing"],
      statusCounts["Completed"],
    ];

    const labels = [
      "Pending Approval",
      "Confirmed",
      "Payment Pending",
      "Processing",
      "Completed",
    ];

    const max = Math.max(...values, 1);

    const bars = values
      .map((value, index) => {
        const barWidth = 100;

        const barHeight = (value / max) * 280;

        const x = 100 + index * 145;

        const y = 360 - barHeight;

        return `
          <rect
            x="${x}"
            y="${y}"
            width="${barWidth}"
            height="${barHeight}"
            rx="6"
            fill="#24395f"
          />

          <text
            x="${x + 50}"
            y="${y - 10}"
            text-anchor="middle"
            font-size="16"
            fill="#1e293b"
          >
            ${value}
          </text>

          <text
            x="${x + 50}"
            y="390"
            text-anchor="middle"
            font-size="12"
            fill="#64748b"
          >
            ${labels[index]}
          </text>
        `;
      })
      .join("");

    const svg = `
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="${width}"
        height="${height}"
      >
        <rect
          width="100%"
          height="100%"
          fill="white"
        />

        <text
          x="60"
          y="55"
          font-size="24"
          font-weight="700"
          fill="#0f172a"
        >
          Sales Order Status
        </text>

        <line
          x1="70"
          y1="360"
          x2="850"
          y2="360"
          stroke="#cbd5e1"
        />

        ${bars}
      </svg>
    `;

    const blob = new Blob([svg], {
      type: "image/svg+xml;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;
    link.download = "sales-order-chart.svg";

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);

    setHeaderMenuOpen(false);

    addToast("Sales order chart downloaded.", "success");
  };

  /* =======================================================
     FORMATTERS
  ======================================================= */

  const formatDate = (value: string) => {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "-";
    }

    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case "Completed":
        return "bg-emerald-50 text-emerald-600";

      case "Confirmed":
        return "bg-blue-50 text-blue-600";

      case "Pending Approval":
        return "bg-rose-50 text-rose-600";

      case "Payment Pending":
        return "bg-rose-50 text-rose-600";

      default:
        return "bg-amber-50 text-amber-600";
    }
  };

  /* =======================================================
     CREATE ORDER HELPERS
  ======================================================= */

  const updateNewOrder = (
    field: keyof typeof newOrder,
    value: string | boolean,
  ) => {
    setNewOrder((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const openCreateOrder = () => {
    const now = new Date();

    setNewOrder((current) => ({
      ...current,
      salesOrderId: `SO-${String(Date.now()).slice(-4)}`,
      orderDate: now.toISOString(),
    }));

    setShowCreateOrder(true);
    setShowFilters(false);
    setSelectedProducts([]);
  };

  const closeCreateOrder = () => {
    setShowCreateOrder(false);
    setShowProductModal(false);
    setSelectedProducts([]);
  };

  /* =======================================================
     PRODUCT MODAL
  ======================================================= */

  const filteredProducts = useMemo(() => {
    const query = productSearch.trim().toLowerCase();

    return PRODUCT_CATALOG.filter((product) => {
      const matchesCategory =
        productCategory === "All" || product.category === productCategory;

      const matchesSearch =
        !query || product.name.toLowerCase().includes(query);

      return matchesCategory && matchesSearch;
    });
  }, [productSearch, productCategory]);

  const toggleProduct = (product: Product) => {
    setSelectedProducts((current) => {
      const exists = current.some((item) => item.id === product.id);

      if (exists) {
        return current.filter((item) => item.id !== product.id);
      }

      return [
        ...current,
        {
          id: product.id,
          name: product.name,
          category: product.category,
          price: product.price,
          quantity: 1,
          discount: 0,
          tax: 18,
        },
      ];
    });
  };

  const updateSelectedProduct = (
    id: string,
    field: "quantity" | "discount" | "tax",
    value: number,
  ) => {
    setSelectedProducts((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              [field]: Math.max(0, value),
            }
          : item,
      ),
    );
  };

  const removeSelectedProduct = (id: string) => {
    setSelectedProducts((current) => current.filter((item) => item.id !== id));
  };

  const selectedProductsTotal = selectedProducts.reduce((sum, item) => {
    const subtotal = item.price * item.quantity;

    const discount = subtotal * (item.discount / 100);

    const taxable = subtotal - discount;

    const tax = taxable * (item.tax / 100);

    return sum + taxable + tax;
  }, 0);

  /* =======================================================
     CREATE SALES ORDER
  ======================================================= */

  const createSalesOrder = async (asDraft = false) => {
    if (!newOrder.customerName.trim()) {
      addToast("Please enter customer name.", "warning");

      return;
    }

    if (selectedProducts.length === 0) {
      addToast("Please add at least one product.", "warning");

      return;
    }

    try {
      setCreatingOrder(true);

      const subtotal = selectedProducts.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0,
      );

      const discountAmount = selectedProducts.reduce((sum, item) => {
        const line = item.price * item.quantity;

        return sum + line * (item.discount / 100);
      }, 0);

      const taxableAmount = subtotal - discountAmount;

      const gstAmount = selectedProducts.reduce((sum, item) => {
        const line = item.price * item.quantity;

        const discounted = line - line * (item.discount / 100);

        return sum + discounted * (item.tax / 100);
      }, 0);

      const grandTotal = taxableAmount + gstAmount;

      const payload = {
        customer_name: newOrder.customerName,

        company_name: newOrder.companyName,

        customer_type: newOrder.customerType,

        assigned_to: newOrder.assignedTo,

        sales_executive: newOrder.salesExecutive,

        opportunity_id: newOrder.opportunityId,

        sales_order_id: newOrder.salesOrderId,

        state: newOrder.state || newOrder.billingState,

        order_date: newOrder.orderDate || new Date().toISOString(),

        status: asDraft ? "Pending Approval" : "Processing",

        items: selectedProducts.map((item) => ({
          product_id: item.id,
          description: item.name,
          rate: item.price,
          quantity_case: item.quantity,
          quantity_kg_ltr: 0,
          price: item.price,
          discount: item.discount,
          tax_rate: item.tax,
        })),

        total_amount: subtotal,

        gst_amount: gstAmount,

        grand_total: grandTotal,

        discount_amount: discountAmount,

        payment_status: "Pending",

        remarks: newOrder.remarks,

        customer_information: {
          customer_name: newOrder.customerName,
          organization_name: newOrder.companyName,
          customer_type: newOrder.customerType,
          gst: newOrder.gst,
          pan: newOrder.pan,
          cin: newOrder.cin,
          registration: newOrder.registration,

          primary_contact: {
            name: newOrder.customerName,
            designation: newOrder.designation,
            phone: newOrder.phone,
            email: newOrder.email,
          },
        },

        billing_address: {
          street: newOrder.billingStreet,
          country: newOrder.billingCountry,
          state: newOrder.billingState,
          city: newOrder.billingCity,
          pin: newOrder.billingPin,
        },

        shipping_address: {
          street: newOrder.shippingStreet,
          country: newOrder.shippingCountry,
          state: newOrder.shippingState,
          city: newOrder.shippingCity,
          pin: newOrder.shippingPin,
        },
      };

      const res = await api.post("/api/v1/orders/", payload);

      if (res.data?.success) {
        addToast(
          asDraft
            ? "Sales order saved as draft."
            : "Sales order created successfully.",
          "success",
        );

        setShowCreateOrder(false);

        setSelectedProducts([]);

        setNewOrder({
          salesOrderId: "",
          opportunityId: "",
          orderDate: "",
          assignedTo: "",
          salesExecutive: "",

          customerName: "",
          companyName: "",
          customerType: "",
          gst: "",
          pan: "",
          cin: "",
          registration: "",
          primaryContact: "",
          phone: "",
          email: "",
          designation: "",
          state: "",

          billingStreet: "",
          billingCountry: "",
          billingState: "",
          billingCity: "",
          billingPin: "",

          shippingStreet: "",
          shippingCountry: "",
          shippingState: "",
          shippingCity: "",
          shippingPin: "",

          sameAsBilling: false,
          remarks: "",
        });
        await fetchOrders(true);
      }
    } catch (error) {
      console.error(error);

      addToast("Unable to create sales order.", "error");
    } finally {
      setCreatingOrder(false);
    }
  };

  const formatOrderDisplayDate = (value: string) => {
    if (!value) return "-";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "-";
    }

    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const assignedUserDisplay = newOrder.assignedTo.trim() || "Not Assigned";

  const salesExecutiveDisplay =
    newOrder.salesExecutive.trim() ||
    newOrder.assignedTo.trim() ||
    "Not Assigned";

  const orderSubtotal = selectedProducts.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );

  const orderDiscount = selectedProducts.reduce(
    (sum, item) => sum + item.price * item.quantity * (item.discount / 100),
    0,
  );

  const orderTaxableAmount = orderSubtotal - orderDiscount;

  const orderGst = selectedProducts.reduce((sum, item) => {
    const line = item.price * item.quantity;
    const discount = line * (item.discount / 100);
    const taxable = line - discount;

    return sum + taxable * (item.tax / 100);
  }, 0);

  const orderGrandTotal = orderTaxableAmount + orderGst;

  /* =======================================================
     NEW SALES ORDER UI
  ======================================================= */

  if (showCreateOrder) {
    return (
      <div className="min-h-full bg-[#f5f5f5] -m-5 pb-20">
        {/* =================================================
          PAGE HEADER
      ================================================= */}

        <div className="px-5 pt-2 pb-4">
          <h1 className="text-lg font-semibold text-slate-800">
            New Sales Order
          </h1>

          <div className="flex items-center gap-2 mt-1">
            <span className="text-[11px] text-slate-500">Sales Order</span>

            <span className="text-[11px] text-slate-400">›</span>

            <span className="text-[11px] text-slate-500">New</span>
          </div>
        </div>

        {/* =================================================
          MAIN GRID
      ================================================= */}

        <div className="px-5">
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-3">
            {/* =================================================
              LEFT CONTENT
          ================================================= */}

            <div className="bg-white rounded-xl p-5">
              {/* =================================================
                      ORDER INFORMATION
                  ================================================= */}

              <div>
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
                  <div className="w-5 h-5 rounded-full border border-slate-500 flex items-center justify-center">
                    <span className="text-[10px] font-semibold text-slate-600">
                      i
                    </span>
                  </div>

                  <h3 className="text-sm font-semibold text-slate-700">
                    Order Information
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-4">
                  {/* =================================================
                          ROW 1 - SALES ORDER ID
                      ================================================= */}

                  <div className="flex items-center">
                    <span className="w-[110px] text-[11px] text-slate-500">
                      Sales Order ID:
                    </span>

                    <span className="text-[11px] font-semibold text-slate-800">
                      {newOrder.salesOrderId || "-"}
                    </span>
                  </div>

                  {/* =================================================
                          ROW 1 - OPPORTUNITY ID
                      ================================================= */}

                  <div className="flex items-center">
                    <span className="w-[110px] text-[11px] text-slate-500">
                      Opportunity ID:
                    </span>

                    <input
                      value={newOrder.opportunityId}
                      onChange={(e) =>
                        updateNewOrder("opportunityId", e.target.value)
                      }
                      placeholder="#LD-9021"
                      className="h-7 w-[150px] rounded-md border border-slate-200 px-2 text-[11px] text-slate-700 outline-none focus:border-slate-400"
                    />
                  </div>

                  {/* =================================================
                          ROW 2 - ORDER DATE
                      ================================================= */}

                  <div className="flex items-center">
                    <span className="w-[110px] text-[11px] text-slate-500">
                      Order Date:
                    </span>

                    <span className="text-[11px] font-semibold text-slate-800">
                      {formatOrderDisplayDate(newOrder.orderDate)}
                    </span>
                  </div>

                  {/* =================================================
                      ROW 2 - EMPTY COLUMN
                      ================================================= */}

                  <div />

                  {/* =================================================
                          ROW 3 - ASSIGNED TO
                      ================================================= */}

                  <div className="flex items-center">
                    <span className="w-[110px] text-[11px] text-slate-500">
                      Assigned To:
                    </span>

                    <div className="flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[8px] text-slate-600">
                        {assignedUserDisplay.charAt(0).toUpperCase()}
                      </span>

                      <input
                        value={newOrder.assignedTo}
                        onChange={(e) =>
                          updateNewOrder("assignedTo", e.target.value)
                        }
                        placeholder="Rohit S."
                        className="h-7 w-[100px] rounded-md border border-slate-200 px-2 text-[11px] text-slate-700 outline-none focus:border-slate-400"
                      />
                    </div>
                  </div>

                  {/* =================================================
                          ROW 3 - SALES EXECUTIVE
                      ================================================= */}

                  <div className="flex items-center">
                    <span className="w-[110px] text-[11px] text-slate-500">
                      Sales Executive:
                    </span>

                    <div className="flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[8px] text-slate-600">
                        {salesExecutiveDisplay.charAt(0).toUpperCase()}
                      </span>

                      <input
                        value={newOrder.salesExecutive}
                        onChange={(e) =>
                          updateNewOrder("salesExecutive", e.target.value)
                        }
                        placeholder="Rohit S."
                        className="h-7 w-[100px] rounded-md border border-slate-200 px-2 text-[11px] text-slate-700 outline-none focus:border-slate-400"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* =================================================
                CUSTOMER INFORMATION
            ================================================= */}

              <div className="border-t border-slate-100 mt-6 pt-5">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
                  <div className="w-5 h-5 rounded-full border border-slate-500 flex items-center justify-center">
                    <span className="text-[10px] font-semibold text-slate-600">
                      i
                    </span>
                  </div>

                  <h3 className="text-sm font-semibold text-slate-700">
                    Customer Information
                  </h3>
                </div>

                {/* Customer Details */}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-3">
                  {/* Customer Type */}

                  <div className="flex items-center">
                    <span className="w-[110px] text-[11px] text-slate-500">
                      Customer Type:
                    </span>

                    <select
                      value={newOrder.customerType}
                      onChange={(e) =>
                        updateNewOrder("customerType", e.target.value)
                      }
                      className="h-7 flex-1 max-w-[190px] rounded-md border border-slate-200 bg-white px-2 text-[11px] text-slate-700 outline-none"
                    >
                      <option value="">Select type</option>

                      {CUSTOMER_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Organization */}

                  <div className="flex items-center">
                    <span className="w-[110px] text-[11px] text-slate-500">
                      Organization Name:
                    </span>

                    <input
                      value={newOrder.companyName}
                      onChange={(e) =>
                        updateNewOrder("companyName", e.target.value)
                      }
                      placeholder="Organization name"
                      className="h-7 flex-1 max-w-[190px] rounded-md border border-slate-200 px-2 text-[11px] outline-none focus:border-slate-400"
                    />
                  </div>

                  {/* GST */}

                  <div className="flex items-center">
                    <span className="w-[110px] text-[11px] text-slate-500">
                      GST:
                    </span>

                    <input
                      value={newOrder.gst}
                      onChange={(e) => updateNewOrder("gst", e.target.value)}
                      placeholder="GST number"
                      className="h-7 flex-1 max-w-[190px] rounded-md border border-slate-200 px-2 text-[11px] outline-none focus:border-slate-400"
                    />
                  </div>

                  {/* PAN */}

                  <div className="flex items-center">
                    <span className="w-[110px] text-[11px] text-slate-500">
                      PAN:
                    </span>

                    <input
                      value={newOrder.pan}
                      onChange={(e) => updateNewOrder("pan", e.target.value)}
                      placeholder="PAN number"
                      className="h-7 flex-1 max-w-[190px] rounded-md border border-slate-200 px-2 text-[11px] outline-none focus:border-slate-400"
                    />
                  </div>

                  {/* CIN */}

                  <div className="flex items-center">
                    <span className="w-[110px] text-[11px] text-slate-500">
                      COI Number:
                    </span>

                    <input
                      value={newOrder.cin}
                      onChange={(e) => updateNewOrder("cin", e.target.value)}
                      placeholder="COI number"
                      className="h-7 flex-1 max-w-[190px] rounded-md border border-slate-200 px-2 text-[11px] outline-none focus:border-slate-400"
                    />
                  </div>

                  {/* Registration */}

                  <div className="flex items-center">
                    <span className="w-[110px] text-[11px] text-slate-500">
                      Registration:
                    </span>

                    <select
                      value={newOrder.registration}
                      onChange={(e) =>
                        updateNewOrder("registration", e.target.value)
                      }
                      className="h-7 flex-1 max-w-[190px] rounded-md border border-slate-200 bg-white px-2 text-[11px] text-slate-700 outline-none"
                    >
                      <option value="">Select</option>
                      <option value="Registered">Registered</option>
                      <option value="Unregistered">Unregistered</option>
                    </select>
                  </div>
                </div>

                {/* =================================================
                  PRIMARY CONTACT
              ================================================= */}

                <div className="mt-5">
                  <h4 className="text-xs font-semibold text-slate-600 border-b border-slate-100 pb-2 mb-3">
                    Primary Contact
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-3">
                    {/* Customer */}

                    <div className="flex items-center">
                      <span className="w-[110px] text-[11px] text-slate-500">
                        Customer:
                      </span>

                      <input
                        value={newOrder.customerName}
                        onChange={(e) =>
                          updateNewOrder("customerName", e.target.value)
                        }
                        placeholder="Customer name"
                        className="h-7 flex-1 max-w-[190px] rounded-md border border-slate-200 px-2 text-[11px] outline-none focus:border-slate-400"
                      />
                    </div>

                    {/* Designation */}

                    <div className="flex items-center">
                      <span className="w-[110px] text-[11px] text-slate-500">
                        Designation:
                      </span>

                      <input
                        value={newOrder.designation}
                        onChange={(e) =>
                          updateNewOrder("designation", e.target.value)
                        }
                        placeholder="Designation"
                        className="h-7 flex-1 max-w-[190px] rounded-md border border-slate-200 px-2 text-[11px] outline-none focus:border-slate-400"
                      />
                    </div>

                    {/* Phone */}

                    <div className="flex items-center">
                      <span className="w-[110px] text-[11px] text-slate-500">
                        Phone:
                      </span>

                      <input
                        value={newOrder.phone}
                        onChange={(e) =>
                          updateNewOrder("phone", e.target.value)
                        }
                        placeholder="+91"
                        className="h-7 flex-1 max-w-[190px] rounded-md border border-slate-200 px-2 text-[11px] outline-none focus:border-slate-400"
                      />
                    </div>

                    {/* Email */}

                    <div className="flex items-center">
                      <span className="w-[110px] text-[11px] text-slate-500">
                        Email:
                      </span>

                      <input
                        type="email"
                        value={newOrder.email}
                        onChange={(e) =>
                          updateNewOrder("email", e.target.value)
                        }
                        placeholder="customer@email.com"
                        className="h-7 flex-1 max-w-[190px] rounded-md border border-slate-200 px-2 text-[11px] outline-none focus:border-slate-400"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* =================================================
                BILLING & SHIPPING
            ================================================= */}

              <div className="border-t border-slate-100 mt-6 pt-5">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
                  <FiMapPin size={16} className="text-slate-600" />

                  <h3 className="text-sm font-semibold text-slate-700">
                    Billing & Shipping
                  </h3>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {/* =================================================
                    BILLING
                ================================================= */}

                  <div>
                    <div className="flex items-center border-b border-slate-100 pb-2 mb-4">
                      <h4 className="text-xs font-semibold text-slate-600">
                        Billing Address
                      </h4>
                    </div>

                    <label className="block text-[11px] text-slate-500 mb-1.5">
                      Street Address *
                    </label>

                    <input
                      value={newOrder.billingStreet}
                      onChange={(e) =>
                        updateNewOrder("billingStreet", e.target.value)
                      }
                      placeholder="Street Address, Building, Suite"
                      className="w-full h-10 rounded-md border border-slate-200 px-3 text-xs outline-none focus:border-slate-400"
                    />

                    <div className="grid grid-cols-2 gap-3 mt-4">
                      <div>
                        <label className="block text-[11px] text-slate-500 mb-1.5">
                          Country *
                        </label>

                        <select
                          value={newOrder.billingCountry}
                          onChange={(e) =>
                            updateNewOrder("billingCountry", e.target.value)
                          }
                          className="w-full h-10 rounded-md border border-slate-200 px-3 text-xs bg-white outline-none"
                        >
                          <option value="">Select here</option>

                          {COUNTRIES.map((country) => (
                            <option key={country} value={country}>
                              {country}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* State / Province */}
                      <div>
                        <label className="block text-[11px] text-slate-500 mb-1.5">
                          State / Province *
                        </label>

                        <input
                          value={newOrder.billingState}
                          onChange={(e) =>
                            updateNewOrder("billingState", e.target.value)
                          }
                          placeholder="State"
                          className="w-full h-10 rounded-md border border-slate-200 px-3 text-xs outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-4">
                      <div>
                        <label className="block text-[11px] text-slate-500 mb-1.5">
                          City *
                        </label>

                        <input
                          value={newOrder.billingCity}
                          onChange={(e) =>
                            updateNewOrder("billingCity", e.target.value)
                          }
                          placeholder="Type or select"
                          className="w-full h-10 rounded-md border border-slate-200 px-3 text-xs outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] text-slate-500 mb-1.5">
                          PIN / ZIP Code *
                        </label>

                        <input
                          value={newOrder.billingPin}
                          onChange={(e) =>
                            updateNewOrder("billingPin", e.target.value)
                          }
                          placeholder="Pin Code"
                          className="w-full h-10 rounded-md border border-slate-200 px-3 text-xs outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* =================================================
                    SHIPPING
                ================================================= */}

                  <div>
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-4">
                      <h4 className="text-xs font-semibold text-slate-600">
                        Shipping Address
                      </h4>

                      <label className="flex items-center gap-2 text-[11px] text-slate-600">
                        <input
                          type="checkbox"
                          checked={newOrder.sameAsBilling}
                          onChange={(e) => {
                            const checked = e.target.checked;

                            setNewOrder((current) => ({
                              ...current,
                              sameAsBilling: checked,
                              shippingStreet: checked
                                ? current.billingStreet
                                : current.shippingStreet,
                              shippingCountry: checked
                                ? current.billingCountry
                                : current.shippingCountry,
                              shippingState: checked
                                ? current.billingState
                                : current.shippingState,
                              shippingCity: checked
                                ? current.billingCity
                                : current.shippingCity,
                              shippingPin: checked
                                ? current.billingPin
                                : current.shippingPin,
                            }));
                          }}
                          className="rounded"
                        />
                        Same as Billing
                      </label>
                    </div>

                    <label className="block text-[11px] text-slate-500 mb-1.5">
                      Street Address *
                    </label>

                    <input
                      value={newOrder.shippingStreet}
                      onChange={(e) =>
                        updateNewOrder("shippingStreet", e.target.value)
                      }
                      placeholder="Street Address, Building, Suite"
                      className="w-full h-10 rounded-md border border-slate-200 px-3 text-xs outline-none"
                    />

                    <div className="grid grid-cols-2 gap-3 mt-4">
                      <div>
                        <label className="block text-[11px] text-slate-500 mb-1.5">
                          Country *
                        </label>

                        <select
                          value={newOrder.shippingCountry}
                          onChange={(e) =>
                            updateNewOrder("shippingCountry", e.target.value)
                          }
                          className="w-full h-10 rounded-md border border-slate-200 px-3 text-xs bg-white outline-none"
                        >
                          <option value="">Select here</option>

                          {COUNTRIES.map((country) => (
                            <option key={country} value={country}>
                              {country}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* State / Province */}
                      <div>
                        <label className="block text-[11px] text-slate-500 mb-1.5">
                          State / Province *
                        </label>

                        <input
                          value={newOrder.shippingState}
                          onChange={(e) =>
                            updateNewOrder("shippingState", e.target.value)
                          }
                          placeholder="State"
                          className="w-full h-10 rounded-md border border-slate-200 px-3 text-xs outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-4">
                      <div>
                        <label className="block text-[11px] text-slate-500 mb-1.5">
                          City *
                        </label>

                        <input
                          value={newOrder.shippingCity}
                          onChange={(e) =>
                            updateNewOrder("shippingCity", e.target.value)
                          }
                          placeholder="Type or select"
                          className="w-full h-10 rounded-md border border-slate-200 px-3 text-xs outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] text-slate-500 mb-1.5">
                          PIN / ZIP Code *
                        </label>

                        <input
                          value={newOrder.shippingPin}
                          onChange={(e) =>
                            updateNewOrder("shippingPin", e.target.value)
                          }
                          placeholder="Pin Code"
                          className="w-full h-10 rounded-md border border-slate-200 px-3 text-xs outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* =================================================
                PRODUCTS & ORDER ITEMS
            ================================================= */}

              <div className="border-t border-slate-100 mt-6 pt-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <FiMapPin size={16} className="text-slate-600" />

                    <h3 className="text-sm font-semibold text-slate-700">
                      Products & Order Items
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowProductModal(true)}
                    className="h-9 px-4 rounded-md bg-[#24395f] text-white text-xs font-semibold flex items-center gap-2 hover:bg-[#1d304f]"
                  >
                    <FiPlus size={15} />
                    Add Product
                  </button>
                </div>

                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-white border-b border-slate-200">
                        <th className="px-3 py-3 text-[11px] font-medium text-slate-500">
                          Product
                        </th>

                        <th className="px-3 py-3 text-[11px] font-medium text-slate-500">
                          Model / Variant
                        </th>

                        <th className="px-3 py-3 text-[11px] font-medium text-slate-500">
                          Qty
                        </th>

                        <th className="px-3 py-3 text-[11px] font-medium text-slate-500">
                          Unit Price
                        </th>

                        <th className="px-3 py-3 text-[11px] font-medium text-slate-500">
                          Discount
                        </th>

                        <th className="px-3 py-3 text-[11px] font-medium text-slate-500">
                          Tax
                        </th>

                        <th className="px-3 py-3 text-[11px] font-medium text-slate-500">
                          Actions
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {selectedProducts.length === 0 ? (
                        <tr>
                          <td
                            colSpan={7}
                            className="py-12 text-center text-xs text-slate-400"
                          >
                            No products added. Click{" "}
                            <button
                              type="button"
                              onClick={() => setShowProductModal(true)}
                              className="text-[#24395f] font-semibold"
                            >
                              Add Product
                            </button>{" "}
                            to get started.
                          </td>
                        </tr>
                      ) : (
                        selectedProducts.map((item) => (
                          <tr
                            key={item.id}
                            className="border-b border-slate-100"
                          >
                            <td className="px-3 py-3">
                              <select className="h-9 rounded-md border border-slate-200 px-2 text-[11px] bg-white">
                                <option>{item.category}</option>
                              </select>
                            </td>

                            <td className="px-3 py-3 text-[10px] text-slate-600 max-w-[150px]">
                              {item.name}
                            </td>

                            <td className="px-3 py-3">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateSelectedProduct(
                                      item.id,
                                      "quantity",
                                      item.quantity - 1,
                                    )
                                  }
                                  className="w-6 h-6 rounded border border-slate-200 flex items-center justify-center"
                                >
                                  <FiMinus size={11} />
                                </button>

                                <span className="text-xs min-w-4 text-center">
                                  {item.quantity}
                                </span>

                                <button
                                  type="button"
                                  onClick={() =>
                                    updateSelectedProduct(
                                      item.id,
                                      "quantity",
                                      item.quantity + 1,
                                    )
                                  }
                                  className="w-6 h-6 rounded border border-slate-200 flex items-center justify-center"
                                >
                                  <FiPlus size={11} />
                                </button>
                              </div>
                            </td>

                            <td className="px-3 py-3 text-xs text-slate-700">
                              {money(item.price)}
                            </td>

                            <td className="px-3 py-3">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={item.discount}
                                onChange={(e) =>
                                  updateSelectedProduct(
                                    item.id,
                                    "discount",
                                    Number(e.target.value),
                                  )
                                }
                                className="w-16 h-8 rounded-md border border-slate-200 px-2 text-xs"
                              />
                            </td>

                            <td className="px-3 py-3">
                              <span className="text-[10px]">{item.tax}%</span>
                            </td>

                            <td className="px-3 py-3">
                              <button
                                type="button"
                                onClick={() => removeSelectedProduct(item.id)}
                                className="text-rose-500 hover:text-rose-600"
                              >
                                <FiTrash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* =================================================
              RIGHT SIDEBAR
          ================================================= */}

            <div className="space-y-3">
              {/* =================================================
                ORDER SUMMARY
            ================================================= */}

              <div className="bg-white rounded-xl p-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
                  <FiCamera size={16} className="text-slate-600" />

                  <h3 className="text-sm font-semibold text-slate-700">
                    Order Summary
                  </h3>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">
                      Subtotal (Products)
                    </span>

                    <span className="text-xs font-semibold text-slate-800">
                      {money(orderSubtotal)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">
                      Total Discount
                    </span>

                    <span className="text-xs font-semibold text-rose-500">
                      -{money(orderDiscount)}
                    </span>
                  </div>

                  {/* ORC */}

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">ORC</span>

                    <input
                      type="number"
                      min="0"
                      className="w-24 h-7 rounded-md border border-slate-200 px-2 text-right text-xs outline-none"
                      defaultValue={0}
                    />
                  </div>

                  {/* Freight */}

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">
                      Freight Charges
                    </span>

                    <input
                      type="number"
                      min="0"
                      className="w-24 h-7 rounded-md border border-slate-200 px-2 text-right text-xs outline-none"
                      defaultValue={0}
                    />
                  </div>

                  {/* Lump Sum */}

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">
                      Lumpsum (Installation)
                    </span>

                    <input
                      type="number"
                      min="0"
                      className="w-24 h-7 rounded-md border border-slate-200 px-2 text-right text-xs outline-none"
                      defaultValue={0}
                    />
                  </div>

                  <div className="border-t border-slate-100 pt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">
                        Taxable Amount
                      </span>

                      <span className="text-xs font-semibold text-slate-800">
                        {money(orderTaxableAmount)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between mt-3">
                      <span className="text-xs text-slate-500">
                        Estimated GST (18%)
                      </span>

                      <span className="text-xs font-semibold text-slate-800">
                        {money(orderGst)}
                      </span>
                    </div>
                  </div>

                  {/* Grand Total */}

                  <div className="mt-1 rounded-lg bg-slate-100 border-b border-[#24395f] px-3 py-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-700">
                        Grand Total
                      </span>

                      <span className="text-sm font-bold text-slate-800">
                        {money(orderGrandTotal)}
                      </span>
                    </div>
                  </div>

                  {/* Commission */}

                  <div className="pt-1 flex items-center justify-between">
                    <span className="text-xs text-slate-500">
                      Estimated Commission
                    </span>

                    <span className="text-xs font-semibold text-slate-800">
                      ₹0
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">
                      Advance Received
                    </span>

                    <span className="text-xs font-semibold text-emerald-500">
                      ₹0
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">
                      Outstanding Balance
                    </span>

                    <span className="text-xs font-semibold text-amber-500">
                      {money(orderGrandTotal)}
                    </span>
                  </div>
                </div>
              </div>

              {/* =================================================
                REQUIREMENTS & FILES
            ================================================= */}

              <div className="bg-white rounded-xl p-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
                  <FiUpload size={16} className="text-slate-600" />

                  <h3 className="text-sm font-semibold text-slate-700">
                    Requirements & Files
                  </h3>
                </div>

                {/* Remarks */}

                <label className="block text-[11px] text-slate-500 mb-1.5">
                  Remarks
                </label>

                <textarea
                  value={newOrder.remarks}
                  onChange={(e) => updateNewOrder("remarks", e.target.value)}
                  placeholder="Enter specific hardware requirements or customization requests..."
                  className="w-full h-28 rounded-xl border border-slate-300 bg-white p-3 text-xs resize-none outline-none focus:border-slate-400"
                />

                {/* Attachments */}

                <div className="mt-5">
                  <p className="text-[11px] font-medium text-slate-500 mb-2">
                    Attachments
                  </p>

                  <button
                    type="button"
                    className="w-full h-28 rounded-xl border border-dashed border-slate-300 flex flex-col items-center justify-center text-center hover:bg-slate-50 transition-colors"
                  >
                    <FiUpload size={18} className="text-slate-400 mb-2" />

                    <p className="text-[11px] text-slate-500">
                      Drop files or click to upload
                    </p>

                    <p className="text-[9px] text-slate-400 mt-1">
                      PDF, DOC, XLS up to 10MB
                    </p>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* =================================================
          FIXED FOOTER
      ================================================= */}

        <div className="fixed bottom-0 left-0 right-0 z-40 h-16 bg-[#f8f8f8] border-t border-slate-200 flex items-center justify-end gap-2 px-5">
          <button
            type="button"
            onClick={closeCreateOrder}
            className="h-9 px-4 rounded-md border border-slate-300 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={creatingOrder}
            onClick={() => createSalesOrder(true)}
            className="h-9 px-4 rounded-md border border-slate-300 bg-white text-xs font-medium text-slate-700 disabled:opacity-50"
          >
            Save as Draft
          </button>

          <button
            type="button"
            disabled={creatingOrder}
            onClick={() => createSalesOrder(false)}
            className="h-9 px-4 rounded-md bg-[#24395f] text-white text-xs font-semibold disabled:opacity-50"
          >
            {creatingOrder ? "Creating..." : "Create Sales Order"}
          </button>
        </div>

        {/* =================================================
          ADD PRODUCT MODAL
      ================================================= */}

        {showProductModal && (
          <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-5">
            <div className="w-full max-w-[780px] h-[590px] rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col">
              {/* Modal Header */}

              <div className="h-14 flex items-center justify-between px-5 border-b border-slate-200">
                <h2 className="text-sm font-semibold text-slate-800">
                  Add Products to Order
                </h2>

                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="text-slate-400 hover:text-slate-700"
                >
                  <FiX size={17} />
                </button>
              </div>

              {/* Search */}

              <div className="px-5 pt-4">
                <div className="relative">
                  <input
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Search by product name, model or SKU..."
                    className="w-full h-10 rounded-md border border-slate-300 px-3 pr-10 text-xs outline-none focus:border-slate-400"
                  />

                  <FiSearch
                    size={15}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600"
                  />
                </div>
              </div>

              {/* Category Tabs */}

              <div className="px-5 pt-3">
                <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto">
                  {PRODUCT_CATEGORIES.map((category) => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setProductCategory(category)}
                      className={`
                        whitespace-nowrap
                        px-3
                        py-2
                        text-[10px]
                        font-medium
                        ${
                          productCategory === category
                            ? "bg-[#24395f] text-white rounded-t-md"
                            : "text-slate-600 hover:bg-slate-50"
                        }
                      `}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>

              {/* Modal Body */}

              <div className="flex-1 grid grid-cols-2 gap-5 px-5 py-4 overflow-hidden">
                {/* Products */}

                <div className="overflow-y-auto pr-1">
                  <div className="space-y-2">
                    {filteredProducts.map((product) => {
                      const checked = selectedProducts.some(
                        (item) => item.id === product.id,
                      );

                      return (
                        <button
                          type="button"
                          key={product.id}
                          onClick={() => toggleProduct(product)}
                          className={`
                            w-full
                            text-left
                            rounded-xl
                            border
                            p-3
                            transition-colors
                            ${
                              checked
                                ? "border-slate-400 bg-slate-50"
                                : "border-slate-200 bg-white hover:bg-slate-50"
                            }
                          `}
                        >
                          <div className="flex items-start gap-3">
                            <span
                              className={`
                                mt-0.5
                                w-4
                                h-4
                                rounded
                                border
                                flex
                                items-center
                                justify-center
                                ${
                                  checked
                                    ? "bg-[#24395f] border-[#24395f] text-white"
                                    : "border-slate-300"
                                }
                              `}
                            >
                              {checked && <span className="text-[9px]">✓</span>}
                            </span>

                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-slate-700">
                                {product.name}
                              </p>

                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] text-slate-500">
                                  {money(product.price)}
                                </span>

                                <span className="text-slate-300">•</span>

                                <span className="text-[10px] text-slate-500">
                                  {product.available} available
                                </span>
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Selected Products */}

                <div className="border-l border-slate-100 pl-5 overflow-y-auto">
                  <div className="flex items-center gap-2 pb-3 border-b border-slate-200">
                    <FiBox size={17} className="text-slate-600" />

                    <h3 className="text-sm font-semibold text-slate-700">
                      Selected Products
                    </h3>
                  </div>

                  {selectedProducts.length === 0 ? (
                    <div className="h-[280px] flex flex-col items-center justify-center text-center">
                      <FiBox size={22} className="text-slate-400 mb-3" />

                      <p className="text-xs font-medium text-slate-400">
                        No Product Selected
                      </p>

                      <p className="text-[9px] text-slate-400 mt-1">
                        Select product to get started
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3 pt-3">
                      {selectedProducts.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-xl border border-slate-200 p-4"
                        >
                          <div className="flex justify-between gap-3">
                            <p className="text-xs font-semibold text-slate-800">
                              {item.name}
                            </p>

                            <button
                              type="button"
                              onClick={() => removeSelectedProduct(item.id)}
                              className="text-rose-500"
                            >
                              <FiTrash2 size={14} />
                            </button>
                          </div>

                          <div className="flex items-center justify-between mt-3">
                            <span className="text-[10px] text-slate-500">
                              Quantity
                            </span>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  updateSelectedProduct(
                                    item.id,
                                    "quantity",
                                    item.quantity - 1,
                                  )
                                }
                                className="w-6 h-6 rounded border border-slate-200 flex items-center justify-center"
                              >
                                <FiMinus size={11} />
                              </button>

                              <span className="text-xs w-4 text-center">
                                {item.quantity}
                              </span>

                              <button
                                type="button"
                                onClick={() =>
                                  updateSelectedProduct(
                                    item.id,
                                    "quantity",
                                    item.quantity + 1,
                                  )
                                }
                                className="w-6 h-6 rounded border border-slate-200 flex items-center justify-center"
                              >
                                <FiPlus size={11} />
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-2 mt-3">
                            <div>
                              <label className="block text-[9px] text-slate-500 mb-1">
                                Unit Price (₹)
                              </label>

                              <div className="h-9 rounded-md border border-slate-200 flex items-center px-2 text-xs">
                                {item.price.toLocaleString("en-IN")}
                              </div>
                            </div>

                            <div>
                              <label className="block text-[9px] text-slate-500 mb-1">
                                Discount (%)
                              </label>

                              <input
                                type="number"
                                value={item.discount}
                                min="0"
                                max="100"
                                onChange={(e) =>
                                  updateSelectedProduct(
                                    item.id,
                                    "discount",
                                    Number(e.target.value),
                                  )
                                }
                                className="w-full h-9 rounded-md border border-slate-200 px-2 text-xs"
                              />
                            </div>

                            <div>
                              <label className="block text-[9px] text-slate-500 mb-1">
                                Tax (GST %)
                              </label>

                              <select
                                value={item.tax}
                                onChange={(e) =>
                                  updateSelectedProduct(
                                    item.id,
                                    "tax",
                                    Number(e.target.value),
                                  )
                                }
                                className="w-full h-9 rounded-md border border-slate-200 px-2 text-xs bg-white"
                              >
                                <option value={0}>0%</option>

                                <option value={5}>5%</option>

                                <option value={12}>12%</option>

                                <option value={18}>18%</option>

                                <option value={28}>28%</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Total */}

              <div className="h-10 border-t border-slate-200 flex items-center justify-end px-5">
                <div className="flex items-center gap-5">
                  <span className="text-xs text-slate-500">Line Total</span>

                  <span className="text-xs font-semibold text-slate-700">
                    {money(orderSubtotal)}
                  </span>
                </div>
              </div>

              {/* Modal Footer */}

              <div className="h-16 bg-[#f8f8f8] border-t border-slate-200 flex items-center justify-end gap-2 px-5">
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="h-10 px-4 rounded-md border border-slate-300 bg-white text-xs font-medium text-slate-700"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="h-10 px-5 rounded-md bg-[#24395f] text-white text-xs font-semibold flex items-center gap-2"
                >
                  <FiPlus size={15} />
                  Add to Order
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* =======================================================
     ORDERS LIST UI
  ======================================================= */

  return (
    <div className="space-y-5">
      {/* =================================================
          HEADER
      ================================================= */}

      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold text-slate-800">Sales Order</h1>

          <button
            type="button"
            onClick={() => fetchOrders(true)}
            title="Refresh"
            className="w-7 h-7 rounded-md flex items-center justify-center text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-colors"
          >
            <FiRefreshCw
              size={14}
              className={refreshing ? "animate-spin" : ""}
            />
          </button>
        </div>

        <div className="relative">
          <button
            type="button"
            title="More options"
            onClick={() => setHeaderMenuOpen((value) => !value)}
            className="w-8 h-8 rounded-md flex items-center justify-center bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-colors"
          >
            <FiMoreVertical size={17} />
          </button>

          {headerMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setHeaderMenuOpen(false)}
              />

              <div className="absolute right-0 top-10 z-50 w-40 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
                <button
                  type="button"
                  onClick={exportData}
                  className="w-full px-3 py-2.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                >
                  <FiDownload size={14} />
                  Export Data
                </button>

                <button
                  type="button"
                  onClick={downloadChart}
                  className="w-full px-3 py-2.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                >
                  <FiBarChart2 size={14} />
                  Download Chart
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* =================================================
          KPI
      ================================================= */}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs text-slate-500">Total Proposal</p>

          <div className="flex items-center justify-between mt-2">
            <p className="text-2xl font-semibold text-[#24395f]">
              {kpis.totalProposal.toLocaleString()}
            </p>

            <span className="text-[10px] px-2 py-1 rounded bg-emerald-50 text-emerald-500">
              ↗ 12.4%
            </span>
          </div>

          <p className="text-[10px] text-emerald-500 mt-1">vs last month</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs text-slate-500">Order Value</p>

          <div className="flex items-center justify-between mt-2">
            <p className="text-2xl font-semibold text-[#24395f]">
              {money(kpis.orderValue)}
            </p>

            <span className="text-[10px] px-2 py-1 rounded bg-emerald-50 text-emerald-500">
              ↗ 8.7%
            </span>
          </div>

          <p className="text-[10px] text-emerald-500 mt-1">vs last month</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs text-slate-500">Pending Orders</p>

          <p className="text-2xl font-semibold text-[#24395f] mt-2">
            {kpis.pendingOrders}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs text-slate-500">Completed Orders</p>

          <p className="text-2xl font-semibold text-[#24395f] mt-2">
            {kpis.completedOrders}
          </p>
        </div>
      </div>

      {/* =================================================
          SEARCH / FILTER / ADD
      ================================================= */}

      <div className="relative">
        <div className="flex items-center gap-3">
          {/* SEARCH */}

          <div className="relative flex-1">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Order"
              className="w-full h-10 rounded-md border border-slate-200 bg-white pl-3 pr-10 text-xs text-slate-700 outline-none placeholder:text-slate-400 focus:border-slate-400"
            />

            <FiSearch
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
              size={15}
            />
          </div>

          {/* FILTER */}

          <button
            type="button"
            onClick={() => setShowFilters((value) => !value)}
            className={`
              h-10
              w-12
              rounded-md
              border
              bg-white
              flex
              items-center
              justify-center
              transition-colors
              ${
                showFilters
                  ? "border-[#24395f] text-[#24395f] bg-slate-50"
                  : "border-slate-200 text-slate-600 hover:bg-slate-50"
              }
            `}
            title="Filter Orders"
          >
            <FiSliders size={16} />
          </button>

          {/* ADD NEW ORDER */}

          <button
            type="button"
            onClick={openCreateOrder}
            className="h-10 px-4 rounded-md bg-[#24395f] text-white text-xs font-semibold flex items-center gap-2 hover:bg-[#1d304f] transition-colors whitespace-nowrap"
          >
            <FiPlus size={15} />
            Add New Order
          </button>
        </div>

        {/* =================================================
            FILTER POPOVER
        ================================================= */}

        {showFilters && (
          <div className="absolute right-[118px] top-[48px] z-50 w-[500px] rounded-2xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.12)] p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-medium text-slate-500">Date Range</h3>

              <button
                type="button"
                onClick={clearFilters}
                className="text-[11px] font-medium text-rose-500 hover:text-rose-600"
              >
                × Clear Filter
              </button>
            </div>

            {/* DATE */}

            <div className="grid grid-cols-2 gap-3">
              <div className="relative">
                <FiCalendar
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10"
                  size={15}
                />

                <input
                  type="date"
                  value={filters.orderDateFrom}
                  onChange={(e) =>
                    setFilters((current) => ({
                      ...current,
                      orderDateFrom: e.target.value,
                    }))
                  }
                  className="w-full h-11 rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-xs text-slate-700 outline-none"
                />
              </div>

              <div className="relative">
                <FiCalendar
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10"
                  size={15}
                />

                <input
                  type="date"
                  value={filters.orderDateTo}
                  onChange={(e) =>
                    setFilters((current) => ({
                      ...current,
                      orderDateTo: e.target.value,
                    }))
                  }
                  className="w-full h-11 rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-xs text-slate-700 outline-none"
                />
              </div>
            </div>

            {/* CUSTOMER + ASSIGNED */}

            <div className="grid grid-cols-2 gap-3 mt-4">
              <div>
                <label className="block mb-1.5 text-[11px] font-medium text-slate-500">
                  Customer Type
                </label>

                <select
                  value={filters.customerType}
                  onChange={(e) =>
                    setFilters((current) => ({
                      ...current,
                      customerType: e.target.value,
                    }))
                  }
                  className="appearance-none w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-600 outline-none"
                >
                  <option value="">All Customer Types</option>

                  {CUSTOMER_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block mb-1.5 text-[11px] font-medium text-slate-500">
                  Assigned To
                </label>

                <select
                  value={filters.assignedTo}
                  onChange={(e) =>
                    setFilters((current) => ({
                      ...current,
                      assignedTo: e.target.value,
                    }))
                  }
                  className="appearance-none w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-600 outline-none"
                >
                  <option value="">All Users</option>

                  {assignedUsers.map((user) => (
                    <option key={user} value={user}>
                      {user}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* STATUS + STATE */}

            <div className="grid grid-cols-2 gap-3 mt-4">
              <div>
                <label className="block mb-1.5 text-[11px] font-medium text-slate-500">
                  Status
                </label>

                <select
                  value={filters.status}
                  onChange={(e) =>
                    setFilters((current) => ({
                      ...current,
                      status: e.target.value,
                    }))
                  }
                  className="appearance-none w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-600 outline-none"
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block mb-1.5 text-[11px] font-medium text-slate-500">
                  State
                </label>

                <select
                  value={filters.state}
                  onChange={(e) =>
                    setFilters((current) => ({
                      ...current,
                      state: e.target.value,
                    }))
                  }
                  className="appearance-none w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-600 outline-none"
                >
                  <option value="All">All</option>

                  {STATES.map((state) => (
                    <option key={state} value={state}>
                      {state}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* FOOTER */}

            <div className="border-t border-slate-100 mt-5 pt-4">
              <div className="flex items-center justify-end gap-4">
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-[11px] font-medium text-slate-500 hover:text-slate-700"
                >
                  Clear All Filter
                </button>

                <button
                  type="button"
                  onClick={applyFilters}
                  className="h-9 px-4 rounded-lg bg-[#24395f] text-white text-[11px] font-semibold"
                >
                  Apply Filter
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* =================================================
          STATUS TABS
      ================================================= */}

      <div className="flex items-center overflow-x-auto gap-1">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`
                whitespace-nowrap
                px-4
                py-2
                rounded-t-md
                text-[11px]
                font-medium
                ${
                  activeTab === tab
                    ? "bg-[#24395f] text-white"
                    : "bg-white text-slate-600 hover:bg-slate-50"
                }
              `}
          >
            {tab} ({statusCounts[tab]})
          </button>
        ))}
      </div>

      {/* =================================================
          TABLE
      ================================================= */}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="w-10 px-4 py-3">
                  <input type="checkbox" className="rounded" />
                </th>

                <th className="px-3 py-3 text-[11px] font-medium text-slate-500">
                  Order ID
                </th>

                <th className="px-3 py-3 text-[11px] font-medium text-slate-500">
                  Customer Name
                </th>

                <th className="px-3 py-3 text-[11px] font-medium text-slate-500">
                  Company
                </th>

                <th className="px-3 py-3 text-[11px] font-medium text-slate-500">
                  Order Value
                </th>

                <th className="px-3 py-3 text-[11px] font-medium text-slate-500">
                  Assigned To
                </th>

                <th className="px-3 py-3 text-[11px] font-medium text-slate-500">
                  Order Date
                </th>

                <th className="px-3 py-3 text-[11px] font-medium text-slate-500">
                  Status
                </th>

                <th className="px-3 py-3 text-[11px] font-medium text-slate-500">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={9}
                    className="py-16 text-center text-xs text-slate-400"
                  >
                    Fetching order records...
                  </td>
                </tr>
              ) : paginatedOrders.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="py-16 text-center text-xs text-slate-400"
                  >
                    No sales orders found.
                  </td>
                </tr>
              ) : (
                paginatedOrders.map((order) => {
                  const status = normalizeStatus(order.status);

                  return (
                    <tr
                      key={order._id}
                      className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <input type="checkbox" className="rounded" />
                      </td>

                      <td className="px-3 py-3 text-xs font-medium text-slate-700">
                        #{order._id}
                      </td>

                      <td className="px-3 py-3">
                        <div>
                          <p className="text-xs font-bold text-slate-800">
                            {order.customer_name}
                          </p>

                          <p className="text-[10px] text-slate-500">
                            {order.customer_name
                              ?.toLowerCase()
                              .replace(/\s+/g, ".")}
                            @example.com
                          </p>

                          <p className="text-[10px] text-slate-500">
                            ◉ {getState(order)}
                          </p>
                        </div>
                      </td>

                      <td className="px-3 py-3 text-xs text-slate-700 max-w-[150px]">
                        {order.company_name || `${order.customer_name} Corp`}
                      </td>

                      <td className="px-3 py-3 text-xs font-medium text-slate-700">
                        {money(order.grand_total)}
                      </td>

                      <td className="px-3 py-3">
                        <span className="inline-flex items-center gap-1.5 bg-slate-100 rounded px-2 py-1 text-[10px] text-slate-700">
                          <span className="w-4 h-4 rounded-full bg-slate-300 flex items-center justify-center text-[8px]">
                            {getAssignedTo(order).charAt(0)}
                          </span>

                          {getAssignedTo(order)}
                        </span>
                      </td>

                      <td className="px-3 py-3 text-[10px] text-slate-600">
                        {formatDate(getOrderDate(order))}
                      </td>

                      <td className="px-3 py-3">
                        <span
                          className={`
                              inline-flex
                              px-2.5
                              py-1
                              rounded
                              text-[10px]
                              font-medium
                              ${getStatusClass(status)}
                            `}
                        >
                          {status}
                        </span>
                      </td>

                      <td className="px-3 py-3 relative">
                        <button
                          type="button"
                          onClick={() =>
                            setOpenMenu(
                              openMenu === order._id ? null : order._id,
                            )
                          }
                          className="p-1 rounded hover:bg-slate-100"
                        >
                          <FiMoreVertical size={15} />
                        </button>

                        {openMenu === order._id && (
                          <>
                            <div
                              className="fixed inset-0 z-20"
                              onClick={() => setOpenMenu(null)}
                            />

                            <div className="absolute right-4 top-9 z-30 w-40 bg-white border border-slate-200 rounded-lg shadow-xl py-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setPreviewOrder(order);

                                  setOpenMenu(null);
                                }}
                                className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50"
                              >
                                View / Print
                              </button>

                              <Link
                                href={`/sales/orders/${order._id}`}
                                className="block px-3 py-2 text-xs hover:bg-slate-50"
                                onClick={() => setOpenMenu(null)}
                              >
                                View Order
                              </Link>
                            </div>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* =================================================
            PAGINATION
        ================================================= */}

        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
          <p className="text-[11px] text-slate-500">
            Showing{" "}
            {filteredOrders.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}-
            {Math.min(page * PAGE_SIZE, filteredOrders.length)} of{" "}
            {filteredOrders.length}
          </p>

          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="w-7 h-7 rounded flex items-center justify-center disabled:text-slate-300 text-slate-600 hover:bg-slate-100"
            >
              <FiChevronLeft size={13} />
            </button>

            {Array.from(
              {
                length: Math.min(totalPages, 3),
              },
              (_, index) => index + 1,
            ).map((number) => (
              <button
                key={number}
                type="button"
                onClick={() => setPage(number)}
                className={`
                    w-7
                    h-7
                    rounded
                    text-[11px]
                    ${
                      page === number
                        ? "bg-[#24395f] text-white"
                        : "border border-slate-200 text-slate-600"
                    }
                  `}
              >
                {number}
              </button>
            ))}

            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="w-7 h-7 rounded flex items-center justify-center disabled:text-slate-300 text-slate-600 hover:bg-slate-100"
            >
              <FiChevronRight size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* =================================================
          PRINT PREVIEW
      ================================================= */}

      {previewOrder && (
        <DocumentPrintPreview
          isOpen={!!previewOrder}
          onClose={() => setPreviewOrder(null)}
          documentType="PURCHASE ORDER (PO)"
          documentNumber={previewOrder._id.slice(0, 8).toUpperCase()}
          dateStr={new Date(getOrderDate(previewOrder)).toLocaleDateString(
            "en-IN",
          )}
          vendorName={previewOrder.customer_name}
          items={previewOrder.items.map((item) => ({
            item: item.description || item.product_id,
            qty: item.quantity_case || item.quantity_kg_ltr || 1,
            price: item.rate || item.price || 0,
          }))}
        />
      )}
    </div>
  );
}
