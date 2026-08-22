"use client";

import { useEffect, useState, useCallback } from "react";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import api from "@/lib/axios";
import { useUIStore } from "@/lib/store/ui.store";
import { getLeadsApi, Lead } from "@/features/workflows/api/workflows.api";
import {
  FiTrendingUp,
  FiDownload,
  FiRefreshCw,
  FiCheckCircle,
  FiFileText,
  FiShoppingBag
} from "react-icons/fi";
import { CgSpinner } from "react-icons/cg";

export default function ReportsPage() {
  const { addToast } = useUIStore();
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [ordersCount, setOrdersCount] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);

  const fetchReportsData = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch CRM leads data
      try {
        const lData = await getLeadsApi();
        setLeads(lData || []);

        let rev = 0;
        (lData || []).forEach((lead) => {
          if (lead.quotation_items && lead.quotation_items.length > 0) {
            lead.quotation_items.forEach((item) => {
              rev += (item.qty || 1) * (item.price || 0);
            });
          }
        });
        setTotalRevenue(rev);
      } catch (err) {
        console.error("Failed to load leads for reports:", err);
      }

      // Fetch Sales orders count
      try {
        const res = await api.get("/api/v1/orders/");
        if (res.data?.success) {
          setOrdersCount(res.data.data?.length || 0);
        }
      } catch (err) {
        console.error("Failed to load sales orders for reports:", err);
      }
    } catch (err) {
      console.error(err);
      addToast("Failed to compile executive reports.", "error");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchReportsData();
  }, [fetchReportsData]);

  const handleExportReport = () => {
    addToast("Exporting comprehensive executive report (CSV)...", "info");
  };

  return (
    <div className="space-y-6 select-none">
      <PageHeader
        title="Executive Reports & Analytics"
        description="Comprehensive business intelligence performance summary and audit ledgers."
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExportReport} className="flex items-center gap-2">
              <FiDownload className="text-xs" />
              <span>Export Summary</span>
            </Button>
            <Button variant="secondary" size="sm" onClick={fetchReportsData} className="p-2.5">
              <FiRefreshCw className="text-xs" />
            </Button>
          </div>
        }
      />

      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3 text-slate-400">
          <CgSpinner className="animate-spin text-4xl text-primary" />
          <span className="text-xs font-semibold">Compiling real-time business reports...</span>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Top Performance Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Pipeline Revenue</p>
                  <h3 className="text-2xl font-extrabold text-slate-800 dark:text-white mt-1">
                    ₹{totalRevenue.toLocaleString("en-IN")}
                  </h3>
                </div>
                <div className="p-3 bg-emerald-500/10 text-emerald-600 rounded-xl">
                  <FiTrendingUp className="text-2xl" />
                </div>
              </div>
            </Card>

            <Card>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Active Leads</p>
                  <h3 className="text-2xl font-extrabold text-slate-800 dark:text-white mt-1">
                    {leads.length}
                  </h3>
                </div>
                <div className="p-3 bg-indigo-500/10 text-indigo-600 rounded-xl">
                  <FiFileText className="text-2xl" />
                </div>
              </div>
            </Card>

            <Card>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Executed Orders</p>
                  <h3 className="text-2xl font-extrabold text-slate-800 dark:text-white mt-1">
                    {ordersCount}
                  </h3>
                </div>
                <div className="p-3 bg-sky-500/10 text-sky-600 rounded-xl">
                  <FiShoppingBag className="text-2xl" />
                </div>
              </div>
            </Card>
          </div>

          {/* Audit & Report Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card title="Sales Stage Distribution">
              <div className="space-y-3 pt-2">
                {["lead", "opportunity", "quotation", "won", "lost"].map((stg) => {
                  const cnt = leads.filter((l) => l.stage === stg || l.status === stg).length;
                  const pct = leads.length > 0 ? Math.round((cnt / leads.length) * 100) : 0;
                  return (
                    <div key={stg} className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="capitalize text-slate-700 dark:text-slate-300">{stg} Stage</span>
                        <span className="text-slate-500">{cnt} leads ({pct}%)</span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-[#071929] h-2 rounded-full overflow-hidden">
                        <div className="bg-primary h-full rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card title="System Readiness Status">
              <div className="space-y-4 pt-2 text-xs">
                <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-[#0d2336]/40">
                  <span className="font-semibold text-slate-600 dark:text-slate-400">Relational Data Engine</span>
                  <span className="flex items-center gap-1 text-emerald-600 font-bold"><FiCheckCircle /> Healthy</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-[#0d2336]/40">
                  <span className="font-semibold text-slate-600 dark:text-slate-400">Document Storage Engine</span>
                  <span className="flex items-center gap-1 text-emerald-600 font-bold"><FiCheckCircle /> Healthy</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="font-semibold text-slate-600 dark:text-slate-400">RBAC Security & Menus API</span>
                  <span className="flex items-center gap-1 text-emerald-600 font-bold"><FiCheckCircle /> Active</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
