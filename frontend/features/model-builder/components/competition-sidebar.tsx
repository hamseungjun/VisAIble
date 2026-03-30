'use client';

import { useMemo, useState } from 'react';
import { Inspector } from '@/features/model-builder/components/inspector';
import type {
  CompetitionRoomSession,
  CompetitionSubmissionResult,
  TrainingJobStatus,
} from '@/types/builder';

type CompetitionRunRecord = {
  jobId: string;
  trainAccuracy: number;
  validationAccuracy: number;
  submitted: boolean;
  submission?: CompetitionSubmissionResult | null;
  completedAt?: string | null;
};

type CompetitionSidebarProps = {
  room: CompetitionRoomSession;
  trainingStatus: TrainingJobStatus | null;
  liveHistory: {
    loss: number[];
    accuracy: number[];
    validationLoss: number[];
    validationAccuracy: number[];
  };
  runs: CompetitionRunRecord[];
  selectedRunJobId: string | null;
  submitBusy: boolean;
  onSelectRun: (jobId: string) => void;
  onSubmitSelected: () => void;
};

function formatPercent(value: number | null | undefined) {
  if (value == null) {
    return '-';
  }

  return `${Math.round(value * 10000) / 100}%`;
}

export function CompetitionSidebar({
  room,
  trainingStatus,
  liveHistory,
  runs,
  selectedRunJobId,
  submitBusy,
  onSelectRun,
  onSubmitSelected,
}: CompetitionSidebarProps) {
  const [mode, setMode] = useState<'overview' | 'metrics'>('overview');
  const selectedRun = runs.find((run) => run.jobId === selectedRunJobId) ?? null;
  const isHost = room.participantRole === 'host';
  const bestPublicScore = useMemo(() => {
    const scoredRuns = runs.filter((run) => run.submission?.publicScore != null);

    if (scoredRuns.length === 0) {
      return null;
    }

    return Math.max(...scoredRuns.map((run) => run.submission?.publicScore ?? 0));
  }, [runs]);

  return (
    <aside className="grid min-h-0 content-start gap-3">
      <section className="rounded-[24px] border border-[#dbe5f1] bg-white px-4 py-4 shadow-[0_16px_34px_rgba(15,23,42,0.06)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#71839d]">
              Competition workspace
            </div>
            <div className="mt-1 font-display text-[22px] font-bold text-[#10213b]">{room.title}</div>
            <div className="mt-2 text-[12px] font-semibold text-[#64748b]">
              {room.participants.length} participants · {room.participantRole}
            </div>
          </div>
          <div className="flex rounded-full bg-[#eef4fb] p-1">
            <button
              type="button"
              onClick={() => setMode('overview')}
              className={[
                'rounded-full px-3 py-2 text-[11px] font-extrabold uppercase tracking-[0.14em] transition',
                mode === 'overview' ? 'bg-[#2563eb] text-white' : 'text-[#2563eb]',
              ].join(' ')}
            >
              Overview
            </button>
            <button
              type="button"
              onClick={() => setMode('metrics')}
              className={[
                'rounded-full px-3 py-2 text-[11px] font-extrabold uppercase tracking-[0.14em] transition',
                mode === 'metrics' ? 'bg-[#2563eb] text-white' : 'text-[#2563eb]',
              ].join(' ')}
            >
              Metrics
            </button>
          </div>
        </div>
      </section>

      {mode === 'metrics' ? (
        <Inspector
          trainingStatus={trainingStatus}
          liveHistory={liveHistory}
          showDecisionBoundary={false}
          showMnistCanvas={false}
        />
      ) : (
        <section className="grid min-h-0 content-start gap-3 rounded-[24px] border border-[#dbe5f1] bg-[#f8fbff] px-4 py-4 shadow-[0_16px_34px_rgba(15,23,42,0.06)]">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[18px] border border-[#dbe5f1] bg-white px-4 py-4">
              <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#7b8da8]">
                Best public
              </div>
              <div className="mt-2 font-display text-[22px] font-bold text-[#2563eb]">
                {formatPercent(bestPublicScore)}
              </div>
            </div>
            <div className="rounded-[18px] border border-[#dbe5f1] bg-white px-4 py-4">
              <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#7b8da8]">
                Selected run
              </div>
              <div className="mt-2 font-display text-[22px] font-bold text-[#10213b]">
                {selectedRun ? 'Ready' : 'None'}
              </div>
            </div>
            <div className="rounded-[18px] border border-[#dbe5f1] bg-white px-4 py-4">
              <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#7b8da8]">
                Queue
              </div>
              <div className="mt-2 font-display text-[22px] font-bold text-[#10213b]">{runs.length}</div>
            </div>
          </div>

          <div className="rounded-[22px] border border-[#dbe5f1] bg-white px-4 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#71839d]">
                  Submission panel
                </div>
                <div className="mt-1 font-display text-[22px] font-bold text-[#10213b]">
                  Review selected run
                </div>
              </div>
              <button
                type="button"
                onClick={onSubmitSelected}
                disabled={!selectedRun || submitBusy}
                className="rounded-[14px] bg-[#2563eb] px-4 py-2 text-[12px] font-extrabold uppercase tracking-[0.14em] text-white shadow-[0_14px_28px_rgba(37,99,235,0.22)] disabled:opacity-50"
              >
                {submitBusy ? 'Submitting...' : 'Submit Run'}
              </button>
            </div>

            {selectedRun ? (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-[18px] bg-[#f5f8fd] px-4 py-4">
                  <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#7b8da8]">
                    Validation
                  </div>
                  <div className="mt-2 font-display text-[20px] font-bold text-[#10213b]">
                    {formatPercent(selectedRun.validationAccuracy)}
                  </div>
                </div>
                <div className="rounded-[18px] bg-[#f5f8fd] px-4 py-4">
                  <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#7b8da8]">
                    Public leaderboard
                  </div>
                  <div className="mt-2 font-display text-[20px] font-bold text-[#2563eb]">
                    {formatPercent(selectedRun.submission?.publicScore)}
                  </div>
                </div>
                <div className="rounded-[18px] bg-[#f5f8fd] px-4 py-4">
                  <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#7b8da8]">
                    Train accuracy
                  </div>
                  <div className="mt-2 font-display text-[20px] font-bold text-[#10213b]">
                    {formatPercent(selectedRun.trainAccuracy)}
                  </div>
                </div>
                <div className="rounded-[18px] bg-[#f5f8fd] px-4 py-4">
                  <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#7b8da8]">
                    {isHost ? 'Private leaderboard' : 'Submission status'}
                  </div>
                  <div className="mt-2 font-display text-[20px] font-bold text-[#10213b]">
                    {isHost
                      ? formatPercent(selectedRun.submission?.privateScore)
                      : selectedRun.submitted
                        ? 'Submitted'
                        : 'Pending'}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-[18px] bg-[#f5f8fd] px-4 py-4 text-[13px] leading-6 text-[#5d6d84]">
                Select a completed training run to compare validation performance with the competition score.
              </div>
            )}
          </div>

          <div className="grid min-h-0 gap-2.5">
            {runs.length > 0 ? (
              runs.map((run, index) => {
                const active = selectedRunJobId === run.jobId;

                return (
                  <button
                    key={run.jobId}
                    type="button"
                    onClick={() => onSelectRun(run.jobId)}
                    className={[
                      'rounded-[20px] border px-4 py-4 text-left transition',
                      active
                        ? 'border-[#bfdbfe] bg-white shadow-[0_14px_30px_rgba(59,130,246,0.12)]'
                        : 'border-[#dbe5f1] bg-white hover:border-[#c7d6e8]',
                    ].join(' ')}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-display text-[17px] font-bold text-[#10213b]">
                          Run {runs.length - index}
                        </div>
                        <div className="mt-1 text-[12px] font-semibold text-[#6c7c94]">
                          {run.completedAt ? new Date(run.completedAt).toLocaleString() : 'Completed run'}
                        </div>
                      </div>
                      <div
                        className={[
                          'rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.14em]',
                          run.submitted ? 'bg-[#dbeafe] text-[#2563eb]' : 'bg-[#eef2f7] text-[#60718a]',
                        ].join(' ')}
                      >
                        {run.submitted ? 'submitted' : 'ready'}
                      </div>
                    </div>

                    <div className={`mt-4 grid gap-3 ${isHost ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
                      <div className="rounded-[16px] bg-[#f5f8fd] px-3 py-3">
                        <div className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#7b8da8]">
                          Validation
                        </div>
                        <div className="mt-1 font-display text-[16px] font-bold text-[#10213b]">
                          {formatPercent(run.validationAccuracy)}
                        </div>
                      </div>
                      <div className="rounded-[16px] bg-[#f5f8fd] px-3 py-3">
                        <div className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#7b8da8]">
                          Public
                        </div>
                        <div className="mt-1 font-display text-[16px] font-bold text-[#2563eb]">
                          {formatPercent(run.submission?.publicScore)}
                        </div>
                      </div>
                      {isHost ? (
                        <div className="rounded-[16px] bg-[#f5f8fd] px-3 py-3">
                          <div className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#7b8da8]">
                            Private
                          </div>
                          <div className="mt-1 font-display text-[16px] font-bold text-[#10213b]">
                            {formatPercent(run.submission?.privateScore)}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="rounded-[20px] border border-[#dbe5f1] bg-white px-4 py-6 text-[13px] font-semibold text-[#60718a]">
                No completed runs yet. Finish a training job and it will appear here as a submission candidate.
              </div>
            )}
          </div>
        </section>
      )}
    </aside>
  );
}
