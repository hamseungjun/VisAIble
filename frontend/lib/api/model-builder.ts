import { apiClient, buildApiUrl, competitionApiClient } from '@/lib/api/client';
import type {
  CanvasNode,
  CompetitionLeaderboard,
  CompetitionPreparedSubmission,
  CompetitionRoomSession,
  CompetitionSubmissionResult,
  TrainingAugmentationId,
  TrainingAugmentationParams,
  TrainingJobStatus,
  TrainingRunResult,
} from '@/types/builder';

export type SaveArchitecturePayload = {
  datasetId: string;
  learningRate: number;
  optimizer: string;
  nodes: CanvasNode[];
};

export type TrainModelPayload = {
  datasetId: string;
  learningRate: number;
  epochs: number;
  batchSize: number;
  optimizer: string;
  optimizerParams: {
    momentum: string;
    rho: string;
  };
  augmentations?: TrainingAugmentationId[];
  augmentationParams?: TrainingAugmentationParams;
  nodes: CanvasNode[];
};

export async function saveArchitecture(payload: SaveArchitecturePayload) {
  return apiClient<{ id: string; savedAt: string }>('/architectures', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function trainModel(payload: TrainModelPayload) {
  return apiClient<TrainingRunResult>('/training/run', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function createCompetitionRoom(payload: {
  hostName: string;
  title: string;
  datasetId: string;
  roomCode?: string;
  password?: string;
  startsAt?: string;
  endsAt?: string;
}) {
  return competitionApiClient<CompetitionRoomSession>('/competition/rooms/create', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function enterCompetitionRoom(payload: {
  roomCode: string;
  password: string;
  participantName: string;
}) {
  return competitionApiClient<CompetitionRoomSession>('/competition/rooms/enter', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getCompetitionRoom(roomCode: string, participantId?: number) {
  return competitionApiClient<CompetitionRoomSession>(`/competition/rooms/${roomCode}`, {
    query: { participant_id: participantId },
  });
}

export async function getCompetitionLeaderboard(roomCode: string, participantId?: number) {
  return competitionApiClient<CompetitionLeaderboard>(`/competition/rooms/${roomCode}/leaderboard`, {
    query: { participant_id: participantId },
  });
}

export async function prepareCompetitionSubmission(payload: {
  roomCode: string;
  participantId: number;
  datasetId: string;
  jobId: string;
  optimizer: string;
  batchSize: number;
}) {
  return apiClient<CompetitionPreparedSubmission>('/competition/submissions/prepare', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function submitCompetitionRun(payload: CompetitionPreparedSubmission) {
  return competitionApiClient<CompetitionSubmissionResult>('/competition/submissions', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function startTraining(payload: TrainModelPayload) {
  return apiClient<{ jobId: string; status: string }>('/training/start', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getTrainingStatus(jobId: string) {
  return apiClient<TrainingJobStatus>(`/training/status/${jobId}`);
}

export async function getDecisionBoundaryAnchors(datasetId: string) {
  return apiClient<{ datasetId: string; anchors: Array<{ x: number; y: number; label: number }> }>(
    `/training/decision-boundary/${datasetId}`,
  );
}

export async function pauseTraining(jobId: string) {
  return apiClient<{ jobId: string; status: string }>(`/training/pause/${jobId}`, {
    method: 'POST',
  });
}

export async function resumeTraining(jobId: string) {
  return apiClient<{ jobId: string; status: string }>(`/training/resume/${jobId}`, {
    method: 'POST',
  });
}

export async function stopTraining(jobId: string) {
  return apiClient<{ jobId: string; status: string }>(`/training/stop/${jobId}`, {
    method: 'POST',
  });
}

export async function predictDigit(jobId: string, pixels: number[]) {
  return apiClient<{ predictedLabel: number; confidence: number; probabilities: number[] }>(
    `/training/predict/${jobId}`,
    {
      method: 'POST',
      body: JSON.stringify({ pixels }),
    },
  );
}

export async function predictSample(jobId: string, pixels: number[]) {
  return apiClient<{ predictedLabel: number; confidence: number; probabilities: number[] }>(
    `/training/predict-sample/${jobId}`,
    {
      method: 'POST',
      body: JSON.stringify({ pixels }),
    },
  );
}

export async function generateGradCam(jobId: string, classIndex: number) {
  return apiClient<{
    gradCamImage: string;
    originalImage: string;
    predictedLabel: number;
    confidence: number;
    probabilities: number[];
  }>(`/training/gradcam/${jobId}`, {
    method: 'POST',
    body: JSON.stringify({ classIndex }),
  });
}

export function subscribeTrainingStatus(
  jobId: string,
  handlers: {
    onMessage: (status: TrainingJobStatus) => void;
    onError?: () => void;
  },
) {
  const stream = new EventSource(buildApiUrl(`/training/stream/${jobId}`));

  stream.onmessage = (event) => {
    handlers.onMessage(JSON.parse(event.data) as TrainingJobStatus);
  };

  stream.onerror = () => {
    handlers.onError?.();
  };

  return stream;
}
