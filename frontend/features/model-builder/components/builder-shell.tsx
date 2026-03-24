'use client';

import { useState } from 'react';
import { Canvas } from '@/features/model-builder/components/canvas';
import { Inspector } from '@/features/model-builder/components/inspector';
import { ModelPreviewModal } from '@/features/model-builder/components/model-preview-modal';
import { Sidebar } from '@/features/model-builder/components/sidebar';
import { TopBar } from '@/features/model-builder/components/top-bar';
import { useBuilderBoard } from '@/features/model-builder/hooks/use-builder-board';
import { datasets } from '@/lib/constants/builder-data';
import {
  optimizerConfigs,
  type OptimizerName,
  type OptimizerParams,
} from '@/lib/constants/training-controls';

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
  const [optimizerParams, setOptimizerParams] = useState<OptimizerParams>({
    momentum: optimizerConfigs['SGD+Momentum'].parameter.defaultValue,
    weightDecay: optimizerConfigs.ADAM.parameter.defaultValue,
    rho: optimizerConfigs['RMS Prop'].parameter.defaultValue,
  });
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const selectedDataset = datasets.find((dataset) => dataset.id === selectedDatasetId) ?? datasets[0];

  return (
    <div className="min-h-screen">
      <TopBar
        learningRate={learningRate}
        optimizer={optimizer}
        optimizerParams={optimizerParams}
        selectedDatasetLabel={selectedDataset?.label ?? 'Dataset'}
        layerCount={nodes.length}
        onLearningRateChange={setLearningRate}
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
          console.log('Training started', {
            dataset: selectedDataset?.label,
            learningRate,
            optimizer,
            optimizerParams,
            layers: nodes,
          });
        }}
        onModelPreview={() => setIsPreviewOpen(true)}
        onReset={resetBoard}
      />

      <div className="grid min-h-0 gap-3 px-4 py-3 xl:grid-cols-[280px_minmax(0,1fr)_340px] xl:px-5">
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
        <Inspector />
      </div>

      {isPreviewOpen ? (
        <ModelPreviewModal
          dataset={selectedDataset}
          nodes={nodes}
          onClose={() => setIsPreviewOpen(false)}
        />
      ) : null}
    </div>
  );
}
