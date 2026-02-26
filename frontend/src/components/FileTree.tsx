import { useState } from "react";
import { useStore } from "@/store/useStore";
import type { FileNode } from "@/types";

interface FileTreeProps {
  node: FileNode;
  level: number;
}

export function FileTree({ node, level }: FileTreeProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const { selectedFile, setSelectedFile, addTab } = useStore();

  const handleClick = () => {
    if (node.type === "folder") {
      setIsExpanded(!isExpanded);
    } else {
      setSelectedFile(node.path);
      addTab(node.path);
    }
  };

  const getFileIcon = () => {
    const iconClass = "w-3.5 h-3.5 xs:w-4 xs:h-4";
    
    if (node.type === "folder") {
      return (
        <svg className={`${iconClass} text-yellow-500`} fill="currentColor" viewBox="0 0 24 24">
          <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
        </svg>
      );
    }

    const ext = node.name.split(".").pop()?.toLowerCase();
    
    if (["tsx", "ts", "jsx", "js"].includes(ext || "")) {
      return (
        <svg className={`${iconClass} text-blue-400`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        </svg>
      );
    }
    if (["css", "scss", "sass"].includes(ext || "")) {
      return (
        <svg className={`${iconClass} text-purple-400`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      );
    }
    if (["json"].includes(ext || "")) {
      return (
        <svg className={`${iconClass} text-yellow-400`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      );
    }
    if (["py"].includes(ext || "")) {
      return (
        <svg className={`${iconClass} text-green-400`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        </svg>
      );
    }
    if (["html"].includes(ext || "")) {
      return (
        <svg className={`${iconClass} text-orange-400`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      );
    }
    if (["md", "txt"].includes(ext || "")) {
      return (
        <svg className={`${iconClass} text-gray-400`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      );
    }
    
    return (
      <svg className={`${iconClass} text-muted-foreground`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    );
  };

  const isSelected = selectedFile === node.path;
  const paddingLeft = level * 12 + 6;

  return (
    <div data-design-id={`file-tree-${node.path}`}>
      <div
        onClick={handleClick}
        style={{ paddingLeft }}
        className={`flex items-center gap-1 xs:gap-1.5 px-1.5 xs:px-2 py-2 xs:py-1.5 cursor-pointer transition-all duration-150 active:bg-accent ${
          isSelected
            ? "bg-primary/15 text-primary rounded-md xs:rounded-lg"
            : "hover:bg-white/5"
        }`}
      >
        {node.type === "folder" && (
          <svg
            className={`w-2.5 h-2.5 xs:w-3 xs:h-3 text-muted-foreground transition-transform flex-shrink-0 ${
              isExpanded ? "rotate-90" : ""
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        )}
        {node.type === "file" && <div className="w-2.5 xs:w-3 flex-shrink-0" />}
        <span className="flex-shrink-0">{getFileIcon()}</span>
        <span className="text-[11px] xs:text-[13px] truncate">{node.name}</span>
      </div>
      
      {node.type === "folder" && isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTree key={child.path} node={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}