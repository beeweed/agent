import { useState, useEffect, useRef, useCallback } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { Sandbox } from "e2b";
import { useStore } from "@/store/useStore";
import { isLongRunningCommand, detectServerStatus } from "@/lib/serverDetection";
import "@xterm/xterm/css/xterm.css";
import {
  TerminalSquare,
  Loader2,
  Check,
  AlertCircle,
  Maximize2,
  Minimize2,
  Server,
} from "lucide-react";

interface EmbeddedTerminalProps {
  command: string;
  sessionName?: string;
  entryId: string;
  commandId?: string;  // Used to POST output back to backend for LLM
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

export function EmbeddedTerminal({ command, sessionName = "main", entryId, commandId, onOutputCapture }: EmbeddedTerminalProps) {
  console.log("[EmbeddedTerminal] Mounted with command:", command, "commandId:", commandId, "isLongRunning:", isLongRunningCommand(command));
  const { e2bApiKey, sandboxStatus, updateChatEntry } = useStore();
  const outputSubmittedRef = useRef(false);  // Prevent double submission
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [status, setStatus] = useState<"connecting" | "running" | "completed" | "error" | "server_running">("connecting");
  const [sandboxId, setSandboxId] = useState<string | null>(null);
  const [_isTerminalReady, setIsTerminalReady] = useState(false);
  const [_capturedOutput, setCapturedOutput] = useState("");
  const [serverUrls, setServerUrls] = useState<string[]>([]);
  const isLongRunning = isLongRunningCommand(command);
  
  const sandboxRef = useRef<Sandbox | null>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const terminalPidRef = useRef<number | null>(null);
  const outputBufferRef = useRef<string>("");
  const commandExecutedRef = useRef(false);
  const initializedRef = useRef(false);
  const serverDetectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Fallback timeout function to check for server ready state
  const checkServerReadyFallback = useCallback(() => {
    if (outputSubmittedRef.current || !isLongRunning) return;
    
    const serverStatus = detectServerStatus(command, outputBufferRef.current);
    console.log("[SERVER_DETECTION_FALLBACK] Checking with accumulated output...", {
      outputLength: outputBufferRef.current.length,
      isReady: serverStatus.isReady,
      urls: serverStatus.urls
    });
    
    if (serverStatus.isReady && !outputSubmittedRef.current) {
      console.log("[SERVER_DETECTION_FALLBACK] Server detected! Submitting...");
      outputSubmittedRef.current = true;
      setStatus("server_running");
      setServerUrls(serverStatus.urls);
      
      if (commandId) {
        console.log("[SHELL_OUTPUT_FALLBACK] POSTing to backend:", {
          command_id: commandId,
          output: serverStatus.message,
          api_base: API_BASE
        });
        fetch(`${API_BASE}/api/shell/output`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            command_id: commandId,
            output: serverStatus.message,
            success: true,
            error: null
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

  // Fetch sandbox ID from backend
  useEffect(() => {
    const fetchSandboxId = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/sandbox/status`);
        const data = await response.json();
        if (data.sandbox_id && data.is_running) {
          setSandboxId(data.sandbox_id);
        }
      } catch (error) {
        console.error("Failed to fetch sandbox status:", error);
        setStatus("error");
      }
    };

    if (e2bApiKey && sandboxStatus === "ready") {
      fetchSandboxId();
    }
  }, [e2bApiKey, sandboxStatus]);

  // Connect to sandbox and initialize terminal
  useEffect(() => {
    if (!sandboxId || !e2bApiKey || initializedRef.current) return;
    initializedRef.current = true;

    const initTerminal = async () => {
      try {
        // Connect to sandbox
        const sandbox = await Sandbox.connect(sandboxId, {
          apiKey: e2bApiKey,
        });
        sandboxRef.current = sandbox;

        // Wait for container to be ready
        if (!terminalRef.current) {
          setStatus("error");
          return;
        }

        // Create xterm instance
        const xterm = new XTerm({
          cursorBlink: true,
          fontSize: 12,
          fontFamily: '"JetBrains Mono", "Fira Code", Menlo, Monaco, monospace',
          theme: {
            background: "#0d1117",
            foreground: "#c9d1d9",
            cursor: "#c9d1d9",
            cursorAccent: "#0d1117",
            selectionBackground: "#264f78",
            black: "#484f58",
            red: "#ff7b72",
            green: "#3fb950",
            yellow: "#d29922",
            blue: "#58a6ff",
            magenta: "#bc8cff",
            cyan: "#39c5cf",
            white: "#b1bac4",
            brightBlack: "#6e7681",
            brightRed: "#ffa198",
            brightGreen: "#56d364",
            brightYellow: "#e3b341",
            brightBlue: "#79c0ff",
            brightMagenta: "#d2a8ff",
            brightCyan: "#56d4dd",
            brightWhite: "#f0f6fc",
          },
          allowProposedApi: true,
          scrollback: 1000,
          rows: 12,
        });

        const fitAddon = new FitAddon();
        xterm.loadAddon(fitAddon);
        xterm.open(terminalRef.current);

        xtermRef.current = xterm;
        fitAddonRef.current = fitAddon;

        setTimeout(() => {
          fitAddon.fit();
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
                
                // Debug logging for server detection
                console.log("[SERVER_DETECTION] Checking output for server ready state...");
                console.log("[SERVER_DETECTION] isReady:", serverStatus.isReady, "urls:", serverStatus.urls);
                
                if (serverStatus.isReady && !outputSubmittedRef.current) {
                  console.log("[SERVER_DETECTION] Server detected as ready! Submitting output...");
                  // Server is ready - submit output and stop loading
                  outputSubmittedRef.current = true;
                  
                  setStatus("server_running");
                  setServerUrls(serverStatus.urls);
                  
                  const capturedOutput = outputBufferRef.current;
                  
                  // CRITICAL: POST output back to backend for LLM with server ready message
                  if (commandId) {
                    console.log("[SHELL_OUTPUT] POSTing server ready output to backend:", {
                      command_id: commandId,
                      output: serverStatus.message,
                      api_base: API_BASE
                    });
                    fetch(`${API_BASE}/api/shell/output`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        command_id: commandId,
                        output: serverStatus.message,
                        success: true,
                        error: null
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
                  
                  // Update the chat entry with server running status
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
                  
                  // Call the output capture callback
                  if (onOutputCapture) {
                    onOutputCapture(capturedOutput);
                  }
                  
                  // Refresh file tree after server starts
                  fetch(`${API_BASE}/api/files/refresh`, { method: "POST" }).catch(console.error);
                  
                  return; // Don't check for prompt patterns
                }
              }
              
              // Check for command completion (prompt patterns) for non-long-running commands
              const promptPatterns = [
                /\$\s*$/,
                />\s*$/,
                /#\s*$/,
                /\]\s*$/,
                /~\]\$/,
              ];
              
              const hasPrompt = promptPatterns.some((pattern) =>
                pattern.test(outputBufferRef.current)
              );
              
              if (hasPrompt && outputBufferRef.current.trim().length > 0) {
                // Command completed - but only submit once
                if (outputSubmittedRef.current) return;
                outputSubmittedRef.current = true;
                
                setStatus("completed");
                
                const capturedOutput = outputBufferRef.current;
                
                // CRITICAL: POST output back to backend for LLM
                // This is the single source of truth for command execution
                if (commandId) {
                  fetch(`${API_BASE}/api/shell/output`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      command_id: commandId,
                      output: capturedOutput,
                      success: true,
                      error: null
                    }),
                  }).catch((err) => {
                    console.error("[SHELL_OUTPUT] Failed to submit output:", err);
                  });
                }
                
                // Update the chat entry with the captured output
                updateChatEntry(entryId, {
                  shellStatus: "completed",
                  shellResult: {
                    success: true,
                    output: capturedOutput,
                    session_name: sessionName,
                    command: command,
                  },
                });
                
                // Call the output capture callback
                if (onOutputCapture) {
                  onOutputCapture(capturedOutput);
                }
                
                // Refresh file tree after command
                fetch(`${API_BASE}/api/files/refresh`, { method: "POST" }).catch(console.error);
              }
            }
          },
          timeout: 0,
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

        // Execute the command after a brief delay
        setTimeout(async () => {
          if (sandboxRef.current && terminalPidRef.current && !commandExecutedRef.current) {
            commandExecutedRef.current = true;
            await sandboxRef.current.pty.sendInput(
              terminalPidRef.current,
              new TextEncoder().encode(command + "\n")
            );
            
            // For long-running commands, set up fallback detection timers
            // These will periodically check if the server is ready in case the
            // real-time detection in onData didn't catch it
            if (isLongRunning) {
              console.log("[SERVER_DETECTION] Setting up fallback timers for long-running command");
              // Check after 2 seconds
              setTimeout(checkServerReadyFallback, 2000);
              // Check after 5 seconds
              setTimeout(checkServerReadyFallback, 5000);
              // Check after 10 seconds
              setTimeout(checkServerReadyFallback, 10000);
            }
          }
        }, 300);

      } catch (error) {
        console.error("Failed to initialize embedded terminal:", error);
        setStatus("error");
        
        const errorMessage = error instanceof Error ? error.message : "Failed to initialize terminal";
        
        // POST error back to backend so LLM knows the command failed
        if (commandId && !outputSubmittedRef.current) {
          outputSubmittedRef.current = true;
          fetch(`${API_BASE}/api/shell/output`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              command_id: commandId,
              output: "",
              success: false,
              error: errorMessage
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

    initTerminal();

    return () => {
      // Cleanup
      if (xtermRef.current) {
        xtermRef.current.dispose();
      }
      if (sandboxRef.current && terminalPidRef.current) {
        sandboxRef.current.pty.kill(terminalPidRef.current).catch(console.error);
      }
    };
  }, [sandboxId, e2bApiKey, command, sessionName, entryId, commandId, updateChatEntry, onOutputCapture, isLongRunning, checkServerReadyFallback]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (fitAddonRef.current && xtermRef.current && sandboxRef.current && terminalPidRef.current) {
        fitAddonRef.current.fit();
        sandboxRef.current.pty.resize(terminalPidRef.current, {
          cols: xtermRef.current.cols,
          rows: xtermRef.current.rows,
        }).catch(console.error);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Re-fit on expand/collapse
  useEffect(() => {
    if (fitAddonRef.current) {
      setTimeout(() => {
        fitAddonRef.current?.fit();
      }, 100);
    }
  }, [isExpanded]);

  if (!e2bApiKey) {
    return (
      <div data-design-id={`embedded-terminal-no-key-${entryId}`} className="rounded-lg bg-[#0d1117] border border-[#30363d] p-4 text-center">
        <TerminalSquare className="w-8 h-8 text-gray-500 mx-auto mb-2" />
        <p className="text-xs text-gray-500">E2B API key required</p>
      </div>
    );
  }

  if (sandboxStatus !== "ready") {
    return (
      <div data-design-id={`embedded-terminal-no-sandbox-${entryId}`} className="rounded-lg bg-[#0d1117] border border-[#30363d] p-4 text-center">
        <Loader2 className="w-8 h-8 text-gray-500 mx-auto mb-2 animate-spin" />
        <p className="text-xs text-gray-500">Waiting for sandbox...</p>
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
      <div data-design-id={`embedded-terminal-header-${entryId}`} className="flex items-center justify-between px-3 py-2 bg-[#161b22] border-b border-[#30363d]">
        <div className="flex items-center gap-2">
          {status === "connecting" && (
            <Loader2 className="w-4 h-4 text-yellow-400 animate-spin" />
          )}
          {status === "running" && (
            <Loader2 className="w-4 h-4 text-green-400 animate-spin" />
          )}
          {status === "completed" && (
            <Check className="w-4 h-4 text-green-400" />
          )}
          {status === "server_running" && (
            <Server className="w-4 h-4 text-cyan-400" />
          )}
          {status === "error" && (
            <AlertCircle className="w-4 h-4 text-red-400" />
          )}
          <TerminalSquare className="w-4 h-4 text-green-400" />
          <span className="text-xs font-mono text-gray-400">{sessionName}</span>
          {status === "server_running" && serverUrls.length > 0 && (
            <div className="flex items-center gap-1 ml-2">
              {serverUrls.map((url, idx) => (
                <a
                  key={idx}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] px-1.5 py-0.5 bg-cyan-500/20 text-cyan-400 rounded hover:bg-cyan-500/30 transition-colors font-mono"
                >
                  {url}
                </a>
              ))}
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <span className={`text-[10px] px-2 py-0.5 rounded ${
            status === "connecting" ? "bg-yellow-500/20 text-yellow-400" :
            status === "running" ? "bg-green-500/20 text-green-400 animate-pulse" :
            status === "completed" ? "bg-green-500/20 text-green-400" :
            status === "server_running" ? "bg-cyan-500/20 text-cyan-400" :
            "bg-red-500/20 text-red-400"
          }`}>
            {status === "connecting" ? "Connecting..." :
             status === "running" ? "Running..." :
             status === "completed" ? "Completed" :
             status === "server_running" ? "Server Running" :
             "Error"}
          </span>
          
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 text-gray-400 hover:text-white rounded hover:bg-[#30363d] transition-colors"
          >
            {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
      
      {/* Command display */}
      <div data-design-id={`embedded-terminal-command-${entryId}`} className="px-3 py-1.5 bg-[#161b22] border-b border-[#30363d] font-mono text-xs">
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
          minHeight: isExpanded ? "calc(100vh - 120px)" : "200px",
          maxHeight: isExpanded ? "calc(100vh - 120px)" : "400px",
        }}
      />
    </div>
  );
}