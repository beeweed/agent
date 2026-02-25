import type { ChatEntry } from "@/types";
import { useStore } from "@/store/useStore";

interface ChatMessageProps {
  entry: ChatEntry;
}

export function ChatMessage({ entry }: ChatMessageProps) {
  const { setSelectedFile, addTab, setMobileTab } = useStore();

  const handleFileClick = (filePath: string) => {
    setSelectedFile(filePath);
    addTab(filePath);
    setMobileTab("files");
  };

  if (entry.type === "user") {
    return (
      <div data-design-id={`user-message-${entry.id}`} className="flex gap-3 justify-end animate-fade-in">
        <div className="max-w-[85%] px-4 py-3 rounded-2xl rounded-tr-md bg-primary text-primary-foreground shadow-lg shadow-primary/10">
          <p className="text-sm whitespace-pre-wrap">{entry.content}</p>
        </div>
        <div className="w-8 h-8 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
      </div>
    );
  }

  if (entry.type === "assistant") {
    return (
      <div data-design-id={`assistant-message-${entry.id}`} className="flex gap-3 animate-fade-in">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-xs font-medium text-muted-foreground mb-2 block">Vibe Coder</span>
          {entry.iteration && (
            <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-primary/10 border border-primary/20 mb-3">
              <div className="w-1.5 h-1.5 rounded-full bg-primary"></div>
              <span className="text-[10px] font-medium text-primary">Iteration {entry.iteration}</span>
            </div>
          )}
          <div className="prose prose-sm prose-invert max-w-none text-sm leading-relaxed text-foreground/90">
            <p className="whitespace-pre-wrap">{entry.content}</p>
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
      <div data-design-id={`file-card-${entry.id}`} className="flex gap-3 animate-fade-in">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div
            onClick={() => isCreated && entry.filePath && handleFileClick(entry.filePath)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[#2a2a2c] cursor-pointer transition-all duration-200 group ${
              isWriting ? "border border-primary/20 animate-pulse" : ""
            } ${isCreated ? "border border-emerald-500/20 hover:bg-[#323234]" : ""} ${
              isError ? "border border-destructive/20" : ""
            }`}
          >
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                isWriting ? "bg-primary/10" : ""
              } ${isCreated ? "bg-emerald-500/10" : ""} ${isError ? "bg-destructive/10" : ""}`}
            >
              {isWriting && (
                <svg className="w-5 h-5 text-primary animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
              {isCreated && (
                <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              {isError && (
                <svg className="w-5 h-5 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground truncate">{entry.filePath}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-md ${
                    isWriting ? "bg-primary/15 text-primary animate-pulse" : ""
                  } ${isCreated ? "bg-emerald-500/15 text-emerald-400" : ""} ${
                    isError ? "bg-destructive/15 text-destructive" : ""
                  }`}
                >
                  {isWriting ? "writing..." : isCreated ? "created" : "error"}
                </span>
              </div>
            </div>
            {isCreated && (
              <svg className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}