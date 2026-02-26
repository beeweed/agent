interface ThinkingIndicatorProps {
  iteration: number;
  maxIterations: number;
}

function AnygentLogo() {
  return (
    <img 
      src="/anygent-logo.png" 
      alt="Anygent AI" 
      className="w-6 h-6 object-contain"
    />
  );
}

export function ThinkingIndicator({ iteration, maxIterations }: ThinkingIndicatorProps) {
  return (
    <div data-design-id="thinking-indicator" className="animate-fade-in">
      <div className="flex items-center gap-2 mb-3">
        <div 
          className="w-8 h-8 flex items-center justify-center flex-shrink-0 animate-pulse"
        >
          <AnygentLogo />
        </div>
        <span className="font-semibold text-sm text-foreground">
          Anygent AI
        </span>
        <span className="text-xs text-muted-foreground">
          thinking...
        </span>
      </div>
      
      <div className="pl-10">
        {iteration > 0 && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/20 mb-3">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></div>
            <span className="text-[11px] font-medium text-primary">
              Iteration {iteration}/{maxIterations}
            </span>
          </div>
        )}
        
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground loading-dot"></div>
            <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground loading-dot"></div>
            <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground loading-dot"></div>
          </div>
          <span>Thinking...</span>
        </div>
      </div>
    </div>
  );
}