/**
 * Server Detection Utilities
 * 
 * Universal server detection system that works with Python, Node.js, Vite, 
 * Next.js, and any other development server.
 * 
 * Features:
 * - Detects when servers have successfully started
 * - Detects real port conflicts (EADDRINUSE, etc.)
 * - Extracts ALL HTTP/HTTPS URLs from output (not just localhost)
 * - Returns full command output with extracted URLs to LLM
 */

/**
 * Strip ANSI escape codes from terminal output.
 * Terminal output often contains color codes like \x1b[32m that interfere with regex matching.
 */
function stripAnsiCodes(text: string): string {
  /* eslint-disable no-control-regex */
  return text
    // Standard SGR (colors, bold, etc.): \x1b[0m, \x1b[32m, \x1b[1;32m
    .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
    // Private mode sequences: \x1b[?25h, \x1b[?25l (cursor show/hide)
    .replace(/\x1b\[\?[0-9;]*[a-zA-Z]/g, '')
    // OSC sequences: \x1b]0;title\x07 (terminal title)
    .replace(/\x1b\][^\x07]*\x07/g, '')
    // CSI sequences with parameters: \x1b[H, \x1b[2J
    .replace(/\x1b\[[0-9;]*[HJKfm]/g, '')
    // Strip carriage returns that might cause issues
    .replace(/\r/g, '');
  /* eslint-enable no-control-regex */
}

/**
 * Patterns that indicate a command is long-running (dev server)
 */
const LONG_RUNNING_PATTERNS = [
  // npm/yarn/pnpm/bun commands
  /npm\s+run\s+(dev|start|serve|watch)/i,
  /yarn\s+(dev|start|serve|watch)/i,
  /pnpm\s+(dev|start|serve|watch)/i,
  /bun\s+(run\s+)?(dev|start|serve|watch)/i,
  
  // Direct tool commands
  /\bvite\b/i,
  /\bnext\s+(dev|start)\b/i,
  /\bnodemon\b/i,
  /\bts-node-dev\b/i,
  /\bwatchman\b/i,
  /\bwebpack\s+(serve|watch)\b/i,
  /\bparcel\s+(watch|serve)\b/i,
  /\brollup\s+(-w|--watch)\b/i,
  /\besbuild\s+--watch\b/i,
  
  // Python servers
  /python\s+.*app\.py/i,
  /python\s+-m\s+(http\.server|flask|uvicorn|gunicorn)/i,
  /uvicorn\b/i,
  /gunicorn\b/i,
  /flask\s+run/i,
  /django.*runserver/i,
  /fastapi\b.*--reload/i,
  
  // Node.js servers
  /node\s+.*server\.js/i,
  /node\s+.*app\.js/i,
  /node\s+.*index\.js/i,
  
  // Ruby servers
  /rails\s+server/i,
  /rails\s+s\b/i,
  /puma\b/i,
  
  // PHP servers
  /php\s+-S/i,
  /artisan\s+serve/i,
  
  // Go servers
  /go\s+run\b/i,
  /air\b/i,
  
  // Other dev tools
  /live-server/i,
  /http-server/i,
  /serve\s+-s/i,
  /browser-sync/i,
];

/**
 * Universal patterns that indicate the server has SUCCESSFULLY started.
 * If ANY of these patterns match, treat the server as started and STOP retrying ports.
 */
const SERVER_READY_PATTERNS = [
  // Generic success indicators
  /Server\s+started/i,
  /Server\s+running/i,
  /Listening\s+on/i,
  /Local:\s*/i,
  /Network:\s*/i,
  /App\s+running\s+at/i,
  /ready\s+in\s+\d+/i,
  /compiled\s+successfully/i,
  /running\s+at/i,
  
  // Vite specific
  /VITE\s+v[\d.]+\s+ready/i,
  /press\s+h\s+to\s+show\s+help/i,
  /press\s+h\s+\+\s+enter/i,
  
  // Next.js specific
  /Next\.js\s+[\d.]+/i,
  /compiled\s+client\s+and\s+server/i,
  /Ready\s+in\s+\d+/i,
  /started\s+server\s+on/i,
  
  // Python/FastAPI/Uvicorn specific
  /Uvicorn\s+running\s+on/i,
  /Application\s+startup\s+complete/i,
  /FastAPI\s+running/i,
  /Started\s+server\s+process/i,
  /Waiting\s+for\s+application\s+startup/i,
  
  // Flask specific
  /Running\s+on\s+http/i,
  /Debugger\s+is\s+active/i,
  /Debugger\s+PIN/i,
  
  // Django specific
  /Starting\s+development\s+server/i,
  /Quit\s+the\s+server\s+with\s+CONTROL-C/i,
  
  // Express/Node.js specific
  /Express\s+server\s+listening/i,
  /Server\s+listening\s+on\s+port/i,
  /listening\s+on\s+port\s+\d+/i,
  
  // Webpack specific
  /webpack\s+compiled/i,
  /built\s+in\s+\d+/i,
  /Compiled\s+with\s+warnings/i,
  
  // Generic URL patterns (if a URL is shown, server is likely ready)
  /http:\/\/localhost:\d+/i,
  /http:\/\/127\.0\.0\.1:\d+/i,
  /http:\/\/0\.0\.0\.0:\d+/i,
  /https:\/\/localhost:\d+/i,
  
  // Ruby/Rails specific
  /Listening\s+on\s+tcp/i,
  /Puma\s+starting/i,
  /Use\s+Ctrl-C\s+to\s+stop/i,
  
  // PHP specific
  /Development\s+Server.*started/i,
  /PHP.*Development\s+Server/i,
  
  // Go specific
  /Starting\s+server\s+at/i,
];

/**
 * Patterns that indicate a REAL port conflict error.
 * ONLY these patterns should trigger port retry logic.
 */
const PORT_CONFLICT_PATTERNS = [
  /EADDRINUSE/i,
  /Address\s+already\s+in\s+use/i,
  /port\s+is\s+already\s+allocated/i,
  /bind:\s*address\s+already\s+in\s+use/i,
  /OSError:\s*\[Errno\s+98\]/i,
  /OSError:\s*\[Errno\s+48\]/i,  // macOS equivalent
  /Error:\s*listen\s+EADDRINUSE/i,
  /can't\s+bind\s+to\s+port/i,
  /port\s+\d+\s+is\s+(already\s+)?in\s+use/i,
  /Failed\s+to\s+bind\s+to\s+port/i,
  /Another\s+process\s+is\s+using\s+port/i,
  /Unable\s+to\s+listen\s+on\s+port/i,
  /socket\.error.*Address\s+already\s+in\s+use/i,
];

/**
 * Universal URL extraction pattern.
 * Captures ALL HTTP and HTTPS URLs including:
 * - localhost URLs
 * - IP address URLs (127.0.0.1, 0.0.0.0, 192.168.x.x, etc.)
 * - Domain URLs (*.preview.app, *.vercel.app, *.ngrok.io, etc.)
 */
const UNIVERSAL_URL_PATTERN = /https?:\/\/[^\s<>"'`)\]]+/gi;

/**
 * Check if a command is a long-running dev server command
 */
export function isLongRunningCommand(command: string): boolean {
  return LONG_RUNNING_PATTERNS.some(pattern => pattern.test(command));
}

/**
 * Check if the output indicates a REAL port conflict.
 * Only returns true if actual port conflict error messages are found.
 */
export function hasPortConflict(output: string): boolean {
  const cleanOutput = stripAnsiCodes(output);
  return PORT_CONFLICT_PATTERNS.some(pattern => pattern.test(cleanOutput));
}

/**
 * Check if the output indicates the server is ready
 */
export function isServerReady(output: string): boolean {
  // Strip ANSI codes before matching - terminal output contains color codes
  const cleanOutput = stripAnsiCodes(output);
  return SERVER_READY_PATTERNS.some(pattern => pattern.test(cleanOutput));
}

/**
 * Extract ALL URLs from the output (not just localhost).
 * Returns unique URLs without trailing slashes or special characters.
 */
export function extractAllUrls(output: string): string[] {
  const cleanOutput = stripAnsiCodes(output);
  const matches = cleanOutput.match(UNIVERSAL_URL_PATTERN);
  if (!matches) return [];
  
  // Clean up URLs and remove duplicates
  const cleanedUrls = matches.map(url => {
    // Remove trailing punctuation that might have been captured
    return url
      .replace(/[.,;:!?\]}>)]+$/, '')  // Remove trailing punctuation
      .replace(/\/$/, '');  // Remove trailing slash
  });
  
  // Remove duplicates while preserving order
  const uniqueUrls = [...new Set(cleanedUrls)];
  
  // Sort to prioritize localhost/local URLs first for convenience
  return uniqueUrls.sort((a, b) => {
    const aIsLocal = /localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(a);
    const bIsLocal = /localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(b);
    if (aIsLocal && !bIsLocal) return -1;
    if (!aIsLocal && bIsLocal) return 1;
    return 0;
  });
}

/**
 * Legacy function for backward compatibility.
 * @deprecated Use extractAllUrls instead
 */
export function extractLocalhostUrls(output: string): string[] {
  return extractAllUrls(output);
}

/**
 * Result of server detection
 */
export interface ServerDetectionResult {
  isReady: boolean;
  urls: string[];
  message: string;
  hasPortConflict: boolean;
  fullOutput: string;
}

/**
 * Detect server status from terminal output.
 * 
 * Returns:
 * - isReady: true if server started successfully
 * - urls: all extracted HTTP/HTTPS URLs
 * - message: summary message for LLM
 * - hasPortConflict: true only if real port conflict detected
 * - fullOutput: the complete cleaned output for LLM context
 */
export function detectServerStatus(command: string, output: string): ServerDetectionResult {
  const isLongRunning = isLongRunningCommand(command);
  const cleanOutput = stripAnsiCodes(output);
  
  // Check for port conflicts first
  const portConflict = hasPortConflict(output);
  if (portConflict) {
    return {
      isReady: false,
      urls: [],
      message: `Port conflict detected: ${cleanOutput.slice(-500)}`,
      hasPortConflict: true,
      fullOutput: cleanOutput
    };
  }
  
  if (!isLongRunning) {
    return {
      isReady: false,
      urls: [],
      message: '',
      hasPortConflict: false,
      fullOutput: cleanOutput
    };
  }
  
  const ready = isServerReady(output);
  const urls = extractAllUrls(output);
  
  if (ready || urls.length > 0) {
    // Build comprehensive message with full output and URLs for LLM
    let message = 'Server started successfully.\n\n';
    
    if (urls.length > 0) {
      message += `Access URLs:\n${urls.map(url => `  - ${url}`).join('\n')}\n\n`;
    }
    
    // Include relevant portion of output for context
    const outputLines = cleanOutput.split('\n').slice(-30).join('\n');
    message += `Terminal Output:\n${outputLines}`;
    
    return {
      isReady: true,
      urls,
      message,
      hasPortConflict: false,
      fullOutput: cleanOutput
    };
  }
  
  return {
    isReady: false,
    urls: [],
    message: '',
    hasPortConflict: false,
    fullOutput: cleanOutput
  };
}

/**
 * Check if the AI should retry with a different port.
 * 
 * IMPORTANT: Only returns true if there's an ACTUAL port conflict error.
 * The AI should NOT change ports unless this returns true.
 */
export function shouldRetryWithDifferentPort(output: string): boolean {
  return hasPortConflict(output);
}

/**
 * Get a summary of why the server detection concluded what it did.
 * Useful for debugging and logging.
 */
export function getDetectionSummary(command: string, output: string): string {
  const cleanOutput = stripAnsiCodes(output);
  const isLongRunning = isLongRunningCommand(command);
  const ready = isServerReady(output);
  const portConflict = hasPortConflict(output);
  const urls = extractAllUrls(output);
  
  const summary = [
    `Command: ${command}`,
    `Is Long Running: ${isLongRunning}`,
    `Server Ready: ${ready}`,
    `Port Conflict: ${portConflict}`,
    `URLs Found: ${urls.length > 0 ? urls.join(', ') : 'none'}`,
  ];
  
  if (ready) {
    const matchedPattern = SERVER_READY_PATTERNS.find(p => p.test(cleanOutput));
    if (matchedPattern) {
      summary.push(`Matched Ready Pattern: ${matchedPattern.toString()}`);
    }
  }
  
  if (portConflict) {
    const matchedPattern = PORT_CONFLICT_PATTERNS.find(p => p.test(cleanOutput));
    if (matchedPattern) {
      summary.push(`Matched Conflict Pattern: ${matchedPattern.toString()}`);
    }
  }
  
  return summary.join('\n');
}