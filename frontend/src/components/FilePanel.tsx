import { useEffect, useCallback, useState } from "react";
import { useStore } from "@/store/useStore";
import { useApi } from "@/hooks/useApi";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileTree } from "./FileTree";
import { CodeEditor } from "./CodeEditor";
import { FolderOpen, RefreshCw, X, ChevronRight, Box } from "lucide-react";

export function FilePanel() {
  const { fileTree, selectedFile, fileContent, setFileContent, openTabs, setSelectedFile, removeTab, sandboxStatus } = useStore();
  const { fetchFileTree, refreshFileTree, readFile } = useApi();
  const [isRefreshing, setIsRefreshing] = useState(false);

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

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshFileTree();
    } finally {
      setIsRefreshing(false);
    }
  };

  const getFileIcon = (filename: string) => {
    const ext = filename.split(".").pop()?.toLowerCase();
    
    const colors: Record<string, string> = {
      tsx: "text-blue-500",
      ts: "text-blue-500",
      jsx: "text-yellow-500",
      js: "text-yellow-500",
      css: "text-purple-500",
      scss: "text-pink-500",
      json: "text-yellow-600",
      py: "text-green-500",
      html: "text-orange-500",
      md: "text-gray-500",
    };
    
    return (
      <svg className={`w-4 h-4 ${colors[ext || ""] || "text-muted-foreground"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    );
  };

  const getFileName = (path: string) => path.split("/").pop() || path;

  const getBreadcrumb = (path: string) => {
    const parts = path.split("/").filter(Boolean);
    return parts;
  };

  const hasFiles = fileTree && fileTree.children && fileTree.children.length > 0;

  return (
    <div data-design-id="file-panel" className="flex flex-col sm:flex-row h-full">
      <div data-design-id="file-explorer" className="w-full sm:w-40 md:w-48 lg:w-56 h-[30%] xs:h-[35%] sm:h-full bg-secondary/50 border-b sm:border-b-0 sm:border-r border-border flex flex-col flex-shrink-0">
        <div className="flex items-center justify-between px-2 xs:px-3 py-2 xs:py-3 border-b border-border">
          <div className="flex items-center gap-1.5 xs:gap-2">
            <FolderOpen className="w-3.5 h-3.5 xs:w-4 xs:h-4 text-muted-foreground" />
            <span className="text-[10px] xs:text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Explorer</span>
            {sandboxStatus === "ready" && (
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-green-500/10 border border-green-500/20">
                <Box className="w-2.5 h-2.5 text-green-500" />
                <span className="text-[8px] text-green-500 font-medium">E2B</span>
              </div>
            )}
          </div>
          <button
            data-design-id="refresh-files-btn"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className={`p-1 xs:p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent active:bg-accent transition-colors ${isRefreshing ? 'animate-spin' : ''}`}
            title="Refresh files from E2B sandbox"
          >
            <RefreshCw className="w-3 h-3 xs:w-3.5 xs:h-3.5" />
          </button>
        </div>
        
        <ScrollArea className="flex-1">
          <div className="py-1 xs:py-2">
            {hasFiles ? (
              <FileTree node={fileTree} level={0} />
            ) : (
              <div className="px-3 xs:px-4 py-6 xs:py-8 text-center">
                <div className="w-10 h-10 mx-auto mb-3 rounded-xl bg-muted flex items-center justify-center">
                  <Box className="w-5 h-5 text-muted-foreground" />
                </div>
                <p className="text-[11px] xs:text-xs text-muted-foreground mb-1">No files yet</p>
                <p className="text-[10px] xs:text-[11px] text-muted-foreground/70">
                  {sandboxStatus === "ready" 
                    ? "Files will appear here when created" 
                    : "Start a chat to create files in E2B sandbox"}
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
      
      <div data-design-id="code-editor-area" className="flex-1 flex flex-col min-w-0 min-h-0 bg-[#f8f8f7]">
        <div className="flex items-center h-8 xs:h-9 sm:h-10 bg-card border-b border-border px-1 xs:px-2 gap-0.5 xs:gap-1 overflow-x-auto scrollbar-none">
          {openTabs.map((tab) => (
            <div
              key={tab}
              onClick={() => setSelectedFile(tab)}
              className={`flex items-center gap-1 xs:gap-2 px-2 xs:px-3 py-1 xs:py-1.5 cursor-pointer rounded-t-md xs:rounded-t-lg transition-colors text-[11px] xs:text-sm flex-shrink-0 ${
                selectedFile === tab
                  ? "bg-background border-t-2 border-t-primary text-foreground"
                  : "text-muted-foreground hover:bg-accent active:bg-accent"
              }`}
            >
              {getFileIcon(tab)}
              <span className="truncate max-w-[60px] xs:max-w-[80px] sm:max-w-[100px]">{getFileName(tab)}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeTab(tab);
                }}
                className="p-0.5 rounded hover:bg-accent active:bg-accent/80 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
        
        {selectedFile ? (
          <>
            <div className="flex items-center h-6 xs:h-7 px-2 xs:px-4 bg-card border-b border-border overflow-x-auto scrollbar-none">
              <div className="flex items-center gap-1 xs:gap-1.5 text-[9px] xs:text-[11px] font-mono text-muted-foreground whitespace-nowrap">
                {getBreadcrumb(selectedFile).map((part, i, arr) => (
                  <span key={i} className="flex items-center gap-1 xs:gap-1.5">
                    <span className={i === arr.length - 1 ? "text-foreground" : ""}>{part}</span>
                    {i < arr.length - 1 && <ChevronRight className="w-2.5 h-2.5 xs:w-3 xs:h-3" />}
                  </span>
                ))}
              </div>
            </div>
            
            <CodeEditor content={fileContent} filePath={selectedFile} />
            
            <div className="flex items-center justify-between h-5 xs:h-6 px-2 xs:px-3 bg-card border-t border-border text-[8px] xs:text-[10px] text-muted-foreground">
              <div className="flex items-center gap-2 xs:gap-4">
                <span className="hidden xs:inline">{getFileType(selectedFile)}</span>
                <span>UTF-8</span>
              </div>
              <div className="flex items-center gap-2 xs:gap-4">
                <span>Ln 1, Col 1</span>
                <span className="hidden xs:inline">Spaces: 2</span>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center px-4">
              <div className="w-12 h-12 xs:w-14 xs:h-14 sm:w-16 sm:h-16 mx-auto mb-3 xs:mb-4 rounded-xl xs:rounded-2xl bg-accent flex items-center justify-center">
                <svg className="w-6 h-6 xs:w-7 xs:h-7 sm:w-8 sm:h-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-[11px] xs:text-xs sm:text-sm text-muted-foreground">Select a file to view</p>
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