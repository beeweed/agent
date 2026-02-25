import { useStore } from "@/store/useStore";
import { ChatPanel } from "@/components/ChatPanel";
import { FilePanel } from "@/components/FilePanel";
import { SettingsDialog } from "@/components/SettingsDialog";
import { MemorySidebar } from "@/components/MemorySidebar";
import { Toaster } from "@/components/ui/sonner";

function App() {
  const { mobileTab, setMobileTab } = useStore();

  return (
    <div data-design-id="app-container" className="h-screen w-screen overflow-hidden bg-[#272727]">
      {/* Desktop Layout */}
      <div data-design-id="desktop-layout" className="hidden md:flex h-full bg-[#191919]">
        {/* Left Side: Chat Panel */}
        <div 
          data-design-id="chat-panel-container"
          className="w-[440px] min-w-[380px] max-w-[520px] shrink-0 lg:w-[40%]"
        >
          <ChatPanel />
        </div>

        {/* Right Side: File Panel */}
        <FilePanel />
      </div>

      {/* Mobile Layout */}
      <div data-design-id="mobile-layout" className="md:hidden flex flex-col h-full">
        {/* Content Area */}
        <div className="flex-1 overflow-hidden">
          {mobileTab === "chat" ? (
            <div className="h-full">
              <ChatPanel />
            </div>
          ) : (
            <div className="h-full flex">
              <FilePanel />
            </div>
          )}
        </div>

        {/* Mobile Tab Bar */}
        <div data-design-id="mobile-tab-bar" className="flex h-14 bg-[#232323] border-t border-border/30">
          <button
            onClick={() => setMobileTab("chat")}
            className={`flex-1 flex items-center justify-center gap-2 transition-colors ${
              mobileTab === "chat"
                ? "text-primary bg-primary/10"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            <span className="text-sm font-medium">Chat</span>
          </button>
          <button
            onClick={() => setMobileTab("files")}
            className={`flex-1 flex items-center justify-center gap-2 transition-colors ${
              mobileTab === "files"
                ? "text-primary bg-primary/10"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
              />
            </svg>
            <span className="text-sm font-medium">Files</span>
          </button>
        </div>
      </div>

      {/* Dialogs and Overlays */}
      <SettingsDialog />
      <MemorySidebar />
      <Toaster position="bottom-right" />
    </div>
  );
}

export default App;