import { Pen, ClipboardList, Book, Settings } from 'lucide-react';
import { useSessionStore } from '@/stores/useSessionStore';

const sessions = [
  { name: 'Bella — Vomiting', time: '2:32 PM', active: true, date: '25/02/2026' },
  { name: 'Unknown Session', time: '1:15 PM', active: false, date: '25/02/2026' },
  { name: 'Limping leg', time: '6:34 PM', active: false, date: '24/02/2026' },
  { name: 'Vaccination — Kitten', time: '4:10 PM', active: false, date: '24/02/2026' },
  { name: 'Dental check', time: '11:20 AM', active: false, date: '24/02/2026' },
];

export default function Sidebar() {
  const { tasksOpen, toggleTasks } = useSessionStore();
  const grouped = sessions.reduce<Record<string, typeof sessions>>((acc, s) => {
    (acc[s.date] ||= []).push(s);
    return acc;
  }, {});

  return (
    <aside className="w-[220px] bg-card border-r border-border flex flex-col shrink-0">
      {/* Brand */}
      <div className="flex items-center gap-2 px-4 pt-4 pb-3.5">
        <img
          src="https://static.tildacdn.one/tild3432-6132-4832-b730-356434303630/horizontal-logo-gree.svg"
          alt="ETV"
          className="h-[26px]"
        />
        <span className="text-[9px] font-bold bg-sand text-bark-muted px-1.5 py-0.5 rounded tracking-wide uppercase">
          Scribe
        </span>
      </div>

      {/* New session */}
      <button className="mx-3 mb-3 py-2.5 px-4 bg-forest text-primary-foreground border-none rounded-md text-[13px] font-semibold cursor-pointer flex items-center justify-center gap-2 hover:bg-forest-dark transition-colors duration-150">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        New session
      </button>

      {/* Nav */}
      <nav className="px-2 flex flex-col gap-px">
        <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-semibold cursor-pointer bg-sand-dark text-bark">
          <Pen size={17} className="opacity-100 shrink-0" />
          Scribe
        </div>
        <div
          className="flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-medium cursor-pointer text-text-secondary hover:bg-sand hover:text-text-primary transition-all duration-100"
          onClick={toggleTasks}
        >
          <ClipboardList size={17} className="opacity-65 shrink-0" />
          Tasks
          <span className="ml-auto text-[10px] font-bold bg-etv-pink text-bark px-[7px] py-px rounded-[10px]">8</span>
        </div>
      </nav>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto border-t border-border-light mt-2.5">
        <div className="flex px-4 pt-2.5 gap-0">
          <div className="px-3.5 py-1.5 text-xs font-semibold text-bark cursor-pointer border-b-2 border-transparent relative">
            Upcoming
            <span className="absolute -top-0.5 -right-2 w-[5px] h-[5px] bg-warning rounded-full" />
          </div>
          <div className="px-3.5 py-1.5 text-xs font-semibold text-bark cursor-pointer border-b-2 border-bark">
            Past
          </div>
        </div>
        {Object.entries(grouped).map(([date, items]) => (
          <div key={date}>
            <div className="px-4 pt-3 pb-1 text-[11px] font-semibold text-text-muted uppercase">{date}</div>
            {items.map((s, i) => (
              <div
                key={i}
                className={`flex items-center gap-2.5 px-4 py-2 cursor-pointer transition-colors duration-100 ${
                  s.active ? 'bg-sand-dark' : 'hover:bg-sand'
                }`}
              >
                <div className={`w-2 h-2 rounded-full shrink-0 ${s.active ? 'bg-etv-olive' : 'bg-text-muted'}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-text-primary truncate">{s.name}</div>
                  <div className="text-[11px] text-text-muted">{s.time}</div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Bottom */}
      <div className="border-t border-border-light">
        <nav className="px-2 pb-1">
          <div className="text-[10px] font-bold uppercase tracking-[0.8px] text-text-muted px-2.5 pt-3 pb-1">Library</div>
          <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-medium cursor-pointer text-text-secondary hover:bg-sand transition-all duration-100">
            <Book size={17} className="opacity-65 shrink-0" />
            Templates
          </div>
          <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-medium cursor-pointer text-text-secondary hover:bg-sand transition-all duration-100">
            <Settings size={17} className="opacity-65 shrink-0" />
            Settings
          </div>
        </nav>
        <div className="px-3.5 py-3 border-t border-border-light flex items-center gap-2.5 cursor-pointer hover:bg-sand">
          <div className="w-[30px] h-[30px] rounded-full bg-lavender flex items-center justify-center text-[11px] font-bold text-primary-foreground">
            VE
          </div>
          <div>
            <div className="text-[13px] font-semibold text-text-primary">Veronika Efimova</div>
            <div className="text-[11px] text-text-muted truncate max-w-[140px]">veronika@everytailvets.c...</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
