import { useCallback } from "react";
import { useStore } from "@/store/useStore";
import type { AgentEvent, FileNode, Memory, Model, SandboxStatusResponse } from "@/types";

const getApiBase = () => {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl) return envUrl.replace(/\/$/, "");
  return "";
};

const API_BASE = getApiBase();
const DEFAULT_SESSION_ID = "default";

const EMPTY_FILE_TREE: FileNode = {
  name: "user",
  type: "folder",
  path: "/home/user",
  children: [],
};

export function useApi() {
  const {
    provider,
    apiKey,
    groqApiKey,
    fireworksApiKey,
    novitaApiKey,
    novitaTemplateId,
    setModels,
    setModelsLoading,
    setFileTree,
    setMemory,
    setLocalFiles,
    updateLocalFile,
  } = useStore();

  const getActiveApiKey = useCallback(() => {
    if (provider === "groq") return groqApiKey;
    if (provider === "fireworks") return fireworksApiKey;
    return apiKey;
  }, [provider, apiKey, groqApiKey, fireworksApiKey]);

  const fetchModels = useCallback(async () => {
    const activeKey = getActiveApiKey();
    if (!activeKey) return;

    setModelsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/models`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: activeKey,
          provider,
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
  }, [getActiveApiKey, provider, setModels, setModelsLoading]);

  const sendMessage = useCallback(
    async (message: string, onEvent: (event: AgentEvent) => void) => {
      const activeKey = getActiveApiKey();

      const response = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          api_key: activeKey,
          model: useStore.getState().selectedModel,
          provider,
          session_id: DEFAULT_SESSION_ID,
          novita_api_key: novitaApiKey,
          novita_template_id: novitaTemplateId || undefined,
        }),
      });

      if (!response.ok) {
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorMessage;
        } catch {
          // ignore json parsing failure
        }
        throw new Error(errorMessage);
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
    [getActiveApiKey, provider, novitaApiKey, novitaTemplateId]
  );

  const fetchSandboxStatus = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/sandbox/status?session_id=${DEFAULT_SESSION_ID}`);
      if (!response.ok) return null;
      return (await response.json()) as SandboxStatusResponse;
    } catch (error) {
      console.error("Failed to fetch sandbox status:", error);
      return null;
    }
  }, []);

  const fetchFileTree = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/files/tree?session_id=${DEFAULT_SESSION_ID}`);
      if (!response.ok) {
        setFileTree(EMPTY_FILE_TREE);
        return EMPTY_FILE_TREE;
      }
      const data = (await response.json()) as FileNode;
      setFileTree(data);
      return data;
    } catch (error) {
      console.error("Failed to fetch file tree:", error);
      setFileTree(EMPTY_FILE_TREE);
      return EMPTY_FILE_TREE;
    }
  }, [setFileTree]);

  const refreshFileTree = useCallback(async () => {
    return fetchFileTree();
  }, [fetchFileTree]);

  const readFile = useCallback(async (filePath: string): Promise<string> => {
    const cached = useStore.getState().localFiles[filePath];
    if (cached) return cached;

    try {
      const params = new URLSearchParams({
        session_id: DEFAULT_SESSION_ID,
        file_path: filePath,
      });
      const response = await fetch(`${API_BASE}/api/files/content?${params.toString()}`);
      if (!response.ok) {
        return "";
      }
      const data = (await response.json()) as { raw_content?: string };
      const content = data.raw_content || "";
      updateLocalFile(filePath, content);
      return content;
    } catch (error) {
      console.error("Failed to read file:", error);
      return "";
    }
  }, [updateLocalFile]);

  const fetchMemory = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/memory?session_id=${DEFAULT_SESSION_ID}`);
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
      await fetch(`${API_BASE}/api/chat/reset?session_id=${DEFAULT_SESSION_ID}`, { method: "POST" });
      setLocalFiles({});
      setFileTree(EMPTY_FILE_TREE);
      await fetchMemory();
    } catch (error) {
      console.error("Failed to reset chat:", error);
    }
  }, [fetchMemory, setFileTree, setLocalFiles]);

  const stopAgent = useCallback(async () => {
    try {
      await fetch(`${API_BASE}/api/chat/stop?session_id=${DEFAULT_SESSION_ID}`, { method: "POST" });
    } catch (error) {
      console.error("Failed to stop agent:", error);
    }
  }, []);

  return {
    getActiveApiKey,
    fetchModels,
    sendMessage,
    fetchSandboxStatus,
    fetchFileTree,
    refreshFileTree,
    readFile,
    fetchMemory,
    resetChat,
    stopAgent,
  };
}