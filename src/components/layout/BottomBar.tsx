import { useNoteGeneration } from '@/hooks/useNoteGeneration';
import { useSessionStore } from '@/stores/useSessionStore';
import { useToast } from '@/hooks/use-toast';

export default function BottomBar() {
  const { generateNote, isGeneratingNotes } = useNoteGeneration();
  const activeTab = useSessionStore((s) => s.activeTab);
  const setSelectedTemplate = useSessionStore((s) => s.setSelectedTemplate);
  const { toast } = useToast();

  const handleQuickAction = async (action: string) => {
    setSelectedTemplate(action);
    try {
      await generateNote(action);
      toast({ title: `${action} generated`, description: 'Summary is ready in the Notes tab.' });
    } catch (err: any) {
      toast({
        title: 'Generation failed',
        description: err?.message || 'Could not generate summary.',
        variant: 'destructive',
      });
    }
  };

  if (activeTab !== 'notes') return null;

  return (
    <div className="shrink-0 flex gap-1.5 px-5 py-2 bg-card border-t border-border-light">
      {[
        { label: 'Referral Letter', action: 'Referral Letter' },
        { label: 'Discharge Summary', action: 'Discharge Summary' },
      ].map((item) => (
        <button
          key={item.action}
          onClick={() => handleQuickAction(item.action)}
          disabled={isGeneratingNotes}
          className="px-3 py-1.5 text-[12px] font-medium bg-sand border border-border rounded-md cursor-pointer text-text-secondary hover:bg-sand-dark hover:text-bark hover:border-bark-muted transition-all duration-100 disabled:opacity-50"
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
