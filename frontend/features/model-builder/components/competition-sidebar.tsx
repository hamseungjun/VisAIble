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
  onSubmitRun: (jobId: string) => void;
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
  onSubmitRun,
}: CompetitionSidebarProps) {
  const [mode, setMode] = useState<'overview' | 'metrics'>('overview');
  const submittedRuns = runs.filter((run) => run.submitted);
  const selectedRun = submittedRuns.find((run) => run.jobId === selectedRunJobId) ?? null;
  const isHost = room.participantRole === 'host';
  const bestPublicScore = useMemo(() => {
    const scoredRuns = runs.filter((run) => run.submission?.publicScore != null);

    if (scoredRuns.length === 0) {
      return null;
    }

    return Math.max(...scoredRuns.map((run) => run.submission?.publicScore ?? 0));
  }, [runs]);

  return (
    <aside className="grid min-h-0 content-start gap-3 self-start xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto">
      <section className="rounded-[24px] border border-[#dbe5f1] bg-white px-4 py-4 shadow-[0_16px_34px_rgba(15,23,42,0.06)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#71839d]">
              VisAible Competition
            </div>
            <div className="mt-1 font-display text-[22px] font-bold text-[#10213b]">{room.title}</div>
            <div className="mt-2 text-[12px] font-semibold text-[#64748b]">
              {`\uCC38\uAC00\uC790 ${room.participants.length}\uBA85 \u00B7 ${room.participantRole}`}
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
                  Review submitted run
                </div>
              </div>
              <div className="rounded-full bg-[#eef4fb] px-3 py-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#2563eb]">
                Select from submitted runs
              </div>
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
                {'\uC81C\uCD9C\uC774 \uC644\uB8CC\uB41C Run\uB9CC \uC5EC\uAE30\uC11C \uC120\uD0DD\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4. \uBA3C\uC800 \uC644\uB8CC\uB41C Run\uC744 \uC81C\uCD9C\uD55C \uB4A4, \uC120\uD0DD\uD574\uC11C \uB9AC\uB354\uBCF4\uB4DC \uC810\uC218\uB97C \uD655\uC778\uD574 \uBCF4\uC138\uC694.'}
              </div>
            )}
          </div>

          <div className="grid min-h-0 gap-2.5">
            {runs.length > 0 ? (
              runs.map((run, index) => {
                const active = selectedRunJobId === run.jobId;
                const selectable = run.submitted;

                return (
                  <button
                    key={run.jobId}
                    type="button"
                    onClick={() => {
                      if (selectable) {
                        onSelectRun(run.jobId);
                      }
                    }}
                    className={[
                      'rounded-[20px] border px-4 py-4 text-left transition',
                      active
                        ? 'border-[#60a5fa] bg-[linear-gradient(135deg,#ffffff,#eef6ff)] shadow-[0_0_0_2px_rgba(59,130,246,0.18),0_22px_44px_rgba(59,130,246,0.22)] -translate-y-0.5'
                        : selectable
                          ? 'border-[#dbe5f1] bg-white hover:border-[#93c5fd] hover:shadow-[0_14px_30px_rgba(59,130,246,0.10)]'
                          : 'border-[#dbe5f1] bg-white/90 opacity-95',
                    ].join(' ')}
                    disabled={!selectable && submitBusy}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-display text-[17px] font-bold text-[#10213b]">
                          Run {runs.length - index}
                        </div>
                        <div className="mt-1 text-[12px] font-semibold text-[#6c7c94]">
                          {run.completedAt ? new Date(run.completedAt).toLocaleString() : '\uC644\uB8CC\uB41C Run'}
                        </div>
                      </div>
                      <div
                        className={[
                          'rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.14em]',
                          run.submitted
                            ? active
                              ? 'bg-[#2563eb] text-white shadow-[0_8px_18px_rgba(37,99,235,0.25)]'
                              : 'bg-[#dbeafe] text-[#2563eb]'
                            : 'bg-[#eef2f7] text-[#60718a]',
                        ].join(' ')}
                      >
                        {run.submitted ? (active ? 'selected' : 'submitted') : 'completed'}
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

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                      <div className="text-[11px] font-semibold text-[#6c7c94]">
                        {run.submitted
                          ? active
                            ? '\uC120\uD0DD\uB41C \uC81C\uCD9C Run\uC785\uB2C8\uB2E4. \uC544\uB798 \uC810\uC218\uB97C \uC790\uC138\uD788 \uD655\uC778\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.'
                            : '\uC81C\uCD9C\uB41C Run\uC785\uB2C8\uB2E4. \uD074\uB9AD\uD574\uC11C \uC120\uD0DD\uD558\uACE0 \uC810\uC218\uB97C \uD655\uC778\uD558\uC138\uC694.'
                          : '\uBA3C\uC800 Submit \uB2E8\uACC4\uB97C \uC644\uB8CC\uD574\uC57C \uD569\uB2C8\uB2E4. \uC81C\uCD9C\uB41C Run\uB9CC \uC120\uD0DD\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.'}
                      </div>
                      {run.submitted ? (
                        <div
                          className={[
                            'rounded-[12px] px-3 py-2 text-[11px] font-extrabold uppercase tracking-[0.14em]',
                            active ? 'bg-[#2563eb] text-white' : 'bg-[#eef4fb] text-[#2563eb]',
                          ].join(' ')}
                        >
                          {active ? 'Selected' : 'Select'}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onSubmitRun(run.jobId);
                          }}
                          disabled={submitBusy}
                          className="rounded-[12px] bg-[#2563eb] px-3 py-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-white shadow-[0_12px_24px_rgba(37,99,235,0.18)] disabled:opacity-50"
                        >
                          {submitBusy ? 'Submitting...' : 'Submit Run'}
                        </button>
                      )}
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="rounded-[20px] border border-[#dbe5f1] bg-white px-4 py-6 text-[13px] font-semibold text-[#60718a]">
                {'\uC544\uC9C1 \uC644\uB8CC\uB41C Run\uC774 \uC5C6\uC2B5\uB2C8\uB2E4. \uD559\uC2B5\uC744 \uB05D\uB0B4\uBA74 \uC774\uACF3\uC5D0 \uC81C\uCD9C \uD6C4\uBCF4\uB85C \uD45C\uC2DC\uB429\uB2C8\uB2E4.'}
              </div>
            )}
          </div>
        </section>
      )}
    </aside>
  );
}
