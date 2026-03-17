import { X, FileCode2, Copy, Check } from "lucide-react";
import { useState } from "react";

interface FileViewerProps {
  path: string;
  content: string;
  onClose: () => void;
}

function getLanguage(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    ts: "TypeScript",
    tsx: "TypeScript React",
    js: "JavaScript",
    jsx: "JavaScript React",
    py: "Python",
    json: "JSON",
    css: "CSS",
    html: "HTML",
    md: "Markdown",
    txt: "Plain Text",
    yaml: "YAML",
    yml: "YAML",
    toml: "TOML",
    sh: "Shell",
    sql: "SQL",
    rs: "Rust",
    go: "Go",
    java: "Java",
    rb: "Ruby",
    php: "PHP",
    svg: "SVG",
    xml: "XML",
    env: "Environment",
  };
  return map[ext] || "Plain Text";
}

export default function FileViewer({ path, content, onClose }: FileViewerProps) {
  const [copied, setCopied] = useState(false);
  const fileName = path.split("/").pop() || path;
  const lang = getLanguage(path);
  const lines = content.split("\n");

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div data-design-id="file-viewer" className="flex flex-col h-full bg-[#1e1e1e]">
      <div data-design-id="file-viewer-tabs" className="flex items-center h-10 bg-[#1e1e1e] border-b border-[#404040]/30 px-2">
        <div data-design-id="file-viewer-active-tab" className="flex items-center gap-2 px-3 py-1.5 bg-[#272727] border-t-2 border-t-[#6366f1] rounded-t-lg">
          <FileCode2 className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-medium text-[#f0f0f0]">{fileName}</span>
          <button
            data-design-id="file-viewer-close-tab"
            onClick={onClose}
            className="p-0.5 rounded hover:bg-white/10 text-[#a1a1aa] hover:text-[#f0f0f0] transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div data-design-id="file-viewer-breadcrumb" className="flex items-center justify-between h-7 px-4 bg-[#1e1e1e] border-b border-[#404040]/20">
        <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#a1a1aa]">
          {path.split("/").map((part, i, arr) => (
            <span key={i} className="flex items-center gap-1.5">
              <span className={i === arr.length - 1 ? "text-[#f0f0f0]" : ""}>{part}</span>
              {i < arr.length - 1 && <span className="text-[#555]">/</span>}
            </span>
          ))}
        </div>
        <button
          data-design-id="file-viewer-copy-btn"
          onClick={handleCopy}
          className="flex items-center gap-1 text-[10px] text-[#a1a1aa] hover:text-[#f0f0f0] transition-colors"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <div data-design-id="file-viewer-code" className="flex-1 overflow-auto">
        <div className="flex">
          <div data-design-id="file-viewer-line-numbers" className="flex-shrink-0 px-3 py-4 text-right select-none border-r border-[#404040]/20">
            {lines.map((_, i) => (
              <div key={i} className="text-[12px] leading-6 font-mono text-[#555]">
                {i + 1}
              </div>
            ))}
          </div>
          <pre data-design-id="file-viewer-code-content" className="flex-1 p-4 overflow-x-auto">
            <code className="text-[13px] leading-6 font-mono text-[#abb2bf]">{content}</code>
          </pre>
        </div>
      </div>

      <div data-design-id="file-viewer-statusbar" className="flex items-center justify-between h-6 px-3 bg-[#232323] border-t border-[#404040]/30 text-[10px] text-[#a1a1aa]">
        <div className="flex items-center gap-4">
          <span>{lang}</span>
          <span>UTF-8</span>
        </div>
        <div className="flex items-center gap-4">
          <span>{lines.length} lines</span>
          <span>Spaces: 2</span>
        </div>
      </div>
    </div>
  );
}