import { useEffect, useCallback } from "react";
import { useStore } from "@/store/useStore";
import { useApi } from "@/hooks/useApi";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileTree } from "./FileTree";
import { CodeEditor } from "./CodeEditor";

export function FilePanel() {
  const { fileTree, selectedFile, fileContent, setFileContent, openTabs, setSelectedFile, removeTab } = useStore();
  const { fetchFileTree, readFile } = useApi();

  useEffect(() => {
    fetchFileTree();
  }, [fetchFileTree]);

  const loadFileContent = useCallback(async () => {
    if (selectedFile) {
      const content = await readFile(selectedFile);
      setFileContent(content);
    }
  }, [selectedFile, readFile, setFileContent]);

  useEffect(() => {
    loadFileContent();
  }, [loadFileContent]);

  const getFileIcon = (filename: string) => {
    const ext = filename.split(".").pop()?.toLowerCase();
    
    if (["tsx", "ts", "jsx", "js"].includes(ext || "")) {
      return (
        <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        </svg>
      );
    }
    if (["css", "scss", "sass"].includes(ext || "")) {
      return (
        <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      );
    }
    if (["json"].includes(ext || "")) {
      return (
        <svg className="w-4 h-4 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      );
    }
    if (["py"].includes(ext || "")) {
      return (
        <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        </svg>
      );
    }
    
    return (
      <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    );
  };

  const getFileName = (path: string) => path.split("/").pop() || path;

  const getBreadcrumb = (path: string) => {
    const parts = path.split("/").filter(Boolean);
    return parts;
  };

  return (
    <div data-design-id="file-panel" className="flex-1 min-w-0 flex h-full">
      {/* File Explorer Sidebar */}
      <div data-design-id="file-explorer" className="w-56 lg:w-64 bg-[#232323] border-r border-border/30 flex flex-col">
        <div className="flex items-center justify-between px-3 py-3 border-b border-border/50">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Explorer</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => fetchFileTree()}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>
        
        <ScrollArea className="flex-1">
          <div className="py-2">
            {fileTree ? (
              <FileTree node={fileTree} level={0} />
            ) : (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No files yet. Start building!
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
      
      {/* Code Editor Area */}
      <div data-design-id="code-editor-area" className="flex-1 flex flex-col min-w-0 bg-[#1e1e1e]">
        {/* Editor Tabs Bar */}
        <div className="flex items-center h-10 bg-[#1e1e1e] border-b border-border/30 px-2 gap-1 overflow-x-auto">
          {openTabs.map((tab) => (
            <div
              key={tab}
              onClick={() => setSelectedFile(tab)}
              className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer rounded-t-lg transition-colors ${
                selectedFile === tab
                  ? "bg-background border-t-2 border-t-primary"
                  : "text-muted-foreground hover:bg-white/5"
              }`}
            >
              {getFileIcon(tab)}
              <span className="text-xs font-medium truncate max-w-[100px]">{getFileName(tab)}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeTab(tab);
                }}
                className="p-0.5 rounded hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
        
        {selectedFile ? (
          <>
            {/* Breadcrumb */}
            <div className="flex items-center h-7 px-4 bg-[#1e1e1e] border-b border-border/20">
              <div className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground">
                {getBreadcrumb(selectedFile).map((part, i, arr) => (
                  <span key={i} className="flex items-center gap-1.5">
                    <span className={i === arr.length - 1 ? "text-foreground" : ""}>{part}</span>
                    {i < arr.length - 1 && (
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    )}
                  </span>
                ))}
              </div>
            </div>
            
            {/* Code Content */}
            <CodeEditor content={fileContent} filePath={selectedFile} />
            
            {/* Status Bar */}
            <div className="flex items-center justify-between h-6 px-3 bg-[#232323] border-t border-border/30 text-[10px] text-muted-foreground">
              <div className="flex items-center gap-4">
                <span>{getFileType(selectedFile)}</span>
                <span>UTF-8</span>
              </div>
              <div className="flex items-center gap-4">
                <span>Ln 1, Col 1</span>
                <span>Spaces: 2</span>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-sm text-muted-foreground">Select a file to view its contents</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function getFileType(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  const types: Record<string, string> = {
    tsx: "TypeScript React",
    ts: "TypeScript",
    jsx: "JavaScript React",
    js: "JavaScript",
    css: "CSS",
    scss: "SCSS",
    json: "JSON",
    py: "Python",
    html: "HTML",
    md: "Markdown",
  };
  return types[ext || ""] || "Plain Text";
}