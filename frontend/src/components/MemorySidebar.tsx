import { useEffect, useMemo } from "react";
import { useStore } from "@/store/useStore";
import { useApi } from "@/hooks/useApi";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { FileInContext } from "@/types";

const FILE_TYPE_CONFIG: Record<string, { color: string; bgColor: string; icon: string }> = {
  python: { color: "text-yellow-400", bgColor: "bg-yellow-500/20", icon: "🐍" },
  javascript: { color: "text-yellow-300", bgColor: "bg-yellow-400/20", icon: "JS" },
  typescript: { color: "text-blue-400", bgColor: "bg-blue-500/20", icon: "TS" },
  html: { color: "text-orange-400", bgColor: "bg-orange-500/20", icon: "🌐" },
  css: { color: "text-pink-400", bgColor: "bg-pink-500/20", icon: "🎨" },
  json: { color: "text-green-400", bgColor: "bg-green-500/20", icon: "{}" },
  config: { color: "text-gray-400", bgColor: "bg-gray-500/20", icon: "⚙️" },
  markdown: { color: "text-slate-300", bgColor: "bg-slate-500/20", icon: "📝" },
  text: { color: "text-slate-400", bgColor: "bg-slate-600/20", icon: "📄" },
  database: { color: "text-cyan-400", bgColor: "bg-cyan-500/20", icon: "🗃️" },
  shell: { color: "text-lime-400", bgColor: "bg-lime-500/20", icon: "💻" },
  rust: { color: "text-orange-500", bgColor: "bg-orange-600/20", icon: "🦀" },
  go: { color: "text-cyan-300", bgColor: "bg-cyan-400/20", icon: "Go" },
  java: { color: "text-red-400", bgColor: "bg-red-500/20", icon: "☕" },
  kotlin: { color: "text-purple-400", bgColor: "bg-purple-500/20", icon: "K" },
  swift: { color: "text-orange-400", bgColor: "bg-orange-500/20", icon: "🔶" },
  c: { color: "text-blue-300", bgColor: "bg-blue-400/20", icon: "C" },
  cpp: { color: "text-blue-500", bgColor: "bg-blue-600/20", icon: "C+" },
  ruby: { color: "text-red-400", bgColor: "bg-red-500/20", icon: "💎" },
  php: { color: "text-indigo-400", bgColor: "bg-indigo-500/20", icon: "🐘" },
  vue: { color: "text-emerald-400", bgColor: "bg-emerald-500/20", icon: "V" },
  svelte: { color: "text-orange-500", bgColor: "bg-orange-600/20", icon: "S" },
  astro: { color: "text-purple-400", bgColor: "bg-purple-500/20", icon: "🚀" },
  image: { color: "text-rose-400", bgColor: "bg-rose-500/20", icon: "🖼️" },
  other: { color: "text-gray-400", bgColor: "bg-gray-600/20", icon: "📁" },
};

const getFileTypeInfo = (type: string) => {
  return FILE_TYPE_CONFIG[type] || FILE_TYPE_CONFIG.other;
};

export function MemorySidebar() {
  const { isMemoryOpen, setIsMemoryOpen, memory, currentIteration, maxIterations } = useStore();
  const { fetchMemory } = useApi();

  const stats = memory?.stats || { total_messages: 0, tool_calls: 0, files_created: 0, files_in_context: [], file_types: {} };
  const messages = memory?.messages || [];
  const filesInContext = stats.files_in_context || [];

  const sortedFileTypes = useMemo(() => {
    const ft = stats.file_types || {};
    return Object.entries(ft).sort((a, b) => b[1] - a[1]);
  }, [stats.file_types]);

  const totalFiles = useMemo(() => {
    const ft = stats.file_types || {};
    return Object.values(ft).reduce((sum, count) => sum + count, 0);
  }, [stats.file_types]);

  useEffect(() => {
    if (isMemoryOpen) {
      fetchMemory();
    }
  }, [isMemoryOpen, fetchMemory]);

  if (!isMemoryOpen) return null;

  const getTimelineEntries = () => {
    const entries: Array<{
      id: string;
      type: "thought" | "tool_call" | "tool_result" | "user";
      content: string;
      toolName?: string;
      status?: "success" | "error";
      timestamp: string;
    }> = [];

    messages.forEach((msg, i) => {
      const role = msg.role as string;
      
      if (role === "user") {
        entries.push({
          id: `user-${i}`,
          type: "user",
          content: (msg.content as string) || "",
          timestamp: "User message",
        });
      } else if (role === "assistant") {
        if (msg.content) {
          entries.push({
            id: `thought-${i}`,
            type: "thought",
            content: (msg.content as string).slice(0, 100) + "...",
            timestamp: "Reasoning",
          });
        }
        if (msg.tool_calls) {
          const toolCalls = msg.tool_calls as Array<{ function: { name: string } }>;
          toolCalls.forEach((tc, j) => {
            entries.push({
              id: `tool-call-${i}-${j}`,
              type: "tool_call",
              content: tc.function.name,
              toolName: tc.function.name,
              timestamp: "Tool call",
            });
          });
        }
      } else if (role === "tool") {
        try {
          const result = JSON.parse((msg.content as string) || "{}");
          entries.push({
            id: `tool-result-${i}`,
            type: "tool_result",
            content: result.file_path || (msg.name as string),
            toolName: msg.name as string,
            status: result.success ? "success" : "error",
            timestamp: "Tool result",
          });
        } catch {
          entries.push({
            id: `tool-result-${i}`,
            type: "tool_result",
            content: msg.name as string,
            toolName: msg.name as string,
            status: "success",
            timestamp: "Tool result",
          });
        }
      }
    });

    return entries.reverse().slice(0, 20);
  };

  return (
    <div data-design-id="memory-sidebar" className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        onClick={() => setIsMemoryOpen(false)}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />

      {/* Sidebar Panel */}
      <div className="absolute right-0 top-0 h-full w-full sm:w-[420px] md:w-[480px] lg:w-[520px] bg-card shadow-2xl animate-slide-in-right overflow-hidden flex flex-col border-l border-border">
        {/* Header */}
        <div className="bg-background px-4 sm:px-6 pt-4 sm:pt-6 pb-4 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20">
                <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div>
                <h2 data-design-id="memory-title" className="text-lg font-semibold text-foreground">Agent Memory</h2>
                <p className="text-xs text-muted-foreground">Session context & history</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchMemory()}
                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              <button
                onClick={() => setIsMemoryOpen(false)}
                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 gap-3">
            <div data-design-id="stat-iterations" className="p-3 sm:p-4 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
              <div className="flex items-center gap-2 mb-1">
                <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span className="text-[10px] font-medium text-primary uppercase tracking-wide">Iterations</span>
              </div>
              <div className="text-2xl font-bold text-foreground">{currentIteration}</div>
            </div>

            <div data-design-id="stat-files" className="p-3 sm:p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border border-emerald-500/20">
              <div className="flex items-center gap-2 mb-1">
                <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="text-[10px] font-medium text-emerald-400 uppercase tracking-wide">Files</span>
              </div>
              <div className="text-2xl font-bold text-foreground">{stats.files_created}</div>
            </div>

            <div data-design-id="stat-tool-calls" className="p-3 sm:p-4 rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20">
              <div className="flex items-center gap-2 mb-1">
                <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                <span className="text-[10px] font-medium text-blue-400 uppercase tracking-wide">Tool Calls</span>
              </div>
              <div className="text-2xl font-bold text-foreground">{stats.tool_calls}</div>
            </div>

            <div data-design-id="stat-context" className="p-3 sm:p-4 rounded-xl bg-gradient-to-br from-amber-500/10 to-amber-600/5 border border-amber-500/20">
              <div className="flex items-center gap-2 mb-1">
                <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <span className="text-[10px] font-medium text-amber-400 uppercase tracking-wide">Context</span>
              </div>
              <div className="text-2xl font-bold text-foreground">{stats.total_messages}</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="timeline" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="flex border-b border-border/30 px-4 bg-transparent rounded-none h-auto">
            <TabsTrigger
              value="timeline"
              className="flex items-center gap-2 px-4 py-3 text-sm font-medium data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none bg-transparent"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Timeline
            </TabsTrigger>
            <TabsTrigger
              value="files"
              className="flex items-center gap-2 px-4 py-3 text-sm font-medium data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none bg-transparent"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              Files
            </TabsTrigger>
            <TabsTrigger
              value="context"
              className="flex items-center gap-2 px-4 py-3 text-sm font-medium data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none bg-transparent"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Overview
            </TabsTrigger>
          </TabsList>

          <TabsContent value="timeline" className="flex-1 overflow-hidden mt-0">
            <ScrollArea className="h-full p-4">
              <div className="space-y-2">
                {getTimelineEntries().map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-start gap-3 p-3 rounded-xl bg-muted border border-border"
                  >
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        entry.type === "thought" ? "bg-purple-500/20" : ""
                      } ${entry.type === "tool_call" ? "bg-blue-500/20" : ""} ${
                        entry.type === "tool_result" && entry.status === "success" ? "bg-green-500/20" : ""
                      } ${entry.type === "tool_result" && entry.status === "error" ? "bg-red-500/20" : ""} ${
                        entry.type === "user" ? "bg-primary/20" : ""
                      }`}
                    >
                      {entry.type === "thought" && (
                        <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                      )}
                      {entry.type === "tool_call" && (
                        <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                        </svg>
                      )}
                      {entry.type === "tool_result" && entry.status === "success" && (
                        <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                      {entry.type === "tool_result" && entry.status === "error" && (
                        <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                      {entry.type === "user" && (
                        <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-foreground">
                          {entry.type === "thought" ? "Thinking" : entry.type === "tool_call" ? entry.toolName : entry.type === "tool_result" ? entry.toolName : "User"}
                        </span>
                        {entry.status && (
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded ${
                              entry.status === "success" ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
                            }`}
                          >
                            {entry.status}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{entry.content}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground flex-shrink-0">{entry.timestamp}</span>
                  </div>
                ))}
                {getTimelineEntries().length === 0 && (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    No activity yet. Start a conversation!
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="files" data-design-id="files-tab-content" className="flex-1 overflow-hidden mt-0">
            <ScrollArea className="h-full p-4">
              {/* File Type Distribution */}
              <div data-design-id="file-type-distribution" className="rounded-xl bg-muted border border-border overflow-hidden mb-4">
                <div className="px-4 py-3 bg-card border-b border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      <span className="text-sm font-medium text-foreground">File Types in Context</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{totalFiles} files</span>
                  </div>
                </div>
                <div className="p-4">
                  {sortedFileTypes.length > 0 ? (
                    <div className="space-y-3">
                      {sortedFileTypes.map(([type, count]) => {
                        const info = getFileTypeInfo(type);
                        const percentage = totalFiles > 0 ? (count / totalFiles) * 100 : 0;
                        return (
                          <div key={type} data-design-id={`file-type-${type}`} className="group">
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-2">
                                <span className={`w-7 h-7 rounded-lg ${info.bgColor} flex items-center justify-center text-xs font-medium ${info.color}`}>
                                  {info.icon}
                                </span>
                                <span className="text-xs font-medium text-foreground capitalize">{type}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">{percentage.toFixed(0)}%</span>
                                <span className={`text-xs font-semibold ${info.color}`}>{count}</span>
                              </div>
                            </div>
                            <div className="h-1.5 bg-background rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ease-out ${info.bgColor.replace('/20', '/60')}`}
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-6 text-center">
                      <svg className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                      <p className="text-sm text-muted-foreground">No files in context yet</p>
                      <p className="text-xs text-muted-foreground/70 mt-1">Files will appear here as the agent creates them</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Files List */}
              <div data-design-id="files-list" className="rounded-xl bg-muted border border-border overflow-hidden">
                <div className="px-4 py-3 bg-card border-b border-border">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="text-sm font-medium text-foreground">Recent Files</span>
                  </div>
                </div>
                <div className="p-2 max-h-[300px] overflow-y-auto">
                  {filesInContext.length > 0 ? (
                    <div className="space-y-1">
                      {filesInContext.slice().reverse().map((file: FileInContext, index: number) => {
                        const info = getFileTypeInfo(file.type);
                        return (
                          <div
                            key={`${file.path}-${index}`}
                            data-design-id={`file-item-${index}`}
                            className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent transition-colors group cursor-default"
                          >
                            <span className={`w-8 h-8 rounded-lg ${info.bgColor} flex items-center justify-center text-xs font-medium ${info.color} flex-shrink-0`}>
                              {info.icon}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-foreground truncate">{file.name}</p>
                              <p className="text-[10px] text-muted-foreground truncate">{file.path}</p>
                            </div>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${info.bgColor} ${info.color} capitalize flex-shrink-0`}>
                              {file.extension || file.type}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-6 text-center">
                      <p className="text-sm text-muted-foreground">No files created yet</p>
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="context" className="flex-1 overflow-hidden mt-0">
            <ScrollArea className="h-full p-4">
              <div className="rounded-xl bg-muted border border-border overflow-hidden">
                <div className="px-4 py-3 bg-card border-b border-border">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    <span className="text-sm font-medium text-foreground">Context Overview</span>
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                      <span className="text-xs text-muted-foreground">User Messages</span>
                    </div>
                    <span className="text-xs font-medium text-foreground">
                      {messages.filter((m) => (m.role as string) === "user").length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                      <span className="text-xs text-muted-foreground">Assistant Messages</span>
                    </div>
                    <span className="text-xs font-medium text-foreground">
                      {messages.filter((m) => (m.role as string) === "assistant").length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-400"></span>
                      <span className="text-xs text-muted-foreground">Tool Results</span>
                    </div>
                    <span className="text-xs font-medium text-foreground">
                      {messages.filter((m) => (m.role as string) === "tool").length}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 p-4 rounded-xl bg-muted border border-border">
                <h4 className="text-sm font-medium text-foreground mb-2">Session Info</h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Session ID</span>
                    <span className="text-foreground font-mono">{memory?.session_id?.slice(0, 8) || "N/A"}...</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Max Iterations</span>
                    <span className="text-foreground">{maxIterations}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <span className={memory?.is_running ? "text-green-400" : "text-muted-foreground"}>
                      {memory?.is_running ? "Running" : "Idle"}
                    </span>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}