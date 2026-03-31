'use client';

import { useEffect, useRef, useState } from 'react';
import { Canvas } from '@/features/model-builder/components/canvas';
import { CompetitionPanel } from '@/features/model-builder/components/competition-panel';
import { CompetitionRankModal } from '@/features/model-builder/components/competition-rank-modal';
import { CompetitionSidebar } from '@/features/model-builder/components/competition-sidebar';
import { Icon } from '@/features/model-builder/components/icons';
import { Inspector } from '@/features/model-builder/components/inspector';
import { ModelPreviewModal } from '@/features/model-builder/components/model-preview-modal';
import { Sidebar } from '@/features/model-builder/components/sidebar';
import { TopBar } from '@/features/model-builder/components/top-bar';
import { TrainingLiveOverlay } from '@/features/model-builder/components/training-live-overlay';
import { useBuilderBoard } from '@/features/model-builder/hooks/use-builder-board';
import {
  createCompetitionRoom,
  enterCompetitionRoom,
  getCompetitionLeaderboard,
  getCompetitionRoom,
  getTrainingStatus,
  pauseTraining,
  resumeTraining,
  startTraining,
  stopTraining,
  submitCompetitionRun,
  subscribeTrainingStatus,
} from '@/lib/api/model-builder';
import { datasets } from '@/lib/constants/builder-data';
import {
  optimizerConfigs,
  type OptimizerName,
  type OptimizerParams,
} from '@/lib/constants/training-controls';
import type {
  CompetitionLeaderboard,
  CompetitionRoomSession,
  CompetitionSubmissionResult,
  TrainingJobStatus,
  TrainingRunResult,
} from '@/types/builder';

const competitionDataset = {
  id: 'imagenet',
  icon: 'chip',
  label: 'Tiny ImageNet Competition',
  inputShape: '3 x 64 x 64',
  records: '100K train / hidden public-private eval',
  domain: 'Competition classification',
  classCount: 200,
} as const;

const availableCompetitionDatasets = [...datasets, competitionDataset];

const competitionBatchSizes = [8, 16, 32, 64, 128, 256, 512, 1024] as const;

type CompetitionRunRecord = {
  jobId: string;
  trainAccuracy: number;
  validationAccuracy: number;
  submitted: boolean;
  submission?: CompetitionSubmissionResult | null;
  completedAt?: string | null;
};

export function BuilderShell() {
  const {
    nodes,
    draggingBlock,
    setDraggingBlock,
    addNode,
    removeNode,
    updateNodeField,
    updateNodeActivation,
    moveNode,
    resetBoard,
  } = useBuilderBoard();
  const [selectedDatasetId, setSelectedDatasetId] = useState(datasets[0]?.id ?? 'mnist');
  const [activeWorkspace, setActiveWorkspace] = useState<'builder' | 'competition'>('builder');
  const [optimizer, setOptimizer] = useState<OptimizerName>('ADAM');
  const [learningRate, setLearningRate] = useState(optimizerConfigs.ADAM.defaultLearningRate);
  const [epochs, setEpochs] = useState('3');
  const [batchSize, setBatchSize] = useState(128);
  const [optimizerParams, setOptimizerParams] = useState<OptimizerParams>({
    momentum: optimizerConfigs.SGD.parameter.defaultValue,
    weightDecay: optimizerConfigs.ADAM.parameter.defaultValue,
    rho: optimizerConfigs['RMS Prop'].parameter.defaultValue,
  });
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isTrainingOverlayOpen, setIsTrainingOverlayOpen] = useState(false);
  const [isTraining, setIsTraining] = useState(false);
  const [trainingError, setTrainingError] = useState<string | null>(null);
  const [latestTrainingResult, setLatestTrainingResult] = useState<TrainingRunResult | null>(null);
  const [trainingStatus, setTrainingStatus] = useState<TrainingJobStatus | null>(null);
  const [liveHistory, setLiveHistory] = useState<{
    loss: number[];
    accuracy: number[];
    validationLoss: number[];
    validationAccuracy: number[];
  }>({
    loss: [],
    accuracy: [],
    validationLoss: [],
    validationAccuracy: [],
  });
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [competitionRoom, setCompetitionRoom] = useState<CompetitionRoomSession | null>(null);
  const [competitionLeaderboard, setCompetitionLeaderboard] = useState<CompetitionLeaderboard | null>(
    null,
  );
  const [competitionError, setCompetitionError] = useState<string | null>(null);
  const [competitionBusy, setCompetitionBusy] = useState(false);
  const [competitionSubmitBusy, setCompetitionSubmitBusy] = useState(false);
  const [competitionRuns, setCompetitionRuns] = useState<CompetitionRunRecord[]>([]);
  const [selectedCompetitionRunJobId, setSelectedCompetitionRunJobId] = useState<string | null>(
    null,
  );
  const [isCompetitionRankOpen, setIsCompetitionRankOpen] = useState(false);
  const [competitionCopyFeedback, setCompetitionCopyFeedback] = useState<string | null>(null);
  const pollingRef = useRef<number | null>(null);
  const streamRef = useRef<EventSource | null>(null);
  const liveBatchKeyRef = useRef<string | null>(null);
  const competitionDatasetId = competitionRoom?.datasetId ?? 'imagenet';
  const selectedDataset =
    activeWorkspace === 'competition'
      ? (availableCompetitionDatasets.find((dataset) => dataset.id === competitionDatasetId) ??
        competitionDataset)
      : (datasets.find((dataset) => dataset.id === selectedDatasetId) ?? datasets[0]);
  const runtimeDatasetId = activeWorkspace === 'competition' ? competitionDatasetId : selectedDatasetId;

  const surfaceTrainingError = (message: string, jobId: string | null = currentJobId) => {
    setTrainingError(message);
    setIsTraining(false);
    setTrainingStatus((current) => ({
      jobId: jobId ?? current?.jobId ?? 'local-error',
      status: 'failed',
      architecture: current?.architecture ?? [],
      metrics: current?.metrics ?? [],
      datasetId: current?.datasetId ?? runtimeDatasetId,
      epochs: current?.epochs ?? Number(epochs),
      learningRate: current?.learningRate ?? Number(learningRate),
      batchSize: current?.batchSize ?? batchSize,
      optimizer: current?.optimizer ?? optimizer,
      trainSize: current?.trainSize ?? null,
      validationSize: current?.validationSize ?? null,
      numClasses: current?.numClasses ?? null,
      device: current?.device ?? null,
      bestValidationAccuracy: current?.bestValidationAccuracy ?? null,
      currentEpoch: current?.currentEpoch ?? null,
      currentBatch: current?.currentBatch ?? null,
      totalBatches: current?.totalBatches ?? null,
      stage: current?.stage ?? 'error',
      liveTrainLoss: current?.liveTrainLoss ?? null,
      liveTrainAccuracy: current?.liveTrainAccuracy ?? null,
      liveValidationLoss: current?.liveValidationLoss ?? null,
      liveValidationAccuracy: current?.liveValidationAccuracy ?? null,
      error: message,
    }));
    setCurrentJobId(null);
  };

  useEffect(() => {
    return () => {
      if (pollingRef.current !== null) {
        window.clearInterval(pollingRef.current);
      }
      streamRef.current?.close();
    };
  }, []);

  useEffect(() => {
    if (!competitionRoom) {
      setCompetitionLeaderboard(null);
      return;
    }

    void (async () => {
      try {
        const [room, leaderboard] = await Promise.all([
          getCompetitionRoom(competitionRoom.roomCode, competitionRoom.participantId),
          getCompetitionLeaderboard(competitionRoom.roomCode, competitionRoom.participantId),
        ]);
        setCompetitionRoom((current) =>
          current == null
            ? room
            : {
                ...room,
                generatedPassword:
                  room.generatedPassword ??
                  (current.participantRole === 'host' ? current.generatedPassword : null),
              },
        );
        setCompetitionLeaderboard(leaderboard);
      } catch (error) {
        setCompetitionError(
          error instanceof Error ? error.message : 'Competition room sync failed unexpectedly',
        );
      }
    })();
  }, [competitionRoom?.roomCode, competitionRoom?.participantId]);

  const competitionActive = activeWorkspace === 'competition' && competitionRoom !== null;

  const handleCopyCompetitionText = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCompetitionCopyFeedback(`${label} copied`);
      window.setTimeout(() => {
        setCompetitionCopyFeedback((current) => (current === `${label} copied` ? null : current));
      }, 1800);
    } catch {
      setCompetitionCopyFeedback('Copy failed');
      window.setTimeout(() => {
        setCompetitionCopyFeedback((current) => (current === 'Copy failed' ? null : current));
      }, 1800);
    }
  };

  const handleCreateCompetitionRoom = async (payload: {
    hostName: string;
    title: string;
    datasetId: string;
    roomCode?: string;
    password?: string;
    startsAt?: string;
    endsAt?: string;
  }) => {
    setCompetitionBusy(true);
    setCompetitionError(null);
    try {
      const room = await createCompetitionRoom(payload);
      setCompetitionRoom(room);
      setCompetitionLeaderboard(await getCompetitionLeaderboard(room.roomCode, room.participantId));
      setActiveWorkspace('competition');
      setBatchSize(128);
      setCompetitionRuns([]);
      setSelectedCompetitionRunJobId(null);
    } catch (error) {
      setCompetitionError(
        error instanceof Error ? error.message : 'Competition room creation failed unexpectedly',
      );
    } finally {
      setCompetitionBusy(false);
    }
  };

  const handleEnterCompetitionRoom = async (payload: {
    roomCode: string;
    password: string;
    participantName: string;
  }) => {
    setCompetitionBusy(true);
    setCompetitionError(null);
    try {
      const room = await enterCompetitionRoom(payload);
      setCompetitionRoom({
        ...room,
        generatedPassword: room.participantRole === 'host' ? payload.password : null,
      });
      setCompetitionLeaderboard(await getCompetitionLeaderboard(room.roomCode, room.participantId));
      setActiveWorkspace('competition');
      setBatchSize(128);
      setCompetitionRuns([]);
      setSelectedCompetitionRunJobId(null);
    } catch (error) {
      setCompetitionError(
        error instanceof Error ? error.message : 'Competition room entry failed unexpectedly',
      );
    } finally {
      setCompetitionBusy(false);
    }
  };

  const handleSubmitCompetitionRun = async (jobId: string) => {
    if (!competitionRoom) {
      return;
    }

    setCompetitionSubmitBusy(true);
    setCompetitionError(null);
    try {
      const submission = await submitCompetitionRun({
        roomCode: competitionRoom.roomCode,
        participantId: competitionRoom.participantId,
        jobId,
        optimizer,
        batchSize,
      });
      setCompetitionRuns((current) =>
        current.map((run) =>
          run.jobId === jobId
            ? { ...run, submitted: true, submission }
            : run,
        ),
      );
      setCompetitionLeaderboard(
        await getCompetitionLeaderboard(competitionRoom.roomCode, competitionRoom.participantId),
      );
      setIsCompetitionRankOpen(true);
    } catch (error) {
      setCompetitionError(
        error instanceof Error ? error.message : 'Competition submission failed unexpectedly',
      );
    } finally {
      setCompetitionSubmitBusy(false);
    }
  };

  return (
    <div className="min-h-screen">
      <div className="mx-auto w-full max-w-[min(2280px,calc(100vw-12px))] 2xl:max-w-[min(2440px,calc(100vw-20px))]">
        <TopBar
          learningRate={learningRate}
          epochs={epochs}
          batchSize={batchSize}
          optimizer={optimizer}
          optimizerParams={optimizerParams}
          selectedDatasetLabel={selectedDataset?.label ?? 'Dataset'}
          layerCount={nodes.length}
          nodes={nodes}
          trainingStatus={trainingStatus}
          hasActiveJob={currentJobId !== null}
          isTraining={isTraining}
          onLearningRateChange={setLearningRate}
          onEpochChange={setEpochs}
          onOptimizerChange={(value) => {
            const config = optimizerConfigs[value];
            setOptimizer(value);
            setLearningRate(config.defaultLearningRate);
            setOptimizerParams((current) => ({
              ...current,
              [config.parameter.key]: config.parameter.defaultValue,
            }));
          }}
          onOptimizerParamChange={(key, value) =>
            setOptimizerParams((current) => ({ ...current, [key]: value }))
          }
          onTrainingStart={() => {
            void (async () => {
              setTrainingError(null);

              if (currentJobId && trainingStatus?.status === 'paused') {
                try {
                  await resumeTraining(currentJobId);
                  setIsTraining(true);
                  setIsTrainingOverlayOpen(activeWorkspace !== 'competition');
                  setTrainingStatus((current) =>
                    current ? { ...current, status: 'running' } : current,
                  );
                } catch (error) {
                  surfaceTrainingError(
                    error instanceof Error ? error.message : 'Resume failed unexpectedly',
                  );
                }
                return;
              }

              setIsTraining(true);
              setIsTrainingOverlayOpen(activeWorkspace !== 'competition');
              setTrainingStatus(null);
              setLatestTrainingResult(null);
              setLiveHistory({ loss: [], accuracy: [], validationLoss: [], validationAccuracy: [] });
              liveBatchKeyRef.current = null;
              if (pollingRef.current !== null) {
                window.clearInterval(pollingRef.current);
                pollingRef.current = null;
              }
              streamRef.current?.close();
              streamRef.current = null;

              try {
                const { jobId } = await startTraining({
                  datasetId: runtimeDatasetId,
                  learningRate: Number(learningRate),
                  epochs: Number(epochs),
                  batchSize,
                  optimizer,
                  optimizerParams,
                  nodes,
                });
                setCurrentJobId(jobId);

                let missingStatusRetries = 0;
                let usingPollingFallback = false;
                const stopPolling = () => {
                  if (pollingRef.current !== null) {
                    window.clearInterval(pollingRef.current);
                    pollingRef.current = null;
                  }
                };
                const stopStreaming = () => {
                  streamRef.current?.close();
                  streamRef.current = null;
                };
                const finishTraining = (result: TrainingJobStatus) => {
                  setTrainingStatus(result);
                  if (result.status === 'completed') {
                    setLatestTrainingResult(result as TrainingRunResult);
                    setTrainingError(null);
                    if (activeWorkspace === 'competition' && result.jobId) {
                      const completedMetric = result.metrics.at(-1);
                      if (completedMetric) {
                        setCompetitionRuns((current) => {
                          const existing = current.find((run) => run.jobId === result.jobId);
                          const nextRun: CompetitionRunRecord = {
                            jobId: result.jobId,
                            trainAccuracy: completedMetric.trainAccuracy,
                            validationAccuracy: completedMetric.validationAccuracy,
                            submitted: existing?.submitted ?? false,
                            submission: existing?.submission ?? null,
                            completedAt: new Date().toISOString(),
                          };

                          return [nextRun, ...current.filter((run) => run.jobId !== result.jobId)];
                        });
                      }
                    }
                  }
                  if (result.status === 'failed') {
                    setTrainingError(result.error ?? 'Training failed unexpectedly');
                  }
                  setIsTraining(false);
                  if (result.status === 'completed' || result.status === 'failed' || result.status === 'stopped') {
                    setCurrentJobId(null);
                    liveBatchKeyRef.current = null;
                    setLiveHistory({
                      loss: [],
                      accuracy: [],
                      validationLoss: [],
                      validationAccuracy: [],
                    });
                  }
                  stopPolling();
                  stopStreaming();
                };
                const syncLiveHistory = (result: TrainingJobStatus) => {
                  if (result.status !== 'running' || result.stage !== 'train') {
                    return;
                  }
                  if (result.currentEpoch == null || result.currentBatch == null) {
                    return;
                  }

                  const batchKey = `${result.currentEpoch}:${result.currentBatch}`;
                  if (liveBatchKeyRef.current === batchKey) {
                    return;
                  }
                  liveBatchKeyRef.current = batchKey;

                  setLiveHistory((current) => ({
                    loss:
                      result.liveTrainLoss != null
                        ? [...current.loss, result.liveTrainLoss]
                        : current.loss,
                    accuracy:
                      result.liveTrainAccuracy != null
                        ? [...current.accuracy, result.liveTrainAccuracy]
                        : current.accuracy,
                    validationLoss:
                      result.liveValidationLoss != null
                        ? [...current.validationLoss, result.liveValidationLoss]
                        : current.validationLoss,
                    validationAccuracy:
                      result.liveValidationAccuracy != null
                        ? [...current.validationAccuracy, result.liveValidationAccuracy]
                        : current.validationAccuracy,
                  }));
                };
                const pollStatus = async () => {
                  try {
                    const result = await getTrainingStatus(jobId);
                    missingStatusRetries = 0;
                    setTrainingStatus(result);
                    syncLiveHistory(result);

                    if (result.status === 'completed' || result.status === 'failed' || result.status === 'stopped') {
                      finishTraining(result);
                      return result;
                    }

                    return result;
                  } catch (error) {
                    const message =
                      error instanceof Error ? error.message : 'Training status fetch failed';
                    if (message.includes('Training job not found') && missingStatusRetries < 20) {
                      missingStatusRetries += 1;
                      return null;
                    }
                    surfaceTrainingError(message, jobId);
                    stopPolling();
                    stopStreaming();
                    return null;
                  }
                };

                const initialStatus = await pollStatus();
                if (initialStatus?.status === 'completed' || initialStatus?.status === 'failed') {
                  return;
                }
                streamRef.current = subscribeTrainingStatus(jobId, {
                  onMessage: (result) => {
                    setTrainingStatus(result);
                    syncLiveHistory(result);
                    if (result.status === 'paused') {
                      setIsTraining(false);
                    }
                    if (result.status === 'running') {
                      setIsTraining(true);
                    }
                    if (result.status === 'completed' || result.status === 'failed' || result.status === 'stopped') {
                      finishTraining(result);
                    }
                  },
                  onError: () => {
                    if (usingPollingFallback) {
                      return;
                    }
                    usingPollingFallback = true;
                    stopStreaming();
                    void pollStatus();
                    pollingRef.current = window.setInterval(() => {
                      void pollStatus();
                    }, 250);
                  },
                });
              } catch (error) {
                surfaceTrainingError(
                  error instanceof Error ? error.message : 'Training failed unexpectedly',
                );
              }
            })();
          }}
          onTrainingPause={() => {
            void (async () => {
              if (!currentJobId) {
                return;
              }
              try {
                await pauseTraining(currentJobId);
                setIsTraining(false);
                setTrainingStatus((current) => (current ? { ...current, status: 'paused' } : current));
              } catch (error) {
                surfaceTrainingError(
                  error instanceof Error ? error.message : 'Pause failed unexpectedly',
                );
              }
            })();
          }}
          onTrainingStop={() => {
            void (async () => {
              if (!currentJobId) {
                return;
              }
              try {
                await stopTraining(currentJobId);
                setIsTraining(false);
                setCurrentJobId(null);
                streamRef.current?.close();
                streamRef.current = null;
                if (pollingRef.current !== null) {
                  window.clearInterval(pollingRef.current);
                  pollingRef.current = null;
                }
                setTrainingStatus((current) =>
                  current
                    ? {
                        ...current,
                        status: 'stopped',
                        currentBatch: null,
                      }
                    : null,
                );
                setLatestTrainingResult(null);
                setLiveHistory({
                  loss: [],
                  accuracy: [],
                  validationLoss: [],
                  validationAccuracy: [],
                });
                liveBatchKeyRef.current = null;
              } catch (error) {
                surfaceTrainingError(
                  error instanceof Error ? error.message : 'Stop failed unexpectedly',
                );
              }
            })();
          }}
          onModelPreview={() => {
            if (activeWorkspace === 'competition') {
              return;
            }
            setIsPreviewOpen(true);
          }}
          onReset={resetBoard}
        />

        <div className="grid min-h-0 gap-3 px-4 py-2 xl:justify-center xl:grid-cols-[clamp(248px,17vw,360px)_minmax(0,1fr)_clamp(288px,22vw,460px)] xl:px-[clamp(20px,2vw,40px)]">
          <Sidebar
            selectedDatasetId={selectedDatasetId}
            activeWorkspace={activeWorkspace}
            onDatasetSelect={(datasetId) => {
              if (activeWorkspace === 'competition') {
                return;
              }
              setSelectedDatasetId(datasetId);
            }}
            onWorkspaceSelect={setActiveWorkspace}
            onBlockDragStart={setDraggingBlock}
            onBlockDragEnd={() => setDraggingBlock(null)}
          />
          {activeWorkspace === 'competition' && !competitionRoom ? (
            <CompetitionPanel
              isLoading={competitionBusy}
              error={competitionError}
              onCreateRoom={handleCreateCompetitionRoom}
              onEnterRoom={handleEnterCompetitionRoom}
            />
          ) : (
            <>
              <div className="relative min-h-0">
                {competitionActive ? (
                  <div className="mb-2.5 overflow-hidden rounded-[28px] border border-[#dbe5f1] bg-[#f8fbff] shadow-[0_16px_36px_rgba(15,23,42,0.06)]">
                    <div className="border-b border-[#dbe5f1] bg-[linear-gradient(135deg,#0f172a,#173968_48%,#2563eb)] px-5 py-5 text-white">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-white/65">
                            Competition room
                          </div>
                          <div className="mt-1 font-display text-[28px] font-bold tracking-[-0.04em]">
                            {competitionRoom.title}
                          </div>
                          <div className="mt-2 text-[13px] font-semibold text-white/75">
                            Code {competitionRoom.roomCode} · Host {competitionRoom.hostName} · {selectedDataset.label}
                          </div>
                          {competitionRoom.participantRole === 'host' ? (
                            <div className="mt-4 flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  void handleCopyCompetitionText('Code', competitionRoom.roomCode)
                                }
                                className="inline-flex items-center gap-2 rounded-[12px] border border-white/15 bg-white/12 px-3 py-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-white"
                              >
                                <Icon name="copy" className="h-4 w-4" />
                                Copy Code
                              </button>
                              {competitionRoom.generatedPassword ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    void handleCopyCompetitionText(
                                      'Password',
                                      competitionRoom.generatedPassword ?? '',
                                    )
                                  }
                                  className="inline-flex items-center gap-2 rounded-[12px] border border-white/15 bg-white/12 px-3 py-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-white"
                                >
                                  <Icon name="copy" className="h-4 w-4" />
                                  Copy Password
                                </button>
                              ) : null}
                              <button
                                type="button"
                                onClick={() =>
                                  void handleCopyCompetitionText(
                                    'Join info',
                                    [
                                      `Title: ${competitionRoom.title}`,
                                      `Dataset: ${selectedDataset.label}`,
                                      `Code: ${competitionRoom.roomCode}`,
                                      competitionRoom.generatedPassword
                                        ? `Password: ${competitionRoom.generatedPassword}`
                                        : null,
                                    ]
                                      .filter((item): item is string => item !== null)
                                      .join('\n'),
                                  )
                                }
                                className="inline-flex items-center gap-2 rounded-[12px] border border-white/15 bg-white/12 px-3 py-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-white"
                              >
                                <Icon name="copy" className="h-4 w-4" />
                                Copy Join Info
                              </button>
                              {competitionCopyFeedback ? (
                                <div className="rounded-full bg-white/14 px-3 py-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-white">
                                  {competitionCopyFeedback}
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setIsCompetitionRankOpen(true)}
                            className="rounded-[14px] border border-white/15 bg-white/12 px-4 py-2 text-[12px] font-extrabold uppercase tracking-[0.14em] text-white"
                          >
                            View Leaderboard
                          </button>
                          <div className="rounded-[14px] bg-white/12 px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-white/85">
                            Submit from run cards
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-3 px-5 py-5 xl:grid-cols-[minmax(0,1.15fr)_180px_180px]">
                      <div className="rounded-[20px] border border-[#dbe5f1] bg-white px-4 py-4">
                        <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#71839d]">
                          Batch size
                        </div>
                        <div className="mt-3 grid grid-cols-4 gap-2">
                          {competitionBatchSizes.map((size) => (
                            <button
                              key={size}
                              type="button"
                              onClick={() => setBatchSize(size)}
                              className={[
                                'rounded-[12px] px-2 py-2 text-[12px] font-extrabold transition',
                                batchSize === size
                                  ? 'bg-[#2563eb] text-white shadow-[0_10px_20px_rgba(37,99,235,0.2)]'
                                  : 'bg-[#f4f8fd] text-[#2563eb]',
                              ].join(' ')}
                            >
                              {size}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="rounded-[20px] border border-[#dbe5f1] bg-white px-4 py-4">
                        <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#71839d]">
                          Participants
                        </div>
                        <div className="mt-2 font-display text-[22px] font-bold text-[#10213b]">
                          {competitionRoom.participants.length}
                        </div>
                      </div>
                      <div className="rounded-[20px] border border-[#dbe5f1] bg-white px-4 py-4">
                        <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#71839d]">
                          Your role
                        </div>
                        <div className="mt-2 font-display text-[22px] font-bold text-[#10213b]">
                          {competitionRoom.participantRole}
                        </div>
                      </div>
                    </div>

                    {competitionError ? (
                      <div className="px-5 pb-5">
                        <div className="rounded-[16px] border border-[#f5c2c7] bg-[#fff5f5] px-4 py-3 text-[13px] font-semibold text-[#b42318]">
                          {competitionError}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <Canvas
                  selectedDataset={selectedDataset}
                  nodes={nodes}
                  draggingBlock={draggingBlock}
                  zoom={1}
                  onRemoveNode={removeNode}
                  onUpdateNodeField={updateNodeField}
                  onUpdateNodeActivation={updateNodeActivation}
                  onMoveNode={moveNode}
                  onDropBlock={(type, index) => {
                    addNode(type, index);
                    setDraggingBlock(null);
                  }}
                />
                {activeWorkspace !== 'competition' ? (
                  <TrainingLiveOverlay
                    dataset={selectedDataset}
                    nodes={nodes}
                    trainingStatus={trainingStatus ?? (latestTrainingResult as TrainingJobStatus | null)}
                    isAvailable={
                      isTraining ||
                      currentJobId !== null ||
                      trainingStatus !== null ||
                      latestTrainingResult !== null
                    }
                    isOpen={isTrainingOverlayOpen}
                    onClose={() => setIsTrainingOverlayOpen(false)}
                    onOpen={() => setIsTrainingOverlayOpen(true)}
                  />
                ) : null}
              </div>
              {competitionActive && competitionRoom ? (
                <CompetitionSidebar
                  room={competitionRoom}
                  trainingStatus={trainingStatus ?? (latestTrainingResult as TrainingJobStatus | null)}
                  liveHistory={liveHistory}
                  runs={competitionRuns}
                  selectedRunJobId={selectedCompetitionRunJobId}
                  submitBusy={competitionSubmitBusy}
                  onSelectRun={setSelectedCompetitionRunJobId}
                  onSubmitRun={(jobId) => void handleSubmitCompetitionRun(jobId)}
                />
              ) : (
                <Inspector
                  trainingStatus={trainingStatus ?? (latestTrainingResult as TrainingJobStatus | null)}
                  liveHistory={liveHistory}
                  showMnistCanvas={activeWorkspace !== 'competition'}
                />
              )}
            </>
          )}
        </div>
      </div>

      {isPreviewOpen ? (
        <ModelPreviewModal
          dataset={selectedDataset}
          nodes={nodes}
          optimizer={optimizer}
          learningRate={learningRate}
          epochs={epochs}
          optimizerParams={optimizerParams}
          onClose={() => setIsPreviewOpen(false)}
        />
      ) : null}

      {competitionActive && competitionRoom && isCompetitionRankOpen ? (
        <CompetitionRankModal
          roomTitle={competitionRoom.title}
          leaderboard={competitionLeaderboard}
          isHost={competitionRoom.participantRole === 'host'}
          onClose={() => setIsCompetitionRankOpen(false)}
        />
      ) : null}
    </div>
  );
}
