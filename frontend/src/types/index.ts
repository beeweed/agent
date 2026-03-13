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

export interface ShellResult {
  success: boolean;
  output?: string;
  exit_code?: number;
  session_name?: string;
  command?: string;
  error?: string;
  urls?: string[];  // Extracted HTTP/HTTPS URLs (localhost, IPs, domains, etc.)
  hasPortConflict?: boolean;  // True if a real port conflict was detected
}

export interface ReplaceInFileResult {
  success: boolean;
  message?: string;
  file_path?: string;
  old_string?: string;
  new_string?: string;
  occurrences?: number;
  error?: string;
}

export interface InsertLineResult {
  success: boolean;
  message?: string;
  file_path?: string;
  insert_line?: number;
  new_str?: string;
  lines_inserted?: number;
  error?: string;
}

export interface DeleteLinesResult {
  success: boolean;
  message?: string;
  file_path?: string;
  deleted_lines?: string;
  start_line?: number;
  end_line?: number;
  lines_deleted?: number;
  error?: string;
}

export interface DeleteStrFromFileResult {
  success: boolean;
  message?: string;
  file_path?: string;
  target_str?: string;
  error?: string;
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
    | "sandbox_creating"
    | "sandbox_ready"
    | "sandbox_error"
    | "shell_exec_start"
    | "shell_exec_end"
    | "replace_in_file_start"
    | "replace_in_file_end"
    | "insert_line_start"
    | "insert_line_end"
    | "delete_lines_start"
    | "delete_lines_end"
    | "delete_str_from_file_start"
    | "delete_str_from_file_end";
  content?: string;
  error?: string;
  iteration?: number;
  max_iterations?: number;
  tool_name?: string;
  tool_id?: string;
  arguments?: Record<string, unknown>;
  result?: ToolResult | ReadFileResult | ShellResult | ReplaceInFileResult | InsertLineResult | DeleteLinesResult | DeleteStrFromFileResult;
  total_iterations?: number;
  message?: string;
  chunk?: string;
  file_path?: string;
  session_name?: string;
  command?: string;
  command_id?: string;  // Used to coordinate shell output between frontend and backend
  old_string?: string;  // For replace_in_file tool
  new_string?: string;  // For replace_in_file tool
  insert_line?: number;  // For insert_line tool
  new_str?: string;  // For insert_line tool
  target_line?: number | string;  // For delete_lines_from_file tool
  target_str?: string;  // For delete_str_from_file tool
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
  type: "user" | "assistant" | "thought" | "file_card" | "tool_call" | "read_file_card" | "sandbox_status" | "shell_card" | "replace_in_file_card" | "insert_line_card" | "delete_lines_card" | "delete_str_from_file_card";
  content?: string;
  filePath?: string;
  fileStatus?: "writing" | "created" | "error" | "reading" | "read" | "replacing" | "replaced" | "inserting" | "inserted" | "deleting" | "deleted" | "deleting_str" | "deleted_str";
  iteration?: number;
  toolName?: string;
  arguments?: Record<string, unknown>;
  result?: ToolResult;
  readResult?: ReadFileResult;
  shellResult?: ShellResult;
  replaceResult?: ReplaceInFileResult;
  insertResult?: InsertLineResult;
  deleteResult?: DeleteLinesResult;
  deleteStrResult?: DeleteStrFromFileResult;
  shellCommand?: string;
  shellSessionName?: string;
  shellStatus?: "running" | "completed" | "error" | "server_running";
  shellCommandId?: string;  // Used to POST output back to backend
  timestamp: Date;
  isStreaming?: boolean;
  sandboxStatus?: "creating" | "ready" | "error";
  oldString?: string;  // For replace_in_file tool
  newString?: string;  // For replace_in_file tool
  insertLine?: number;  // For insert_line tool
  newStr?: string;  // For insert_line tool
  targetLine?: number | string;  // For delete_lines_from_file tool
  deletedLines?: string;  // For delete_lines_from_file tool
  targetStr?: string;  // For delete_str_from_file tool
}