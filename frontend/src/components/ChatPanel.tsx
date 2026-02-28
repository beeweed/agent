import { useRef, useEffect, useState, useCallback } from "react";
import { useStore } from "@/store/useStore";
import { useApi } from "@/hooks/useApi";
import { ChatMessage } from "./ChatMessage";
import { ThinkingIndicator } from "./ThinkingIndicator";
import { ModelSelector } from "./ModelSelector";
import type { AgentEvent, ChatEntry, ReadFileResult } from "@/types";
import { 
  Send,
  Settings,
  RotateCcw,
  Lightbulb,
  Box
} from "lucide-react";

function SandboxIndicator({ status }: { status: "creating" | "ready" | "error" }) {
  if (status === "creating") {
    return (
      <div data-design-id="sandbox-indicator" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-orange-500/10 border border-orange-500/20 animate-pulse">
        <div className="relative">
          <Box className="w-5 h-5 text-orange-500" />
          <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-orange-500 animate-ping" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-medium text-orange-500">Creating sandbox...</span>
          <span className="text-xs text-orange-500/70">Setting up secure environment</span>
        </div>
      </div>
    );
  }
  
  if (status === "ready") {
    return (
      <div data-design-id="sandbox-ready-indicator" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-green-500/10 border border-green-500/20">
        <Box className="w-5 h-5 text-green-500" />
        <div className="flex flex-col">
          <span className="text-sm font-medium text-green-500">Sandbox ready</span>
          <span className="text-xs text-green-500/70">Secure environment active</span>
        </div>
      </div>
    );
  }
  
  return null;
}

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
    e2bApiKey,
    sandboxStatus,
    setSandboxStatus,
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
  }, [chatEntries, sandboxStatus, scrollToBottom]);

  const handleSubmit = async () => {
    if (!input.trim() || isAgentRunning) return;
    
    // Check for OpenRouter API key
    if (!apiKey) {
      setIsSettingsOpen(true);
      return;
    }
    
    // Check for E2B API key
    if (!e2bApiKey) {
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
    setSandboxStatus("idle");

    let currentFileCardId: string | null = null;
    let currentThoughtId: string | null = null;
    let currentReadFileCardId: string | null = null;

    try {
      await sendMessage(input.trim(), (event: AgentEvent) => {
        switch (event.type) {
          case "sandbox_creating":
            setSandboxStatus("creating");
            break;
            
          case "sandbox_ready":
            setSandboxStatus("ready");
            break;
            
          case "sandbox_error":
            setSandboxStatus("error");
            addChatEntry({
              id: crypto.randomUUID(),
              type: "assistant",
              content: `Sandbox Error: ${event.error}. Please check your E2B API key in Settings.`,
              timestamp: new Date(),
            });
            break;
            
          case "iteration":
            setCurrentIteration(event.iteration || 0);
            break;
          
          case "thought_stream_start":
            {
              const thoughtEntry: ChatEntry = {
                id: crypto.randomUUID(),
                type: "assistant",
                content: "",
                iteration: event.iteration,
                timestamp: new Date(),
                isStreaming: true,
              };
              currentThoughtId = thoughtEntry.id;
              addChatEntry(thoughtEntry);
            }
            break;
            
          case "thought_stream_chunk":
            if (currentThoughtId && event.chunk) {
              const store = useStore.getState();
              const entry = store.chatEntries.find(e => e.id === currentThoughtId);
              if (entry) {
                updateChatEntry(currentThoughtId, {
                  content: (entry.content || "") + event.chunk,
                });
              }
            }
            break;
            
          case "thought_stream_end":
            if (currentThoughtId) {
              updateChatEntry(currentThoughtId, {
                content: event.content || "",
                isStreaming: false,
              });
              currentThoughtId = null;
            }
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
            
          case "code_stream_start":
            {
              const filePath = event.file_path || "";
              console.log("[CODE_STREAM_START]", filePath);
              setCodeStreaming({
                filePath,
                content: "",
                isStreaming: true,
                tool: "Editor",
                action: `Editing ${filePath}`,
              });
              
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
            
          case "code_stream_chunk":
            if (event.chunk) {
              console.log("[CODE_STREAM_CHUNK]", event.chunk.slice(0, 20) + "...");
              useStore.getState().appendStreamingCode(event.chunk);
            }
            break;
            
          case "code_stream_end":
            break;
            
          case "tool_call":
            break;
            
          case "tool_result":
            if (event.tool_name === "file_write") {
              if (currentFileCardId) {
                updateChatEntry(currentFileCardId, {
                  fileStatus: event.result?.success ? "created" : "error",
                });
                currentFileCardId = null;
              }
              setCodeStreaming({ isStreaming: false });
              fetchFileTree();
            }
            break;
          
          case "read_file_start":
            {
              const filePath = event.file_path || "";
              console.log("[READ_FILE_START]", filePath);
              
              // Show read file content in computer panel
              setCodeStreaming({
                filePath,
                content: "",
                isStreaming: true,
                tool: "Reader",
                action: `Reading ${filePath}`,
              });
              
              // Create read file card entry
              const readFileEntry: ChatEntry = {
                id: crypto.randomUUID(),
                type: "read_file_card",
                filePath,
                fileStatus: "reading",
                iteration: event.iteration,
                timestamp: new Date(),
              };
              currentReadFileCardId = readFileEntry.id;
              addChatEntry(readFileEntry);
            }
            break;
          
          case "read_file_end":
            {
              const result = event.result as ReadFileResult;
              console.log("[READ_FILE_END]", event.file_path, result?.success);
              
              // Update the read file card with result
              if (currentReadFileCardId) {
                updateChatEntry(currentReadFileCardId, {
                  fileStatus: result?.success ? "read" : "error",
                  readResult: result,
                });
                currentReadFileCardId = null;
              }
              
              // Display the file content in computer panel
              if (result?.success && result?.content) {
                setCodeStreaming({
                  filePath: event.file_path || "",
                  content: result.content,
                  isStreaming: false,
                  tool: "Reader",
                  action: `Read ${event.file_path}`,
                });
              } else {
                setCodeStreaming({ isStreaming: false });
              }
            }
            break;
            
          case "tool_error":
            if (currentFileCardId) {
              updateChatEntry(currentFileCardId, { fileStatus: "error" });
              currentFileCardId = null;
            }
            if (currentReadFileCardId) {
              updateChatEntry(currentReadFileCardId, { fileStatus: "error" });
              currentReadFileCardId = null;
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
    setSandboxStatus("idle");
  };

  const handleStop = async () => {
    await stopAgent();
    setIsAgentRunning(false);
    setCodeStreaming({ isStreaming: false });
  };

  const canChat = apiKey && e2bApiKey;

  return (
    <div 
      data-design-id="chat-panel"
      className="flex flex-col h-full overflow-hidden"
    >
      <div 
        data-design-id="chat-header"
        className="flex items-center justify-between py-2 xs:py-3 sm:py-4 border-b border-border"
      >
        <div className="flex items-center gap-1.5 xs:gap-2 sm:gap-3 min-w-0">
          <div className="w-6 h-6 xs:w-7 xs:h-7 sm:w-8 sm:h-8 rounded-md xs:rounded-lg bg-primary flex items-center justify-center flex-shrink-0 shadow-sm">
            <span className="text-primary-foreground font-bold text-[10px] xs:text-xs sm:text-sm">A</span>
          </div>
          <h1 data-design-id="chat-title" className="text-xs xs:text-sm sm:text-base font-semibold text-foreground truncate max-w-[100px] xs:max-w-[150px] sm:max-w-[300px]">
            {chatEntries.length > 0 && chatEntries[0].type === "user" 
              ? (chatEntries[0].content?.slice(0, 40) + (chatEntries[0].content && chatEntries[0].content.length > 40 ? "..." : ""))
              : "Anygent"
            }
          </h1>
        </div>
        <div className="flex items-center gap-0 xs:gap-0.5 sm:gap-1 flex-shrink-0">
          <button 
            data-design-id="memory-btn"
            onClick={() => setIsMemoryOpen(true)}
            className="w-8 h-8 xs:w-9 xs:h-9 sm:w-8 sm:h-8 flex items-center justify-center rounded-md xs:rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent active:bg-accent transition-colors"
            title="Memory"
          >
            <Lightbulb className="w-4 h-4" />
          </button>
          <button 
            data-design-id="reset-btn"
            onClick={handleReset}
            className="w-8 h-8 xs:w-9 xs:h-9 sm:w-8 sm:h-8 flex items-center justify-center rounded-md xs:rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent active:bg-accent transition-colors"
            title="Reset"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          
          <button 
            data-design-id="settings-btn"
            onClick={() => setIsSettingsOpen(true)}
            className={`w-8 h-8 xs:w-9 xs:h-9 sm:w-8 sm:h-8 flex items-center justify-center rounded-md xs:rounded-lg transition-colors ${
              !canChat 
                ? "text-orange-500 hover:text-orange-600 hover:bg-orange-500/10 animate-pulse" 
                : "text-muted-foreground hover:text-foreground hover:bg-accent active:bg-accent"
            }`}
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div 
        data-design-id="chat-messages"
        className="flex-1 min-h-0 overflow-y-auto py-2 xs:py-3 sm:py-5 scrollbar-none"
        ref={scrollRef}
      >
        <div className="space-y-4 xs:space-y-5 sm:space-y-6 max-w-[768px] mx-auto">
          {/* Show sandbox status indicator when creating */}
          {(sandboxStatus === "creating" || sandboxStatus === "ready") && chatEntries.length > 0 && (
            <SandboxIndicator status={sandboxStatus} />
          )}
          
          {chatEntries.map((entry) => (
            <ChatMessage key={entry.id} entry={entry} />
          ))}
          {isAgentRunning && sandboxStatus !== "creating" && (
            <ThinkingIndicator iteration={currentIteration} maxIterations={maxIterations} />
          )}
        </div>
      </div>

      <div data-design-id="chat-input-area" className="flex-shrink-0 py-2 xs:py-3 bg-background">
        {isAgentRunning && (
          <div className="flex items-center justify-between mb-2 xs:mb-3 px-1">
            <div className="inline-flex items-center gap-1 xs:gap-1.5 px-2 xs:px-2.5 py-0.5 xs:py-1 rounded-md xs:rounded-lg bg-primary/10 border border-primary/20">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></div>
              <span className="text-[10px] xs:text-[11px] font-medium text-primary">
                Iteration {currentIteration}/{maxIterations}
              </span>
            </div>
            <button
              onClick={handleStop}
              className="px-2 xs:px-3 py-1 text-xs xs:text-sm text-destructive hover:bg-destructive/10 active:bg-destructive/20 rounded-md xs:rounded-lg transition-colors"
            >
              Stop
            </button>
          </div>
        )}
        
        {/* Warning banner if API keys are missing */}
        {!canChat && (
          <div 
            data-design-id="api-key-warning"
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-2 mb-2 xs:mb-3 px-3 py-2 rounded-lg bg-orange-500/10 border border-orange-500/20 cursor-pointer hover:bg-orange-500/15 transition-colors"
          >
            <Settings className="w-4 h-4 text-orange-500" />
            <span className="text-xs text-orange-500">
              {!apiKey && !e2bApiKey 
                ? "Configure API keys in Settings to start chatting"
                : !apiKey 
                  ? "OpenRouter API key required"
                  : "E2B API key required for sandbox"
              }
            </span>
          </div>
        )}
        
        <div data-design-id="input-wrapper" className="w-full">
          <div 
            data-design-id="input-area"
            className="flex flex-col min-h-[80px] xs:min-h-[90px] sm:min-h-[140px] p-2 xs:p-2.5 sm:p-5 pb-2 xs:pb-2.5 rounded-lg xs:rounded-xl sm:rounded-2xl bg-card shadow-sm border border-border"
          >
            <div className="flex-1 flex flex-col justify-between">
              <textarea
                ref={textareaRef}
                data-design-id="chat-textarea"
                placeholder={canChat ? "Ask Anygent to help you..." : "Configure API keys in Settings to start..."}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full min-h-[32px] xs:min-h-[40px] sm:min-h-[60px] bg-transparent border-none outline-none resize-none font-sans text-xs xs:text-sm leading-relaxed text-foreground placeholder:text-muted-foreground"
                disabled={isAgentRunning || !canChat}
                rows={2}
              />
              
              <div data-design-id="input-actions" className="flex items-center justify-between mt-1 xs:mt-2">
                <div className="flex items-center gap-1 xs:gap-2">
                  <ModelSelector />
                </div>
                
                <button
                  data-design-id="send-btn"
                  onClick={handleSubmit}
                  disabled={isAgentRunning || !input.trim() || !canChat}
                  className="w-9 h-9 xs:w-10 xs:h-10 sm:w-8 sm:h-8 rounded-lg bg-primary flex items-center justify-center hover:brightness-105 active:scale-95 transition-all disabled:bg-accent disabled:cursor-not-allowed"
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