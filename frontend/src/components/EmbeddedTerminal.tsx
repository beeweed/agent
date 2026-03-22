import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Sandbox } from 'e2b';
import { useStore } from '@/store/useStore';
import {
  TerminalSquare,
  Loader2,
  Maximize2,
  Minimize2,
  Clipboard,
  ClipboardPaste,
} from 'lucide-react';

interface E2BSandboxState {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
}

const useE2BSandbox = () => {
  const [state, setState] = useState<E2BSandboxState>({
    isConnected: false,
    isConnecting: false,
    error: null,
  });

  const sandboxRef = useRef<Sandbox | null>(null);
  const terminalRef = useRef<{ pid: number; dataCallback: (data: Uint8Array) => void } | null>(null);
  const currentSandboxIdRef = useRef<string | null>(null);

  // Connect to an existing sandbox using sandbox_id
  const connectToSandbox = useCallback(async (sandboxId: string, apiKey: string) => {
    if (!sandboxId || !apiKey) {
      setState(prev => ({ ...prev, error: 'Missing sandbox ID or API key' }));
      return null;
    }

    // Skip if already connected to this sandbox
    if (currentSandboxIdRef.current === sandboxId && sandboxRef.current) {
      return sandboxRef.current;
    }

    setState(prev => ({ ...prev, isConnecting: true, error: null }));

    try {
      // Connect to the existing sandbox
      const sandbox = await Sandbox.connect(sandboxId, {
        apiKey: apiKey,
      });

      sandboxRef.current = sandbox;
      currentSandboxIdRef.current = sandboxId;

      setState(prev => ({
        ...prev,
        isConnected: true,
        isConnecting: false,
        error: null,
      }));

      return sandbox;
    } catch (error) {
      console.error('Failed to connect to sandbox:', error);
      setState(prev => ({
        ...prev,
        isConnecting: false,
        error: error instanceof Error ? error.message : 'Failed to connect to sandbox',
      }));
      return null;
    }
  }, []);

  const createTerminal = useCallback(async (
    cols: number,
    rows: number,
    onData: (data: Uint8Array) => void
  ) => {
    if (!sandboxRef.current) {
      console.error('No sandbox connected');
      return null;
    }

    try {
      const terminal = await sandboxRef.current.pty.create({
        cols,
        rows,
        envs: {
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor',
          LANG: 'en_US.UTF-8',
          LC_ALL: 'en_US.UTF-8',
          FORCE_COLOR: '3',
          TERM_PROGRAM: 'xterm',
        },
        onData: (data: Uint8Array) => {
          if (terminalRef.current?.dataCallback) {
            terminalRef.current.dataCallback(data);
          }
        },
        timeoutMs: 0,
      });

      terminalRef.current = { pid: terminal.pid, dataCallback: onData };
      return terminal;
    } catch (error) {
      console.error('Failed to create terminal:', error);
      setState(prev => ({ ...prev, error: error instanceof Error ? error.message : 'Failed to create terminal' }));
      return null;
    }
  }, []);

  const sendTerminalInput = useCallback(async (data: string) => {
    if (!sandboxRef.current || !terminalRef.current) return;

    try {
      await sandboxRef.current.pty.sendInput(
        terminalRef.current.pid,
        new TextEncoder().encode(data)
      );
    } catch (error) {
      console.error('Failed to send terminal input:', error);
    }
  }, []);

  const sendTerminalBinaryInput = useCallback(async (data: Uint8Array) => {
    if (!sandboxRef.current || !terminalRef.current) return;

    try {
      await sandboxRef.current.pty.sendInput(terminalRef.current.pid, data);
    } catch (error) {
      console.error('Failed to send binary terminal input:', error);
    }
  }, []);

  const resizeTerminal = useCallback(async (cols: number, rows: number) => {
    if (!sandboxRef.current || !terminalRef.current) return;

    try {
      await sandboxRef.current.pty.resize(terminalRef.current.pid, { cols, rows });
    } catch (error) {
      console.error('Failed to resize terminal:', error);
    }
  }, []);

  const disconnect = useCallback(() => {
    // Don't kill the sandbox, just disconnect
    sandboxRef.current = null;
    terminalRef.current = null;
    currentSandboxIdRef.current = null;

    setState(prev => ({
      ...prev,
      isConnected: false,
    }));
  }, []);

  return {
    ...state,
    connectToSandbox,
    createTerminal,
    sendTerminalInput,
    sendTerminalBinaryInput,
    resizeTerminal,
    disconnect,
  };
};

interface TerminalComponentProps {
  isConnected: boolean;
  onCreateTerminal: (cols: number, rows: number, onData: (data: Uint8Array) => void) => Promise<{ pid: number } | null>;
  onSendInput: (data: string) => Promise<void>;
  onSendBinaryInput: (data: Uint8Array) => Promise<void>;
  onResize: (cols: number, rows: number) => Promise<void>;
}

const TerminalComponent: React.FC<TerminalComponentProps> = ({
  isConnected,
  onCreateTerminal,
  onSendInput,
  onSendBinaryInput,
  onResize,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalDivRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const resizeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const initializeTerminal = useCallback(async () => {
    if (!terminalDivRef.current || xtermRef.current) return;

    setIsInitializing(true);

    const xterm = new XTerm({
      cursorBlink: true,
      cursorStyle: 'bar',
      cursorInactiveStyle: 'outline',
      fontSize: 13,
      fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", Menlo, Monaco, "Courier New", monospace',
      fontWeight: '400',
      fontWeightBold: '700',
      lineHeight: 1.2,
      letterSpacing: 0,
      scrollback: 10000,
      smoothScrollDuration: 100,
      macOptionIsMeta: true,
      altClickMovesCursor: true,
      convertEol: false,
      allowProposedApi: true,
      windowOptions: {
        fullscreenWin: true,
        getCellSizePixels: true,
        getIconTitle: true,
        getScreenSizeChars: true,
        getScreenSizePixels: true,
        getWinPosition: true,
        getWinSizeChars: true,
        getWinSizePixels: true,
        getWinState: true,
        getWinTitle: true,
        maximizeWin: true,
        minimizeWin: true,
        popTitle: true,
        pushTitle: true,
        refreshWin: true,
        restoreWin: true,
        setWinLines: true,
        setWinPosition: true,
        setWinSizeChars: true,
        setWinSizePixels: true,
      },
      theme: {
        background: '#f0f0f0',
        foreground: '#2e2e2e',
        cursor: '#4a90d9',
        cursorAccent: '#f0f0f0',
        selectionBackground: '#b3d4fc',
        selectionForeground: '#1a1a1a',
        selectionInactiveBackground: '#b3d4fc80',
        black: '#2e2e2e',
        red: '#c0392b',
        green: '#27ae60',
        yellow: '#f39c12',
        blue: '#2980b9',
        magenta: '#8e44ad',
        cyan: '#16a085',
        white: '#7f8c8d',
        brightBlack: '#555555',
        brightRed: '#e74c3c',
        brightGreen: '#2ecc71',
        brightYellow: '#f1c40f',
        brightBlue: '#3498db',
        brightMagenta: '#9b59b6',
        brightCyan: '#1abc9c',
        brightWhite: '#2e2e2e',
      },
    });

    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);

    const unicode11Addon = new Unicode11Addon();
    xterm.loadAddon(unicode11Addon);
    xterm.unicode.activeVersion = '11';

    const webLinksAddon = new WebLinksAddon((event, uri) => {
      if (event.ctrlKey || event.metaKey) {
        window.open(uri, '_blank', 'noopener,noreferrer');
      }
    }, {
      urlRegex: /https?:\/\/[^\s"')\]}>]+/g,
    });
    xterm.loadAddon(webLinksAddon);

    xterm.open(terminalDivRef.current);

    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    setTimeout(() => {
      fitAddon.fit();
    }, 50);

    const cols = xterm.cols;
    const rows = xterm.rows;

    const terminal = await onCreateTerminal(cols, rows, (data: Uint8Array) => {
      xterm.write(data);
    });

    if (terminal) {
      xterm.onData((data) => {
        onSendInput(data);
      });

      xterm.onBinary((data) => {
        const buffer = new Uint8Array(data.length);
        for (let i = 0; i < data.length; i++) {
          buffer[i] = data.charCodeAt(i) & 0xFF;
        }
        onSendBinaryInput(buffer);
      });

      xterm.attachCustomKeyEventHandler((event: KeyboardEvent) => {
        if (event.ctrlKey && event.key === 'c' && event.type === 'keydown') {
          const selection = xterm.getSelection();
          if (selection && selection.length > 0) {
            navigator.clipboard.writeText(selection).catch(() => {});
            xterm.clearSelection();
            return false;
          }
          return true;
        }

        if (event.ctrlKey && event.key === 'v' && event.type === 'keydown') {
          navigator.clipboard.readText().then((text) => {
            if (text) {
              onSendInput(text);
            }
          }).catch(() => {});
          return false;
        }

        if (event.ctrlKey && event.shiftKey && event.key === 'C' && event.type === 'keydown') {
          const selection = xterm.getSelection();
          if (selection) {
            navigator.clipboard.writeText(selection).catch(() => {});
            xterm.clearSelection();
          }
          return false;
        }

        if (event.ctrlKey && event.shiftKey && event.key === 'V' && event.type === 'keydown') {
          navigator.clipboard.readText().then((text) => {
            if (text) {
              onSendInput(text);
            }
          }).catch(() => {});
          return false;
        }

        return true;
      });

      terminalDivRef.current?.addEventListener('paste', (event) => {
        event.preventDefault();
        const text = event.clipboardData?.getData('text');
        if (text) {
          onSendInput(text);
        }
      });

      setIsReady(true);
    }

    setIsInitializing(false);
  }, [onCreateTerminal, onSendInput, onSendBinaryInput]);

  useEffect(() => {
    if (isConnected && !xtermRef.current) {
      const timer = setTimeout(() => {
        initializeTerminal();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isConnected, initializeTerminal]);

  useEffect(() => {
    const handleResize = () => {
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
      resizeTimeoutRef.current = setTimeout(() => {
        if (fitAddonRef.current && xtermRef.current) {
          try {
            fitAddonRef.current.fit();
            onResize(xtermRef.current.cols, xtermRef.current.rows);
          } catch (e) {
            console.error('Resize error:', e);
          }
        }
      }, 80);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
    };
  }, [onResize]);

  useEffect(() => {
    if (fitAddonRef.current && xtermRef.current) {
      setTimeout(() => {
        fitAddonRef.current?.fit();
        if (xtermRef.current) {
          onResize(xtermRef.current.cols, xtermRef.current.rows);
        }
        xtermRef.current?.focus();
      }, 150);
    }
  }, [isExpanded, onResize]);

  useEffect(() => {
    return () => {
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
      if (xtermRef.current) {
        xtermRef.current.dispose();
        xtermRef.current = null;
        fitAddonRef.current = null;
      }
    };
  }, []);

  if (!isConnected) {
    return (
      <div data-design-id="terminal-disconnected" className="h-full flex flex-col items-center justify-center bg-[#f0f0f0]" style={{ color: '#888' }}>
        <TerminalSquare size={36} className="mb-3 opacity-30" />
        <p className="text-sm font-medium" style={{ color: '#666' }}>Terminal Not Available</p>
        <p className="text-xs mt-1" style={{ color: '#999' }}>Create a sandbox to access the terminal</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      data-design-id="terminal-connected-container"
      className={`flex flex-col ${isExpanded ? 'fixed inset-0 z-50' : 'h-full'}`}
      style={{ backgroundColor: '#f0f0f0' }}
    >
      <div
        data-design-id="terminal-header-bar"
        className="h-9 flex items-center justify-between px-3 flex-shrink-0"
        style={{ backgroundColor: '#e8e8e8', borderBottom: '1px solid #d0d0d0' }}
      >
        <div className="flex items-center">
          <TerminalSquare size={14} style={{ color: '#27ae60' }} className="mr-2" />
          <span data-design-id="terminal-header-title" className="text-xs font-medium" style={{ color: '#444' }}>Terminal</span>
          {isInitializing && (
            <Loader2 size={12} className="animate-spin ml-2" style={{ color: '#2980b9' }} />
          )}
          {isReady && (
            <span className="ml-2 text-[10px] flex items-center" style={{ color: '#27ae60' }}>
              <span className="w-1.5 h-1.5 rounded-full mr-1 animate-pulse" style={{ backgroundColor: '#27ae60' }}></span>
              Connected
            </span>
          )}
          <span data-design-id="terminal-header-info" className="ml-3 text-[10px] hidden sm:inline" style={{ color: '#aaa' }}>
            256color &middot; truecolor &middot; UTF-8
          </span>
        </div>

        <div className="flex items-center space-x-1">
          <button
            data-design-id="terminal-copy-btn"
            onClick={() => {
              const sel = xtermRef.current?.getSelection();
              if (sel) {
                navigator.clipboard.writeText(sel).catch(() => {});
                xtermRef.current?.clearSelection();
              }
            }}
            className="p-1 rounded transition-colors"
            style={{ color: '#777' }}
            title="Copy selection (Ctrl+C with selection)"
          >
            <Clipboard size={13} />
          </button>
          <button
            data-design-id="terminal-paste-btn"
            onClick={() => {
              navigator.clipboard.readText().then((text) => {
                if (text) onSendInput(text);
              }).catch(() => {});
            }}
            className="p-1 rounded transition-colors"
            style={{ color: '#777' }}
            title="Paste (Ctrl+V)"
          >
            <ClipboardPaste size={13} />
          </button>
          <button
            data-design-id="terminal-expand-btn"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded transition-colors"
            style={{ color: '#777' }}
            title={isExpanded ? 'Minimize' : 'Maximize'}
          >
            {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden">
        <div
          ref={terminalDivRef}
          data-design-id="terminal-xterm-container"
          className="absolute inset-0 terminal-container"
          style={{
            padding: '4px',
            minHeight: isExpanded ? 'calc(100vh - 36px)' : '100%',
          }}
        />
      </div>
    </div>
  );
};

export function EmbeddedTerminal() {
  const { e2bApiKey, sandboxId, sandboxStatus } = useStore();

  const {
    isConnected,
    isConnecting,
    error: sandboxError,
    connectToSandbox,
    createTerminal,
    sendTerminalInput,
    sendTerminalBinaryInput,
    resizeTerminal,
    disconnect,
  } = useE2BSandbox();

  const hasApiKey = !!e2bApiKey;
  const hasSandboxId = !!sandboxId;

  // Auto-connect when sandboxId becomes available
  useEffect(() => {
    if (sandboxId && e2bApiKey && !isConnected && !isConnecting) {
      console.log('[Terminal] Auto-connecting to sandbox:', sandboxId);
      connectToSandbox(sandboxId, e2bApiKey);
    }
  }, [sandboxId, e2bApiKey, isConnected, isConnecting, connectToSandbox]);

  // Disconnect when sandbox is cleared (e.g., on reset)
  useEffect(() => {
    if (!sandboxId && isConnected) {
      console.log('[Terminal] Sandbox cleared, disconnecting...');
      disconnect();
    }
  }, [sandboxId, isConnected, disconnect]);

  if (isConnected) {
    return (
      <div data-design-id="embedded-terminal-active" className="h-full flex flex-col overflow-hidden">
        <TerminalComponent
          isConnected={isConnected}
          onCreateTerminal={createTerminal}
          onSendInput={sendTerminalInput}
          onSendBinaryInput={sendTerminalBinaryInput}
          onResize={resizeTerminal}
        />
      </div>
    );
  }

  return (
    <div
      data-design-id="embedded-terminal-idle"
      className="h-full flex flex-col"
      style={{ backgroundColor: '#f0f0f0' }}
    >
      <div
        data-design-id="terminal-idle-header"
        className="h-9 flex items-center px-3 flex-shrink-0"
        style={{ backgroundColor: '#e8e8e8', borderBottom: '1px solid #d0d0d0' }}
      >
        <TerminalSquare size={14} style={{ color: '#999' }} className="mr-2" />
        <span data-design-id="terminal-idle-title" className="text-xs font-medium" style={{ color: '#666' }}>Terminal</span>
        {isConnecting && (
          <Loader2 size={12} className="animate-spin ml-2" style={{ color: '#2980b9' }} />
        )}
      </div>

      {sandboxError && (
        <div data-design-id="terminal-error-banner" className="px-3 py-2 flex items-center text-xs" style={{ backgroundColor: '#fef2f2', borderBottom: '1px solid #fecaca', color: '#dc2626' }}>
          {sandboxError}
        </div>
      )}

      <div className="flex-1 flex flex-col items-center justify-center px-4">
        <div data-design-id="terminal-idle-icon" className="w-12 h-12 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: '#e0e0e0' }}>
          <TerminalSquare size={24} style={{ color: '#999' }} />
        </div>
        
        {isConnecting ? (
          <>
            <div className="flex items-center gap-2 mb-2">
              <Loader2 size={16} className="animate-spin" style={{ color: '#2980b9' }} />
              <p data-design-id="terminal-connecting-text" className="text-sm font-medium" style={{ color: '#2980b9' }}>
                Connecting to sandbox...
              </p>
            </div>
            <p className="text-xs" style={{ color: '#999' }}>
              Terminal will be ready shortly
            </p>
          </>
        ) : sandboxStatus === "creating" ? (
          <>
            <div className="flex items-center gap-2 mb-2">
              <Loader2 size={16} className="animate-spin" style={{ color: '#f39c12' }} />
              <p data-design-id="terminal-sandbox-creating-text" className="text-sm font-medium" style={{ color: '#f39c12' }}>
                Creating sandbox...
              </p>
            </div>
            <p className="text-xs" style={{ color: '#999' }}>
              Terminal will auto-connect when ready
            </p>
          </>
        ) : hasSandboxId ? (
          <>
            <p data-design-id="terminal-idle-text" className="text-sm font-medium mb-1" style={{ color: '#666' }}>
              Sandbox available
            </p>
            <p className="text-xs" style={{ color: '#999' }}>
              Auto-connecting...
            </p>
          </>
        ) : (
          <>
            <p data-design-id="terminal-idle-text" className="text-sm font-medium mb-1" style={{ color: '#666' }}>
              Terminal will connect automatically
            </p>
            <p className="text-xs text-center" style={{ color: '#999' }}>
              {hasApiKey 
                ? "Send a message to create a sandbox"
                : "Set your E2B API key in Settings first"
              }
            </p>
          </>
        )}
      </div>
    </div>
  );
}