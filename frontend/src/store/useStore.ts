import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ChatEntry, FileNode, Model, Memory } from "@/types";

interface AppState {
  apiKey: string;
  setApiKey: (key: string) => void;
  
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
  
  mobileTab: "chat" | "files";
  setMobileTab: (tab: "chat" | "files") => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      apiKey: "",
      setApiKey: (key) => set({ apiKey: key }),
      
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
      clearChat: () => set({ chatEntries: [] }),
      
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
    }),
    {
      name: "vibe-coder-storage",
      partialize: (state) => ({
        apiKey: state.apiKey,
        selectedModel: state.selectedModel,
      }),
    }
  )
);