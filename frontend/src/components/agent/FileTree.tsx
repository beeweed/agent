import { useState } from "react";
import { ChevronRight, ChevronDown, File, Folder, FolderOpen, RefreshCw, Trash2 } from "lucide-react";
import type { FileNode } from "@/lib/api";

interface FileTreeProps {
  files: FileNode[];
  onSelectFile: (path: string) => void;
  selectedFile: string | null;
  onRefresh: () => void;
  onClear: () => void;
}

function getFileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  const colorMap: Record<string, string> = {
    ts: "text-blue-400",
    tsx: "text-blue-400",
    js: "text-yellow-400",
    jsx: "text-yellow-400",
    py: "text-green-400",
    json: "text-yellow-500",
    css: "text-purple-400",
    html: "text-orange-400",
    md: "text-gray-400",
    txt: "text-gray-400",
    yaml: "text-pink-400",
    yml: "text-pink-400",
    toml: "text-orange-300",
    sh: "text-green-300",
    sql: "text-cyan-400",
    rs: "text-orange-500",
    go: "text-cyan-300",
    java: "text-red-400",
    rb: "text-red-500",
    php: "text-indigo-400",
    svg: "text-yellow-300",
    png: "text-pink-300",
    env: "text-yellow-600",
  };
  return colorMap[ext] || "text-[#a1a1aa]";
}

function FileTreeNode({
  node,
  depth,
  onSelect,
  selected,
}: {
  node: FileNode;
  depth: number;
  onSelect: (path: string) => void;
  selected: string | null;
}) {
  const [open, setOpen] = useState(true);
  const isSelected = selected === node.path;

  if (node.is_dir) {
    return (
      <div data-design-id={`file-tree-dir-${node.name}`}>
        <div
          className="flex items-center gap-1.5 px-2 py-1.5 cursor-pointer hover:bg-white/5 transition-all duration-150"
          style={{ paddingLeft: `${12 + depth * 16}px` }}
          onClick={() => setOpen(!open)}
        >
          {open ? (
            <ChevronDown className="w-3 h-3 text-[#a1a1aa]" />
          ) : (
            <ChevronRight className="w-3 h-3 text-[#a1a1aa]" />
          )}
          {open ? (
            <FolderOpen className="w-4 h-4 text-yellow-500" />
          ) : (
            <Folder className="w-4 h-4 text-yellow-500" />
          )}
          <span className="text-[13px] text-[#f0f0f0] font-medium">{node.name}</span>
        </div>
        {open && node.children && (
          <div>
            {node.children.map((child) => (
              <FileTreeNode
                key={child.path}
                node={child}
                depth={depth + 1}
                onSelect={onSelect}
                selected={selected}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      data-design-id={`file-tree-file-${node.name}`}
      className={`flex items-center gap-1.5 px-2 py-1.5 cursor-pointer rounded-lg transition-all duration-150 ${
        isSelected
          ? "bg-[#6366f1]/15 text-[#6366f1]"
          : "hover:bg-white/5 text-[#f0f0f0]"
      }`}
      style={{ paddingLeft: `${28 + depth * 16}px` }}
      onClick={() => onSelect(node.path)}
    >
      <File className={`w-4 h-4 ${getFileIcon(node.name)}`} />
      <span className="text-[13px]">{node.name}</span>
    </div>
  );
}

export default function FileTree({ files, onSelectFile, selectedFile, onRefresh, onClear }: FileTreeProps) {
  return (
    <div data-design-id="file-tree-panel" className="flex flex-col h-full bg-[#232323]">
      <div data-design-id="file-tree-header" className="flex items-center justify-between px-3 py-3 border-b border-[#404040]/50">
        <div className="flex items-center gap-2">
          <Folder className="w-4 h-4 text-[#a1a1aa]" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#a1a1aa]">
            Explorer
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            data-design-id="file-tree-refresh-btn"
            onClick={onRefresh}
            className="p-1.5 rounded-md text-[#a1a1aa] hover:text-[#f0f0f0] hover:bg-white/5 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            data-design-id="file-tree-clear-btn"
            onClick={onClear}
            className="p-1.5 rounded-md text-[#a1a1aa] hover:text-red-400 hover:bg-white/5 transition-colors"
            title="Clear workspace"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div data-design-id="file-tree-content" className="flex-1 overflow-y-auto py-2">
        {files.length === 0 ? (
          <div data-design-id="file-tree-empty" className="flex flex-col items-center justify-center h-full text-[#a1a1aa] text-xs px-4 text-center">
            <Folder className="w-8 h-8 mb-2 opacity-30" />
            <p>No files yet</p>
            <p className="mt-1 opacity-60">Files created by the agent will appear here</p>
          </div>
        ) : (
          files.map((node) => (
            <FileTreeNode
              key={node.path}
              node={node}
              depth={0}
              onSelect={onSelectFile}
              selected={selectedFile}
            />
          ))
        )}
      </div>
    </div>
  );
}