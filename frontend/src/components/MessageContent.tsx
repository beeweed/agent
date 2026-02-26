import { useEffect, useRef, useMemo } from "react";
import hljs from "highlight.js";
import "highlight.js/styles/vs2015.css";
import { Copy, Check } from "lucide-react";
import { useState } from "react";

interface MessageContentProps {
  content: string;
  isStreaming?: boolean;
}

interface ParsedBlock {
  type: "text" | "code" | "heading" | "list" | "blockquote" | "hr" | "table";
  content: string;
  language?: string;
  level?: number;
  listType?: "ordered" | "unordered";
  items?: string[];
  tableHeaders?: string[];
  tableRows?: string[][];
}

function CodeBlock({ code, language }: { code: string; language?: string }) {
  const codeRef = useRef<HTMLElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (codeRef.current) {
      hljs.highlightElement(codeRef.current);
    }
  }, [code, language]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const displayLanguage = language || "plaintext";

  return (
    <div data-design-id="code-block" className="group relative my-3 rounded-xl overflow-hidden bg-[#1e1e1e] border border-border">
      <div data-design-id="code-block-header" className="flex items-center justify-between px-4 py-2 bg-[#2d2d2d] border-b border-border">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {displayLanguage}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground hover:text-foreground rounded-md hover:bg-accent transition-colors"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-green-500" />
              <span className="text-green-500">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <div className="overflow-x-auto">
        <pre className="p-4 text-sm leading-relaxed m-0 text-gray-100">
          <code
            ref={codeRef}
            className={`language-${displayLanguage} !bg-transparent text-gray-100`}
            style={{ color: '#d4d4d4' }}
          >
            {code}
          </code>
        </pre>
      </div>
    </div>
  );
}

function InlineCode({ children }: { children: string }) {
  return (
    <code data-design-id="inline-code" className="px-1.5 py-0.5 rounded-md bg-muted text-primary font-mono text-[0.9em]">
      {children}
    </code>
  );
}

function parseInlineElements(text: string): React.ReactNode[] {
  const elements: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Check for inline code first (highest priority to avoid conflicts)
    const inlineCodeMatch = remaining.match(/^`([^`]+)`/);
    if (inlineCodeMatch) {
      elements.push(<InlineCode key={key++}>{inlineCodeMatch[1]}</InlineCode>);
      remaining = remaining.slice(inlineCodeMatch[0].length);
      continue;
    }

    // Check for bold (**text** or __text__)
    const boldMatch = remaining.match(/^(\*\*|__)([^*_]+)\1/);
    if (boldMatch) {
      elements.push(
        <strong key={key++} className="font-semibold text-foreground">
          {boldMatch[2]}
        </strong>
      );
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    // Check for italic (*text* or _text_) - but not inside words
    const italicMatch = remaining.match(/^(\*|_)([^*_]+)\1(?![a-zA-Z])/);
    if (italicMatch) {
      elements.push(
        <em key={key++} className="italic">
          {italicMatch[2]}
        </em>
      );
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }

    // Check for links [text](url)
    const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      elements.push(
        <a
          key={key++}
          href={linkMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          {linkMatch[1]}
        </a>
      );
      remaining = remaining.slice(linkMatch[0].length);
      continue;
    }

    // Check for strikethrough ~~text~~
    const strikeMatch = remaining.match(/^~~([^~]+)~~/);
    if (strikeMatch) {
      elements.push(
        <del key={key++} className="line-through text-muted-foreground">
          {strikeMatch[1]}
        </del>
      );
      remaining = remaining.slice(strikeMatch[0].length);
      continue;
    }

    // Find the next special character or take the rest
    const nextSpecial = remaining.search(/[`*_[~]/);
    if (nextSpecial === -1) {
      elements.push(remaining);
      break;
    } else if (nextSpecial === 0) {
      // Special character at start but didn't match any pattern - treat as literal
      elements.push(remaining[0]);
      remaining = remaining.slice(1);
    } else {
      elements.push(remaining.slice(0, nextSpecial));
      remaining = remaining.slice(nextSpecial);
    }
  }

  return elements;
}

function parseBlocks(content: string): ParsedBlock[] {
  const blocks: ParsedBlock[] = [];
  const lines = content.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Check for code block
    const codeBlockMatch = line.match(/^```(\w*)?$/);
    if (codeBlockMatch) {
      const language = codeBlockMatch[1] || "";
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].match(/^```$/)) {
        codeLines.push(lines[i]);
        i++;
      }
      blocks.push({
        type: "code",
        content: codeLines.join("\n"),
        language,
      });
      i++; // Skip closing ```
      continue;
    }

    // Check for headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      blocks.push({
        type: "heading",
        content: headingMatch[2],
        level: headingMatch[1].length,
      });
      i++;
      continue;
    }

    // Check for horizontal rule
    if (line.match(/^(-{3,}|\*{3,}|_{3,})$/)) {
      blocks.push({ type: "hr", content: "" });
      i++;
      continue;
    }

    // Check for blockquote
    if (line.startsWith("> ")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith("> ")) {
        quoteLines.push(lines[i].slice(2));
        i++;
      }
      blocks.push({
        type: "blockquote",
        content: quoteLines.join("\n"),
      });
      continue;
    }

    // Check for table (line with | characters)
    if (line.includes("|") && line.trim().startsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].includes("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      
      if (tableLines.length >= 2) {
        const parseRow = (row: string) => 
          row.split("|").filter((_, idx, arr) => idx > 0 && idx < arr.length - 1).map(cell => cell.trim());
        
        const headers = parseRow(tableLines[0]);
        const rows: string[][] = [];
        
        // Skip separator row (contains ---)
        for (let j = 2; j < tableLines.length; j++) {
          rows.push(parseRow(tableLines[j]));
        }
        
        blocks.push({
          type: "table",
          content: "",
          tableHeaders: headers,
          tableRows: rows,
        });
      }
      continue;
    }

    // Check for unordered list
    const ulMatch = line.match(/^[-*+]\s+(.+)$/);
    if (ulMatch) {
      const items: string[] = [];
      while (i < lines.length && lines[i].match(/^[-*+]\s+/)) {
        const itemMatch = lines[i].match(/^[-*+]\s+(.+)$/);
        if (itemMatch) items.push(itemMatch[1]);
        i++;
      }
      blocks.push({
        type: "list",
        content: "",
        listType: "unordered",
        items,
      });
      continue;
    }

    // Check for ordered list
    const olMatch = line.match(/^\d+\.\s+(.+)$/);
    if (olMatch) {
      const items: string[] = [];
      while (i < lines.length && lines[i].match(/^\d+\.\s+/)) {
        const itemMatch = lines[i].match(/^\d+\.\s+(.+)$/);
        if (itemMatch) items.push(itemMatch[1]);
        i++;
      }
      blocks.push({
        type: "list",
        content: "",
        listType: "ordered",
        items,
      });
      continue;
    }

    // Regular text - collect consecutive non-empty lines
    if (line.trim()) {
      const textLines: string[] = [];
      while (
        i < lines.length &&
        lines[i].trim() &&
        !lines[i].match(/^```/) &&
        !lines[i].match(/^#{1,6}\s/) &&
        !lines[i].match(/^[-*+]\s/) &&
        !lines[i].match(/^\d+\.\s/) &&
        !lines[i].startsWith("> ") &&
        !lines[i].match(/^(-{3,}|\*{3,}|_{3,})$/)
      ) {
        textLines.push(lines[i]);
        i++;
      }
      blocks.push({
        type: "text",
        content: textLines.join("\n"),
      });
      continue;
    }

    i++;
  }

  return blocks;
}

function Heading({ level, children }: { level: number; children: React.ReactNode }) {
  const classes = {
    1: "text-2xl font-bold mt-6 mb-3 text-foreground",
    2: "text-xl font-semibold mt-5 mb-2 text-foreground",
    3: "text-lg font-semibold mt-4 mb-2 text-foreground",
    4: "text-base font-semibold mt-3 mb-1 text-foreground",
    5: "text-sm font-semibold mt-2 mb-1 text-foreground",
    6: "text-sm font-medium mt-2 mb-1 text-muted-foreground",
  };

  const Tag = `h${level}` as keyof JSX.IntrinsicElements;
  return <Tag className={classes[level as keyof typeof classes]}>{children}</Tag>;
}

function List({ type, items }: { type: "ordered" | "unordered"; items: string[] }) {
  const Tag = type === "ordered" ? "ol" : "ul";
  return (
    <Tag
      data-design-id={`${type}-list`}
      className={`my-2 pl-6 space-y-1 ${
        type === "ordered" ? "list-decimal" : "list-disc"
      } text-foreground`}
    >
      {items.map((item, idx) => (
        <li key={idx} className="leading-relaxed">
          {parseInlineElements(item)}
        </li>
      ))}
    </Tag>
  );
}

function Blockquote({ children }: { children: React.ReactNode }) {
  return (
    <blockquote
      data-design-id="blockquote"
      className="my-3 pl-4 border-l-4 border-primary/50 bg-primary/5 py-2 pr-4 rounded-r-lg text-muted-foreground italic"
    >
      {children}
    </blockquote>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div data-design-id="table-container" className="my-3 overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted">
            {headers.map((header, idx) => (
              <th key={idx} className="px-4 py-2 text-left font-semibold text-foreground border-b border-border">
                {parseInlineElements(header)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIdx) => (
            <tr key={rowIdx} className={rowIdx % 2 === 0 ? "bg-background" : "bg-muted/30"}>
              {row.map((cell, cellIdx) => (
                <td key={cellIdx} className="px-4 py-2 text-foreground border-b border-border/50">
                  {parseInlineElements(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MessageContent({ content, isStreaming }: MessageContentProps) {
  const blocks = useMemo(() => parseBlocks(content), [content]);

  return (
    <div data-design-id="message-content" className="message-content">
      {blocks.map((block, idx) => {
        switch (block.type) {
          case "code":
            return (
              <CodeBlock
                key={idx}
                code={block.content}
                language={block.language}
              />
            );

          case "heading":
            return (
              <Heading key={idx} level={block.level || 1}>
                {parseInlineElements(block.content)}
              </Heading>
            );

          case "list":
            return (
              <List
                key={idx}
                type={block.listType || "unordered"}
                items={block.items || []}
              />
            );

          case "blockquote":
            return (
              <Blockquote key={idx}>
                {parseInlineElements(block.content)}
              </Blockquote>
            );

          case "hr":
            return (
              <hr
                key={idx}
                className="my-4 border-t border-border"
              />
            );

          case "table":
            return (
              <Table
                key={idx}
                headers={block.tableHeaders || []}
                rows={block.tableRows || []}
              />
            );

          case "text":
          default:
            return (
              <p key={idx} className="my-2 leading-relaxed whitespace-pre-wrap">
                {parseInlineElements(block.content)}
              </p>
            );
        }
      })}
      {isStreaming && (
        <span className="inline-block w-2 h-4 ml-0.5 bg-primary animate-pulse" />
      )}
    </div>
  );
}