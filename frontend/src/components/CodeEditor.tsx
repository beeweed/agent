import { useEffect, useRef, useMemo } from "react";
import hljs from "highlight.js/lib/core";
import typescript from "highlight.js/lib/languages/typescript";
import javascript from "highlight.js/lib/languages/javascript";
import python from "highlight.js/lib/languages/python";
import css from "highlight.js/lib/languages/css";
import json from "highlight.js/lib/languages/json";
import xml from "highlight.js/lib/languages/xml";
import markdown from "highlight.js/lib/languages/markdown";
import bash from "highlight.js/lib/languages/bash";
import sql from "highlight.js/lib/languages/sql";
import yaml from "highlight.js/lib/languages/yaml";
import "highlight.js/styles/github-dark.css";

hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("python", python);
hljs.registerLanguage("css", css);
hljs.registerLanguage("json", json);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("html", xml);
hljs.registerLanguage("markdown", markdown);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("yaml", yaml);

interface CodeEditorProps {
  content: string;
  filePath: string;
}

export function CodeEditor({ content, filePath }: CodeEditorProps) {
  const codeRef = useRef<HTMLElement>(null);
  
  const getLanguage = (path: string): string => {
    const ext = path.split(".").pop()?.toLowerCase();
    const languages: Record<string, string> = {
      tsx: "typescript",
      ts: "typescript",
      jsx: "javascript",
      js: "javascript",
      css: "css",
      scss: "css",
      json: "json",
      py: "python",
      html: "html",
      htm: "html",
      md: "markdown",
      sh: "bash",
      bash: "bash",
      zsh: "bash",
      sql: "sql",
      yaml: "yaml",
      yml: "yaml",
      xml: "xml",
    };
    return languages[ext || ""] || "plaintext";
  };

  const language = getLanguage(filePath);
  const lines = content.split("\n");

  const highlightedCode = useMemo(() => {
    try {
      if (language === "plaintext") {
        return content;
      }
      const result = hljs.highlight(content, { language, ignoreIllegals: true });
      return result.value;
    } catch {
      return content;
    }
  }, [content, language]);

  const highlightedLines = useMemo(() => {
    return highlightedCode.split("\n");
  }, [highlightedCode]);

  useEffect(() => {
    if (codeRef.current) {
      codeRef.current.scrollTop = 0;
    }
  }, [filePath]);

  return (
    <div 
      data-design-id="code-editor" 
      className="flex-1 h-full overflow-hidden flex flex-col bg-[#0d1117]"
    >
      <div 
        data-design-id="code-editor-header"
        className="flex items-center justify-between px-4 py-2 border-b border-[#30363d] bg-[#161b22]"
      >
        <span 
          data-design-id="code-editor-filename"
          className="text-xs text-[#8b949e] font-mono"
        >
          {filePath.split("/").pop()}
        </span>
        <span 
          data-design-id="code-editor-language"
          className="text-xs px-2 py-0.5 rounded bg-[#238636]/20 text-[#3fb950] uppercase tracking-wide"
        >
          {language}
        </span>
      </div>
      
      <div 
        ref={codeRef as React.RefObject<HTMLDivElement>}
        data-design-id="code-editor-scroll-container"
        className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-[#30363d] scrollbar-track-transparent"
        style={{
          scrollbarWidth: "thin",
          scrollbarColor: "#30363d transparent",
        }}
      >
        <div className="min-w-max">
          <pre 
            data-design-id="code-editor-pre"
            className="p-4 font-mono text-[13px] leading-6 m-0"
            style={{ background: "transparent" }}
          >
            <code 
              data-design-id="code-editor-code"
              className="hljs"
              style={{ background: "transparent" }}
            >
              {highlightedLines.map((line, i) => (
                <div 
                  key={i} 
                  data-design-id={`code-line-${i}`}
                  className="flex hover:bg-[#161b22] transition-colors"
                >
                  <span 
                    data-design-id={`line-number-${i}`}
                    className="w-12 text-right pr-4 text-[#484f58] select-none flex-shrink-0 border-r border-[#30363d] mr-4"
                  >
                    {i + 1}
                  </span>
                  <span
                    data-design-id={`line-content-${i}`}
                    className="flex-1 whitespace-pre"
                    dangerouslySetInnerHTML={{ __html: line || "&nbsp;" }}
                  />
                </div>
              ))}
            </code>
          </pre>
        </div>
      </div>
    </div>
  );
}