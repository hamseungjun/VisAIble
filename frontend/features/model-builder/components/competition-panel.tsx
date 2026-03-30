'use client';

import { useMemo, useState } from 'react';
import { Icon } from '@/features/model-builder/components/icons';
import { datasets } from '@/lib/constants/builder-data';

type CompetitionPanelProps = {
  isLoading: boolean;
  error: string | null;
  onCreateRoom: (payload: {
    hostName: string;
    title: string;
    datasetId: string;
    roomCode?: string;
    password?: string;
    startsAt?: string;
    endsAt?: string;
  }) => Promise<void>;
  onEnterRoom: (payload: {
    roomCode: string;
    password: string;
    participantName: string;
  }) => Promise<void>;
};

function makeRandomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function makeRandomPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  return Array.from({ length: 12 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, offset: number) {
  return new Date(date.getFullYear(), date.getMonth() + offset, 1);
}

function formatDateValue(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateLabel(value: string) {
  if (!value) {
    return '날짜 선택';
  }

  const [year, month, day] = value.split('-');
  return `${year}.${month}.${day}`;
}

function formatMonthLabel(date: Date) {
  return `${date.getFullYear()}. ${date.getMonth() + 1}`;
}

function isSameDay(date: Date, value: string) {
  return formatDateValue(date) === value;
}

function buildCalendar(date: Date) {
  const monthStart = startOfMonth(date);
  const firstWeekday = monthStart.getDay();
  const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const cells: Array<{ key: string; day: number | null; dateValue: string | null }> = [];

  for (let index = 0; index < firstWeekday; index += 1) {
    cells.push({ key: `empty-${index}`, day: null, dateValue: null });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const currentDate = new Date(date.getFullYear(), date.getMonth(), day);
    cells.push({
      key: formatDateValue(currentDate),
      day,
      dateValue: formatDateValue(currentDate),
    });
  }

  while (cells.length % 7 !== 0) {
    cells.push({ key: `tail-${cells.length}`, day: null, dateValue: null });
  }

  return cells;
}

const formInputClassName =
  'w-full rounded-[16px] border border-[rgba(129,149,188,0.2)] bg-[linear-gradient(180deg,#ffffff,#f8fbff)] px-4 py-3 font-semibold text-ink outline-none transition-colors focus:border-primary focus:bg-white';
const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const competitionDatasets = datasets.map((dataset) => ({ id: dataset.id, label: dataset.label }));

export function CompetitionPanel({
  isLoading,
  error,
  onCreateRoom,
  onEnterRoom,
}: CompetitionPanelProps) {
  const [mode, setMode] = useState<'idle' | 'make' | 'enter'>('idle');
  const [hostName, setHostName] = useState('Host');
  const [title, setTitle] = useState('Class Competition');
  const [datasetId, setDatasetId] = useState(datasets[0]?.id ?? 'mnist');
  const [roomCode, setRoomCode] = useState(makeRandomCode());
  const [password, setPassword] = useState(makeRandomPassword());
  const [endsAt, setEndsAt] = useState('');
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(new Date()));
  const [participantName, setParticipantName] = useState('Participant');
  const [enterRoomCode, setEnterRoomCode] = useState('');
  const [enterPassword, setEnterPassword] = useState('');

  const helperText = useMemo(() => {
    if (mode === 'make') {
      return '호스트는 시스템이 생성한 방 비밀번호를 공유하고, 학생은 첫 입장 때 자기 비밀번호를 만든 뒤 다음부터 그 비밀번호로 다시 들어옵니다.';
    }
    if (mode === 'enter') {
      return '호스트는 방 비밀번호로 들어오고, 학생은 첫 입장 때 만든 개인 비밀번호로 다시 들어옵니다.';
    }
    return '대회 방을 만들거나 입장합니다.';
  }, [mode]);

  return (
    <section className="glass-panel ghost-border xl:col-span-2 flex min-h-[720px] flex-col gap-6 rounded-[28px] px-6 py-6 shadow-panel">
      <div className="max-w-[760px]">
          <div className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-muted">
            Competition
          </div>
          <div className="mt-2 font-display text-[34px] font-bold tracking-[-0.05em] text-ink">
            Private Room Builder
          </div>
          <p className="mt-3 text-[15px] leading-7 text-[#5a6b86]">{helperText}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <button
          type="button"
          onClick={() => setMode('make')}
          className={[
            'rounded-[26px] px-6 py-6 text-left transition-all',
            mode === 'make'
              ? 'bg-[linear-gradient(135deg,#1151ff,#2d66ff)] text-white shadow-[0_24px_54px_rgba(17,81,255,0.2)]'
              : 'bg-white/84 text-ink shadow-[0_16px_34px_rgba(13,27,51,0.06)]',
          ].join(' ')}
        >
          <div className="flex items-center gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-[18px] bg-white/15">
              <Icon name="rocket" className="h-6 w-6" />
            </div>
            <div>
              <div className="font-display text-[24px] font-bold">Make Competition</div>
              <div className={mode === 'make' ? 'text-white/75' : 'text-[#61738f]'}>
                방 생성
              </div>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setMode('enter')}
          className={[
            'rounded-[26px] px-6 py-6 text-left transition-all',
            mode === 'enter'
              ? 'bg-[linear-gradient(135deg,#1151ff,#2d66ff)] text-white shadow-[0_24px_54px_rgba(17,81,255,0.2)]'
              : 'bg-white/84 text-ink shadow-[0_16px_34px_rgba(13,27,51,0.06)]',
          ].join(' ')}
        >
          <div className="flex items-center gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-[18px] bg-white/15">
              <Icon name="check" className="h-6 w-6" />
            </div>
            <div>
              <div className="font-display text-[24px] font-bold">Enter Room</div>
              <div className={mode === 'enter' ? 'text-white/75' : 'text-[#61738f]'}>
                방 입장
              </div>
            </div>
          </div>
        </button>
      </div>

      {error ? (
        <div className="rounded-[20px] bg-[#fff1f1] px-5 py-4 text-[14px] font-semibold text-[#b42318] shadow-[inset_0_0_0_1px_rgba(220,38,38,0.14)]">
          {error}
        </div>
      ) : null}

      {mode === 'make' ? (
        <div className="grid gap-4 rounded-[28px] bg-white/84 px-6 py-6 shadow-[0_20px_48px_rgba(13,27,51,0.06)] xl:grid-cols-2">
          <label className="grid gap-2">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted">Host Name</span>
            <input
              value={hostName}
              onChange={(event) => setHostName(event.target.value)}
              className={`${formInputClassName} font-display text-[15px] font-bold`}
            />
          </label>
          <label className="grid gap-2">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted">Competition Title</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className={`${formInputClassName} font-display text-[15px] font-bold`}
            />
          </label>
          <label className="grid gap-2 xl:col-span-2">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted">Dataset</span>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {competitionDatasets.map((dataset) => (
                <button
                  key={dataset.id}
                  type="button"
                  onClick={() => setDatasetId(dataset.id)}
                  className={[
                    'rounded-[18px] px-4 py-3 text-left transition-colors',
                    datasetId === dataset.id
                      ? 'bg-[linear-gradient(135deg,#1151ff,#2d66ff)] text-white shadow-[0_18px_40px_rgba(17,81,255,0.16)]'
                      : 'bg-[#f5f8ff] text-[#41526d]',
                  ].join(' ')}
                >
                  <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] opacity-70">
                    Dataset
                  </div>
                  <div className="mt-1 font-display text-[15px] font-bold">{dataset.label}</div>
                </button>
              ))}
            </div>
          </label>
          <label className="grid gap-2">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted">Room Code</span>
            <div className="flex gap-2">
              <input
                value={roomCode}
                onChange={(event) => setRoomCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12))}
                className={`${formInputClassName} flex-1 font-display text-[16px] font-bold uppercase tracking-[0.12em] text-primary`}
              />
              <button
                type="button"
                onClick={() => setRoomCode(makeRandomCode())}
                className="rounded-[16px] bg-[#eef3ff] px-4 py-3 text-[12px] font-extrabold uppercase tracking-[0.14em] text-primary"
              >
                Generate
              </button>
            </div>
          </label>
          <label className="grid gap-2">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted">Password</span>
            <div className="flex gap-2">
              <div
                className={`${formInputClassName} flex-1 font-display text-[16px] font-bold tracking-[0.08em] text-primary`}
              >
                {password}
              </div>
              <button
                type="button"
                onClick={() => setPassword(makeRandomPassword())}
                className="rounded-[16px] bg-[#eef3ff] px-4 py-3 text-[12px] font-extrabold uppercase tracking-[0.14em] text-primary"
              >
                Generate
              </button>
            </div>
            <div className="text-[12px] font-semibold text-[#667995]">
              이 비밀번호는 호스트 재입장용 방 비밀번호입니다. 학생은 첫 입장 때 자기 비밀번호를 직접 만들고 다음부터 그 비밀번호로 다시 들어옵니다.
            </div>
          </label>
          <div className="grid gap-2 xl:col-span-2">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted">
              Competition End Date
            </span>
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="rounded-[20px] bg-[linear-gradient(135deg,#eef3ff,#e7f0ff)] px-5 py-4 text-left shadow-[inset_0_0_0_1px_rgba(129,149,188,0.12)] text-primary">
                <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted">
                  Starts Now
                </div>
                <div className="mt-2 font-display text-[22px] font-bold">
                  지금 시작
                </div>
                <div className="mt-1 text-[12px] font-semibold text-[#667995]">
                  호스트 시스템 시간 기준
                </div>
              </div>
              <button
                type="button"
                className={[
                  'rounded-[20px] px-5 py-4 text-left shadow-[inset_0_0_0_1px_rgba(129,149,188,0.12)] transition-colors',
                  'bg-[linear-gradient(135deg,#eef3ff,#e7f0ff)] text-primary',
                ].join(' ')}
              >
                <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted">
                  Check-out
                </div>
                <div className="mt-2 font-display text-[22px] font-bold">
                  {formatDateLabel(endsAt)}
                </div>
                <div className="mt-1 text-[12px] font-semibold text-[#667995]">
                  15:00 종료
                </div>
              </button>
            </div>
          </div>

          <div className="xl:col-span-2 rounded-[24px] bg-[linear-gradient(180deg,#fbfdff,#f5f8ff)] px-5 py-5 shadow-[inset_0_0_0_1px_rgba(129,149,188,0.12)]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted">
                  End Date
                </div>
                <div className="mt-1 text-[14px] font-semibold text-[#61738f]">
                  종료 날짜만 고르면 됩니다. 종료 시간은 15:00으로 고정됩니다.
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCalendarMonth((current) => addMonths(current, -1))}
                  className="rounded-full bg-white px-3 py-2 text-[12px] font-extrabold uppercase tracking-[0.14em] text-primary shadow-[0_10px_22px_rgba(13,27,51,0.05)]"
                >
                  Prev
                </button>
                <button
                  type="button"
                  onClick={() => setCalendarMonth((current) => addMonths(current, 1))}
                  className="rounded-full bg-white px-3 py-2 text-[12px] font-extrabold uppercase tracking-[0.14em] text-primary shadow-[0_10px_22px_rgba(13,27,51,0.05)]"
                >
                  Next
                </button>
              </div>
            </div>

            <div className="mx-auto w-full max-w-[560px] rounded-[20px] bg-white/88 px-4 py-4 shadow-[0_16px_34px_rgba(13,27,51,0.05)] shadow-[inset_0_0_0_1px_rgba(129,149,188,0.1)]">
              <div className="mb-3 font-display text-[18px] font-bold text-ink">
                {formatMonthLabel(calendarMonth)}
              </div>

              <div className="mb-2 grid grid-cols-7 gap-1.5">
                {weekdayLabels.map((label) => (
                  <div
                    key={`${calendarMonth.getMonth()}-${label}`}
                    className="text-center text-[9px] font-extrabold uppercase tracking-[0.12em] text-muted"
                  >
                    {label}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1.5">
                {buildCalendar(calendarMonth).map((cell) => {
                  const isEnd = cell.dateValue ? isSameDay(new Date(cell.dateValue), endsAt) : false;

                  return cell.day == null ? (
                    <div key={cell.key} className="aspect-square rounded-[12px] bg-transparent" />
                  ) : (
                    <button
                      key={cell.key}
                      type="button"
                      onClick={() => {
                        if (!cell.dateValue) {
                          return;
                        }
                        setEndsAt(cell.dateValue);
                      }}
                      className={[
                        'aspect-square rounded-[12px] text-center font-display text-[13px] font-bold transition-all',
                        isEnd
                          ? 'bg-[linear-gradient(135deg,#1151ff,#2d66ff)] text-white shadow-[0_12px_26px_rgba(17,81,255,0.18)]'
                          : 'bg-[#f7faff] text-[#41526d] hover:bg-[#eaf1ff]',
                      ].join(' ')}
                    >
                      {cell.day}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="xl:col-span-2 flex items-center justify-between gap-4 rounded-[20px] bg-[#f5f8ff] px-5 py-4">
            <div>
              <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted">Room Policy</div>
              <div className="mt-1 text-[14px] text-[#5b6d88]">
                호스트의 첫 제출은 baseline으로 기록됩니다.
              </div>
            </div>
            <button
              type="button"
              disabled={isLoading}
              onClick={() =>
                void onCreateRoom({
                  hostName,
                  title,
                  datasetId,
                  roomCode,
                  password,
                  startsAt: new Date().toISOString(),
                  endsAt: endsAt ? new Date(`${endsAt}T15:00:00`).toISOString() : undefined,
                })
              }
              className="rounded-[18px] bg-[linear-gradient(135deg,#1151ff,#2d66ff)] px-6 py-3 text-[13px] font-extrabold uppercase tracking-[0.18em] text-white shadow-[0_18px_40px_rgba(17,81,255,0.18)] disabled:opacity-50"
            >
              {isLoading ? 'Creating...' : 'Create Room'}
            </button>
          </div>
        </div>
      ) : null}

      {mode === 'enter' ? (
        <div className="grid gap-4 rounded-[28px] bg-white/84 px-6 py-6 shadow-[0_20px_48px_rgba(13,27,51,0.06)] xl:grid-cols-2">
          <label className="grid gap-2">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted">Participant Name</span>
            <input
              value={participantName}
              onChange={(event) => setParticipantName(event.target.value)}
              className={`${formInputClassName} font-display text-[15px] font-bold`}
            />
          </label>
          <label className="grid gap-2">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted">Room Code</span>
            <input
              value={enterRoomCode}
              onChange={(event) => setEnterRoomCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12))}
              className={`${formInputClassName} font-display text-[16px] font-bold uppercase tracking-[0.12em] text-primary`}
            />
          </label>
          <label className="grid gap-2 xl:col-span-2">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted">Password</span>
            <input
              value={enterPassword}
              onChange={(event) => setEnterPassword(event.target.value)}
              className={`${formInputClassName} font-display text-[15px] font-bold`}
            />
          </label>
          <div className="xl:col-span-2 flex items-center justify-between gap-4 rounded-[20px] bg-[#f5f8ff] px-5 py-4">
            <div className="text-[14px] text-[#5b6d88]">
              호스트는 방 비밀번호로 입장합니다. 학생은 첫 입장 때 개인 비밀번호를 만들고, 이후에는 그 비밀번호로 계속 다시 들어옵니다.
            </div>
            <button
              type="button"
              disabled={isLoading}
              onClick={() =>
                void onEnterRoom({
                  roomCode: enterRoomCode,
                  password: enterPassword,
                  participantName,
                })
              }
              className="rounded-[18px] bg-[linear-gradient(135deg,#1151ff,#2d66ff)] px-6 py-3 text-[13px] font-extrabold uppercase tracking-[0.18em] text-white shadow-[0_18px_40px_rgba(17,81,255,0.18)] disabled:opacity-50"
            >
              {isLoading ? 'Entering...' : 'Enter Room'}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
