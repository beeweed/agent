import { create } from "zustand";

export interface TerminalTab {
  id: string;
  name: string;
  connected: boolean;
  pid: number | null;
}

interface TerminalStoreState {
  tabs: TerminalTab[];
  activeTabId: string;
  nextIndex: number;

  addTab: () => string;
  removeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  renameTab: (id: string, name: string) => void;
  setTabConnected: (id: string, connected: boolean) => void;
  setTabPid: (id: string, pid: number | null) => void;
}

const INITIAL_TAB: TerminalTab = {
  id: "term_0",
  name: "Terminal 1",
  connected: false,
  pid: null,
};

export const useTerminalStore = create<TerminalStoreState>((set, get) => ({
  tabs: [INITIAL_TAB],
  activeTabId: INITIAL_TAB.id,
  nextIndex: 1,

  addTab: () => {
    const { nextIndex, tabs } = get();
    const id = `term_${nextIndex}`;
    const newTab: TerminalTab = {
      id,
      name: `Terminal ${tabs.length + 1}`,
      connected: false,
      pid: null,
    };
    set({
      tabs: [...tabs, newTab],
      activeTabId: id,
      nextIndex: nextIndex + 1,
    });
    return id;
  },

  removeTab: (id: string) => {
    const { tabs, activeTabId } = get();
    if (tabs.length <= 1) return;

    const idx = tabs.findIndex((t) => t.id === id);
    const filtered = tabs.filter((t) => t.id !== id);

    let newActive = activeTabId;
    if (activeTabId === id) {
      const nextIdx = Math.min(idx, filtered.length - 1);
      newActive = filtered[nextIdx].id;
    }

    set({ tabs: filtered, activeTabId: newActive });
  },

  setActiveTab: (id: string) => {
    set({ activeTabId: id });
  },

  renameTab: (id: string, name: string) => {
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === id ? { ...t, name } : t)),
    }));
  },

  setTabConnected: (id: string, connected: boolean) => {
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === id ? { ...t, connected } : t)),
    }));
  },

  setTabPid: (id: string, pid: number | null) => {
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === id ? { ...t, pid } : t)),
    }));
  },
}));