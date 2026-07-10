import { useRef, useEffect, useState, useCallback } from "react";
import { useStore } from "@/store/useStore";
import { useApi } from "@/hooks/useApi";
import { ChatMessage } from "./ChatMessage";
import { ThinkingIndicator } from "./ThinkingIndicator";
import { ModelSelector } from "./ModelSelector";
import type { AgentEvent, ChatEntry, ReadFileResult, ReplaceInFileResult, ShallToolResult } from "@/types";
import { Send, Settings, RotateCcw, Lightbulb } from "lucide-react";

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
    provider,
    apiKey,
    groqApiKey,
    fireworksApiKey,
    novitaApiKey,
    sandboxStatus,
    setSandboxStatus,
    sandboxMessage,
    setSandboxMessage,
    setCodeStreaming,
    resetCodeStreaming,
    updateLocalFile,
  } = useStore();

  const { sendMessage, fetchFileTree, fetchMemory, resetChat, stopAgent } = useApi();

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [chatEntries, sandboxStatus, sandboxMessage, scrollToBottom]);

  const activeApiKey = provider === "groq" ? groqApiKey : provider === "fireworks" ? fireworksApiKey : apiKey;
  const hasLlmKey = !!activeApiKey;
  const hasSandboxKey = !!novitaApiKey.trim();
  const canChat = hasLlmKey && hasSandboxKey;

  const handleSubmit = async () => {
    if (!input.trim() || isAgentRunning) return;

    if (!hasLlmKey || !hasSandboxKey) {
      setIsSettingsOpen(true);
      return;
    }

    const trimmedInput = input.trim();
    const userEntry: ChatEntry = {
      id: crypto.randomUUID(),
      type: "user",
      content: trimmedInput,
      timestamp: new Date(),
    };
    addChatEntry(userEntry);
    setInput("");
    setIsAgentRunning(true);
    setCurrentIteration(0);
    resetCodeStreaming();

    let currentFileCardId: string | null = null;
    let currentThoughtId: string | null = null;
    let currentReadFileCardId: string | null = null;
    let currentReplaceInFileCardId: string | null = null;
    const shallToolCardIds = new Map<string, string>();

    try {
      await sendMessage(trimmedInput, (event: AgentEvent) => {
        switch (event.type) {
          case "sandbox_creation_start":
            setSandboxStatus("creating");
            setSandboxMessage(event.message || "Creating sandbox...");
            break;

          case "sandbox_creation_log":
            setSandboxStatus("creating");
            setSandboxMessage(event.message || "Creating sandbox...");
            break;

          case "sandbox_creation_end":
            setSandboxStatus("ready");
            setSandboxMessage(event.message || "Sandbox ready");
            void fetchFileTree();
            break;

          case "sandbox_error":
            setSandboxStatus("error");
            setSandboxMessage(event.error || "Sandbox creation failed");
            break;

          case "iteration":
            setCurrentIteration(event.iteration || 0);
            break;

          case "thought_stream_start": {
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
            break;
          }

          case "thought_stream_chunk":
            if (currentThoughtId && event.chunk) {
              const store = useStore.getState();
              const entry = store.chatEntries.find((e) => e.id === currentThoughtId);
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

          case "code_stream_start": {
            const filePath = event.file_path || "";
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
            break;
          }

          case "code_stream_chunk":
            if (event.chunk) {
              useStore.getState().appendStreamingCode(event.chunk);
            }
            break;

          case "tool_call":
            if (event.tool_name === "shall_tool") {
              const args = event.arguments || {};
              const shellEntry: ChatEntry = {
                id: crypto.randomUUID(),
                type: "shall_tool_card",
                toolName: "shall_tool",
                sessionName: String(args.session_name || ""),
                command: String(args.command || ""),
                waitForOutput: args.wait_for_output !== false,
                shellStatus: "running",
                iteration: event.iteration,
                timestamp: new Date(),
              };
              shallToolCardIds.set(event.tool_id || shellEntry.id, shellEntry.id);
              addChatEntry(shellEntry);
            }
            break;

          case "tool_result":
            if (event.tool_name === "file_write") {
              if (currentFileCardId) {
                updateChatEntry(currentFileCardId, {
                  fileStatus: event.result?.success ? "created" : "error",
                });
                currentFileCardId = null;
              }
              if (event.result?.success) {
                const r = event.result as unknown as Record<string, unknown>;
                if (r.file_path && r.content) {
                  updateLocalFile(r.file_path as string, r.content as string);
                }
              }
              setCodeStreaming({ isStreaming: false });
              void fetchFileTree();
            } else if (event.tool_name === "shall_tool") {
              const result = event.result as ShallToolResult;
              const targetCardId = event.tool_id ? shallToolCardIds.get(event.tool_id) : null;
              if (targetCardId) {
                updateChatEntry(targetCardId, {
                  shellStatus: result.success && !result.timed_out ? "completed" : "error",
                  shellResult: result,
                });
              }
            }
            break;

          case "read_file_start": {
            const filePath = event.file_path || "";
            setCodeStreaming({
              filePath,
              content: "",
              isStreaming: true,
              tool: "Reader",
              action: `Reading ${filePath}`,
            });

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
            break;
          }

          case "read_file_end": {
            const result = event.result as ReadFileResult;
            if (currentReadFileCardId) {
              updateChatEntry(currentReadFileCardId, {
                fileStatus: result?.success ? "read" : "error",
                readResult: result,
              });
              currentReadFileCardId = null;
            }

            if (result?.success && result?.content) {
              setCodeStreaming({
                filePath: event.file_path || "",
                content: result.content,
                isStreaming: false,
                tool: "Reader",
                action: `Read ${event.file_path}`,
              });
              if (result.raw_content && event.file_path) {
                updateLocalFile(event.file_path, result.raw_content);
              }
            } else {
              setCodeStreaming({ isStreaming: false });
            }
            break;
          }

          case "replace_in_file_start": {
            const filePath = event.file_path || "";
            const oldString = event.old_string || "";
            const newString = event.new_string || "";
            setCodeStreaming({
              filePath,
              content: "",
              isStreaming: true,
              tool: "Replace",
              action: `Updating ${filePath}`,
              isDiffView: true,
              oldString,
              newString,
            });

            const replaceEntry: ChatEntry = {
              id: crypto.randomUUID(),
              type: "replace_in_file_card",
              filePath,
              fileStatus: "replacing",
              oldString,
              newString,
              iteration: event.iteration,
              timestamp: new Date(),
            };
            currentReplaceInFileCardId = replaceEntry.id;
            addChatEntry(replaceEntry);
            break;
          }

          case "replace_in_file_end": {
            const result = event.result as ReplaceInFileResult;
            if (currentReplaceInFileCardId) {
              updateChatEntry(currentReplaceInFileCardId, {
                fileStatus: result?.success ? "replaced" : "error",
                replaceResult: result,
              });
              currentReplaceInFileCardId = null;
            }

            if (result?.success && result.file_path && result.new_content) {
              updateLocalFile(result.file_path, result.new_content);
            }

            setCodeStreaming({ isStreaming: false });
            void fetchFileTree();
            break;
          }

          case "tool_error":
            if (currentFileCardId) {
              updateChatEntry(currentFileCardId, { fileStatus: "error" });
              currentFileCardId = null;
            }
            if (currentReadFileCardId) {
              updateChatEntry(currentReadFileCardId, { fileStatus: "error" });
              currentReadFileCardId = null;
            }
            if (currentReplaceInFileCardId) {
              updateChatEntry(currentReplaceInFileCardId, { fileStatus: "error" });
              currentReplaceInFileCardId = null;
            }
            setCodeStreaming({ isStreaming: false, isDiffView: false });
            break;

          case "complete":
            void fetchMemory();
            void fetchFileTree();
            setCodeStreaming({ isStreaming: false, isDiffView: false });
            break;

          case "max_iterations_reached":
            addChatEntry({
              id: crypto.randomUUID(),
              type: "assistant",
              content: `Maximum iterations (${event.max_iterations}) reached. The agent has stopped.`,
              timestamp: new Date(),
            });
            setCodeStreaming({ isStreaming: false, isDiffView: false });
            break;

          case "error":
            addChatEntry({
              id: crypto.randomUUID(),
              type: "assistant",
              content: `Error: ${event.error}`,
              timestamp: new Date(),
            });
            setCodeStreaming({ isStreaming: false, isDiffView: false });
            break;

          case "stream_end":
            setIsAgentRunning(false);
            setCodeStreaming({ isStreaming: false, isDiffView: false });
            break;
        }
      });
    } catch (error) {
      setSandboxStatus("error");
      setSandboxMessage(error instanceof Error ? error.message : "Unknown error");
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
      void handleSubmit();
    }
  };

  const handleReset = async () => {
    await resetChat();
    useStore.getState().clearChat();
    setCurrentIteration(0);
    resetCodeStreaming();
    setSandboxStatus("idle");
    setSandboxMessage("");
  };

  const handleStop = async () => {
    await stopAgent();
    setIsAgentRunning(false);
    setCodeStreaming({ isStreaming: false });
  };

  const missingMessage = !hasLlmKey
    ? `${provider === "groq" ? "Groq" : provider === "fireworks" ? "Fireworks" : "OpenRouter"} API key required`
    : !hasSandboxKey
      ? "Novita sandbox API key required"
      : "";

  return (
    <div data-design-id="chat-panel" className="flex flex-col h-full w-full overflow-hidden">
      <div data-design-id="chat-header" className="flex items-center justify-between py-2 xs:py-3 sm:py-4 border-b border-border">
        <div className="flex items-center gap-1.5 xs:gap-2 sm:gap-3 min-w-0">
          <div className="w-6 h-6 xs:w-7 xs:h-7 sm:w-8 sm:h-8 rounded-md xs:rounded-lg bg-primary flex items-center justify-center flex-shrink-0 shadow-sm">
            <span className="text-primary-foreground font-bold text-[10px] xs:text-xs sm:text-sm">A</span>
          </div>
          <h1 data-design-id="chat-title" className="text-xs xs:text-sm sm:text-base font-semibold text-foreground truncate max-w-[100px] xs:max-w-[150px] sm:max-w-[300px]">
            {chatEntries.length > 0 && chatEntries[0].type === "user"
              ? (chatEntries[0].content?.slice(0, 40) + ((chatEntries[0].content?.length || 0) > 40 ? "..." : ""))
              : "Anygent"}
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
            className={`w-8 h-8 xs:w-9 xs:h-9 sm:w-8 sm:h-8 flex items-center justify-center rounded-md xs:rounded-lg transition-colors ${!canChat ? "text-orange-500 hover:text-orange-600 hover:bg-orange-500/10 animate-pulse" : "text-muted-foreground hover:text-foreground hover:bg-accent active:bg-accent"}`}
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div data-design-id="chat-messages" className="flex-1 min-h-0 overflow-y-auto py-2 xs:py-3 sm:py-5 scrollbar-none" ref={scrollRef}>
        <div className="space-y-4 xs:space-y-5 sm:space-y-6 max-w-[768px] mx-auto">
          {chatEntries.map((entry) => (
            <ChatMessage key={entry.id} entry={entry} />
          ))}
          {isAgentRunning && (
            <ThinkingIndicator
              iteration={currentIteration}
              maxIterations={maxIterations}
              mode={sandboxStatus === "creating" ? "creating-sandbox" : "thinking"}
              message={sandboxMessage || undefined}
            />
          )}
        </div>
      </div>

      <div data-design-id="chat-input-area" className="flex-shrink-0 py-2 xs:py-3 bg-background">
        {isAgentRunning && sandboxStatus !== "creating" && currentIteration > 0 && (
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

        {!canChat && (
          <div
            data-design-id="api-key-warning"
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-2 mb-2 xs:mb-3 px-3 py-2 rounded-lg bg-orange-500/10 border border-orange-500/20 cursor-pointer hover:bg-orange-500/15 transition-colors"
          >
            <Settings className="w-4 h-4 text-orange-500" />
            <span className="text-xs text-orange-500">{missingMessage}</span>
          </div>
        )}

        <div data-design-id="input-wrapper" className="w-full">
          <div data-design-id="input-area" className="flex flex-col min-h-[80px] xs:min-h-[90px] sm:min-h-[140px] p-2 xs:p-2.5 sm:p-5 pb-2 xs:pb-2.5 rounded-lg xs:rounded-xl sm:rounded-2xl bg-card shadow-sm border border-border">
            <div className="flex-1 flex flex-col justify-between">
              <textarea
                ref={textareaRef}
                data-design-id="chat-textarea"
                placeholder={canChat ? "Ask Anygent to help you..." : "Configure your LLM key and Novita sandbox key in Settings to start..."}
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
                  onClick={() => void handleSubmit()}
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