import { useState, useEffect, useCallback, useRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { Sandbox } from "e2b";
import { useStore } from "@/store/useStore";
import { terminalSessionManager } from "@/lib/terminalSessionManager";
import {
  createEnhancedTerminal,
  loadWebGLRenderer,
  terminalThemes,
  themeNames,
  terminalFonts,
  searchInTerminal,
  searchPrevious,
  clearSearch,
  serializeTerminalAsHTML,
  ANSI,
} from "@/lib/terminal";
import type { TerminalAddons } from "@/lib/terminal";
import "@xterm/xterm/css/xterm.css";
import {
  TerminalSquare,
  Plus,
  X,
  Loader2,
  RefreshCw,
  Maximize2,
  Minimize2,
  Search,
  ChevronUp,
  ChevronDown,
  Settings2,
  Download,
  Copy,
  Trash2,
  Palette,
  Type,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ArrowUpToLine,
  ArrowDownToLine,
  Regex,
  CaseSensitive,
  WholeWord,
} from "lucide-react";

interface TerminalInstance {
  id: string;
  name: string;
  xterm: XTerm | null;
  addons: TerminalAddons | null;
  isReady: boolean;
  theme: keyof typeof terminalThemes;
  fontSize: number;
}

interface TerminalHandle {
  pid: number;
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
    clearTerminalBuffer,
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
  const [isSandboxConnected, setIsSandboxConnected] = useState(false);
  const [connectRetryCount, setConnectRetryCount] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState("Initializing...");

  // Search state
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOptions, setSearchOptions] = useState({
    regex: false,
    caseSensitive: false,
    wholeWord: false,
  });
  const [searchResultCount, setSearchResultCount] = useState<number | null>(null);

  // Settings state
  const [showSettings, setShowSettings] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<keyof typeof terminalThemes>("github");
  const [currentFont, setCurrentFont] = useState(terminalFonts[0]);
  const [currentFontSize, setCurrentFontSize] = useState(14);

  const sandboxRef = useRef<Sandbox | null>(null);
  const terminalsRef = useRef<Map<string, { pid: number; dataCallback: (data: Uint8Array) => void }>>(new Map());
  const xtermInstancesRef = useRef<Map<string, { xterm: XTerm; addons: TerminalAddons }>>(new Map());
  const syncDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Fetch sandbox ID from backend with retry
  useEffect(() => {
    let isMounted = true;
    const retryTimeoutRef = { current: null as NodeJS.Timeout | null };

    const fetchSandboxId = async (attempt: number = 0) => {
      if (!isMounted) return;

      setLoadingMessage(
        attempt > 0
          ? `Connecting to sandbox... (attempt ${attempt + 1})`
          : "Connecting to sandbox..."
      );

      try {
        const response = await fetch(`${API_BASE}/api/sandbox/status`);
        const data = await response.json();

        if (!isMounted) return;

        if (data.sandbox_id && data.is_running) {
          setSandboxId(data.sandbox_id);
          setConnectRetryCount(0);
        } else {
          setSandboxId(null);
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
      const interval = setInterval(() => fetchSandboxId(0), 3000);
      return () => {
        isMounted = false;
        clearInterval(interval);
        if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
      };
    }
  }, [e2bApiKey, sandboxStatus]);

  // Connect to sandbox when we have the sandbox ID with retry
  // Uses the shared session manager to avoid duplicate connections
  useEffect(() => {
    let isMounted = true;
    let retryTimeout: NodeJS.Timeout | null = null;

    const connectToSandbox = async (attempt: number = 0) => {
      if (!sandboxId || !e2bApiKey || sandboxRef.current) return;
      if (!isMounted) return;

      setIsConnecting(true);
      setLoadingMessage(
        attempt > 0
          ? `Connecting to sandbox... (attempt ${attempt + 1}/${MAX_RETRIES})`
          : "Connecting to sandbox..."
      );

      try {
        // Use the shared session manager for sandbox connection
        const sandbox = await terminalSessionManager.connectSandbox(sandboxId, e2bApiKey);

        if (!isMounted) return;

        if (sandbox) {
          sandboxRef.current = sandbox;
          setIsSandboxConnected(true);
          setIsConnecting(false);
          setConnectRetryCount(0);
        } else {
          throw new Error("Failed to connect to sandbox");
        }
      } catch (error: unknown) {
        console.error("Failed to connect to sandbox:", error);

        if (!isMounted) return;

        if (attempt < MAX_RETRIES - 1) {
          setConnectRetryCount(attempt + 1);
          setLoadingMessage(`Connection failed, retrying... (${attempt + 1}/${MAX_RETRIES})`);
          retryTimeout = setTimeout(() => connectToSandbox(attempt + 1), RETRY_DELAY);
        } else {
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
      fetch(`${API_BASE}/api/files/refresh`, { method: "POST" }).catch(console.error);
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
          timeoutMs: 0,
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

  const sendTerminalInput = useCallback(async (terminalId: string, data: string) => {
    const terminalInfo = terminalsRef.current.get(terminalId);
    if (!sandboxRef.current || !terminalInfo) {
      return;
    }

    try {
      await sandboxRef.current.pty.sendInput(terminalInfo.pid, new TextEncoder().encode(data));
    } catch (error: unknown) {
      console.error("Failed to send terminal input:", error);
    }
  }, []);

  const resizeTerminal = useCallback(async (terminalId: string, cols: number, rows: number) => {
    const terminalInfo = terminalsRef.current.get(terminalId);
    if (!sandboxRef.current || !terminalInfo) {
      return;
    }

    try {
      await sandboxRef.current.pty.resize(terminalInfo.pid, { cols, rows });
    } catch (error: unknown) {
      console.error("Failed to resize terminal:", error);
    }
  }, []);

  const closeTerminalPty = useCallback(async (terminalId: string) => {
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
      addons: null,
      isReady: false,
      theme: currentTheme,
      fontSize: currentFontSize,
    };

    setTerminals((prev) => [...prev, newTerminal]);
    setActiveTerminalId(terminalId);
    setIsInitializing(terminalId);
  }, [terminalCounter, currentTheme, currentFontSize]);

  const initializeTerminal = useCallback(
    async (terminalId: string) => {
      const terminalDiv = terminalRefs.current.get(terminalId);
      if (!terminalDiv || xtermInstancesRef.current.has(terminalId)) return;

      // Create enhanced terminal with all addons
      const { terminal: xterm, addons } = createEnhancedTerminal(
        {
          fontSize: currentFontSize,
          fontFamily: currentFont,
        },
        currentTheme
      );

      // Open terminal in DOM
      xterm.open(terminalDiv);

      // Load WebGL renderer for better performance
      loadWebGLRenderer(xterm, addons);

      // Store references
      xtermInstancesRef.current.set(terminalId, { xterm, addons });

      // Fit terminal to container
      setTimeout(() => {
        addons.fit.fit();
      }, 100);

      const cols = xterm.cols;
      const rows = xterm.rows;

      // Initialize terminal buffer in store
      const existingBuffer = terminalBuffers[terminalId];
      if (!existingBuffer) {
        setTerminalBuffer(terminalId, {
          id: terminalId,
          name: terminals.find((t) => t.id === terminalId)?.name || terminalId,
          buffer: "",
        });
      } else {
        // Restore existing buffer content
        xterm.write(existingBuffer.buffer);
      }

      // Create PTY in sandbox
      const terminal = await createTerminal(terminalId, cols, rows, (data: Uint8Array) => {
        xterm.write(data);

        // Store output in buffer for persistence
        const text = new TextDecoder().decode(data);
        appendTerminalBuffer(terminalId, text);

        // Check for prompt patterns to trigger file sync
        const promptPatterns = [/\$\s*$/, />\s*$/, /#\s*$/, /\]\s*$/, /~\]\$/];
        const hasPrompt = promptPatterns.some((pattern) => pattern.test(text));

        if (hasPrompt) {
          triggerSync();
        }
      });

      if (terminal) {
        // Handle user input
        xterm.onData((data) => {
          sendTerminalInput(terminalId, data);
        });

        // Handle resize
        xterm.onResize(({ cols, rows }) => {
          resizeTerminal(terminalId, cols, rows);
        });

        // Write welcome message
        xterm.write(
          `${ANSI.cyan}╔════════════════════════════════════════════════════════════╗${ANSI.reset}\r\n`
        );
        xterm.write(
          `${ANSI.cyan}║${ANSI.reset}  ${ANSI.bold}${ANSI.green}Enhanced Terminal${ANSI.reset} - WebGL Accelerated                      ${ANSI.cyan}║${ANSI.reset}\r\n`
        );
        xterm.write(
          `${ANSI.cyan}║${ANSI.reset}  Features: Images, Unicode, Search, Themes, Web Links       ${ANSI.cyan}║${ANSI.reset}\r\n`
        );
        xterm.write(
          `${ANSI.cyan}╚════════════════════════════════════════════════════════════╝${ANSI.reset}\r\n\r\n`
        );

        setTerminals((prev) =>
          prev.map((t) =>
            t.id === terminalId ? { ...t, xterm, addons, isReady: true } : t
          )
        );
      }

      setIsInitializing(null);
    },
    [
      createTerminal,
      sendTerminalInput,
      resizeTerminal,
      triggerSync,
      terminalBuffers,
      setTerminalBuffer,
      appendTerminalBuffer,
      terminals,
      currentTheme,
      currentFont,
      currentFontSize,
    ]
  );

  // Auto-create first terminal when connected
  useEffect(() => {
    if (isSandboxConnected && terminals.length === 0) {
      createNewTerminal();
    }
  }, [isSandboxConnected, terminals.length, createNewTerminal]);

  // Initialize terminal when marked for initialization
  useEffect(() => {
    if (isInitializing) {
      const timer = setTimeout(() => {
        initializeTerminal(isInitializing);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isInitializing, initializeTerminal]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      xtermInstancesRef.current.forEach(({ xterm, addons }, terminalId) => {
        addons.fit.fit();
        resizeTerminal(terminalId, xterm.cols, xterm.rows);
      });
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [resizeTerminal]);

  // Focus and fit active terminal
  useEffect(() => {
    if (activeTerminalId) {
      const instance = xtermInstancesRef.current.get(activeTerminalId);
      if (instance) {
        setTimeout(() => {
          instance.addons.fit.fit();
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

      const command = consumePendingShellCommand();
      if (!command) return;

      const targetTerminalId = activeTerminalId || terminals[0]?.id;
      if (!targetTerminalId) return;

      const terminalInfo = terminalsRef.current.get(targetTerminalId);
      if (!terminalInfo) return;

      console.log(`[SHELL] Executing command in terminal: ${command.command}`);

      try {
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

  // Search handlers
  const handleSearch = useCallback(() => {
    if (!activeTerminalId || !searchQuery) return;
    const instance = xtermInstancesRef.current.get(activeTerminalId);
    if (!instance) return;

    const found = searchInTerminal(instance.addons.search, searchQuery, searchOptions);
    setSearchResultCount(found ? 1 : 0);
  }, [activeTerminalId, searchQuery, searchOptions]);

  const handleSearchNext = useCallback(() => {
    if (!activeTerminalId || !searchQuery) return;
    const instance = xtermInstancesRef.current.get(activeTerminalId);
    if (!instance) return;

    searchInTerminal(instance.addons.search, searchQuery, searchOptions);
  }, [activeTerminalId, searchQuery, searchOptions]);

  const handleSearchPrev = useCallback(() => {
    if (!activeTerminalId || !searchQuery) return;
    const instance = xtermInstancesRef.current.get(activeTerminalId);
    if (!instance) return;

    searchPrevious(instance.addons.search, searchQuery, searchOptions);
  }, [activeTerminalId, searchQuery, searchOptions]);

  const handleClearSearch = useCallback(() => {
    if (!activeTerminalId) return;
    const instance = xtermInstancesRef.current.get(activeTerminalId);
    if (!instance) return;

    clearSearch(instance.addons.search);
    setSearchQuery("");
    setSearchResultCount(null);
  }, [activeTerminalId]);

  // Theme change handler
  const handleThemeChange = useCallback((theme: keyof typeof terminalThemes) => {
    setCurrentTheme(theme);
    xtermInstancesRef.current.forEach(({ xterm }) => {
      xterm.options.theme = terminalThemes[theme];
    });
  }, []);

  // Font change handler
  const handleFontChange = useCallback((font: string) => {
    setCurrentFont(font);
    xtermInstancesRef.current.forEach(({ xterm }) => {
      xterm.options.fontFamily = font;
    });
  }, []);

  // Font size handlers
  const handleFontSizeChange = useCallback((delta: number) => {
    setCurrentFontSize((prev) => {
      const newSize = Math.max(8, Math.min(32, prev + delta));
      xtermInstancesRef.current.forEach(({ xterm, addons }) => {
        xterm.options.fontSize = newSize;
        setTimeout(() => addons.fit.fit(), 50);
      });
      return newSize;
    });
  }, []);

  const handleResetFontSize = useCallback(() => {
    setCurrentFontSize(14);
    xtermInstancesRef.current.forEach(({ xterm, addons }) => {
      xterm.options.fontSize = 14;
      setTimeout(() => addons.fit.fit(), 50);
    });
  }, []);

  // Copy terminal content
  const handleCopySelection = useCallback(() => {
    if (!activeTerminalId) return;
    const instance = xtermInstancesRef.current.get(activeTerminalId);
    if (!instance) return;

    const selection = instance.xterm.getSelection();
    if (selection) {
      navigator.clipboard.writeText(selection);
    }
  }, [activeTerminalId]);

  // Export terminal as HTML
  const handleExportHTML = useCallback(() => {
    if (!activeTerminalId) return;
    const instance = xtermInstancesRef.current.get(activeTerminalId);
    if (!instance) return;

    const html = serializeTerminalAsHTML(instance.addons.serialize);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `terminal-${activeTerminalId}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }, [activeTerminalId]);

  // Clear terminal
  const handleClearTerminal = useCallback(() => {
    if (!activeTerminalId) return;
    const instance = xtermInstancesRef.current.get(activeTerminalId);
    if (!instance) return;

    instance.xterm.clear();
  }, [activeTerminalId]);

  // Scroll handlers
  const handleScrollToTop = useCallback(() => {
    if (!activeTerminalId) return;
    const instance = xtermInstancesRef.current.get(activeTerminalId);
    if (!instance) return;

    instance.xterm.scrollToTop();
  }, [activeTerminalId]);

  const handleScrollToBottom = useCallback(() => {
    if (!activeTerminalId) return;
    const instance = xtermInstancesRef.current.get(activeTerminalId);
    if (!instance) return;

    instance.xterm.scrollToBottom();
  }, [activeTerminalId]);

  // Close terminal handler
  const handleCloseTerminal = useCallback(
    async (terminalId: string, e: React.MouseEvent) => {
      e.stopPropagation();

      const instance = xtermInstancesRef.current.get(terminalId);
      if (instance) {
        // Dispose WebGL renderer first
        if (instance.addons.webgl) {
          instance.addons.webgl.dispose();
        }
        if (instance.addons.canvas) {
          instance.addons.canvas.dispose();
        }
        instance.xterm.dispose();
        xtermInstancesRef.current.delete(terminalId);
      }

      await closeTerminalPty(terminalId);
      terminalRefs.current.delete(terminalId);
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
    [activeTerminalId, closeTerminalPty, clearTerminalBuffer]
  );

  const handleManualSync = () => {
    fetch(`${API_BASE}/api/files/refresh`, { method: "POST" }).catch(console.error);
  };

  const setTerminalRef = useCallback((terminalId: string, el: HTMLDivElement | null) => {
    if (el) {
      terminalRefs.current.set(terminalId, el);
    }
  }, []);

  // Toggle search with keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "f") {
        e.preventDefault();
        setShowSearch((prev) => !prev);
        setTimeout(() => searchInputRef.current?.focus(), 100);
      }
      if (e.key === "Escape" && showSearch) {
        setShowSearch(false);
        handleClearSearch();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showSearch, handleClearSearch]);

  // Render states
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
          <TerminalSquare
            size={20}
            className="text-green-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
          />
        </div>
        <p className="text-sm text-gray-300">{loadingMessage}</p>
        {connectRetryCount > 0 && (
          <p className="text-xs text-gray-500 mt-1">Attempt {connectRetryCount + 1}</p>
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
      {/* Tab Bar */}
      <div
        data-design-id="terminal-tabs"
        className="h-9 bg-[#252526] border-b border-[#3c3c3c] flex items-center justify-between px-1 flex-shrink-0"
      >
        <div className="flex items-center flex-1 overflow-x-auto no-scrollbar">
          {terminals.map((terminal) => (
            <div
              key={terminal.id}
              onClick={() => setActiveTerminalId(terminal.id)}
              className={`
                flex items-center px-3 py-1.5 text-xs cursor-pointer select-none min-w-[100px] max-w-[150px] group transition-colors
                ${
                  terminal.id === activeTerminalId
                    ? "bg-[#1e1e1e] text-green-400 border-t-2 border-t-green-400"
                    : "text-gray-400 hover:text-gray-200 hover:bg-[#2d2d2d]"
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
                  className="ml-1 p-0.5 opacity-0 group-hover:opacity-100 hover:bg-[#555] rounded flex-shrink-0 transition-opacity"
                >
                  <X size={10} />
                </button>
              )}
            </div>
          ))}

          <button
            onClick={createNewTerminal}
            className="flex items-center justify-center w-7 h-7 text-gray-400 hover:text-white hover:bg-[#444] rounded ml-1 flex-shrink-0 transition-colors"
            title="New Terminal (Ctrl+Shift+`)"
          >
            <Plus size={14} />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-1 ml-2 flex-shrink-0">
          {/* Search Toggle */}
          <button
            onClick={() => {
              setShowSearch(!showSearch);
              setTimeout(() => searchInputRef.current?.focus(), 100);
            }}
            className={`p-1.5 rounded transition-colors ${
              showSearch ? "bg-green-600/30 text-green-400" : "text-gray-400 hover:text-white hover:bg-[#444]"
            }`}
            title="Search (Ctrl+Shift+F)"
          >
            <Search size={14} />
          </button>

          {/* Settings Toggle */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-1.5 rounded transition-colors ${
              showSettings ? "bg-blue-600/30 text-blue-400" : "text-gray-400 hover:text-white hover:bg-[#444]"
            }`}
            title="Terminal Settings"
          >
            <Settings2 size={14} />
          </button>

          {/* Auto-sync Toggle */}
          <button
            onClick={() => setAutoSync(!autoSync)}
            className={`text-[10px] px-2 py-1 rounded transition-colors ${
              autoSync ? "bg-green-600/20 text-green-400" : "bg-gray-600/20 text-gray-400"
            }`}
            title={autoSync ? "Auto-sync enabled" : "Auto-sync disabled"}
          >
            Auto-sync
          </button>

          {/* Manual Sync */}
          <button
            onClick={handleManualSync}
            className="text-gray-400 hover:text-white p-1.5 hover:bg-[#444] rounded transition-colors"
            title="Sync files now"
          >
            <RefreshCw size={14} />
          </button>

          {/* Expand/Minimize */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-gray-400 hover:text-white p-1.5 hover:bg-[#444] rounded transition-colors"
            title={isExpanded ? "Minimize" : "Maximize"}
          >
            {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>

      {/* Search Bar */}
      {showSearch && (
        <div
          data-design-id="terminal-search-bar"
          className="h-10 bg-[#252526] border-b border-[#3c3c3c] flex items-center px-3 gap-2 flex-shrink-0"
        >
          <div className="flex items-center flex-1 gap-2">
            <div className="relative flex-1 max-w-md">
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
                      handleSearchNext();
                    }
                  }
                }}
                placeholder="Search in terminal..."
                className="w-full h-7 px-3 pr-20 bg-[#3c3c3c] border border-[#555] rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-green-400"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <button
                  onClick={() => setSearchOptions((prev) => ({ ...prev, regex: !prev.regex }))}
                  className={`p-1 rounded ${searchOptions.regex ? "bg-green-600/30 text-green-400" : "text-gray-500 hover:text-white"}`}
                  title="Use Regular Expression"
                >
                  <Regex size={12} />
                </button>
                <button
                  onClick={() => setSearchOptions((prev) => ({ ...prev, caseSensitive: !prev.caseSensitive }))}
                  className={`p-1 rounded ${searchOptions.caseSensitive ? "bg-green-600/30 text-green-400" : "text-gray-500 hover:text-white"}`}
                  title="Match Case"
                >
                  <CaseSensitive size={12} />
                </button>
                <button
                  onClick={() => setSearchOptions((prev) => ({ ...prev, wholeWord: !prev.wholeWord }))}
                  className={`p-1 rounded ${searchOptions.wholeWord ? "bg-green-600/30 text-green-400" : "text-gray-500 hover:text-white"}`}
                  title="Match Whole Word"
                >
                  <WholeWord size={12} />
                </button>
              </div>
            </div>

            {searchResultCount !== null && (
              <span className="text-xs text-gray-400">
                {searchResultCount > 0 ? `Found` : "No results"}
              </span>
            )}

            <button
              onClick={handleSearchPrev}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-[#444] rounded transition-colors"
              title="Previous Match (Shift+Enter)"
            >
              <ChevronUp size={14} />
            </button>
            <button
              onClick={handleSearchNext}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-[#444] rounded transition-colors"
              title="Next Match (Enter)"
            >
              <ChevronDown size={14} />
            </button>
            <button
              onClick={handleClearSearch}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-[#444] rounded transition-colors"
              title="Clear Search"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Settings Panel */}
      {showSettings && (
        <div
          data-design-id="terminal-settings-panel"
          className="bg-[#252526] border-b border-[#3c3c3c] p-3 flex-shrink-0"
        >
          <div className="flex flex-wrap items-center gap-4">
            {/* Theme Selector */}
            <div className="flex items-center gap-2">
              <Palette size={14} className="text-gray-400" />
              <select
                value={currentTheme}
                onChange={(e) => handleThemeChange(e.target.value as keyof typeof terminalThemes)}
                className="h-7 px-2 bg-[#3c3c3c] border border-[#555] rounded text-xs text-white focus:outline-none focus:border-blue-400"
              >
                {themeNames.map((theme) => (
                  <option key={theme} value={theme}>
                    {theme.charAt(0).toUpperCase() + theme.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            {/* Font Selector */}
            <div className="flex items-center gap-2">
              <Type size={14} className="text-gray-400" />
              <select
                value={currentFont}
                onChange={(e) => handleFontChange(e.target.value)}
                className="h-7 px-2 bg-[#3c3c3c] border border-[#555] rounded text-xs text-white focus:outline-none focus:border-blue-400"
              >
                {terminalFonts.map((font) => (
                  <option key={font} value={font}>
                    {font.split(",")[0].replace(/"/g, "")}
                  </option>
                ))}
              </select>
            </div>

            {/* Font Size Controls */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleFontSizeChange(-1)}
                className="p-1.5 text-gray-400 hover:text-white hover:bg-[#444] rounded transition-colors"
                title="Decrease Font Size"
              >
                <ZoomOut size={14} />
              </button>
              <span className="text-xs text-gray-300 w-8 text-center">{currentFontSize}px</span>
              <button
                onClick={() => handleFontSizeChange(1)}
                className="p-1.5 text-gray-400 hover:text-white hover:bg-[#444] rounded transition-colors"
                title="Increase Font Size"
              >
                <ZoomIn size={14} />
              </button>
              <button
                onClick={handleResetFontSize}
                className="p-1.5 text-gray-400 hover:text-white hover:bg-[#444] rounded transition-colors"
                title="Reset Font Size"
              >
                <RotateCcw size={14} />
              </button>
            </div>

            {/* Divider */}
            <div className="h-6 w-px bg-[#555]" />

            {/* Actions */}
            <div className="flex items-center gap-1">
              <button
                onClick={handleCopySelection}
                className="p-1.5 text-gray-400 hover:text-white hover:bg-[#444] rounded transition-colors"
                title="Copy Selection"
              >
                <Copy size={14} />
              </button>
              <button
                onClick={handleClearTerminal}
                className="p-1.5 text-gray-400 hover:text-white hover:bg-[#444] rounded transition-colors"
                title="Clear Terminal"
              >
                <Trash2 size={14} />
              </button>
              <button
                onClick={handleExportHTML}
                className="p-1.5 text-gray-400 hover:text-white hover:bg-[#444] rounded transition-colors"
                title="Export as HTML"
              >
                <Download size={14} />
              </button>
            </div>

            {/* Divider */}
            <div className="h-6 w-px bg-[#555]" />

            {/* Scroll Controls */}
            <div className="flex items-center gap-1">
              <button
                onClick={handleScrollToTop}
                className="p-1.5 text-gray-400 hover:text-white hover:bg-[#444] rounded transition-colors"
                title="Scroll to Top"
              >
                <ArrowUpToLine size={14} />
              </button>
              <button
                onClick={handleScrollToBottom}
                className="p-1.5 text-gray-400 hover:text-white hover:bg-[#444] rounded transition-colors"
                title="Scroll to Bottom"
              >
                <ArrowDownToLine size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Terminal Content */}
      <div className="flex-1 relative overflow-hidden">
        {terminals.map((terminal) => (
          <div
            key={terminal.id}
            ref={(el) => setTerminalRef(terminal.id, el)}
            data-design-id={`terminal-instance-${terminal.id}`}
            className={`absolute inset-0 p-1 ${terminal.id === activeTerminalId ? "block" : "hidden"}`}
            style={{ minHeight: isExpanded ? "calc(100vh - 80px)" : "200px" }}
          />
        ))}

        {terminals.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-gray-500">
            <TerminalSquare size={32} className="mb-2 opacity-30" />
            <p className="text-sm">Click + to create a terminal</p>
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div
        data-design-id="terminal-status-bar"
        className="h-6 bg-[#007acc] flex items-center justify-between px-2 text-xs text-white flex-shrink-0"
      >
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-400" />
            Connected
          </span>
          {activeTerminalId && (
            <span className="text-white/70">
              {terminals.find((t) => t.id === activeTerminalId)?.name || "Terminal"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-white/70">
          <span>Theme: {currentTheme}</span>
          <span>Font: {currentFontSize}px</span>
          <span>WebGL Accelerated</span>
        </div>
      </div>
    </div>
  );
}