import { apiClient } from '@/lib/api/client';

export type MinaChatPayload = {
  question: string;
  provider: 'gemini' | 'gemma';
  requestKind: 'general' | 'improvement';
  datasetId: string;
  datasetLabel: string;
  blocksSummary: string;
  architectureSummary: string;
  metricsSummary?: string;
  nodeDetails: Array<{
    index: number;
    type: string;
    title: string;
    activation: string;
    fields: Array<{
      label: string;
      value: string;
    }>;
  }>;
};

export async function chatWithMina(payload: MinaChatPayload) {
  return apiClient<{
    answer: string;
    highlight: {
      action?: 'edit_parameter' | 'add_block' | null;
      blockIndex: number | null;
      blockType?: 'linear' | 'cnn' | 'pooling' | 'dropout' | null;
      fieldLabel: string | null;
      suggestedValue?: string | null;
      reason?: string | null;
    } | null;
  }>('/mina/chat', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
