import { useState, useEffect, useRef, useCallback } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { Sandbox } from "e2b";
import { useStore } from "@/store/useStore";
import { isLongRunningCommand, detectServerStatus, getDetectionSummary } from "@/lib/serverDetection";
import {
  createEnhancedTerminal,
  loadWebGLRenderer,
} from "@/lib/terminal";
import type { TerminalAddons } from "@/lib/terminal";
import "@xterm/xterm/css/xterm.css";
import {
  TerminalSquare,
  Loader2,
  Check,
  Maximize2,
  Minimize2,
  Server,
  RefreshCw,
  Search,
  X,
  Copy,
  Download,
  ChevronUp,
  ChevronDown,
  ExternalLink,
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
    "isLongRunning:",
    isLongRunningCommand(command)
  );

  const { e2bApiKey, sandboxStatus, updateChatEntry } = useStore();
  const outputSubmittedRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [status, setStatus] = useState<
    "connecting" | "running" | "completed" | "error" | "server_running"
  >("connecting");
  const [sandboxId, setSandboxId] = useState<string | null>(null);
  const [_isTerminalReady, setIsTerminalReady] = useState(false);
  const [_capturedOutput, setCapturedOutput] = useState("");
  const [serverUrls, setServerUrls] = useState<string[]>([]);
  const [retryCount, setRetryCount] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState("Initializing terminal...");
  const isLongRunning = isLongRunningCommand(command);

  // Search state
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const sandboxRef = useRef<Sandbox | null>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const addonsRef = useRef<TerminalAddons | null>(null);
  const terminalPidRef = useRef<number | null>(null);
  const outputBufferRef = useRef<string>("");
  const commandExecutedRef = useRef(false);
  const initializedRef = useRef(false);
  const serverDetectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Search handlers
  const handleSearch = useCallback(() => {
    if (!addonsRef.current || !searchQuery) return;
    addonsRef.current.search.findNext(searchQuery, {
      caseSensitive: false,
      incremental: true,
    });
  }, [searchQuery]);

  const handleSearchPrev = useCallback(() => {
    if (!addonsRef.current || !searchQuery) return;
    addonsRef.current.search.findPrevious(searchQuery);
  }, [searchQuery]);

  const handleClearSearch = useCallback(() => {
    if (!addonsRef.current) return;
    addonsRef.current.search.clearDecorations();
    setSearchQuery("");
    setShowSearch(false);
  }, []);

  // Copy selection
  const handleCopy = useCallback(() => {
    if (!xtermRef.current) return;
    const selection = xtermRef.current.getSelection();
    if (selection) {
      navigator.clipboard.writeText(selection);
    }
  }, []);

  // Export as HTML
  const handleExport = useCallback(() => {
    if (!addonsRef.current) return;
    const html = addonsRef.current.serialize.serializeAsHTML();
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `command-${entryId}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }, [entryId]);

  // Fallback timeout function to check for server ready state
  const checkServerReadyFallback = useCallback(() => {
    if (outputSubmittedRef.current || !isLongRunning) return;

    const serverStatus = detectServerStatus(command, outputBufferRef.current);
    const detectionSummary = getDetectionSummary(command, outputBufferRef.current);

    console.log("[SERVER_DETECTION_FALLBACK] Checking with accumulated output...", {
      outputLength: outputBufferRef.current.length,
      isReady: serverStatus.isReady,
      hasPortConflict: serverStatus.hasPortConflict,
      urls: serverStatus.urls,
      detectionSummary,
    });

    // Check for port conflict first
    if (serverStatus.hasPortConflict && !outputSubmittedRef.current) {
      console.log("[SERVER_DETECTION_FALLBACK] Port conflict detected!");
      outputSubmittedRef.current = true;
      setStatus("error");

      if (commandId) {
        fetch(`${API_BASE}/api/shell/output`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            command_id: commandId,
            output: serverStatus.message,
            success: false,
            error: "Port conflict detected. Please use a different port.",
          }),
        }).catch(console.error);
      }

      updateChatEntry(entryId, {
        shellStatus: "error",
        shellResult: {
          success: false,
          output: serverStatus.message,
          error: "Port conflict detected",
          session_name: sessionName,
          command: command,
        },
      });
      return;
    }

    if (serverStatus.isReady && !outputSubmittedRef.current) {
      console.log("[SERVER_DETECTION_FALLBACK] Server detected! Submitting full output with URLs...");
      outputSubmittedRef.current = true;
      setStatus("server_running");
      setServerUrls(serverStatus.urls);

      if (commandId) {
        console.log("[SHELL_OUTPUT_FALLBACK] POSTing to backend with full output:", {
          command_id: commandId,
          urlCount: serverStatus.urls.length,
          api_base: API_BASE,
        });
        fetch(`${API_BASE}/api/shell/output`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            command_id: commandId,
            output: serverStatus.message,
            success: true,
            error: null,
          }),
        })
          .then((res) => {
            console.log("[SHELL_OUTPUT_FALLBACK] Response status:", res.status);
            return res.json();
          })
          .then((data) => {
            console.log("[SHELL_OUTPUT_FALLBACK] Response data:", data);
          })
          .catch((err) => {
            console.error("[SHELL_OUTPUT_FALLBACK] Failed:", err);
          });
      }

      updateChatEntry(entryId, {
        shellStatus: "server_running",
        shellResult: {
          success: true,
          output: serverStatus.message,
          session_name: sessionName,
          command: command,
          urls: serverStatus.urls,
        },
      });

      fetch(`${API_BASE}/api/files/refresh`, { method: "POST" }).catch(console.error);
    }
  }, [command, commandId, entryId, isLongRunning, sessionName, updateChatEntry]);

  // Fetch sandbox ID from backend with retry logic
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
          console.log("[EmbeddedTerminal] Sandbox connected:", data.sandbox_id);
          setSandboxId(data.sandbox_id);
          setRetryCount(0);
        } else if (attempt < MAX_RETRIES - 1) {
          console.log("[EmbeddedTerminal] Sandbox not ready, retrying in", RETRY_DELAY, "ms");
          setRetryCount(attempt + 1);
          retryTimeoutRef.current = setTimeout(() => {
            fetchSandboxId(attempt + 1);
          }, RETRY_DELAY);
        } else {
          console.log("[EmbeddedTerminal] Sandbox not ready after retries, will keep polling...");
          setLoadingMessage("Waiting for sandbox to be ready...");
          retryTimeoutRef.current = setTimeout(() => {
            fetchSandboxId(0);
          }, RETRY_DELAY * 2);
        }
      } catch (error) {
        console.error("Failed to fetch sandbox status:", error);

        if (!isMounted) return;

        if (attempt < MAX_RETRIES - 1) {
          console.log("[EmbeddedTerminal] Network error, retrying...");
          setRetryCount(attempt + 1);
          setLoadingMessage(`Connection failed, retrying... (${attempt + 1}/${MAX_RETRIES})`);
          retryTimeoutRef.current = setTimeout(() => {
            fetchSandboxId(attempt + 1);
          }, RETRY_DELAY);
        } else {
          setLoadingMessage("Connection issues, still trying...");
          retryTimeoutRef.current = setTimeout(() => {
            fetchSandboxId(0);
          }, RETRY_DELAY * 3);
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
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [e2bApiKey, sandboxStatus]);

  // Connect to sandbox and initialize terminal
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
        // Connect to sandbox with retry
        console.log("[EmbeddedTerminal] Connecting to sandbox:", sandboxId);
        const sandbox = await Sandbox.connect(sandboxId, {
          apiKey: e2bApiKey,
        });
        sandboxRef.current = sandbox;
        console.log("[EmbeddedTerminal] Sandbox connected successfully");

        // Wait for container to be ready with retry
        if (!terminalRef.current) {
          console.log("[EmbeddedTerminal] Terminal ref not ready, waiting...");
          if (attempt < MAX_RETRIES - 1) {
            setLoadingMessage("Waiting for terminal container...");
            await new Promise((resolve) => setTimeout(resolve, 500));
            if (terminalRef.current) {
              console.log("[EmbeddedTerminal] Terminal ref now ready");
            } else {
              retryTimeoutRef.current = setTimeout(() => initTerminal(attempt + 1), RETRY_DELAY);
              return;
            }
          } else {
            setLoadingMessage("Preparing terminal...");
            retryTimeoutRef.current = setTimeout(() => initTerminal(0), RETRY_DELAY);
            return;
          }
        }

        // Create enhanced terminal with all addons
        const { terminal: xterm, addons } = createEnhancedTerminal(
          {
            fontSize: 13,
            scrollback: 5000,
          },
          "github"
        );

        // Open terminal in DOM
        xterm.open(terminalRef.current);

        // Load WebGL renderer for better performance
        loadWebGLRenderer(xterm, addons);

        xtermRef.current = xterm;
        addonsRef.current = addons;

        // Fit terminal to container
        setTimeout(() => {
          addons.fit.fit();
        }, 50);

        // Create PTY terminal
        const cols = xterm.cols;
        const rows = xterm.rows;

        const pty = await sandbox.pty.create({
          cols,
          rows,
          onData: (data: Uint8Array) => {
            const text = new TextDecoder().decode(data);
            xterm.write(data);

            // Capture output for LLM
            outputBufferRef.current += text;
            setCapturedOutput(outputBufferRef.current);

            // Only check for completion after command was executed
            if (commandExecutedRef.current) {
              // Check for long-running server commands first
              if (isLongRunningCommand(command)) {
                const serverStatus = detectServerStatus(command, outputBufferRef.current);
                const detectionSummary = getDetectionSummary(command, outputBufferRef.current);

                console.log("[SERVER_DETECTION] Checking output for server ready state...");
                console.log(
                  "[SERVER_DETECTION] isReady:",
                  serverStatus.isReady,
                  "hasPortConflict:",
                  serverStatus.hasPortConflict,
                  "urls:",
                  serverStatus.urls
                );
                console.log("[SERVER_DETECTION] Summary:", detectionSummary);

                // Check for port conflict FIRST
                if (serverStatus.hasPortConflict && !outputSubmittedRef.current) {
                  console.log("[SERVER_DETECTION] Port conflict detected! Notifying LLM...");
                  outputSubmittedRef.current = true;

                  setStatus("error");

                  if (commandId) {
                    console.log("[SHELL_OUTPUT] POSTing port conflict to backend");
                    fetch(`${API_BASE}/api/shell/output`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        command_id: commandId,
                        output: serverStatus.message,
                        success: false,
                        error:
                          "Port conflict detected. The port is already in use. Please try a different port.",
                      }),
                    }).catch(console.error);
                  }

                  updateChatEntry(entryId, {
                    shellStatus: "error",
                    shellResult: {
                      success: false,
                      output: serverStatus.message,
                      error: "Port conflict detected",
                      session_name: sessionName,
                      command: command,
                    },
                  });

                  return;
                }

                if (serverStatus.isReady && !outputSubmittedRef.current) {
                  console.log(
                    "[SERVER_DETECTION] Server detected as ready! Submitting full output with URLs..."
                  );
                  outputSubmittedRef.current = true;

                  setStatus("server_running");
                  setServerUrls(serverStatus.urls);

                  const capturedOutput = outputBufferRef.current;

                  if (commandId) {
                    console.log("[SHELL_OUTPUT] POSTing server ready output to backend:", {
                      command_id: commandId,
                      urlCount: serverStatus.urls.length,
                      api_base: API_BASE,
                    });
                    fetch(`${API_BASE}/api/shell/output`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        command_id: commandId,
                        output: serverStatus.message,
                        success: true,
                        error: null,
                      }),
                    })
                      .then((res) => {
                        console.log("[SHELL_OUTPUT] Backend response status:", res.status);
                        return res.json();
                      })
                      .then((data) => {
                        console.log("[SHELL_OUTPUT] Backend response data:", data);
                      })
                      .catch((err) => {
                        console.error("[SHELL_OUTPUT] Failed to submit server ready output:", err);
                      });
                  }

                  updateChatEntry(entryId, {
                    shellStatus: "server_running",
                    shellResult: {
                      success: true,
                      output: serverStatus.message,
                      session_name: sessionName,
                      command: command,
                      urls: serverStatus.urls,
                    },
                  });

                  if (onOutputCapture) {
                    onOutputCapture(capturedOutput);
                  }

                  fetch(`${API_BASE}/api/files/refresh`, { method: "POST" }).catch(console.error);

                  return;
                }
              }

              // Check for command completion (prompt patterns) for non-long-running commands
              const promptPatterns = [/\$\s*$/, />\s*$/, /#\s*$/, /\]\s*$/, /~\]\$/];

              const hasPrompt = promptPatterns.some((pattern) =>
                pattern.test(outputBufferRef.current)
              );

              if (hasPrompt && outputBufferRef.current.trim().length > 0) {
                if (outputSubmittedRef.current) return;
                outputSubmittedRef.current = true;

                setStatus("completed");

                const capturedOutput = outputBufferRef.current;

                if (commandId) {
                  fetch(`${API_BASE}/api/shell/output`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      command_id: commandId,
                      output: capturedOutput,
                      success: true,
                      error: null,
                    }),
                  }).catch((err) => {
                    console.error("[SHELL_OUTPUT] Failed to submit output:", err);
                  });
                }

                updateChatEntry(entryId, {
                  shellStatus: "completed",
                  shellResult: {
                    success: true,
                    output: capturedOutput,
                    session_name: sessionName,
                    command: command,
                  },
                });

                if (onOutputCapture) {
                  onOutputCapture(capturedOutput);
                }

                fetch(`${API_BASE}/api/files/refresh`, { method: "POST" }).catch(console.error);
              }
            }
          },
          timeoutMs: 0,
        });

        terminalPidRef.current = pty.pid;
        setIsTerminalReady(true);
        setStatus("running");

        // Allow user input
        xterm.onData(async (data) => {
          if (sandboxRef.current && terminalPidRef.current) {
            await sandboxRef.current.pty.sendInput(
              terminalPidRef.current,
              new TextEncoder().encode(data)
            );
          }
        });

        // Handle resize
        xterm.onResize(async ({ cols, rows }) => {
          if (sandboxRef.current && terminalPidRef.current) {
            try {
              await sandboxRef.current.pty.resize(terminalPidRef.current, { cols, rows });
            } catch (err) {
              console.error("[EmbeddedTerminal] Failed to resize PTY:", err);
            }
          }
        });

        // Execute the command after a brief delay
        setTimeout(async () => {
          if (sandboxRef.current && terminalPidRef.current && !commandExecutedRef.current) {
            commandExecutedRef.current = true;
            await sandboxRef.current.pty.sendInput(
              terminalPidRef.current,
              new TextEncoder().encode(command + "\n")
            );

            // For long-running commands, set up fallback detection timers
            if (isLongRunning) {
              console.log("[SERVER_DETECTION] Setting up fallback timers for long-running command");
              setTimeout(checkServerReadyFallback, 2000);
              setTimeout(checkServerReadyFallback, 5000);
              setTimeout(checkServerReadyFallback, 10000);
            }
          }
        }, 300);
      } catch (error) {
        console.error("Failed to initialize embedded terminal:", error, "Attempt:", attempt);

        const errorMessage = error instanceof Error ? error.message : "Failed to initialize terminal";

        if (attempt < MAX_RETRIES - 1) {
          console.log("[EmbeddedTerminal] Retrying terminal initialization...");
          setLoadingMessage(`Terminal initialization failed, retrying... (${attempt + 1}/${MAX_RETRIES})`);
          setRetryCount(attempt + 1);
          initializedRef.current = false;
          retryTimeoutRef.current = setTimeout(() => initTerminal(attempt + 1), RETRY_DELAY);
          return;
        }

        if (attempt >= MAX_RETRIES - 1) {
          console.log("[EmbeddedTerminal] Max retries reached, will keep trying...");
          setLoadingMessage("Having trouble connecting... Still trying...");
          initializedRef.current = false;
          retryTimeoutRef.current = setTimeout(() => initTerminal(0), RETRY_DELAY * 2);
          return;
        }

        setStatus("error");

        if (commandId && !outputSubmittedRef.current) {
          outputSubmittedRef.current = true;
          fetch(`${API_BASE}/api/shell/output`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              command_id: commandId,
              output: "",
              success: false,
              error: errorMessage,
            }),
          }).catch(console.error);
        }

        updateChatEntry(entryId, {
          shellStatus: "error",
          shellResult: {
            success: false,
            error: errorMessage,
            session_name: sessionName,
            command: command,
          },
        });
      }
    };

    initTerminal(0);

    return () => {
      // Cleanup
      if (addonsRef.current) {
        if (addonsRef.current.webgl) {
          addonsRef.current.webgl.dispose();
        }
        if (addonsRef.current.canvas) {
          addonsRef.current.canvas.dispose();
        }
      }
      if (xtermRef.current) {
        xtermRef.current.dispose();
      }
      if (sandboxRef.current && terminalPidRef.current) {
        sandboxRef.current.pty.kill(terminalPidRef.current).catch(console.error);
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      if (serverDetectionTimeoutRef.current) {
        clearTimeout(serverDetectionTimeoutRef.current);
      }
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
    isLongRunning,
    checkServerReadyFallback,
  ]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (addonsRef.current && xtermRef.current && sandboxRef.current && terminalPidRef.current) {
        addonsRef.current.fit.fit();
        sandboxRef.current.pty
          .resize(terminalPidRef.current, {
            cols: xtermRef.current.cols,
            rows: xtermRef.current.rows,
          })
          .catch(console.error);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Re-fit on expand/collapse
  useEffect(() => {
    if (addonsRef.current) {
      setTimeout(() => {
        addonsRef.current?.fit.fit();
      }, 100);
    }
  }, [isExpanded]);

  // Keyboard shortcuts
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
        {/* Header - preloaded */}
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

        {/* Command display - preloaded */}
        <div className="px-3 py-1.5 bg-[#161b22] border-b border-[#30363d] font-mono text-xs">
          <span className="text-cyan-400">user@e2b</span>
          <span className="text-gray-500">:</span>
          <span className="text-blue-400">~</span>
          <span className="text-gray-500">$ </span>
          <span className="text-gray-100">{command}</span>
        </div>

        {/* Loading content */}
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
      {/* Header */}
      <div
        data-design-id={`embedded-terminal-header-${entryId}`}
        className="flex items-center justify-between px-3 py-2 bg-[#161b22] border-b border-[#30363d]"
      >
        <div className="flex items-center gap-2">
          {status === "connecting" && <Loader2 className="w-4 h-4 text-yellow-400 animate-spin" />}
          {status === "running" && <Loader2 className="w-4 h-4 text-green-400 animate-spin" />}
          {status === "completed" && <Check className="w-4 h-4 text-green-400" />}
          {status === "server_running" && <Server className="w-4 h-4 text-cyan-400" />}
          {status === "error" && <RefreshCw className="w-4 h-4 text-yellow-400 animate-spin" />}
          <TerminalSquare className="w-4 h-4 text-green-400" />
          <span className="text-xs font-mono text-gray-400">{sessionName}</span>
          {status === "server_running" && serverUrls.length > 0 && (
            <div className="flex items-center gap-1 ml-2">
              {serverUrls.slice(0, 2).map((url, idx) => (
                <a
                  key={idx}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] px-1.5 py-0.5 bg-cyan-500/20 text-cyan-400 rounded hover:bg-cyan-500/30 transition-colors font-mono flex items-center gap-1"
                >
                  <ExternalLink size={10} />
                  {new URL(url).hostname.split(".")[0]}
                </a>
              ))}
              {serverUrls.length > 2 && (
                <span className="text-[10px] text-cyan-400">+{serverUrls.length - 2}</span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          {retryCount > 0 && status === "connecting" && (
            <span className="text-[10px] text-gray-500 mr-1">
              Retry {retryCount}/{MAX_RETRIES}
            </span>
          )}

          {/* Search toggle */}
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

          {/* Copy */}
          <button
            onClick={handleCopy}
            className="p-1 text-gray-400 hover:text-white rounded hover:bg-[#30363d] transition-colors"
            title="Copy Selection"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>

          {/* Export */}
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
                : status === "server_running"
                ? "bg-cyan-500/20 text-cyan-400"
                : "bg-yellow-500/20 text-yellow-400"
            }`}
          >
            {status === "connecting"
              ? "Connecting..."
              : status === "running"
              ? "Running..."
              : status === "completed"
              ? "Completed"
              : status === "server_running"
              ? "Server Running"
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

      {/* Search bar */}
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

      {/* Command display */}
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

      {/* Terminal */}
      <div
        ref={terminalRef}
        data-design-id={`embedded-terminal-content-${entryId}`}
        className="p-2"
        style={{
          minHeight: isExpanded ? "calc(100vh - 160px)" : "200px",
          maxHeight: isExpanded ? "calc(100vh - 160px)" : "400px",
        }}
      />

      {/* Status bar */}
      <div className="h-5 bg-[#161b22] border-t border-[#30363d] flex items-center justify-between px-3 text-[10px] text-gray-500">
        <span>WebGL Accelerated • Unicode 11 • Image Support</span>
        <span>
          {status === "completed" && `${outputBufferRef.current.split("\n").length} lines`}
          {status === "server_running" && "Live"}
        </span>
      </div>
    </div>
  );
}