import { useCallback } from "react";
import { useStore } from "@/store/useStore";
import type { AgentEvent, FileNode, Model, Memory } from "@/types";

const getApiBase = () => {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl) return envUrl.replace(/\/$/, "");

  return "";
};

const API_BASE = getApiBase();

function buildFileTree(files: Record<string, string>): FileNode {
  const root: FileNode = {
    name: "project",
    type: "folder",
    path: "/",
    children: [],
  };

  const pathMap: Record<string, FileNode> = { "/": root };

  const sortedPaths = Object.keys(files).sort();
  for (const filePath of sortedPaths) {
    const parts = filePath.replace(/^\//, "").split("/");
    let current = root;
    let currentPath = "/";

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const childPath = currentPath === "/" ? "/" + part : currentPath + "/" + part;

      if (!pathMap[childPath]) {
        const node: FileNode = {
          name: part,
          type: isLast ? "file" : "folder",
          path: childPath,
        };
        if (!isLast) {
          node.children = [];
        }
        pathMap[childPath] = node;

        if (current.children) {
          const exists = current.children.some((c) => c.path === childPath);
          if (!exists) {
            current.children.push(node);
          }
        }
      }

      current = pathMap[childPath];
      currentPath = childPath;
    }
  }

  const sortChildren = (node: FileNode) => {
    if (node.children) {
      node.children.sort((a, b) => {
        if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      node.children.forEach(sortChildren);
    }
  };
  sortChildren(root);

  return root;
}

export function useApi() {
  const {
    provider,
    apiKey,
    groqApiKey,
    fireworksApiKey,
    selectedModel,
    setModels,
    setModelsLoading,
    setFileTree,
    setMemory,
  } = useStore();

  const getActiveApiKey = useCallback(() => {
    if (provider === "groq") return groqApiKey;
    if (provider === "fireworks") return fireworksApiKey;
    return apiKey;
  }, [provider, apiKey, groqApiKey, fireworksApiKey]);

  const fetchModels = useCallback(async () => {
    const activeKey = provider === "groq" ? groqApiKey : provider === "fireworks" ? fireworksApiKey : apiKey;
    if (!activeKey) return;
    
    setModelsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/models`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: activeKey,
          provider: provider,
        }),
      });
      
      const data = await response.json();
      if (data.success) {
        setModels(data.models as Model[]);
      }
    } catch (error) {
      console.error("Failed to fetch models:", error);
    } finally {
      setModelsLoading(false);
    }
  }, [provider, apiKey, groqApiKey, fireworksApiKey, setModels, setModelsLoading]);

  const sendMessage = useCallback(
    async (message: string, onEvent: (event: AgentEvent) => void) => {
      const activeKey = provider === "groq" ? groqApiKey : provider === "fireworks" ? fireworksApiKey : apiKey;

      const response = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          api_key: activeKey,
          model: selectedModel,
          provider: provider,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6)) as AgentEvent;
              onEvent(data);
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
    },
    [provider, apiKey, groqApiKey, fireworksApiKey, selectedModel]
  );

  const fetchFileTree = useCallback(() => {
    const tree = buildFileTree(useStore.getState().localFiles);
    setFileTree(tree);
    return tree;
  }, [setFileTree]);

  const refreshFileTree = useCallback(() => {
    return fetchFileTree();
  }, [fetchFileTree]);

  const readFile = useCallback(async (filePath: string): Promise<string> => {
    const files = useStore.getState().localFiles;
    return files[filePath] || "";
  }, []);

  const fetchMemory = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/memory`);
      const data = (await response.json()) as Memory;
      setMemory(data);
      return data;
    } catch (error) {
      console.error("Failed to fetch memory:", error);
      return null;
    }
  }, [setMemory]);

  const resetChat = useCallback(async () => {
    try {
      await fetch(`${API_BASE}/api/chat/reset`, { method: "POST" });
      useStore.getState().clearLocalFiles();
      fetchFileTree();
      await fetchMemory();
    } catch (error) {
      console.error("Failed to reset chat:", error);
    }
  }, [fetchFileTree, fetchMemory]);

  const stopAgent = useCallback(async () => {
    try {
      await fetch(`${API_BASE}/api/chat/stop`, { method: "POST" });
    } catch (error) {
      console.error("Failed to stop agent:", error);
    }
  }, []);

  return {
    getActiveApiKey,
    fetchModels,
    sendMessage,
    fetchFileTree,
    refreshFileTree,
    readFile,
    fetchMemory,
    resetChat,
    stopAgent,
  };
}
