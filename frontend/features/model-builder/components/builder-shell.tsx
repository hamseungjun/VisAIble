'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AugmentationPanel } from '@/features/model-builder/components/augmentation-panel';
import { Canvas } from '@/features/model-builder/components/canvas';
import { CompetitionPanel } from '@/features/model-builder/components/competition-panel';
import { CompetitionRankModal } from '@/features/model-builder/components/competition-rank-modal';
import { CompetitionSidebar } from '@/features/model-builder/components/competition-sidebar';
import { Icon } from '@/features/model-builder/components/icons';
import { Inspector } from '@/features/model-builder/components/inspector';
import { MnistElevatorMission } from '@/features/model-builder/components/mnist-elevator-mission';
import { ModelPreviewModal } from '@/features/model-builder/components/model-preview-modal';
import { Sidebar } from '@/features/model-builder/components/sidebar';
import { TopBar } from '@/features/model-builder/components/top-bar';
import { TrainingLiveOverlay } from '@/features/model-builder/components/training-live-overlay';
import { TutorialCoachOverlay } from '@/features/model-builder/components/tutorial-coach-overlay';
import { useBuilderBoard } from '@/features/model-builder/hooks/use-builder-board';
import {
  tutorialSequence,
  type TutorialStepKey,
} from '@/features/model-builder/lib/tutorial-steps';
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
import { defaultAugmentationParams } from '@/lib/constants/augmentations';
import { datasets } from '@/lib/constants/builder-data';
import {
  batchSizeOptions,
  optimizerConfigs,
  type OptimizerName,
  type OptimizerParams,
} from '@/lib/constants/training-controls';
import type {
  BlockType,
  CompetitionLeaderboard,
  CompetitionRoomSession,
  CompetitionSubmissionResult,
  TrainingAugmentationId,
  TrainingJobStatus,
  TrainingAugmentationParams,
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

function formatCompetitionDateLabel(value?: string | null) {
  if (!value) {
    return 'Open';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Open';
  }

  return new Intl.DateTimeFormat('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function getCompetitionTimeline(room: CompetitionRoomSession, now: number) {
  const fallbackStart = room.startsAt ?? room.createdAt;
  const start = fallbackStart ? new Date(fallbackStart) : null;
  const end = room.endsAt ? new Date(room.endsAt) : null;

  if (!start || Number.isNaN(start.getTime()) || !end || Number.isNaN(end.getTime())) {
    return null;
  }

  const total = Math.max(end.getTime() - start.getTime(), 1);
  const elapsed = Math.min(Math.max(now - start.getTime(), 0), total);
  const remaining = Math.max(end.getTime() - now, 0);
  const progress = Math.round((elapsed / total) * 100);

  return {
    startLabel: formatCompetitionDateLabel(start.toISOString()),
    endLabel: formatCompetitionDateLabel(end.toISOString()),
    remainingMs: remaining,
    progress,
    isEnded: remaining <= 0,
  };
}

function formatRemainingTime(ms: number) {
  if (ms <= 0) {
    return '종료됨';
  }

  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return `${days}일 ${hours}시간 남음`;
  }

  if (hours > 0) {
    return `${hours}시간 ${minutes}분 남음`;
  }

  return `${minutes}분 남음`;
}

type CompetitionRunRecord = {
  jobId: string;
  trainAccuracy: number;
  validationAccuracy: number;
  submitted: boolean;
  submission?: CompetitionSubmissionResult | null;
  completedAt?: string | null;
};

type WorkspaceMode = 'builder' | 'tutorial' | 'competition';

type DatasetTeachingConfig = {
  allowedBlocks: BlockType[];
};

function getDatasetTeachingConfig(datasetId: string): DatasetTeachingConfig {
  if (datasetId === 'mnist') {
    return {
      allowedBlocks: ['linear', 'dropout'],
    };
  }

  if (datasetId === 'fashion_mnist' || datasetId === 'cifar10') {
    return {
      allowedBlocks: ['linear', 'cnn', 'pooling', 'dropout'],
    };
  }

  return {
    allowedBlocks: ['linear', 'cnn', 'pooling', 'dropout'],
  };
}

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
    filterNodes,
  } = useBuilderBoard();
  const [selectedDatasetId, setSelectedDatasetId] = useState(datasets[0]?.id ?? 'mnist');
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceMode>('builder');
  const [optimizer, setOptimizer] = useState<OptimizerName>('AdamW');
  const [learningRate, setLearningRate] = useState(optimizerConfigs.AdamW.defaultLearningRate);
  const [epochs, setEpochs] = useState('10');
  const [batchSize, setBatchSize] = useState(128);
  const [optimizerParams, setOptimizerParams] = useState<OptimizerParams>({
    momentum: optimizerConfigs.SGD.parameter!.defaultValue,
    rho: optimizerConfigs['RMS Prop'].parameter!.defaultValue,
  });
  const [selectedAugmentations, setSelectedAugmentations] = useState<TrainingAugmentationId[]>([]);
  const [augmentationParams, setAugmentationParams] =
    useState<TrainingAugmentationParams>(defaultAugmentationParams);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isTrainingOverlayOpen, setIsTrainingOverlayOpen] = useState(false);
  const [isTraining, setIsTraining] = useState(false);
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
  const [isCompetitionInfoOpen, setIsCompetitionInfoOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [isHomeGuideOpen, setIsHomeGuideOpen] = useState(false);
  const [tutorialGuideOpen, setTutorialGuideOpen] = useState(false);
  const [tutorialStep, setTutorialStep] = useState<TutorialStepKey>('story-intro');
  const [tutorialPredictionDone, setTutorialPredictionDone] = useState(false);
  const [isMnistMissionMinimized, setIsMnistMissionMinimized] = useState(false);
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
  const showAugmentationPanel =
    activeWorkspace === 'builder' ||
    (activeWorkspace === 'tutorial' && runtimeDatasetId === 'cifar10');
  const activeAugmentations = showAugmentationPanel ? selectedAugmentations : [];
  const activeAugmentationParams = showAugmentationPanel
    ? Object.fromEntries(
        activeAugmentations.map((augmentationId) => [
          augmentationId,
          augmentationParams[augmentationId] ?? defaultAugmentationParams[augmentationId],
        ]),
      )
    : {};
  const teachingConfig =
    activeWorkspace === 'tutorial'
      ? getDatasetTeachingConfig(runtimeDatasetId)
      : { allowedBlocks: ['linear', 'cnn', 'pooling', 'dropout'] as BlockType[] };
  const linearNodeExists = nodes.some((node) => node.type === 'linear');
  const lastLinearNode = [...nodes].reverse().find((node) => node.type === 'linear') ?? null;
  const mnistTutorialOutputValue =
    lastLinearNode?.fields.find((field) => field.label === 'Output')?.value ?? '';
  const isMnistTutorialOutputReady =
    lastLinearNode?.type === 'linear' && mnistTutorialOutputValue === '10';
  const isMnistTutorialActivationReady =
    lastLinearNode?.type === 'linear' && lastLinearNode.activation === 'None';
  const showTutorialMnistMission =
    activeWorkspace === 'tutorial' &&
    runtimeDatasetId === 'mnist' &&
    trainingStatus?.status === 'completed' &&
    trainingStatus.datasetId === 'mnist' &&
    !!trainingStatus.jobId;
  const isMnistTutorialActive = activeWorkspace === 'tutorial' && runtimeDatasetId === 'mnist';
  const mnistQuestPhase =
    tutorialStep === 'story-intro'
      ? 'intro'
      : tutorialStep === 'play-mission'
        ? 'mission'
        : tutorialStep === 'complete'
          ? 'complete'
          : null;
  const shellGridClassName = isMnistTutorialActive
    ? 'mt-3 grid min-h-0 gap-4 xl:grid-cols-[clamp(280px,18vw,382px)_minmax(0,1fr)]'
    : 'mt-3 grid min-h-0 gap-4 xl:justify-center xl:grid-cols-[clamp(280px,18vw,382px)_minmax(0,1fr)_clamp(320px,22vw,468px)]';

  const tutorialOverlayCopy = useMemo(
    () =>
      ({
        'story-intro': {
          title: '버튼 없는 엘리베이터',
          description:
            '이번 미션은 버튼이 없는 엘리베이터예요. 승객이 층수를 손글씨로 적으면, 모델이 그 숫자를 읽고 해당 층으로 엘리베이터를 보내야 합니다.',
          targetName: null,
          canAdvance: true,
          advanceLabel: '미션 시작',
        },
        'build-model': {
          title: '먼저 숫자 판별기를 만들자',
          description:
            '왼쪽 Block Library에서 Linear 블록을 잡아 끌어주세요. 먼저 드래그를 시작하면, 그다음 어디에 쌓을지 바로 보여줄게요.',
          targetName: 'tutorial-block-library',
          canAdvance: false,
        },
        'stack-block': {
          title: '이제 블록을 캔버스에 쌓자',
          description:
            '지금 잡은 Linear 블록을 Builder Canvas 안에 내려놓아 데이터 블록 아래에 쌓아주세요. 이 레이어가 숫자 판별기의 시작점이 됩니다.',
          targetName: 'tutorial-builder-canvas',
          canAdvance: false,
        },
        'edit-dimensions': {
          title: '이제 출력 차원을 10으로 맞추자',
          description:
            '방금 쌓은 Linear 블록의 Output 값을 10으로 바꿔주세요. MNIST는 0부터 9까지 총 10개의 숫자를 구분해야 하므로 마지막 출력 차원도 10이어야 합니다.',
          targetName: 'tutorial-linear-output-field',
          canAdvance: false,
        },
        'set-activation': {
          title: 'Activation도 확인해보자',
          description:
            '이제 Activation Function을 `None`으로 바꿔주세요. 마지막 출력층은 숫자 10개에 대한 점수를 그대로 내보내야 해서, 이 단계에서는 활성화 함수를 끄고 다음으로 넘어갑니다.',
          targetName: 'tutorial-linear-activation-field',
          canAdvance: false,
        },
        'train-model': {
          title: '이제 엘리베이터의 두뇌를 학습시켜보자',
          description:
            '좋아요. 블록을 쌓았으니 이제 상단의 Start 버튼으로 엘리베이터 두뇌를 학습시켜주세요. 학습이 끝나면 손글씨 층수 요청을 읽을 수 있습니다.',
          targetName: 'tutorial-start-button',
          canAdvance: false,
        },
        'play-mission': {
          title: '손글씨 층수를 읽어 엘리베이터를 보내자',
          description:
            '오른쪽 미션 패널이 열렸어요. 목표 층수를 손글씨로 적고 Predict Floor를 눌러, 승객을 정확한 층에 도착시켜보세요.',
          targetName: 'tutorial-mnist-story',
          canAdvance: false,
        },
        complete: {
          title: '엘리베이터 미션 완료',
          description:
            '성공입니다. 손글씨 층수를 읽어 버튼 없는 엘리베이터를 작동시켰어요. 다음에는 Fashion MNIST나 CIFAR 스토리도 같은 방식으로 확장할 수 있습니다.',
          targetName: null,
          canAdvance: true,
          advanceLabel: '닫기',
        },
      }) satisfies Record<
        TutorialStepKey,
        {
          title: string;
          description: string;
          targetName: string | null;
          canAdvance: boolean;
          advanceLabel?: string;
        }
      >,
    [],
  );
  const activeTutorialOverlayStep = tutorialOverlayCopy[tutorialStep];

  const closeHomeGuide = () => {
    setIsHomeGuideOpen(false);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('visaible-home-guide-seen', 'true');
    }
  };

  const exitMnistQuest = () => {
    setTutorialGuideOpen(false);
    setTutorialStep('story-intro');
    setTutorialPredictionDone(false);
    setIsMnistMissionMinimized(false);
    setActiveWorkspace('builder');
  };

  const clearTrainingUiState = () => {
    if (pollingRef.current !== null) {
      window.clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    streamRef.current?.close();
    streamRef.current = null;
    liveBatchKeyRef.current = null;
    setIsTraining(false);
    setIsTrainingOverlayOpen(false);
    setTrainingStatus(null);
    setLatestTrainingResult(null);
    setLiveHistory({ loss: [], accuracy: [], validationLoss: [], validationAccuracy: [] });
    setCurrentJobId(null);
  };

  const surfaceTrainingError = (message: string, jobId: string | null = currentJobId) => {
    console.error('Training error:', message, { jobId: jobId ?? currentJobId ?? 'local-error' });
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

  const applyTutorialPreset = (datasetId: string) => {
    const nextConfig = getDatasetTeachingConfig(datasetId);
    filterNodes(nextConfig.allowedBlocks);
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
    const timer = window.setInterval(() => {
      setCurrentTime(Date.now());
    }, 60000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const seen = window.localStorage.getItem('visaible-home-guide-seen');
    if (!seen) {
      setIsHomeGuideOpen(true);
    }
  }, []);

  useEffect(() => {
    if (activeWorkspace === 'tutorial') {
      applyTutorialPreset(runtimeDatasetId);
    }
  }, [activeWorkspace, runtimeDatasetId]);

  useEffect(() => {
    if (!isMnistTutorialActive) {
      setTutorialGuideOpen(false);
      setTutorialStep('story-intro');
      setTutorialPredictionDone(false);
      setIsMnistMissionMinimized(false);
      return;
    }

    if (selectedDatasetId === 'mnist' && nodes.length === 0 && currentJobId === null) {
      setTutorialGuideOpen(true);
      setTutorialStep('story-intro');
      setTutorialPredictionDone(false);
      setIsMnistMissionMinimized(false);
    }
  }, [isMnistTutorialActive, selectedDatasetId, nodes.length, currentJobId]);

  useEffect(() => {
    if (!isMnistTutorialActive) {
      return;
    }

    if (tutorialStep === 'build-model') {
      if (linearNodeExists) {
        setTutorialStep('edit-dimensions');
        return;
      }

      if (draggingBlock === 'linear') {
        setTutorialStep('stack-block');
      }
      return;
    }

    if (tutorialStep === 'stack-block' && linearNodeExists) {
      setTutorialStep('edit-dimensions');
      return;
    }

    if (tutorialStep === 'edit-dimensions' && isMnistTutorialOutputReady) {
      setTutorialStep('set-activation');
      return;
    }

    if (tutorialStep === 'set-activation' && isMnistTutorialActivationReady) {
      setTutorialStep('train-model');
      return;
    }

    if (tutorialStep === 'train-model' && showTutorialMnistMission) {
      setTutorialStep('play-mission');
      return;
    }

    if (tutorialStep === 'play-mission' && tutorialPredictionDone) {
      setTutorialStep('complete');
    }
  }, [
    isMnistTutorialActive,
    draggingBlock,
    isMnistTutorialActivationReady,
    isMnistTutorialOutputReady,
    linearNodeExists,
    showTutorialMnistMission,
    tutorialPredictionDone,
    tutorialStep,
  ]);

  useEffect(() => {
    if (!isMnistTutorialActive) {
      return;
    }

    if (
      tutorialStep === 'story-intro' ||
      tutorialStep === 'play-mission' ||
      tutorialStep === 'complete'
    ) {
      setIsMnistMissionMinimized(false);
      return;
    }

    setIsMnistMissionMinimized(true);
  }, [isMnistTutorialActive, tutorialStep]);

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
  const competitionInfoText = competitionRoom
    ? [
        `Title: ${competitionRoom.title}`,
        `Dataset: ${selectedDataset.label}`,
        `Code: ${competitionRoom.roomCode}`,
        competitionRoom.generatedPassword ? `Password: ${competitionRoom.generatedPassword}` : null,
      ]
        .filter((item): item is string => item !== null)
        .join('\n')
    : '';
  const competitionTimeline =
    competitionActive && competitionRoom
      ? getCompetitionTimeline(competitionRoom, currentTime)
      : null;

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

  const handleLeaveCompetitionRoom = () => {
    setCompetitionRoom(null);
    setCompetitionLeaderboard(null);
    setCompetitionRuns([]);
    setSelectedCompetitionRunJobId(null);
    setCompetitionError(null);
    setCompetitionCopyFeedback(null);
    setIsCompetitionInfoOpen(false);
    setIsCompetitionRankOpen(false);
    setActiveWorkspace('builder');
  };

  return (
    <div className="min-h-screen px-3 py-3 xl:px-4 xl:py-4">
      <div className="mx-auto w-full max-w-[min(2320px,calc(100vw-8px))]">
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
          onBatchSizeChange={setBatchSize}
          onOptimizerChange={(value) => {
            const config = optimizerConfigs[value];
            setOptimizer(value);
            setLearningRate(config.defaultLearningRate);
            if (config.parameter) {
              setOptimizerParams((current) => ({
                ...current,
                [config.parameter!.key]: config.parameter!.defaultValue,
              }));
            }
          }}
          onOptimizerParamChange={(key, value) =>
            setOptimizerParams((current) => ({ ...current, [key]: value }))
          }
          onTrainingStart={() => {
            void (async () => {
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
                  augmentations: activeAugmentations,
                  augmentationParams: activeAugmentationParams,
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
                    console.error('Training failed:', result.error ?? 'Training failed unexpectedly', {
                      jobId: result.jobId,
                      stage: result.stage ?? null,
                    });
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
          onLogoClick={() => {
            setActiveWorkspace('builder');
            setIsCompetitionInfoOpen(false);
            setIsCompetitionRankOpen(false);
            setTutorialGuideOpen(false);
          }}
        />

        <div className={shellGridClassName}>
          <Sidebar
            selectedDatasetId={selectedDatasetId}
            activeWorkspace={activeWorkspace}
            hasCompetitionRoom={competitionRoom !== null}
            selectedDataset={selectedDataset}
            availableBlockTypes={teachingConfig.allowedBlocks}
            onDatasetSelect={(datasetId) => {
              if (activeWorkspace === 'competition') {
                return;
              }
              if (currentJobId) {
                void stopTraining(currentJobId).catch(() => {});
              }
              clearTrainingUiState();
              resetBoard();
              if (activeWorkspace === 'tutorial') {
                applyTutorialPreset(datasetId);
                setTutorialGuideOpen(datasetId === 'mnist');
                setTutorialStep('story-intro');
                setTutorialPredictionDone(false);
                setIsMnistMissionMinimized(false);
              }
              setSelectedDatasetId(datasetId);
            }}
            onWorkspaceSelect={(workspace) => {
              if (workspace === activeWorkspace) {
                return;
              }

              if (workspace !== 'competition' && currentJobId) {
                void stopTraining(currentJobId).catch(() => {});
              }

              clearTrainingUiState();
              resetBoard();

              if (workspace === 'tutorial') {
                setSelectedDatasetId('mnist');
                setTutorialGuideOpen(true);
                setTutorialStep('story-intro');
                setTutorialPredictionDone(false);
                setIsMnistMissionMinimized(false);
              }

              if (workspace !== 'tutorial') {
                setTutorialGuideOpen(false);
                setTutorialPredictionDone(false);
                setIsMnistMissionMinimized(false);
              }

              setActiveWorkspace(workspace);
            }}
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
                            VisAible Competition
                          </div>
                          <div className="mt-1 font-display text-[28px] font-bold tracking-[-0.04em]">
                            {competitionRoom.title}
                          </div>
                          <div className="mt-2 text-[13px] font-semibold text-white/75">
                            Code {competitionRoom.roomCode} · Host {competitionRoom.hostName} · {selectedDataset.label}
                          </div>
                          {competitionRoom.participantRole === 'host' ? (
                            <div className="relative mt-4 flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setIsCompetitionInfoOpen((current) => !current);
                                  void handleCopyCompetitionText('Info', competitionInfoText);
                                }}
                                className="inline-flex items-center gap-2 rounded-[12px] border border-white/15 bg-white/12 px-3 py-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-white"
                              >
                                <Icon name="copy" className="h-4 w-4" />
                                Info
                              </button>
                              {isCompetitionInfoOpen ? (
                                <div className="absolute left-0 top-full z-20 mt-3 w-[min(320px,80vw)] rounded-[18px] border border-white/15 bg-[rgba(15,23,42,0.88)] p-4 text-white shadow-[0_18px_40px_rgba(15,23,42,0.28)] backdrop-blur">
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-white/70">
                                      Room Info
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => setIsCompetitionInfoOpen(false)}
                                      className="rounded-full border border-white/10 px-2 py-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-white/75"
                                    >
                                      Close
                                    </button>
                                  </div>
                                  <pre className="mt-3 whitespace-pre-wrap break-words font-mono text-[12px] leading-6 text-white/90">
                                    {competitionInfoText}
                                  </pre>
                                  <div className="mt-3 text-[11px] font-semibold text-white/65">
                                    {competitionCopyFeedback ?? '클릭하면 정보가 복사됩니다.'}
                                  </div>
                                </div>
                              ) : null}
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
                            className="rounded-[14px] border border-white/15 bg-white/16 px-4 py-2 text-[12px] font-extrabold tracking-[0.06em] text-white"
                          >
                            리더보드 보기
                          </button>
                          <button
                            type="button"
                            onClick={handleLeaveCompetitionRoom}
                            className="rounded-[14px] border border-[#fecaca] bg-[rgba(127,29,29,0.18)] px-4 py-2 text-[12px] font-extrabold tracking-[0.06em] text-white"
                          >
                            방 나가기
                          </button>
                          <div className="rounded-[14px] bg-white/12 px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-white/85">
                            Run 카드에서 제출
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-3 px-5 py-5 xl:grid-cols-[minmax(0,1.15fr)_180px_180px]">
                      <div className="rounded-[20px] border border-[#dbe5f1] bg-white px-4 py-4">
                        <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#71839d]">
                          Batch size
                        </div>
                        <div className="mt-3 flex items-center gap-3">
                          <input
                            type="range"
                            min={0}
                            max={batchSizeOptions.length - 1}
                            step={1}
                            value={Math.max(0, batchSizeOptions.indexOf(batchSize as (typeof batchSizeOptions)[number]))}
                            onChange={(event) =>
                              setBatchSize(
                                batchSizeOptions[Number(event.target.value)] ?? batchSizeOptions[0],
                              )
                            }
                            className="h-1 w-full accent-[#2563eb]"
                          />
                          <div className="min-w-[48px] text-right font-display text-[20px] font-bold text-[#10213b]">
                            {batchSize}
                          </div>
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
                {competitionTimeline ? (
                  <div className="mb-2.5 rounded-[24px] border border-[#dbe5f1] bg-white px-5 py-4 shadow-[0_16px_36px_rgba(15,23,42,0.06)]">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#6e809a]">
                          Competition Progress
                        </div>
                        <div className="mt-1 text-[18px] font-bold text-[#10213b]">
                          {competitionTimeline.isEnded
                            ? '대회가 종료되었습니다'
                            : formatRemainingTime(competitionTimeline.remainingMs)}
                        </div>
                      </div>
                      <div className="rounded-full bg-[#eef4ff] px-4 py-2 text-[13px] font-extrabold uppercase tracking-[0.14em] text-[#2563eb]">
                        {competitionTimeline.progress}%
                      </div>
                    </div>
                    <div className="mt-4 h-3 overflow-hidden rounded-full bg-[#e7eef8]">
                      <div
                        className="h-full rounded-full bg-[linear-gradient(90deg,#2563eb,#60a5fa)] transition-all duration-500"
                        style={{ width: `${competitionTimeline.progress}%` }}
                      />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[13px] font-semibold text-[#60718a]">
                      <span>시작 {competitionTimeline.startLabel}</span>
                      <span>종료 {competitionTimeline.endLabel}</span>
                    </div>
                  </div>
                ) : null}
                {showAugmentationPanel ? (
                  <AugmentationPanel
                    selectedAugmentations={selectedAugmentations}
                    augmentationParams={augmentationParams}
                    onToggle={(augmentationId) =>
                      setSelectedAugmentations((current) =>
                        current.includes(augmentationId)
                          ? current.filter((id) => id !== augmentationId)
                          : [...current, augmentationId],
                      )
                    }
                    onChangeParam={(augmentationId, value) =>
                      setAugmentationParams((current) => ({
                        ...current,
                        [augmentationId]: value,
                      }))
                    }
                  />
                ) : null}
                <Canvas
                  selectedDataset={selectedDataset}
                  nodes={nodes}
                  draggingBlock={draggingBlock}
                  zoom={1}
                  tutorialTargetFieldName={
                    isMnistTutorialActive && tutorialStep === 'edit-dimensions'
                      ? 'tutorial-linear-output-field'
                      : null
                  }
                  tutorialTargetActivationName={
                    isMnistTutorialActive && tutorialStep === 'set-activation'
                      ? 'tutorial-linear-activation-field'
                      : null
                  }
                  onRemoveNode={removeNode}
                  onUpdateNodeField={updateNodeField}
                  onUpdateNodeActivation={updateNodeActivation}
                  onMoveNode={moveNode}
                  onDropBlock={(type, index) => {
                    if (activeWorkspace === 'tutorial' && !teachingConfig.allowedBlocks.includes(type)) {
                      setDraggingBlock(null);
                      return;
                    }
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
              ) : isMnistTutorialActive ? null : (
                <Inspector
                  trainingStatus={trainingStatus ?? (latestTrainingResult as TrainingJobStatus | null)}
                  selectedDataset={selectedDataset}
                  liveHistory={liveHistory}
                  showMnistCanvas={activeWorkspace !== 'competition'}
                  onDigitPredictionComplete={() => setTutorialPredictionDone(true)}
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

      {isHomeGuideOpen ? (
        <TutorialCoachOverlay
          open={isHomeGuideOpen}
          stepKey="home-intro"
          stepIndex={0}
          totalSteps={1}
          title="VisAible에 온 걸 환영해요"
          description="처음 접속한 사용자를 위해 한 번만 보여드리는 안내예요. 왼쪽 Workspace에서 Tutorial을 고르면 데이터셋별 스토리형 미션을 시작할 수 있습니다."
          canAdvance
          advanceLabel="둘러보기"
          onAdvance={closeHomeGuide}
          onSkip={closeHomeGuide}
        />
      ) : null}

      {isMnistTutorialActive &&
      tutorialGuideOpen &&
      (tutorialStep === 'build-model' ||
        tutorialStep === 'stack-block' ||
        tutorialStep === 'edit-dimensions' ||
        tutorialStep === 'set-activation' ||
        tutorialStep === 'train-model') ? (
        <TutorialCoachOverlay
          open={tutorialGuideOpen}
          stepKey={tutorialStep}
          stepIndex={tutorialSequence.indexOf(tutorialStep)}
          totalSteps={tutorialSequence.length}
          title={activeTutorialOverlayStep.title}
          description={activeTutorialOverlayStep.description}
          targetName={activeTutorialOverlayStep.targetName}
          canAdvance={activeTutorialOverlayStep.canAdvance}
          advanceLabel={'advanceLabel' in activeTutorialOverlayStep ? activeTutorialOverlayStep.advanceLabel : undefined}
          onAdvance={() => {}}
          onSkip={() => setTutorialGuideOpen(false)}
        />
      ) : null}

      {isMnistTutorialActive &&
      mnistQuestPhase &&
      !(mnistQuestPhase !== 'intro' && isMnistMissionMinimized) ? (
        <MnistElevatorMission
          phase={mnistQuestPhase}
          trainingStatus={trainingStatus ?? (latestTrainingResult as TrainingJobStatus | null)}
          isMissionComplete={tutorialPredictionDone}
          onMissionComplete={() => setTutorialPredictionDone(true)}
          onMinimize={() => setIsMnistMissionMinimized(true)}
          onExitQuest={exitMnistQuest}
          onStartQuest={() => {
            setTutorialGuideOpen(true);
            setTutorialStep('build-model');
            setIsMnistMissionMinimized(false);
          }}
        />
      ) : null}

      {isMnistTutorialActive &&
      (((tutorialStep === 'build-model' ||
        tutorialStep === 'stack-block' ||
        tutorialStep === 'edit-dimensions' ||
        tutorialStep === 'set-activation' ||
        tutorialStep === 'train-model') &&
        !tutorialGuideOpen) ||
        (mnistQuestPhase && mnistQuestPhase !== 'intro' && isMnistMissionMinimized)) ? (
        <button
          type="button"
          onClick={() => {
            if (
              tutorialStep === 'build-model' ||
              tutorialStep === 'stack-block' ||
              tutorialStep === 'edit-dimensions' ||
              tutorialStep === 'set-activation' ||
              tutorialStep === 'train-model'
            ) {
              setTutorialGuideOpen(true);
              return;
            }

            setIsMnistMissionMinimized(false);
          }}
          className="animate-quest-orb fixed bottom-5 right-5 z-[85] grid h-[74px] w-[74px] place-items-center rounded-full border-4 border-white/24 bg-[radial-gradient(circle_at_35%_30%,#60a5fa,#2563eb_58%,#172554_100%)] text-[32px] font-black text-white shadow-[0_26px_60px_rgba(37,99,235,0.44)] transition hover:scale-105 hover:brightness-105"
          aria-label="미션 창 다시 열기"
        >
          <span className="relative">
            !
            <span className="absolute -right-4 -top-3 rounded-full bg-[#ef4444] px-1.5 py-0.5 text-[10px] font-black uppercase tracking-[0.16em] text-white shadow-[0_8px_16px_rgba(239,68,68,0.3)]">
              quest
            </span>
          </span>
        </button>
      ) : null}
    </div>
  );
}
