import type { ChatEntry } from "@/types";
import { useStore } from "@/store/useStore";
import { Code, Eye, Check, Loader2, AlertCircle } from "lucide-react";

function AnygentLogo() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Modern stylized "A" letter - clean geometric design */}
      <path 
        d="M12 2L3 22H7.5L9.5 17H14.5L16.5 22H21L12 2Z" 
        fill="url(#goldGradient)"
      />
      <path 
        d="M10.5 14L12 9L13.5 14H10.5Z" 
        fill="#1a1a1a"
      />
      <defs>
        <linearGradient id="goldGradient" x1="12" y1="2" x2="12" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffe066"/>
          <stop offset="50%" stopColor="#ffc700"/>
          <stop offset="100%" stopColor="#e6a800"/>
        </linearGradient>
      </defs>
    </svg>
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
      <div data-design-id={`user-message-${entry.id}`} className="flex gap-3 animate-fade-in">
        <div 
          data-design-id="user-avatar"
          className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0"
        >
          U
        </div>
        <div 
          data-design-id="user-content"
          className="flex-1 px-4 py-3 bg-card rounded-2xl border border-border text-sm leading-relaxed text-foreground"
        >
          <p className="whitespace-pre-wrap">{entry.content}</p>
        </div>
      </div>
    );
  }

  if (entry.type === "assistant") {
    return (
      <div data-design-id={`assistant-message-${entry.id}`} className="animate-fade-in">
        <div className="flex items-center gap-2 mb-3">
          <div 
            data-design-id="assistant-avatar"
            className="w-8 h-8 rounded-full bg-[#2d2d2d] border border-primary/30 flex items-center justify-center"
          >
            <AnygentLogo />
          </div>
          <span data-design-id="assistant-name" className="font-semibold text-sm text-foreground">
            Anygent AI
          </span>
          {entry.iteration && (
            <span className="text-xs text-muted-foreground">
              thinking...
            </span>
          )}
        </div>
        
        <div className="pl-10">
          <div className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
            {entry.content}
          </div>
        </div>
      </div>
    );
  }

  if (entry.type === "file_card") {
    const isWriting = entry.fileStatus === "writing";
    const isCreated = entry.fileStatus === "created";
    const isError = entry.fileStatus === "error";

    return (
      <div data-design-id={`file-card-${entry.id}`} className="animate-fade-in pl-10">
        <div
          onClick={() => isCreated && entry.filePath && handleFileClick(entry.filePath)}
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent border border-border text-sm cursor-pointer transition-all hover:bg-secondary ${
            isWriting ? "animate-pulse" : ""
          }`}
        >
          <div className="flex items-center gap-2">
            {isWriting && (
              <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
            )}
            {isCreated && (
              <Check className="w-4 h-4 text-green-600" />
            )}
            {isError && (
              <AlertCircle className="w-4 h-4 text-destructive" />
            )}
            <Code className="w-4 h-4 text-muted-foreground" />
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-foreground">Edit File</span>
            <span className="font-mono text-muted-foreground">{entry.filePath}</span>
          </div>
          
          {isCreated && (
            <button 
              className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                if (entry.filePath) handleFileClick(entry.filePath);
              }}
            >
              <Eye className="w-3 h-3" />
              View Diff
            </button>
          )}
        </div>
      </div>
    );
  }

  return null;
}