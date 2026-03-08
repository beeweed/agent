import { useState, useEffect, useCallback, useRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { Sandbox } from "e2b";
import { useStore } from "@/store/useStore";
import "@xterm/xterm/css/xterm.css";
import {
  TerminalSquare,
  Plus,
  X,
  Loader2,
  RefreshCw,
  Maximize2,
  Minimize2,
} from "lucide-react";

interface TerminalInstance {
  id: string;
  name: string;
  xterm: XTerm | null;
  fitAddon: FitAddon | null;
  isReady: boolean;
}

interface TerminalHandle {
  pid: number;
}

const getApiBase = () => {
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    if (hostname.includes("e2b.app")) {
      return window.location.origin.replace(/\d+-/, "8080-");
    }
  }
  return "http://localhost:8080";
};

const API_BASE = getApiBase();

const MAX_RETRIES = 10;
const RETRY_DELAY = 2000;

export function TerminalPanel() {
  const { 
    e2bApiKey, 
    sandboxStatus, 
    pendingShellCommands,
    consumePendingShellCommand,
    terminalBuffers,
    setTerminalBuffer,
    appendTerminalBuffer,
  } = useStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [terminals, setTerminals] = useState<TerminalInstance[]>([]);
  const [activeTerminalId, setActiveTerminalId] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [autoSync, setAutoSync] = useState(true);
  const [terminalCounter, setTerminalCounter] = useState(1);
  const [sandboxId, setSandboxId] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [_connectionError, _setConnectionError] = useState<string | null>(null);
  const [isSandboxConnected, setIsSandboxConnected] = useState(false);
  const [connectRetryCount, setConnectRetryCount] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState("Initializing...");

  const sandboxRef = useRef<Sandbox | null>(null);
  const terminalsRef = useRef<
    Map<string, { pid: number; dataCallback: (data: Uint8Array) => void }>
  >(new Map());
  const xtermInstancesRef = useRef<
    Map<string, { xterm: XTerm; fitAddon: FitAddon }>
  >(new Map());
  const syncDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Check if fully connected
  const _isConnected = e2bApiKey && sandboxStatus === "ready" && isSandboxConnected;

  // Fetch sandbox ID from backend with retry
  useEffect(() => {
    let isMounted = true;
    const retryTimeoutRef = { current: null as NodeJS.Timeout | null };
    
    const fetchSandboxId = async (attempt: number = 0) => {
      if (!isMounted) return;
      
      setLoadingMessage(attempt > 0 
        ? `Connecting to sandbox... (attempt ${attempt + 1})`
        : "Connecting to sandbox...");
      
      try {
        const response = await fetch(`${API_BASE}/api/sandbox/status`);
        const data = await response.json();
        
        if (!isMounted) return;
        
        if (data.sandbox_id && data.is_running) {
          setSandboxId(data.sandbox_id);
          setConnectRetryCount(0);
        } else {
          setSandboxId(null);
          // Sandbox not ready, keep polling
          setConnectRetryCount(attempt + 1);
          setLoadingMessage("Waiting for sandbox to be ready...");
        }
      } catch (error) {
        console.error("Failed to fetch sandbox status:", error);
        if (isMounted) {
          setConnectRetryCount(attempt + 1);
          setLoadingMessage(`Connection failed, retrying...`);
        }
      }
    };

    if (e2bApiKey && sandboxStatus === "ready") {
      fetchSandboxId(0);
      // Poll for sandbox status continuously
      const interval = setInterval(() => fetchSandboxId(0), 3000);
      return () => {
        isMounted = false;
        clearInterval(interval);
        if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
      };
    }
  }, [e2bApiKey, sandboxStatus]);

  // Connect to sandbox when we have the sandbox ID with retry
  useEffect(() => {
    let isMounted = true;
    let retryTimeout: NodeJS.Timeout | null = null;
    
    const connectToSandbox = async (attempt: number = 0) => {
      if (!sandboxId || !e2bApiKey || sandboxRef.current) return;
      if (!isMounted) return;

      setIsConnecting(true);
      setConnectionError(null);
      setLoadingMessage(attempt > 0 
        ? `Connecting to sandbox... (attempt ${attempt + 1}/${MAX_RETRIES})`
        : "Connecting to sandbox...");

      try {
        const sandbox = await Sandbox.connect(sandboxId, {
          apiKey: e2bApiKey,
        });

        if (!isMounted) return;

        sandboxRef.current = sandbox;
        setIsSandboxConnected(true);
        setIsConnecting(false);
        setConnectRetryCount(0);
      } catch (error: unknown) {
        console.error("Failed to connect to sandbox:", error);
        
        if (!isMounted) return;
        
        if (attempt < MAX_RETRIES - 1) {
          // Retry
          setConnectRetryCount(attempt + 1);
          setLoadingMessage(`Connection failed, retrying... (${attempt + 1}/${MAX_RETRIES})`);
          retryTimeout = setTimeout(() => connectToSandbox(attempt + 1), RETRY_DELAY);
        } else {
          // Keep trying even after max retries
          setLoadingMessage("Having trouble connecting... Still trying...");
          retryTimeout = setTimeout(() => connectToSandbox(0), RETRY_DELAY * 2);
        }
      }
    };

    connectToSandbox(0);
    
    return () => {
      isMounted = false;
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, [sandboxId, e2bApiKey]);

  const triggerSync = useCallback(() => {
    if (!autoSync) return;

    if (syncDebounceRef.current) {
      clearTimeout(syncDebounceRef.current);
    }

    syncDebounceRef.current = setTimeout(() => {
      fetch(`${API_BASE}/api/files/refresh`, { method: "POST" }).catch(
        console.error
      );
    }, 1500);
  }, [autoSync]);

  const createTerminal = useCallback(
    async (
      terminalId: string,
      cols: number,
      rows: number,
      onData: (data: Uint8Array) => void
    ): Promise<TerminalHandle | null> => {
      if (!sandboxRef.current) {
        console.error("No sandbox connected");
        return null;
      }

      try {
        const terminal = await sandboxRef.current.pty.create({
          cols,
          rows,
          onData: (data: Uint8Array) => {
            const terminalInfo = terminalsRef.current.get(terminalId);
            if (terminalInfo?.dataCallback) {
              terminalInfo.dataCallback(data);
            }
          },
          timeout: 0,
        });

        terminalsRef.current.set(terminalId, {
          pid: terminal.pid,
          dataCallback: onData,
        });
        return terminal;
      } catch (error: unknown) {
        console.error("Failed to create terminal:", error);
        return null;
      }
    },
    []
  );

  const sendTerminalInput = useCallback(
    async (terminalId: string, data: string) => {
      const terminalInfo = terminalsRef.current.get(terminalId);
      if (!sandboxRef.current || !terminalInfo) {
        return;
      }

      try {
        await sandboxRef.current.pty.sendInput(
          terminalInfo.pid,
          new TextEncoder().encode(data)
        );
      } catch (error: unknown) {
        console.error("Failed to send terminal input:", error);
      }
    },
    []
  );

  const resizeTerminal = useCallback(
    async (terminalId: string, cols: number, rows: number) => {
      const terminalInfo = terminalsRef.current.get(terminalId);
      if (!sandboxRef.current || !terminalInfo) {
        return;
      }

      try {
        await sandboxRef.current.pty.resize(terminalInfo.pid, { cols, rows });
      } catch (error: unknown) {
        console.error("Failed to resize terminal:", error);
      }
    },
    []
  );

  const closeTerminal = useCallback(async (terminalId: string) => {
    const terminalInfo = terminalsRef.current.get(terminalId);
    if (!sandboxRef.current || !terminalInfo) {
      return;
    }

    try {
      await sandboxRef.current.pty.kill(terminalInfo.pid);
      terminalsRef.current.delete(terminalId);
    } catch (error: unknown) {
      console.error("Failed to close terminal:", error);
    }
  }, []);

  const createNewTerminal = useCallback(async () => {
    if (!sandboxRef.current) return;

    const terminalId = `terminal-${Date.now()}`;
    const terminalName = `Terminal ${terminalCounter}`;
    setTerminalCounter((prev) => prev + 1);

    const newTerminal: TerminalInstance = {
      id: terminalId,
      name: terminalName,
      xterm: null,
      fitAddon: null,
      isReady: false,
    };

    setTerminals((prev) => [...prev, newTerminal]);
    setActiveTerminalId(terminalId);
    setIsInitializing(terminalId);
  }, [terminalCounter]);

  const initializeTerminal = useCallback(
    async (terminalId: string) => {
      const terminalDiv = terminalRefs.current.get(terminalId);
      if (!terminalDiv || xtermInstancesRef.current.has(terminalId)) return;

      const xterm = new XTerm({
        cursorBlink: true,
        fontSize: 13,
        fontFamily:
          '"JetBrains Mono", "Fira Code", "Cascadia Code", Menlo, Monaco, "Courier New", monospace',
        theme: {
          background: "#1e1e1e",
          foreground: "#d4d4d4",
          cursor: "#d4d4d4",
          cursorAccent: "#1e1e1e",
          selectionBackground: "#264f78",
          black: "#000000",
          red: "#cd3131",
          green: "#0dbc79",
          yellow: "#e5e510",
          blue: "#2472c8",
          magenta: "#bc3fbc",
          cyan: "#11a8cd",
          white: "#e5e5e5",
          brightBlack: "#666666",
          brightRed: "#f14c4c",
          brightGreen: "#23d18b",
          brightYellow: "#f5f543",
          brightBlue: "#3b8eea",
          brightMagenta: "#d670d6",
          brightCyan: "#29b8db",
          brightWhite: "#e5e5e5",
        },
        allowProposedApi: true,
      });

      const fitAddon = new FitAddon();
      xterm.loadAddon(fitAddon);
      xterm.open(terminalDiv);

      xtermInstancesRef.current.set(terminalId, { xterm, fitAddon });

      setTimeout(() => {
        fitAddon.fit();
      }, 100);

      const cols = xterm.cols;
      const rows = xterm.rows;

      // Initialize terminal buffer in store
      const existingBuffer = terminalBuffers[terminalId];
      if (!existingBuffer) {
        setTerminalBuffer(terminalId, {
          id: terminalId,
          name: terminals.find(t => t.id === terminalId)?.name || terminalId,
          buffer: "",
        });
      } else {
        // Restore existing buffer content
        xterm.write(existingBuffer.buffer);
      }

      const terminal = await createTerminal(
        terminalId,
        cols,
        rows,
        (data: Uint8Array) => {
          xterm.write(data);

          // Store output in buffer for persistence
          const text = new TextDecoder().decode(data);
          appendTerminalBuffer(terminalId, text);

          const promptPatterns = [
            /\$\s*$/,
            />\s*$/,
            /#\s*$/,
            /\]\s*$/,
            /~\]\$/,
          ];

          const hasPrompt = promptPatterns.some((pattern) =>
            pattern.test(text)
          );

          if (hasPrompt) {
            triggerSync();
          }
        }
      );

      if (terminal) {
        xterm.onData((data) => {
          sendTerminalInput(terminalId, data);
        });

        setTerminals((prev) =>
          prev.map((t) =>
            t.id === terminalId ? { ...t, xterm, fitAddon, isReady: true } : t
          )
        );
      }

      setIsInitializing(null);
    },
    [createTerminal, sendTerminalInput, triggerSync, terminalBuffers, setTerminalBuffer, appendTerminalBuffer, terminals]
  );

  useEffect(() => {
    if (isSandboxConnected && terminals.length === 0) {
      createNewTerminal();
    }
  }, [isSandboxConnected, terminals.length, createNewTerminal]);

  useEffect(() => {
    if (isInitializing) {
      const timer = setTimeout(() => {
        initializeTerminal(isInitializing);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isInitializing, initializeTerminal]);

  useEffect(() => {
    const handleResize = () => {
      xtermInstancesRef.current.forEach(({ xterm, fitAddon }, terminalId) => {
        fitAddon.fit();
        resizeTerminal(terminalId, xterm.cols, xterm.rows);
      });
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [resizeTerminal]);

  useEffect(() => {
    if (activeTerminalId) {
      const instance = xtermInstancesRef.current.get(activeTerminalId);
      if (instance) {
        setTimeout(() => {
          instance.fitAddon.fit();
          instance.xterm.focus();
        }, 100);
      }
    }
  }, [activeTerminalId, isExpanded]);

  // Process pending shell commands from LLM
  useEffect(() => {
    const processPendingCommands = async () => {
      if (pendingShellCommands.length === 0) return;
      if (!sandboxRef.current) return;
      if (terminals.length === 0) return;

      // Get the first pending command
      const command = consumePendingShellCommand();
      if (!command) return;

      // Find or use the first terminal
      const targetTerminalId = activeTerminalId || terminals[0]?.id;
      if (!targetTerminalId) return;

      const terminalInfo = terminalsRef.current.get(targetTerminalId);
      if (!terminalInfo) return;

      console.log(`[SHELL] Executing command in terminal: ${command.command}`);

      try {
        // Send the command to the terminal
        await sandboxRef.current.pty.sendInput(
          terminalInfo.pid,
          new TextEncoder().encode(command.command + "\n")
        );
      } catch (error) {
        console.error("[SHELL] Failed to execute command:", error);
      }
    };

    processPendingCommands();
  }, [pendingShellCommands, activeTerminalId, terminals, consumePendingShellCommand]);

  const { clearTerminalBuffer } = useStore();
  
  const handleCloseTerminal = useCallback(
    async (terminalId: string, e: React.MouseEvent) => {
      e.stopPropagation();

      const instance = xtermInstancesRef.current.get(terminalId);
      if (instance) {
        instance.xterm.dispose();
        xtermInstancesRef.current.delete(terminalId);
      }

      await closeTerminal(terminalId);
      terminalRefs.current.delete(terminalId);
      
      // Clear the terminal buffer from storage
      clearTerminalBuffer(terminalId);

      setTerminals((prev) => {
        const newTerminals = prev.filter((t) => t.id !== terminalId);
        if (activeTerminalId === terminalId && newTerminals.length > 0) {
          setActiveTerminalId(newTerminals[newTerminals.length - 1].id);
        } else if (newTerminals.length === 0) {
          setActiveTerminalId(null);
        }
        return newTerminals;
      });
    },
    [activeTerminalId, closeTerminal, clearTerminalBuffer]
  );

  const handleManualSync = () => {
    fetch(`${API_BASE}/api/files/refresh`, { method: "POST" }).catch(
      console.error
    );
  };

  const setTerminalRef = useCallback(
    (terminalId: string, el: HTMLDivElement | null) => {
      if (el) {
        terminalRefs.current.set(terminalId, el);
      }
    },
    []
  );

  if (!e2bApiKey) {
    return (
      <div
        data-design-id="terminal-panel-no-key"
        className="h-full flex flex-col items-center justify-center text-muted-foreground bg-background p-4"
      >
        <TerminalSquare size={48} className="mb-4 opacity-20" />
        <p className="text-sm text-center">Configure E2B API key in Settings to access terminal</p>
      </div>
    );
  }

  if (sandboxStatus !== "ready") {
    return (
      <div
        data-design-id="terminal-panel-no-sandbox"
        className="h-full flex flex-col items-center justify-center text-muted-foreground bg-background p-4"
      >
        <TerminalSquare size={48} className="mb-4 opacity-20" />
        <p className="text-sm text-center">Send a message first to create the sandbox</p>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          The terminal will connect to the same sandbox used by the agent
        </p>
      </div>
    );
  }

  if (isConnecting || !isSandboxConnected) {
    return (
      <div
        data-design-id="terminal-panel-connecting"
        className="h-full flex flex-col items-center justify-center text-muted-foreground bg-[#1e1e1e] p-4"
      >
        <div className="relative mb-4">
          <div className="w-12 h-12 rounded-full border-2 border-[#333] border-t-green-400 animate-spin" />
          <TerminalSquare size={20} className="text-green-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        </div>
        <p className="text-sm text-gray-300">{loadingMessage}</p>
        {connectRetryCount > 0 && (
          <p className="text-xs text-gray-500 mt-1">
            Attempt {connectRetryCount + 1}
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
    );
  }

  return (
    <div
      ref={containerRef}
      data-design-id="terminal-panel"
      className={`flex flex-col bg-[#1e1e1e] ${isExpanded ? "fixed inset-0 z-50" : "h-full"}`}
    >
      <div
        data-design-id="terminal-tabs"
        className="h-8 bg-[#2d2d2d] border-b border-[#333] flex items-center justify-between px-1 flex-shrink-0"
      >
        <div className="flex items-center flex-1 overflow-x-auto no-scrollbar">
          {terminals.map((terminal) => (
            <div
              key={terminal.id}
              onClick={() => setActiveTerminalId(terminal.id)}
              className={`
                flex items-center px-3 py-1 text-xs cursor-pointer select-none min-w-[100px] max-w-[150px] group
                ${
                  terminal.id === activeTerminalId
                    ? "bg-[#1e1e1e] text-green-400 border-t border-l border-r border-[#333]"
                    : "text-gray-500 hover:text-gray-300 hover:bg-[#333]"
                }
              `}
            >
              <TerminalSquare size={12} className="mr-1.5 flex-shrink-0" />
              <span className="truncate flex-1">{terminal.name}</span>
              {isInitializing === terminal.id && (
                <Loader2 size={10} className="animate-spin ml-1 flex-shrink-0" />
              )}
              {terminals.length > 1 && (
                <button
                  onClick={(e) => handleCloseTerminal(terminal.id, e)}
                  className="ml-1 p-0.5 opacity-0 group-hover:opacity-100 hover:bg-[#555] rounded flex-shrink-0"
                >
                  <X size={10} />
                </button>
              )}
            </div>
          ))}

          <button
            onClick={createNewTerminal}
            className="flex items-center justify-center w-7 h-7 text-gray-500 hover:text-white hover:bg-[#444] rounded ml-1 flex-shrink-0"
            title="New Terminal"
          >
            <Plus size={14} />
          </button>
        </div>

        <div className="flex items-center space-x-1 ml-2 flex-shrink-0">
          <button
            onClick={() => setAutoSync(!autoSync)}
            className={`text-[10px] px-2 py-0.5 rounded ${autoSync ? "bg-green-600/20 text-green-400" : "bg-gray-600/20 text-gray-400"}`}
            title={autoSync ? "Auto-sync enabled" : "Auto-sync disabled"}
          >
            Auto-sync: {autoSync ? "ON" : "OFF"}
          </button>

          <button
            onClick={handleManualSync}
            className="text-gray-400 hover:text-white p-1"
            title="Sync files now"
          >
            <RefreshCw size={12} />
          </button>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-gray-400 hover:text-white p-1"
            title={isExpanded ? "Minimize" : "Maximize"}
          >
            {isExpanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden">
        {terminals.map((terminal) => (
          <div
            key={terminal.id}
            ref={(el) => setTerminalRef(terminal.id, el)}
            data-design-id={`terminal-instance-${terminal.id}`}
            className={`absolute inset-0 p-2 ${terminal.id === activeTerminalId ? "block" : "hidden"}`}
            style={{ minHeight: isExpanded ? "calc(100vh - 32px)" : "200px" }}
          />
        ))}

        {terminals.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-gray-500">
            <TerminalSquare size={32} className="mb-2 opacity-30" />
            <p className="text-sm">Click + to create a terminal</p>
          </div>
        )}
      </div>
    </div>
  );
}