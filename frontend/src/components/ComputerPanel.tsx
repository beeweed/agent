import { useEffect, useRef, useMemo } from "react";
import { useStore } from "@/store/useStore";
import { Monitor, Code, Play, SkipBack, SkipForward, BookOpen, Replace, Plus, Trash2 } from "lucide-react";
import hljs from "highlight.js";
import "highlight.js/styles/github.css";

// Diff view component for replace_in_file tool
function DiffView({ filePath, oldString, newString }: { filePath: string; oldString: string; newString: string }) {
  // Get file content context for the diff
  const oldLines = oldString.split('\n');
  const newLines = newString.split('\n');
  
  return (
    <div className="font-mono text-[10px] xs:text-[11px] sm:text-[13px] leading-5 xs:leading-6 sm:leading-7">
      {/* File path header */}
      <div className="px-3 py-2 bg-zinc-200 border-b border-zinc-300 text-zinc-600 font-medium">
        {filePath}
      </div>
      
      {/* Diff content */}
      <div className="divide-y divide-zinc-200">
        {/* Removed lines (old_string) */}
        <div className="bg-red-50">
          <div className="px-2 py-1 text-[9px] xs:text-[10px] text-red-600 font-medium uppercase tracking-wide border-b border-red-100">
            Removed
          </div>
          {oldLines.map((line, index) => (
            <div key={`old-${index}`} className="flex group hover:bg-red-100/50">
              <span className="select-none w-8 sm:w-10 text-right pr-3 text-red-300 flex-shrink-0 bg-red-100/30">
                -
              </span>
              <span className="flex-1 text-red-700 bg-red-50 px-2 whitespace-pre-wrap break-all">
                {line || '\u00A0'}
              </span>
            </div>
          ))}
        </div>
        
        {/* Added lines (new_string) */}
        <div className="bg-green-50">
          <div className="px-2 py-1 text-[9px] xs:text-[10px] text-green-600 font-medium uppercase tracking-wide border-b border-green-100">
            Added
          </div>
          {newLines.map((line, index) => (
            <div key={`new-${index}`} className="flex group hover:bg-green-100/50">
              <span className="select-none w-8 sm:w-10 text-right pr-3 text-green-300 flex-shrink-0 bg-green-100/30">
                +
              </span>
              <span className="flex-1 text-green-700 bg-green-50 px-2 whitespace-pre-wrap break-all">
                {line || '\u00A0'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Insert view component for insert_line tool
function InsertView({ filePath, insertLine, newStr }: { filePath: string; insertLine: number; newStr: string }) {
  const newLines = newStr.split('\n');
  
  return (
    <div className="font-mono text-[10px] xs:text-[11px] sm:text-[13px] leading-5 xs:leading-6 sm:leading-7">
      {/* File path header */}
      <div className="px-3 py-2 bg-zinc-200 border-b border-zinc-300 text-zinc-600 font-medium">
        {filePath}
      </div>
      
      {/* Insert info */}
      <div className="px-3 py-2 bg-blue-50 border-b border-blue-200 text-blue-600 text-[10px] xs:text-[11px]">
        Inserting after line {insertLine}
      </div>
      
      {/* Inserted lines (new_str) - all highlighted in green */}
      <div className="bg-green-50">
        <div className="px-2 py-1 text-[9px] xs:text-[10px] text-green-600 font-medium uppercase tracking-wide border-b border-green-100">
          Inserted Lines
        </div>
        {newLines.map((line, index) => (
          <div key={`insert-${index}`} className="flex group hover:bg-green-100/50">
            <span className="select-none w-8 sm:w-10 text-right pr-3 text-green-400 flex-shrink-0 bg-green-100/30">
              {insertLine + index + 1}
            </span>
            <span className="select-none w-6 sm:w-8 text-center text-green-500 flex-shrink-0 bg-green-100/50">
              +
            </span>
            <span className="flex-1 text-green-700 bg-green-50 px-2 whitespace-pre-wrap break-all">
              {line || '\u00A0'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Delete view component for delete_lines_from_file tool
function DeleteView({ filePath, deletedLines, startLine, endLine }: { filePath: string; deletedLines: string; startLine: number; endLine: number }) {
  const lines = deletedLines.split('\n');
  
  return (
    <div className="font-mono text-[10px] xs:text-[11px] sm:text-[13px] leading-5 xs:leading-6 sm:leading-7">
      {/* File path header */}
      <div className="px-3 py-2 bg-zinc-200 border-b border-zinc-300 text-zinc-600 font-medium">
        {filePath}
      </div>
      
      {/* Delete info */}
      <div className="px-3 py-2 bg-red-50 border-b border-red-200 text-red-600 text-[10px] xs:text-[11px]">
        Deleting line{startLine !== endLine ? `s ${startLine}-${endLine}` : ` ${startLine}`}
      </div>
      
      {/* Deleted lines - all highlighted in red */}
      <div className="bg-red-50">
        <div className="px-2 py-1 text-[9px] xs:text-[10px] text-red-600 font-medium uppercase tracking-wide border-b border-red-100">
          Deleted Lines
        </div>
        {lines.map((line, index) => (
          <div key={`delete-${index}`} className="flex group hover:bg-red-100/50">
            <span className="select-none w-8 sm:w-10 text-right pr-3 text-red-400 flex-shrink-0 bg-red-100/30">
              {startLine + index}
            </span>
            <span className="select-none w-6 sm:w-8 text-center text-red-500 flex-shrink-0 bg-red-100/50">
              -
            </span>
            <span className="flex-1 text-red-700 bg-red-50 px-2 whitespace-pre-wrap break-all">
              {line || '\u00A0'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ComputerPanel() {
  const { codeStreaming, isAgentRunning } = useStore();
  const codeContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (codeContainerRef.current) {
      codeContainerRef.current.scrollTop = codeContainerRef.current.scrollHeight;
    }
  }, [codeStreaming.content]);

  const getFileName = (path: string) => {
    return path.split("/").pop() || "Untitled";
  };

  // Detect language from file extension
  const getLanguageFromPath = (filePath: string): string => {
    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    const langMap: Record<string, string> = {
      'ts': 'typescript',
      'tsx': 'typescript',
      'js': 'javascript',
      'jsx': 'javascript',
      'py': 'python',
      'json': 'json',
      'css': 'css',
      'html': 'html',
      'md': 'markdown',
      'yaml': 'yaml',
      'yml': 'yaml',
      'sh': 'bash',
      'bash': 'bash',
      'sql': 'sql',
      'xml': 'xml',
    };
    return langMap[ext] || 'plaintext';
  };

  // Highlight the entire code block using highlight.js
  const highlightedCode = useMemo(() => {
    if (!codeStreaming.content) return null;
    
    const language = codeStreaming.filePath 
      ? getLanguageFromPath(codeStreaming.filePath) 
      : 'plaintext';
    
    try {
      const result = hljs.highlight(codeStreaming.content, { 
        language,
        ignoreIllegals: true 
      });
      return result.value;
    } catch {
      // Fallback to auto-detection if specific language fails
      try {
        const result = hljs.highlightAuto(codeStreaming.content);
        return result.value;
      } catch {
        return codeStreaming.content;
      }
    }
  }, [codeStreaming.content, codeStreaming.filePath]);

  const renderCodeWithLineNumbers = (highlightedHtml: string) => {
    if (!highlightedHtml) return null;
    
    // Split by newlines, preserving HTML tags
    const lines = highlightedHtml.split('\n');
    
    return lines.map((line, index) => (
      <div key={index} className="code-line group hover:bg-blue-50/50 flex">
        <span className="line-number select-none w-8 sm:w-10 text-right pr-3 text-gray-400 flex-shrink-0">
          {index + 1}
        </span>
        <span 
          className="line-content flex-1 text-gray-800"
          dangerouslySetInnerHTML={{ __html: line || '&nbsp;' }}
        />
      </div>
    ));
  };

  return (
    <div data-design-id="computer-panel" className="flex flex-col h-full overflow-hidden">
      <div data-design-id="computer-header" className="p-2 xs:p-3 sm:p-4 border-b border-border">
        <div className="flex justify-between items-center mb-1.5 xs:mb-2 sm:mb-3">
          <h2 data-design-id="computer-title" className="font-medium text-foreground text-xs xs:text-sm sm:text-base">
            Anygent Computer
          </h2>
        </div>
        
        <div data-design-id="computer-status" className="flex items-center gap-1.5 xs:gap-2 sm:gap-3">
          <div className="w-7 h-7 xs:w-8 xs:h-8 sm:w-10 sm:h-10 rounded-md xs:rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0 bg-secondary">
            {codeStreaming.isDeleteView ? (
              <Trash2 className="w-3.5 h-3.5 xs:w-4 xs:h-4 sm:w-5 sm:h-5 text-muted-foreground" />
            ) : codeStreaming.isDiffView ? (
              <Replace className="w-3.5 h-3.5 xs:w-4 xs:h-4 sm:w-5 sm:h-5 text-muted-foreground" />
            ) : codeStreaming.isInsertView ? (
              <Plus className="w-3.5 h-3.5 xs:w-4 xs:h-4 sm:w-5 sm:h-5 text-muted-foreground" />
            ) : codeStreaming.tool === "Reader" ? (
              <BookOpen className="w-3.5 h-3.5 xs:w-4 xs:h-4 sm:w-5 sm:h-5 text-muted-foreground" />
            ) : codeStreaming.isStreaming ? (
              <Code className="w-3.5 h-3.5 xs:w-4 xs:h-4 sm:w-5 sm:h-5 text-muted-foreground" />
            ) : (
              <Monitor className="w-3.5 h-3.5 xs:w-4 xs:h-4 sm:w-5 sm:h-5 text-muted-foreground" />
            )}
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-[10px] xs:text-[11px] sm:text-xs text-muted-foreground">
              Using <span className="text-foreground/80">{codeStreaming.tool || "Editor"}</span>
            </span>
            {codeStreaming.isDiffView && codeStreaming.filePath && (
              <div className="flex items-center gap-1 mt-0.5 xs:mt-1 px-1.5 xs:px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[9px] xs:text-[10px] sm:text-xs border max-w-full bg-amber-500/10 text-amber-600 border-amber-500/30">
                <Replace className="w-2.5 h-2.5 xs:w-3 xs:h-3 flex-shrink-0" />
                <span className="truncate">Updating {codeStreaming.filePath}</span>
              </div>
            )}
            {codeStreaming.isInsertView && codeStreaming.filePath && (
              <div className="flex items-center gap-1 mt-0.5 xs:mt-1 px-1.5 xs:px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[9px] xs:text-[10px] sm:text-xs border max-w-full bg-green-500/10 text-green-600 border-green-500/30">
                <Plus className="w-2.5 h-2.5 xs:w-3 xs:h-3 flex-shrink-0" />
                <span className="truncate">Inserting into {codeStreaming.filePath}</span>
              </div>
            )}
            {codeStreaming.isDeleteView && codeStreaming.filePath && (
              <div className="flex items-center gap-1 mt-0.5 xs:mt-1 px-1.5 xs:px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[9px] xs:text-[10px] sm:text-xs border max-w-full bg-red-500/10 text-red-600 border-red-500/30">
                <Trash2 className="w-2.5 h-2.5 xs:w-3 xs:h-3 flex-shrink-0" />
                <span className="truncate">Deleting from {codeStreaming.filePath}</span>
              </div>
            )}
            {codeStreaming.isStreaming && codeStreaming.filePath && !codeStreaming.isDiffView && !codeStreaming.isDeleteView && (
              <div className="flex items-center gap-1 mt-0.5 xs:mt-1 px-1.5 xs:px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[9px] xs:text-[10px] sm:text-xs border max-w-full bg-accent text-muted-foreground border-border/50">
                {codeStreaming.tool === "Reader" ? (
                  <BookOpen className="w-2.5 h-2.5 xs:w-3 xs:h-3 flex-shrink-0" />
                ) : (
                  <Play className="w-2.5 h-2.5 xs:w-3 xs:h-3 flex-shrink-0" />
                )}
                <span className="truncate">{codeStreaming.tool === "Reader" ? "Reading" : "Editing"} {codeStreaming.filePath}</span>
              </div>
            )}
            {!codeStreaming.isStreaming && !codeStreaming.isDiffView && codeStreaming.content && codeStreaming.tool === "Reader" && (
              <div className="flex items-center gap-1 mt-0.5 xs:mt-1 px-1.5 xs:px-2 py-0.5 sm:px-2.5 sm:py-1 bg-accent rounded-full text-[9px] xs:text-[10px] sm:text-xs text-muted-foreground border border-border/50 max-w-full">
                <BookOpen className="w-2.5 h-2.5 xs:w-3 xs:h-3 flex-shrink-0" />
                <span className="truncate">Read {codeStreaming.filePath}</span>
              </div>
            )}
            {!codeStreaming.isStreaming && !codeStreaming.content && !codeStreaming.isDiffView && (
              <span className="text-[10px] xs:text-[11px] sm:text-xs text-muted-foreground">Waiting for agent...</span>
            )}
          </div>
        </div>
      </div>

      <div data-design-id="computer-content" className="flex-1 p-1.5 xs:p-2 sm:p-3.5 overflow-hidden flex flex-col">
        <div className="flex-1 flex flex-col rounded-md xs:rounded-lg sm:rounded-xl bg-secondary border border-border shadow-sm overflow-hidden">
          <div data-design-id="computer-file-header" className="flex justify-center items-center min-h-7 xs:min-h-8 sm:min-h-9 border-b border-border bg-card/50">
            <span className="text-[10px] xs:text-xs sm:text-sm text-muted-foreground truncate px-2">
              {codeStreaming.filePath ? getFileName(codeStreaming.filePath) : "No file selected"}
            </span>
          </div>
          
          <div 
            data-design-id="computer-code-area"
            ref={codeContainerRef}
            className="flex-1 overflow-auto bg-[#f5f5f5] p-1.5 xs:p-2 sm:p-3"
          >
            {/* Diff view for replace_in_file tool */}
            {codeStreaming.isDiffView && codeStreaming.oldString && codeStreaming.newString ? (
              <DiffView 
                filePath={codeStreaming.filePath}
                oldString={codeStreaming.oldString}
                newString={codeStreaming.newString}
              />
            ) : codeStreaming.isInsertView && codeStreaming.newStr ? (
              <InsertView 
                filePath={codeStreaming.filePath}
                insertLine={codeStreaming.insertLine}
                newStr={codeStreaming.newStr}
              />
            ) : codeStreaming.isDeleteView && codeStreaming.deletedLines ? (
              <DeleteView 
                filePath={codeStreaming.filePath}
                deletedLines={codeStreaming.deletedLines}
                startLine={codeStreaming.startLine}
                endLine={codeStreaming.endLine}
              />
            ) : codeStreaming.content && highlightedCode ? (
              <pre className="m-0 font-mono text-[10px] xs:text-[11px] sm:text-[13px] leading-5 xs:leading-6 sm:leading-7">
                <code className="hljs">
                  {renderCodeWithLineNumbers(highlightedCode)}
                  {codeStreaming.isStreaming && <span className="typing-cursor" />}
                </code>
              </pre>
            ) : codeStreaming.isStreaming ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center px-3 xs:px-4">
                  <div className="w-10 h-10 xs:w-12 xs:h-12 sm:w-16 sm:h-16 mx-auto mb-2 xs:mb-3 sm:mb-4 rounded-lg xs:rounded-xl sm:rounded-2xl bg-primary/10 flex items-center justify-center animate-pulse">
                    <Code className="w-5 h-5 xs:w-6 xs:h-6 sm:w-8 sm:h-8 text-primary" />
                  </div>
                  <p className="text-[10px] xs:text-xs sm:text-sm text-foreground font-medium">
                    Generating code...
                  </p>
                  <div className="flex items-center justify-center gap-1 mt-2">
                    <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center px-3 xs:px-4">
                  <div className="w-10 h-10 xs:w-12 xs:h-12 sm:w-16 sm:h-16 mx-auto mb-2 xs:mb-3 sm:mb-4 rounded-lg xs:rounded-xl sm:rounded-2xl bg-accent/50 flex items-center justify-center">
                    <Code className="w-5 h-5 xs:w-6 xs:h-6 sm:w-8 sm:h-8 text-muted-foreground" />
                  </div>
                  <p className="text-[10px] xs:text-xs sm:text-sm text-muted-foreground">
                    {isAgentRunning 
                      ? "Agent is working..."
                      : "Start a conversation to see live code"
                    }
                  </p>
                </div>
              </div>
            )}
          </div>

          <div data-design-id="computer-controls" className="flex items-center px-1.5 xs:px-2 sm:px-4 py-1 xs:py-1.5 sm:py-2 border-t border-border bg-card">
            <div className="flex items-center gap-1.5 xs:gap-2 sm:gap-3 flex-shrink-0">
              <button 
                className="w-6 h-6 xs:w-7 xs:h-7 sm:w-6 sm:h-6 flex items-center justify-center text-muted-foreground hover:text-foreground active:bg-accent disabled:opacity-30 transition-colors rounded"
                disabled
              >
                <SkipBack className="w-3 h-3 sm:w-4 sm:h-4" />
              </button>
              <button 
                className="w-6 h-6 xs:w-7 xs:h-7 sm:w-6 sm:h-6 flex items-center justify-center text-muted-foreground hover:text-foreground active:bg-accent transition-colors rounded"
              >
                <SkipForward className="w-3 h-3 sm:w-4 sm:h-4" />
              </button>
            </div>
            
            <div className="flex items-center gap-1.5 xs:gap-2 sm:gap-4 flex-1 ml-1.5 xs:ml-2 sm:ml-4">
              <div className="flex-1 h-1 bg-border rounded-full relative">
                <div 
                  className="h-full bg-blue-500 rounded-full transition-all duration-300"
                  style={{ width: codeStreaming.isStreaming ? "100%" : (codeStreaming.content ? "100%" : "0%") }}
                />
                <div 
                  className="absolute top-1/2 -translate-y-1/2 w-2 h-2 xs:w-2.5 xs:h-2.5 sm:w-3 sm:h-3 bg-blue-500 rounded-full cursor-pointer transition-all duration-300"
                  style={{ left: codeStreaming.isStreaming ? "100%" : (codeStreaming.content ? "100%" : "0%"), transform: "translate(-50%, -50%)" }}
                />
              </div>
              
              <div className="flex items-center gap-1 xs:gap-1.5 sm:gap-2 flex-shrink-0">
                {codeStreaming.isStreaming && codeStreaming.content && (
                  <span className="text-[9px] xs:text-[10px] sm:text-xs text-muted-foreground mr-2">
                    {codeStreaming.content.length} chars
                  </span>
                )}
                <div className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${codeStreaming.isStreaming ? "bg-green-500 realtime-dot-pulse" : "bg-muted-foreground"}`} />
                <span className="text-[9px] xs:text-[10px] sm:text-sm text-muted-foreground">
                  {codeStreaming.isStreaming ? "Streaming" : "Idle"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}