import { useEffect, useRef, useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import { useAskETV } from '@/hooks/useAskETV';
import { useSessionStore } from '@/stores/useSessionStore';

export default function ChatPanel() {
  const [input, setInput] = useState('');
  const { sendMessage, isChatStreaming } = useAskETV();
  const chatMessages = useSessionStore((s) => s.chatMessages);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSend = async () => {
    if (!input.trim() || isChatStreaming) return;
    const msg = input;
    setInput('');
    await sendMessage(msg);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-5 py-3 bg-card border-b border-border-light">
        <h2 className="text-[14px] font-semibold text-bark">Chat With Consultation</h2>
        <p className="text-xs text-text-muted">
          Ask follow-up questions based on transcript, PE findings, and generated notes.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2 bg-cream">
        {chatMessages.length === 0 ? (
          <div className="text-xs text-text-muted text-center py-8">
            Ask a question to start the consultation chat.
          </div>
        ) : (
          chatMessages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[78%] px-3 py-2 rounded-lg text-xs leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user' ? 'bg-forest text-primary-foreground' : 'bg-card text-text-primary border border-border-light'
                }`}
              >
                {msg.content || (isChatStreaming ? '...' : '')}
              </div>
            </div>
          ))
        )}
        <div ref={chatEndRef} />
      </div>

      <div className="flex items-center gap-2.5 px-5 py-2.5 bg-card border-t border-border">
        <input
          className="flex-1 px-3.5 py-2.5 border border-border rounded-md text-[13px] outline-none bg-sand text-text-primary placeholder:text-text-muted focus:border-bark-muted focus:bg-card transition-colors"
          placeholder="Ask about this consultation..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          disabled={isChatStreaming}
        />
        <button
          onClick={handleSend}
          disabled={isChatStreaming || !input.trim()}
          className="w-[34px] h-[34px] rounded-full bg-forest flex items-center justify-center cursor-pointer transition-all duration-150 disabled:opacity-40"
        >
          {isChatStreaming ? (
            <Loader2 size={16} className="text-primary-foreground animate-spin" />
          ) : (
            <Send size={16} className="text-primary-foreground" />
          )}
        </button>
      </div>
    </div>
  );
}
