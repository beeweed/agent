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
    <div data-design-id="app-container" className="h-dvh w-screen overflow-hidden bg-background flex flex-col">
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
      
      <div data-design-id="desktop-layout" className="hidden md:flex flex-1 min-h-0">
        <div 
          data-design-id="chat-panel-container"
          className="w-full md:w-[45%] lg:w-[40%] xl:w-[35%] h-full flex flex-col px-3 md:px-4 lg:px-5 overflow-hidden flex-shrink-0"
        >
          <ChatPanel />
        </div>

        <div 
          data-design-id="right-panel-container"
          className="flex-1 h-full p-2 md:p-3 lg:p-3.5 pl-0"
        >
          <div className="h-full rounded-xl md:rounded-2xl lg:rounded-[18px] bg-card shadow-lg border border-border overflow-hidden flex flex-col">
            <div 
              data-design-id="right-panel-header"
              className="flex items-center justify-between px-2 md:px-3 lg:px-4 py-2 md:py-2.5 lg:py-3 border-b border-border"
            >
              <div className="flex items-center gap-1 md:gap-2">
                <button
                  data-design-id="computer-tab-btn"
                  onClick={() => setRightPanel("computer")}
                  className={`flex items-center gap-1.5 md:gap-2 px-2 md:px-3 py-1 md:py-1.5 rounded-md md:rounded-lg text-xs md:text-sm font-medium transition-all ${
                    rightPanel === "computer"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  }`}
                >
                  <Monitor className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  <span className="hidden sm:inline">Computer</span>
                </button>
                <button
                  data-design-id="files-tab-btn"
                  onClick={() => setRightPanel("files")}
                  className={`flex items-center gap-1.5 md:gap-2 px-2 md:px-3 py-1 md:py-1.5 rounded-md md:rounded-lg text-xs md:text-sm font-medium transition-all ${
                    rightPanel === "files"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  }`}
                >
                  <FolderOpen className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  <span className="hidden sm:inline">Files</span>
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

      <div data-design-id="mobile-layout" className="md:hidden flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="flex-1 min-h-0 overflow-hidden">
          {mobileTab === "chat" ? (
            <div className="h-full overflow-hidden px-2 xs:px-3 sm:px-4">
              <ChatPanel />
            </div>
          ) : mobileTab === "computer" ? (
            <div className="h-full overflow-hidden">
              <ComputerPanel />
            </div>
          ) : (
            <div className="h-full overflow-hidden">
              <FilePanel />
            </div>
          )}
        </div>

        <div data-design-id="mobile-tab-bar" className="flex-shrink-0 flex h-12 xs:h-14 bg-card border-t border-border safe-area-bottom shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
          <button
            data-design-id="mobile-chat-tab"
            onClick={() => setMobileTab("chat")}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 xs:gap-1 transition-all active:scale-95 ${
              mobileTab === "chat"
                ? "text-primary bg-primary/10"
                : "text-muted-foreground active:text-foreground"
            }`}
          >
            <MessageSquare className="w-5 h-5 xs:w-6 xs:h-6" />
            <span className="text-[10px] xs:text-xs sm:text-sm font-medium">Chat</span>
          </button>
          <button
            data-design-id="mobile-computer-tab"
            onClick={() => setMobileTab("computer")}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 xs:gap-1 transition-all active:scale-95 ${
              mobileTab === "computer"
                ? "text-primary bg-primary/10"
                : "text-muted-foreground active:text-foreground"
            }`}
          >
            <Monitor className="w-5 h-5 xs:w-6 xs:h-6" />
            <span className="text-[10px] xs:text-xs sm:text-sm font-medium">Computer</span>
          </button>
          <button
            data-design-id="mobile-files-tab"
            onClick={() => setMobileTab("files")}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 xs:gap-1 transition-all active:scale-95 ${
              mobileTab === "files"
                ? "text-primary bg-primary/10"
                : "text-muted-foreground active:text-foreground"
            }`}
          >
            <FolderOpen className="w-5 h-5 xs:w-6 xs:h-6" />
            <span className="text-[10px] xs:text-xs sm:text-sm font-medium">Files</span>
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