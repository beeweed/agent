import { useRef, useEffect, useState, useCallback } from "react";
import { useStore } from "@/store/useStore";
import { useTerminalStore } from "@/store/useTerminalStore";
import { useApi } from "@/hooks/useApi";
import { ChatMessage } from "./ChatMessage";
import { ThinkingIndicator } from "./ThinkingIndicator";
import { ModelSelector } from "./ModelSelector";
import type { AgentEvent, ChatEntry, ReadFileResult, ReplaceInFileResult, InsertLineResult, DeleteLinesResult, DeleteStrFromFileResult, ShellResult, BashViewResult } from "@/types";
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
    e2bTemplateId,
    sandboxStatus,
    setSandboxStatus,
    setCodeStreaming,
    resetCodeStreaming,
  } = useStore();
  
  const { sendMessage, fetchFileTree, fetchMemory, resetChat, stopAgent, registerTerminalSession } = useApi();

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
    
    // Check for E2B Template ID
    if (!e2bTemplateId) {
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
    let currentThoughtId: string | null = null;
    let currentReadFileCardId: string | null = null;
    let currentReplaceInFileCardId: string | null = null;
    let currentInsertLineCardId: string | null = null;
    let currentDeleteLinesCardId: string | null = null;
    let currentDeleteStrCardId: string | null = null;
    let currentShellCardId: string | null = null;
    let currentBashViewCardId: string | null = null;

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
          
          case "replace_in_file_start":
            {
              const filePath = event.file_path || "";
              const oldString = event.old_string || "";
              const newString = event.new_string || "";
              console.log("[REPLACE_IN_FILE_START]", filePath);
              
              // Show diff view in computer panel
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
              
              // Create replace in file card entry
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
            }
            break;
          
          case "replace_in_file_end":
            {
              const result = event.result as ReplaceInFileResult;
              console.log("[REPLACE_IN_FILE_END]", event.file_path, result?.success);
              
              // Update the replace in file card with result
              if (currentReplaceInFileCardId) {
                updateChatEntry(currentReplaceInFileCardId, {
                  fileStatus: result?.success ? "replaced" : "error",
                  replaceResult: result,
                });
                currentReplaceInFileCardId = null;
              }
              
              // Keep showing the diff view but mark streaming as complete
              setCodeStreaming({ 
                isStreaming: false,
              });
              
              // Refresh file tree after replacement
              fetchFileTree();
            }
            break;
          
          case "insert_line_start":
            {
              const filePath = event.file_path || "";
              const insertLine = event.insert_line || 0;
              const newStr = event.new_str || "";
              console.log("[INSERT_LINE_START]", filePath, "at line", insertLine);
              
              // Show insert view in computer panel
              setCodeStreaming({
                filePath,
                content: "",
                isStreaming: true,
                tool: "Insert",
                action: `Inserting into ${filePath}`,
                isInsertView: true,
                insertLine,
                newStr,
              });
              
              // Create insert line card entry
              const insertEntry: ChatEntry = {
                id: crypto.randomUUID(),
                type: "insert_line_card",
                filePath,
                fileStatus: "inserting",
                insertLine,
                newStr,
                iteration: event.iteration,
                timestamp: new Date(),
              };
              currentInsertLineCardId = insertEntry.id;
              addChatEntry(insertEntry);
            }
            break;
          
          case "insert_line_end":
            {
              const result = event.result as InsertLineResult;
              console.log("[INSERT_LINE_END]", event.file_path, result?.success);
              
              // Update the insert line card with result
              if (currentInsertLineCardId) {
                updateChatEntry(currentInsertLineCardId, {
                  fileStatus: result?.success ? "inserted" : "error",
                  insertResult: result,
                });
                currentInsertLineCardId = null;
              }
              
              // Keep showing the insert view but mark streaming as complete
              setCodeStreaming({ 
                isStreaming: false,
              });
              
              // Refresh file tree after insertion
              fetchFileTree();
            }
            break;
          
          case "delete_lines_start":
            {
              const filePath = event.file_path || "";
              const targetLine = event.target_line;
              console.log("[DELETE_LINES_START]", filePath, "target_line:", targetLine);
              
              // Show delete view in computer panel (will be filled after execution)
              setCodeStreaming({
                filePath,
                content: "",
                isStreaming: true,
                tool: "Delete",
                action: `Deleting from ${filePath}`,
                isDeleteView: true,
                deletedLines: "",
                startLine: 0,
                endLine: 0,
              });
              
              // Create delete lines card entry
              const deleteEntry: ChatEntry = {
                id: crypto.randomUUID(),
                type: "delete_lines_card",
                filePath,
                fileStatus: "deleting",
                targetLine,
                iteration: event.iteration,
                timestamp: new Date(),
              };
              currentDeleteLinesCardId = deleteEntry.id;
              addChatEntry(deleteEntry);
            }
            break;
          
          case "delete_lines_end":
            {
              const result = event.result as DeleteLinesResult;
              console.log("[DELETE_LINES_END]", event.file_path, result?.success);
              
              // Update the delete lines card with result
              if (currentDeleteLinesCardId) {
                updateChatEntry(currentDeleteLinesCardId, {
                  fileStatus: result?.success ? "deleted" : "error",
                  deleteResult: result,
                  deletedLines: result?.deleted_lines || "",
                });
                currentDeleteLinesCardId = null;
              }
              
              // Show deleted lines in computer panel
              if (result?.success && result?.deleted_lines) {
                setCodeStreaming({
                  isStreaming: false,
                  deletedLines: result.deleted_lines,
                  startLine: result.start_line || 0,
                  endLine: result.end_line || 0,
                });
              } else {
                setCodeStreaming({ 
                  isStreaming: false,
                });
              }
              
              // Refresh file tree after deletion
              fetchFileTree();
            }
            break;
          
          case "delete_str_from_file_start":
            {
              const filePath = event.file_path || "";
              const targetStr = event.target_str || "";
              console.log("[DELETE_STR_FROM_FILE_START]", filePath);
              
              // Show delete str view in computer panel
              setCodeStreaming({
                filePath,
                content: "",
                isStreaming: true,
                tool: "Delete",
                action: `Deleting from ${filePath}`,
                isDeleteStrView: true,
                targetStr,
              });
              
              // Create delete str card entry
              const deleteStrEntry: ChatEntry = {
                id: crypto.randomUUID(),
                type: "delete_str_from_file_card",
                filePath,
                fileStatus: "deleting_str",
                targetStr,
                iteration: event.iteration,
                timestamp: new Date(),
              };
              currentDeleteStrCardId = deleteStrEntry.id;
              addChatEntry(deleteStrEntry);
            }
            break;
          
          case "delete_str_from_file_end":
            {
              const result = event.result as DeleteStrFromFileResult;
              console.log("[DELETE_STR_FROM_FILE_END]", event.file_path, result?.success);
              
              // Update the delete str card with result
              if (currentDeleteStrCardId) {
                updateChatEntry(currentDeleteStrCardId, {
                  fileStatus: result?.success ? "deleted_str" : "error",
                  deleteStrResult: result,
                });
                currentDeleteStrCardId = null;
              }
              
              // Keep showing the delete str view but mark streaming as complete
              setCodeStreaming({ 
                isStreaming: false,
              });
              
              // Refresh file tree after deletion
              fetchFileTree();
            }
            break;

          case "bash_view_start":
            {
              const sessionName = event.session_name || "";
              console.log("[BASH_VIEW_START]", sessionName);

              const bashViewEntry: ChatEntry = {
                id: crypto.randomUUID(),
                type: "bash_view_card",
                bashViewSessionName: sessionName,
                bashViewStatus: "viewing",
                iteration: event.iteration,
                timestamp: new Date(),
              };
              currentBashViewCardId = bashViewEntry.id;
              addChatEntry(bashViewEntry);
            }
            break;

          case "bash_view_end":
            {
              const result = event.result as BashViewResult;
              console.log("[BASH_VIEW_END]", result?.session_name, result?.status);

              if (currentBashViewCardId) {
                updateChatEntry(currentBashViewCardId, {
                  bashViewStatus: result?.error ? "error" : "viewed",
                  bashViewResult: result,
                });
                currentBashViewCardId = null;
              }
            }
            break;

          case "terminal_session_request":
            {
              const sessionName = event.session_name || "default";
              console.log("[TERMINAL_SESSION_REQUEST] Creating terminal for session:", sessionName);
              const termStore = useTerminalStore.getState();
              const { tabId } = termStore.findOrCreateTabForSession(sessionName);
              registerTerminalSession(sessionName, tabId);
            }
            break;

          case "terminal_session_switch":
            {
              const sessionName = event.session_name || "default";
              const tabId = event.tab_id || "";
              console.log("[TERMINAL_SESSION_SWITCH] Switching to session:", sessionName, "tab:", tabId);
              if (tabId) {
                useTerminalStore.getState().setActiveTab(tabId);
              }
            }
            break;

          case "shell_exec_start":
            {
              const command = event.command || "";
              const sessionName = event.session_name || "default";
              const description = event.description || "Running command";
              console.log("[SHELL_EXEC_START]", command, "session:", sessionName);

              const termStore = useTerminalStore.getState();
              const existingTab = termStore.getTabIdForSession(sessionName);
              if (existingTab) {
                termStore.setActiveTab(existingTab);
              }

              const shellEntry: ChatEntry = {
                id: crypto.randomUUID(),
                type: "shell_card",
                shellCommand: command,
                shellSessionName: sessionName,
                shellDescription: description,
                shellStatus: "running",
                iteration: event.iteration,
                timestamp: new Date(),
              };
              currentShellCardId = shellEntry.id;
              addChatEntry(shellEntry);
            }
            break;

          case "shell_exec_end":
            {
              const result = event.result as ShellResult;
              console.log("[SHELL_EXEC_END]", result?.success);

              if (currentShellCardId) {
                updateChatEntry(currentShellCardId, {
                  shellStatus: result?.success ? "completed" : "error",
                  shellResult: result,
                });
                currentShellCardId = null;
              }

              // Refresh file tree in case the command modified files
              fetchFileTree();
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
            if (currentReplaceInFileCardId) {
              updateChatEntry(currentReplaceInFileCardId, { fileStatus: "error" });
              currentReplaceInFileCardId = null;
            }
            if (currentInsertLineCardId) {
              updateChatEntry(currentInsertLineCardId, { fileStatus: "error" });
              currentInsertLineCardId = null;
            }
            if (currentDeleteLinesCardId) {
              updateChatEntry(currentDeleteLinesCardId, { fileStatus: "error" });
              currentDeleteLinesCardId = null;
            }
            if (currentDeleteStrCardId) {
              updateChatEntry(currentDeleteStrCardId, { fileStatus: "error" });
              currentDeleteStrCardId = null;
            }
            if (currentShellCardId) {
              updateChatEntry(currentShellCardId, { shellStatus: "error" });
              currentShellCardId = null;
            }
            if (currentBashViewCardId) {
              updateChatEntry(currentBashViewCardId, { bashViewStatus: "error" });
              currentBashViewCardId = null;
            }
            setCodeStreaming({ isStreaming: false, isDiffView: false, isInsertView: false, isDeleteView: false, isDeleteStrView: false });
            break;
            
          case "complete":
            fetchMemory();
            fetchFileTree();  // Refresh file tree after completion
            setCodeStreaming({ isStreaming: false, isDiffView: false, isInsertView: false, isDeleteView: false, isDeleteStrView: false });
            break;
            
          case "max_iterations_reached":
            addChatEntry({
              id: crypto.randomUUID(),
              type: "assistant",
              content: `Maximum iterations (${event.max_iterations}) reached. The agent has stopped.`,
              timestamp: new Date(),
            });
            setCodeStreaming({ isStreaming: false, isDiffView: false, isInsertView: false, isDeleteView: false, isDeleteStrView: false });
            break;
            
          case "error":
            addChatEntry({
              id: crypto.randomUUID(),
              type: "assistant",
              content: `Error: ${event.error}`,
              timestamp: new Date(),
            });
            setCodeStreaming({ isStreaming: false, isDiffView: false, isInsertView: false, isDeleteView: false, isDeleteStrView: false });
            break;
            
          case "stream_end":
            setIsAgentRunning(false);
            setCodeStreaming({ isStreaming: false, isDiffView: false, isInsertView: false, isDeleteView: false, isDeleteStrView: false });
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
      setCodeStreaming({ isStreaming: false, isDeleteView: false, isDeleteStrView: false });
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

  const canChat = apiKey && e2bApiKey && e2bTemplateId;

  return (
    <div 
      data-design-id="chat-panel"
      className="flex flex-col h-full w-full overflow-hidden"
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
        
        {/* Warning banner if API keys or template are missing */}
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
                  : !e2bApiKey
                    ? "E2B API key required for sandbox"
                    : "Create a template to unlock 8GB RAM & 8 CPUs"
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