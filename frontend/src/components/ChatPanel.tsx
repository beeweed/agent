import { useRef, useEffect, useState, useCallback } from "react";
import { useStore } from "@/store/useStore";
import { useApi } from "@/hooks/useApi";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ChatMessage } from "./ChatMessage";
import { ThinkingIndicator } from "./ThinkingIndicator";
import type { AgentEvent, ChatEntry } from "@/types";

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
            break;
            
          case "complete":
            fetchMemory();
            break;
            
          case "max_iterations_reached":
            addChatEntry({
              id: crypto.randomUUID(),
              type: "assistant",
              content: `Maximum iterations (${event.max_iterations}) reached. The agent has stopped.`,
              timestamp: new Date(),
            });
            break;
            
          case "error":
            addChatEntry({
              id: crypto.randomUUID(),
              type: "assistant",
              content: `Error: ${event.error}`,
              timestamp: new Date(),
            });
            break;
            
          case "stream_end":
            setIsAgentRunning(false);
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
  };

  const handleStop = async () => {
    await stopAgent();
    setIsAgentRunning(false);
  };

  return (
    <div 
      data-design-id="chat-panel"
      className="flex flex-col h-full m-3 rounded-3xl border border-white/5 overflow-hidden bg-[#1e1e1e]"
    >
      {/* Header */}
      <div 
        data-design-id="chat-header"
        className="flex items-center justify-between px-5 py-4 bg-[#252525] border-b border-border/30"
      >
        <div className="flex items-center gap-3">
          <div 
            data-design-id="chat-logo"
            className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg shadow-primary/20"
          >
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
          </div>
          <div>
            <h1 data-design-id="chat-title" className="text-sm font-semibold text-foreground">Vibe Coder</h1>
            <p data-design-id="chat-subtitle" className="text-[11px] text-muted-foreground">Autonomous AI Agent</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button 
            data-design-id="memory-button"
            onClick={() => setIsMemoryOpen(true)}
            className="p-2.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all duration-200"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </button>
          <button 
            data-design-id="reset-button"
            onClick={handleReset}
            className="p-2.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all duration-200"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <button 
            data-design-id="settings-button"
            onClick={() => setIsSettingsOpen(true)}
            className="p-2.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all duration-200"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div 
        data-design-id="chat-messages"
        className="flex-1 overflow-y-auto p-5"
        ref={scrollRef}
      >
        <div className="space-y-4">
          {chatEntries.map((entry) => (
            <ChatMessage key={entry.id} entry={entry} />
          ))}
          {isAgentRunning && (
            <ThinkingIndicator iteration={currentIteration} maxIterations={maxIterations} />
          )}
        </div>
      </div>

      {/* Input Area */}
      <div data-design-id="chat-input-area" className="p-4 bg-[#252525] border-t border-border/30">
        {isAgentRunning && (
          <div className="flex items-center justify-between mb-3 px-2">
            <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-primary/10 border border-primary/20">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></div>
              <span className="text-[10px] font-medium text-primary">
                Iteration {currentIteration}/{maxIterations}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleStop}
              className="text-destructive hover:text-destructive"
            >
              Stop
            </Button>
          </div>
        )}
        <div className="relative">
          <Textarea
            ref={textareaRef}
            data-design-id="chat-input"
            placeholder="Describe what you want to build..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="min-h-[100px] max-h-[200px] bg-[#323234] rounded-2xl px-4 py-4 pr-14 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 border border-transparent focus:border-primary/30 transition-all"
            disabled={isAgentRunning}
          />
          <button
            data-design-id="chat-send-button"
            onClick={handleSubmit}
            disabled={isAgentRunning || !input.trim()}
            className="absolute bottom-3 right-3 h-10 w-10 rounded-xl bg-primary hover:bg-primary/90 flex items-center justify-center shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}