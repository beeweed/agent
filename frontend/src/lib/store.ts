import { useState, useCallback, useRef } from "react";
import type { AgentEvent, FileNode, ModelInfo } from "./api";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls: ToolCallInfo[];
  iteration: number;
  isStreaming: boolean;
  timestamp: number;
}

export interface ToolCallInfo {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result: string;
  status: "running" | "success" | "error";
  filePath: string;
}

export function useAgentStore() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentIteration, setCurrentIteration] = useState(0);
  const [files, setFiles] = useState<FileNode[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>("");
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("openrouter_api_key") || "");
  const [selectedModel, setSelectedModel] = useState(() => localStorage.getItem("selected_model") || "anthropic/claude-sonnet-4");
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const streamingTextRef = useRef<string>("");

  const saveApiKey = useCallback((key: string) => {
    setApiKey(key);
    localStorage.setItem("openrouter_api_key", key);
  }, []);

  const saveModel = useCallback((model: string) => {
    setSelectedModel(model);
    localStorage.setItem("selected_model", model);
  }, []);

  const addUserMessage = useCallback((content: string) => {
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      toolCalls: [],
      iteration: 0,
      isStreaming: false,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, msg]);
    return msg;
  }, []);

  const addAssistantMessage = useCallback(() => {
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      toolCalls: [],
      iteration: 0,
      isStreaming: true,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, msg]);
    streamingTextRef.current = "";
    return msg.id;
  }, []);

  const appendTextDelta = useCallback((msgId: string, delta: string) => {
    streamingTextRef.current += delta;
    const currentText = streamingTextRef.current;
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId ? { ...m, content: currentText } : m
      )
    );
  }, []);

  const finalizeMessage = useCallback((msgId: string, iteration: number) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId ? { ...m, isStreaming: false, iteration } : m
      )
    );
  }, []);

  const addToolCall = useCallback((msgId: string, tc: ToolCallInfo) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId
          ? { ...m, toolCalls: [...m.toolCalls, tc] }
          : m
      )
    );
  }, []);

  const updateToolCallStatus = useCallback(
    (msgId: string, toolId: string, status: "success" | "error", result: string) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? {
                ...m,
                toolCalls: m.toolCalls.map((tc) =>
                  tc.id === toolId ? { ...tc, status, result } : tc
                ),
              }
            : m
        )
      );
    },
    []
  );

  const reset = useCallback(() => {
    setMessages([]);
    setCurrentIteration(0);
    setSessionId(null);
    setIsRunning(false);
    setIsThinking(false);
    streamingTextRef.current = "";
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  const stopAgent = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setIsRunning(false);
    setIsThinking(false);
  }, []);

  return {
    messages,
    setMessages,
    isRunning,
    setIsRunning,
    currentIteration,
    setCurrentIteration,
    files,
    setFiles,
    selectedFile,
    setSelectedFile,
    fileContent,
    setFileContent,
    apiKey,
    saveApiKey,
    selectedModel,
    saveModel,
    models,
    setModels,
    sessionId,
    setSessionId,
    isThinking,
    setIsThinking,
    abortRef,
    streamingTextRef,
    addUserMessage,
    addAssistantMessage,
    appendTextDelta,
    finalizeMessage,
    addToolCall,
    updateToolCallStatus,
    reset,
    stopAgent,
  };
}