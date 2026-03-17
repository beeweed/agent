export default function ThinkingIndicator() {
  return (
    <div data-design-id="thinking-indicator" className="flex gap-3 animate-fade-in-up">
      <div
        data-design-id="thinking-avatar"
        className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#6366f1]/20 to-[#22d3ee]/20 flex items-center justify-center flex-shrink-0 animate-pulse-glow"
      >
        <svg className="w-4 h-4 text-[#6366f1]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
        </svg>
      </div>
      <div data-design-id="thinking-dots-wrapper" className="flex items-center gap-1 px-3 py-2">
        <div className="w-2 h-2 rounded-full bg-[#6366f1] thinking-dot" />
        <div className="w-2 h-2 rounded-full bg-[#6366f1] thinking-dot" />
        <div className="w-2 h-2 rounded-full bg-[#6366f1] thinking-dot" />
      </div>
    </div>
  );
}