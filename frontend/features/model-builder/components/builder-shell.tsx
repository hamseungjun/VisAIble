'use client';

import { useEffect, useRef, useState } from 'react';
import { Canvas } from '@/features/model-builder/components/canvas';
import { Inspector } from '@/features/model-builder/components/inspector';
import { ModelPreviewModal } from '@/features/model-builder/components/model-preview-modal';
import { Sidebar } from '@/features/model-builder/components/sidebar';
import { TopBar } from '@/features/model-builder/components/top-bar';
import { useBuilderBoard } from '@/features/model-builder/hooks/use-builder-board';
import {
  getTrainingStatus,
  pauseTraining,
  resumeTraining,
  startTraining,
  stopTraining,
  subscribeTrainingStatus,
} from '@/lib/api/model-builder';
import { datasets } from '@/lib/constants/builder-data';
import {
  optimizerConfigs,
  type OptimizerName,
  type OptimizerParams,
} from '@/lib/constants/training-controls';
import type { TrainingJobStatus, TrainingRunResult } from '@/types/builder';

export function BuilderShell() {
  const {
    nodes,
    draggingBlock,
    setDraggingBlock,
    addNode,
    removeNode,
    updateNodeField,
    updateNodeActivation,
    resetBoard,
  } = useBuilderBoard();
  const [selectedDatasetId, setSelectedDatasetId] = useState(datasets[0]?.id ?? 'mnist');
  const [optimizer, setOptimizer] = useState<OptimizerName>('ADAM');
  const [learningRate, setLearningRate] = useState(optimizerConfigs.ADAM.defaultLearningRate);
  const [epochs, setEpochs] = useState('3');
  const [optimizerParams, setOptimizerParams] = useState<OptimizerParams>({
    momentum: optimizerConfigs.SGD.parameter.defaultValue,
    weightDecay: optimizerConfigs.ADAM.parameter.defaultValue,
    rho: optimizerConfigs['RMS Prop'].parameter.defaultValue,
  });
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
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
  const pollingRef = useRef<number | null>(null);
  const streamRef = useRef<EventSource | null>(null);
  const liveBatchKeyRef = useRef<string | null>(null);
  const selectedDataset = datasets.find((dataset) => dataset.id === selectedDatasetId) ?? datasets[0];

  useEffect(() => {
    return () => {
      if (pollingRef.current !== null) {
        window.clearInterval(pollingRef.current);
      }
      streamRef.current?.close();
    };
  }, []);

  return (
    <div className="min-h-screen">
      <TopBar
        learningRate={learningRate}
        epochs={epochs}
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
                setTrainingStatus((current) =>
                  current ? { ...current, status: 'running' } : current,
                );
              } catch (error) {
                setTrainingError(
                  error instanceof Error ? error.message : 'Resume failed unexpectedly',
                );
                setIsTraining(false);
              }
              return;
            }

            setIsTraining(true);
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
                datasetId: selectedDatasetId,
                learningRate: Number(learningRate),
                epochs: Number(epochs),
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
                  setTrainingError(message);
                  setIsTraining(false);
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
                  pollingRef.current = window.setInterval(() => {
                    void pollStatus();
                  }, 250);
                },
              });
            } catch (error) {
              setTrainingError(
                error instanceof Error ? error.message : 'Training failed unexpectedly',
              );
              setIsTraining(false);
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
              setTrainingError(error instanceof Error ? error.message : 'Pause failed unexpectedly');
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
              setTrainingError(error instanceof Error ? error.message : 'Stop failed unexpectedly');
            }
          })();
        }}
        onModelPreview={() => setIsPreviewOpen(true)}
        onReset={resetBoard}
      />

      <div className="grid min-h-0 gap-2.5 px-4 py-1.5 xl:grid-cols-[280px_minmax(0,1fr)_340px] xl:px-5">
        <Sidebar
          selectedDatasetId={selectedDatasetId}
          onDatasetSelect={setSelectedDatasetId}
          onBlockDragStart={setDraggingBlock}
          onBlockDragEnd={() => setDraggingBlock(null)}
        />
        <Canvas
          selectedDataset={selectedDataset}
          nodes={nodes}
          draggingBlock={draggingBlock}
          zoom={1}
          onRemoveNode={removeNode}
          onUpdateNodeField={updateNodeField}
          onUpdateNodeActivation={updateNodeActivation}
          onDropBlock={(type, index) => {
            addNode(type, index);
            setDraggingBlock(null);
          }}
        />
        <Inspector
          trainingStatus={trainingStatus ?? (latestTrainingResult as TrainingJobStatus | null)}
          liveHistory={liveHistory}
        />
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
    </div>
  );
}
