import { useState, useRef, useEffect } from "react";
import { Send, Square, Settings, RotateCcw, Sparkles, ChevronDown, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ChatMessage as ChatMessageType, ToolCallInfo } from "@/lib/store";
import ChatMessage from "./ChatMessage";
import ThinkingIndicator from "./ThinkingIndicator";

interface ChatPanelProps {
  messages: ChatMessageType[];
  isRunning: boolean;
  isThinking: boolean;
  currentIteration: number;
  selectedModel: string;
  onSend: (message: string) => void;
  onStop: () => void;
  onReset: () => void;
  onOpenSettings: () => void;
}

export default function ChatPanel({
  messages,
  isRunning,
  isThinking,
  currentIteration,
  selectedModel,
  onSend,
  onStop,
  onReset,
  onOpenSettings,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || isRunning) return;
    onSend(trimmed);
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextareaInput = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + "px";
    }
  };

  const modelShort = selectedModel.split("/").pop() || selectedModel;

  return (
    <div data-design-id="chat-panel" className="flex flex-col h-full">
      <div data-design-id="chat-header" className="flex items-center justify-between px-5 py-4 bg-[#252525] border-b border-[#404040]/30">
        <div data-design-id="chat-header-left" className="flex items-center gap-3">
          <div data-design-id="chat-logo" className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#6366f1] to-[#6366f1]/60 flex items-center justify-center shadow-lg shadow-[#6366f1]/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 data-design-id="chat-title" className="text-sm font-semibold text-[#f0f0f0]">AI Agent</h1>
            <p data-design-id="chat-subtitle" className="text-[11px] text-[#a1a1aa]">Autonomous General Agent</p>
          </div>
        </div>
        <div data-design-id="chat-header-right" className="flex items-center gap-1">
          {currentIteration > 0 && (
            <div data-design-id="header-iteration-badge" className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#6366f1]/10 border border-[#6366f1]/20 mr-2">
              <Zap className="w-3 h-3 text-[#6366f1]" />
              <span className="text-[10px] font-medium text-[#6366f1]">{currentIteration}</span>
            </div>
          )}
          <button
            data-design-id="reset-btn"
            onClick={onReset}
            className="p-2.5 rounded-xl text-[#a1a1aa] hover:text-[#f0f0f0] hover:bg-white/5 transition-all duration-200"
            title="Reset conversation"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
          <button
            data-design-id="settings-btn"
            onClick={onOpenSettings}
            className="p-2.5 rounded-xl text-[#a1a1aa] hover:text-[#f0f0f0] hover:bg-white/5 transition-all duration-200"
            title="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div data-design-id="chat-messages-area" className="flex-1 overflow-y-auto p-5 space-y-4 bg-[#1e1e1e]">
        {messages.length === 0 && (
          <div data-design-id="chat-empty-state" className="flex flex-col items-center justify-center h-full text-center">
            <div data-design-id="empty-state-icon" className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#6366f1]/20 to-[#22d3ee]/20 flex items-center justify-center mb-4">
              <Sparkles className="w-8 h-8 text-[#6366f1]" />
            </div>
            <h2 data-design-id="empty-state-title" className="text-lg font-semibold text-[#f0f0f0] mb-2">Autonomous AI Agent</h2>
            <p data-design-id="empty-state-description" className="text-sm text-[#a1a1aa] max-w-xs">
              Describe a task and the agent will autonomously reason, act, and create files to accomplish your goal.
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}

        {isThinking && <ThinkingIndicator />}

        <div ref={messagesEndRef} />
      </div>

      <div data-design-id="chat-input-area" className="p-4 bg-[#252525] border-t border-[#404040]/30">
        <div data-design-id="chat-input-wrapper" className="relative">
          <textarea
            data-design-id="chat-textarea"
            ref={textareaRef}
            placeholder="Describe what you want to build..."
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              handleTextareaInput();
            }}
            onKeyDown={handleKeyDown}
            disabled={isRunning}
            className="w-full min-h-[80px] max-h-[200px] bg-[#323234] rounded-2xl px-4 py-3 pr-14 text-sm text-[#f0f0f0] placeholder:text-[#a1a1aa]/60 resize-none focus:outline-none focus:ring-2 focus:ring-[#6366f1]/50 border border-transparent focus:border-[#6366f1]/30 transition-all disabled:opacity-50"
            rows={3}
          />

          <div data-design-id="chat-input-controls" className="absolute bottom-3 right-3 flex items-center gap-2">
            {isRunning ? (
              <button
                data-design-id="stop-btn"
                onClick={onStop}
                className="h-10 w-10 rounded-xl bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-md shadow-red-500/20 transition-all duration-200 active:scale-[0.98]"
                title="Stop agent"
              >
                <Square className="w-4 h-4 text-white" />
              </button>
            ) : (
              <button
                data-design-id="send-btn"
                onClick={handleSend}
                disabled={!input.trim()}
                className="h-10 w-10 rounded-xl bg-[#6366f1] hover:bg-[#6366f1]/90 flex items-center justify-center shadow-md shadow-[#6366f1]/20 hover:shadow-lg hover:shadow-[#6366f1]/30 transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-5 h-5 text-white" />
              </button>
            )}
          </div>
        </div>

        <div data-design-id="chat-input-footer" className="flex items-center justify-between mt-2 px-1">
          <button
            data-design-id="model-selector-btn"
            onClick={onOpenSettings}
            className="flex items-center gap-1.5 text-[11px] text-[#a1a1aa] hover:text-[#f0f0f0] transition-colors"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="truncate max-w-[180px]">{modelShort}</span>
            <ChevronDown className="w-3 h-3" />
          </button>
          {isRunning && (
            <span data-design-id="running-indicator" className="flex items-center gap-1.5 text-[11px] text-[#6366f1]">
              <div className="w-1.5 h-1.5 rounded-full bg-[#6366f1] animate-pulse" />
              Agent running...
            </span>
          )}
        </div>
      </div>
    </div>
  );
}