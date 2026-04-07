import { useCallback, useEffect, useRef, useState } from "react";
import { useTerminalStore } from "@/store/useTerminalStore";
import { useStore } from "@/store/useStore";
import { TerminalInstance } from "@/components/TerminalInstance";
import {
  Plus,
  X,
  TerminalSquare,
  Wifi,
  WifiOff,
  RotateCcw,
  Maximize2,
  Minimize2,
  Menu,
} from "lucide-react";

interface MultiTerminalProps {
  className?: string;
}

export function MultiTerminal({ className = "" }: MultiTerminalProps) {
  const {
    tabs,
    activeTabId,
    addTab,
    removeTab,
    setActiveTab,
  } = useTerminalStore();

  const { sandboxStatus, terminalHeight, setTerminalHeight } = useStore();
  const prevHeightRef = useRef(terminalHeight);
  const [isMaximized, setIsMaximizedState] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const isConnected = activeTab?.connected ?? false;

  const handleAddTab = useCallback(() => {
    addTab();
  }, [addTab]);

  const handleCloseTab = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      if (tabs.length <= 1) return;
      removeTab(id);
    },
    [tabs.length, removeTab]
  );

  const toggleMaximize = useCallback(() => {
    if (isMaximized) {
      setTerminalHeight(prevHeightRef.current);
      setIsMaximizedState(false);
    } else {
      prevHeightRef.current = terminalHeight;
      setTerminalHeight(window.innerHeight * 0.7);
      setIsMaximizedState(true);
    }
  }, [isMaximized, terminalHeight, setTerminalHeight]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && sidebarOpen) setSidebarOpen(false);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [sidebarOpen]);

  return (
    <div
      data-design-id="multi-terminal-panel"
      className={`flex flex-col bg-[#1a1b26] overflow-hidden ${className}`}
    >
      {/* Header bar */}
      <div
        data-design-id="terminal-tab-bar"
        className="flex items-center bg-[#16161e] border-t border-[#292e42] select-none flex-shrink-0 min-w-0"
      >
        {/* Hamburger + active tab label */}
        <div data-design-id="terminal-hamburger-area" className="flex items-center min-w-0 flex-1 gap-1">
          <button
            data-design-id="terminal-sidebar-toggle"
            onClick={() => setSidebarOpen((v) => !v)}
            className="p-1.5 mx-0.5 rounded hover:bg-[#292e42] text-[#565f89] hover:text-[#a9b1d6] transition-colors flex-shrink-0"
            title="Toggle sessions"
            aria-label="Toggle terminal sessions sidebar"
            style={{ minHeight: "auto", minWidth: "auto" }}
          >
            <Menu className="w-3.5 h-3.5" />
          </button>

          <div data-design-id="terminal-active-label" className="flex items-center gap-1.5 min-w-0 overflow-hidden">
            <span data-design-id="terminal-active-icon">
              <TerminalSquare className="w-3 h-3 flex-shrink-0 text-[#7aa2f7]" />
            </span>
            <span className="text-[11px] font-medium text-[#a9b1d6] truncate">
              {activeTab?.name ?? "Terminal"}
            </span>
            <span
              data-design-id="terminal-active-dot"
              className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                isConnected ? "bg-[#9ece6a]" : "bg-[#565f89]"
              }`}
            />
          </div>
        </div>

        {/* Action buttons */}
        <div
          data-design-id="terminal-actions"
          className="flex items-center flex-shrink-0 bg-[#16161e] border-l border-[#292e42]"
        >
          <button
            data-design-id="terminal-add-tab-btn"
            onClick={handleAddTab}
            className="p-1.5 mx-0.5 rounded hover:bg-[#292e42] text-[#565f89] hover:text-[#a9b1d6] transition-colors flex-shrink-0"
            title="New Terminal"
            style={{ minHeight: "auto", minWidth: "auto" }}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>

          <div className="w-px h-4 bg-[#292e42] mx-0.5 flex-shrink-0" />

          <button
            data-design-id="terminal-maximize-btn"
            onClick={toggleMaximize}
            className="p-1.5 rounded hover:bg-[#292e42] text-[#565f89] hover:text-[#a9b1d6] transition-colors flex-shrink-0"
            title={isMaximized ? "Restore" : "Maximize"}
            style={{ minHeight: "auto", minWidth: "auto" }}
          >
            {isMaximized ? (
              <Minimize2 className="w-3 h-3" />
            ) : (
              <Maximize2 className="w-3 h-3" />
            )}
          </button>

          <div
            data-design-id="terminal-connection-status"
            className="flex items-center gap-1 px-1.5 flex-shrink-0"
          >
            {isConnected ? (
              <span data-design-id="terminal-status-connected-icon">
                <Wifi className="w-3 h-3 text-[#9ece6a]" />
              </span>
            ) : (
              <span data-design-id="terminal-status-disconnected-icon">
                <WifiOff className="w-3 h-3 text-[#f7768e]" />
              </span>
            )}
            <span
              data-design-id="terminal-status-label"
              className={`text-[10px] font-mono hidden sm:inline ${
                isConnected ? "text-[#9ece6a]" : "text-[#f7768e]"
              }`}
            >
              {isConnected ? "Connected" : "Disconnected"}
            </span>
          </div>

          {sandboxStatus === "ready" && (
            <button
              data-design-id="terminal-reconnect-btn"
              className="p-1.5 mr-1 rounded hover:bg-[#292e42] transition-colors flex-shrink-0"
              title="Reconnect terminal"
              style={{ minHeight: "auto", minWidth: "auto" }}
            >
              <RotateCcw className="w-3 h-3 text-[#565f89] hover:text-[#a9b1d6]" />
            </button>
          )}
        </div>
      </div>

      {/* Terminal body + sidebar overlay */}
      <div className="flex-1 min-h-0 overflow-hidden relative">
        {/* Backdrop */}
        <div
          data-design-id="terminal-sidebar-backdrop"
          className="absolute inset-0 z-20 bg-black/40 transition-opacity duration-200"
          style={{
            opacity: sidebarOpen ? 1 : 0,
            pointerEvents: sidebarOpen ? "auto" : "none",
          }}
          onClick={() => setSidebarOpen(false)}
        />

        {/* Sidebar drawer */}
        <div
          ref={sidebarRef}
          data-design-id="terminal-sidebar-drawer"
          className="absolute top-0 left-0 bottom-0 z-30 flex flex-col bg-[#13131a] border-r border-[#292e42] shadow-xl shadow-black/30 transition-transform duration-200 ease-out"
          style={{
            width: "200px",
            transform: sidebarOpen ? "translateX(0)" : "translateX(-100%)",
          }}
        >
          {/* Sidebar header */}
          <div data-design-id="terminal-sidebar-header" className="flex items-center justify-between px-3 py-2 border-b border-[#292e42] flex-shrink-0">
            <span className="text-[11px] font-semibold text-[#787c99] uppercase tracking-wider">Sessions</span>
            <button
              data-design-id="terminal-sidebar-close"
              onClick={() => setSidebarOpen(false)}
              className="p-0.5 rounded hover:bg-[#292e42] text-[#565f89] hover:text-[#a9b1d6] transition-colors"
              aria-label="Close sidebar"
              style={{ minHeight: "auto", minWidth: "auto" }}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Scrollable tab list */}
          <div
            data-design-id="terminal-sidebar-tabs"
            className="flex-1 overflow-y-auto overflow-x-hidden py-1"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            {tabs.map((tab) => {
              const isActive = tab.id === activeTabId;
              return (
                <button
                  key={tab.id}
                  data-design-id={`terminal-tab-${tab.id}`}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setSidebarOpen(false);
                  }}
                  className={`group relative flex items-center gap-2 w-full px-3 py-2 text-[11px] font-medium transition-colors ${
                    isActive
                      ? "bg-[#1a1b26] text-[#a9b1d6]"
                      : "text-[#565f89] hover:text-[#787c99] hover:bg-[#1a1b26]/50"
                  }`}
                  style={{ minHeight: "auto", minWidth: "auto" }}
                >
                  {/* Active indicator bar */}
                  {isActive && (
                    <div className="absolute left-0 top-1 bottom-1 w-[2px] rounded-r bg-[#7aa2f7]" />
                  )}

                  <span data-design-id={`terminal-tab-icon-${tab.id}`}>
                    <TerminalSquare className="w-3 h-3 flex-shrink-0" />
                  </span>

                  <span className="truncate flex-1 text-left">{tab.name}</span>

                  <span
                    data-design-id={`terminal-tab-dot-${tab.id}`}
                    className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      tab.connected ? "bg-[#9ece6a]" : "bg-[#565f89]"
                    }`}
                  />

                  {tabs.length > 1 && (
                    <span
                      data-design-id={`terminal-tab-close-${tab.id}`}
                      onClick={(e) => handleCloseTab(e, tab.id)}
                      className={`p-0.5 rounded transition-colors flex-shrink-0 ${
                        isActive
                          ? "hover:bg-[#292e42] text-[#565f89] hover:text-[#a9b1d6]"
                          : "opacity-0 group-hover:opacity-100 hover:bg-[#292e42] text-[#565f89] hover:text-[#a9b1d6]"
                      }`}
                      role="button"
                      aria-label={`Close ${tab.name}`}
                      style={{ minHeight: "auto", minWidth: "auto" }}
                    >
                      <X className="w-3 h-3" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Sidebar footer — add new terminal */}
          <div data-design-id="terminal-sidebar-footer" className="border-t border-[#292e42] px-2 py-1.5 flex-shrink-0">
            <button
              data-design-id="terminal-sidebar-add-btn"
              onClick={() => {
                handleAddTab();
                setSidebarOpen(false);
              }}
              className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-[11px] font-medium text-[#565f89] hover:text-[#a9b1d6] hover:bg-[#292e42] transition-colors"
              style={{ minHeight: "auto", minWidth: "auto" }}
            >
              <Plus className="w-3.5 h-3.5 flex-shrink-0" />
              <span>New Terminal</span>
            </button>
          </div>
        </div>

        {/* Terminal instances */}
        {tabs.map((tab) => (
          <TerminalInstance
            key={tab.id}
            terminalId={tab.id}
            isVisible={tab.id === activeTabId}
          />
        ))}
      </div>
    </div>
  );
}