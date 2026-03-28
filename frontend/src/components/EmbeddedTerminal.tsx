import { useState, useEffect, useRef, useCallback } from "react";
import { useStore } from "@/store/useStore";
import { terminalSessionManager } from "@/lib/terminalSessionManager";
import "@xterm/xterm/css/xterm.css";
import {
  TerminalSquare,
  Loader2,
  Check,
  Maximize2,
  Minimize2,
  RefreshCw,
  Search,
  X,
  Copy,
  Download,
  ChevronUp,
  ChevronDown,
  Play,
} from "lucide-react";

interface EmbeddedTerminalProps {
  command: string;
  sessionName?: string;
  entryId: string;
  commandId?: string;
  onOutputCapture?: (output: string) => void;
}

const getApiBase = () => {
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    if (hostname.includes("e2b.app")) {
      return window.location.origin.replace(/\d+-/, "8000-");
    }
  }
  return "http://localhost:8000";
};

const API_BASE = getApiBase();
const MAX_RETRIES = 5;
const RETRY_DELAY = 2000;

export function EmbeddedTerminal({
  command,
  sessionName = "main",
  entryId,
  commandId,
  onOutputCapture,
}: EmbeddedTerminalProps) {
  console.log(
    "[EmbeddedTerminal] Mounted with command:",
    command,
    "commandId:",
    commandId,
    "sessionName:",
    sessionName
  );

  const { e2bApiKey, sandboxStatus, updateChatEntry } = useStore();
  const outputSubmittedRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [status, setStatus] = useState<
    "connecting" | "running" | "completed" | "error"
  >("connecting");
  const [sandboxId, setSandboxId] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState("Initializing terminal...");
  const commandExecutedRef = useRef(false);
  const initializedRef = useRef(false);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const outputBufferRef = useRef<string>("");

  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const handleSearch = useCallback(() => {
    const session = terminalSessionManager.getSession(sessionName);
    if (!session || !searchQuery) return;
    session.addons.search.findNext(searchQuery, {
      caseSensitive: false,
      incremental: true,
    });
  }, [searchQuery, sessionName]);

  const handleSearchPrev = useCallback(() => {
    const session = terminalSessionManager.getSession(sessionName);
    if (!session || !searchQuery) return;
    session.addons.search.findPrevious(searchQuery);
  }, [searchQuery, sessionName]);

  const handleClearSearch = useCallback(() => {
    const session = terminalSessionManager.getSession(sessionName);
    if (!session) return;
    session.addons.search.clearDecorations();
    setSearchQuery("");
    setShowSearch(false);
  }, [sessionName]);

  const handleCopy = useCallback(() => {
    const session = terminalSessionManager.getSession(sessionName);
    if (!session) return;
    const selection = session.xterm.getSelection();
    if (selection) {
      navigator.clipboard.writeText(selection);
    }
  }, [sessionName]);

  const handleExport = useCallback(() => {
    const session = terminalSessionManager.getSession(sessionName);
    if (!session) return;
    const html = session.addons.serialize.serializeAsHTML();
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `command-${entryId}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }, [entryId, sessionName]);

  const submitOutput = useCallback(
    (output: string, success: boolean, error: string | null, resultStatus: "completed" | "error") => {
      if (outputSubmittedRef.current) return;
      outputSubmittedRef.current = true;

      setStatus(resultStatus);

      terminalSessionManager.markCommandCompleted(sessionName);

      if (commandId) {
        console.log("[SHELL_OUTPUT] POSTing to backend:", { command_id: commandId, success, api_base: API_BASE });
        fetch(`${API_BASE}/api/shell/output`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            command_id: commandId,
            output,
            success,
            error,
          }),
        })
          .then((res) => res.json())
          .then((data) => console.log("[SHELL_OUTPUT] Response:", data))
          .catch((err) => console.error("[SHELL_OUTPUT] Failed:", err));
      }

      const shellStatus = resultStatus === "error" ? "error" : "completed";
      updateChatEntry(entryId, {
        shellStatus,
        shellResult: {
          success,
          output,
          error: error || undefined,
          session_name: sessionName,
          command,
        },
      });

      if (onOutputCapture) {
        onOutputCapture(output);
      }

      fetch(`${API_BASE}/api/files/refresh`, { method: "POST" }).catch(console.error);
    },
    [command, commandId, entryId, sessionName, updateChatEntry, onOutputCapture]
  );

  const checkOutput = useCallback(
    (currentOutput: string) => {
      if (outputSubmittedRef.current) return;

      const promptPatterns = [/\$\s*$/, />\s*$/, /#\s*$/, /\]\s*$/, /~\]\$/];
      const hasPrompt = promptPatterns.some((pattern) => pattern.test(currentOutput));

      if (hasPrompt && currentOutput.trim().length > 0) {
        submitOutput(currentOutput, true, null, "completed");
      }
    },
    [submitOutput]
  );

  useEffect(() => {
    let isMounted = true;

    const fetchSandboxId = async (attempt: number = 0): Promise<void> => {
      if (!isMounted) return;

      setLoadingMessage(
        attempt > 0
          ? `Connecting to sandbox... (attempt ${attempt + 1}/${MAX_RETRIES})`
          : "Connecting to sandbox..."
      );

      try {
        const response = await fetch(`${API_BASE}/api/sandbox/status`);
        const data = await response.json();

        if (!isMounted) return;

        if (data.sandbox_id && data.is_running) {
          console.log("[EmbeddedTerminal] Sandbox found:", data.sandbox_id);
          setSandboxId(data.sandbox_id);
          setRetryCount(0);
        } else if (attempt < MAX_RETRIES - 1) {
          setRetryCount(attempt + 1);
          retryTimeoutRef.current = setTimeout(() => fetchSandboxId(attempt + 1), RETRY_DELAY);
        } else {
          setLoadingMessage("Waiting for sandbox to be ready...");
          retryTimeoutRef.current = setTimeout(() => fetchSandboxId(0), RETRY_DELAY * 2);
        }
      } catch (error) {
        console.error("Failed to fetch sandbox status:", error);
        if (!isMounted) return;

        if (attempt < MAX_RETRIES - 1) {
          setRetryCount(attempt + 1);
          setLoadingMessage(`Connection failed, retrying... (${attempt + 1}/${MAX_RETRIES})`);
          retryTimeoutRef.current = setTimeout(() => fetchSandboxId(attempt + 1), RETRY_DELAY);
        } else {
          setLoadingMessage("Connection issues, still trying...");
          retryTimeoutRef.current = setTimeout(() => fetchSandboxId(0), RETRY_DELAY * 3);
        }
      }
    };

    if (e2bApiKey && sandboxStatus === "ready") {
      fetchSandboxId(0);
    } else if (e2bApiKey && sandboxStatus !== "ready") {
      setLoadingMessage("Waiting for sandbox to initialize...");
    }

    return () => {
      isMounted = false;
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    };
  }, [e2bApiKey, sandboxStatus]);

  useEffect(() => {
    if (!sandboxId || !e2bApiKey || initializedRef.current) return;
    initializedRef.current = true;

    const initTerminal = async (attempt: number = 0): Promise<void> => {
      setLoadingMessage(
        attempt > 0
          ? `Initializing terminal... (attempt ${attempt + 1}/${MAX_RETRIES})`
          : "Initializing terminal..."
      );

      try {
        if (!terminalRef.current) {
          if (attempt < MAX_RETRIES - 1) {
            setLoadingMessage("Waiting for terminal container...");
            await new Promise((resolve) => setTimeout(resolve, 500));
            if (!terminalRef.current) {
              initializedRef.current = false;
              retryTimeoutRef.current = setTimeout(() => initTerminal(attempt + 1), RETRY_DELAY);
              return;
            }
          } else {
            initializedRef.current = false;
            retryTimeoutRef.current = setTimeout(() => initTerminal(0), RETRY_DELAY);
            return;
          }
        }

        const existingSession = terminalSessionManager.getSession(sessionName);

        if (existingSession) {
          console.log("[EmbeddedTerminal] Reusing existing session:", sessionName);

          terminalSessionManager.mountTerminalToContainer(sessionName, terminalRef.current!);

          setStatus("running");

          outputBufferRef.current = "";
          outputSubmittedRef.current = false;

          const listenerId = `embedded-${entryId}`;
          terminalSessionManager.addOutputListener(sessionName, listenerId, (text: string) => {
            outputBufferRef.current += text;
            if (commandExecutedRef.current) {
              checkOutput(outputBufferRef.current);
            }
          });

          if (!commandExecutedRef.current) {
            commandExecutedRef.current = true;
            await terminalSessionManager.executeCommand(sessionName, command, commandId || "");
          }

          return;
        }

        console.log("[EmbeddedTerminal] Creating new session:", sessionName);
        const session = await terminalSessionManager.getOrCreateSession(
          sessionName,
          sandboxId,
          e2bApiKey,
          terminalRef.current!
        );

        if (!session) {
          throw new Error("Failed to create terminal session");
        }

        setStatus("running");

        outputBufferRef.current = "";
        outputSubmittedRef.current = false;

        const listenerId = `embedded-${entryId}`;
        terminalSessionManager.addOutputListener(sessionName, listenerId, (text: string) => {
          outputBufferRef.current += text;
          if (commandExecutedRef.current) {
            checkOutput(outputBufferRef.current);
          }
        });

        setTimeout(async () => {
          if (!commandExecutedRef.current) {
            commandExecutedRef.current = true;
            await terminalSessionManager.executeCommand(sessionName, command, commandId || "");
          }
        }, 300);
      } catch (error) {
        console.error("Failed to initialize embedded terminal:", error, "Attempt:", attempt);

        const errorMessage = error instanceof Error ? error.message : "Failed to initialize terminal";

        if (attempt < MAX_RETRIES - 1) {
          setLoadingMessage(`Terminal initialization failed, retrying... (${attempt + 1}/${MAX_RETRIES})`);
          setRetryCount(attempt + 1);
          initializedRef.current = false;
          retryTimeoutRef.current = setTimeout(() => initTerminal(attempt + 1), RETRY_DELAY);
          return;
        }

        if (attempt >= MAX_RETRIES - 1) {
          setLoadingMessage("Having trouble connecting... Still trying...");
          initializedRef.current = false;
          retryTimeoutRef.current = setTimeout(() => initTerminal(0), RETRY_DELAY * 2);
          return;
        }

        setStatus("error");

        if (commandId && !outputSubmittedRef.current) {
          submitOutput("", false, errorMessage, "error");
        }
      }
    };

    initTerminal(0);

    return () => {
      const listenerId = `embedded-${entryId}`;
      terminalSessionManager.removeOutputListener(sessionName, listenerId);
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    };
  }, [
    sandboxId,
    e2bApiKey,
    command,
    sessionName,
    entryId,
    commandId,
    updateChatEntry,
    onOutputCapture,
    checkOutput,
    submitOutput,
  ]);

  useEffect(() => {
    const session = terminalSessionManager.getSession(sessionName);
    if (session) {
      setTimeout(() => {
        session.addons.fit.fit();
      }, 100);
    }
  }, [isExpanded, sessionName]);

  useEffect(() => {
    const handleResize = () => {
      const session = terminalSessionManager.getSession(sessionName);
      if (session) {
        session.addons.fit.fit();
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [sessionName]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        setShowSearch(true);
        setTimeout(() => searchInputRef.current?.focus(), 100);
      }
      if (e.key === "Escape" && showSearch) {
        handleClearSearch();
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener("keydown", handleKeyDown);
      return () => container.removeEventListener("keydown", handleKeyDown);
    }
  }, [showSearch, handleClearSearch]);

  if (!e2bApiKey) {
    return (
      <div
        data-design-id={`embedded-terminal-no-key-${entryId}`}
        className="rounded-lg bg-[#0d1117] border border-[#30363d] p-4 text-center"
      >
        <TerminalSquare className="w-8 h-8 text-gray-500 mx-auto mb-2" />
        <p className="text-xs text-gray-500">E2B API key required</p>
      </div>
    );
  }

  if (sandboxStatus !== "ready" || !sandboxId) {
    return (
      <div
        data-design-id={`embedded-terminal-loading-${entryId}`}
        className="rounded-lg bg-[#0d1117] border border-[#30363d] overflow-hidden"
      >
        <div className="flex items-center justify-between px-3 py-2 bg-[#161b22] border-b border-[#30363d]">
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 text-yellow-400 animate-spin" />
            <TerminalSquare className="w-4 h-4 text-gray-500" />
            <span className="text-xs font-mono text-gray-500">{sessionName}</span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-400">
            Initializing...
          </span>
        </div>

        <div className="px-3 py-1.5 bg-[#161b22] border-b border-[#30363d] font-mono text-xs">
          <span className="text-cyan-400">user@e2b</span>
          <span className="text-gray-500">:</span>
          <span className="text-blue-400">~</span>
          <span className="text-gray-500">$ </span>
          <span className="text-gray-100">{command}</span>
        </div>

        <div className="p-8 flex flex-col items-center justify-center" style={{ minHeight: "200px" }}>
          <div className="relative mb-4">
            <div className="w-12 h-12 rounded-full border-2 border-[#30363d] border-t-green-400 animate-spin" />
            <TerminalSquare className="w-5 h-5 text-green-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="text-sm text-gray-400 mb-1">{loadingMessage}</p>
          {retryCount > 0 && (
            <p className="text-xs text-gray-500">
              Attempt {retryCount + 1} of {MAX_RETRIES}
            </p>
          )}
          <div className="flex gap-1 mt-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-green-400/50 animate-pulse"
                style={{ animationDelay: `${i * 0.2}s` }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      data-design-id={`embedded-terminal-${entryId}`}
      className={`rounded-lg bg-[#0d1117] border border-[#30363d] overflow-hidden transition-all ${
        isExpanded ? "fixed inset-4 z-50" : ""
      }`}
    >
      <div
        data-design-id={`embedded-terminal-header-${entryId}`}
        className="flex items-center justify-between px-3 py-2 bg-[#161b22] border-b border-[#30363d]"
      >
        <div className="flex items-center gap-2">
          {status === "connecting" && <Loader2 className="w-4 h-4 text-yellow-400 animate-spin" />}
          {status === "running" && (
            <div className="relative">
              <Play className="w-4 h-4 text-green-400 fill-green-400" />
              <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-green-400 animate-ping" />
            </div>
          )}
          {status === "completed" && <Check className="w-4 h-4 text-green-400" />}
          {status === "error" && <RefreshCw className="w-4 h-4 text-yellow-400 animate-spin" />}
          <TerminalSquare className="w-4 h-4 text-green-400" />
          <span className="text-xs font-mono text-gray-400">{sessionName}</span>
          {terminalSessionManager.hasSession(sessionName) && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-mono">
              reused
            </span>
          )}
          
        </div>

        <div className="flex items-center gap-1">
          {retryCount > 0 && status === "connecting" && (
            <span className="text-[10px] text-gray-500 mr-1">
              Retry {retryCount}/{MAX_RETRIES}
            </span>
          )}

          <button
            onClick={() => {
              setShowSearch(!showSearch);
              setTimeout(() => searchInputRef.current?.focus(), 100);
            }}
            className={`p-1 rounded transition-colors ${
              showSearch
                ? "bg-green-500/20 text-green-400"
                : "text-gray-400 hover:text-white hover:bg-[#30363d]"
            }`}
            title="Search (Ctrl+F)"
          >
            <Search className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleCopy}
            className="p-1 text-gray-400 hover:text-white rounded hover:bg-[#30363d] transition-colors"
            title="Copy Selection"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleExport}
            className="p-1 text-gray-400 hover:text-white rounded hover:bg-[#30363d] transition-colors"
            title="Export as HTML"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          <span
            className={`text-[10px] px-2 py-0.5 rounded ${
              status === "connecting"
                ? "bg-yellow-500/20 text-yellow-400"
                : status === "running"
                ? "bg-green-500/20 text-green-400 animate-pulse"
                : status === "completed"
                ? "bg-green-500/20 text-green-400"
                : "bg-yellow-500/20 text-yellow-400"
            }`}
          >
            {status === "connecting"
              ? "Connecting..."
              : status === "running"
              ? "Running..."
              : status === "completed"
              ? "Completed"
              : "Reconnecting..."}
          </span>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 text-gray-400 hover:text-white rounded hover:bg-[#30363d] transition-colors"
          >
            {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {showSearch && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#161b22] border-b border-[#30363d]">
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (e.shiftKey) {
                  handleSearchPrev();
                } else {
                  handleSearch();
                }
              }
            }}
            placeholder="Search..."
            className="flex-1 h-6 px-2 bg-[#0d1117] border border-[#30363d] rounded text-xs text-white placeholder-gray-500 focus:outline-none focus:border-green-400"
          />
          <button
            onClick={handleSearchPrev}
            className="p-1 text-gray-400 hover:text-white hover:bg-[#30363d] rounded"
            title="Previous (Shift+Enter)"
          >
            <ChevronUp size={14} />
          </button>
          <button
            onClick={handleSearch}
            className="p-1 text-gray-400 hover:text-white hover:bg-[#30363d] rounded"
            title="Next (Enter)"
          >
            <ChevronDown size={14} />
          </button>
          <button
            onClick={handleClearSearch}
            className="p-1 text-gray-400 hover:text-white hover:bg-[#30363d] rounded"
            title="Close"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <div
        data-design-id={`embedded-terminal-command-${entryId}`}
        className="px-3 py-1.5 bg-[#161b22] border-b border-[#30363d] font-mono text-xs"
      >
        <span className="text-cyan-400">user@e2b</span>
        <span className="text-gray-500">:</span>
        <span className="text-blue-400">~</span>
        <span className="text-gray-500">$ </span>
        <span className="text-gray-100">{command}</span>
      </div>

      <div
        ref={terminalRef}
        data-design-id={`embedded-terminal-content-${entryId}`}
        className="p-2"
        style={{
          minHeight: isExpanded ? "calc(100vh - 160px)" : "200px",
          maxHeight: isExpanded ? "calc(100vh - 160px)" : "400px",
        }}
      />

      <div className="h-5 bg-[#161b22] border-t border-[#30363d] flex items-center justify-between px-3 text-[10px] text-gray-500">
        <span>
          {status === "running" && (
            <span className="text-green-400 flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Command executing...
            </span>
          )}
          {status !== "running" && "WebGL Accelerated • Unicode 11 • Image Support"}
        </span>
        <span>
          {status === "completed" && `${outputBufferRef.current.split("\n").length} lines`}
          {status === "running" && "Output streaming..."}
        </span>
      </div>
    </div>
  );
}