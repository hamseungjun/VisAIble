'use client';

import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { Icon } from '@/features/model-builder/components/icons';
import { predictDigit } from '@/lib/api/model-builder';
import { extractMnistPixels } from '@/lib/mnist-canvas';
import type { TrainingJobStatus } from '@/types/builder';

type MnistElevatorMissionProps = {
  phase: 'intro' | 'mission' | 'complete';
  trainingStatus: TrainingJobStatus | null;
  isMissionComplete: boolean;
  onMissionComplete: () => void;
  onMinimize: () => void;
  onStartQuest?: () => void;
  onExitQuest?: () => void;
};

type DialogueScene = {
  name: string;
  role: string;
  text: string;
};

const missionFloors = [9, 8, 7, 6, 5, 4, 3, 2, 1];
const introScenes: DialogueScene[] = [
  {
    name: 'Emergency System',
    role: 'Broadcast',
    text: '네오 세종 타워의 버튼 없는 엘리베이터가 전역 정지 상태에 들어갔습니다. 승객들은 원하는 층으로 이동하지 못하고 있습니다.',
  },
  {
    name: 'Mina',
    role: 'Maintenance AI',
    text: '큰일났어! 엘리베이터가 멈춰버렸잖아! 숫자를 읽는 손글씨 인식 AI가 고장 나서, 승객들이 층수를 입력해도 전부 무시되고 있어.',
  },
  {
    name: 'Mina',
    role: 'Mission Brief',
    text: '네가 해야 할 일은 하나야. MNIST 숫자를 다시 학습시켜서 손글씨 숫자를 정확히 판별하게 만들어. 그러면 버튼 없는 엘리베이터도 다시 움직일 수 있어.',
  },
];

function randomFloor() {
  return missionFloors[Math.floor(Math.random() * missionFloors.length)] ?? 5;
}

function DialogueBox({
  name,
  role,
  text,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
}: {
  name: string;
  role: string;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  return (
    <div className="relative z-20 max-w-full pl-8 pt-6">
      <div
        className="absolute left-9 top-0 z-20 -translate-y-1/2 bg-white px-5 py-2 text-[17px] font-black uppercase tracking-[0.04em] text-black shadow-[0_10px_18px_rgba(0,0,0,0.25)]"
        style={{ clipPath: 'polygon(0 0,100% 0,92% 100%,0 100%)' }}
      >
        {name}
      </div>
      <div
        className="relative border-[4px] border-white/92 bg-[linear-gradient(180deg,rgba(5,10,20,0.99),rgba(10,18,32,0.96))] px-9 pb-8 pt-11 text-white shadow-[0_24px_50px_rgba(0,0,0,0.42)] backdrop-blur-md"
        style={{ clipPath: 'polygon(3.5% 0,100% 0,100% 86%,96.5% 100%,0 100%,0 12%)' }}
      >
        <div className="text-[12px] font-extrabold uppercase tracking-[0.22em] text-[#a9c4ff]">
          {role}
        </div>
        <p className="mt-3 text-[20px] font-semibold leading-[1.55] text-white">
          {text}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
          {secondaryLabel && onSecondary ? (
            <button
              type="button"
              onClick={onSecondary}
              className="rounded-full border border-white/20 px-4 py-2 text-[12px] font-extrabold uppercase tracking-[0.14em] text-white/82 transition hover:bg-white/8 hover:text-white"
            >
              {secondaryLabel}
            </button>
          ) : null}
          {actionLabel && onAction ? (
            <button
              type="button"
              onClick={onAction}
              className="rounded-full bg-[linear-gradient(135deg,#f97316,#fb923c)] px-5 py-2.5 text-[12px] font-extrabold uppercase tracking-[0.14em] text-white shadow-[0_12px_28px_rgba(249,115,22,0.28)]"
            >
              {actionLabel}
            </button>
          ) : null}
        </div>
      </div>
      <div
        className="absolute bottom-6 left-3 h-7 w-7 border-b-[4px] border-l-[4px] border-white/92 bg-[#09111f]"
        style={{ clipPath: 'polygon(0 0,100% 50%,0 100%)' }}
      />
    </div>
  );
}

export function MnistElevatorMission({
  phase,
  trainingStatus,
  isMissionComplete,
  onMissionComplete,
  onMinimize,
  onStartQuest,
  onExitQuest,
}: MnistElevatorMissionProps) {
  const drawingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isPredicting, setIsPredicting] = useState(false);
  const [predictError, setPredictError] = useState<string | null>(null);
  const [prediction, setPrediction] = useState<{
    predictedLabel: number;
    confidence: number;
  } | null>(null);
  const [targetFloor, setTargetFloor] = useState(5);
  const [currentFloor, setCurrentFloor] = useState(1);
  const [sceneIndex, setSceneIndex] = useState(0);

  const lastMetric = trainingStatus?.metrics?.at(-1) ?? null;
  const isMissionReady =
    trainingStatus?.status === 'completed' &&
    trainingStatus.datasetId === 'mnist' &&
    !!trainingStatus.jobId;
  const currentScene = introScenes[sceneIndex] ?? introScenes[0];
  const portraitSrc = useMemo(() => {
    if (phase === 'complete' || isMissionComplete) {
      return '/images/mnist-quest-mina-happy.svg';
    }

    if (phase === 'intro') {
      if (sceneIndex < 2) {
        return '/images/mnist-quest-mina-worried.svg';
      }
      return '/images/mnist-quest-mina-focused.svg';
    }

    if (predictError) {
      return '/images/mnist-quest-mina-worried.svg';
    }

    if (isMissionReady) {
      return '/images/mnist-quest-mina-focused.svg';
    }

    return '/images/mnist-quest-mina-worried.svg';
  }, [isMissionComplete, isMissionReady, phase, predictError, sceneIndex]);
  const expressionLabel = useMemo(() => {
    if (phase === 'complete' || isMissionComplete) {
      return 'Relieved';
    }

    if (phase === 'intro' && sceneIndex < 2) {
      return 'Alarmed';
    }

    if (predictError) {
      return 'Concerned';
    }

    return 'Focused';
  }, [isMissionComplete, phase, predictError, sceneIndex]);

  useEffect(() => {
    setSceneIndex(0);
  }, [phase]);

  useEffect(() => {
    if (!isMissionReady) {
      return;
    }

    setTargetFloor(randomFloor());
    setCurrentFloor(1);
    setPrediction(null);
    setPredictError(null);
  }, [trainingStatus?.jobId, isMissionReady]);

  useEffect(() => {
    if (!isMissionReady) {
      return;
    }

    const canvas = drawingCanvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    context.fillStyle = '#000000';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.lineWidth = 18;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = '#ffffff';
  }, [isMissionReady]);

  const missionDialogue = useMemo(() => {
    if (phase === 'complete' || isMissionComplete) {
      return '해냈어! 숫자 인식 코어가 복구됐고, 버튼 없는 엘리베이터가 다시 정확한 층으로 움직이기 시작했어.';
    }

    if (!isMissionReady) {
      return '아직 인식 코어가 비어 있어. 왼쪽에서 Linear 블록을 캔버스에 올리고, Start 버튼으로 학습을 시작하면 미션 콘솔이 활성화될 거야.';
    }

    return `좋아, 지금 승객이 ${targetFloor}층을 요청했어. 캔버스에 ${targetFloor}를 손글씨로 적고 Predict Floor를 눌러. 이번엔 절대 틀리면 안 돼!`;
  }, [isMissionComplete, isMissionReady, phase, targetFloor]);
  const clampedCurrentFloor = Math.max(1, Math.min(currentFloor, 9));
  const currentFloorIndex = missionFloors.findIndex((floor) => floor === clampedCurrentFloor);
  const elevatorCarTop = 16 + Math.max(0, currentFloorIndex) * 46;

  const startDrawing = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = drawingCanvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
    setIsDrawing(true);
    setPredictError(null);
    setPrediction(null);
    context.beginPath();
    context.moveTo(x, y);
  };

  const drawDigit = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) {
      return;
    }

    const canvas = drawingCanvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
    context.lineTo(x, y);
    context.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) {
      return;
    }

    setIsDrawing(false);
  };

  const clearDrawing = () => {
    const canvas = drawingCanvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    context.fillStyle = '#000000';
    context.fillRect(0, 0, canvas.width, canvas.height);
    setPrediction(null);
    setPredictError(null);
  };

  const runPrediction = async () => {
    if (!trainingStatus?.jobId || !isMissionReady) {
      return;
    }

    const canvas = drawingCanvasRef.current;
    if (!canvas) {
      return;
    }

    const pixels = extractMnistPixels(canvas);
    if (pixels.length !== 28 * 28) {
      setPrediction(null);
      setPredictError('숫자 하나를 또렷하게 써야 인식 코어가 읽을 수 있어.');
      return;
    }

    setIsPredicting(true);
    setPredictError(null);
    try {
      const result = await predictDigit(trainingStatus.jobId, pixels);
      setPrediction({
        predictedLabel: result.predictedLabel,
        confidence: result.confidence,
      });
      setCurrentFloor(Math.max(1, result.predictedLabel));

      if (result.predictedLabel === targetFloor) {
        onMissionComplete();
      } else {
        setPredictError(
          `엘리베이터가 ${result.predictedLabel}층으로 오인식했어. 목표는 ${targetFloor}층이야. 조금 더 또렷하고 크게 써보자.`,
        );
      }
    } catch (error) {
      setPredictError(error instanceof Error ? error.message : '예측 중 문제가 발생했습니다.');
    } finally {
      setIsPredicting(false);
    }
  };

  if (phase === 'intro') {
    return (
      <div className="pointer-events-none fixed inset-0 z-[88] bg-[rgba(2,6,15,0.8)] backdrop-blur-[4px]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(249,115,22,0.22),transparent_22%),radial-gradient(circle_at_78%_18%,rgba(59,130,246,0.18),transparent_22%),linear-gradient(180deg,rgba(10,16,28,0.96),rgba(8,13,24,0.98))]" />
        <div className="relative flex min-h-screen items-center justify-center px-4 py-6">
          <div className="pointer-events-auto w-full max-w-[min(1380px,calc(100vw-36px))]">
            <div className="relative overflow-hidden rounded-[36px] border border-white/10 bg-[linear-gradient(180deg,#111827,#0b1220)] shadow-[0_40px_110px_rgba(0,0,0,0.44)]">
              <div className="relative h-[min(80vh,860px)] min-h-[700px] overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_28%,rgba(251,191,36,0.18),transparent_28%),linear-gradient(180deg,#1f2937_0%,#111827_100%)]" />
                <div className="absolute inset-x-[18%] top-0 h-full bg-[linear-gradient(180deg,#2a3348,#151b2c)]">
                  <div className="absolute inset-y-0 left-1/2 w-[3px] -translate-x-1/2 bg-[#475569]" />
                  <div className="absolute inset-y-0 left-[8%] w-[2px] bg-[#334155]" />
                  <div className="absolute inset-y-0 right-[8%] w-[2px] bg-[#334155]" />
                  <div className="absolute left-1/2 top-[18%] h-[84px] w-[124px] -translate-x-1/2 rounded-[18px] border border-[#93c5fd]/30 bg-[linear-gradient(180deg,rgba(59,130,246,0.18),rgba(15,23,42,0.18))] shadow-[0_18px_32px_rgba(37,99,235,0.16)]">
                    <div className="mx-auto mt-3 w-fit rounded-full bg-[#ef4444] px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.16em] text-white">
                      Alert
                    </div>
                    <div className="mt-3 text-center font-display text-[24px] font-bold text-[#dbeafe]">
                      Lift Core
                    </div>
                  </div>
                </div>
                <div className="absolute inset-x-0 top-0 h-[20%] bg-[linear-gradient(180deg,rgba(0,0,0,0.26),transparent)]" />
                <div className="absolute inset-x-0 bottom-0 h-[28%] bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.54))]" />

                <img
                  src={portraitSrc}
                  alt="Mina portrait"
                  className="absolute bottom-0 left-[3%] h-[78%] max-h-[720px] w-auto drop-shadow-[0_28px_40px_rgba(0,0,0,0.45)]"
                />

                <div className="absolute left-[6%] top-[8%] z-20 inline-flex items-center gap-3 rounded-full border border-white/14 bg-[rgba(8,13,24,0.84)] px-4 py-2.5 shadow-[0_18px_36px_rgba(0,0,0,0.22)] backdrop-blur-md">
                  <span className="text-[11px] font-black uppercase tracking-[0.18em] text-white">
                    Episode 01
                  </span>
                  <span className="rounded-full border border-[#fef3c7]/60 bg-[#fff7dd] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#7c5b00]">
                    {expressionLabel}
                  </span>
                </div>

                <div className="absolute bottom-8 left-[32%] right-8 max-w-[840px]">
                  <DialogueBox
                    name={currentScene.name}
                    role={currentScene.role}
                    text={currentScene.text}
                    secondaryLabel={sceneIndex > 0 ? 'Prev' : undefined}
                    onSecondary={
                      sceneIndex > 0
                        ? () => setSceneIndex((current) => Math.max(0, current - 1))
                        : undefined
                    }
                    actionLabel={sceneIndex === introScenes.length - 1 ? 'Accept Quest' : 'Next'}
                    onAction={() => {
                      if (sceneIndex === introScenes.length - 1) {
                        onStartQuest?.();
                        return;
                      }
                      setSceneIndex((current) => Math.min(current + 1, introScenes.length - 1));
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[88] bg-[rgba(2,6,15,0.74)] backdrop-blur-[4px]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(59,130,246,0.24),transparent_24%),radial-gradient(circle_at_82%_14%,rgba(249,115,22,0.16),transparent_22%),linear-gradient(180deg,rgba(10,16,28,0.96),rgba(8,13,24,0.98))]" />
      <div className="relative flex min-h-screen items-center justify-center px-4 py-6">
        <div className="pointer-events-auto w-full max-w-[min(1420px,calc(100vw-36px))]">
          <div className="grid gap-6 xl:grid-cols-[minmax(440px,0.92fr)_minmax(0,1.08fr)]">
            <section className="relative overflow-hidden rounded-[34px] border border-white/10 bg-[linear-gradient(180deg,#111827,#0b1220)] shadow-[0_32px_90px_rgba(0,0,0,0.4)]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(59,130,246,0.12),transparent_22%),radial-gradient(circle_at_84%_18%,rgba(249,115,22,0.12),transparent_18%)]" />
              <div className="relative h-full min-h-[760px]">
                <div className="absolute inset-x-[14%] top-0 h-full bg-[linear-gradient(180deg,#263247,#161e2f)]">
                  <div className="absolute inset-y-0 left-1/2 w-[3px] -translate-x-1/2 bg-[#475569]" />
                  <div className="absolute inset-y-0 left-[12%] w-[2px] bg-[#334155]" />
                  <div className="absolute inset-y-0 right-[12%] w-[2px] bg-[#334155]" />
                </div>

                <div className="absolute left-[7%] top-[7%] z-20 inline-flex items-center gap-2.5 rounded-full border border-white/14 bg-[rgba(8,13,24,0.88)] px-4 py-2.5 shadow-[0_18px_36px_rgba(0,0,0,0.24)] backdrop-blur-md">
                  <span
                    className={[
                      'h-2.5 w-2.5 rounded-full',
                      phase === 'complete' ? 'bg-emerald-400' : 'bg-[#60a5fa]',
                    ].join(' ')}
                  />
                  <span className="text-[11px] font-black uppercase tracking-[0.18em] text-white">
                    {phase === 'complete' ? 'Quest Cleared' : 'Active Quest'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onMinimize}
                  className="absolute right-6 top-6 z-20 grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/8 text-white/80 transition hover:bg-white/14 hover:text-white"
                  aria-label="퀘스트 최소화"
                >
                  <span className="text-[18px] font-bold leading-none">×</span>
                </button>

                <img
                  src={portraitSrc}
                  alt="Mina portrait"
                  className="absolute bottom-0 left-[2.5%] z-10 h-[62%] max-h-[560px] w-auto drop-shadow-[0_28px_40px_rgba(0,0,0,0.45)]"
                />

                <div className="absolute left-[7%] top-[15%] z-20 inline-flex items-center gap-3 rounded-[18px] border border-white/14 bg-[rgba(8,13,24,0.88)] px-4 py-3 shadow-[0_18px_36px_rgba(0,0,0,0.24)] backdrop-blur-md">
                  <span className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#93c5fd]">
                    Expression
                  </span>
                  <span className="rounded-full border border-[#dbeafe]/70 bg-white px-3 py-1 text-[12px] font-black uppercase tracking-[0.12em] text-[#10213b]">
                    {expressionLabel}
                  </span>
                </div>

                <div className="absolute bottom-6 left-[18%] right-6 z-20 max-w-[620px]">
                  <DialogueBox
                    name={phase === 'complete' ? 'Mina' : 'Mina'}
                    role={phase === 'complete' ? 'Mission Complete' : 'Operator Dialogue'}
                    text={missionDialogue}
                    actionLabel={phase === 'complete' ? 'Exit Quest' : undefined}
                    onAction={phase === 'complete' ? onExitQuest : undefined}
                  />
                </div>
              </div>
            </section>

            <section className="overflow-hidden rounded-[34px] border border-[#d9e2ef] bg-[linear-gradient(180deg,#ffffff,#f6f9fd)] shadow-[0_32px_90px_rgba(0,0,0,0.22)]">
              <div className="border-b border-[#e2e8f0] px-6 py-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#7c8ca5]">
                      Elevator Control Console
                    </div>
                    <h3 className="mt-2 font-display text-[30px] font-bold tracking-[-0.04em] text-[#10213b]">
                      {phase === 'complete' ? '임무 완료 보고' : '층수 인식 미션'}
                    </h3>
                  </div>
                  <div className="rounded-full bg-[#eef3ff] px-4 py-2 text-[12px] font-bold text-primary">
                    {phase === 'complete'
                      ? 'Quest Cleared'
                      : isMissionReady
                        ? `Target ${targetFloor}F`
                        : 'Training Required'}
                  </div>
                </div>
              </div>

              <div className="px-6 py-6">
                <div className="grid gap-6 xl:grid-cols-[minmax(260px,0.82fr)_minmax(0,1.18fr)]">
                  <div className="grid gap-4">
                    <div className="rounded-[26px] border border-[#dbe5f1] bg-[linear-gradient(180deg,#f8fbff,#ffffff)] p-5 shadow-[0_14px_30px_rgba(15,23,42,0.05)]">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#7c8ca5]">
                            Elevator Status
                          </div>
                          <div className="mt-2 text-[15px] font-semibold text-[#5f7088]">
                            인식 결과에 따라 실제 엘리베이터가 층을 이동합니다.
                          </div>
                        </div>
                        <div className="rounded-full bg-[#dbeafe] px-3.5 py-1.5 text-[12px] font-black tracking-[0.08em] text-[#1d4ed8] shadow-[0_8px_18px_rgba(37,99,235,0.12)]">
                          Current {clampedCurrentFloor}F
                        </div>
                      </div>

                      <div className="mt-5 flex justify-center">
                        <div className="grid grid-cols-[96px_116px] items-start gap-4">
                          <div className="grid gap-1.5 py-4">
                            {missionFloors.map((floor) => (
                              <div
                                key={floor}
                                className={[
                                  'flex h-10 items-center justify-between rounded-[16px] px-4 text-[13px] font-black transition-all',
                                  targetFloor === floor && !isMissionComplete
                                    ? 'animate-floor-pulse bg-[#dbeafe] text-[#1d4ed8] shadow-[0_10px_22px_rgba(59,130,246,0.14)]'
                                    : clampedCurrentFloor === floor
                                      ? 'bg-[#eff6ff] text-[#1e3a8a]'
                                      : 'bg-white/84 text-[#64748b]',
                                ].join(' ')}
                              >
                                <span>{floor}F</span>
                                {targetFloor === floor ? (
                                  <span className="text-[10px] uppercase tracking-[0.14em]">
                                    {isMissionComplete ? 'Arrived' : 'Call'}
                                  </span>
                                ) : clampedCurrentFloor === floor ? (
                                  <span className="text-[10px] uppercase tracking-[0.14em] text-[#2563eb]">
                                    Now
                                  </span>
                                ) : null}
                              </div>
                            ))}
                          </div>

                          <div className="relative h-[440px] rounded-[32px] border border-[#d9e2ef] bg-[linear-gradient(180deg,#eef4ff,#ffffff)] p-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.9)]">
                            <div className="absolute inset-4 rounded-[24px] border border-dashed border-[#c8d5ea]" />
                            <div className="absolute inset-y-4 left-1/2 w-[4px] -translate-x-1/2 rounded-full bg-[linear-gradient(180deg,#dbeafe,#93c5fd,#dbeafe)] opacity-85" />
                            <div className="absolute inset-y-4 left-[calc(50%-22px)] w-[2px] rounded-full bg-[#d9e2ef]" />
                            <div className="absolute inset-y-4 left-[calc(50%+20px)] w-[2px] rounded-full bg-[#d9e2ef]" />
                            <div
                              className="absolute left-1/2 z-10 h-10 w-[92px] -translate-x-1/2 rounded-[16px] border border-[#1d4ed8] bg-[linear-gradient(180deg,#60a5fa,#2563eb)] shadow-[0_12px_24px_rgba(37,99,235,0.28)] transition-all duration-700 ease-in-out"
                              style={{
                                top: `${elevatorCarTop}px`,
                              }}
                            >
                              <div className="mx-auto mt-2 flex h-6 w-[56px] items-center justify-center rounded-[10px] bg-white/18 text-[12px] font-extrabold text-white">
                                {clampedCurrentFloor}F
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="rounded-[24px] border border-[#dbe5f1] bg-white p-5 shadow-[0_14px_30px_rgba(15,23,42,0.05)]">
                        <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#7c8ca5]">
                          Validation Accuracy
                        </div>
                        <div className="mt-3 font-display text-[34px] font-bold tracking-[-0.04em] text-[#10213b]">
                          {lastMetric ? `${(lastMetric.validationAccuracy * 100).toFixed(1)}%` : '--'}
                        </div>
                      </div>
                      <div className="rounded-[24px] border border-[#dbe5f1] bg-white p-5 shadow-[0_14px_30px_rgba(15,23,42,0.05)]">
                        <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#7c8ca5]">
                          Core Status
                        </div>
                        <div className="mt-3 font-display text-[24px] font-bold tracking-[-0.04em] text-[#10213b]">
                          {isMissionReady ? 'Online' : 'Offline'}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4">
                    <div className="rounded-[26px] border border-[#dbe5f1] bg-[linear-gradient(180deg,#ffffff,#f8fbff)] p-5 shadow-[0_14px_30px_rgba(15,23,42,0.05)]">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#7c8ca5]">
                            Handwriting Input
                          </div>
                          <div className="mt-2 text-[15px] font-semibold text-[#5f7088]">
                            {isMissionReady
                              ? `${targetFloor}층을 손글씨로 적어 엘리베이터를 호출하세요.`
                              : '먼저 모델을 학습해야 미션 콘솔이 활성화됩니다.'}
                          </div>
                        </div>
                        {prediction ? (
                          <div className="rounded-full bg-[#eef3ff] px-3 py-1.5 text-[12px] font-bold text-primary">
                            Read {prediction.predictedLabel}
                          </div>
                        ) : null}
                      </div>

                      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_190px]">
                        <canvas
                          ref={drawingCanvasRef}
                          width={280}
                          height={280}
                          className="h-[300px] w-full touch-none rounded-[22px] border border-[#cbd5e1] bg-black shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]"
                          onPointerDown={startDrawing}
                          onPointerMove={drawDigit}
                          onPointerUp={stopDrawing}
                          onPointerLeave={stopDrawing}
                        />

                        <div className="grid content-between gap-3">
                          <div className="rounded-[22px] bg-[#0f172a] px-4 py-4 text-white shadow-[0_14px_30px_rgba(15,23,42,0.18)]">
                            <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-white/54">
                              Passenger Request
                            </div>
                            <div className="mt-3 font-display text-[58px] font-bold leading-none">
                              {targetFloor}
                            </div>
                            <div className="mt-2 text-[12px] font-semibold text-white/74">
                              이 숫자를 정확히 읽어야 합니다.
                            </div>
                          </div>

                          <div className="grid gap-2">
                            <button
                              type="button"
                              onClick={clearDrawing}
                              className="rounded-full border border-[#c7d6ef] bg-white px-3 py-2.5 text-xs font-extrabold uppercase tracking-[0.12em] text-muted shadow-sm"
                            >
                              Clear
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                void runPrediction();
                              }}
                              disabled={!isMissionReady || isPredicting}
                              className="rounded-full bg-[linear-gradient(135deg,#1151ff,#3d73ff)] px-3 py-2.5 text-xs font-extrabold uppercase tracking-[0.12em] text-white shadow-[0_12px_28px_rgba(17,81,255,0.2)] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {isPredicting ? 'Reading...' : 'Predict Floor'}
                            </button>
                          </div>
                        </div>
                      </div>

                      {predictError ? (
                        <div className="mt-4 rounded-[18px] bg-[#fff1f2] px-4 py-3 text-[13px] font-semibold text-[#b42318]">
                          {predictError}
                        </div>
                      ) : null}

                      {prediction ? (
                        <div className="mt-4 rounded-[20px] border border-[#dce6f6] bg-[linear-gradient(135deg,#ffffff,#eef4ff)] px-4 py-4 shadow-[0_12px_28px_rgba(17,81,255,0.08)]">
                          <div className="flex items-end justify-between gap-3">
                            <div>
                              <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted">
                                Model Output
                              </div>
                              <div className="mt-1 font-display text-[32px] font-bold text-primary">
                                {prediction.predictedLabel}F
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted">
                                Confidence
                              </div>
                              <div className="mt-1 font-display text-[24px] font-bold text-ink">
                                {(prediction.confidence * 100).toFixed(1)}%
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : null}

                      {(phase === 'complete' || isMissionComplete) ? (
                        <div className="mt-4 rounded-[20px] border border-[#bbf7d0] bg-[linear-gradient(135deg,#f0fdf4,#dcfce7)] px-4 py-4 text-[#166534] shadow-[0_12px_28px_rgba(34,197,94,0.12)]">
                          <div className="flex items-center gap-3">
                            <div className="grid h-11 w-11 place-items-center rounded-full bg-white">
                              <Icon name="play" className="h-4 w-4" />
                            </div>
                            <div>
                              <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#15803d]">
                                Quest Complete
                              </div>
                              <div className="mt-1 text-[14px] font-semibold">
                                손글씨 숫자를 올바른 층수로 해석해서 버튼 없는 엘리베이터를 복구했습니다.
                              </div>
                            </div>
                          </div>
                          <div className="mt-4 flex justify-end">
                            <button
                              type="button"
                              onClick={onExitQuest}
                              className="rounded-full bg-[linear-gradient(135deg,#16a34a,#22c55e)] px-5 py-2.5 text-[12px] font-extrabold uppercase tracking-[0.14em] text-white shadow-[0_12px_28px_rgba(34,197,94,0.24)]"
                            >
                              Finish And Exit
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
