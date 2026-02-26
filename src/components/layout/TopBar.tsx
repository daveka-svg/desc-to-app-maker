import { Calendar, Globe } from 'lucide-react';

export default function TopBar() {
  return (
    <div className="flex items-center justify-between px-5 py-2.5 bg-card border-b border-border min-h-[48px]">
      {/* Left */}
      <div className="flex items-center gap-2.5">
        <input
          className="text-[15px] font-medium text-text-primary border-none outline-none bg-transparent w-[220px] placeholder:text-text-muted"
          placeholder="Add patient details"
        />
      </div>

      {/* Center meta */}
      <div className="flex items-center gap-2.5 flex-wrap">
        <span className="inline-flex items-center gap-1 text-xs text-text-secondary">
          <Calendar size={13} className="opacity-50" /> Today 14:32
        </span>
        <span className="inline-flex items-center gap-1 text-xs text-text-secondary">
          <Globe size={13} className="opacity-50" /> English
        </span>
      </div>

      {/* Right */}
      <div className="flex items-center gap-3.5">
        {/* Timer */}
        <div className="font-mono text-[13px] text-text-secondary flex items-center gap-1.5">
          <span className="w-[7px] h-[7px] rounded-full bg-error animate-pulse-dot" />
          04:32
        </div>

        {/* Mic selector */}
        <div className="flex items-center gap-1.5 text-xs text-text-secondary cursor-pointer px-2 py-1 rounded-md hover:bg-sand">
          Default — Microphone
          <div className="flex items-end gap-[1.5px] h-4">
            {[6, 10, 14, 8, 12].map((h, i) => (
              <div
                key={i}
                className="w-[3px] rounded-sm bg-forest animate-mic-bar"
                style={{ animationDelay: `${i * 0.15}s`, height: `${h}px` }}
              />
            ))}
          </div>
        </div>

        {/* Create */}
        <button className="bg-forest text-primary-foreground border-none px-[18px] py-2 rounded-md text-[13px] font-semibold cursor-pointer flex items-center gap-1.5 hover:bg-forest-dark transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Create
        </button>

        {/* Resume */}
        <button className="bg-sand text-bark border border-border px-4 py-[7px] rounded-md text-[13px] font-semibold cursor-pointer flex items-center gap-1.5 hover:bg-sand-dark transition-colors">
          <div className="flex gap-[1.5px] items-center">
            {[1,2,3,4].map(i => (
              <span key={i} className="w-[3px] h-[10px] bg-bark rounded-sm" />
            ))}
          </div>
          Resume
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
