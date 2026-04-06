import { useEffect, useRef, useCallback, useState, type ErrorInfo, Component, type ReactNode } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { useStore } from "@/store/useStore";
import { ChevronDown, ChevronRight, TerminalSquare, AlertTriangle } from "lucide-react";

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

const RECONNECT_DELAYS = [500, 1000, 2000, 4000, 8000];
const PING_INTERVAL = 20000;

class TerminalErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[InlineShellTerminal] Caught error:", error, info);
  }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

interface InlineShellTerminalProps {
  sessionName: string;
  shellEntryId: string;
  shellStatus: "running" | "completed" | "error" | undefined;
}

function InlineShellTerminalInner({
  sessionName,
  shellEntryId,
  shellStatus,
}: InlineShellTerminalProps) {
  const outerRef = useRef<HTMLDivElement>(null);
  const termContainerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fitDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const initLockRef = useRef(false);

  const { sandboxStatus } = useStore();
  const [isExpanded, setIsExpanded] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [hasError, setHasError] = useState(false);

  const safeFit = useCallback(() => {
    if (fitDebounceRef.current) clearTimeout(fitDebounceRef.current);
    fitDebounceRef.current = setTimeout(() => {
      try {
        const container = termContainerRef.current;
        const fitAddon = fitAddonRef.current;
        const term = xtermRef.current;
        if (!container || !fitAddon || !term) return;
        const rect = container.getBoundingClientRect();
        if (rect.width > 10 && rect.height > 10) {
          fitAddon.fit();
        }
      } catch {
        // silently ignore fit errors
      }
    }, 150);
  }, []);

  const sendResize = useCallback((cols: number, rows: number) => {
    try {
      const ws = wsRef.current;
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "resize", cols, rows }));
      }
    } catch { /* ignore */ }
  }, []);

  const sendInput = useCallback((data: string) => {
    try {
      const ws = wsRef.current;
      if (ws?.readyState === WebSocket.OPEN) {
        const bytes = new TextEncoder().encode(data);
        const encoded = btoa(String.fromCharCode(...bytes));
        ws.send(JSON.stringify({ type: "input", data: encoded }));
      }
    } catch { /* ignore */ }
  }, []);

  const sendBinary = useCallback((data: string) => {
    try {
      const ws = wsRef.current;
      if (ws?.readyState === WebSocket.OPEN) {
        const bytes = new Uint8Array(data.length);
        for (let i = 0; i < data.length; i++) {
          bytes[i] = data.charCodeAt(i) & 0xff;
        }
        const encoded = btoa(String.fromCharCode(...bytes));
        ws.send(JSON.stringify({ type: "input", data: encoded }));
      }
    } catch { /* ignore */ }
  }, []);

  const clearPingInterval = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  }, []);

  const startPingInterval = useCallback(() => {
    clearPingInterval();
    pingIntervalRef.current = setInterval(() => {
      try {
        const ws = wsRef.current;
        if (ws?.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "ping" }));
        }
      } catch { /* ignore */ }
    }, PING_INTERVAL);
  }, [clearPingInterval]);

  const cleanupWs = useCallback(() => {
    clearPingInterval();
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (wsRef.current) {
      try { wsRef.current.close(); } catch { /* ignore */ }
      wsRef.current = null;
    }
    setIsConnected(false);
  }, [clearPingInterval]);

  const connectWs = useCallback(() => {
    if (!mountedRef.current) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    if (wsRef.current?.readyState === WebSocket.CONNECTING) return;

    const term = xtermRef.current;
    if (!term) return;

    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    try {
      const wsBase = getWsBase();
      const termId = sessionName || "term_0";
      const wsUrl = `${wsBase}/ws/terminal/default/${termId}`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) return;
        setIsConnected(true);
        reconnectAttemptRef.current = 0;
        startPingInterval();

        requestAnimationFrame(() => {
          try {
            if (xtermRef.current) {
              sendResize(xtermRef.current.cols, xtermRef.current.rows);
            }
          } catch { /* ignore */ }
        });
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === "output") {
            const raw = atob(msg.data);
            const bytes = new Uint8Array(raw.length);
            for (let i = 0; i < raw.length; i++) {
              bytes[i] = raw.charCodeAt(i);
            }
            term.write(bytes);
          } else if (msg.type === "error") {
            term.writeln(
              `\r\n\x1b[31m[Terminal Error] ${msg.message}\x1b[0m\r\n`
            );
          } else if (msg.type === "exit") {
            term.writeln(
              `\r\n\x1b[33m[Process exited with code ${msg.exit_code}]\x1b[0m\r\n`
            );
            setIsConnected(false);
          } else if (msg.type === "pong" || msg.type === "ping") {
            if (msg.type === "ping") {
              ws.send(JSON.stringify({ type: "pong" }));
            }
          }
        } catch {
          // ignore
        }
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        setIsConnected(false);
        clearPingInterval();

        if (sandboxStatus === "ready" && mountedRef.current) {
          const attempt = reconnectAttemptRef.current;
          const delay =
            RECONNECT_DELAYS[Math.min(attempt, RECONNECT_DELAYS.length - 1)];
          reconnectAttemptRef.current = attempt + 1;

          reconnectTimerRef.current = setTimeout(() => {
            connectWs();
          }, delay);
        }
      };

      ws.onerror = () => {
        if (!mountedRef.current) return;
        setIsConnected(false);
      };
    } catch (err) {
      console.error("[InlineShellTerminal] WS connect error:", err);
    }
  }, [
    sessionName,
    sandboxStatus,
    startPingInterval,
    clearPingInterval,
    sendResize,
  ]);

  const initTerminal = useCallback(() => {
    if (initLockRef.current) return;
    if (!termContainerRef.current) return;
    if (xtermRef.current) return;

    initLockRef.current = true;

    try {
      const container = termContainerRef.current;
      const rect = container.getBoundingClientRect();
      if (rect.width < 10 || rect.height < 10) {
        initLockRef.current = false;
        return;
      }

      const term = new XTerm({
        cursorBlink: true,
        cursorStyle: "bar",
        cursorWidth: 2,
        cursorInactiveStyle: "outline",
        fontFamily:
          "'JetBrains Mono', 'Fira Code', 'SF Mono', Menlo, Consolas, monospace",
        fontSize: 12,
        lineHeight: 1.3,
        allowProposedApi: true,
        scrollback: 5000,
        tabStopWidth: 4,
        convertEol: false,
        allowTransparency: true,
        smoothScrollDuration: 100,
        rows: 10,
        cols: 80,
        drawBoldTextInBrightColors: true,
        minimumContrastRatio: 1,
        theme: {
          background: "#1a1b26",
          foreground: "#a9b1d6",
          cursor: "#c0caf5",
          cursorAccent: "#1a1b26",
          selectionBackground: "#33467c80",
          selectionForeground: "#c0caf5",
          selectionInactiveBackground: "#33467c40",
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
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);

      term.open(container);

      xtermRef.current = term;
      fitAddonRef.current = fitAddon;

      term.onData((data) => sendInput(data));
      term.onBinary((data) => sendBinary(data));
      term.onResize(({ cols, rows }) => sendResize(cols, rows));

      requestAnimationFrame(() => safeFit());

      const observer = new ResizeObserver(() => safeFit());
      observer.observe(container);
      resizeObserverRef.current = observer;
    } catch (err) {
      console.error("[InlineShellTerminal] Init error:", err);
      setHasError(true);
      initLockRef.current = false;
    }
  }, [sendInput, sendBinary, sendResize, safeFit]);

  const cleanupTerminal = useCallback(() => {
    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect();
      resizeObserverRef.current = null;
    }
    if (fitDebounceRef.current) clearTimeout(fitDebounceRef.current);
    cleanupWs();
    if (xtermRef.current) {
      try { xtermRef.current.dispose(); } catch { /* ignore */ }
      xtermRef.current = null;
    }
    fitAddonRef.current = null;
    initLockRef.current = false;
  }, [cleanupWs]);

  useEffect(() => {
    mountedRef.current = true;

    if (isExpanded) {
      const timer = setTimeout(() => {
        if (mountedRef.current && !xtermRef.current) {
          initTerminal();
        }
      }, 50);
      return () => clearTimeout(timer);
    }

    return undefined;
  }, [isExpanded, initTerminal]);

  useEffect(() => {
    if (
      sandboxStatus === "ready" &&
      isExpanded &&
      xtermRef.current &&
      (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED)
    ) {
      const timer = setTimeout(() => connectWs(), 400);
      return () => clearTimeout(timer);
    } else if (sandboxStatus === "idle" || sandboxStatus === "error") {
      cleanupWs();
    }
    return undefined;
  }, [sandboxStatus, isExpanded, connectWs, cleanupWs]);

  useEffect(() => {
    if (isExpanded && xtermRef.current) {
      requestAnimationFrame(() => safeFit());
    }
  }, [isExpanded, safeFit]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      cleanupTerminal();
    };
  }, [cleanupTerminal]);

  if (hasError) {
    return (
      <div
        data-design-id={`inline-terminal-error-${shellEntryId}`}
        className="mt-1 rounded-b-lg border border-t-0 border-[#f7768e]/30 bg-[#f7768e]/5 p-3 flex items-center gap-2"
      >
        <AlertTriangle className="w-4 h-4 text-[#f7768e]" />
        <span className="text-xs text-[#f7768e]">Terminal failed to load</span>
      </div>
    );
  }

  return (
    <div
      ref={outerRef}
      data-design-id={`inline-terminal-${shellEntryId}`}
      className="mt-1 rounded-b-lg border border-t-0 border-[#292e42] overflow-hidden"
    >
      <button
        data-design-id={`inline-terminal-toggle-${shellEntryId}`}
        onClick={() => setIsExpanded((v) => !v)}
        className="flex items-center gap-1.5 w-full px-3 py-1.5 text-left bg-[#16161e] hover:bg-[#1a1b26]/80 transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="w-3 h-3 text-[#565f89]" />
        ) : (
          <ChevronRight className="w-3 h-3 text-[#565f89]" />
        )}
        <TerminalSquare className="w-3 h-3 text-[#7aa2f7]" />
        <span className="text-[10px] uppercase tracking-wider text-[#565f89] font-medium">
          Terminal
        </span>
        {isConnected && (
          <span className="w-1.5 h-1.5 rounded-full bg-[#9ece6a] ml-1" />
        )}
        {shellStatus === "running" && (
          <span className="text-[9px] text-[#7aa2f7] ml-auto animate-pulse">
            running...
          </span>
        )}
      </button>

      <div
        style={{
          height: isExpanded ? "260px" : "0px",
          overflow: "hidden",
          transition: "height 0.15s ease",
        }}
      >
        <div
          ref={termContainerRef}
          data-design-id={`inline-terminal-body-${shellEntryId}`}
          className="bg-[#1a1b26]"
          style={{
            height: "260px",
            padding: "4px 0 0 4px",
            overflow: "hidden",
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            navigator.clipboard
              .readText()
              .then((text) => {
                if (text) sendInput(text);
              })
              .catch(() => {});
          }}
        />
      </div>
    </div>
  );
}

export function InlineShellTerminal(props: InlineShellTerminalProps) {
  return (
    <TerminalErrorBoundary
      fallback={
        <div className="mt-1 rounded-b-lg border border-t-0 border-[#f7768e]/30 bg-[#f7768e]/5 p-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-[#f7768e]" />
          <span className="text-xs text-[#f7768e]">Terminal crashed. Please reload.</span>
        </div>
      }
    >
      <InlineShellTerminalInner {...props} />
    </TerminalErrorBoundary>
  );
}