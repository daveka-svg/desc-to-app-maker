import { useState } from 'react';
import { useSessionStore } from '@/stores/useSessionStore';
import PEForm from '@/components/pe-form/PEForm';

export default function ContextPanel() {
  const { peEnabled, togglePE } = useSessionStore();

  return (
    <div className="p-5 overflow-y-auto flex-1">
      {/* Recording */}
      <div className="bg-card rounded-lg p-[18px] mb-3.5 border border-border-light">
        <div className="text-[11px] font-bold uppercase tracking-[0.6px] text-text-muted mb-2.5">Recording</div>
        <div className="flex flex-col items-center gap-3">
          <div className="font-mono text-[32px] font-semibold text-bark tracking-wide flex items-center gap-2.5">
            <span className="w-[9px] h-[9px] rounded-full bg-error animate-pulse-dot" />
            04:32
          </div>
          {/* Waveform */}
          <div className="flex items-center justify-center gap-[1.5px] h-7 w-full max-w-[360px]">
            {Array.from({ length: 50 }).map((_, i) => (
              <div
                key={i}
                className="w-[2.5px] rounded-sm bg-etv-olive opacity-45 animate-waveform"
                style={{ animationDelay: `${(i * 0.05) % 0.7}s`, height: `${4 + Math.random() * 20}px` }}
              />
            ))}
          </div>
          <div className="flex gap-2.5">
            <button className="inline-flex items-center justify-center gap-1.5 px-[18px] py-[7px] rounded-md text-[13px] font-semibold border border-sand-deeper bg-sand text-warning cursor-pointer hover:bg-sand-dark transition-all duration-[120ms]">
              ⏸ Pause
            </button>
            <button className="inline-flex items-center justify-center gap-1.5 px-[18px] py-[7px] rounded-md text-[13px] font-semibold border border-sand-deeper bg-sand text-error cursor-pointer hover:bg-sand-dark transition-all duration-[120ms]">
              ⏹ End session
            </button>
          </div>
        </div>
      </div>

      {/* Session details */}
      <div className="bg-card rounded-lg p-[18px] mb-3.5 border border-border-light">
        <div className="text-[11px] font-bold uppercase tracking-[0.6px] text-text-muted mb-2.5">Session details</div>
        <div className="flex gap-2.5 mt-1">
          <input
            type="text"
            placeholder="Patient name (optional)"
            className="flex-1 px-3 py-2 border border-border rounded-md text-[13px] outline-none bg-card text-text-primary placeholder:text-text-muted focus:border-bark-muted"
          />
          <select className="flex-1 px-3 py-2 border border-border rounded-md text-[13px] outline-none bg-card text-text-primary">
            <option>General Consult</option>
            <option>Surgical Notes</option>
            <option>Emergency</option>
            <option>Vaccination</option>
          </select>
        </div>
        {/* PE toggle */}
        <div className="flex items-center justify-between mt-3 px-3.5 py-2.5 bg-sand rounded-md">
          <span className="text-[13px] font-medium text-text-secondary flex items-center gap-[7px]">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-50">
              <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" />
              <rect x="8" y="2" width="8" height="4" rx="1" />
            </svg>
            Physical Examination
          </span>
          <div
            className={`relative w-[38px] h-5 rounded-[10px] cursor-pointer transition-colors duration-200 ${peEnabled ? 'bg-forest' : 'bg-sand-deeper'}`}
            onClick={togglePE}
          >
            <div
              className={`absolute top-[2px] w-4 h-4 bg-card rounded-full transition-[left] duration-200 shadow-sm ${peEnabled ? 'left-5' : 'left-[2px]'}`}
            />
          </div>
        </div>
      </div>

      {/* PE Form */}
      {peEnabled && <PEForm />}
    </div>
  );
}
