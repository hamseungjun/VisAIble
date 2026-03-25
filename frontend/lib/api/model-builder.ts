import { apiClient, buildApiUrl } from '@/lib/api/client';
import type { CanvasNode, TrainingJobStatus, TrainingRunResult } from '@/types/builder';

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
  optimizer: string;
  optimizerParams: {
    momentum: string;
    weightDecay: string;
    rho: string;
  };
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

export async function startTraining(payload: TrainModelPayload) {
  return apiClient<{ jobId: string; status: string }>('/training/start', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getTrainingStatus(jobId: string) {
  return apiClient<TrainingJobStatus>(`/training/status/${jobId}`);
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
