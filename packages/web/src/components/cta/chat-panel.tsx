'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { FadeUp } from './fade-up';
import { MIcon } from './m-icon';

interface Msg {
  role: 'assistant' | 'user';
  text: string;
}

const SEED: Msg[] = [
  {
    role: 'assistant',
    text: "Welcome to the Vibe Design course! I'll guide you through building stunning websites with AI. What would you like to learn first?",
  },
  {
    role: 'user',
    text: 'I want to learn how to build a hero section with a cinematic video background using AI.',
  },
  {
    role: 'assistant',
    text: "Great choice! In this course, you'll learn how to create full-screen looping videos, liquid glass nav bars, email signups, and manifesto buttons — all with AI assistance. Let's dive in!",
  },
];

interface ChatPanelProps {
  initialScroll?: 'top' | 'bottom';
  animateMessagesIn?: boolean;
}

export function ChatPanel({ initialScroll = 'top', animateMessagesIn = false }: ChatPanelProps) {
  const [messages, setMessages] = useState<Msg[]>(SEED);
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = initialScroll === 'bottom' ? el.scrollHeight : 0;
  }, [initialScroll]);

  function send() {
    const text = draft.trim();
    if (!text) return;
    setMessages((m) => [
      ...m,
      { role: 'user', text },
      { role: 'assistant', text: "Love it — let's build that, section by section. I'll outline the steps next." },
    ]);
    setDraft('');
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="flex h-full flex-col rounded-2xl border border-white/10" style={{ background: 'rgba(8,8,10,0.6)', backdropFilter: 'blur(24px)' }}>
      {/* header */}
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
        <div className="flex size-7 items-center justify-center rounded-full bg-white/5">
          <MIcon name="auto_awesome" size={14} className="text-white/80" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-medium text-white">Vibe Design course</p>
          <p className="text-[11px] text-white/40">Learn how to build website with AI</p>
        </div>
      </div>

      {/* messages */}
      <div ref={scrollRef} className="scrollbar-hide flex-1 space-y-4 overflow-y-auto px-4 py-5">
        {messages.map((m, i) => {
          const bubble = (
            <div className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
              <div
                className={
                  m.role === 'user'
                    ? 'max-w-[85%] rounded-2xl bg-white/15 px-4 py-2.5 text-sm leading-relaxed text-white/90'
                    : 'max-w-[85%] rounded-2xl border border-white/5 bg-white/5 px-4 py-2.5 text-sm leading-relaxed text-white/70'
                }
              >
                {m.text}
              </div>
            </div>
          );
          return animateMessagesIn ? (
            <FadeUp key={i} delay={i * 0.12} y={16}>
              {bubble}
            </FadeUp>
          ) : (
            <div key={i}>{bubble}</div>
          );
        })}
      </div>

      {/* input */}
      <div className="p-3">
        <div className="liquid-glass flex items-end gap-2 rounded-2xl p-2">
          <textarea
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask about the course..."
            aria-label="Message"
            className="max-h-28 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-white placeholder:text-white/40 outline-none"
          />
          <button
            type="button"
            onClick={send}
            aria-label="Send message"
            className="rounded-xl bg-white p-2 text-black transition-opacity hover:opacity-90"
          >
            <MIcon name="arrow_upward" size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
