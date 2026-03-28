import { Sandbox } from "e2b";
import { Terminal as XTerm } from "@xterm/xterm";
import {
  createEnhancedTerminal,
  loadWebGLRenderer,
} from "@/lib/terminal";
import type { TerminalAddons } from "@/lib/terminal";

export interface TerminalSession {
  sessionName: string;
  sandbox: Sandbox;
  pid: number;
  xterm: XTerm;
  addons: TerminalAddons;
  outputBuffer: string;
  isCommandRunning: boolean;
  currentCommandId: string | null;
  mountedEntryId: string | null;
  onDataDisposable: { dispose: () => void } | null;
  listeners: Map<string, (data: string) => void>;
}



class TerminalSessionManager {
  private sessions: Map<string, TerminalSession> = new Map();
  private sandboxRef: Sandbox | null = null;
  private sandboxConnecting: Promise<Sandbox | null> | null = null;
  private initializingSession: Map<string, Promise<TerminalSession | null>> = new Map();
  private executedCommandIds: Set<string> = new Set();

  async connectSandbox(sandboxId: string, apiKey: string): Promise<Sandbox | null> {
    if (this.sandboxRef) {
      return this.sandboxRef;
    }

    if (this.sandboxConnecting) {
      return this.sandboxConnecting;
    }

    this.sandboxConnecting = (async () => {
      try {
        console.log("[SessionManager] Connecting to sandbox:", sandboxId);
        const sandbox = await Sandbox.connect(sandboxId, { apiKey });
        this.sandboxRef = sandbox;
        console.log("[SessionManager] Sandbox connected");
        return sandbox;
      } catch (error) {
        console.error("[SessionManager] Failed to connect to sandbox:", error);
        return null;
      } finally {
        this.sandboxConnecting = null;
      }
    })();

    return this.sandboxConnecting;
  }

  getSandbox(): Sandbox | null {
    return this.sandboxRef;
  }

  hasSession(sessionName: string): boolean {
    return this.sessions.has(sessionName);
  }

  getSession(sessionName: string): TerminalSession | undefined {
    return this.sessions.get(sessionName);
  }

  async getOrCreateSession(
    sessionName: string,
    sandboxId: string,
    apiKey: string,
    containerEl: HTMLDivElement
  ): Promise<TerminalSession | null> {
    const existing = this.sessions.get(sessionName);
    if (existing) {
      console.log("[SessionManager] Reusing existing session:", sessionName);
      return existing;
    }

    if (this.initializingSession.has(sessionName)) {
      console.log("[SessionManager] Session already initializing, waiting:", sessionName);
      return this.initializingSession.get(sessionName)!;
    }

    const initPromise = this._createSession(sessionName, sandboxId, apiKey, containerEl);
    this.initializingSession.set(sessionName, initPromise);

    try {
      const session = await initPromise;
      return session;
    } finally {
      this.initializingSession.delete(sessionName);
    }
  }

  private async _createSession(
    sessionName: string,
    sandboxId: string,
    apiKey: string,
    containerEl: HTMLDivElement
  ): Promise<TerminalSession | null> {
    try {
      const sandbox = await this.connectSandbox(sandboxId, apiKey);
      if (!sandbox) {
        console.error("[SessionManager] No sandbox available for session:", sessionName);
        return null;
      }

      const { terminal: xterm, addons } = createEnhancedTerminal(
        { fontSize: 13, scrollback: 5000 },
        "github"
      );

      xterm.open(containerEl);
      loadWebGLRenderer(xterm, addons);

      setTimeout(() => {
        addons.fit.fit();
      }, 50);

      const cols = xterm.cols;
      const rows = xterm.rows;

      const session: TerminalSession = {
        sessionName,
        sandbox,
        pid: 0,
        xterm,
        addons,
        outputBuffer: "",
        isCommandRunning: false,
        currentCommandId: null,
        mountedEntryId: null,
        onDataDisposable: null,
        listeners: new Map(),
      };

      const pty = await sandbox.pty.create({
        cols,
        rows,
        onData: (data: Uint8Array) => {
          const text = new TextDecoder().decode(data);
          xterm.write(data);
          session.outputBuffer += text;

          session.listeners.forEach((listener) => {
            try {
              listener(text);
            } catch (err) {
              console.error("[SessionManager] Listener error:", err);
            }
          });
        },
        timeoutMs: 0,
      });

      session.pid = pty.pid;

      const onDataDisposable = xterm.onData(async (data) => {
        try {
          await sandbox.pty.sendInput(pty.pid, new TextEncoder().encode(data));
        } catch (err) {
          console.error("[SessionManager] Failed to send input:", err);
        }
      });
      session.onDataDisposable = onDataDisposable;

      xterm.onResize(async ({ cols, rows }) => {
        try {
          await sandbox.pty.resize(pty.pid, { cols, rows });
        } catch (err) {
          console.error("[SessionManager] Failed to resize PTY:", err);
        }
      });

      this.sessions.set(sessionName, session);
      console.log("[SessionManager] Session created:", sessionName, "PID:", pty.pid);
      return session;
    } catch (error) {
      console.error("[SessionManager] Failed to create session:", sessionName, error);
      return null;
    }
  }

  async executeCommand(
    sessionName: string,
    command: string,
    commandId: string,
  ): Promise<boolean> {
    if (commandId && this.executedCommandIds.has(commandId)) {
      console.warn("[SessionManager] Duplicate commandId blocked:", commandId, "command:", command);
      return false;
    }

    const session = this.sessions.get(sessionName);
    if (!session) {
      console.error("[SessionManager] No session found for command execution:", sessionName);
      return false;
    }

    if (commandId) {
      this.executedCommandIds.add(commandId);
    }

    session.isCommandRunning = true;
    session.currentCommandId = commandId;
    session.outputBuffer = "";

    try {
      await session.sandbox.pty.sendInput(
        session.pid,
        new TextEncoder().encode(command + "\n")
      );
      console.log("[SessionManager] Command sent:", command, "in session:", sessionName, "commandId:", commandId);
      return true;
    } catch (error) {
      console.error("[SessionManager] Failed to send command:", error);
      session.isCommandRunning = false;
      session.currentCommandId = null;
      return false;
    }
  }

  hasExecutedCommand(commandId: string): boolean {
    return this.executedCommandIds.has(commandId);
  }

  markCommandCompleted(sessionName: string): void {
    const session = this.sessions.get(sessionName);
    if (session) {
      session.isCommandRunning = false;
      session.currentCommandId = null;
    }
  }

  addOutputListener(sessionName: string, listenerId: string, listener: (data: string) => void): void {
    const session = this.sessions.get(sessionName);
    if (session) {
      session.listeners.set(listenerId, listener);
    }
  }

  removeOutputListener(sessionName: string, listenerId: string): void {
    const session = this.sessions.get(sessionName);
    if (session) {
      session.listeners.delete(listenerId);
    }
  }

  mountTerminalToContainer(sessionName: string, containerEl: HTMLDivElement): boolean {
    const session = this.sessions.get(sessionName);
    if (!session) return false;

    const existingParent = session.xterm.element?.parentElement;
    if (existingParent && existingParent !== containerEl) {
      containerEl.appendChild(session.xterm.element!);
    } else if (!existingParent) {
      session.xterm.open(containerEl);
      loadWebGLRenderer(session.xterm, session.addons);
    }

    setTimeout(() => {
      session.addons.fit.fit();
    }, 50);

    return true;
  }

  getOutputBuffer(sessionName: string): string {
    return this.sessions.get(sessionName)?.outputBuffer || "";
  }

  clearOutputBuffer(sessionName: string): void {
    const session = this.sessions.get(sessionName);
    if (session) {
      session.outputBuffer = "";
    }
  }

  destroyAll(): void {
    this.sessions.forEach((session) => {
      try {
        if (session.onDataDisposable) {
          session.onDataDisposable.dispose();
        }
        session.xterm.dispose();
        session.sandbox.pty.kill(session.pid).catch(() => {});
      } catch (err) {
        console.error("[SessionManager] Error during cleanup:", err);
      }
    });
    this.sessions.clear();
    this.sandboxRef = null;
    this.executedCommandIds.clear();
  }
}

export const terminalSessionManager = new TerminalSessionManager();