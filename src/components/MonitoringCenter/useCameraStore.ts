import { useState, useCallback } from 'react';
import { CellConfig } from './types';
import { DEFAULT_INITIAL_CAMERA_IDS } from './cameraData';

export function createDefaultCells(): CellConfig[] {
  return DEFAULT_INITIAL_CAMERA_IDS.map((cameraId, slotIndex) => ({
    slotIndex, cameraId, isMuted: true,
  }));
}

export function toggleCellAudio(cells: CellConfig[], slotIndex: number): CellConfig[] {
  return cells.map(cell => cell.slotIndex === slotIndex
    ? { ...cell, isMuted: !cell.isMuted } : cell);
}

export function useCameraStore() {
  // Fixed streams intentionally ignore legacy layouts, custom cameras and saved audio.
  const [cells, setCells] = useState(createDefaultCells);
  const toggleMute = useCallback((slotIndex: number) => {
    setCells(previous => toggleCellAudio(previous, slotIndex));
  }, []);
  return { cells, toggleMute };
}
