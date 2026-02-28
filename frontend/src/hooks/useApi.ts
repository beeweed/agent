import { useCallback } from "react";
import { useStore } from "@/store/useStore";
import type { AgentEvent, FileNode, Model, Memory } from "@/types";

const getApiBase = () => {
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    if (hostname.includes("e2b.app")) {
      // Handle various frontend ports (3000, 5173, etc.) by replacing with 8000
      return window.location.origin.replace(/\d+-/, "8000-");
    }
  }
  return "http://localhost:8000";
};

const API_BASE = getApiBase();

export function useApi() {
  const { apiKey, e2bApiKey, selectedModel, setModels, setModelsLoading, setFileTree, setMemory } = useStore();

  const fetchModels = useCallback(async () => {
    if (!apiKey) return;
    
    setModelsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/models`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: apiKey }),
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
  }, [apiKey, setModels, setModelsLoading]);

  const sendMessage = useCallback(
    async (message: string, onEvent: (event: AgentEvent) => void) => {
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          api_key: apiKey,
          model: selectedModel,
          e2b_api_key: e2bApiKey,
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
    [apiKey, e2bApiKey, selectedModel]
  );

  const fetchFileTree = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/files`);
      const data = (await response.json()) as FileNode;
      setFileTree(data);
      return data;
    } catch (error) {
      console.error("Failed to fetch file tree:", error);
      return null;
    }
  }, [setFileTree]);

  const refreshFileTree = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/files/refresh`, {
        method: "POST",
      });
      const data = (await response.json()) as FileNode;
      setFileTree(data);
      return data;
    } catch (error) {
      console.error("Failed to refresh file tree:", error);
      return null;
    }
  }, [setFileTree]);

  const readFile = useCallback(async (filePath: string): Promise<string> => {
    try {
      // Ensure path starts with /home/user/ for E2B sandbox
      let adjustedPath = filePath;
      if (!filePath.startsWith("/home/user/")) {
        adjustedPath = `/home/user${filePath}`;
      }
      
      const response = await fetch(`${API_BASE}/api/files/read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_path: adjustedPath }),
      });
      const data = await response.json();
      return data.content || "";
    } catch (error) {
      console.error("Failed to read file:", error);
      return "";
    }
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
      await fetchFileTree();
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

  const getSandboxStatus = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/sandbox/status`);
      return await response.json();
    } catch (error) {
      console.error("Failed to get sandbox status:", error);
      return null;
    }
  }, []);

  return {
    fetchModels,
    sendMessage,
    fetchFileTree,
    refreshFileTree,
    readFile,
    fetchMemory,
    resetChat,
    stopAgent,
    getSandboxStatus,
  };
}