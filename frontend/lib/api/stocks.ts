import { apiClient } from '@/lib/api/client';
import type { StockPlaygroundNode, StockPreset, StockTrainingResult } from '@/types/builder';

export async function getStockPresets() {
  return apiClient<StockPreset[]>('/stocks/presets');
}

export async function searchStocks(query: string) {
  return apiClient<StockPreset[]>('/stocks/search', {
    query: { query },
  });
}

export async function trainStockModel(payload: {
  ticker: string;
  lookbackWindow: number;
  forecastDays: number;
  epochs: number;
  batchSize: number;
  hiddenSize: number;
  learningRate: number;
  nodes: StockPlaygroundNode[];
}) {
  return apiClient<StockTrainingResult>('/stocks/train', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
