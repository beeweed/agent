import { useState } from "react";
import type { ChatEntry } from "@/types";
import { useStore } from "@/store/useStore";
import { Code, Eye, Check, Loader2, AlertCircle, BookOpen, Replace, Plus, Trash2, Eraser, TerminalSquare, ChevronDown, ChevronRight } from "lucide-react";
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

  if (entry.type === "insert_line_card") {
    const isInserting = entry.fileStatus === "inserting";
    const isInserted = entry.fileStatus === "inserted";
    const isError = entry.fileStatus === "error";

    return (
      <div data-design-id={`insert-line-card-${entry.id}`} className="animate-fade-in pl-6 xs:pl-8 sm:pl-10">
        <div
          onClick={() => isInserted && entry.filePath && handleFileClick(entry.filePath)}
          className={`inline-flex flex-wrap items-center gap-1.5 xs:gap-2 px-2 xs:px-3 py-1 xs:py-1.5 rounded-full bg-accent border border-border text-[11px] xs:text-sm cursor-pointer transition-all hover:bg-secondary active:bg-secondary ${
            isInserting ? "animate-pulse" : ""
          }`}
        >
          <div className="flex items-center gap-1.5 xs:gap-2">
            {isInserting && (
              <Loader2 className="w-3.5 h-3.5 xs:w-4 xs:h-4 text-muted-foreground animate-spin" />
            )}
            {isInserted && (
              <Check className="w-3.5 h-3.5 xs:w-4 xs:h-4 text-green-600" />
            )}
            {isError && (
              <AlertCircle className="w-3.5 h-3.5 xs:w-4 xs:h-4 text-destructive" />
            )}
            <Plus className="w-3.5 h-3.5 xs:w-4 xs:h-4 text-muted-foreground" />
          </div>
          
          <div className="flex items-center gap-1 xs:gap-2 min-w-0">
            <span className="text-foreground flex-shrink-0">Insert</span>
            <span className="font-mono text-muted-foreground truncate max-w-[120px] xs:max-w-[180px] sm:max-w-none">{entry.filePath}</span>
          </div>
          
          {isInserted && entry.insertResult && (
            <span className="text-[10px] xs:text-xs text-muted-foreground">
              {entry.insertResult.lines_inserted} line(s) at {entry.insertLine}
            </span>
          )}
          
          {isInserted && (
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

  if (entry.type === "delete_lines_card") {
    const isDeleting = entry.fileStatus === "deleting";
    const isDeleted = entry.fileStatus === "deleted";
    const isError = entry.fileStatus === "error";

    return (
      <div data-design-id={`delete-lines-card-${entry.id}`} className="animate-fade-in pl-6 xs:pl-8 sm:pl-10">
        <div
          onClick={() => isDeleted && entry.filePath && handleFileClick(entry.filePath)}
          className={`inline-flex flex-wrap items-center gap-1.5 xs:gap-2 px-2 xs:px-3 py-1 xs:py-1.5 rounded-full bg-accent border border-border text-[11px] xs:text-sm cursor-pointer transition-all hover:bg-secondary active:bg-secondary ${
            isDeleting ? "animate-pulse" : ""
          }`}
        >
          <div className="flex items-center gap-1.5 xs:gap-2">
            {isDeleting && (
              <Loader2 className="w-3.5 h-3.5 xs:w-4 xs:h-4 text-muted-foreground animate-spin" />
            )}
            {isDeleted && (
              <Check className="w-3.5 h-3.5 xs:w-4 xs:h-4 text-green-600" />
            )}
            {isError && (
              <AlertCircle className="w-3.5 h-3.5 xs:w-4 xs:h-4 text-destructive" />
            )}
            <Trash2 className="w-3.5 h-3.5 xs:w-4 xs:h-4 text-muted-foreground" />
          </div>
          
          <div className="flex items-center gap-1 xs:gap-2 min-w-0">
            <span className="text-foreground flex-shrink-0">Delete</span>
            <span className="font-mono text-muted-foreground truncate max-w-[120px] xs:max-w-[180px] sm:max-w-none">{entry.filePath}</span>
          </div>
          
          {isDeleted && entry.deleteResult && (
            <span className="text-[10px] xs:text-xs text-muted-foreground">
              {entry.deleteResult.lines_deleted} line(s) removed
            </span>
          )}
          
          {isDeleted && (
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

  if (entry.type === "delete_str_from_file_card") {
    const isDeletingStr = entry.fileStatus === "deleting_str";
    const isDeletedStr = entry.fileStatus === "deleted_str";
    const isError = entry.fileStatus === "error";

    return (
      <div data-design-id={`delete-str-card-${entry.id}`} className="animate-fade-in pl-6 xs:pl-8 sm:pl-10">
        <div
          onClick={() => isDeletedStr && entry.filePath && handleFileClick(entry.filePath)}
          className={`inline-flex flex-wrap items-center gap-1.5 xs:gap-2 px-2 xs:px-3 py-1 xs:py-1.5 rounded-full bg-accent border border-border text-[11px] xs:text-sm cursor-pointer transition-all hover:bg-secondary active:bg-secondary ${
            isDeletingStr ? "animate-pulse" : ""
          }`}
        >
          <div className="flex items-center gap-1.5 xs:gap-2">
            {isDeletingStr && (
              <Loader2 className="w-3.5 h-3.5 xs:w-4 xs:h-4 text-muted-foreground animate-spin" />
            )}
            {isDeletedStr && (
              <Check className="w-3.5 h-3.5 xs:w-4 xs:h-4 text-green-600" />
            )}
            {isError && (
              <AlertCircle className="w-3.5 h-3.5 xs:w-4 xs:h-4 text-destructive" />
            )}
            <Eraser className="w-3.5 h-3.5 xs:w-4 xs:h-4 text-muted-foreground" />
          </div>
          
          <div className="flex items-center gap-1 xs:gap-2 min-w-0">
            <span className="text-foreground flex-shrink-0">Delete</span>
            <span className="font-mono text-muted-foreground truncate max-w-[120px] xs:max-w-[180px] sm:max-w-none">{entry.filePath}</span>
          </div>
          
          {isDeletedStr && (
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

  if (entry.type === "shell_card") {
    return <ShellToolBlock entry={entry} />;
  }

  return null;
}


function ShellToolBlock({ entry }: { entry: ChatEntry }) {
  const [commandExpanded, setCommandExpanded] = useState(false);
  const [outputExpanded, setOutputExpanded] = useState(false);

  const isRunning = entry.shellStatus === "running";
  const isCompleted = entry.shellStatus === "completed";
  const isError = entry.shellStatus === "error";
  const output = entry.shellResult?.output || "";
  const exitCode = entry.shellResult?.exit_code;

  return (
    <div data-design-id={`shell-card-${entry.id}`} className="animate-fade-in pl-6 xs:pl-8 sm:pl-10">
      <div
        className={`rounded-lg border overflow-hidden transition-all ${
          isRunning
            ? "border-[#7aa2f7]/40 bg-[#7aa2f7]/5"
            : isError
              ? "border-[#f7768e]/40 bg-[#f7768e]/5"
              : "border-[#9ece6a]/40 bg-[#9ece6a]/5"
        }`}
      >
        {/* Header: Description */}
        <div
          data-design-id={`shell-card-header-${entry.id}`}
          className="flex items-center gap-2 px-3 py-2 bg-[#1a1b26]/60"
        >
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {isRunning && (
              <Loader2 className="w-3.5 h-3.5 text-[#7aa2f7] animate-spin" />
            )}
            {isCompleted && (
              <Check className="w-3.5 h-3.5 text-[#9ece6a]" />
            )}
            {isError && (
              <AlertCircle className="w-3.5 h-3.5 text-[#f7768e]" />
            )}
            <TerminalSquare className="w-3.5 h-3.5 text-[#7aa2f7]" />
          </div>

          <span
            data-design-id={`shell-card-description-${entry.id}`}
            className="text-xs font-medium text-[#a9b1d6] truncate flex-1"
          >
            {entry.shellDescription || "Shell command"}
          </span>

          {entry.shellSessionName && (
            <span
              data-design-id={`shell-card-session-${entry.id}`}
              className="text-[9px] font-mono text-[#565f89] bg-[#292e42] px-1.5 py-0.5 rounded flex-shrink-0"
            >
              {entry.shellSessionName}
            </span>
          )}

          {isCompleted && exitCode !== undefined && (
            <span
              data-design-id={`shell-card-exit-${entry.id}`}
              className={`text-[9px] font-mono px-1.5 py-0.5 rounded flex-shrink-0 ${
                exitCode === 0
                  ? "text-[#9ece6a] bg-[#9ece6a]/10"
                  : "text-[#f7768e] bg-[#f7768e]/10"
              }`}
            >
              exit:{exitCode}
            </span>
          )}
        </div>

        {/* Command dropdown */}
        <div data-design-id={`shell-card-command-section-${entry.id}`} className="border-t border-[#292e42]/60">
          <button
            data-design-id={`shell-card-command-toggle-${entry.id}`}
            onClick={() => setCommandExpanded(!commandExpanded)}
            className="flex items-center gap-1.5 w-full px-3 py-1.5 text-left hover:bg-[#1a1b26]/40 transition-colors"
          >
            {commandExpanded ? (
              <ChevronDown className="w-3 h-3 text-[#565f89]" />
            ) : (
              <ChevronRight className="w-3 h-3 text-[#565f89]" />
            )}
            <span className="text-[10px] uppercase tracking-wider text-[#565f89] font-medium">
              Command
            </span>
          </button>

          {commandExpanded && (
            <div
              data-design-id={`shell-card-command-content-${entry.id}`}
              className="px-3 pb-2"
            >
              <div className="bg-[#1a1b26] rounded-md p-2 overflow-x-auto">
                <code className="text-[11px] font-mono text-[#c0caf5] whitespace-pre-wrap break-all">
                  <span className="text-[#9ece6a] select-none">$ </span>
                  {entry.shellCommand}
                </code>
              </div>
            </div>
          )}
        </div>

        {/* Output section */}
        {(isCompleted || isError) && output && (
          <div data-design-id={`shell-card-output-section-${entry.id}`} className="border-t border-[#292e42]/60">
            <button
              data-design-id={`shell-card-output-toggle-${entry.id}`}
              onClick={() => setOutputExpanded(!outputExpanded)}
              className="flex items-center gap-1.5 w-full px-3 py-1.5 text-left hover:bg-[#1a1b26]/40 transition-colors"
            >
              {outputExpanded ? (
                <ChevronDown className="w-3 h-3 text-[#565f89]" />
              ) : (
                <ChevronRight className="w-3 h-3 text-[#565f89]" />
              )}
              <span className="text-[10px] uppercase tracking-wider text-[#565f89] font-medium">
                Output
              </span>
            </button>

            {outputExpanded && (
              <div
                data-design-id={`shell-card-output-content-${entry.id}`}
                className="px-3 pb-2"
              >
                <div className="bg-[#1a1b26] rounded-md p-2 max-h-[300px] overflow-auto">
                  <pre className="text-[11px] font-mono text-[#a9b1d6] whitespace-pre-wrap break-all">
                    {output}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}