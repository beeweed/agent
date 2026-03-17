import { User, Sparkles } from "lucide-react";
import type { ChatMessage as ChatMessageType } from "@/lib/store";
import ToolCallBlock from "./ToolCallBlock";
import ReactMarkdown from "react-markdown";

interface ChatMessageProps {
  message: ChatMessageType;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  if (message.role === "user") {
    return (
      <div data-design-id="user-message-row" className="flex gap-3 justify-end animate-fade-in-up">
        <div
          data-design-id="user-message-bubble"
          className="max-w-[85%] px-4 py-3 rounded-2xl rounded-tr-md bg-[#6366f1] text-white shadow-lg shadow-[#6366f1]/10"
        >
          <p data-design-id="user-message-text" className="text-sm leading-relaxed">{message.content}</p>
        </div>
        <div data-design-id="user-avatar" className="w-8 h-8 rounded-xl bg-[#6366f1]/20 flex items-center justify-center flex-shrink-0">
          <User className="w-4 h-4 text-[#6366f1]" />
        </div>
      </div>
    );
  }

  return (
    <div data-design-id="assistant-message-row" className="flex gap-3 animate-fade-in-up">
      <div data-design-id="assistant-avatar" className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#6366f1]/20 to-[#22d3ee]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Sparkles className="w-4 h-4 text-[#6366f1]" />
      </div>
      <div data-design-id="assistant-message-content" className="flex-1 min-w-0">
        <span data-design-id="assistant-label" className="text-xs font-medium text-[#a1a1aa] mb-2 block">Agent</span>

        {message.iteration > 0 && (
          <div data-design-id="iteration-badge" className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#6366f1]/10 border border-[#6366f1]/20 mb-3">
            <div className={`w-1.5 h-1.5 rounded-full bg-[#6366f1] ${message.isStreaming ? "animate-pulse" : ""}`} />
            <span className="text-[10px] font-medium text-[#6366f1]">
              Iteration {message.iteration}/5000
            </span>
          </div>
        )}

        {message.content && (
          <div data-design-id="assistant-text" className="prose prose-sm prose-invert max-w-none text-sm leading-relaxed text-[#f0f0f0]/90 mb-3">
            <ReactMarkdown
              components={{
                p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                code: ({ children, className }) => {
                  const isInline = !className;
                  if (isInline) {
                    return (
                      <code className="bg-[#6366f1]/15 text-[#e06c75] px-1.5 py-0.5 rounded text-[13px] font-mono">
                        {children}
                      </code>
                    );
                  }
                  return (
                    <pre className="bg-[#1e1e1e] rounded-lg p-3 overflow-x-auto my-2 border border-[#404040]/30">
                      <code className="text-[13px] font-mono text-[#abb2bf]">{children}</code>
                    </pre>
                  );
                },
                ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-1">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-1">{children}</ol>,
                strong: ({ children }) => <strong className="font-semibold text-[#f0f0f0]">{children}</strong>,
                h1: ({ children }) => <h1 className="text-lg font-bold text-[#f0f0f0] mb-2">{children}</h1>,
                h2: ({ children }) => <h2 className="text-base font-bold text-[#f0f0f0] mb-2">{children}</h2>,
                h3: ({ children }) => <h3 className="text-sm font-bold text-[#f0f0f0] mb-1">{children}</h3>,
              }}
            >
              {message.content}
            </ReactMarkdown>
            {message.isStreaming && (
              <span data-design-id="cursor-blink" className="inline-block w-1.5 h-4 bg-[#6366f1] animate-pulse ml-0.5 align-text-bottom rounded-sm" />
            )}
          </div>
        )}

        {message.toolCalls.length > 0 && (
          <div data-design-id="tool-calls-list" className="space-y-2 mb-3">
            {message.toolCalls.map((tc) => (
              <ToolCallBlock key={tc.id} toolCall={tc} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}