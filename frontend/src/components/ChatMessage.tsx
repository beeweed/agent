import type { ChatEntry } from "@/types";
import { useStore } from "@/store/useStore";
import { Code, Eye, Check, Loader2, AlertCircle, BookOpen } from "lucide-react";
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

  return null;
}