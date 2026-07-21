"use client";

import { useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Table from "@/components/ui/Table";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { FiPlus, FiSearch, FiTarget, FiDollarSign, FiUser, FiActivity } from "react-icons/fi";

interface Opportunity {
  id: string;
  name: string;
  account: string;
  stage: "Prospecting" | "Qualified" | "Proposal" | "Negotiation" | "Closed won";
  value: number;
  owner: string;
}

export default function OpportunitiesPage() {
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [opps, setOpps] = useState<Opportunity[]>([
    {
      id: "1",
      name: "Smartboard Procurement Q3",
      account: "Harlow & Vance",
      stage: "Negotiation",
      value: 42000,
      owner: "M. Ruiz",
    },
    {
      id: "2",
      name: "Enterprise Software License",
      account: "Colston Freight",
      stage: "Proposal",
      value: 19000,
      owner: "T. Adeyemi",
    },
    {
      id: "3",
      name: "Hardware Fleet Replacement",
      account: "North Ridge Retail",
      stage: "Closed won",
      value: 26000,
      owner: "S. Byrne",
    },
    {
      id: "4",
      name: "Interactive Screen Demo Bundle",
      account: "Fen & Oak Studio",
      stage: "Qualified",
      value: 10000,
      owner: "M. Ruiz",
    },
  ]);

  // Form states
  const [name, setName] = useState("");
  const [account, setAccount] = useState("");
  const [stage, setStage] = useState<Opportunity["stage"]>("Prospecting");
  const [value, setValue] = useState("");
  const [owner, setOwner] = useState("");

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !account || !value || !owner) return;

    const newOpp: Opportunity = {
      id: Date.now().toString(),
      name,
      account,
      stage,
      value: Number(value) || 0,
      owner,
    };

    setOpps([newOpp, ...opps]);
    setName("");
    setAccount("");
    setStage("Prospecting");
    setValue("");
    setOwner("");
    setShowAddModal(false);
  };

  const filtered = opps.filter(
    (o) =>
      o.name.toLowerCase().includes(search.toLowerCase()) ||
      o.account.toLowerCase().includes(search.toLowerCase()) ||
      o.owner.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Sales Opportunities"
          description="Manage and track active sales deals, stage progressions, and estimated pipeline values."
        />
        <Button onClick={() => setShowAddModal(true)} icon={<FiPlus />}>
          Add Opportunity
        </Button>
      </div>

      <div className="flex items-center gap-3 max-w-md bg-white dark:bg-[#051422] rounded-xl border border-slate-200 dark:border-[#0d2336] px-3.5 py-2">
        <FiSearch className="text-slate-400 text-sm" />
        <input
          type="text"
          placeholder="Search opportunities..."
          className="w-full text-xs bg-transparent outline-none text-slate-800 dark:text-white"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card>
        {filtered.length > 0 ? (
          <Table headers={["Deal Name", "Account / Client", "Sales Stage", "Owner / Agent", "Estimated Value"]}>
            {filtered.map((o) => (
              <tr
                key={o.id}
                className="hover:bg-slate-50/50 dark:hover:bg-[#071929]/20 transition-all duration-150"
              >
                <td className="py-4 px-5 font-bold text-slate-800 dark:text-white text-sm">
                  <div className="flex items-center gap-2">
                    <FiTarget className="text-primary" />
                    <span>{o.name}</span>
                  </div>
                </td>
                <td className="py-4 px-5 text-xs text-slate-700 dark:text-slate-350 font-semibold">
                  {o.account}
                </td>
                <td className="py-4 px-5">
                  <span
                    className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-bold ${
                      o.stage === "Closed won"
                        ? "bg-emerald-500/10 text-emerald-800"
                        : o.stage === "Negotiation"
                        ? "bg-teal-500/10 text-teal-800"
                        : o.stage === "Proposal"
                        ? "bg-amber-500/10 text-amber-800"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {o.stage}
                  </span>
                </td>
                <td className="py-4 px-5 text-xs text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <FiUser className="text-slate-400" />
                    <span>{o.owner}</span>
                  </div>
                </td>
                <td className="py-4 px-5 text-xs font-bold font-mono text-slate-800 dark:text-white">
                  <div className="flex items-center gap-1">
                    <FiDollarSign className="text-slate-400" />
                    <span>{o.value.toLocaleString()}</span>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        ) : (
          <div className="text-center py-12 text-slate-400 italic text-xs">
            No opportunities match your filter query.
          </div>
        )}
      </Card>

      {/* Add Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add Opportunity">
        <form onSubmit={handleAdd} className="space-y-4">
          <Input
            label="Opportunity / Deal Name *"
            required
            placeholder="e.g. Server Fleet Renewal"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <Input
            label="Account / Client Name *"
            required
            placeholder="e.g. Acme Corp"
            value={account}
            onChange={(e) => setAccount(e.target.value)}
          />

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Pipeline Stage *
            </label>
            <select
              className="w-full rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-50/50 dark:bg-[#071929]/50 px-3.5 py-2.5 text-xs text-slate-900 dark:text-white outline-none"
              value={stage}
              onChange={(e) => setStage(e.target.value as any)}
            >
              <option value="Prospecting">Prospecting</option>
              <option value="Qualified">Qualified</option>
              <option value="Proposal">Proposal</option>
              <option value="Negotiation">Negotiation</option>
              <option value="Closed won">Closed won</option>
            </select>
          </div>

          <Input
            label="Estimated Value ($ USD) *"
            required
            type="number"
            placeholder="e.g. 25000"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />

          <Input
            label="Owner / Representative Name *"
            required
            placeholder="e.g. M. Ruiz"
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
          />

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-[#0d2336]">
            <Button variant="outline" type="button" onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>
            <Button type="submit">Save Deal</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
