import { Mic, Info } from 'lucide-react';

const quickChips = ['Referral Letter', 'Discharge Summary', 'Client Instructions'];

export default function BottomBar() {
  return (
    <div className="shrink-0">
      <div className="flex gap-1.5 px-5 pb-2 bg-card">
        {quickChips.map((c) => (
          <button
            key={c}
            className="px-3 py-[5px] text-xs font-medium bg-sand border border-border rounded-pill cursor-pointer text-text-secondary hover:bg-sand-dark hover:text-bark hover:border-bark-muted transition-all duration-100"
          >
            {c}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2.5 px-5 py-2.5 bg-card border-t border-border">
        <div className="w-7 h-7 rounded-full bg-etv-olive flex items-center justify-center shrink-0">
          <Info size={14} className="text-primary-foreground" />
        </div>
        <div className="flex-1">
          <input
            className="w-full px-3.5 py-2.5 border border-border rounded-md text-[13px] outline-none bg-sand text-text-primary placeholder:text-text-muted focus:border-bark-muted focus:bg-card transition-colors"
            placeholder="Ask ETV to do anything..."
          />
        </div>
        <button className="w-[34px] h-[34px] rounded-full bg-sand border border-border flex items-center justify-center cursor-pointer hover:bg-etv-pink hover:border-etv-pink transition-all duration-150">
          <Mic size={16} className="text-text-secondary" />
        </button>
      </div>
    </div>
  );
}
