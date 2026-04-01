import { useCallback, useRef, useState } from "react";
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
  const tabsScrollRef = useRef<HTMLDivElement>(null);
  const prevHeightRef = useRef(terminalHeight);
  const [isMaximized, setIsMaximizedState] = useState(false);

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const isConnected = activeTab?.connected ?? false;

  const handleAddTab = useCallback(() => {
    addTab();
    requestAnimationFrame(() => {
      if (tabsScrollRef.current) {
        tabsScrollRef.current.scrollLeft = tabsScrollRef.current.scrollWidth;
      }
    });
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

  return (
    <div
      data-design-id="multi-terminal-panel"
      className={`flex flex-col bg-[#1a1b26] overflow-hidden ${className}`}
    >
      {/* Tab bar header */}
      <div
        data-design-id="terminal-tab-bar"
        className="flex items-center bg-[#16161e] border-t border-[#292e42] select-none flex-shrink-0"
      >
        {/* Scrollable tabs */}
        <div
          ref={tabsScrollRef}
          data-design-id="terminal-tabs-scroll"
          className="flex-1 flex items-center overflow-x-auto min-w-0 scrollbar-none"
          style={{ scrollbarWidth: "none" }}
        >
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            return (
              <button
                key={tab.id}
                data-design-id={`terminal-tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`group relative flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium whitespace-nowrap transition-colors border-r border-[#292e42] min-w-0 flex-shrink-0 ${
                  isActive
                    ? "bg-[#1a1b26] text-[#a9b1d6]"
                    : "bg-[#13131a] text-[#565f89] hover:text-[#787c99] hover:bg-[#1a1b26]/50"
                }`}
              >
                {/* Active indicator line */}
                {isActive && (
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#7aa2f7]" />
                )}

                <span data-design-id={`terminal-tab-icon-${tab.id}`}>
                  <TerminalSquare className="w-3 h-3 flex-shrink-0" />
                </span>

                <span className="truncate max-w-[100px]">{tab.name}</span>

                {/* Connection dot */}
                <span
                  data-design-id={`terminal-tab-dot-${tab.id}`}
                  className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    tab.connected ? "bg-[#9ece6a]" : "bg-[#565f89]"
                  }`}
                />

                {/* Close button (hidden if only one tab) */}
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
                  >
                    <X className="w-3 h-3" />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Add tab button */}
        <button
          data-design-id="terminal-add-tab-btn"
          onClick={handleAddTab}
          className="p-1.5 mx-1 rounded hover:bg-[#292e42] text-[#565f89] hover:text-[#a9b1d6] transition-colors flex-shrink-0"
          title="New Terminal"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>

        {/* Separator */}
        <div className="w-px h-4 bg-[#292e42] mx-0.5 flex-shrink-0" />

        {/* Maximize/minimize */}
        <button
          data-design-id="terminal-maximize-btn"
          onClick={toggleMaximize}
          className="p-1.5 rounded hover:bg-[#292e42] text-[#565f89] hover:text-[#a9b1d6] transition-colors flex-shrink-0"
          title={isMaximized ? "Restore" : "Maximize"}
        >
          {isMaximized ? (
            <Minimize2 className="w-3 h-3" />
          ) : (
            <Maximize2 className="w-3 h-3" />
          )}
        </button>

        {/* Connection status */}
        <div
          data-design-id="terminal-connection-status"
          className="flex items-center gap-1 px-2 flex-shrink-0"
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
            className={`text-[10px] font-mono ${
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
          >
            <RotateCcw className="w-3 h-3 text-[#565f89] hover:text-[#a9b1d6]" />
          </button>
        )}
      </div>

      {/* Terminal instances — all mount but only the active one is visible */}
      <div className="flex-1 min-h-0 overflow-hidden relative">
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