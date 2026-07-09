interface ThinkingIndicatorProps {
  iteration: number;
  maxIterations: number;
  mode?: "thinking" | "creating-sandbox";
  message?: string;
}

function AnygentLogo() {
  return (
    <img
      src="/anygent-logo.png"
      alt="Anygent AI"
      className="w-12 h-12 xs:w-14 xs:h-14 sm:w-16 sm:h-16 object-contain"
    />
  );
}

export function ThinkingIndicator({ mode = "thinking", message }: ThinkingIndicatorProps) {
  const isSandboxMode = mode === "creating-sandbox";

  return (
    <div data-design-id="thinking-indicator" className="animate-fade-in">
      <div className="flex flex-col items-start gap-2.5">
        <div className={`mb-1.5 xs:mb-2 ${isSandboxMode ? "sandbox-orbit-wrapper" : "animate-pulse"}`}>
          <AnygentLogo />
        </div>

        <div className={`relative overflow-hidden rounded-2xl border px-4 py-3 ${isSandboxMode ? "sandbox-status-pill sandbox-status-shine border-cyan-400/25 bg-cyan-400/8" : "border-border bg-card"}`}>
          <div className="flex items-baseline gap-1 flex-wrap">
            <span className={`font-bold text-sm xs:text-base ${isSandboxMode ? "text-cyan-300" : "text-purple-400"}`}>Anygent</span>
            <span className="text-muted-foreground text-sm xs:text-base">
              {isSandboxMode ? "creating sandbox" : "thinking"}
            </span>
            <span className={`thinking-dots text-sm xs:text-base ${isSandboxMode ? "text-cyan-200/80" : "text-muted-foreground"}`}>
              <span className="dot">.</span>
              <span className="dot">.</span>
              <span className="dot">.</span>
              <span className="dot">.</span>
            </span>
          </div>
          {message && (
            <p className={`mt-1.5 text-xs ${isSandboxMode ? "text-cyan-100/80" : "text-muted-foreground"}`}>
              {message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}