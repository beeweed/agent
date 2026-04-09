import { create } from "zustand";

export interface TerminalTab {
  id: string;
  name: string;
  connected: boolean;
  pid: number | null;
  sessionName?: string;
}

interface TerminalStoreState {
  tabs: TerminalTab[];
  activeTabId: string;
  nextIndex: number;
  sessionNameToTabId: Record<string, string>;

  addTab: () => string;
  removeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  renameTab: (id: string, name: string) => void;
  setTabConnected: (id: string, connected: boolean) => void;
  setTabPid: (id: string, pid: number | null) => void;
  findOrCreateTabForSession: (sessionName: string) => { tabId: string; isNew: boolean };
  getTabIdForSession: (sessionName: string) => string | null;
}

export const useTerminalStore = create<TerminalStoreState>((set, get) => ({
  tabs: [],
  activeTabId: "",
  nextIndex: 0,
  sessionNameToTabId: {},

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
    if (tabs.length === 0) return;

    const idx = tabs.findIndex((t) => t.id === id);
    const filtered = tabs.filter((t) => t.id !== id);

    if (filtered.length === 0) {
      set({ tabs: [], activeTabId: "" });
      return;
    }

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

  getTabIdForSession: (sessionName: string) => {
    const { sessionNameToTabId } = get();
    return sessionNameToTabId[sessionName] ?? null;
  },

  findOrCreateTabForSession: (sessionName: string) => {
    const { sessionNameToTabId, tabs, nextIndex } = get();

    const existingTabId = sessionNameToTabId[sessionName];
    if (existingTabId) {
      const tabExists = tabs.some((t) => t.id === existingTabId);
      if (tabExists) {
        set({ activeTabId: existingTabId });
        return { tabId: existingTabId, isNew: false };
      }
    }

    const assignedTabIds = new Set(Object.values(sessionNameToTabId));
    const unassignedTab = tabs.find((t) => !t.sessionName && !assignedTabIds.has(t.id));

    if (unassignedTab) {
      const updatedTabs = tabs.map((t) =>
        t.id === unassignedTab.id ? { ...t, name: sessionName, sessionName } : t
      );
      set({
        tabs: updatedTabs,
        activeTabId: unassignedTab.id,
        sessionNameToTabId: { ...sessionNameToTabId, [sessionName]: unassignedTab.id },
      });
      return { tabId: unassignedTab.id, isNew: false };
    }

    const id = `term_${nextIndex}`;
    const newTab: TerminalTab = {
      id,
      name: sessionName,
      connected: false,
      pid: null,
      sessionName,
    };
    set({
      tabs: [...tabs, newTab],
      activeTabId: id,
      nextIndex: nextIndex + 1,
      sessionNameToTabId: { ...sessionNameToTabId, [sessionName]: id },
    });
    return { tabId: id, isNew: true };
  },
}));