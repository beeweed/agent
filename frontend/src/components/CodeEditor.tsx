import { ScrollArea } from "@/components/ui/scroll-area";

interface CodeEditorProps {
  content: string;
  filePath: string;
}

export function CodeEditor({ content, filePath }: CodeEditorProps) {
  const lines = content.split("\n");
  
  const getLanguage = (path: string) => {
    const ext = path.split(".").pop()?.toLowerCase();
    const languages: Record<string, string> = {
      tsx: "typescript",
      ts: "typescript",
      jsx: "javascript",
      js: "javascript",
      css: "css",
      scss: "scss",
      json: "json",
      py: "python",
      html: "html",
      md: "markdown",
    };
    return languages[ext || ""] || "text";
  };

  const highlightLine = (line: string, lang: string) => {
    if (lang === "typescript" || lang === "javascript") {
      return highlightTypeScript(line);
    }
    if (lang === "css" || lang === "scss") {
      return highlightCSS(line);
    }
    if (lang === "json") {
      return highlightJSON(line);
    }
    if (lang === "python") {
      return highlightPython(line);
    }
    return line;
  };

  const highlightTypeScript = (line: string) => {
    const keywords = ["import", "export", "from", "const", "let", "var", "function", "return", "if", "else", "for", "while", "class", "interface", "type", "extends", "implements", "new", "this", "async", "await", "try", "catch", "throw", "default", "as"];
    const builtIns = ["React", "useState", "useEffect", "useCallback", "useMemo", "useRef", "useContext"];
    
    let result = line;
    
    result = result.replace(/(\/\/.*$)/g, '<span class="hljs-comment">$1</span>');
    result = result.replace(/(".*?"|'.*?'|`.*?`)/g, '<span class="hljs-string">$1</span>');
    result = result.replace(/\b(\d+)\b/g, '<span class="hljs-number">$1</span>');
    
    keywords.forEach((kw) => {
      const regex = new RegExp(`\\b(${kw})\\b`, "g");
      result = result.replace(regex, '<span class="hljs-keyword">$1</span>');
    });
    
    builtIns.forEach((bi) => {
      const regex = new RegExp(`\\b(${bi})\\b`, "g");
      result = result.replace(regex, '<span class="hljs-built_in">$1</span>');
    });
    
    result = result.replace(/(&lt;\/?[a-zA-Z][a-zA-Z0-9]*)/g, '<span class="hljs-tag">$1</span>');
    
    return result;
  };

  const highlightCSS = (line: string) => {
    let result = line;
    
    result = result.replace(/(\/\*.*?\*\/)/g, '<span class="hljs-comment">$1</span>');
    result = result.replace(/([a-z-]+)(?=\s*:)/g, '<span class="hljs-attr">$1</span>');
    result = result.replace(/(#[a-fA-F0-9]{3,8})/g, '<span class="hljs-number">$1</span>');
    result = result.replace(/(\d+(?:px|em|rem|%|vh|vw))/g, '<span class="hljs-number">$1</span>');
    
    return result;
  };

  const highlightJSON = (line: string) => {
    let result = line;
    
    result = result.replace(/(".*?")(\s*:)/g, '<span class="hljs-attr">$1</span>$2');
    result = result.replace(/:(\s*)(".*?")/g, ':<span class="hljs-string">$2</span>');
    result = result.replace(/:\s*(\d+)/g, ': <span class="hljs-number">$1</span>');
    result = result.replace(/:\s*(true|false|null)/g, ': <span class="hljs-keyword">$1</span>');
    
    return result;
  };

  const highlightPython = (line: string) => {
    const keywords = ["def", "class", "import", "from", "return", "if", "else", "elif", "for", "while", "try", "except", "finally", "with", "as", "lambda", "pass", "break", "continue", "and", "or", "not", "in", "is", "True", "False", "None", "async", "await"];
    
    let result = line;
    
    result = result.replace(/(#.*$)/g, '<span class="hljs-comment">$1</span>');
    result = result.replace(/(".*?"|'.*?')/g, '<span class="hljs-string">$1</span>');
    result = result.replace(/\b(\d+)\b/g, '<span class="hljs-number">$1</span>');
    
    keywords.forEach((kw) => {
      const regex = new RegExp(`\\b(${kw})\\b`, "g");
      result = result.replace(regex, '<span class="hljs-keyword">$1</span>');
    });
    
    return result;
  };

  const language = getLanguage(filePath);

  return (
    <ScrollArea data-design-id="code-editor" className="flex-1">
      <div className="p-4 font-mono text-[13px] leading-6">
        <pre className="hljs">
          <code>
            {lines.map((line, i) => (
              <div key={i} className="flex">
                <span className="w-10 text-right pr-4 text-muted-foreground/50 select-none">
                  {i + 1}
                </span>
                <span
                  dangerouslySetInnerHTML={{
                    __html: highlightLine(
                      line.replace(/</g, "&lt;").replace(/>/g, "&gt;"),
                      language
                    ),
                  }}
                />
              </div>
            ))}
          </code>
        </pre>
      </div>
    </ScrollArea>
  );
}