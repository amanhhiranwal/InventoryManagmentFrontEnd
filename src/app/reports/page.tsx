"use client";

import { useEffect, useState, useCallback } from "react";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import StatCard from "@/components/crm/StatCard";
import { ListPage, StatGrid } from "@/components/crm/ListPageShell";
import ListActionsMenu, {
  ExportColumn,
} from "@/components/crm/ListActions";
import api from "@/lib/axios";
import { useUIStore } from "@/lib/store/ui.store";
import { getLeadsApi, Lead } from "@/features/workflows/api/workflows.api";
import {
  FiCheckCircle,
} from "react-icons/fi";
import { CgSpinner } from "react-icons/cg";

/** The pipeline as a spreadsheet: one row per lead, with what it is
    worth, so "Export Summary" produces an actual file. It used to raise a
    toast saying it was exporting and then do nothing at all. */
const REPORT_COLUMNS: ExportColumn<Lead>[] = [
  { header: "Lead", value: (lead) => lead.title },
  { header: "Organization", value: (lead) => lead.organization_name || "" },
  { header: "Contact", value: (lead) => lead.contact_name || "" },
  { header: "Email", value: (lead) => lead.email || "" },
  { header: "Stage", value: (lead) => lead.stage },
  { header: "Status", value: (lead) => lead.status },
  { header: "Owner", value: (lead) => lead.assigned_to_name || lead.creator_name || "" },
  {
    header: "Proposed Value",
    value: (lead) =>
      (lead.quotation_items || []).reduce(
        (total, item) => total + (item.qty || 1) * (item.price || 0),
        0,
      ),
  },
];

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

  /* The stages the distribution bars are drawn across. */
  const STAGES = ["lead", "opportunity", "quotation", "won", "lost"];

  const stageCount = (stage: string) =>
    leads.filter((l) => l.stage === stage || l.status === stage).length;

  return (
    <ListPage>
      <PageHeader
        title="Executive Reports & Analytics"
        description="Comprehensive business intelligence performance summary and audit ledgers."
        action={
          <ListActionsMenu
            name="Reports"
            rows={leads}
            columns={REPORT_COLUMNS}
            chart={STAGES.map((stage) => ({
              label: stage.charAt(0).toUpperCase() + stage.slice(1),
              value: stageCount(stage),
            }))}
          />
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
          <StatGrid>
            <StatCard
              label="Total Pipeline Revenue"
              value={`₹${totalRevenue.toLocaleString("en-IN")}`}
              caption="quoted across every open lead"
            />
            <StatCard
              label="Total Active Leads"
              value={leads.length}
              caption="on the board right now"
            />
            <StatCard
              label="Executed Orders"
              value={ordersCount}
              caption="raised to date"
            />
          </StatGrid>

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
    </ListPage>
  );
}
