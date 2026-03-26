import { Terminal as XTerm, ITerminalOptions, ITheme } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { SearchAddon } from "@xterm/addon-search";
import { Unicode11Addon } from "@xterm/addon-unicode11";
import { WebglAddon } from "@xterm/addon-webgl";
import { ImageAddon, IImageAddonOptions } from "@xterm/addon-image";
import { SerializeAddon } from "@xterm/addon-serialize";
import { ClipboardAddon } from "@xterm/addon-clipboard";
import { CanvasAddon } from "@xterm/addon-canvas";

// Terminal Themes
export const terminalThemes: Record<string, ITheme> = {
  github: {
    background: "#0d1117",
    foreground: "#c9d1d9",
    cursor: "#c9d1d9",
    cursorAccent: "#0d1117",
    selectionBackground: "#264f78",
    selectionForeground: "#ffffff",
    selectionInactiveBackground: "#264f7880",
    black: "#484f58",
    red: "#ff7b72",
    green: "#3fb950",
    yellow: "#d29922",
    blue: "#58a6ff",
    magenta: "#bc8cff",
    cyan: "#39c5cf",
    white: "#b1bac4",
    brightBlack: "#6e7681",
    brightRed: "#ffa198",
    brightGreen: "#56d364",
    brightYellow: "#e3b341",
    brightBlue: "#79c0ff",
    brightMagenta: "#d2a8ff",
    brightCyan: "#56d4dd",
    brightWhite: "#f0f6fc",
  },
  vscode: {
    background: "#1e1e1e",
    foreground: "#d4d4d4",
    cursor: "#d4d4d4",
    cursorAccent: "#1e1e1e",
    selectionBackground: "#264f78",
    selectionForeground: "#ffffff",
    selectionInactiveBackground: "#3a3d41",
    black: "#000000",
    red: "#cd3131",
    green: "#0dbc79",
    yellow: "#e5e510",
    blue: "#2472c8",
    magenta: "#bc3fbc",
    cyan: "#11a8cd",
    white: "#e5e5e5",
    brightBlack: "#666666",
    brightRed: "#f14c4c",
    brightGreen: "#23d18b",
    brightYellow: "#f5f543",
    brightBlue: "#3b8eea",
    brightMagenta: "#d670d6",
    brightCyan: "#29b8db",
    brightWhite: "#e5e5e5",
  },
  dracula: {
    background: "#282a36",
    foreground: "#f8f8f2",
    cursor: "#f8f8f2",
    cursorAccent: "#282a36",
    selectionBackground: "#44475a",
    selectionForeground: "#f8f8f2",
    black: "#21222c",
    red: "#ff5555",
    green: "#50fa7b",
    yellow: "#f1fa8c",
    blue: "#bd93f9",
    magenta: "#ff79c6",
    cyan: "#8be9fd",
    white: "#f8f8f2",
    brightBlack: "#6272a4",
    brightRed: "#ff6e6e",
    brightGreen: "#69ff94",
    brightYellow: "#ffffa5",
    brightBlue: "#d6acff",
    brightMagenta: "#ff92df",
    brightCyan: "#a4ffff",
    brightWhite: "#ffffff",
  },
  monokai: {
    background: "#272822",
    foreground: "#f8f8f2",
    cursor: "#f8f8f0",
    cursorAccent: "#272822",
    selectionBackground: "#49483e",
    selectionForeground: "#f8f8f2",
    black: "#272822",
    red: "#f92672",
    green: "#a6e22e",
    yellow: "#f4bf75",
    blue: "#66d9ef",
    magenta: "#ae81ff",
    cyan: "#a1efe4",
    white: "#f8f8f2",
    brightBlack: "#75715e",
    brightRed: "#f92672",
    brightGreen: "#a6e22e",
    brightYellow: "#f4bf75",
    brightBlue: "#66d9ef",
    brightMagenta: "#ae81ff",
    brightCyan: "#a1efe4",
    brightWhite: "#f9f8f5",
  },
  nord: {
    background: "#2e3440",
    foreground: "#d8dee9",
    cursor: "#d8dee9",
    cursorAccent: "#2e3440",
    selectionBackground: "#434c5e",
    selectionForeground: "#d8dee9",
    black: "#3b4252",
    red: "#bf616a",
    green: "#a3be8c",
    yellow: "#ebcb8b",
    blue: "#81a1c1",
    magenta: "#b48ead",
    cyan: "#88c0d0",
    white: "#e5e9f0",
    brightBlack: "#4c566a",
    brightRed: "#bf616a",
    brightGreen: "#a3be8c",
    brightYellow: "#ebcb8b",
    brightBlue: "#81a1c1",
    brightMagenta: "#b48ead",
    brightCyan: "#8fbcbb",
    brightWhite: "#eceff4",
  },
  matrix: {
    background: "#0d0208",
    foreground: "#00ff41",
    cursor: "#00ff41",
    cursorAccent: "#0d0208",
    selectionBackground: "#003b00",
    selectionForeground: "#00ff41",
    black: "#0d0208",
    red: "#ff0000",
    green: "#00ff41",
    yellow: "#ffff00",
    blue: "#0000ff",
    magenta: "#ff00ff",
    cyan: "#00ffff",
    white: "#00ff41",
    brightBlack: "#003b00",
    brightRed: "#ff5555",
    brightGreen: "#39ff14",
    brightYellow: "#ffff55",
    brightBlue: "#5555ff",
    brightMagenta: "#ff55ff",
    brightCyan: "#55ffff",
    brightWhite: "#ffffff",
  },
  solarizedDark: {
    background: "#002b36",
    foreground: "#839496",
    cursor: "#839496",
    cursorAccent: "#002b36",
    selectionBackground: "#073642",
    selectionForeground: "#93a1a1",
    black: "#073642",
    red: "#dc322f",
    green: "#859900",
    yellow: "#b58900",
    blue: "#268bd2",
    magenta: "#d33682",
    cyan: "#2aa198",
    white: "#eee8d5",
    brightBlack: "#002b36",
    brightRed: "#cb4b16",
    brightGreen: "#586e75",
    brightYellow: "#657b83",
    brightBlue: "#839496",
    brightMagenta: "#6c71c4",
    brightCyan: "#93a1a1",
    brightWhite: "#fdf6e3",
  },
  synthwave: {
    background: "#2b213a",
    foreground: "#f0eff1",
    cursor: "#ff7edb",
    cursorAccent: "#2b213a",
    selectionBackground: "#463465",
    selectionForeground: "#f0eff1",
    black: "#1a1a2e",
    red: "#fe4450",
    green: "#72f1b8",
    yellow: "#fede5d",
    blue: "#36f9f6",
    magenta: "#ff7edb",
    cyan: "#03edf9",
    white: "#f0eff1",
    brightBlack: "#463465",
    brightRed: "#ff6e6e",
    brightGreen: "#72f1b8",
    brightYellow: "#fff951",
    brightBlue: "#36f9f6",
    brightMagenta: "#ff92df",
    brightCyan: "#03edf9",
    brightWhite: "#ffffff",
  },
};

// Font options for terminal
export const terminalFonts = [
  '"JetBrains Mono", monospace',
  '"Fira Code", monospace',
  '"Cascadia Code", monospace',
  '"Source Code Pro", monospace',
  '"IBM Plex Mono", monospace',
  '"Hack", monospace',
  '"Ubuntu Mono", monospace',
  '"Menlo", monospace',
  '"Monaco", monospace',
  '"Consolas", monospace',
  '"Courier New", monospace',
];

// Default terminal options
export const defaultTerminalOptions: ITerminalOptions = {
  cursorBlink: true,
  cursorStyle: "block",
  cursorWidth: 2,
  cursorInactiveStyle: "outline",
  fontSize: 14,
  fontFamily: terminalFonts[0],
  fontWeight: "normal",
  fontWeightBold: "bold",
  letterSpacing: 0,
  lineHeight: 1.2,
  theme: terminalThemes.github,
  allowProposedApi: true,
  allowTransparency: true,
  scrollback: 10000,
  scrollSensitivity: 1,
  fastScrollSensitivity: 5,
  fastScrollModifier: "alt",
  smoothScrollDuration: 125,
  macOptionIsMeta: true,
  macOptionClickForcesSelection: true,
  minimumContrastRatio: 1,
  tabStopWidth: 8,
  rightClickSelectsWord: true,
  altClickMovesCursor: true,
  convertEol: false,
  screenReaderMode: false,
  windowsMode: false,
  windowsPty: undefined,
  wordSeparator: " ()[]{}',\"`",
  ignoreBracketedPasteMode: false,
  drawBoldTextInBrightColors: true,
  customGlyphs: true,
  rescaleOverlappingGlyphs: true,
};

// Image addon options for inline images (like sixel, iTerm2 inline images)
export const imageAddonOptions: IImageAddonOptions = {
  enableSizeReports: true,
  pixelLimit: 16777216, // 4096 * 4096 max image size
  sixelSupport: true,
  sixelScrolling: true,
  sixelPaletteLimit: 4096,
  storageLimit: 128,
  showPlaceholder: true,
};

// Terminal addons interface
export interface TerminalAddons {
  fit: FitAddon;
  webLinks: WebLinksAddon;
  search: SearchAddon;
  unicode11: Unicode11Addon;
  webgl: WebglAddon | null;
  canvas: CanvasAddon | null;
  image: ImageAddon;
  serialize: SerializeAddon;
  clipboard: ClipboardAddon;
}

// Create and configure a terminal with all addons
export function createEnhancedTerminal(
  options: Partial<ITerminalOptions> = {},
  theme: keyof typeof terminalThemes = "github"
): { terminal: XTerm; addons: TerminalAddons } {
  const terminalOptions: ITerminalOptions = {
    ...defaultTerminalOptions,
    theme: terminalThemes[theme],
    ...options,
  };

  const terminal = new XTerm(terminalOptions);

  // Initialize all addons
  const fit = new FitAddon();
  const webLinks = new WebLinksAddon((event, uri) => {
    // Open links in new tab
    window.open(uri, "_blank", "noopener,noreferrer");
  }, {
    urlRegex: /https?:\/\/[^\s'"<>]+/,
    hover: (event, text, _location) => {
      // Show tooltip on hover
      const tooltip = document.createElement("div");
      tooltip.className = "terminal-link-tooltip";
      tooltip.textContent = text;
      tooltip.style.cssText = `
        position: fixed;
        left: ${event.clientX + 10}px;
        top: ${event.clientY + 10}px;
        background: #333;
        color: #fff;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        z-index: 10000;
        pointer-events: none;
      `;
      document.body.appendChild(tooltip);
      return tooltip;
    },
    leave: (_event, element) => {
      if (element) {
        element.remove();
      }
    },
  });
  const search = new SearchAddon();
  const unicode11 = new Unicode11Addon();
  const image = new ImageAddon(imageAddonOptions);
  const serialize = new SerializeAddon();
  const clipboard = new ClipboardAddon();

  // Load core addons
  terminal.loadAddon(fit);
  terminal.loadAddon(webLinks);
  terminal.loadAddon(search);
  terminal.loadAddon(unicode11);
  terminal.loadAddon(image);
  terminal.loadAddon(serialize);
  terminal.loadAddon(clipboard);

  // Activate unicode 11 for better emoji and special character support
  terminal.unicode.activeVersion = "11";

  // WebGL and Canvas renderers (will be loaded after terminal is opened)
  const webgl: WebglAddon | null = null;
  const canvas: CanvasAddon | null = null;

  const addons: TerminalAddons = {
    fit,
    webLinks,
    search,
    unicode11,
    webgl,
    canvas,
    image,
    serialize,
    clipboard,
  };

  return { terminal, addons };
}

// Load WebGL renderer (call after terminal.open())
export function loadWebGLRenderer(
  terminal: XTerm,
  addons: TerminalAddons
): boolean {
  try {
    const webgl = new WebglAddon();
    webgl.onContextLoss(() => {
      console.warn("[Terminal] WebGL context lost, falling back to canvas");
      webgl.dispose();
      addons.webgl = null;
      loadCanvasRenderer(terminal, addons);
    });
    terminal.loadAddon(webgl);
    addons.webgl = webgl;
    console.log("[Terminal] WebGL renderer loaded successfully");
    return true;
  } catch (error) {
    console.warn("[Terminal] WebGL not available, falling back to canvas:", error);
    return loadCanvasRenderer(terminal, addons);
  }
}

// Load Canvas renderer as fallback
export function loadCanvasRenderer(
  terminal: XTerm,
  addons: TerminalAddons
): boolean {
  try {
    const canvas = new CanvasAddon();
    terminal.loadAddon(canvas);
    addons.canvas = canvas;
    console.log("[Terminal] Canvas renderer loaded successfully");
    return true;
  } catch (error) {
    console.warn("[Terminal] Canvas renderer failed:", error);
    return false;
  }
}

// Search functionality
export interface SearchOptions {
  regex?: boolean;
  wholeWord?: boolean;
  caseSensitive?: boolean;
  incremental?: boolean;
  decorations?: {
    matchBackground?: string;
    matchBorder?: string;
    matchOverviewRuler?: string;
    activeMatchBackground?: string;
    activeMatchBorder?: string;
    activeMatchColorOverviewRuler?: string;
  };
}

export function searchInTerminal(
  searchAddon: SearchAddon,
  query: string,
  options: SearchOptions = {}
): boolean {
  const decorations = {
    matchBackground: "#555555",
    matchBorder: "#FFFF00",
    matchOverviewRuler: "#FFFF00",
    activeMatchBackground: "#FFFF00",
    activeMatchBorder: "#FF0000",
    activeMatchColorOverviewRuler: "#FF0000",
    ...options.decorations,
  };

  return searchAddon.findNext(query, {
    regex: options.regex || false,
    wholeWord: options.wholeWord || false,
    caseSensitive: options.caseSensitive || false,
    incremental: options.incremental || true,
    decorations,
  });
}

export function searchPrevious(
  searchAddon: SearchAddon,
  query: string,
  options: SearchOptions = {}
): boolean {
  return searchAddon.findPrevious(query, {
    regex: options.regex || false,
    wholeWord: options.wholeWord || false,
    caseSensitive: options.caseSensitive || false,
    decorations: options.decorations,
  });
}

export function clearSearch(searchAddon: SearchAddon): void {
  searchAddon.clearDecorations();
}

// Serialize terminal content
export function serializeTerminal(serializeAddon: SerializeAddon): string {
  return serializeAddon.serialize();
}

export function serializeTerminalAsHTML(serializeAddon: SerializeAddon): string {
  return serializeAddon.serializeAsHTML();
}

// Terminal state management
export interface TerminalState {
  content: string;
  cursorPosition: { x: number; y: number };
  scrollPosition: number;
}

export function saveTerminalState(
  terminal: XTerm,
  serializeAddon: SerializeAddon
): TerminalState {
  return {
    content: serializeAddon.serialize(),
    cursorPosition: {
      x: terminal.buffer.active.cursorX,
      y: terminal.buffer.active.cursorY,
    },
    scrollPosition: terminal.buffer.active.viewportY,
  };
}

export function restoreTerminalState(
  terminal: XTerm,
  state: TerminalState
): void {
  terminal.write(state.content);
  terminal.scrollToLine(state.scrollPosition);
}

// Handle keyboard shortcuts
export interface KeyboardShortcuts {
  copy: string;
  paste: string;
  clear: string;
  search: string;
  searchNext: string;
  searchPrev: string;
  scrollUp: string;
  scrollDown: string;
  scrollPageUp: string;
  scrollPageDown: string;
  scrollToTop: string;
  scrollToBottom: string;
  increaseFontSize: string;
  decreaseFontSize: string;
  resetFontSize: string;
}

export const defaultKeyboardShortcuts: KeyboardShortcuts = {
  copy: "ctrl+shift+c",
  paste: "ctrl+shift+v",
  clear: "ctrl+l",
  search: "ctrl+shift+f",
  searchNext: "f3",
  searchPrev: "shift+f3",
  scrollUp: "ctrl+shift+up",
  scrollDown: "ctrl+shift+down",
  scrollPageUp: "shift+pageup",
  scrollPageDown: "shift+pagedown",
  scrollToTop: "ctrl+home",
  scrollToBottom: "ctrl+end",
  increaseFontSize: "ctrl+plus",
  decreaseFontSize: "ctrl+minus",
  resetFontSize: "ctrl+0",
};

// Font size controls
export function increaseFontSize(terminal: XTerm, maxSize: number = 32): void {
  const currentSize = terminal.options.fontSize || 14;
  if (currentSize < maxSize) {
    terminal.options.fontSize = currentSize + 1;
  }
}

export function decreaseFontSize(terminal: XTerm, minSize: number = 8): void {
  const currentSize = terminal.options.fontSize || 14;
  if (currentSize > minSize) {
    terminal.options.fontSize = currentSize - 1;
  }
}

export function resetFontSize(terminal: XTerm, defaultSize: number = 14): void {
  terminal.options.fontSize = defaultSize;
}

// Terminal utilities
export function clearTerminal(terminal: XTerm): void {
  terminal.clear();
}

export function resetTerminal(terminal: XTerm): void {
  terminal.reset();
}

export function scrollToTop(terminal: XTerm): void {
  terminal.scrollToTop();
}

export function scrollToBottom(terminal: XTerm): void {
  terminal.scrollToBottom();
}

export function getTerminalSelection(terminal: XTerm): string {
  return terminal.getSelection();
}

export function selectAll(terminal: XTerm): void {
  terminal.selectAll();
}

export function clearSelection(terminal: XTerm): void {
  terminal.clearSelection();
}

// Write special sequences
export function writeAnsiSequence(terminal: XTerm, sequence: string): void {
  terminal.write(sequence);
}

// ANSI escape codes for common operations
export const ANSI = {
  // Cursor movement
  cursorUp: (n: number = 1) => `\x1b[${n}A`,
  cursorDown: (n: number = 1) => `\x1b[${n}B`,
  cursorForward: (n: number = 1) => `\x1b[${n}C`,
  cursorBack: (n: number = 1) => `\x1b[${n}D`,
  cursorTo: (x: number, y: number) => `\x1b[${y};${x}H`,
  cursorSave: "\x1b[s",
  cursorRestore: "\x1b[u",
  cursorShow: "\x1b[?25h",
  cursorHide: "\x1b[?25l",

  // Erase
  eraseScreen: "\x1b[2J",
  eraseScreenToEnd: "\x1b[0J",
  eraseScreenToStart: "\x1b[1J",
  eraseLine: "\x1b[2K",
  eraseLineToEnd: "\x1b[0K",
  eraseLineToStart: "\x1b[1K",

  // Colors
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  italic: "\x1b[3m",
  underline: "\x1b[4m",
  blink: "\x1b[5m",
  inverse: "\x1b[7m",
  hidden: "\x1b[8m",
  strikethrough: "\x1b[9m",

  // Foreground colors
  black: "\x1b[30m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",

  // Bright foreground colors
  brightBlack: "\x1b[90m",
  brightRed: "\x1b[91m",
  brightGreen: "\x1b[92m",
  brightYellow: "\x1b[93m",
  brightBlue: "\x1b[94m",
  brightMagenta: "\x1b[95m",
  brightCyan: "\x1b[96m",
  brightWhite: "\x1b[97m",

  // Background colors
  bgBlack: "\x1b[40m",
  bgRed: "\x1b[41m",
  bgGreen: "\x1b[42m",
  bgYellow: "\x1b[43m",
  bgBlue: "\x1b[44m",
  bgMagenta: "\x1b[45m",
  bgCyan: "\x1b[46m",
  bgWhite: "\x1b[47m",

  // 256 color support
  fg256: (code: number) => `\x1b[38;5;${code}m`,
  bg256: (code: number) => `\x1b[48;5;${code}m`,

  // True color (24-bit) support
  fgRGB: (r: number, g: number, b: number) => `\x1b[38;2;${r};${g};${b}m`,
  bgRGB: (r: number, g: number, b: number) => `\x1b[48;2;${r};${g};${b}m`,

  // Scrolling
  scrollUp: (n: number = 1) => `\x1b[${n}S`,
  scrollDown: (n: number = 1) => `\x1b[${n}T`,

  // Screen modes
  alternateScreen: "\x1b[?1049h",
  normalScreen: "\x1b[?1049l",

  // Mouse tracking
  enableMouse: "\x1b[?1000h",
  disableMouse: "\x1b[?1000l",
  enableMouseExtended: "\x1b[?1006h",
  disableMouseExtended: "\x1b[?1006l",

  // Bracketed paste mode
  enableBracketedPaste: "\x1b[?2004h",
  disableBracketedPaste: "\x1b[?2004l",
};

// Progress bar utilities for visual feedback
export function writeProgressBar(
  terminal: XTerm,
  progress: number,
  width: number = 40,
  char: string = "█",
  emptyChar: string = "░"
): void {
  const filled = Math.round((progress / 100) * width);
  const empty = width - filled;
  const bar = char.repeat(filled) + emptyChar.repeat(empty);
  terminal.write(`\r[${bar}] ${progress.toFixed(1)}%`);
}

// Spinner animation
const spinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
let spinnerIndex = 0;

export function writeSpinner(terminal: XTerm, message: string = ""): void {
  const frame = spinnerFrames[spinnerIndex];
  spinnerIndex = (spinnerIndex + 1) % spinnerFrames.length;
  terminal.write(`\r${ANSI.cyan}${frame}${ANSI.reset} ${message}`);
}

// Export theme names for UI
export const themeNames = Object.keys(terminalThemes) as (keyof typeof terminalThemes)[];