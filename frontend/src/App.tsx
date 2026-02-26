import { useStore } from "@/store/useStore";
import { ChatPanel } from "@/components/ChatPanel";
import { FilePanel } from "@/components/FilePanel";
import { ComputerPanel } from "@/components/ComputerPanel";
import { SettingsDialog } from "@/components/SettingsDialog";
import { MemorySidebar } from "@/components/MemorySidebar";
import { Toaster } from "@/components/ui/sonner";
import { Monitor, FolderOpen, MessageSquare } from "lucide-react";

function App() {
  const { mobileTab, setMobileTab, rightPanel, setRightPanel } = useStore();

  return (
    <div data-design-id="app-container" className="h-screen w-screen overflow-hidden bg-background">
      <script
        data-design-ignore="true"
        dangerouslySetInnerHTML={{
          __html: `
            (function() {
              if (window === window.parent || window.__DESIGN_NAV_REPORTER__) return;
              window.__DESIGN_NAV_REPORTER__ = true;
              function report() {
                try { window.parent.postMessage({ type: 'IFRAME_URL_CHANGE', payload: { url: location.origin + location.pathname + location.hash } }, '*'); } catch(e) {}
              }
              report();
              var ps = history.pushState, rs = history.replaceState;
              history.pushState = function() { ps.apply(this, arguments); report(); };
              history.replaceState = function() { rs.apply(this, arguments); report(); };
              window.addEventListener('popstate', report);
              window.addEventListener('hashchange', report);
              window.addEventListener('load', report);
            })();
          `,
        }}
      />
      
      <div data-design-id="desktop-layout" className="hidden md:flex h-full">
        <div 
          data-design-id="chat-panel-container"
          className="w-1/2 h-full flex flex-col px-5 overflow-hidden"
        >
          <ChatPanel />
        </div>

        <div 
          data-design-id="right-panel-container"
          className="w-1/2 h-full p-3.5 pl-0"
        >
          <div className="h-full rounded-[18px] bg-card shadow-lg border border-border overflow-hidden flex flex-col">
            <div 
              data-design-id="right-panel-header"
              className="flex items-center justify-between px-4 py-3 border-b border-border"
            >
              <div className="flex items-center gap-2">
                <button
                  data-design-id="computer-tab-btn"
                  onClick={() => setRightPanel("computer")}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    rightPanel === "computer"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  }`}
                >
                  <Monitor className="w-4 h-4" />
                  Computer
                </button>
                <button
                  data-design-id="files-tab-btn"
                  onClick={() => setRightPanel("files")}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    rightPanel === "files"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  }`}
                >
                  <FolderOpen className="w-4 h-4" />
                  Files
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-hidden">
              {rightPanel === "computer" ? (
                <ComputerPanel />
              ) : (
                <FilePanel />
              )}
            </div>
          </div>
        </div>
      </div>

      <div data-design-id="mobile-layout" className="md:hidden flex flex-col h-full">
        <div className="flex-1 overflow-hidden">
          {mobileTab === "chat" ? (
            <div className="h-full px-3 sm:px-4">
              <ChatPanel />
            </div>
          ) : mobileTab === "computer" ? (
            <div className="h-full">
              <ComputerPanel />
            </div>
          ) : (
            <div className="h-full">
              <FilePanel />
            </div>
          )}
        </div>

        <div data-design-id="mobile-tab-bar" className="flex h-14 bg-card border-t border-border safe-area-bottom">
          <button
            data-design-id="mobile-chat-tab"
            onClick={() => setMobileTab("chat")}
            className={`flex-1 flex items-center justify-center gap-1.5 transition-colors ${
              mobileTab === "chat"
                ? "text-primary bg-primary/10"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <MessageSquare className="w-5 h-5" />
            <span className="text-xs sm:text-sm font-medium">Chat</span>
          </button>
          <button
            data-design-id="mobile-computer-tab"
            onClick={() => setMobileTab("computer")}
            className={`flex-1 flex items-center justify-center gap-1.5 transition-colors ${
              mobileTab === "computer"
                ? "text-primary bg-primary/10"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Monitor className="w-5 h-5" />
            <span className="text-xs sm:text-sm font-medium">Computer</span>
          </button>
          <button
            data-design-id="mobile-files-tab"
            onClick={() => setMobileTab("files")}
            className={`flex-1 flex items-center justify-center gap-1.5 transition-colors ${
              mobileTab === "files"
                ? "text-primary bg-primary/10"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <FolderOpen className="w-5 h-5" />
            <span className="text-xs sm:text-sm font-medium">Files</span>
          </button>
        </div>
      </div>

      <SettingsDialog />
      <MemorySidebar />
      <Toaster position="bottom-right" />
    </div>
  );
}

export default App;