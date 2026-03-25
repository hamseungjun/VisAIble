'use client';

import { useState } from 'react';
import { libraryBlocks } from '@/lib/constants/builder-data';
import type { BlockType, CanvasNode } from '@/types/builder';

function makeNode(type: BlockType, count: number): CanvasNode {
  const block = libraryBlocks.find((item) => item.id === type);

  if (!block) {
    throw new Error(`Unknown block type: ${type}`);
  }

  return {
    id: `${type}-${count}`,
    type: block.id,
    title: block.title,
    accent: block.accent,
    fields: block.defaults.fields.map((field) => ({ ...field })),
    activation: block.defaults.activation,
    activationOptions: block.defaults.activationOptions,
  };
}

export function useBuilderBoard() {
  const [nodes, setNodes] = useState<CanvasNode[]>([]);
  const [draggingBlock, setDraggingBlock] = useState<BlockType | null>(null);

  const addNode = (type: BlockType, index?: number) => {
    setNodes((current) => {
      const nextNode = makeNode(type, current.length + 1);
      const insertAt = index === undefined ? current.length : Math.max(0, Math.min(index, current.length));
      const next = [...current];
      next.splice(insertAt, 0, nextNode);
      return next;
    });
  };

  const removeNode = (id: string) => {
    setNodes((current) => current.filter((node) => node.id !== id));
  };

  const updateNodeField = (id: string, fieldLabel: string, value: string) => {
    setNodes((current) =>
      current.map((node) =>
        node.id !== id
          ? node
          : {
              ...node,
              fields: node.fields.map((field) =>
                field.label === fieldLabel ? { ...field, value } : field,
              ),
            },
      ),
    );
  };

  const updateNodeActivation = (id: string, activation: string) => {
    setNodes((current) =>
      current.map((node) => (node.id === id ? { ...node, activation } : node)),
    );
  };

  const moveNode = (id: string, index: number) => {
    setNodes((current) => {
      const fromIndex = current.findIndex((node) => node.id === id);
      if (fromIndex === -1) {
        return current;
      }

      const clampedIndex = Math.max(0, Math.min(index, current.length));
      const adjustedIndex = fromIndex < clampedIndex ? clampedIndex - 1 : clampedIndex;
      if (fromIndex === adjustedIndex) {
        return current;
      }

      const next = [...current];
      const [movedNode] = next.splice(fromIndex, 1);
      next.splice(adjustedIndex, 0, movedNode);
      return next;
    });
  };

  const resetBoard = () => {
    setNodes([]);
    setDraggingBlock(null);
  };

  return {
    nodes,
    draggingBlock,
    setDraggingBlock,
    addNode,
    removeNode,
    updateNodeField,
    updateNodeActivation,
    moveNode,
    resetBoard,
  };
}
