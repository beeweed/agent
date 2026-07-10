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

export interface ReadFileResult {
  success: boolean;
  content?: string;
  raw_content?: string;
  file_path?: string;
  file_name?: string;
  file_extension?: string;
  file_size?: number;
  total_lines?: number;
  lines_read?: number;
  truncated?: boolean;
  message?: string;
  error?: string;
}

export interface ReplaceInFileResult {
  success: boolean;
  message?: string;
  file_path?: string;
  old_string?: string;
  new_string?: string;
  occurrences?: number;
  new_content?: string;
  error?: string;
}

export interface ShallToolResult {
  success: boolean;
  session_name: string;
  command: string;
  wait_for_output: boolean;
  output: string;
  exit_code?: number | null;
  timed_out: boolean;
  started: boolean;
  pid?: number | null;
  background_pid?: number | null;
  background_log_path?: string;
  sandbox_id?: string | null;
}

export interface SandboxStatusResponse {
  session_id: string;
  provider: string;
  sandbox_id?: string | null;
  status: "idle" | "creating" | "ready" | "error" | "paused";
  template_id?: string | null;
  root_path?: string;
  last_error?: string | null;
  created_at?: string | null;
  updated_at?: string;
}

export interface AgentEvent {
  type:
    | "iteration_start"
    | "iteration"
    | "thought"
    | "thought_stream_start"
    | "thought_stream_chunk"
    | "thought_stream_end"
    | "tool_call"
    | "tool_result"
    | "tool_error"
    | "complete"
    | "max_iterations_reached"
    | "error"
    | "stream_end"
    | "code_stream_start"
    | "code_stream_chunk"
    | "code_stream_end"
    | "read_file_start"
    | "read_file_end"
    | "replace_in_file_start"
    | "replace_in_file_end"
    | "shall_tool_start"
    | "shall_tool_end"
    | "sandbox_creation_start"
    | "sandbox_creation_log"
    | "sandbox_creation_end"
    | "sandbox_error";
  content?: string;
  error?: string;
  iteration?: number;
  max_iterations?: number;
  tool_name?: string;
  tool_id?: string;
  arguments?: Record<string, unknown>;
  result?: ToolResult | ReadFileResult | ReplaceInFileResult | ShallToolResult;
  total_iterations?: number;
  message?: string;
  chunk?: string;
  file_path?: string;
  old_string?: string;
  new_string?: string;
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
  type: "user" | "assistant" | "thought" | "file_card" | "tool_call" | "read_file_card" | "replace_in_file_card" | "shall_tool_card";
  content?: string;
  filePath?: string;
  fileStatus?: "writing" | "created" | "error" | "reading" | "read" | "replacing" | "replaced";
  iteration?: number;
  toolName?: string;
  arguments?: Record<string, unknown>;
  result?: ToolResult;
  readResult?: ReadFileResult;
  replaceResult?: ReplaceInFileResult;
  shellResult?: ShallToolResult;
  shellStatus?: "running" | "completed" | "error";
  sessionName?: string;
  command?: string;
  waitForOutput?: boolean;
  timestamp: Date;
  isStreaming?: boolean;
  oldString?: string;
  newString?: string;
}