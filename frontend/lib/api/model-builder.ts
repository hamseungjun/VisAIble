import { apiClient } from '@/lib/api/client';
import type { CanvasNode } from '@/types/builder';

export type SaveArchitecturePayload = {
  datasetId: string;
  learningRate: number;
  optimizer: string;
  nodes: CanvasNode[];
};

export async function saveArchitecture(payload: SaveArchitecturePayload) {
  return apiClient<{ id: string; savedAt: string }>('/architectures', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
