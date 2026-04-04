'use client';

import type { CompetitionLeaderboard } from '@/types/builder';

type CompetitionRankModalProps = {
  roomTitle: string;
  leaderboard: CompetitionLeaderboard | null;
  isHost: boolean;
  onClose: () => void;
};

function formatPercent(value: number | null | undefined) {
  if (value == null) {
    return '-';
  }

  return `${Math.round(value * 10000) / 100}%`;
}

export function CompetitionRankModal({
  roomTitle,
  leaderboard,
  isHost,
  onClose,
}: CompetitionRankModalProps) {
  const entryCount = leaderboard?.entries.length ?? 0;
  const bestScore = entryCount > 0 ? leaderboard?.entries[0]?.publicScore ?? null : null;

  return (
    <div className="fixed inset-0 z-[120] bg-[rgba(15,23,42,0.5)] px-5 py-8 backdrop-blur-sm">
      <div className="mx-auto flex h-full w-full max-w-[1120px] flex-col overflow-hidden rounded-[30px] border border-[#dbe5f1] bg-[#f8fbff] shadow-[0_30px_90px_rgba(15,23,42,0.28)]">
        <div className="border-b border-[#dbe5f1] bg-white px-7 py-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#71839d]">
                VisAible Competition
              </div>
              <div className="mt-2 font-display text-[30px] font-bold tracking-[-0.04em] text-[#10213b]">
                {roomTitle}
              </div>
              <div className="mt-2 text-[13px] font-semibold text-[#66768f]">
                {isHost
                  ? '\uD638\uC2A4\uD2B8 \uD654\uBA74\uC5D0\uC11C\uB294 \uC228\uACA8\uC9C4 Private Score\uAE4C\uC9C0 \uD568\uAED8 \uD655\uC778\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.'
                  : '\uCC38\uAC00\uC790 \uD654\uBA74\uC5D0\uC11C\uB294 Public Score\uB9CC \uD45C\uC2DC\uB429\uB2C8\uB2E4.'}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="grid h-10 w-10 place-items-center rounded-full border border-[#dbe5f1] bg-[#f8fbff] text-[20px] font-bold text-[#5f6f86] transition hover:text-[#10213b]"
              aria-label="\uB7AD\uD0B9 \uBAA8\uB2EC \uB2EB\uAE30"
            >
              ×
            </button>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-[18px] border border-[#dbe5f1] bg-[#f8fbff] px-4 py-4">
              <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#7b8da8]">
                Entries
              </div>
              <div className="mt-2 font-display text-[22px] font-bold text-[#10213b]">{entryCount}</div>
            </div>
            <div className="rounded-[18px] border border-[#dbe5f1] bg-[#f8fbff] px-4 py-4">
              <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#7b8da8]">
                Best Public Score
              </div>
              <div className="mt-2 font-display text-[22px] font-bold text-[#2563eb]">
                {formatPercent(bestScore)}
              </div>
            </div>
            <div className="rounded-[18px] border border-[#dbe5f1] bg-[#f8fbff] px-4 py-4">
              <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#7b8da8]">
                Visibility
              </div>
              <div className="mt-2 font-display text-[22px] font-bold text-[#10213b]">
                {isHost ? 'Public + Private' : 'Public Only'}
              </div>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-7 py-6">
          {entryCount > 0 ? (
            <div className="overflow-hidden rounded-[24px] border border-[#dbe5f1] bg-white shadow-[0_16px_36px_rgba(15,23,42,0.06)]">
              <div
                className={`grid gap-3 border-b border-[#e7eef7] bg-[#f8fbff] px-5 py-4 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#71839d] ${isHost ? 'grid-cols-[72px_minmax(180px,1.2fr)_repeat(5,minmax(0,1fr))]' : 'grid-cols-[72px_minmax(180px,1.4fr)_repeat(4,minmax(0,1fr))]'}`}
              >
                <div>Rank</div>
                <div>Team</div>
                <div>Public</div>
                {isHost ? <div>Private</div> : null}
                <div>Validation</div>
                <div>Train</div>
                <div>Status</div>
              </div>

              <div className="grid">
                {leaderboard?.entries.map((entry, index) => (
                  <div
                    key={`${entry.participantId}-${entry.submittedAt}`}
                    className={[
                      'grid gap-3 px-5 py-4 text-[14px] text-[#24364f]',
                      isHost
                        ? 'grid-cols-[72px_minmax(180px,1.2fr)_repeat(5,minmax(0,1fr))]'
                        : 'grid-cols-[72px_minmax(180px,1.4fr)_repeat(4,minmax(0,1fr))]',
                      index !== entryCount - 1 ? 'border-b border-[#eef3f8]' : '',
                    ].join(' ')}
                  >
                    <div className="flex items-center">
                      <div className="grid h-11 w-11 place-items-center rounded-full bg-[#eff6ff] font-display text-[18px] font-bold text-[#2563eb]">
                        {entry.rank}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-display text-[18px] font-bold text-[#10213b]">
                        {entry.participantName}
                      </div>
                      <div className="mt-1 text-[12px] font-semibold text-[#71839d]">
                        {`${entry.role} · ${new Date(entry.submittedAt).toLocaleString()}`}
                      </div>
                    </div>
                    <div className="flex items-center font-display text-[18px] font-bold text-[#2563eb]">
                      {formatPercent(entry.publicScore)}
                    </div>
                    {isHost ? (
                      <div className="flex items-center font-display text-[18px] font-bold text-[#10213b]">
                        {formatPercent(entry.privateScore)}
                      </div>
                    ) : null}
                    <div className="flex items-center font-display text-[18px] font-bold text-[#10213b]">
                      {formatPercent(entry.validationAccuracy)}
                    </div>
                    <div className="flex items-center font-display text-[18px] font-bold text-[#10213b]">
                      {formatPercent(entry.trainAccuracy)}
                    </div>
                    <div className="flex items-center">
                      <span
                        className={[
                          'rounded-full px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.14em]',
                          entry.isBaseline ? 'bg-[#ede9fe] text-[#7c3aed]' : 'bg-[#eef2f7] text-[#5f6f86]',
                        ].join(' ')}
                      >
                        {entry.isBaseline ? 'baseline' : entry.role}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-[24px] border border-[#dbe5f1] bg-white px-6 py-8 text-[15px] font-semibold text-[#60718a] shadow-[0_16px_36px_rgba(15,23,42,0.06)]">
              {'\uC544\uC9C1 \uC81C\uCD9C\uB41C \uAE30\uB85D\uC774 \uC5C6\uC2B5\uB2C8\uB2E4. Run\uC744 \uC81C\uCD9C\uD558\uBA74 \uC774\uACF3\uC5D0 \uC21C\uC704\uAC00 \uD45C\uC2DC\uB429\uB2C8\uB2E4.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
