'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/features/model-builder/components/icons';

type MinaMessage = {
  id: string;
  role: 'assistant' | 'user';
  content: string;
};

type MinaBubbleChatProps = {
  open: boolean;
  busy: boolean;
  provider: 'gemini' | 'gemma';
  messages: MinaMessage[];
  onClose: () => void;
  onProviderChange: (provider: 'gemini' | 'gemma') => void;
  onSend: (message: string) => Promise<void> | void;
};

export function MinaBubbleChat({
  open,
  busy,
  provider,
  messages,
  onClose,
  onProviderChange,
  onSend,
}: MinaBubbleChatProps) {
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) {
      return;
    }
    container.scrollTop = container.scrollHeight;
  }, [messages, busy]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed bottom-[136px] right-[28px] z-[91] flex items-end gap-3">
      <div className="pointer-events-none relative h-[188px] w-[132px] shrink-0">
        <Image
          src="/images/mnist-quest-mina-focused.svg"
          alt="Mina"
          fill
          sizes="132px"
          className="object-contain drop-shadow-[0_22px_34px_rgba(17,81,255,0.18)] animate-mascot-float"
        />
      </div>

      <section className="ui-electric-cyan-border relative w-[min(390px,calc(100vw-176px))] rounded-[30px] px-5 pb-4 pt-5 text-[#10213b] shadow-[0_24px_50px_rgba(15,23,42,0.16)] backdrop-blur-xl">
        <div className="absolute bottom-8 -left-3 h-6 w-6 rotate-45 rounded-[4px] border-[2.5px] border-transparent bg-[linear-gradient(rgba(244,248,255,0.98),rgba(244,248,255,0.98))_padding-box,linear-gradient(135deg,rgba(17,81,255,0.84),rgba(47,108,255,0.78),rgba(90,145,255,0.72),rgba(145,197,255,0.68))_border-box]" />
        <div className="absolute left-6 top-0 inline-flex min-h-[34px] -translate-y-1/2 items-center rounded-full bg-[#f8fafc] px-4 py-1 text-[13px] font-black uppercase tracking-[0.04em] text-[#10213b] shadow-[0_8px_16px_rgba(15,23,42,0.12)] ring-1 ring-[rgba(255,255,255,0.82)]">
          Mina
        </div>

        <div className="flex items-start justify-between gap-3 pt-2">
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#7c8ca5]">
              Quick Guide
            </div>
            <div className="mt-1 font-display text-[18px] font-bold tracking-[-0.04em] text-[#10213b]">
              어떤 블록부터 고치면 좋을까?
            </div>
            <div className="ui-provider-toggle mt-3 inline-flex rounded-full p-1">
              {([
                ['gemini', 'Gemini'],
                ['gemma', 'Gemma'],
              ] as const).map(([value, label]) => {
                const active = provider === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => onProviderChange(value)}
                    className={`rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.08em] transition ${
                      active
                        ? 'ui-provider-toggle-active'
                        : 'text-[#7083a1] hover:text-[#10213b]'
                    }`}
                    aria-pressed={active}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full bg-white/82 text-[#7b8da9] shadow-[0_8px_18px_rgba(15,23,42,0.06)] transition hover:text-[#10213b]"
            aria-label="Mina 말풍선 닫기"
          >
            <span className="text-[18px] leading-none">×</span>
          </button>
        </div>

        <div
          ref={scrollRef}
          className="mt-4 max-h-[250px] space-y-3 overflow-y-auto pr-1"
        >
          {messages.map((message) =>
            message.role === 'assistant' ? (
              <div
                key={message.id}
                className="ui-chat-assistant-bubble rounded-[20px] rounded-tl-[10px] px-4 py-3 text-[13px] leading-6 text-[#24405f] whitespace-pre-wrap"
              >
                {message.content}
              </div>
            ) : (
              <div
                key={message.id}
                className="ui-chat-user-bubble ml-10 rounded-[20px] rounded-tr-[10px] px-4 py-3 text-[13px] font-semibold leading-6 text-white whitespace-pre-wrap"
              >
                {message.content}
              </div>
            ),
          )}

          {busy ? (
            <div className="ui-chat-assistant-bubble rounded-[20px] rounded-tl-[10px] px-4 py-3 text-[13px] font-semibold text-[#5f7390]">
              Mina가 블록 구조를 읽고, 바꿀 지점을 찾고 있어요...
            </div>
          ) : null}
        </div>

        <div className="mt-4 rounded-[22px] border border-[#d7e2f2] bg-white px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                const trimmed = draft.trim();
                if (!trimmed || busy) {
                  return;
                }
                setDraft('');
                void onSend(trimmed);
              }
            }}
            placeholder="예: 지금 구조에서 성능을 올리려면 어디를 먼저 바꾸면 좋을까?"
            className="min-h-[68px] w-full resize-none border-0 bg-transparent text-[13px] leading-6 text-[#18314f] outline-none placeholder:text-[#90a0b8]"
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="text-[11px] font-semibold text-[#7b8da9]">
              {provider === 'gemini'
                ? 'Gemini가 현재 블록 구조와 최근 학습 결과를 같이 참고해요'
                : 'Gemma가 현재 블록 구조와 최근 학습 결과를 같이 참고해요'}
            </div>
            <button
              type="button"
              disabled={busy || draft.trim().length === 0}
              onClick={() => {
                const trimmed = draft.trim();
                if (!trimmed || busy) {
                  return;
                }
                setDraft('');
                void onSend(trimmed);
              }}
              className="ui-lime-action inline-flex items-center gap-2 rounded-[16px] px-4 py-2.5 text-[12px] font-extrabold tracking-[0.06em] disabled:cursor-not-allowed disabled:opacity-55"
            >
              <Icon name="help" className="h-4 w-4" />
              Ask
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export type { MinaMessage };
