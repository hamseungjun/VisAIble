'use client';

import { useMemo, useState } from 'react';
import { Icon } from '@/features/model-builder/components/icons';
import { Inspector } from '@/features/model-builder/components/inspector';
import type {
  CompetitionLeaderboard,
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
  leaderboard: CompetitionLeaderboard | null;
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

function formatCompetitionRoleLabel(role: CompetitionRoomSession['participantRole']) {
  return role === 'host' ? '호스트' : '참가자';
}

function hasCompetitionEnded(room: CompetitionRoomSession) {
  return room.endsAt ? new Date(room.endsAt).getTime() < Date.now() : false;
}

export function CompetitionSidebar({
  room,
  trainingStatus,
  liveHistory,
  leaderboard,
  runs,
  selectedRunJobId,
  submitBusy,
  onSelectRun,
  onSubmitRun,
}: CompetitionSidebarProps) {
  const [mode, setMode] = useState<'overview' | 'metrics'>('metrics');
  const submittedRuns = runs.filter((run) => run.submitted);
  const selectedRun = submittedRuns.find((run) => run.jobId === selectedRunJobId) ?? null;
  const isHost = room.participantRole === 'host';
  const displayPrivateScore = isHost || hasCompetitionEnded(room);
  const remainingSubmissions = Math.max(0, room.dailySubmissionLimit - room.dailySubmissionCount);
  const finalOwnEntry = displayPrivateScore
    ? leaderboard?.entries.find((entry) => entry.participantId === room.participantId) ?? null
    : null;
  const selectedRunIndex = selectedRun ? runs.findIndex((run) => run.jobId === selectedRun.jobId) : -1;
  const selectedRunLabel =
    selectedRunIndex >= 0 ? `제출 ${runs.length - selectedRunIndex}` : '선택한 제출 없음';
  const emptyState =
    runs.length === 0
      ? {
          title: '제출 내역이 없습니다',
          description: '학습을 완료한 뒤 결과를 제출하면 여기에 표시됩니다.',
          icon: 'rocket' as const,
        }
      : submittedRuns.length === 0
        ? {
            title: '아직 제출 내역이 없습니다',
            description: '완료된 학습 결과를 제출하면 공개 점수가 표시됩니다.',
            icon: 'trophy' as const,
          }
        : {
            title: '제출 내역을 선택하세요',
            description: '제출 내역을 선택하면 점수와 세부 지표가 표시됩니다.',
            icon: 'check' as const,
          };
  const bestPublicScore = useMemo(() => {
    const scoredRuns = runs.filter((run) => run.submission?.publicScore != null);

    if (scoredRuns.length === 0) {
      return null;
    }

    return Math.max(...scoredRuns.map((run) => run.submission?.publicScore ?? 0));
  }, [runs]);

  return (
    <aside className="grid min-h-0 min-w-0 w-full content-start gap-3 self-start xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto">
      <section className="overflow-hidden rounded-[22px] border border-[#d6e0ed] bg-white shadow-[0_16px_34px_rgba(15,23,42,0.07)]">
        <div className="px-4 py-4">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#7c8ca5]">
                대회방
              </div>
              <div className="mt-1 font-display text-[24px] font-bold leading-tight tracking-[-0.04em] text-[#10213b]">
                {room.title}
              </div>
              <div className="mt-1 text-[12px] font-semibold text-[#687992]">
                {`${room.participants.length}명 · ${formatCompetitionRoleLabel(room.participantRole)}`}
              </div>
            </div>
            <div className="shrink-0 rounded-full border border-[#c9d6e6] bg-[#f7f9fc] px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#10213b]">
              {formatCompetitionRoleLabel(room.participantRole)}
            </div>
          </div>
        </div>

        <div className="border-t border-[#dce6f2] bg-[#f7fafc] p-2">
          <div className="grid grid-cols-2 rounded-[16px] bg-[#e7edf5] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
            <button
              type="button"
              onClick={() => setMode('metrics')}
              className={[
                'min-w-0 rounded-[12px] px-2.5 py-2 text-[10px] font-extrabold uppercase tracking-[0.14em] transition',
                mode === 'metrics'
                  ? 'bg-[#10213b] text-white shadow-[0_8px_18px_rgba(15,23,42,0.14)]'
                  : 'text-[#4b6384] hover:text-[#10213b]',
              ].join(' ')}
            >
              지표
            </button>
            <button
              type="button"
              onClick={() => setMode('overview')}
              className={[
                'min-w-0 rounded-[12px] px-2.5 py-2 text-[10px] font-extrabold uppercase tracking-[0.14em] transition',
                mode === 'overview'
                  ? 'bg-[#10213b] text-white shadow-[0_8px_18px_rgba(15,23,42,0.14)]'
                  : 'text-[#4b6384] hover:text-[#10213b]',
              ].join(' ')}
            >
              개요
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
        <section className="grid min-h-0 content-start gap-3 rounded-[22px] border border-[#d8e3f1] bg-white px-3.5 py-3.5 shadow-[0_16px_36px_rgba(15,23,42,0.055)]">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="col-span-2 overflow-hidden rounded-[18px] border border-[#cfdcf0] bg-[#f8fafc] px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#63738c]">
                    Best Score
                  </div>
                  <div
                    className={[
                      'mt-2 font-display font-bold leading-none tracking-[-0.04em]',
                      bestPublicScore == null ? 'text-[19px] text-[#10213b]' : 'text-[30px] text-[#0f766e]',
                    ].join(' ')}
                  >
                    {bestPublicScore == null ? '결과를 제출하세요' : formatPercent(bestPublicScore)}
                  </div>
                </div>
                <div className="rounded-[14px] border border-[#dce6f2] bg-white p-2.5 text-[#0f766e] shadow-[0_8px_18px_rgba(15,23,42,0.05)]">
                  <Icon name="trophy" className="h-5 w-5" />
                </div>
              </div>
            </div>

            <div className="rounded-[16px] border border-[#dce6f2] bg-white px-3.5 py-3 shadow-[0_8px_18px_rgba(15,23,42,0.035)]">
              <div className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#7b8da8]">
                선택한 제출
              </div>
              <div className="mt-1.5 truncate font-display text-[16px] font-bold text-[#10213b]">
                {selectedRun ? selectedRunLabel : '없음'}
              </div>
            </div>
            <div className="rounded-[16px] border border-[#dce6f2] bg-white px-3.5 py-3 shadow-[0_8px_18px_rgba(15,23,42,0.035)]">
              <div className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#7b8da8]">
                제출 현황
              </div>
              <div className="mt-1.5 font-display text-[16px] font-bold text-[#0f766e]">
                {`${room.dailySubmissionCount}/${room.dailySubmissionLimit}`}
              </div>
              <div className="mt-1 text-[10px] font-bold text-[#71839d]">
                하루 기준
              </div>
            </div>
          </div>

          <div className="rounded-[18px] border border-[#d8e3f1] bg-white px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#71839d]">
                  제출 상세
                </div>
                <div className="mt-1 font-display text-[17px] font-bold tracking-[-0.03em] text-[#10213b]">
                  {selectedRun ? selectedRunLabel : emptyState.title}
                </div>
              </div>
              <div className="rounded-full bg-[#edf2f7] px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#516178]">
                {isHost ? '호스트 보기' : '공개 보기'}
              </div>
            </div>

            {selectedRun ? (
              <div className="mt-4">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-[#e1eaf6] bg-[#f8fbff] px-3 py-2.5">
                  <div className="text-[11px] font-semibold text-[#63738c]">
                    {selectedRun.completedAt ? new Date(selectedRun.completedAt).toLocaleString() : '제출 내역'}
                  </div>
                  <div className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#0f766e]">
                    <Icon name="check" className="h-3.5 w-3.5" />
                    {displayPrivateScore ? '최종 점수 공개' : '제출 완료'}
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2.5">
                  <div className="rounded-[14px] bg-[#f4f7fc] px-3 py-3">
                    <div className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#7b8da8]">
                      Val
                    </div>
                    <div className="mt-1 font-display text-[17px] font-bold text-[#10213b]">
                      {formatPercent(selectedRun.validationAccuracy)}
                    </div>
                  </div>
                  <div className="rounded-[14px] bg-[#ecfdf8] px-3 py-3">
                    <div className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#347f76]">
                      Public
                    </div>
                    <div className="mt-1 font-display text-[17px] font-bold text-[#0f766e]">
                      {formatPercent(selectedRun.submission?.publicScore)}
                    </div>
                  </div>
                  <div className="rounded-[14px] bg-[#f4f7fc] px-3 py-3">
                    <div className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#7b8da8]">
                      Train
                    </div>
                    <div className="mt-1 font-display text-[17px] font-bold text-[#10213b]">
                      {formatPercent(selectedRun.trainAccuracy)}
                    </div>
                  </div>
                  <div className="rounded-[14px] bg-[#f4f7fc] px-3 py-3">
                    <div className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#7b8da8]">
                      {displayPrivateScore ? 'Private' : '상태'}
                    </div>
                    <div className="mt-1 font-display text-[17px] font-bold text-[#10213b]">
                      {displayPrivateScore
                        ? formatPercent(selectedRun.submission?.privateScore ?? finalOwnEntry?.privateScore)
                        : selectedRun.submitted
                          ? '제출 완료'
                          : '대기 중'}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-[16px] border border-dashed border-[#cfdcf0] bg-[#f8fafc] px-4 py-5 text-center">
                <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-white text-[#0f766e] shadow-[0_8px_18px_rgba(15,23,42,0.06)]">
                  <Icon name={emptyState.icon} className="h-5 w-5" />
                </div>
                <div className="mt-3 text-[12px] font-bold text-[#10213b]">
                  {emptyState.title}
                </div>
                <div className="mt-1 text-[11px] font-semibold leading-5 text-[#63738c]">
                  {emptyState.description}
                </div>
              </div>
            )}
          </div>

          <div className="grid min-h-0 gap-2.5">
            <div className="flex flex-wrap items-center justify-between gap-3 px-1">
              <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#71839d]">
                학습 결과
              </div>
              <div className="rounded-full bg-[#edf2f7] px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#60718a]">
                {`${runs.length}개 완료`}
              </div>
            </div>
            {runs.length > 0 ? (
              runs.map((run, index) => {
                const active = selectedRunJobId === run.jobId;
                const selectable = run.submitted;
                const runLabel = `결과 ${runs.length - index}`;
                const cardClassName = [
                  'rounded-[18px] border px-3.5 py-3.5 text-left transition',
                  active
                    ? 'border-[#5eead4] bg-[#f0fdfa] shadow-[0_0_0_2px_rgba(20,184,166,0.14),0_16px_32px_rgba(15,118,110,0.12)]'
                    : selectable
                      ? 'border-[#dbe5f1] bg-white hover:border-[#99f6e4] hover:shadow-[0_12px_26px_rgba(15,118,110,0.08)]'
                      : 'border-[#dbe5f1] bg-white/95',
                ].join(' ');
                const cardContent = (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="font-display text-[16px] font-bold tracking-[-0.02em] text-[#10213b]">
                            {runLabel}
                          </div>
                          <div
                            className={[
                              'rounded-full px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[0.14em]',
                              run.submitted
                                ? active
                                  ? 'bg-[#0f766e] text-white shadow-[0_8px_18px_rgba(15,118,110,0.20)]'
                                  : 'bg-[#ccfbf1] text-[#0f766e]'
                                : 'bg-[#eef2f7] text-[#60718a]',
                            ].join(' ')}
                          >
                            {run.submitted ? (active ? '선택됨' : '제출됨') : '완료'}
                          </div>
                        </div>
                        <div className="mt-1 truncate text-[11px] font-semibold text-[#6c7c94]">
                          {run.completedAt ? new Date(run.completedAt).toLocaleString() : '완료된 학습 결과'}
                        </div>
                      </div>
                      <div
                        className={[
                          'grid h-8 w-8 shrink-0 place-items-center rounded-full border',
                          run.submitted
                            ? 'border-[#99f6e4] bg-[#f0fdfa] text-[#0f766e]'
                            : 'border-[#dbe5f1] bg-[#f8fbff] text-[#60718a]',
                        ].join(' ')}
                      >
                        <Icon name={run.submitted ? 'check' : 'dots'} className="h-4 w-4" />
                      </div>
                    </div>

                    <div className={`mt-3 grid gap-2 ${displayPrivateScore ? '2xl:grid-cols-3' : 'grid-cols-2'}`}>
                      <div className="rounded-[13px] border border-[#e4edf7] bg-[#f8fbff] px-3 py-2.5">
                        <div className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#7b8da8]">
                          Val
                        </div>
                        <div className="mt-1 font-display text-[15px] font-bold text-[#10213b]">
                          {formatPercent(run.validationAccuracy)}
                        </div>
                      </div>
                      <div className="rounded-[13px] border border-[#bceee4] bg-[#ecfdf8] px-3 py-2.5">
                        <div className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#347f76]">
                          Public
                        </div>
                        <div className="mt-1 font-display text-[15px] font-bold text-[#0f766e]">
                          {formatPercent(run.submission?.publicScore)}
                        </div>
                      </div>
                      {displayPrivateScore ? (
                        <div className="rounded-[13px] border border-[#e4edf7] bg-[#f8fbff] px-3 py-2.5">
                          <div className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#7b8da8]">
                            Private
                          </div>
                          <div className="mt-1 font-display text-[15px] font-bold text-[#10213b]">
                            {formatPercent(run.submission?.privateScore ?? finalOwnEntry?.privateScore)}
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                      {run.submitted ? (
                        <div
                          className={[
                            'rounded-[12px] px-3 py-2 text-[10px] font-extrabold uppercase tracking-[0.14em]',
                            active ? 'bg-[#0f766e] text-white' : 'bg-[#ecfdf8] text-[#0f766e]',
                          ].join(' ')}
                        >
                          {active ? '선택됨' : '선택하기'}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onSubmitRun(run.jobId);
                          }}
                          disabled={submitBusy || remainingSubmissions === 0}
                          className="rounded-[12px] bg-[#10213b] px-3 py-2 text-[10px] font-extrabold uppercase tracking-[0.14em] text-white shadow-[0_10px_22px_rgba(15,23,42,0.16)] disabled:opacity-50"
                        >
                          {submitBusy ? '제출 중...' : remainingSubmissions === 0 ? '오늘 마감' : '제출하기'}
                        </button>
                      )}
                    </div>
                  </>
                );

                return selectable ? (
                  <button
                    key={run.jobId}
                    type="button"
                    onClick={() => {
                      if (selectable) {
                        onSelectRun(run.jobId);
                      }
                    }}
                    className={cardClassName}
                  >
                    {cardContent}
                  </button>
                ) : (
                  <div key={run.jobId} className={cardClassName}>
                    {cardContent}
                  </div>
                );
              })
            ) : (
              <div className="rounded-[18px] border border-dashed border-[#cfdcf0] bg-white px-4 py-5 text-center">
                <div className="mx-auto grid h-9 w-9 place-items-center rounded-full bg-[#eef4fb] text-[#60718a]">
                  <Icon name="dots" className="h-4 w-4" />
                </div>
                <div className="mt-2 text-[12px] font-bold text-[#10213b]">
                  제출 가능한 학습 결과가 없습니다.
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </aside>
  );
}
