"use client";

import { useEffect, useRef, useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { FiEdit3, FiType, FiCheckCircle, FiRotateCcw, FiTrash2, FiDownload } from "react-icons/fi";

interface DocumentAnnotationModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentTitle: string;
}

export default function DocumentAnnotationModal({
  isOpen,
  onClose,
  documentTitle,
}: DocumentAnnotationModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [tool, setTool] = useState<"pen" | "highlighter" | "text" | "stamp">("pen");
  const [color, setColor] = useState("#ef4444"); // Default red
  const [lineWidth] = useState(3);
  const [isDrawing, setIsDrawing] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [textPos, setTextPos] = useState<{ x: number; y: number } | null>(null);
  const historyRef = useRef<ImageData[]>([]);

  // Initialize canvas size based on container
  useEffect(() => {
    if (!isOpen || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = 800;
    const height = 950;
    canvas.width = width;
    canvas.height = height;

    // Save initial state
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    ctx.font = "bold 22px sans-serif";
    ctx.fillStyle = "#1e293b";
    ctx.fillText(`DOCUMENT WORKSPACE: ${documentTitle}`, 40, 50);

    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1;
    ctx.strokeRect(30, 70, 740, 840);

    historyRef.current = [ctx.getImageData(0, 0, width, height)];
  }, [isOpen, documentTitle]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);

    if (tool === "text") {
      setTextPos({ x, y });
      return;
    }

    if (tool === "stamp") {
      ctx.font = "bold 16px sans-serif";
      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(x - 60, y - 20, 120, 40);
      ctx.fillText("APPROVED ✓", x - 45, y + 5);
      saveState();
      return;
    }

    setIsDrawing(true);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = tool === "highlighter" ? "rgba(253, 224, 71, 0.5)" : color;
    ctx.lineWidth = tool === "highlighter" ? 18 : lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      saveState();
    }
  };

  const saveState = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    historyRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
  };

  const handleAddText = () => {
    if (!textPos || !textInput.trim() || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.font = "16px sans-serif";
    ctx.fillStyle = color;
    ctx.fillText(textInput.trim(), textPos.x, textPos.y);
    saveState();
    setTextPos(null);
    setTextInput("");
  };

  const handleUndo = () => {
    const canvas = canvasRef.current;
    if (!canvas || historyRef.current.length <= 1) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    historyRef.current.pop();
    const prevState = historyRef.current[historyRef.current.length - 1];
    ctx.putImageData(prevState, 0, 0);
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    saveState();
  };

  const handleExport = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `${documentTitle.replace(/\s+/g, "_")}_annotated.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Annotate & Stamp: ${documentTitle}`} size="xl">
      <div className="flex flex-col gap-4">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between p-3 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={tool === "pen" ? "primary" : "outline"}
              onClick={() => setTool("pen")}
            >
              <FiEdit3 className="w-4 h-4 mr-1" /> Pen
            </Button>
            <Button
              size="sm"
              variant={tool === "highlighter" ? "primary" : "outline"}
              onClick={() => setTool("highlighter")}
            >
              Highlighter
            </Button>
            <Button
              size="sm"
              variant={tool === "text" ? "primary" : "outline"}
              onClick={() => setTool("text")}
            >
              <FiType className="w-4 h-4 mr-1" /> Add Text
            </Button>
            <Button
              size="sm"
              variant={tool === "stamp" ? "primary" : "outline"}
              onClick={() => setTool("stamp")}
            >
              <FiCheckCircle className="w-4 h-4 mr-1" /> Stamp Approved
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Color:</label>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-7 h-7 rounded cursor-pointer border-0"
              />
            </div>

            <Button size="sm" variant="outline" onClick={handleUndo}>
              <FiRotateCcw className="w-4 h-4 mr-1" /> Undo
            </Button>
            <Button size="sm" variant="danger" onClick={handleClear}>
              <FiTrash2 className="w-4 h-4 mr-1" /> Clear
            </Button>
          </div>
        </div>

        {/* Text Input Overlay */}
        {textPos && (
          <div className="flex items-center gap-2 p-2 bg-amber-50 border border-amber-300 rounded shadow-md">
            <input
              type="text"
              placeholder="Enter annotation text..."
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              className="px-3 py-1 text-sm border rounded flex-1 dark:bg-slate-900 dark:text-white"
              autoFocus
            />
            <Button size="sm" variant="primary" onClick={handleAddText}>
              Place Text
            </Button>
            <Button size="sm" variant="outline" onClick={() => setTextPos(null)}>
              Cancel
            </Button>
          </div>
        )}

        {/* Canvas Workspace */}
        <div className="relative w-full max-h-[600px] overflow-auto border border-slate-300 dark:border-slate-700 rounded-lg shadow-inner bg-slate-50 flex justify-center py-4">
          <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            className="cursor-crosshair shadow-lg rounded border border-slate-200 bg-white"
          />
        </div>

        {/* Footer actions */}
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button variant="primary" onClick={handleExport}>
            <FiDownload className="w-4 h-4 mr-1" /> Export Annotated Document
          </Button>
        </div>
      </div>
    </Modal>
  );
}
