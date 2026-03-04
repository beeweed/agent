/**
 * Server Detection Utilities
 * 
 * Detects long-running commands (dev servers) and extracts URLs
 * when the server is ready.
 */

/**
 * Strip ANSI escape codes from terminal output.
 * Terminal output often contains color codes like \x1b[32m that interfere with regex matching.
 */
function stripAnsiCodes(text: string): string {
  // eslint-disable-next-line no-control-regex
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
 * Patterns that indicate the server is ready
 */
const SERVER_READY_PATTERNS = [
  /Local:\s*/i,
  /ready\s+in\s+\d+/i,
  /http:\/\/localhost:\d+/i,
  /http:\/\/127\.0\.0\.1:\d+/i,
  /http:\/\/0\.0\.0\.0:\d+/i,
  /Server\s+(is\s+)?running\s+(at|on)/i,
  /Listening\s+(at|on)\s+/i,
  /Started\s+(development\s+)?server/i,
  /Development\s+server\s+started/i,
  /Application\s+startup\s+complete/i,
  /Uvicorn\s+running\s+on/i,
  /FastAPI\s+running/i,
  /Express\s+server\s+listening/i,
  /Server\s+listening\s+on\s+port/i,
  /VITE\s+v[\d.]+\s+ready/i,
  /Next\.js\s+[\d.]+/i,
  /compiled\s+successfully/i,
  /compiled\s+client\s+and\s+server/i,
  /webpack\s+compiled/i,
  /built\s+in\s+\d+/i,
  /press\s+h\s+to\s+show\s+help/i,
  /Network:\s*/i,
];

/**
 * Pattern to extract localhost URLs
 */
const LOCALHOST_URL_PATTERN = /https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0):\d+\/?/gi;

/**
 * Check if a command is a long-running dev server command
 */
export function isLongRunningCommand(command: string): boolean {
  return LONG_RUNNING_PATTERNS.some(pattern => pattern.test(command));
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
 * Extract all localhost URLs from the output
 */
export function extractLocalhostUrls(output: string): string[] {
  // Strip ANSI codes before extracting URLs
  const cleanOutput = stripAnsiCodes(output);
  const matches = cleanOutput.match(LOCALHOST_URL_PATTERN);
  if (!matches) return [];
  
  // Remove duplicates and clean up URLs
  const uniqueUrls = [...new Set(matches.map(url => url.replace(/\/$/, '')))];
  return uniqueUrls;
}

/**
 * Result of server detection
 */
export interface ServerDetectionResult {
  isReady: boolean;
  urls: string[];
  message: string;
}

/**
 * Detect server status from terminal output
 */
export function detectServerStatus(command: string, output: string): ServerDetectionResult {
  const isLongRunning = isLongRunningCommand(command);
  
  if (!isLongRunning) {
    return {
      isReady: false,
      urls: [],
      message: ''
    };
  }
  
  const ready = isServerReady(output);
  const urls = extractLocalhostUrls(output);
  
  if (ready || urls.length > 0) {
    const urlsMessage = urls.length > 0 
      ? `Server started, urls: ${urls.join(', ')}`
      : 'Server started';
    
    return {
      isReady: true,
      urls,
      message: urlsMessage
    };
  }
  
  return {
    isReady: false,
    urls: [],
    message: ''
  };
}