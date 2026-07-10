import { useState } from "react";
import type { ChatEntry } from "@/types";
import { useStore } from "@/store/useStore";
import { Code, Eye, Check, Loader2, AlertCircle, BookOpen, Replace, Terminal, ChevronDown, Clock3 } from "lucide-react";
import { MessageContent } from "./MessageContent";

function AnygentLogo() {
  return (
    <img 
      src="/anygent-logo.png" 
      alt="Anygent AI" 
      className="w-12 h-12 xs:w-14 xs:h-14 sm:w-16 sm:h-16 object-contain"
    />
  );
}

interface ChatMessageProps {
  entry: ChatEntry;
}

export function ChatMessage({ entry }: ChatMessageProps) {
  const { setSelectedFile, addTab, setMobileTab, setRightPanel } = useStore();
  const [isShellExpanded, setIsShellExpanded] = useState(false);

  const handleFileClick = (filePath: string) => {
    setSelectedFile(filePath);
    addTab(filePath);
    setRightPanel("files");
    setMobileTab("files");
  };

  if (entry.type === "user") {
    return (
      <div data-design-id={`user-message-${entry.id}`} className="flex gap-2 xs:gap-3 animate-fade-in">
        <div 
          data-design-id="user-avatar"
          className="w-6 h-6 xs:w-7 xs:h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-[10px] xs:text-xs sm:text-sm font-semibold flex-shrink-0"
        >
          U
        </div>
        <div 
          data-design-id="user-content"
          className="flex-1 px-3 xs:px-4 py-2 xs:py-3 bg-card rounded-xl xs:rounded-2xl border border-border text-xs xs:text-sm leading-relaxed text-foreground"
        >
          <div className="whitespace-pre-wrap break-words">{entry.content}</div>
        </div>
      </div>
    );
  }

  if (entry.type === "assistant") {
    return (
      <div data-design-id={`assistant-message-${entry.id}`} className="animate-fade-in">
        {/* Logo and branding on top */}
        <div className="flex flex-col items-start mb-2 xs:mb-3 sm:mb-4">
          <div 
            data-design-id="assistant-avatar"
            className="mb-0.5 xs:mb-1"
          >
            <AnygentLogo />
          </div>
          <span data-design-id="assistant-name" className="font-bold text-sm xs:text-base">
            <span className="text-purple-400">Anygent</span>
            <span className="text-foreground"> AI</span>
          </span>
          {entry.isStreaming && (
            <span className="text-[10px] xs:text-xs text-muted-foreground mt-0.5 xs:mt-1">
              typing...
            </span>
          )}
        </div>
        
        {/* Response content with rich rendering */}
        <div className="text-sm xs:text-base leading-relaxed text-foreground">
          <MessageContent 
            content={entry.content || ""} 
            isStreaming={entry.isStreaming} 
          />
        </div>
      </div>
    );
  }

  if (entry.type === "file_card") {
    const isWriting = entry.fileStatus === "writing";
    const isCreated = entry.fileStatus === "created";
    const isError = entry.fileStatus === "error";

    return (
      <div data-design-id={`file-card-${entry.id}`} className="animate-fade-in pl-6 xs:pl-8 sm:pl-10">
        <div
          onClick={() => isCreated && entry.filePath && handleFileClick(entry.filePath)}
          className={`inline-flex flex-wrap items-center gap-1.5 xs:gap-2 px-2 xs:px-3 py-1 xs:py-1.5 rounded-full bg-accent border border-border text-[11px] xs:text-sm cursor-pointer transition-all hover:bg-secondary active:bg-secondary ${
            isWriting ? "animate-pulse" : ""
          }`}
        >
          <div className="flex items-center gap-1.5 xs:gap-2">
            {isWriting && (
              <Loader2 className="w-3.5 h-3.5 xs:w-4 xs:h-4 text-muted-foreground animate-spin" />
            )}
            {isCreated && (
              <Check className="w-3.5 h-3.5 xs:w-4 xs:h-4 text-green-600" />
            )}
            {isError && (
              <AlertCircle className="w-3.5 h-3.5 xs:w-4 xs:h-4 text-destructive" />
            )}
            <Code className="w-3.5 h-3.5 xs:w-4 xs:h-4 text-muted-foreground" />
          </div>
          
          <div className="flex items-center gap-1 xs:gap-2 min-w-0">
            <span className="text-foreground flex-shrink-0">Edit</span>
            <span className="font-mono text-muted-foreground truncate max-w-[120px] xs:max-w-[180px] sm:max-w-none">{entry.filePath}</span>
          </div>
          
          {isCreated && (
            <button 
              className="flex items-center gap-1 px-1 xs:px-1.5 py-0.5 rounded text-[10px] xs:text-xs text-muted-foreground hover:text-foreground hover:bg-card active:bg-card transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                if (entry.filePath) handleFileClick(entry.filePath);
              }}
            >
              <Eye className="w-2.5 h-2.5 xs:w-3 xs:h-3" />
              <span className="hidden xs:inline">View</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  if (entry.type === "read_file_card") {
    const isReading = entry.fileStatus === "reading";
    const isRead = entry.fileStatus === "read";
    const isError = entry.fileStatus === "error";

    return (
      <div data-design-id={`read-file-card-${entry.id}`} className="animate-fade-in pl-6 xs:pl-8 sm:pl-10">
        <div
          onClick={() => isRead && entry.filePath && handleFileClick(entry.filePath)}
          className={`inline-flex flex-wrap items-center gap-1.5 xs:gap-2 px-2 xs:px-3 py-1 xs:py-1.5 rounded-full bg-accent border border-border text-[11px] xs:text-sm cursor-pointer transition-all hover:bg-secondary active:bg-secondary ${
            isReading ? "animate-pulse" : ""
          }`}
        >
          <div className="flex items-center gap-1.5 xs:gap-2">
            {isReading && (
              <Loader2 className="w-3.5 h-3.5 xs:w-4 xs:h-4 text-muted-foreground animate-spin" />
            )}
            {isRead && (
              <Check className="w-3.5 h-3.5 xs:w-4 xs:h-4 text-green-600" />
            )}
            {isError && (
              <AlertCircle className="w-3.5 h-3.5 xs:w-4 xs:h-4 text-destructive" />
            )}
            <BookOpen className="w-3.5 h-3.5 xs:w-4 xs:h-4 text-muted-foreground" />
          </div>
          
          <div className="flex items-center gap-1 xs:gap-2 min-w-0">
            <span className="text-foreground flex-shrink-0">Read</span>
            <span className="font-mono text-muted-foreground truncate max-w-[120px] xs:max-w-[180px] sm:max-w-none">{entry.filePath}</span>
          </div>
          
          {isRead && entry.readResult && (
            <span className="text-[10px] xs:text-xs text-muted-foreground">
              {entry.readResult.lines_read} lines
            </span>
          )}
          
          {isRead && (
            <button 
              className="flex items-center gap-1 px-1 xs:px-1.5 py-0.5 rounded text-[10px] xs:text-xs text-muted-foreground hover:text-foreground hover:bg-card active:bg-card transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                if (entry.filePath) handleFileClick(entry.filePath);
              }}
            >
              <Eye className="w-2.5 h-2.5 xs:w-3 xs:h-3" />
              <span className="hidden xs:inline">View</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  if (entry.type === "replace_in_file_card") {
    const isReplacing = entry.fileStatus === "replacing";
    const isReplaced = entry.fileStatus === "replaced";
    const isError = entry.fileStatus === "error";

    return (
      <div data-design-id={`replace-in-file-card-${entry.id}`} className="animate-fade-in pl-6 xs:pl-8 sm:pl-10">
        <div
          onClick={() => isReplaced && entry.filePath && handleFileClick(entry.filePath)}
          className={`inline-flex flex-wrap items-center gap-1.5 xs:gap-2 px-2 xs:px-3 py-1 xs:py-1.5 rounded-full bg-accent border border-border text-[11px] xs:text-sm cursor-pointer transition-all hover:bg-secondary active:bg-secondary ${
            isReplacing ? "animate-pulse" : ""
          }`}
        >
          <div className="flex items-center gap-1.5 xs:gap-2">
            {isReplacing && (
              <Loader2 className="w-3.5 h-3.5 xs:w-4 xs:h-4 text-muted-foreground animate-spin" />
            )}
            {isReplaced && (
              <Check className="w-3.5 h-3.5 xs:w-4 xs:h-4 text-green-600" />
            )}
            {isError && (
              <AlertCircle className="w-3.5 h-3.5 xs:w-4 xs:h-4 text-destructive" />
            )}
            <Replace className="w-3.5 h-3.5 xs:w-4 xs:h-4 text-muted-foreground" />
          </div>
          
          <div className="flex items-center gap-1 xs:gap-2 min-w-0">
            <span className="text-foreground flex-shrink-0">Update</span>
            <span className="font-mono text-muted-foreground truncate max-w-[120px] xs:max-w-[180px] sm:max-w-none">{entry.filePath}</span>
          </div>
          
          {isReplaced && entry.replaceResult && (
            <span className="text-[10px] xs:text-xs text-muted-foreground">
              {entry.replaceResult.occurrences} replacement(s)
            </span>
          )}
          
          {isReplaced && (
            <button 
              className="flex items-center gap-1 px-1 xs:px-1.5 py-0.5 rounded text-[10px] xs:text-xs text-muted-foreground hover:text-foreground hover:bg-card active:bg-card transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                if (entry.filePath) handleFileClick(entry.filePath);
              }}
            >
              <Eye className="w-2.5 h-2.5 xs:w-3 xs:h-3" />
              <span className="hidden xs:inline">View</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  if (entry.type === "shall_tool_card") {
    const isRunning = entry.shellStatus === "running";
    const isError = entry.shellStatus === "error";
    const result = entry.shellResult;
    const hasOutput = Boolean(result?.output);
    const isNonZeroExit = typeof result?.exit_code === "number" && result.exit_code !== 0;

    return (
      <div data-design-id={`shall-tool-card-${entry.id}`} className="animate-fade-in pl-6 xs:pl-8 sm:pl-10">
        <div className="w-full max-w-3xl rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          <button
            data-design-id="shall-tool-toggle"
            type="button"
            onClick={() => setIsShellExpanded((value) => !value)}
            className="w-full flex items-start gap-3 px-3 xs:px-4 py-3 text-left hover:bg-accent/60 transition-colors"
          >
            <div className="mt-0.5 flex-shrink-0">
              {isRunning ? (
                <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
              ) : isError || result?.timed_out ? (
                <AlertCircle className="w-4 h-4 text-destructive" />
              ) : isNonZeroExit ? (
                <Clock3 className="w-4 h-4 text-amber-500" />
              ) : (
                <Check className="w-4 h-4 text-emerald-600" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-accent px-2 py-0.5 text-[10px] xs:text-xs font-medium text-foreground">
                  <Terminal className="w-3 h-3" />
                  <span>shall_tool</span>
                </div>
                {entry.sessionName && (
                  <span className="text-[10px] xs:text-xs text-muted-foreground rounded-full border border-border px-2 py-0.5">
                    session: <span className="font-mono text-foreground">{entry.sessionName}</span>
                  </span>
                )}
                <span className="text-[10px] xs:text-xs text-muted-foreground rounded-full border border-border px-2 py-0.5">
                  {entry.waitForOutput ? "waited" : "background"}
                </span>
                {typeof result?.exit_code === "number" && (
                  <span className={`text-[10px] xs:text-xs rounded-full border px-2 py-0.5 ${result.exit_code === 0 ? "border-emerald-500/30 text-emerald-600" : "border-amber-500/30 text-amber-600"}`}>
                    exit {result.exit_code}
                  </span>
                )}
              </div>

              <div className="font-mono text-[11px] xs:text-xs sm:text-sm text-foreground break-words">
                {entry.command}
              </div>

              <div className="mt-2 text-[10px] xs:text-xs text-muted-foreground">
                {isRunning
                  ? "Running command..."
                  : result?.timed_out
                    ? "Command timed out after 3 minutes"
                    : result?.started && !entry.waitForOutput
                      ? result.output || "Command started"
                      : hasOutput
                        ? "Click to view terminal output"
                        : "No terminal output"}
              </div>
            </div>

            <ChevronDown className={`w-4 h-4 flex-shrink-0 text-muted-foreground transition-transform ${isShellExpanded ? "rotate-180" : ""}`} />
          </button>

          {isShellExpanded && (
            <div data-design-id="shall-tool-output" className="border-t border-border bg-zinc-950 text-zinc-100">
              <div className="px-3 xs:px-4 py-2 border-b border-zinc-800 text-[10px] xs:text-xs text-zinc-400 flex flex-wrap items-center gap-2">
                <span>Terminal output</span>
                {result?.background_log_path && (
                  <span className="font-mono truncate">{result.background_log_path}</span>
                )}
              </div>
              <pre className="m-0 max-h-72 overflow-auto p-3 xs:p-4 text-[11px] xs:text-xs sm:text-sm leading-5 whitespace-pre-wrap break-words font-mono">
                {result?.output || "No output returned."}
              </pre>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}