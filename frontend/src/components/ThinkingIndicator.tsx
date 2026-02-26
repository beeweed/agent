interface ThinkingIndicatorProps {
  iteration: number;
  maxIterations: number;
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

export function ThinkingIndicator(_props: ThinkingIndicatorProps) {
  return (
    <div data-design-id="thinking-indicator" className="animate-fade-in">
      <div className="flex flex-col items-start">
        <div className="mb-1.5 xs:mb-2 animate-pulse">
          <AnygentLogo />
        </div>
        
        <div className="flex items-baseline gap-0.5 xs:gap-1">
          <span className="font-bold text-sm xs:text-base text-purple-400">Anygent</span>
          <span className="text-muted-foreground text-sm xs:text-base">thinking</span>
          <span className="thinking-dots text-muted-foreground text-sm xs:text-base">
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
        
        
      </div>
    </div>
  );
}