interface ThinkingIndicatorProps {
  iteration: number;
  maxIterations: number;
}

function AnygentLogo() {
  return (
    <img 
      src="/anygent-logo.png" 
      alt="Anygent AI" 
      className="w-16 h-16 object-contain"
    />
  );
}

export function ThinkingIndicator({ iteration, maxIterations }: ThinkingIndicatorProps) {
  return (
    <div data-design-id="thinking-indicator" className="animate-fade-in">
      <div className="flex flex-col items-start">
        <div className="mb-2 animate-pulse">
          <AnygentLogo />
        </div>
        
        <div className="flex items-baseline gap-1">
          <span className="font-bold text-base text-purple-400">anygent</span>
          <span className="text-muted-foreground text-base">thinking</span>
          <span className="thinking-dots text-muted-foreground text-base">
            <span className="dot">.</span>
            <span className="dot">.</span>
            <span className="dot">.</span>
            <span className="dot">.</span>
            <span className="dot">.</span>
            <span className="dot">.</span>
            <span className="dot">.</span>
            <span className="dot">.</span>
          </span>
        </div>
        
        {iteration > 0 && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/20 mt-3">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></div>
            <span className="text-[11px] font-medium text-primary">
              Iteration {iteration}/{maxIterations}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}