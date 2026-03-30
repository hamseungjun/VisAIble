'use client';

import type { CompetitionLeaderboard } from '@/types/builder';

type CompetitionRankModalProps = {
  roomTitle: string;
  leaderboard: CompetitionLeaderboard | null;
  isHost: boolean;
  onClose: () => void;
};

export function CompetitionRankModal({
  roomTitle,
  leaderboard,
  isHost,
  onClose,
}: CompetitionRankModalProps) {
  return (
    <div className="fixed inset-0 z-[120] bg-[rgba(13,27,51,0.42)] px-5 py-10 backdrop-blur-md">
      <div className="mx-auto flex h-full w-full max-w-[980px] flex-col overflow-hidden rounded-[32px] border border-white/70 bg-[linear-gradient(180deg,#fbfdff,#f2f7ff)] shadow-[0_28px_90px_rgba(13,27,51,0.22)]">
        <div className="flex items-start justify-between gap-4 border-b border-line px-7 py-6">
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-muted">
              Competition Rank
            </div>
            <div className="mt-1 font-display text-[28px] font-bold text-ink">{roomTitle}</div>
            <div className="mt-2 text-[12px] font-semibold text-[#6b7d98]">
              {isHost ? 'Host view: private leaderboard visible' : 'Member view: public leaderboard only'}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-full bg-white text-[20px] font-bold text-muted shadow-[0_10px_24px_rgba(13,27,51,0.08)] transition-colors hover:text-ink"
            aria-label="Close rank modal"
          >
            ×
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-7 py-6">
          {(leaderboard?.entries ?? []).length > 0 ? (
            <div className="grid gap-3">
              {leaderboard?.entries.map((entry) => (
                <div
                  key={`${entry.participantId}-${entry.submittedAt}`}
                  className="rounded-[24px] bg-white/88 px-5 py-4 shadow-[0_18px_40px_rgba(13,27,51,0.06)]"
                >
                  <div className="flex items-center gap-4">
                    <div className="grid h-12 w-12 place-items-center rounded-full bg-[#eef3ff] font-display text-[18px] font-bold text-primary">
                      {entry.rank}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-display text-[18px] font-bold text-ink">
                        {entry.participantName}
                      </div>
                      <div className="mt-1 text-[12px] font-semibold text-[#667995]">
                        Validation {Math.round(entry.validationAccuracy * 10000) / 100}% · Train{' '}
                        {Math.round(entry.trainAccuracy * 10000) / 100}%
                      </div>
                    </div>
                    <div className="rounded-full bg-[#eef3ff] px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-primary">
                      {entry.isBaseline ? 'baseline' : entry.role}
                    </div>
                  </div>

                  <div className={`mt-4 grid ${isHost ? 'grid-cols-2' : 'grid-cols-1'} gap-3`}>
                    <div className="rounded-[18px] bg-[#f5f8ff] px-4 py-3">
                      <div className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">
                        Public Score
                      </div>
                      <div className="mt-1 font-display text-[20px] font-bold text-primary">
                        {Math.round(entry.publicScore * 10000) / 100}%
                      </div>
                    </div>
                    {isHost ? (
                      <div className="rounded-[18px] bg-[#f5f8ff] px-4 py-3">
                        <div className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">
                          Private Score
                        </div>
                        <div className="mt-1 font-display text-[20px] font-bold text-ink">
                          {entry.privateScore == null
                            ? '-'
                            : `${Math.round(entry.privateScore * 10000) / 100}%`}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-[24px] bg-white/82 px-6 py-8 text-[15px] font-semibold text-muted shadow-[0_16px_36px_rgba(13,27,51,0.06)]">
              아직 leaderboard에 제출된 기록이 없습니다.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
