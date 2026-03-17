import { useState } from "react";
import { CheckCircle2, Loader2, AlertCircle, ChevronRight, ChevronDown, FileCode2 } from "lucide-react";
import type { ToolCallInfo } from "@/lib/store";

interface ToolCallBlockProps {
  toolCall: ToolCallInfo;
}

export default function ToolCallBlock({ toolCall }: ToolCallBlockProps) {
  const [expanded, setExpanded] = useState(false);

  const statusIcon = {
    running: <Loader2 className="w-4 h-4 text-[#6366f1] animate-spin" />,
    success: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
    error: <AlertCircle className="w-4 h-4 text-red-500" />,
  }[toolCall.status];

  const statusBadge = {
    running: (
      <span data-design-id="tool-badge-running" className="text-[10px] px-1.5 py-0.5 rounded-md bg-[#6366f1]/15 text-[#6366f1] animate-pulse">
        writing...
      </span>
    ),
    success: (
      <span data-design-id="tool-badge-success" className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400">
        created
      </span>
    ),
    error: (
      <span data-design-id="tool-badge-error" className="text-[10px] px-1.5 py-0.5 rounded-md bg-red-500/15 text-red-400">
        failed
      </span>
    ),
  }[toolCall.status];

  const borderColor = {
    running: "border-[#6366f1]/20",
    success: "border-emerald-500/20",
    error: "border-red-500/20",
  }[toolCall.status];

  return (
    <div data-design-id="tool-call-block" className="space-y-1">
      <div
        data-design-id="tool-call-file-card"
        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[#2a2a2c] hover:bg-[#323234] border ${borderColor} cursor-pointer transition-all duration-200 group`}
        onClick={() => setExpanded(!expanded)}
      >
        <div data-design-id="tool-call-icon" className={`w-9 h-9 rounded-lg flex items-center justify-center ${
          toolCall.status === "success" ? "bg-emerald-500/10" : toolCall.status === "error" ? "bg-red-500/10" : "bg-[#6366f1]/10"
        }`}>
          {statusIcon}
        </div>
        <div data-design-id="tool-call-info" className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span data-design-id="tool-call-path" className="text-sm font-medium text-[#f0f0f0] truncate">
              {toolCall.filePath || toolCall.name}
            </span>
            {statusBadge}
          </div>
          <span data-design-id="tool-call-name" className="text-xs text-[#a1a1aa]">
            {toolCall.name === "file_write" ? "File operation" : toolCall.name}
          </span>
        </div>
        <div data-design-id="tool-call-chevron">
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-[#a1a1aa] group-hover:text-[#f0f0f0] transition-colors" />
          ) : (
            <ChevronRight className="w-4 h-4 text-[#a1a1aa] group-hover:text-[#f0f0f0] transition-colors" />
          )}
        </div>
      </div>

      {expanded && (
        <div data-design-id="tool-call-expanded" className="ml-12 rounded-lg bg-[#1e1e1e] border border-[#404040]/30 p-3 text-xs font-mono text-[#a1a1aa] overflow-x-auto max-h-48 overflow-y-auto">
          <div className="text-[#6366f1] mb-1">// Tool Arguments</div>
          <pre className="whitespace-pre-wrap break-all">
            {JSON.stringify(
              { ...toolCall.args, content: toolCall.args.content ? (String(toolCall.args.content).substring(0, 200) + (String(toolCall.args.content).length > 200 ? "..." : "")) : undefined },
              null,
              2
            )}
          </pre>
          {toolCall.result && (
            <>
              <div className="text-emerald-400 mt-2 mb-1">// Result</div>
              <pre className="whitespace-pre-wrap break-all">{toolCall.result}</pre>
            </>
          )}
        </div>
      )}
    </div>
  );
}