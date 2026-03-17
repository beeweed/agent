const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

export interface AgentEvent {
  type: "thinking" | "tool_call" | "tool_result" | "text_delta" | "text_complete" | "iteration" | "error" | "done" | "status";
  content: string;
  tool_name: string;
  tool_args: Record<string, unknown>;
  tool_result: string;
  iteration: number;
  is_error: boolean;
  file_path: string;
}

export interface FileNode {
  name: string;
  path: string;
  is_dir: boolean;
  children?: FileNode[];
}

export interface ModelInfo {
  id: string;
  name: string;
  context_length: number;
  pricing: Record<string, string>;
}

export async function fetchFileTree(): Promise<FileNode[]> {
  const res = await fetch(`${API_BASE}/api/files`);
  const data = await res.json();
  return data.files;
}

export async function readFile(path: string): Promise<string> {
  const res = await fetch(`${API_BASE}/api/files/read?path=${encodeURIComponent(path)}`);
  if (!res.ok) throw new Error("File not found");
  const data = await res.json();
  return data.content;
}

export async function clearFiles(): Promise<void> {
  await fetch(`${API_BASE}/api/files/clear`, { method: "POST" });
}

export async function fetchModels(apiKey: string): Promise<ModelInfo[]> {
  const res = await fetch(`${API_BASE}/api/models`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: apiKey }),
  });
  if (!res.ok) throw new Error("Failed to fetch models");
  const data = await res.json();
  return data.models;
}

export function runAgent(
  message: string,
  apiKey: string,
  model: string,
  sessionId: string | null,
  onEvent: (event: AgentEvent) => void,
  onDone: () => void,
  onError: (error: string) => void,
): AbortController {
  const controller = new AbortController();

  fetch(`${API_BASE}/api/agent/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      api_key: apiKey,
      model,
      session_id: sessionId,
      max_iterations: 5000,
    }),
    signal: controller.signal,
  })
    .then(async (response) => {
      if (!response.ok) {
        const err = await response.text();
        onError(`Server error: ${err}`);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        onError("No response stream");
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith("data: ")) {
            try {
              const event: AgentEvent = JSON.parse(trimmed.slice(6));
              onEvent(event);
              if (event.type === "done") {
                onDone();
                return;
              }
            } catch {
              // skip malformed
            }
          }
        }
      }
      onDone();
    })
    .catch((err) => {
      if (err.name !== "AbortError") {
        onError(err.message);
      }
    });

  return controller;
}