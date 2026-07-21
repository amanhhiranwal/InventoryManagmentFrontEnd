"use client";

import { useEffect, useState, useRef, MouseEvent as ReactMouseEvent } from "react";
import { AxiosError } from "axios";
import { useUIStore } from "@/lib/store/ui.store";
import { getRolesApi, Role } from "@/features/rbac/api/rbac.api";
import {
  getWorkflowsApi,
  createWorkflowApi,
  deleteWorkflowApi,
  updateWorkflowApi,
  Workflow,
  WorkflowNode,
  WorkflowEdge,
} from "@/features/workflows/api/workflows.api";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import PageHeader from "@/components/ui/PageHeader";
import Modal from "@/components/ui/Modal";
import { FiPlus, FiTrash2, FiPlay, FiRefreshCw, FiSettings, FiActivity, FiEdit2 } from "react-icons/fi";

interface CanvasNode {
  id: string;
  roleId: string;
  roleName: string;
  x: number;
  y: number;
}

export default function WorkflowsPage() {
  const { addToast } = useUIStore();
  const [roles, setRoles] = useState<Role[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Workflow Form State
  const [workflowName, setWorkflowName] = useState("");
  const [workflowDesc, setWorkflowDesc] = useState("");
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [editingWorkflowId, setEditingWorkflowId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [workflowToDelete, setWorkflowToDelete] = useState<Workflow | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Canvas State
  const [canvasNodes, setCanvasNodes] = useState<CanvasNode[]>([]);
  const [canvasEdges, setCanvasEdges] = useState<WorkflowEdge[]>([]);

  // Draggable State
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const canvasRef = useRef<SVGSVGElement>(null);

  // Connection Builder State
  const [connectingSourceId, setConnectingSourceId] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [rolesData, workflowsData] = await Promise.all([
        getRolesApi(),
        getWorkflowsApi(),
      ]);
      setRoles(rolesData);
      setWorkflows(workflowsData);
      if (rolesData.length > 0) {
        setSelectedRoleId(rolesData[0].id);
      }
    } catch (err: unknown) {
      console.error(err);
      addToast("Failed to load workflows or roles configuration.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddNode = () => {
    if (!selectedRoleId) {
      addToast("Please select a role to add.", "warning");
      return;
    }
    const roleObj = roles.find((r) => r.id === selectedRoleId);
    if (!roleObj) return;

    // Avoid duplicate role nodes for simple workflow construction
    if (canvasNodes.some((n) => n.roleId === selectedRoleId)) {
      addToast("A node for this role already exists on the canvas.", "warning");
      return;
    }

    const newNode: CanvasNode = {
      id: `node-${Date.now()}`,
      roleId: roleObj.id,
      roleName: roleObj.name,
      x: 100 + Math.random() * 200,
      y: 100 + Math.random() * 150,
    };

    setCanvasNodes((prev) => [...prev, newNode]);
    addToast(`Added node for '${roleObj.name}'`, "success");
  };

  // Drag handlers
  const handleNodeMouseDown = (e: ReactMouseEvent, id: string) => {
    e.stopPropagation();
    const node = canvasNodes.find((n) => n.id === id);
    if (!node || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    dragOffset.current = {
      x: mouseX - node.x,
      y: mouseY - node.y,
    };
    setDraggingNodeId(id);
  };

  const handleCanvasMouseMove = (e: ReactMouseEvent) => {
    if (!draggingNodeId || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    setCanvasNodes((prev) =>
      prev.map((n) =>
        n.id === draggingNodeId
          ? {
              ...n,
              x: Math.max(20, Math.min(rect.width - 150, mouseX - dragOffset.current.x)),
              y: Math.max(20, Math.min(rect.height - 80, mouseY - dragOffset.current.y)),
            }
          : n
      )
    );
  };

  const handleCanvasMouseUp = () => {
    setDraggingNodeId(null);
  };

  // Connection handlers
  const handleOutputClick = (e: ReactMouseEvent, id: string) => {
    e.stopPropagation();
    setConnectingSourceId(id);
    addToast("Selected source node. Now click another node's Input handle to connect.", "info");
  };

  const handleInputClick = (e: ReactMouseEvent, targetId: string) => {
    e.stopPropagation();
    if (!connectingSourceId) return;

    if (connectingSourceId === targetId) {
      setConnectingSourceId(null);
      return;
    }

    // Check if edge already exists
    const edgeId = `edge-${connectingSourceId}-${targetId}`;
    if (canvasEdges.some((edge) => edge.id === edgeId)) {
      addToast("Connection already exists.", "warning");
      setConnectingSourceId(null);
      return;
    }

    const newEdge: WorkflowEdge = {
      id: edgeId,
      source: connectingSourceId,
      target: targetId,
    };

    setCanvasEdges((prev) => [...prev, newEdge]);
    setConnectingSourceId(null);
    addToast("Connected nodes successfully!", "success");
  };

  const handleDeleteNode = (id: string) => {
    setCanvasNodes((prev) => prev.filter((n) => n.id !== id));
    setCanvasEdges((prev) => prev.filter((edge) => edge.source !== id && edge.target !== id));
  };

  const handleDeleteEdge = (edgeId: string) => {
    setCanvasEdges((prev) => prev.filter((e) => e.id !== edgeId));
    addToast("Connection removed.", "success");
  };

  const handleClearCanvas = () => {
    setCanvasNodes([]);
    setCanvasEdges([]);
    setConnectingSourceId(null);
    setEditingWorkflowId(null);
    setWorkflowName("");
    setWorkflowDesc("");
  };

  const handleLoadWorkflow = (wf: Workflow) => {
    setEditingWorkflowId(wf.id);
    setWorkflowName(wf.name);
    setWorkflowDesc(wf.description || "");
    const loadedNodes: CanvasNode[] = wf.nodes.map((n) => ({
      id: n.id,
      roleId: n.data.role_id,
      roleName: n.data.label,
      x: n.x || 150,
      y: n.y || 150,
    }));
    setCanvasNodes(loadedNodes);
    setCanvasEdges(wf.edges || []);
    addToast(`Loaded workflow '${wf.name}' onto canvas for editing!`, "info");
  };

  // Save Workflow
  const handleSaveWorkflow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workflowName.trim()) {
      addToast("Workflow Name is required.", "warning");
      return;
    }
    if (canvasNodes.length < 2) {
      addToast("Please add at least 2 nodes to construct a workflow hierarchy.", "warning");
      return;
    }

    try {
      setSubmitting(true);
      // Map canvas nodes to API nodes format
      const nodesPayload: WorkflowNode[] = canvasNodes.map((n) => ({
        id: n.id,
        x: n.x,
        y: n.y,
        data: {
          label: n.roleName,
          role_id: n.roleId,
        },
      }));

      if (editingWorkflowId) {
        await updateWorkflowApi(editingWorkflowId, {
          name: workflowName,
          description: workflowDesc,
          nodes: nodesPayload,
          edges: canvasEdges,
        });
        addToast("Workflow updated successfully!", "success");
      } else {
        await createWorkflowApi({
          name: workflowName,
          description: workflowDesc,
          nodes: nodesPayload,
          edges: canvasEdges,
        });
        addToast("Workflow saved successfully!", "success");
      }

      setWorkflowName("");
      setWorkflowDesc("");
      setEditingWorkflowId(null);
      handleClearCanvas();
      fetchData();
    } catch (err: unknown) {
      console.error(err);
      const axiosError = err as AxiosError<{ message?: string }>;
      addToast(axiosError.response?.data?.message || "Failed to save workflow.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenDeleteModal = (wf: Workflow) => {
    setWorkflowToDelete(wf);
    setShowDeleteModal(true);
  };

  const handleConfirmDeleteWorkflow = async () => {
    if (!workflowToDelete) return;
    try {
      setDeleting(true);
      await deleteWorkflowApi(workflowToDelete.id);
      addToast("Workflow deleted successfully.", "success");
      setShowDeleteModal(false);
      setWorkflowToDelete(null);
      fetchData();
    } catch (err: unknown) {
      console.error(err);
      addToast("Failed to delete workflow.", "error");
    } finally {
      setDeleting(false);
    }
  };

  // Helper to draw bezier path
  const getBezierPath = (source: CanvasNode, target: CanvasNode) => {
    const startX = source.x + 80;
    const startY = source.y + 60; // bottom center
    const endX = target.x + 80;
    const endY = target.y; // top center

    const controlY = startY + (endY - startY) / 2;

    return `M ${startX} ${startY} C ${startX} ${controlY}, ${endX} ${controlY}, ${endX} ${endY}`;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Custom Workflows"
        description="Design approval routing and lead visibility flowcharts dynamically."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Designer Sidebar controls */}
        <div className="space-y-6 lg:col-span-1">
          <Card title="Workflow Properties">
            <form onSubmit={handleSaveWorkflow} className="space-y-4">
              {editingWorkflowId && (
                <div className="flex justify-between items-center p-2.5 rounded-xl border border-primary/20 bg-primary/5 text-xs text-primary font-semibold">
                  <span>Editing: {workflowName}</span>
                  <button
                    type="button"
                    onClick={handleClearCanvas}
                    className="text-[10px] uppercase font-bold text-slate-500 hover:text-slate-700 border-none bg-transparent cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              )}
              <Input
                label="Workflow Name"
                required
                placeholder="e.g. Lead Hierarchy Flow"
                value={workflowName}
                onChange={(e) => setWorkflowName(e.target.value)}
              />

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Description
                </label>
                <textarea
                  className="w-full rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-50/50 dark:bg-[#071929]/50 px-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 outline-none transition-all focus:border-primary focus:bg-white dark:focus:border-primary-hover dark:focus:bg-[#071929] min-h-[80px]"
                  placeholder="Summarize the routing policies"
                  value={workflowDesc}
                  onChange={(e) => setWorkflowDesc(e.target.value)}
                />
              </div>

              <div className="border-t border-slate-100 dark:border-[#0d2336] pt-4 space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Add Role Node
                  </label>
                  <select
                    className="w-full rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-50/50 dark:bg-[#071929]/50 px-3.5 py-2.5 text-xs text-slate-900 dark:text-white outline-none transition-all focus:border-primary focus:bg-white dark:focus:border-primary-hover"
                    value={selectedRoleId}
                    onChange={(e) => setSelectedRoleId(e.target.value)}
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddNode}
                  icon={<FiPlus />}
                  className="w-full justify-center"
                >
                  Place Node on Canvas
                </Button>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClearCanvas}
                  className="w-1/2 justify-center"
                >
                  Clear Canvas
                </Button>
                <Button
                  type="submit"
                  loading={submitting}
                  className="w-1/2 justify-center"
                >
                  {editingWorkflowId ? "Save Changes" : "Save Flow"}
                </Button>
              </div>
            </form>
          </Card>

          <Card title="Active Workflows">
            <div className="space-y-3">
              {loading ? (
                <div className="text-center py-4 text-xs text-slate-400">
                  Loading active flows...
                </div>
              ) : workflows.length > 0 ? (
                workflows.map((wf) => (
                  <div
                    key={wf.id}
                    className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-50/30 dark:bg-[#071929]/20"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-800 dark:text-white truncate">
                        {wf.name}
                      </p>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">
                        {wf.description || "No description"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <button
                        type="button"
                        onClick={() => handleLoadWorkflow(wf)}
                        className="p-1.5 text-slate-400 hover:text-primary rounded-lg hover:bg-slate-100 dark:hover:bg-[#0d2336] border-none bg-transparent cursor-pointer"
                        title="Load & Edit Workflow"
                      >
                        <FiEdit2 className="text-sm" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenDeleteModal(wf)}
                        className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-slate-100 dark:hover:bg-[#0d2336] border-none bg-transparent cursor-pointer"
                        title="Delete Workflow"
                      >
                        <FiTrash2 className="text-sm" />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-xs text-slate-400 italic">
                  No active flows. Create one using the node designer!
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Designer Interactive Canvas Area */}
        <div className="lg:col-span-2 flex flex-col min-h-[500px]">
          <div className="flex-1 rounded-2xl border border-slate-200 dark:border-[#0d2336] bg-slate-900 overflow-hidden relative shadow-xl">
            <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-slate-950/80 backdrop-blur-md border border-slate-800 rounded-xl px-3 py-1.5 text-[10px] text-slate-350">
              <FiActivity className="text-primary animate-pulse" />
              <span>Canvas Designer: Click output handle, then click target input handle to connect nodes.</span>
            </div>

            <svg
              ref={canvasRef}
              className="w-full h-full min-h-[500px] cursor-crosshair select-none"
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onMouseLeave={handleCanvasMouseUp}
            >
              {/* Grid Background */}
              <defs>
                <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255, 255, 255, 0.05)" strokeWidth="1" />
                </pattern>
                <marker
                  id="arrow"
                  viewBox="0 0 10 10"
                  refX="6"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#3b82f6" />
                </marker>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />

              {/* Connections (Edges) */}
              {canvasEdges.map((edge) => {
                const srcNode = canvasNodes.find((n) => n.id === edge.source);
                const tgtNode = canvasNodes.find((n) => n.id === edge.target);
                if (!srcNode || !tgtNode) return null;

                const pathD = getBezierPath(srcNode, tgtNode);
                return (
                  <g key={edge.id} className="group">
                    {/* Glow outline path */}
                    <path
                      d={pathD}
                      fill="none"
                      stroke="rgba(59, 130, 246, 0.2)"
                      strokeWidth="6"
                      className="transition-all duration-200 group-hover:stroke-rgba(59, 130, 246, 0.4)"
                    />
                    {/* Solid path */}
                    <path
                      d={pathD}
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth="2.5"
                      markerEnd="url(#arrow)"
                      className="transition-all duration-200"
                    />
                    {/* Delete hover trigger */}
                    <circle
                      cx={(srcNode.x + tgtNode.x) / 2 + 80}
                      cy={(srcNode.y + tgtNode.y) / 2 + 30}
                      r="12"
                      className="fill-rose-500/10 stroke-rose-500 stroke-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer"
                      onClick={() => handleDeleteEdge(edge.id)}
                    />
                    <text
                      x={(srcNode.x + tgtNode.x) / 2 + 80}
                      y={(srcNode.y + tgtNode.y) / 2 + 34}
                      className="text-[8px] font-extrabold fill-rose-500 text-center select-none pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                      textAnchor="middle"
                    >
                      ✕
                    </text>
                  </g>
                );
              })}

              {/* HTML Overlay inside SVG for premium Draggable Cards */}
              <foreignObject x="0" y="0" width="100%" height="100%" className="pointer-events-none">
                <div className="w-full h-full relative pointer-events-auto">
                  {canvasNodes.map((node) => {
                    const isConnectingSource = connectingSourceId === node.id;
                    return (
                      <div
                        key={node.id}
                        style={{
                          left: node.x,
                          top: node.y,
                          width: "160px",
                          position: "absolute",
                        }}
                        className={`rounded-xl border bg-slate-950/80 backdrop-blur-md p-3 shadow-lg select-none cursor-grab transition-all ${
                          isConnectingSource
                            ? "border-primary shadow-primary/20 ring-1 ring-primary"
                            : "border-slate-800 hover:border-slate-600"
                        }`}
                        onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                      >
                        {/* Input Handle */}
                        <div
                          className="absolute -top-1.5 left-[73px] w-3.5 h-3.5 rounded-full border border-slate-700 bg-slate-900 flex items-center justify-center cursor-pointer hover:bg-primary-hover hover:border-primary-hover group/handle"
                          onClick={(e) => handleInputClick(e, node.id)}
                          title="Input Connection"
                        >
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        </div>

                        {/* Node Body */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteNode(node.id);
                            }}
                            className="absolute -top-1 -right-1 text-slate-500 hover:text-rose-500 transition-colors border-none bg-transparent cursor-pointer"
                          >
                            ✕
                          </button>

                          <div className="pr-4">
                            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold">
                              Role Node
                            </p>
                            <p className="text-xs font-bold text-white mt-1 truncate">
                              {node.roleName}
                            </p>
                          </div>
                        </div>

                        {/* Output Handle */}
                        <div
                          className="absolute -bottom-1.5 left-[73px] w-3.5 h-3.5 rounded-full border border-slate-700 bg-slate-900 flex items-center justify-center cursor-pointer hover:bg-primary-hover hover:border-primary-hover"
                          onClick={(e) => handleOutputClick(e, node.id)}
                          title="Connect Output"
                        >
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </foreignObject>
            </svg>
          </div>
        </div>
      </div>

      {/* Delete Workflow Confirmation Modal */}
      {showDeleteModal && workflowToDelete && (
        <Modal
          isOpen={showDeleteModal}
          onClose={() => { setShowDeleteModal(false); setWorkflowToDelete(null); }}
          title="Delete Custom Workflow"
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Are you sure you want to delete <span className="font-bold text-slate-800 dark:text-white">{workflowToDelete.name}</span>? This action is permanent and cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-[#0d2336]">
              <Button variant="outline" onClick={() => { setShowDeleteModal(false); setWorkflowToDelete(null); }}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleConfirmDeleteWorkflow} loading={deleting}>
                Delete Workflow
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
