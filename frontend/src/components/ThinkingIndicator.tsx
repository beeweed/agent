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
      {/* Logo and branding on top */}
      <div className="flex flex-col items-start mb-4">
        <div className="mb-1 animate-pulse">
          <AnygentLogo />
        </div>
        <span className="font-bold text-base">
          <span className="text-purple-400">Anygent</span>
          <span className="text-foreground"> AI</span>
        </span>
      </div>
      
      {/* Thinking status below */}
      <div>
        {iteration > 0 && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/20 mb-3">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></div>
            <span className="text-[11px] font-medium text-primary">
              Iteration {iteration}/{maxIterations}
            </span>
          </div>
        )}
        
        <div className="flex items-center gap-2 text-lg text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-muted-foreground loading-dot"></div>
            <div className="w-2 h-2 rounded-full bg-muted-foreground loading-dot"></div>
            <div className="w-2 h-2 rounded-full bg-muted-foreground loading-dot"></div>
          </div>
          <span>Thinking...</span>
        </div>
      </div>
    </div>
  );
}