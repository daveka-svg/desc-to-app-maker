import { useState, useRef, useEffect } from 'react';
import { Info, Send, Loader2 } from 'lucide-react';
import { useAskETV } from '@/hooks/useAskETV';
import { useSessionStore } from '@/stores/useSessionStore';

export default function BottomBar() {
  const [input, setInput] = useState('');
  const { sendMessage, isChatStreaming } = useAskETV();
  const chatMessages = useSessionStore((s) => s.chatMessages);
  const activeTab = useSessionStore((s) => s.activeTab);
  const [showChat, setShowChat] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSend = async () => {
    if (!input.trim() || isChatStreaming) return;
    const msg = input;
    setInput('');
    setShowChat(true);
    await sendMessage(msg);
  };

  const handleQuickAction = async (action: string) => {
    setShowChat(true);
    await sendMessage(`Create a ${action} using the current consultation context. Return the full final text ready to copy.`);
  };

  return (
    <div className="shrink-0">
      {showChat && chatMessages.length > 0 && (
        <div className="max-h-[200px] overflow-y-auto px-5 py-3 bg-card border-t border-border-light space-y-2">
          {chatMessages.map((msg) => (
            <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] px-3 py-2 rounded-lg text-xs leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user' ? 'bg-forest text-primary-foreground' : 'bg-sand text-text-primary'
              }`}>
                {msg.content || (isChatStreaming ? '...' : '')}
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
      )}

      {activeTab === 'notes' && (
        <div className="flex gap-1.5 px-5 py-2 bg-card border-t border-border-light">
          {[
            { label: 'Referral Letter', icon: '📄', action: 'Referral Letter' },
            { label: 'Discharge Summary', icon: '📋', action: 'Discharge Summary' },
          ].map((c) => (
            <button
              key={c.action}
              onClick={() => handleQuickAction(c.action)}
              disabled={isChatStreaming}
              className="px-3 py-1.5 text-[12px] font-medium bg-sand border border-border rounded-md cursor-pointer text-text-secondary hover:bg-sand-dark hover:text-bark hover:border-bark-muted transition-all duration-100 disabled:opacity-50 flex items-center gap-1.5"
            >
              <span>{c.icon}</span> {c.label}
            </button>
          ))}
          {showChat && (
            <button onClick={() => setShowChat(false)} className="ml-auto px-2 py-1 text-xs text-text-muted hover:text-text-primary">
              Hide chat
            </button>
          )}
        </div>
      )}

      <div className="flex items-center gap-2.5 px-5 py-2.5 bg-card border-t border-border">
        <div className="w-7 h-7 rounded-full bg-etv-olive flex items-center justify-center shrink-0">
          <Info size={14} className="text-primary-foreground" />
        </div>
        <div className="flex-1">
          <input
            className="w-full px-3.5 py-2.5 border border-border rounded-md text-[13px] outline-none bg-sand text-text-primary placeholder:text-text-muted focus:border-bark-muted focus:bg-card transition-colors"
            placeholder="Ask ETV to do anything..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            disabled={isChatStreaming}
          />
        </div>
        <button
          onClick={handleSend}
          disabled={isChatStreaming || !input.trim()}
          className="w-[34px] h-[34px] rounded-full bg-forest flex items-center justify-center cursor-pointer transition-all duration-150 disabled:opacity-40"
        >
          {isChatStreaming ? <Loader2 size={16} className="text-primary-foreground animate-spin" /> : <Send size={16} className="text-primary-foreground" />}
        </button>
      </div>
    </div>
  );
}
