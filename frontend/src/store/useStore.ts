import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ChatEntry, FileNode, Model, Memory } from "@/types";

export interface CodeStreamingState {
  filePath: string;
  content: string;
  isStreaming: boolean;
  tool: string;
  action: string;
  isDiffView: boolean;
  oldString: string;
  newString: string;
}

export type Provider = "openrouter" | "groq" | "fireworks";
export type SandboxStatus = "idle" | "creating" | "ready" | "error";

interface AppState {
  provider: Provider;
  setProvider: (provider: Provider) => void;

  apiKey: string;
  setApiKey: (key: string) => void;

  groqApiKey: string;
  setGroqApiKey: (key: string) => void;

  fireworksApiKey: string;
  setFireworksApiKey: (key: string) => void;

  novitaApiKey: string;
  setNovitaApiKey: (key: string) => void;

  novitaTemplateId: string;
  setNovitaTemplateId: (templateId: string) => void;

  sandboxStatus: SandboxStatus;
  setSandboxStatus: (status: SandboxStatus) => void;

  sandboxMessage: string;
  setSandboxMessage: (message: string) => void;

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

  localFiles: Record<string, string>;
  setLocalFiles: (files: Record<string, string>) => void;
  updateLocalFile: (path: string, content: string) => void;
  removeLocalFile: (path: string) => void;
  clearLocalFiles: () => void;

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
  isDiffView: false,
  oldString: "",
  newString: "",
};

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      provider: "openrouter",
      setProvider: (provider) => set({ provider, models: [], selectedModel: "" }),

      apiKey: "",
      setApiKey: (key) => set({ apiKey: key }),

      groqApiKey: "",
      setGroqApiKey: (key) => set({ groqApiKey: key }),

      fireworksApiKey: "",
      setFireworksApiKey: (key) => set({ fireworksApiKey: key }),

      novitaApiKey: "",
      setNovitaApiKey: (key) => set({ novitaApiKey: key }),

      novitaTemplateId: "",
      setNovitaTemplateId: (templateId) => set({ novitaTemplateId: templateId }),

      sandboxStatus: "idle",
      setSandboxStatus: (status) => set({ sandboxStatus: status }),

      sandboxMessage: "",
      setSandboxMessage: (message) => set({ sandboxMessage: message }),

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

      localFiles: {},
      setLocalFiles: (files) => set({ localFiles: files }),
      updateLocalFile: (path, content) =>
        set((state) => ({
          localFiles: { ...state.localFiles, [path]: content },
        })),
      removeLocalFile: (path) =>
        set((state) => {
          const { [path]: _, ...rest } = state.localFiles;
          return { localFiles: rest };
        }),
      clearLocalFiles: () => set({ localFiles: {} }),

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
      resetCodeStreaming: () => set({ codeStreaming: initialCodeStreamingState }),
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
        provider: state.provider,
        apiKey: state.apiKey,
        groqApiKey: state.groqApiKey,
        fireworksApiKey: state.fireworksApiKey,
        novitaApiKey: state.novitaApiKey,
        novitaTemplateId: state.novitaTemplateId,
        selectedModel: state.selectedModel,
      }),
    }
  )
);