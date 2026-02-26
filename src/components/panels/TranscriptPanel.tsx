import { useSessionStore } from '@/stores/useSessionStore';

export default function TranscriptPanel() {
  const { transcript } = useSessionStore();

  return (
    <div className="p-6 overflow-y-auto flex-1">
      <div className="bg-card rounded-lg p-6 border border-border-light text-sm leading-[1.8] text-text-primary">
        {transcript.split('\n\n').map((para, i) => (
          <p key={i} className="mb-3.5">{para}</p>
        ))}
        <div className="flex items-center gap-1.5 text-xs font-semibold text-forest mt-2">
          <span className="w-1.5 h-1.5 bg-forest rounded-full animate-pulse-dot" />
          Listening...
        </div>
      </div>
    </div>
  );
}
