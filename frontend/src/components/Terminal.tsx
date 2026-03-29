import { useEffect, useRef, useCallback, useState } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { Unicode11Addon } from "@xterm/addon-unicode11";
import "@xterm/xterm/css/xterm.css";
import { useStore } from "@/store/useStore";
import { TerminalSquare, Wifi, WifiOff, RotateCcw } from "lucide-react";

const getWsBase = () => {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl) {
    return envUrl.replace(/^http/, "ws").replace(/\/$/, "");
  }
  if (typeof window !== "undefined") {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const hostname = window.location.hostname;
    if (hostname.includes("e2b.app")) {
      return `${protocol}//${window.location.host.replace(/\d+-/, "8000-")}`;
    }
  }
  return "ws://localhost:8000";
};

interface TerminalProps {
  className?: string;
}

export function TerminalPanel({ className = "" }: TerminalProps) {
  const termRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  const { sandboxStatus, terminalConnected, setTerminalConnected } = useStore();
  const [pid, setPid] = useState<number | null>(null);

  const connectWs = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    if (wsRef.current?.readyState === WebSocket.CONNECTING) return;

    const term = xtermRef.current;
    if (!term) return;

    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    const wsBase = getWsBase();
    const wsUrl = `${wsBase}/ws/terminal/default`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setTerminalConnected(true);
      term.clear();
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === "output") {
          const bytes = Uint8Array.from(atob(msg.data), (c) => c.charCodeAt(0));
          term.write(bytes);
        } else if (msg.type === "connected") {
          setPid(msg.pid);
        } else if (msg.type === "error") {
          term.writeln(`\r\n\x1b[31m[Terminal Error] ${msg.message}\x1b[0m\r\n`);
        } else if (msg.type === "exit") {
          term.writeln(`\r\n\x1b[33m[Process exited with code ${msg.exit_code}]\x1b[0m\r\n`);
          setTerminalConnected(false);
        }
      } catch {
        // ignore
      }
    };

    ws.onclose = () => {
      setTerminalConnected(false);
      setPid(null);

      if (sandboxStatus === "ready") {
        reconnectTimerRef.current = setTimeout(() => {
          connectWs();
        }, 2000);
      }
    };

    ws.onerror = () => {
      setTerminalConnected(false);
    };
  }, [sandboxStatus, setTerminalConnected]);

  const sendInput = useCallback((data: string) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      const encoded = btoa(
        String.fromCharCode(...new TextEncoder().encode(data))
      );
      ws.send(JSON.stringify({ type: "input", data: encoded }));
    }
  }, []);

  const sendResize = useCallback((cols: number, rows: number) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "resize", cols, rows }));
    }
  }, []);

  // Initialize xterm
  useEffect(() => {
    if (!termRef.current) return;
    if (xtermRef.current) return;

    const term = new XTerm({
      cursorBlink: true,
      cursorStyle: "bar",
      cursorWidth: 2,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', Menlo, Consolas, monospace",
      fontSize: 13,
      lineHeight: 1.35,
      letterSpacing: 0,
      allowProposedApi: true,
      scrollback: 10000,
      tabStopWidth: 4,
      theme: {
        background: "#1a1b26",
        foreground: "#a9b1d6",
        cursor: "#c0caf5",
        cursorAccent: "#1a1b26",
        selectionBackground: "#33467c",
        selectionForeground: "#c0caf5",
        black: "#32344a",
        red: "#f7768e",
        green: "#9ece6a",
        yellow: "#e0af68",
        blue: "#7aa2f7",
        magenta: "#ad8ee6",
        cyan: "#449dab",
        white: "#787c99",
        brightBlack: "#444b6a",
        brightRed: "#ff7a93",
        brightGreen: "#b9f27c",
        brightYellow: "#ff9e64",
        brightBlue: "#7da6ff",
        brightMagenta: "#bb9af7",
        brightCyan: "#0db9d7",
        brightWhite: "#acb0d0",
      },
      convertEol: false,
      allowTransparency: true,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    const unicode11Addon = new Unicode11Addon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.loadAddon(unicode11Addon);
    term.unicode.activeVersion = "11";

    term.open(termRef.current);

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    // Handle user input -> send to backend
    term.onData((data) => {
      sendInput(data);
    });

    // Handle binary data (for paste, etc.)
    term.onBinary((data) => {
      sendInput(data);
    });

    // Initial fit
    requestAnimationFrame(() => {
      try {
        fitAddon.fit();
      } catch {
        // ignore
      }
    });

    // Resize observer for auto-fit
    const observer = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        try {
          if (fitAddonRef.current && xtermRef.current) {
            fitAddonRef.current.fit();
            sendResize(xtermRef.current.cols, xtermRef.current.rows);
          }
        } catch {
          // ignore
        }
      });
    });

    observer.observe(termRef.current);
    resizeObserverRef.current = observer;

    // Listen for terminal resize events
    term.onResize(({ cols, rows }) => {
      sendResize(cols, rows);
    });

    return () => {
      observer.disconnect();
      resizeObserverRef.current = null;
      term.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  }, [sendInput, sendResize]);

  // Auto-connect when sandbox is ready
  useEffect(() => {
    if (sandboxStatus === "ready") {
      const timer = setTimeout(() => {
        connectWs();
      }, 500);
      return () => clearTimeout(timer);
    } else {
      // Close WebSocket if sandbox is not ready
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setTerminalConnected(false);
      setPid(null);
    }
  }, [sandboxStatus, connectWs, setTerminalConnected]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  const handleReconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setPid(null);
    setTerminalConnected(false);

    const term = xtermRef.current;
    if (term) {
      term.clear();
      term.writeln("\x1b[33mReconnecting...\x1b[0m\r");
    }

    setTimeout(() => connectWs(), 300);
  }, [connectWs, setTerminalConnected]);

  return (
    <div
      data-design-id="terminal-panel"
      className={`flex flex-col bg-[#1a1b26] overflow-hidden ${className}`}
    >
      {/* Terminal header */}
      <div
        data-design-id="terminal-header"
        className="flex items-center justify-between px-3 py-1.5 bg-[#16161e] border-t border-[#292e42] select-none flex-shrink-0"
      >
        <div className="flex items-center gap-2">
          <span data-design-id="terminal-header-icon">
            <TerminalSquare className="w-3.5 h-3.5 text-[#7aa2f7]" />
          </span>
          <span
            data-design-id="terminal-header-title"
            className="text-[11px] font-medium text-[#a9b1d6] tracking-wide uppercase"
          >
            Terminal
          </span>
          {pid && (
            <span
              data-design-id="terminal-header-pid"
              className="text-[10px] text-[#565f89] font-mono"
            >
              PID:{pid}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1">
            {terminalConnected ? (
              <span data-design-id="terminal-status-connected">
                <Wifi className="w-3 h-3 text-[#9ece6a]" />
              </span>
            ) : (
              <span data-design-id="terminal-status-disconnected">
                <WifiOff className="w-3 h-3 text-[#f7768e]" />
              </span>
            )}
            <span
              data-design-id="terminal-status-text"
              className={`text-[10px] font-mono ${
                terminalConnected ? "text-[#9ece6a]" : "text-[#f7768e]"
              }`}
            >
              {terminalConnected ? "Connected" : "Disconnected"}
            </span>
          </div>

          {sandboxStatus === "ready" && (
            <button
              data-design-id="terminal-reconnect-btn"
              onClick={handleReconnect}
              className="p-1 rounded hover:bg-[#292e42] transition-colors"
              title="Reconnect terminal"
            >
              <RotateCcw className="w-3 h-3 text-[#565f89] hover:text-[#a9b1d6]" />
            </button>
          )}
        </div>
      </div>

      {/* Terminal body */}
      <div
        data-design-id="terminal-body"
        ref={termRef}
        className="flex-1 min-h-0 overflow-hidden"
        style={{ padding: "4px 0 0 4px" }}
      />
    </div>
  );
}