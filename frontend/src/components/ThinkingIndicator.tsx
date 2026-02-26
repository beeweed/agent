interface ThinkingIndicatorProps {
  iteration: number;
  maxIterations: number;
}

export function ThinkingIndicator({ iteration, maxIterations }: ThinkingIndicatorProps) {
  return (
    <div data-design-id="thinking-indicator" className="animate-fade-in">
      <div className="flex items-center gap-2 mb-3">
        <div 
          className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center animate-pulse"
        >
          <LemonLogo />
        </div>
        <span className="font-semibold text-sm text-foreground">
          Lemon AI
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

function LemonLogo() {
  return (
    <svg className="w-6 h-6" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="45" fill="#FFC700"/>
      <ellipse cx="50" cy="50" rx="35" ry="40" fill="#FFE066"/>
      <path d="M50 15C45 10 40 8 35 10C30 12 28 18 30 25" stroke="#7CB342" strokeWidth="4" fill="none"/>
    </svg>
  );
}