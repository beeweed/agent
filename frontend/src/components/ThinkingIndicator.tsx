interface ThinkingIndicatorProps {
  iteration: number;
  maxIterations: number;
}

function AnygentLogo() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="6" width="18" height="12" rx="3" fill="#ffc700"/>
      <circle cx="8.5" cy="12" r="2" fill="#34322d"/>
      <circle cx="15.5" cy="12" r="2" fill="#34322d"/>
      <rect x="10" y="3" width="4" height="4" rx="1" fill="#ffc700"/>
      <rect x="11" y="1" width="2" height="3" rx="0.5" fill="#ffc700"/>
      <rect x="6" y="18" width="3" height="3" rx="1" fill="#ffc700"/>
      <rect x="15" y="18" width="3" height="3" rx="1" fill="#ffc700"/>
    </svg>
  );
}

export function ThinkingIndicator({ iteration, maxIterations }: ThinkingIndicatorProps) {
  return (
    <div data-design-id="thinking-indicator" className="animate-fade-in">
      <div className="flex items-center gap-2 mb-3">
        <div 
          className="w-8 h-8 rounded-full bg-[#2d2d2d] border border-primary/30 flex items-center justify-center animate-pulse"
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