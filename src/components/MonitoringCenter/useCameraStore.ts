// Hook de estado para el Centro de Monitoreo con persistencia en localStorage — v2

import { useState, useCallback, useEffect } from 'react';
import { LayoutType, CellConfig, Camera, MonitoringState } from './types';
import { getCellCount, DEFAULT_INITIAL_CAMERA_IDS } from './cameraData';

const STORAGE_KEY = 'mats-monitoring-center-v7';

function loadState(): MonitoringState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveState(state: MonitoringState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* silently fail */ }
}

function createDefaultCells(): CellConfig[] {
  return DEFAULT_INITIAL_CAMERA_IDS.map((cameraId, i) => ({
    slotIndex: i,
    cameraId,
    isMuted: true,
  }));
}

function createEmptyCells(count: number): CellConfig[] {
  return Array.from({ length: count }, (_, i) => ({
    slotIndex: i,
    cameraId: null,
    isMuted: true,
  }));
}

export function useCameraStore() {
  const [layout, setLayoutState] = useState<LayoutType>(() => {
    const saved = loadState();
    return saved?.layout ?? '2x2';
  });
  const [cells, setCellsState] = useState<CellConfig[]>(() => {
    const saved = loadState();
    return saved?.cells ?? createDefaultCells();
  });
  const [customCameras, setCustomCameras] = useState<Camera[]>(() => {
    const saved = loadState();
    return saved?.customCameras ?? [];
  });

  // Persistir cambios
  useEffect(() => {
    saveState({ layout, cells, customCameras });
  }, [layout, cells, customCameras]);

  // Keep a full registry of all cell assignments so expanding restores them
  const [allCells, setAllCells] = useState<CellConfig[]>(() => {
    const saved = loadState();
    return saved?.allCells ?? saved?.cells ?? createDefaultCells();
  });

  // Persist allCells too
  useEffect(() => {
    saveState({ layout, cells, customCameras, allCells });
  }, [layout, cells, customCameras, allCells]);

  const setLayout = useCallback((newLayout: LayoutType) => {
    const newCount = getCellCount(newLayout);
    setAllCells(prevAll => {
      // Merge current visible cells into the full registry
      const merged = [...prevAll];
      // Expand registry if needed
      while (merged.length < newCount) {
        merged.push({ slotIndex: merged.length, cameraId: null, isMuted: true });
      }
      // Slice visible cells from the full registry
      const visible = merged.slice(0, newCount).map((c, i) => ({ ...c, slotIndex: i }));
      setCellsState(visible);
      return merged.map((c, i) => ({ ...c, slotIndex: i }));
    });
    setLayoutState(newLayout);
  }, []);

  const assignCamera = useCallback((slotIndex: number, cameraId: string) => {
    setCellsState(prev => prev.map(c =>
      c.slotIndex === slotIndex ? { ...c, cameraId } : c
    ));
  }, []);

  const removeCamera = useCallback((slotIndex: number) => {
    setCellsState(prev => prev.map(c =>
      c.slotIndex === slotIndex ? { ...c, cameraId: null } : c
    ));
  }, []);

  const toggleMute = useCallback((slotIndex: number) => {
    setCellsState(prev => prev.map(c =>
      c.slotIndex === slotIndex ? { ...c, isMuted: !c.isMuted } : c
    ));
  }, []);

  const addCustomCamera = useCallback((camera: Camera) => {
    setCustomCameras(prev => [...prev, camera]);
  }, []);

  const removeCustomCamera = useCallback((cameraId: string) => {
    setCustomCameras(prev => prev.filter(c => c.id !== cameraId));
    setCellsState(prev => prev.map(c =>
      c.cameraId === cameraId ? { ...c, cameraId: null } : c
    ));
  }, []);

  return {
    layout,
    cells,
    customCameras,
    setLayout,
    assignCamera,
    removeCamera,
    toggleMute,
    addCustomCamera,
    removeCustomCamera,
  };
}
