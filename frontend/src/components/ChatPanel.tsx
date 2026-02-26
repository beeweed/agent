import { useRef, useEffect, useState, useCallback } from "react";
import { useStore } from "@/store/useStore";
import { useApi } from "@/hooks/useApi";
import { ChatMessage } from "./ChatMessage";
import { ThinkingIndicator } from "./ThinkingIndicator";
import type { AgentEvent, ChatEntry } from "@/types";
import { 
  Share2, 
  ChevronDown, 
  Send,
  Settings,
  RotateCcw,
  Lightbulb
} from "lucide-react";

export function ChatPanel() {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const {
    chatEntries,
    addChatEntry,
    updateChatEntry,
    isAgentRunning,
    setIsAgentRunning,
    setCurrentIteration,
    currentIteration,
    maxIterations,
    setIsSettingsOpen,
    setIsMemoryOpen,
    apiKey,
    selectedModel,
    setCodeStreaming,
    resetCodeStreaming,
  } = useStore();
  
  const { sendMessage, fetchFileTree, fetchMemory, resetChat, stopAgent } = useApi();

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [chatEntries, scrollToBottom]);

  const handleSubmit = async () => {
    if (!input.trim() || isAgentRunning) return;
    
    if (!apiKey) {
      setIsSettingsOpen(true);
      return;
    }

    const userEntry: ChatEntry = {
      id: crypto.randomUUID(),
      type: "user",
      content: input.trim(),
      timestamp: new Date(),
    };
    addChatEntry(userEntry);
    setInput("");
    setIsAgentRunning(true);
    setCurrentIteration(0);
    resetCodeStreaming();

    let currentFileCardId: string | null = null;

    try {
      await sendMessage(input.trim(), (event: AgentEvent) => {
        switch (event.type) {
          case "iteration":
            setCurrentIteration(event.iteration || 0);
            break;
            
          case "thought":
            if (event.content) {
              const thoughtEntry: ChatEntry = {
                id: crypto.randomUUID(),
                type: "assistant",
                content: event.content,
                iteration: event.iteration,
                timestamp: new Date(),
              };
              addChatEntry(thoughtEntry);
            }
            break;
            
          case "tool_call":
            if (event.tool_name === "file_write") {
              const filePath = (event.arguments?.file_path as string) || "";
              const content = (event.arguments?.content as string) || "";
              
              setCodeStreaming({
                filePath,
                content: "",
                isStreaming: true,
                tool: "Editor",
                action: `Editing ${filePath}`,
              });
              
              if (content) {
                let currentIndex = 0;
                const chunkSize = 50;
                const streamContent = () => {
                  if (currentIndex < content.length) {
                    const chunk = content.slice(currentIndex, currentIndex + chunkSize);
                    useStore.getState().appendStreamingCode(chunk);
                    currentIndex += chunkSize;
                    setTimeout(streamContent, 20);
                  } else {
                    setCodeStreaming({ isStreaming: false });
                  }
                };
                streamContent();
              }
              
              const fileEntry: ChatEntry = {
                id: crypto.randomUUID(),
                type: "file_card",
                filePath,
                fileStatus: "writing",
                iteration: event.iteration,
                timestamp: new Date(),
              };
              currentFileCardId = fileEntry.id;
              addChatEntry(fileEntry);
            }
            break;
            
          case "tool_result":
            if (currentFileCardId && event.tool_name === "file_write") {
              updateChatEntry(currentFileCardId, {
                fileStatus: event.result?.success ? "created" : "error",
              });
              currentFileCardId = null;
              fetchFileTree();
            }
            break;
            
          case "tool_error":
            if (currentFileCardId) {
              updateChatEntry(currentFileCardId, { fileStatus: "error" });
              currentFileCardId = null;
            }
            setCodeStreaming({ isStreaming: false });
            break;
            
          case "complete":
            fetchMemory();
            setCodeStreaming({ isStreaming: false });
            break;
            
          case "max_iterations_reached":
            addChatEntry({
              id: crypto.randomUUID(),
              type: "assistant",
              content: `Maximum iterations (${event.max_iterations}) reached. The agent has stopped.`,
              timestamp: new Date(),
            });
            setCodeStreaming({ isStreaming: false });
            break;
            
          case "error":
            addChatEntry({
              id: crypto.randomUUID(),
              type: "assistant",
              content: `Error: ${event.error}`,
              timestamp: new Date(),
            });
            setCodeStreaming({ isStreaming: false });
            break;
            
          case "stream_end":
            setIsAgentRunning(false);
            setCodeStreaming({ isStreaming: false });
            break;
        }
      });
    } catch (error) {
      addChatEntry({
        id: crypto.randomUUID(),
        type: "assistant",
        content: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
        timestamp: new Date(),
      });
      setCodeStreaming({ isStreaming: false });
    } finally {
      setIsAgentRunning(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleReset = async () => {
    await resetChat();
    useStore.getState().clearChat();
    setCurrentIteration(0);
    resetCodeStreaming();
  };

  const handleStop = async () => {
    await stopAgent();
    setIsAgentRunning(false);
    setCodeStreaming({ isStreaming: false });
  };

  const getModelDisplayName = () => {
    const modelParts = selectedModel.split("/");
    return modelParts[modelParts.length - 1] || "Select Model";
  };

  return (
    <div 
      data-design-id="chat-panel"
      className="flex flex-col h-full overflow-hidden"
    >
      <div 
        data-design-id="chat-header"
        className="flex items-center justify-between py-3 sm:py-4 border-b border-border"
      >
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-xs sm:text-sm">A</span>
          </div>
          <h1 data-design-id="chat-title" className="text-sm sm:text-base font-semibold text-foreground truncate max-w-[150px] sm:max-w-[300px]">
            {chatEntries.length > 0 && chatEntries[0].type === "user" 
              ? (chatEntries[0].content?.slice(0, 40) + (chatEntries[0].content && chatEntries[0].content.length > 40 ? "..." : ""))
              : "Anygent"
            }
          </h1>
        </div>
        <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
          <button 
            data-design-id="memory-btn"
            onClick={() => setIsMemoryOpen(true)}
            className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            title="Memory"
          >
            <Lightbulb className="w-4 h-4" />
          </button>
          <button 
            data-design-id="reset-btn"
            onClick={handleReset}
            className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            title="Reset"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button 
            data-design-id="share-btn"
            className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors hidden sm:flex"
            title="Share"
          >
            <Share2 className="w-4 h-4" />
          </button>
          <button 
            data-design-id="settings-btn"
            onClick={() => setIsSettingsOpen(true)}
            className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div 
        data-design-id="chat-messages"
        className="flex-1 overflow-y-auto py-5 scrollbar-none"
        ref={scrollRef}
      >
        <div className="space-y-6 max-w-[768px] mx-auto">
          {chatEntries.map((entry) => (
            <ChatMessage key={entry.id} entry={entry} />
          ))}
          {isAgentRunning && (
            <ThinkingIndicator iteration={currentIteration} maxIterations={maxIterations} />
          )}
        </div>
      </div>

      <div data-design-id="chat-input-area" className="sticky bottom-0 py-3 bg-background">
        {isAgentRunning && (
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/20">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></div>
              <span className="text-[11px] font-medium text-primary">
                Iteration {currentIteration}/{maxIterations}
              </span>
            </div>
            <button
              onClick={handleStop}
              className="px-3 py-1 text-sm text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
            >
              Stop
            </button>
          </div>
        )}
        
        <div data-design-id="input-wrapper" className="w-full">
          <div 
            data-design-id="input-area"
            className="flex flex-col min-h-[120px] sm:min-h-[140px] p-3 sm:p-5 pb-3 rounded-xl sm:rounded-2xl bg-card shadow-sm border border-border"
          >
            <div className="flex-1 flex flex-col justify-between">
              <textarea
                ref={textareaRef}
                data-design-id="chat-textarea"
                placeholder="Ask Anygent to help you with any task..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full min-h-[60px] bg-transparent border-none outline-none resize-none font-sans text-sm leading-relaxed text-foreground placeholder:text-muted-foreground"
                disabled={isAgentRunning}
                rows={2}
              />
              
              <div data-design-id="input-actions" className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-2">
                  <button 
                    data-design-id="model-selector"
                    onClick={() => setIsSettingsOpen(true)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-card hover:border-muted-foreground transition-all text-[13px]"
                  >
                    <div className="w-[18px] h-[18px] rounded bg-gradient-to-br from-indigo-500 to-purple-600" />
                    <span className="text-foreground hidden sm:inline">{getModelDisplayName()}</span>
                    <ChevronDown className="w-3 h-3 text-muted-foreground" />
                  </button>
                </div>
                
                <button
                  data-design-id="send-btn"
                  onClick={handleSubmit}
                  disabled={isAgentRunning || !input.trim()}
                  className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center hover:brightness-105 transition-all disabled:bg-accent disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4 text-primary-foreground" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}