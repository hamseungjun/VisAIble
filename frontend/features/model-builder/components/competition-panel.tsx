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
    return 'Select date';
  }

  const [year, month, day] = value.split('-');
  return `${year}.${month}.${day}`;
}

function formatMonthLabel(date: Date) {
  return `${date.getFullYear()}. ${date.getMonth() + 1}`;
}

function toCompetitionDeadline(dateValue: string) {
  if (!dateValue) {
    return null;
  }

  return new Date(`${dateValue}T15:00:00`);
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
  'w-full rounded-[16px] border border-[#d6e1f0] bg-white px-4 py-3 text-[14px] font-semibold text-[#12233d] outline-none transition focus:border-[#3b82f6] focus:shadow-[0_0_0_4px_rgba(59,130,246,0.12)]';
const fieldLabelClassName =
  'text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#71839d]';
const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const competitionDatasets = datasets.map((dataset) => ({ id: dataset.id, label: dataset.label }));
const modeOptions = [
  {
    key: 'make',
    title: 'Create Room',
    description: '새 Private Room 만들기',
    icon: 'rocket' as const,
  },
  {
    key: 'enter',
    title: 'Join Room',
    description: '초대 코드로 입장',
    icon: 'check' as const,
  },
] as const;

export function CompetitionPanel({
  isLoading,
  error,
  onCreateRoom,
  onEnterRoom,
}: CompetitionPanelProps) {
  const [mode, setMode] = useState<'idle' | 'make' | 'enter'>('idle');
  const [hostName, setHostName] = useState('Host');
  const [title, setTitle] = useState('VisAIble Competition');
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
      return '호스트가 Private Room을 만들고 초대 코드를 공유하면, 참가자는 가장 좋은 학습 결과를 리더보드에 제출할 수 있습니다.';
    }
    if (mode === 'enter') {
      return '초대 코드로 이미 만들어진 방에 입장하세요. 호스트는 방 비밀번호를 사용하고, 참가자는 처음 입장 후 개인 비밀번호를 계속 사용할 수 있습니다.';
    }
    return '마감 시간이 있는 경쟁 방을 만들거나, 이미 진행 중인 리더보드에 바로 참여해보세요.';
  }, [mode]);

  const selectedDatasetLabel =
    competitionDatasets.find((dataset) => dataset.id === datasetId)?.label ?? datasetId;
  const selectedDeadline = endsAt ? toCompetitionDeadline(endsAt) : null;
  const isDeadlineExpired = selectedDeadline ? selectedDeadline.getTime() <= Date.now() : false;
  const scheduleWarning = isDeadlineExpired
    ? '선택한 마감일은 현재 기준으로 이미 종료된 시간입니다. 더 늦은 날짜를 선택해 주세요.'
    : null;

  return (
    <section className="xl:col-span-2 flex min-h-[720px] flex-col gap-6 rounded-[28px] border border-[#dbe5f1] bg-[#f7fafe] px-6 py-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_320px]">
        <div className="overflow-hidden rounded-[28px] border border-[#d5e3f2] bg-[linear-gradient(135deg,#0f172a,#173968_48%,#2563eb)] px-6 py-6 text-white shadow-[0_30px_80px_rgba(15,23,42,0.22)]">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.18em] text-white/82">
            <Icon name="grid" className="h-4 w-4" />
            VisAIble Competition
          </div>
          <h1 className="mt-4 max-w-[560px] font-display text-[34px] font-bold tracking-[-0.05em]">
            VisAIble Competition으로 수업형 AI 대회를 바로 시작하세요.
          </h1>
          <p className="mt-3 max-w-[620px] text-[15px] leading-7 text-white/78">{helperText}</p>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-[20px] border border-white/12 bg-white/10 px-4 py-4 backdrop-blur">
              <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-white/60">
                Format
              </div>
              <div className="mt-2 text-[18px] font-bold">Hidden Leaderboard</div>
              <div className="mt-1 text-[12px] text-white/70">
                참가자는 Public Score를 보고, 호스트는 Private Score까지 확인합니다.
              </div>
            </div>
            <div className="rounded-[20px] border border-white/12 bg-white/10 px-4 py-4 backdrop-blur">
              <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-white/60">
                Access
              </div>
              <div className="mt-2 text-[18px] font-bold">Invite Only</div>
              <div className="mt-1 text-[12px] text-white/70">
                Room Code와 비밀번호로 각 수업 방을 분리해 운영할 수 있습니다.
              </div>
            </div>
            <div className="rounded-[20px] border border-white/12 bg-white/10 px-4 py-4 backdrop-blur">
              <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-white/60">
                Deadline
              </div>
              <div className="mt-2 text-[18px] font-bold">{endsAt ? formatDateLabel(endsAt) : 'Open Now'}</div>
              <div className="mt-1 text-[12px] text-white/70">
                제출 기준을 맞추기 위해 종료 시간은 오후 3시로 고정됩니다.
              </div>
            </div>
          </div>
        </div>

        <aside className="grid gap-3 rounded-[28px] border border-[#dbe5f1] bg-white px-5 py-5 shadow-[0_16px_36px_rgba(15,23,42,0.06)]">
          <div>
            <div className={fieldLabelClassName}>Competition Guide</div>
            <div className="mt-2 font-display text-[24px] font-bold tracking-[-0.04em] text-[#10213b]">
              빠른 시작 안내
            </div>
          </div>
          <div className="rounded-[20px] bg-[#f5f8fd] px-4 py-4">
            <div className="text-[12px] font-extrabold uppercase tracking-[0.16em] text-[#3b82f6]">
              1. Create or Join
            </div>
            <div className="mt-1 text-[13px] leading-6 text-[#52627a]">
              호스트로 새 방을 만들거나, 초대 코드로 기존 방에 입장합니다.
            </div>
          </div>
          <div className="rounded-[20px] bg-[#f5f8fd] px-4 py-4">
            <div className="text-[12px] font-extrabold uppercase tracking-[0.16em] text-[#3b82f6]">
              2. Train Model
            </div>
            <div className="mt-1 text-[13px] leading-6 text-[#52627a]">
              아키텍처를 구성하고 학습을 돌린 뒤, 가장 좋은 Run을 골라둡니다.
            </div>
          </div>
          <div className="rounded-[20px] bg-[#f5f8fd] px-4 py-4">
            <div className="text-[12px] font-extrabold uppercase tracking-[0.16em] text-[#3b82f6]">
              3. Submit Score
            </div>
            <div className="mt-1 text-[13px] leading-6 text-[#52627a]">
              참가자는 공개 순위를 보고, 호스트는 비공개 평가 결과까지 확인할 수 있습니다.
            </div>
          </div>
        </aside>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-[#dbe5f1] bg-white px-4 py-4 shadow-[0_14px_32px_rgba(15,23,42,0.05)]">
        <div className="flex flex-wrap gap-2">
          {modeOptions.map((option) => {
            const active = mode === option.key;

            return (
              <button
                key={option.key}
                type="button"
                onClick={() => setMode(option.key)}
                className={[
                  'min-w-[220px] rounded-[18px] border px-4 py-4 text-left transition',
                  active
                    ? 'border-[#bfdbfe] bg-[#eff6ff] shadow-[0_12px_28px_rgba(59,130,246,0.12)]'
                    : 'border-[#e4ecf5] bg-[#fbfdff] hover:border-[#c6d6ea]',
                ].join(' ')}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={[
                      'grid h-11 w-11 place-items-center rounded-[14px]',
                      active ? 'bg-[#2563eb] text-white' : 'bg-[#eef4fb] text-[#2563eb]',
                    ].join(' ')}
                  >
                    <Icon name={option.icon} className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-display text-[20px] font-bold text-[#10213b]">{option.title}</div>
                    <div className="text-[12px] font-semibold text-[#6d7d94]">{option.description}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        <div className="rounded-full bg-[#f5f8fd] px-4 py-2 text-[12px] font-semibold text-[#5e6d84]">
          첫 제출 기록은 Host Baseline으로 저장됩니다.
        </div>
      </div>

      {error ? (
        <div className="rounded-[20px] border border-[#f5c2c7] bg-[#fff5f5] px-5 py-4 text-[14px] font-semibold text-[#b42318]">
          {error}
        </div>
      ) : null}

      {scheduleWarning ? (
        <div className="rounded-[20px] border border-[#fed7aa] bg-[#fff7ed] px-5 py-4 text-[14px] font-semibold text-[#c2410c]">
          {scheduleWarning}
        </div>
      ) : null}

      {mode === 'make' ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_320px]">
          <div className="grid gap-5 rounded-[28px] border border-[#dbe5f1] bg-white px-6 py-6 shadow-[0_16px_36px_rgba(15,23,42,0.06)]">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2">
                <span className={fieldLabelClassName}>Host name</span>
                <input
                  value={hostName}
                  onChange={(event) => setHostName(event.target.value)}
                  className={`${formInputClassName} font-display text-[15px] font-bold`}
                />
              </label>
              <label className="grid gap-2">
                <span className={fieldLabelClassName}>Competition title</span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className={`${formInputClassName} font-display text-[15px] font-bold`}
                />
              </label>
            </div>

            <div className="grid gap-2">
              <div className={fieldLabelClassName}>Dataset</div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {competitionDatasets.map((dataset) => {
                  const active = datasetId === dataset.id;

                  return (
                    <button
                      key={dataset.id}
                      type="button"
                      onClick={() => setDatasetId(dataset.id)}
                      className={[
                        'rounded-[20px] border px-4 py-4 text-left transition',
                        active
                          ? 'border-[#bfdbfe] bg-[#eff6ff] shadow-[0_14px_30px_rgba(59,130,246,0.12)]'
                          : 'border-[#e4ecf5] bg-[#fbfdff] hover:border-[#c6d6ea]',
                      ].join(' ')}
                    >
                      <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#7b8da8]">
                        Dataset
                      </div>
                      <div className="mt-2 font-display text-[17px] font-bold text-[#10213b]">
                        {dataset.label}
                      </div>
                      <div className="mt-1 text-[12px] text-[#61738b]">
                        {active ? '이 리더보드에 사용 중' : '이 대회의 모든 Run에 사용'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid content-start gap-2 self-start">
                <span className={fieldLabelClassName}>Room code</span>
                <div className="grid grid-cols-[minmax(0,1fr)_112px] gap-2">
                  <input
                    value={roomCode}
                    onChange={(event) =>
                      setRoomCode(
                        event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12),
                      )
                    }
                    className={`${formInputClassName} h-[50px] flex-1 py-0 font-display text-[16px] font-bold uppercase leading-none tracking-[0.14em] text-[#2563eb]`}
                  />
                  <button
                    type="button"
                    onClick={() => setRoomCode(makeRandomCode())}
                    className="h-[50px] rounded-[16px] border border-[#dbe5f1] bg-[#f8fbff] px-4 py-3 text-center text-[12px] font-extrabold uppercase tracking-[0.14em] text-[#2563eb]"
                  >
                    Generate
                  </button>
                </div>
              </label>
              <label className="grid content-start gap-2 self-start">
                <span className={fieldLabelClassName}>Host password</span>
                <div className="grid grid-cols-[minmax(0,1fr)_112px] gap-2">
                  <input
                    value={password}
                    readOnly
                    className={`${formInputClassName} h-[50px] py-0 font-display text-[16px] font-bold leading-none tracking-[0.06em] text-[#2563eb]`}
                  />
                  <button
                    type="button"
                    onClick={() => setPassword(makeRandomPassword())}
                    className="h-[50px] rounded-[16px] border border-[#dbe5f1] bg-[#f8fbff] px-4 py-3 text-center text-[12px] font-extrabold uppercase tracking-[0.14em] text-[#2563eb]"
                  >
                    Refresh
                  </button>
                </div>
                <div className="text-[12px] leading-6 text-[#687a92]">
                  이 비밀번호는 호스트 계정 전용입니다. 참가자는 첫 입장 시 개인 비밀번호를 설정해 사용합니다.
                </div>
              </label>
            </div>

            <div className="rounded-[24px] border border-[#dbe5f1] bg-[#f8fbff] px-5 py-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className={fieldLabelClassName}>Deadline</div>
                  <div className="mt-2 font-display text-[24px] font-bold text-[#10213b]">
                    {formatDateLabel(endsAt)}
                  </div>
                  <div className="mt-1 text-[13px] text-[#61738b]">
                    Competition은 즉시 시작되며, 선택한 날짜 오후 3시에 종료됩니다.
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCalendarMonth((current) => addMonths(current, -1))}
                    className="rounded-full border border-[#dbe5f1] bg-white px-3 py-2 text-[12px] font-extrabold uppercase tracking-[0.14em] text-[#2563eb]"
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    onClick={() => setCalendarMonth((current) => addMonths(current, 1))}
                    className="rounded-full border border-[#dbe5f1] bg-white px-3 py-2 text-[12px] font-extrabold uppercase tracking-[0.14em] text-[#2563eb]"
                  >
                    Next
                  </button>
                </div>
              </div>

              <div className="mt-4 rounded-[22px] border border-[#dbe5f1] bg-white px-4 py-4 shadow-[0_14px_30px_rgba(15,23,42,0.04)]">
                <div className="mb-3 font-display text-[18px] font-bold text-[#10213b]">
                  {formatMonthLabel(calendarMonth)}
                </div>
                <div className="mb-2 grid grid-cols-7 gap-2">
                  {weekdayLabels.map((label) => (
                    <div
                      key={`${calendarMonth.getMonth()}-${label}`}
                      className="text-center text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#94a3b8]"
                    >
                      {label}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {buildCalendar(calendarMonth).map((cell) => {
                    const isEnd = cell.dateValue ? isSameDay(new Date(cell.dateValue), endsAt) : false;
                    const isExpired =
                      cell.dateValue == null
                        ? false
                        : (toCompetitionDeadline(cell.dateValue)?.getTime() ?? 0) <= Date.now();

                    return cell.day == null ? (
                      <div key={cell.key} className="aspect-square rounded-[12px]" />
                    ) : (
                      <button
                        key={cell.key}
                        type="button"
                        onClick={() => {
                          if (!cell.dateValue) {
                            return;
                          }
                          if (isExpired) {
                            return;
                          }
                          setEndsAt(cell.dateValue);
                        }}
                        disabled={isExpired}
                        className={[
                          'aspect-square rounded-[14px] border text-center font-display text-[13px] font-bold transition disabled:cursor-not-allowed disabled:opacity-45',
                          isEnd
                            ? 'border-[#3b82f6] bg-[#2563eb] text-white shadow-[0_12px_24px_rgba(37,99,235,0.24)]'
                            : 'border-[#e7eef7] bg-[#f8fbff] text-[#29415f] hover:border-[#bfd4ef] hover:bg-[#eef5ff]',
                        ].join(' ')}
                      >
                        {cell.day}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 rounded-[22px] border border-[#dbe5f1] bg-[#f7fafc] px-5 py-4">
              <div>
                <div className={fieldLabelClassName}>Publish room</div>
                <div className="mt-1 text-[14px] leading-6 text-[#596a81]">
                  방은 즉시 열리며, 선택한 데이터셋은 <span className="font-bold text-[#10213b]">{selectedDatasetLabel}</span>입니다.
                </div>
              </div>
              <button
                type="button"
                disabled={isLoading || isDeadlineExpired}
                onClick={() =>
                  void onCreateRoom({
                    hostName,
                    title,
                    datasetId,
                    roomCode,
                    password,
                    startsAt: new Date().toISOString(),
                    endsAt: selectedDeadline ? selectedDeadline.toISOString() : undefined,
                  })
                }
                className="rounded-[16px] bg-[#2563eb] px-6 py-3 text-[13px] font-extrabold uppercase tracking-[0.18em] text-white shadow-[0_16px_34px_rgba(37,99,235,0.24)] disabled:opacity-50"
              >
                {isLoading ? 'Creating...' : 'Create Room'}
              </button>
            </div>
          </div>

          <aside className="grid content-start gap-4 rounded-[28px] border border-[#dbe5f1] bg-white px-5 py-5 shadow-[0_16px_36px_rgba(15,23,42,0.06)]">
            <div>
              <div className={fieldLabelClassName}>Overview</div>
              <div className="mt-2 font-display text-[24px] font-bold text-[#10213b]">Room Summary</div>
            </div>
            <div className="rounded-[20px] bg-[#f5f8fd] px-4 py-4">
              <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#7b8da8]">Title</div>
              <div className="mt-2 text-[18px] font-bold text-[#10213b]">{title}</div>
            </div>
            <div className="rounded-[20px] bg-[#f5f8fd] px-4 py-4">
              <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#7b8da8]">Host</div>
              <div className="mt-2 text-[18px] font-bold text-[#10213b]">{hostName}</div>
            </div>
            <div className="rounded-[20px] bg-[#f5f8fd] px-4 py-4">
              <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#7b8da8]">Dataset</div>
              <div className="mt-2 text-[18px] font-bold text-[#10213b]">{selectedDatasetLabel}</div>
            </div>
            <div className="rounded-[20px] bg-[#f5f8fd] px-4 py-4">
              <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#7b8da8]">Invite Code</div>
              <div className="mt-2 font-display text-[20px] font-bold tracking-[0.12em] text-[#2563eb]">
                {roomCode || '------'}
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      {mode === 'enter' ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_360px]">
          <div className="grid gap-5 rounded-[28px] border border-[#dbe5f1] bg-white px-6 py-6 shadow-[0_16px_36px_rgba(15,23,42,0.06)]">
            <div>
              <div className={fieldLabelClassName}>Join room</div>
              <div className="mt-2 font-display text-[28px] font-bold tracking-[-0.04em] text-[#10213b]">
                진행 중인 Room에 입장하기
              </div>
              <p className="mt-2 max-w-[640px] text-[14px] leading-7 text-[#60718a]">
                호스트에게 받은 초대 코드로 입장하세요. 참가자는 첫 입장 시 개인 비밀번호를 만들고 이후에도 그대로 사용할 수 있습니다.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2">
                <span className={fieldLabelClassName}>Participant name</span>
                <input
                  value={participantName}
                  onChange={(event) => setParticipantName(event.target.value)}
                  className={`${formInputClassName} font-display text-[15px] font-bold`}
                />
              </label>
              <label className="grid gap-2">
                <span className={fieldLabelClassName}>Room code</span>
                <input
                  value={enterRoomCode}
                  onChange={(event) =>
                    setEnterRoomCode(
                      event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12),
                    )
                  }
                  className={`${formInputClassName} font-display text-[16px] font-bold uppercase tracking-[0.12em] text-[#2563eb]`}
                />
              </label>
            </div>

            <label className="grid gap-2">
              <span className={fieldLabelClassName}>Password</span>
              <input
                value={enterPassword}
                onChange={(event) => setEnterPassword(event.target.value)}
                className={`${formInputClassName} font-display text-[15px] font-bold`}
              />
            </label>

            <div className="flex flex-wrap items-center justify-between gap-4 rounded-[22px] border border-[#dbe5f1] bg-[#f7fafc] px-5 py-4">
              <div className="text-[14px] leading-6 text-[#596a81]">
                호스트는 방 비밀번호로 입장하고, 참가자는 첫 로그인 이후 자신의 비밀번호를 계속 사용합니다.
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
                className="rounded-[16px] bg-[#2563eb] px-6 py-3 text-[13px] font-extrabold uppercase tracking-[0.18em] text-white shadow-[0_16px_34px_rgba(37,99,235,0.24)] disabled:opacity-50"
              >
                {isLoading ? 'Entering...' : 'Join Room'}
              </button>
            </div>
          </div>

          <aside className="grid content-start gap-4 rounded-[28px] border border-[#dbe5f1] bg-white px-5 py-5 shadow-[0_16px_36px_rgba(15,23,42,0.06)]">
            <div>
              <div className={fieldLabelClassName}>What you need</div>
              <div className="mt-2 font-display text-[24px] font-bold text-[#10213b]">입장 전 확인</div>
            </div>
            <div className="rounded-[20px] bg-[#f5f8fd] px-4 py-4 text-[13px] leading-6 text-[#52627a]">
              호스트에게 Competition title, Room Code, 비밀번호를 먼저 받아야 합니다.
            </div>
            <div className="rounded-[20px] bg-[#f5f8fd] px-4 py-4 text-[13px] leading-6 text-[#52627a]">
              방에 들어간 뒤 가장 좋은 학습 결과를 선택해 제출할 수 있습니다.
            </div>
            <div className="rounded-[20px] bg-[#f5f8fd] px-4 py-4 text-[13px] leading-6 text-[#52627a]">
              리더보드 점수는 숨겨진 평가 데이터로 계산되기 때문에 validation accuracy와 다를 수 있습니다.
            </div>
          </aside>
        </div>
      ) : null}
    </section>
  );
}
