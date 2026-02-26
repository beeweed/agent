interface ThinkingIndicatorProps {
  iteration: number;
  maxIterations: number;
}

function AnygentLogo() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Modern stylized "A" letter - clean geometric design */}
      <path 
        d="M12 2L3 22H7.5L9.5 17H14.5L16.5 22H21L12 2Z" 
        fill="url(#goldGradientThinking)"
      />
      <path 
        d="M10.5 14L12 9L13.5 14H10.5Z" 
        fill="#1a1a1a"
      />
      <defs>
        <linearGradient id="goldGradientThinking" x1="12" y1="2" x2="12" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffe066"/>
          <stop offset="50%" stopColor="#ffc700"/>
          <stop offset="100%" stopColor="#e6a800"/>
        </linearGradient>
      </defs>
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