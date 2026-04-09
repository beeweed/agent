import { useEffect, useRef, useCallback, useState } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { Unicode11Addon } from "@xterm/addon-unicode11";
import { WebglAddon } from "@xterm/addon-webgl";
import { CanvasAddon } from "@xterm/addon-canvas";
import { ClipboardAddon } from "@xterm/addon-clipboard";
import { SearchAddon } from "@xterm/addon-search";
import { ImageAddon } from "@xterm/addon-image";
import "@xterm/xterm/css/xterm.css";
import { useStore } from "@/store/useStore";
import { useTerminalStore } from "@/store/useTerminalStore";
import {
  Search,
  X,
  ChevronUp,
  ChevronDown,
} from "lucide-react";

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

interface TerminalInstanceProps {
  terminalId: string;
  isVisible: boolean;
}

export function TerminalInstance({ terminalId, isVisible }: TerminalInstanceProps) {
  const termRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fitDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const { sandboxStatus } = useStore();
  const { setTabConnected, setTabPid } = useTerminalStore();
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const debouncedFit = useCallback(() => {
    if (fitDebounceRef.current) clearTimeout(fitDebounceRef.current);
    fitDebounceRef.current = setTimeout(() => {
      try {
        if (fitAddonRef.current && xtermRef.current) {
          fitAddonRef.current.fit();
        }
      } catch {
        // ignore fit errors during transitions
      }
    }, 50);
  }, []);

  const sendResize = useCallback((cols: number, rows: number) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "resize", cols, rows }));
    }
  }, []);

  const sendInput = useCallback((data: string) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      const bytes = new TextEncoder().encode(data);
      const encoded = btoa(String.fromCharCode(...bytes));
      ws.send(JSON.stringify({ type: "input", data: encoded }));
    }
  }, []);

  const sendBinary = useCallback((data: string) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      const bytes = new Uint8Array(data.length);
      for (let i = 0; i < data.length; i++) {
        bytes[i] = data.charCodeAt(i) & 0xff;
      }
      const encoded = btoa(String.fromCharCode(...bytes));
      ws.send(JSON.stringify({ type: "input", data: encoded }));
    }
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
      const ws = wsRef.current;
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "ping" }));
      }
    }, PING_INTERVAL);
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

    const wsBase = getWsBase();
    const wsUrl = `${wsBase}/ws/terminal/default/${terminalId}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      setTabConnected(terminalId, true);
      reconnectAttemptRef.current = 0;
      startPingInterval();

      requestAnimationFrame(() => {
        if (xtermRef.current) {
          sendResize(xtermRef.current.cols, xtermRef.current.rows);
        }
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
        } else if (msg.type === "connected") {
          setTabPid(terminalId, msg.pid);
        } else if (msg.type === "error") {
          term.writeln(
            `\r\n\x1b[31m[Terminal Error] ${msg.message}\x1b[0m\r\n`
          );
        } else if (msg.type === "exit") {
          term.writeln(
            `\r\n\x1b[33m[Process exited with code ${msg.exit_code}]\x1b[0m\r\n`
          );
          setTabConnected(terminalId, false);
        } else if (msg.type === "pong" || msg.type === "ping") {
          if (msg.type === "ping") {
            ws.send(JSON.stringify({ type: "pong" }));
          }
        }
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setTabConnected(terminalId, false);
      setTabPid(terminalId, null);
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
      setTabConnected(terminalId, false);
    };
  }, [
    terminalId,
    sandboxStatus,
    setTabConnected,
    setTabPid,
    startPingInterval,
    clearPingInterval,
    sendResize,
  ]);

  // Initialize xterm
  useEffect(() => {
    if (!termRef.current) return;
    if (xtermRef.current) return;

    mountedRef.current = true;

    const term = new XTerm({
      cursorBlink: true,
      cursorStyle: "bar",
      cursorWidth: 2,
      cursorInactiveStyle: "outline",
      fontFamily:
        "'JetBrains Mono', 'Fira Code', 'SF Mono', 'Cascadia Code', Menlo, Consolas, 'Liberation Mono', monospace",
      fontSize: 13,
      lineHeight: 1.3,
      letterSpacing: 0,
      allowProposedApi: true,
      scrollback: 50000,
      tabStopWidth: 4,
      convertEol: false,
      allowTransparency: true,
      smoothScrollDuration: 100,
      macOptionIsMeta: true,
      macOptionClickForcesSelection: true,
      rightClickSelectsWord: true,
      altClickMovesCursor: true,
      drawBoldTextInBrightColors: true,
      minimumContrastRatio: 1,
      overviewRuler: {},
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
    const webLinksAddon = new WebLinksAddon((_event, uri) => {
      window.open(uri, "_blank", "noopener");
    });
    const unicode11Addon = new Unicode11Addon();
    const searchAddon = new SearchAddon();
    const clipboardAddon = new ClipboardAddon();
    const imageAddon = new ImageAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.loadAddon(unicode11Addon);
    term.loadAddon(searchAddon);
    term.loadAddon(clipboardAddon);
    term.loadAddon(imageAddon);
    term.unicode.activeVersion = "11";

    term.open(termRef.current);

    try {
      const webglAddon = new WebglAddon();
      webglAddon.onContextLoss(() => {
        webglAddon.dispose();
        try {
          term.loadAddon(new CanvasAddon());
        } catch {
          // dom fallback
        }
      });
      term.loadAddon(webglAddon);
    } catch {
      try {
        term.loadAddon(new CanvasAddon());
      } catch {
        // dom fallback
      }
    }

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;
    searchAddonRef.current = searchAddon;

    term.onData((data) => {
      sendInput(data);
    });

    term.onBinary((data) => {
      sendBinary(data);
    });

    term.onResize(({ cols, rows }) => {
      sendResize(cols, rows);
    });

    requestAnimationFrame(() => {
      debouncedFit();
    });

    const observer = new ResizeObserver(() => {
      debouncedFit();
    });

    observer.observe(termRef.current);
    resizeObserverRef.current = observer;

    return () => {
      mountedRef.current = false;
      observer.disconnect();
      resizeObserverRef.current = null;
      if (fitDebounceRef.current) clearTimeout(fitDebounceRef.current);
      term.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
      searchAddonRef.current = null;
    };
  }, [sendInput, sendBinary, sendResize, debouncedFit]);

  // Connect when this terminal instance mounts (terminals are only created on demand)
  // and handle sandbox status changes for cleanup
  useEffect(() => {
    if (sandboxStatus === "ready") {
      if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
        connectWs();
      }
    } else if (sandboxStatus === "idle" || sandboxStatus === "error") {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      clearPingInterval();
      setTabConnected(terminalId, false);
      setTabPid(terminalId, null);
    }
  }, [sandboxStatus, connectWs, setTabConnected, setTabPid, clearPingInterval, terminalId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      clearPingInterval();
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [clearPingInterval]);

  // Re-fit when visibility changes
  useEffect(() => {
    if (isVisible) {
      requestAnimationFrame(() => {
        debouncedFit();
        xtermRef.current?.focus();
      });
    }
  }, [isVisible, debouncedFit]);

  // Search handlers
  const handleSearchClose = useCallback(() => {
    setSearchVisible(false);
    setSearchQuery("");
    searchAddonRef.current?.clearDecorations();
    xtermRef.current?.focus();
  }, []);

  const handleSearchNext = useCallback(() => {
    if (searchQuery && searchAddonRef.current) {
      searchAddonRef.current.findNext(searchQuery, {
        decorations: {
          matchOverviewRuler: "#7aa2f7",
          activeMatchColorOverviewRuler: "#ff9e64",
          matchBackground: "#33467c",
          activeMatchBackground: "#ff9e6480",
        },
      });
    }
  }, [searchQuery]);

  const handleSearchPrev = useCallback(() => {
    if (searchQuery && searchAddonRef.current) {
      searchAddonRef.current.findPrevious(searchQuery, {
        decorations: {
          matchOverviewRuler: "#7aa2f7",
          activeMatchColorOverviewRuler: "#ff9e64",
          matchBackground: "#33467c",
          activeMatchBackground: "#ff9e6480",
        },
      });
    }
  }, [searchQuery]);

  // Keyboard shortcut for search (Ctrl/Cmd+F)
  useEffect(() => {
    if (!isVisible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        const termEl = termRef.current;
        if (termEl && termEl.contains(document.activeElement)) {
          e.preventDefault();
          setSearchVisible(true);
        }
      }
      if (e.key === "Escape" && searchVisible) {
        handleSearchClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isVisible, searchVisible, handleSearchClose]);

  return (
    <div
      data-design-id={`terminal-instance-${terminalId}`}
      className="flex flex-col h-full bg-[#1a1b26] overflow-hidden"
      style={{ display: isVisible ? "flex" : "none" }}
    >
      {/* Search bar */}
      {searchVisible && (
        <div
          data-design-id={`terminal-search-bar-${terminalId}`}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1f2335] border-b border-[#292e42] flex-shrink-0"
        >
          <Search className="w-3 h-3 text-[#565f89] flex-shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (e.target.value && searchAddonRef.current) {
                searchAddonRef.current.findNext(e.target.value, {
                  decorations: {
                    matchOverviewRuler: "#7aa2f7",
                    activeMatchColorOverviewRuler: "#ff9e64",
                    matchBackground: "#33467c",
                    activeMatchBackground: "#ff9e6480",
                  },
                });
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (e.shiftKey) handleSearchPrev();
                else handleSearchNext();
              }
              if (e.key === "Escape") handleSearchClose();
            }}
            placeholder="Search..."
            autoFocus
            className="flex-1 bg-[#292e42] text-[#a9b1d6] text-[11px] px-2 py-1 rounded border border-[#3b4261] outline-none focus:border-[#7aa2f7] placeholder-[#565f89]"
          />
          <button
            onClick={handleSearchPrev}
            className="p-0.5 rounded hover:bg-[#292e42] text-[#565f89] hover:text-[#a9b1d6] transition-colors"
            title="Previous match (Shift+Enter)"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleSearchNext}
            className="p-0.5 rounded hover:bg-[#292e42] text-[#565f89] hover:text-[#a9b1d6] transition-colors"
            title="Next match (Enter)"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleSearchClose}
            className="p-0.5 rounded hover:bg-[#292e42] text-[#565f89] hover:text-[#a9b1d6] transition-colors"
            title="Close (Esc)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Terminal body */}
      <div
        ref={termRef}
        className="terminal-xterm-body flex-1 min-h-0 overflow-hidden"
        style={{ padding: "4px 0 0 4px" }}
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
  );
}