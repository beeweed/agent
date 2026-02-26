export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  iteration?: number;
}

export interface FileCard {
  id: string;
  filePath: string;
  status: "writing" | "created" | "error";
  description?: string;
}

export interface ThoughtBlock {
  id: string;
  content: string;
  iteration: number;
  timestamp: Date;
}

export interface ToolCall {
  id: string;
  toolName: string;
  arguments: Record<string, unknown>;
  result?: ToolResult;
  status: "pending" | "running" | "success" | "error";
  iteration: number;
}

export interface ToolResult {
  success: boolean;
  message?: string;
  error?: string;
  file_path?: string;
}

export interface FileNode {
  name: string;
  type: "file" | "folder";
  path: string;
  children?: FileNode[];
}

export interface AgentEvent {
  type: 
    | "iteration_start"
    | "iteration"
    | "thought"
    | "tool_call"
    | "tool_result"
    | "tool_error"
    | "complete"
    | "max_iterations_reached"
    | "error"
    | "stream_end"
    | "code_stream_start"
    | "code_stream_chunk"
    | "code_stream_end";
  content?: string;
  error?: string;
  iteration?: number;
  max_iterations?: number;
  tool_name?: string;
  tool_id?: string;
  arguments?: Record<string, unknown>;
  result?: ToolResult;
  total_iterations?: number;
  message?: string;
  chunk?: string;
  file_path?: string;
}

export interface Model {
  id: string;
  name: string;
  context_length: number;
  description?: string;
}

export interface FileInContext {
  path: string;
  name: string;
  extension: string;
  type: string;
}

export interface MemoryStats {
  total_messages: number;
  tool_calls: number;
  files_created: number;
  files_in_context: FileInContext[];
  file_types: Record<string, number>;
}

export interface Memory {
  session_id: string;
  current_iteration: number;
  max_iterations: number;
  is_running: boolean;
  messages: Array<Record<string, unknown>>;
  stats: MemoryStats;
}

export interface ChatEntry {
  id: string;
  type: "user" | "assistant" | "thought" | "file_card" | "tool_call";
  content?: string;
  filePath?: string;
  fileStatus?: "writing" | "created" | "error";
  iteration?: number;
  toolName?: string;
  arguments?: Record<string, unknown>;
  result?: ToolResult;
  timestamp: Date;
}