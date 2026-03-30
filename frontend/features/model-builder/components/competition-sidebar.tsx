'use client';

import { useState } from 'react';
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
  const [mode, setMode] = useState<'metrics' | 'submit'>('metrics');
  const selectedRun = runs.find((run) => run.jobId === selectedRunJobId) ?? null;
  const isHost = room.participantRole === 'host';

  return (
    <aside className="grid min-h-0 content-start gap-3">
      <section className="glass-panel ghost-border rounded-[24px] px-4 py-4 shadow-panel">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted">
              Competition Mode
            </div>
            <div className="mt-1 font-display text-[20px] font-bold text-ink">{room.title}</div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMode('metrics')}
              className={[
                'rounded-[12px] px-3 py-2 text-[11px] font-extrabold uppercase tracking-[0.14em] transition-colors',
                mode === 'metrics' ? 'bg-primary text-white' : 'bg-[#eef3ff] text-primary',
              ].join(' ')}
            >
              Metrics
            </button>
            <button
              type="button"
              onClick={() => setMode('submit')}
              className={[
                'rounded-[12px] px-3 py-2 text-[11px] font-extrabold uppercase tracking-[0.14em] transition-colors',
                mode === 'submit' ? 'bg-primary text-white' : 'bg-[#eef3ff] text-primary',
              ].join(' ')}
            >
              Submit
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
        <section className="glass-panel ghost-border grid min-h-0 content-start gap-3 rounded-[24px] px-4 py-4 shadow-panel">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted">
                Competition Submissions
              </div>
              <div className="mt-1 font-display text-[20px] font-bold text-ink">Training Results</div>
            </div>
            <button
              type="button"
              onClick={onSubmitSelected}
              disabled={!selectedRun || submitBusy}
              className="rounded-[14px] bg-[linear-gradient(135deg,#1151ff,#2d66ff)] px-4 py-2 text-[12px] font-extrabold uppercase tracking-[0.14em] text-white disabled:opacity-50"
            >
              {submitBusy ? 'Submitting...' : 'Submit'}
            </button>
          </div>

          {selectedRun ? (
            <div className="rounded-[18px] bg-[#f7faff] px-4 py-3 shadow-[inset_0_0_0_1px_rgba(129,149,188,0.12)]">
              <div className={`grid ${isHost ? 'grid-cols-2' : 'grid-cols-1'} gap-2 text-[12px] font-semibold text-[#4e607b]`}>
                <div>
                  Validation Score {Math.round(selectedRun.validationAccuracy * 10000) / 100}%
                </div>
                <div>
                  Submission Score{' '}
                  {selectedRun.submission
                    ? `${Math.round(selectedRun.submission.publicScore * 10000) / 100}%`
                    : '-'}
                </div>
                <div>Train Acc {Math.round(selectedRun.trainAccuracy * 10000) / 100}%</div>
                {isHost ? (
                  <div>
                    Private Score{' '}
                    {selectedRun.submission?.privateScore == null
                      ? '-'
                      : `${Math.round(selectedRun.submission.privateScore * 10000) / 100}%`}
                  </div>
                ) : null}
                <div>{selectedRun.submitted ? 'Submitted' : 'Not Submitted'}</div>
              </div>
            </div>
          ) : (
            <div className="rounded-[18px] bg-white/82 px-4 py-4 text-[13px] font-semibold text-muted shadow-[0_12px_24px_rgba(13,27,51,0.05)]">
              완료된 training result를 선택하면 submission 점수와 validation 점수를 여기서 바로 확인하고 제출할 수 있습니다.
            </div>
          )}

          <div className="grid gap-2.5">
            {runs.length > 0 ? (
              runs.map((run, index) => (
                <button
                  key={run.jobId}
                  type="button"
                  onClick={() => onSelectRun(run.jobId)}
                  className={[
                    'rounded-[18px] px-4 py-3 text-left shadow-[0_12px_24px_rgba(13,27,51,0.05)] transition-all',
                    selectedRunJobId === run.jobId
                      ? 'bg-[#eef4ff] ring-2 ring-primary/25'
                      : 'bg-white/88 hover:bg-[#f9fbff]',
                  ].join(' ')}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-display text-[15px] font-bold text-ink">Run {runs.length - index}</div>
                      <div className="mt-0.5 text-[11px] font-semibold text-[#667995]">
                        {run.completedAt ? new Date(run.completedAt).toLocaleString() : 'Completed run'}
                      </div>
                    </div>
                    <div className="rounded-full bg-[#eef3ff] px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-primary">
                      {run.submitted ? 'submitted' : 'ready'}
                    </div>
                  </div>
                  <div className={`mt-3 grid ${isHost ? 'grid-cols-2' : 'grid-cols-1'} gap-2`}>
                    <div className="rounded-[14px] bg-[#f5f8ff] px-3 py-2">
                      <div className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-muted">
                        Validation Score
                      </div>
                      <div className="mt-1 font-display text-[15px] font-bold text-ink">
                        {Math.round(run.validationAccuracy * 10000) / 100}%
                      </div>
                    </div>
                    <div className="rounded-[14px] bg-[#f5f8ff] px-3 py-2">
                      <div className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-muted">
                        Submission Score
                      </div>
                      <div className="mt-1 font-display text-[15px] font-bold text-primary">
                        {run.submission
                          ? `${Math.round(run.submission.publicScore * 10000) / 100}%`
                          : '-'}
                      </div>
                    </div>
                    {isHost ? (
                      <div className="rounded-[14px] bg-[#f5f8ff] px-3 py-2">
                        <div className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-muted">
                          Private Score
                        </div>
                        <div className="mt-1 font-display text-[15px] font-bold text-ink">
                          {run.submission?.privateScore == null
                            ? '-'
                            : `${Math.round(run.submission.privateScore * 10000) / 100}%`}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </button>
              ))
            ) : (
              <div className="rounded-[18px] bg-white/82 px-4 py-6 text-[13px] font-semibold text-muted shadow-[0_12px_24px_rgba(13,27,51,0.05)]">
                아직 완료된 학습 결과가 없습니다. 먼저 training을 완료한 뒤 여기서 제출할 run을 선택하면 됩니다.
              </div>
            )}
          </div>
        </section>
      )}
    </aside>
  );
}
