interface ThinkingIndicatorProps {
  iteration: number;
  maxIterations: number;
}

export function ThinkingIndicator({ iteration, maxIterations }: ThinkingIndicatorProps) {
  return (
    <div data-design-id="thinking-indicator" className="flex gap-3 animate-fade-in">
      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center flex-shrink-0 animate-pulse-glow">
        <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
        </svg>
      </div>
      <div className="flex flex-col gap-2">
        {iteration > 0 && (
          <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-primary/10 border border-primary/20">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></div>
            <span className="text-[10px] font-medium text-primary">
              Iteration {iteration}/{maxIterations}
            </span>
          </div>
        )}
        <div className="flex items-center gap-1 px-3 py-2">
          <div className="w-2 h-2 rounded-full bg-primary thinking-dot"></div>
          <div className="w-2 h-2 rounded-full bg-primary thinking-dot"></div>
          <div className="w-2 h-2 rounded-full bg-primary thinking-dot"></div>
        </div>
      </div>
    </div>
  );
}