import { useState, useEffect, useCallback } from "react";
import { useAgentStore } from "@/lib/store";
import { runAgent, fetchFileTree, readFile, clearFiles, type AgentEvent } from "@/lib/api";
import ChatPanel from "@/components/agent/ChatPanel";
import FileTree from "@/components/agent/FileTree";
import FileViewer from "@/components/agent/FileViewer";
import SettingsDialog from "@/components/agent/SettingsDialog";
import { PanelRightClose, PanelRightOpen } from "lucide-react";

export default function App() {
  const store = useAgentStore();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [filesPanelOpen, setFilesPanelOpen] = useState(true);

  const refreshFiles = useCallback(async () => {
    try {
      const tree = await fetchFileTree();
      store.setFiles(tree);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    refreshFiles();
  }, [refreshFiles]);

  const handleSelectFile = useCallback(async (path: string) => {
    store.setSelectedFile(path);
    try {
      const content = await readFile(path);
      store.setFileContent(content);
    } catch {
      store.setFileContent("Error reading file");
    }
  }, []);

  const handleClearFiles = useCallback(async () => {
    await clearFiles();
    store.setSelectedFile(null);
    store.setFileContent("");
    refreshFiles();
  }, [refreshFiles]);

  const handleSend = useCallback(
    (message: string) => {
      if (!store.apiKey) {
        setSettingsOpen(true);
        return;
      }

      store.addUserMessage(message);
      const msgId = store.addAssistantMessage();
      store.setIsRunning(true);
      store.setIsThinking(true);

      let sessionId = store.sessionId;
      if (!sessionId) {
        sessionId = crypto.randomUUID();
        store.setSessionId(sessionId);
      }

      const controller = runAgent(
        message,
        store.apiKey,
        store.selectedModel,
        sessionId,
        (event: AgentEvent) => {
          switch (event.type) {
            case "text_delta":
              store.setIsThinking(false);
              store.appendTextDelta(msgId, event.content);
              break;

            case "text_complete":
              store.finalizeMessage(msgId, event.iteration);
              break;

            case "iteration":
              store.setCurrentIteration(event.iteration);
              break;

            case "tool_call":
              store.addToolCall(msgId, {
                id: crypto.randomUUID(),
                name: event.tool_name,
                args: event.tool_args,
                result: "",
                status: "success",
                filePath: event.file_path,
              });
              refreshFiles();
              break;

            case "tool_result":
              refreshFiles();
              break;

            case "error":
              store.setIsThinking(false);
              if (event.content) {
                store.appendTextDelta(msgId, `\n\n**Error:** ${event.content}`);
              }
              break;

            case "status":
              break;
          }
        },
        () => {
          store.setIsRunning(false);
          store.setIsThinking(false);
          store.finalizeMessage(msgId, store.currentIteration);
          refreshFiles();
        },
        (error: string) => {
          store.setIsRunning(false);
          store.setIsThinking(false);
          store.appendTextDelta(msgId, `\n\n**Error:** ${error}`);
          store.finalizeMessage(msgId, store.currentIteration);
        }
      );

      store.abortRef.current = controller;
    },
    [store.apiKey, store.selectedModel, store.sessionId, refreshFiles]
  );

  const handleReset = useCallback(() => {
    store.reset();
    handleClearFiles();
  }, [handleClearFiles]);

  return (
    <div data-design-id="app-root" className="h-screen w-screen overflow-hidden bg-[#191919]">
      <script
        data-design-ignore="true"
        dangerouslySetInnerHTML={{
          __html: `(function(){if(window===window.parent||window.__DESIGN_NAV_REPORTER__)return;window.__DESIGN_NAV_REPORTER__=true;function report(){try{window.parent.postMessage({type:'IFRAME_URL_CHANGE',payload:{url:location.origin+location.pathname+location.hash}},'*')}catch(e){}}report();var ps=history.pushState,rs=history.replaceState;history.pushState=function(){ps.apply(this,arguments);report()};history.replaceState=function(){rs.apply(this,arguments);report()};window.addEventListener('popstate',report);window.addEventListener('hashchange',report);window.addEventListener('load',report)})();`,
        }}
      />

      <div data-design-id="desktop-layout" className="hidden md:flex h-full">
        <div data-design-id="chat-panel-wrapper" className={`${filesPanelOpen ? "w-[440px] min-w-[380px] max-w-[520px] lg:w-[40%]" : "flex-1"} shrink-0 transition-all duration-300`}>
          <div className="flex flex-col h-full m-3 rounded-3xl border border-white/5 overflow-hidden bg-[#1e1e1e]">
            <ChatPanel
              messages={store.messages}
              isRunning={store.isRunning}
              isThinking={store.isThinking}
              currentIteration={store.currentIteration}
              selectedModel={store.selectedModel}
              onSend={handleSend}
              onStop={store.stopAgent}
              onReset={handleReset}
              onOpenSettings={() => setSettingsOpen(true)}
            />
          </div>
        </div>

        {filesPanelOpen && (
          <div data-design-id="files-panel" className="flex-1 min-w-0 flex h-full">
            <div data-design-id="file-explorer-sidebar" className="w-56 lg:w-64 border-r border-[#404040]/30 flex flex-col">
              <FileTree
                files={store.files}
                onSelectFile={handleSelectFile}
                selectedFile={store.selectedFile}
                onRefresh={refreshFiles}
                onClear={handleClearFiles}
              />
            </div>

            <div data-design-id="file-viewer-area" className="flex-1 min-w-0">
              {store.selectedFile ? (
                <FileViewer
                  path={store.selectedFile}
                  content={store.fileContent}
                  onClose={() => {
                    store.setSelectedFile(null);
                    store.setFileContent("");
                  }}
                />
              ) : (
                <div data-design-id="no-file-selected" className="flex flex-col items-center justify-center h-full bg-[#1e1e1e] text-[#a1a1aa]">
                  <div data-design-id="no-file-icon" className="w-16 h-16 rounded-2xl bg-[#2d2d2f] flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                  </div>
                  <p data-design-id="no-file-text" className="text-sm font-medium mb-1">No file selected</p>
                  <p data-design-id="no-file-hint" className="text-xs opacity-60">Select a file from the explorer to view its content</p>
                </div>
              )}
            </div>
          </div>
        )}

        <button
          data-design-id="toggle-files-btn"
          onClick={() => setFilesPanelOpen(!filesPanelOpen)}
          className="absolute top-4 right-4 z-10 p-2 rounded-lg bg-[#2d2d2f] text-[#a1a1aa] hover:text-[#f0f0f0] hover:bg-[#3a3a3c] transition-colors border border-[#404040]/30"
          title={filesPanelOpen ? "Hide files" : "Show files"}
        >
          {filesPanelOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
        </button>
      </div>

      <div data-design-id="mobile-layout" className="md:hidden flex flex-col h-full">
        <MobileView
          store={store}
          onSend={handleSend}
          onReset={handleReset}
          onOpenSettings={() => setSettingsOpen(true)}
          onSelectFile={handleSelectFile}
          refreshFiles={refreshFiles}
          onClearFiles={handleClearFiles}
        />
      </div>

      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        apiKey={store.apiKey}
        onSaveApiKey={store.saveApiKey}
        selectedModel={store.selectedModel}
        onSelectModel={store.saveModel}
        models={store.models}
        onSetModels={store.setModels}
      />
    </div>
  );
}

function MobileView({
  store,
  onSend,
  onReset,
  onOpenSettings,
  onSelectFile,
  refreshFiles,
  onClearFiles,
}: {
  store: ReturnType<typeof useAgentStore>;
  onSend: (msg: string) => void;
  onReset: () => void;
  onOpenSettings: () => void;
  onSelectFile: (path: string) => void;
  refreshFiles: () => void;
  onClearFiles: () => void;
}) {
  const [tab, setTab] = useState<"chat" | "files">("chat");

  return (
    <>
      <div data-design-id="mobile-content" className="flex-1 overflow-hidden">
        {tab === "chat" ? (
          <ChatPanel
            messages={store.messages}
            isRunning={store.isRunning}
            isThinking={store.isThinking}
            currentIteration={store.currentIteration}
            selectedModel={store.selectedModel}
            onSend={onSend}
            onStop={store.stopAgent}
            onReset={onReset}
            onOpenSettings={onOpenSettings}
          />
        ) : (
          <div className="flex h-full">
            <div className="w-1/2 border-r border-[#404040]/30">
              <FileTree
                files={store.files}
                onSelectFile={onSelectFile}
                selectedFile={store.selectedFile}
                onRefresh={refreshFiles}
                onClear={onClearFiles}
              />
            </div>
            <div className="w-1/2">
              {store.selectedFile ? (
                <FileViewer
                  path={store.selectedFile}
                  content={store.fileContent}
                  onClose={() => {
                    store.setSelectedFile(null);
                    store.setFileContent("");
                  }}
                />
              ) : (
                <div className="flex items-center justify-center h-full bg-[#1e1e1e] text-[#a1a1aa] text-xs">
                  Select a file
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      <div data-design-id="mobile-tab-bar" className="flex h-14 bg-[#232323] border-t border-[#404040]/30">
        <button
          data-design-id="mobile-chat-tab"
          onClick={() => setTab("chat")}
          className={`flex-1 flex items-center justify-center gap-2 ${
            tab === "chat" ? "text-[#6366f1] bg-[#6366f1]/10" : "text-[#a1a1aa] hover:text-[#f0f0f0]"
          } transition-colors`}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <span className="text-sm font-medium">Chat</span>
        </button>
        <button
          data-design-id="mobile-files-tab"
          onClick={() => setTab("files")}
          className={`flex-1 flex items-center justify-center gap-2 ${
            tab === "files" ? "text-[#6366f1] bg-[#6366f1]/10" : "text-[#a1a1aa] hover:text-[#f0f0f0]"
          } transition-colors`}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          <span className="text-sm font-medium">Files</span>
        </button>
      </div>
    </>
  );
}