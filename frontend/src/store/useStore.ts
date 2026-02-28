import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ChatEntry, FileNode, Model, Memory } from "@/types";

export interface CodeStreamingState {
  filePath: string;
  content: string;
  isStreaming: boolean;
  tool: string;
  action: string;
}

export type SandboxStatus = "idle" | "creating" | "ready" | "error";

interface AppState {
  apiKey: string;
  setApiKey: (key: string) => void;
  
  e2bApiKey: string;
  setE2bApiKey: (key: string) => void;
  
  sandboxStatus: SandboxStatus;
  setSandboxStatus: (status: SandboxStatus) => void;
  
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  
  models: Model[];
  setModels: (models: Model[]) => void;
  modelsLoading: boolean;
  setModelsLoading: (loading: boolean) => void;
  
  chatEntries: ChatEntry[];
  addChatEntry: (entry: ChatEntry) => void;
  updateChatEntry: (id: string, updates: Partial<ChatEntry>) => void;
  clearChat: () => void;
  
  fileTree: FileNode | null;
  setFileTree: (tree: FileNode | null) => void;
  
  selectedFile: string | null;
  setSelectedFile: (path: string | null) => void;
  
  fileContent: string;
  setFileContent: (content: string) => void;
  
  openTabs: string[];
  addTab: (path: string) => void;
  removeTab: (path: string) => void;
  
  isAgentRunning: boolean;
  setIsAgentRunning: (running: boolean) => void;
  
  currentIteration: number;
  setCurrentIteration: (iteration: number) => void;
  
  maxIterations: number;
  
  memory: Memory | null;
  setMemory: (memory: Memory | null) => void;
  
  isSettingsOpen: boolean;
  setIsSettingsOpen: (open: boolean) => void;
  
  isMemoryOpen: boolean;
  setIsMemoryOpen: (open: boolean) => void;
  
  mobileTab: "chat" | "computer" | "files";
  setMobileTab: (tab: "chat" | "computer" | "files") => void;
  
  rightPanel: "computer" | "files";
  setRightPanel: (panel: "computer" | "files") => void;
  
  codeStreaming: CodeStreamingState;
  setCodeStreaming: (state: Partial<CodeStreamingState>) => void;
  resetCodeStreaming: () => void;
  appendStreamingCode: (content: string) => void;
}

const initialCodeStreamingState: CodeStreamingState = {
  filePath: "",
  content: "",
  isStreaming: false,
  tool: "",
  action: "",
};

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      apiKey: "",
      setApiKey: (key) => set({ apiKey: key }),
      
      e2bApiKey: "",
      setE2bApiKey: (key) => set({ e2bApiKey: key }),
      
      sandboxStatus: "idle",
      setSandboxStatus: (status) => set({ sandboxStatus: status }),
      
      selectedModel: "anthropic/claude-3.5-sonnet",
      setSelectedModel: (model) => set({ selectedModel: model }),
      
      models: [],
      setModels: (models) => set({ models }),
      modelsLoading: false,
      setModelsLoading: (loading) => set({ modelsLoading: loading }),
      
      chatEntries: [],
      addChatEntry: (entry) =>
        set((state) => ({ chatEntries: [...state.chatEntries, entry] })),
      updateChatEntry: (id, updates) =>
        set((state) => ({
          chatEntries: state.chatEntries.map((entry) =>
            entry.id === id ? { ...entry, ...updates } : entry
          ),
        })),
      clearChat: () => set({ chatEntries: [], sandboxStatus: "idle" }),
      
      fileTree: null,
      setFileTree: (tree) => set({ fileTree: tree }),
      
      selectedFile: null,
      setSelectedFile: (path) => set({ selectedFile: path }),
      
      fileContent: "",
      setFileContent: (content) => set({ fileContent: content }),
      
      openTabs: [],
      addTab: (path) =>
        set((state) => ({
          openTabs: state.openTabs.includes(path)
            ? state.openTabs
            : [...state.openTabs, path],
        })),
      removeTab: (path) =>
        set((state) => ({
          openTabs: state.openTabs.filter((p) => p !== path),
          selectedFile: state.selectedFile === path ? null : state.selectedFile,
        })),
      
      isAgentRunning: false,
      setIsAgentRunning: (running) => set({ isAgentRunning: running }),
      
      currentIteration: 0,
      setCurrentIteration: (iteration) => set({ currentIteration: iteration }),
      
      maxIterations: 500,
      
      memory: null,
      setMemory: (memory) => set({ memory }),
      
      isSettingsOpen: false,
      setIsSettingsOpen: (open) => set({ isSettingsOpen: open }),
      
      isMemoryOpen: false,
      setIsMemoryOpen: (open) => set({ isMemoryOpen: open }),
      
      mobileTab: "chat",
      setMobileTab: (tab) => set({ mobileTab: tab }),
      
      rightPanel: "computer",
      setRightPanel: (panel) => set({ rightPanel: panel }),
      
      codeStreaming: initialCodeStreamingState,
      setCodeStreaming: (state) =>
        set((prev) => ({
          codeStreaming: { ...prev.codeStreaming, ...state },
        })),
      resetCodeStreaming: () =>
        set({ codeStreaming: initialCodeStreamingState }),
      appendStreamingCode: (content) =>
        set((state) => ({
          codeStreaming: {
            ...state.codeStreaming,
            content: state.codeStreaming.content + content,
          },
        })),
    }),
    {
      name: "anygent-storage",
      partialize: (state) => ({
        apiKey: state.apiKey,
        e2bApiKey: state.e2bApiKey,
        selectedModel: state.selectedModel,
      }),
    }
  )
);