import { useEffect, useRef } from "react";
import { useStore } from "@/store/useStore";
import { Monitor, Code, Play, SkipBack, SkipForward } from "lucide-react";

export function ComputerPanel() {
  const { codeStreaming, isAgentRunning } = useStore();
  const codeContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (codeContainerRef.current) {
      codeContainerRef.current.scrollTop = codeContainerRef.current.scrollHeight;
    }
  }, [codeStreaming.content]);

  const getFileName = (path: string) => {
    return path.split("/").pop() || "Untitled";
  };

  const renderCodeWithLineNumbers = (content: string) => {
    if (!content) return null;
    
    const lines = content.split("\n");
    return lines.map((line, index) => (
      <div key={index} className="code-line group hover:bg-[#f5f5f5]">
        <span className="line-number">{index + 1}</span>
        <span className="line-content">
          {highlightSyntax(line)}
        </span>
      </div>
    ));
  };

  const highlightSyntax = (line: string) => {
    let result = line;
    
    result = result.replace(
      /(\/\/.*$|\/\*[\s\S]*?\*\/)/gm,
      '<span class="hljs-comment">$1</span>'
    );
    
    result = result.replace(
      /\b(import|export|from|const|let|var|function|return|if|else|for|while|class|interface|type|async|await|new|this|extends|implements|private|public|protected|static|readonly|enum|namespace|module|declare|abstract|as|is|in|of|try|catch|finally|throw|typeof|instanceof|void|null|undefined|true|false)\b/g,
      '<span class="hljs-keyword">$1</span>'
    );
    
    result = result.replace(
      /(['"`])(?:(?!\1)[^\\]|\\.)*?\1/g,
      '<span class="hljs-string">$&</span>'
    );
    
    result = result.replace(
      /\b(\d+\.?\d*)\b/g,
      '<span class="hljs-number">$1</span>'
    );
    
    result = result.replace(
      /\b([A-Z][a-zA-Z0-9]*)\b/g,
      '<span class="hljs-class">$1</span>'
    );
    
    return <span dangerouslySetInnerHTML={{ __html: result }} />;
  };

  return (
    <div data-design-id="computer-panel" className="flex flex-col h-full overflow-hidden">
      <div data-design-id="computer-header" className="p-3 sm:p-4 border-b border-border">
        <div className="flex justify-between items-center mb-2 sm:mb-3">
          <h2 data-design-id="computer-title" className="font-medium text-foreground text-sm sm:text-base">
            Anygent Computer
          </h2>
        </div>
        
        <div data-design-id="computer-status" className="flex items-center gap-2 sm:gap-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-secondary flex items-center justify-center flex-shrink-0">
            {codeStreaming.isStreaming ? (
              <Code className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
            ) : (
              <Monitor className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[11px] sm:text-xs text-muted-foreground">
              Using <span className="text-foreground/80">{codeStreaming.tool || "Editor"}</span>
            </span>
            {codeStreaming.isStreaming && codeStreaming.filePath && (
              <div className="flex items-center gap-1 mt-1 px-2 py-0.5 sm:px-2.5 sm:py-1 bg-accent rounded-full text-[10px] sm:text-xs text-muted-foreground border border-border/50 truncate">
                <Play className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">Editing {codeStreaming.filePath}</span>
              </div>
            )}
            {!codeStreaming.isStreaming && !codeStreaming.content && (
              <span className="text-[11px] sm:text-xs text-muted-foreground">Waiting for agent...</span>
            )}
          </div>
        </div>
      </div>

      <div data-design-id="computer-content" className="flex-1 p-2 sm:p-3.5 overflow-hidden flex flex-col">
        <div className="flex-1 flex flex-col rounded-lg sm:rounded-xl bg-secondary border border-border shadow-sm overflow-hidden">
          <div data-design-id="computer-file-header" className="flex justify-center items-center min-h-8 sm:min-h-9 border-b border-border bg-card/50">
            <span className="text-xs sm:text-sm text-muted-foreground truncate px-2">
              {codeStreaming.filePath ? getFileName(codeStreaming.filePath) : "No file selected"}
            </span>
          </div>
          
          <div 
            data-design-id="computer-code-area"
            ref={codeContainerRef}
            className="flex-1 overflow-auto bg-[#f5f5f5] p-2 sm:p-3"
          >
            {codeStreaming.content ? (
              <pre className="m-0 font-mono text-[11px] sm:text-[13px] leading-5 sm:leading-6">
                <code>{renderCodeWithLineNumbers(codeStreaming.content)}</code>
              </pre>
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center px-4">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 rounded-xl sm:rounded-2xl bg-accent/50 flex items-center justify-center">
                    <Code className="w-6 h-6 sm:w-8 sm:h-8 text-muted-foreground" />
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    {isAgentRunning 
                      ? "Agent is working... Code will appear here"
                      : "Start a conversation to see live code"
                    }
                  </p>
                </div>
              </div>
            )}
            {codeStreaming.isStreaming && (
              <span className="typing-cursor" />
            )}
          </div>

          <div data-design-id="computer-controls" className="flex items-center px-2 sm:px-4 py-1.5 sm:py-2 border-t border-border bg-card">
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              <button 
                className="w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                disabled
              >
                <SkipBack className="w-3 h-3 sm:w-4 sm:h-4" />
              </button>
              <button 
                className="w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              >
                <SkipForward className="w-3 h-3 sm:w-4 sm:h-4" />
              </button>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-4 flex-1 ml-2 sm:ml-4">
              <div className="flex-1 h-1 bg-border rounded-full relative">
                <div 
                  className="h-full bg-blue-500 rounded-full transition-all duration-300"
                  style={{ width: codeStreaming.isStreaming ? "100%" : (codeStreaming.content ? "100%" : "0%") }}
                />
                <div 
                  className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-blue-500 rounded-full cursor-pointer transition-all duration-300"
                  style={{ left: codeStreaming.isStreaming ? "100%" : (codeStreaming.content ? "100%" : "0%"), transform: "translate(-50%, -50%)" }}
                />
              </div>
              
              <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                <div className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full border ${codeStreaming.isStreaming ? "bg-green-500 realtime-dot-pulse" : "bg-muted-foreground"}`} />
                <span className="text-[10px] sm:text-sm text-muted-foreground hidden xs:inline">
                  {codeStreaming.isStreaming ? "Realtime" : "Idle"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}