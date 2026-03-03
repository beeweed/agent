import { useState, useEffect, useRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { Sandbox } from "e2b";
import { useStore } from "@/store/useStore";
import "@xterm/xterm/css/xterm.css";
import {
  TerminalSquare,
  Loader2,
  Check,
  AlertCircle,
  Maximize2,
  Minimize2,
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
  const { e2bApiKey, sandboxStatus, updateChatEntry } = useStore();
  const outputSubmittedRef = useRef(false);  // Prevent double submission
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [status, setStatus] = useState<"connecting" | "running" | "completed" | "error">("connecting");
  const [sandboxId, setSandboxId] = useState<string | null>(null);
  const [_isTerminalReady, setIsTerminalReady] = useState(false);
  const [_capturedOutput, setCapturedOutput] = useState("");
  
  const sandboxRef = useRef<Sandbox | null>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const terminalPidRef = useRef<number | null>(null);
  const outputBufferRef = useRef<string>("");
  const commandExecutedRef = useRef(false);
  const initializedRef = useRef(false);

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
            
            // Check for command completion (prompt patterns)
            const promptPatterns = [
              /\$\s*$/,
              />\s*$/,
              /#\s*$/,
              /\]\s*$/,
              /~\]\$/,
            ];
            
            // Only check for completion after command was executed
            if (commandExecutedRef.current) {
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
  }, [sandboxId, e2bApiKey, command, sessionName, entryId, commandId, updateChatEntry, onOutputCapture]);

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
          {status === "error" && (
            <AlertCircle className="w-4 h-4 text-red-400" />
          )}
          <TerminalSquare className="w-4 h-4 text-green-400" />
          <span className="text-xs font-mono text-gray-400">{sessionName}</span>
        </div>
        
        <div className="flex items-center gap-2">
          <span className={`text-[10px] px-2 py-0.5 rounded ${
            status === "connecting" ? "bg-yellow-500/20 text-yellow-400" :
            status === "running" ? "bg-green-500/20 text-green-400 animate-pulse" :
            status === "completed" ? "bg-green-500/20 text-green-400" :
            "bg-red-500/20 text-red-400"
          }`}>
            {status === "connecting" ? "Connecting..." :
             status === "running" ? "Running..." :
             status === "completed" ? "Completed" :
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