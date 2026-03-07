// Hook de estado para el Centro de Monitoreo con persistencia en localStorage

import { useState, useCallback, useEffect } from 'react';
import { LayoutType, CellConfig, Camera, MonitoringState } from './types';
import { getCellCount } from './cameraData';

const STORAGE_KEY = 'mats-monitoring-center';

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

function createEmptyCells(count: number): CellConfig[] {
  return Array.from({ length: count }, (_, i) => ({
    slotIndex: i,
    cameraId: null,
    isMuted: true,
  }));
}

export function useCameraStore() {
  const [layout, setLayoutState] = useState<LayoutType>('2x2');
  const [cells, setCellsState] = useState<CellConfig[]>(createEmptyCells(4));
  const [customCameras, setCustomCameras] = useState<Camera[]>([]);

  // Cargar estado al montar
  useEffect(() => {
    const saved = loadState();
    if (saved) {
      setLayoutState(saved.layout);
      setCellsState(saved.cells);
      setCustomCameras(saved.customCameras || []);
    }
  }, []);

  // Persistir cambios
  useEffect(() => {
    saveState({ layout, cells, customCameras });
  }, [layout, cells, customCameras]);

  const setLayout = useCallback((newLayout: LayoutType) => {
    const newCount = getCellCount(newLayout);
    setCellsState(prev => {
      const updated = [...prev];
      // Expandir o recortar celdas
      while (updated.length < newCount) {
        updated.push({ slotIndex: updated.length, cameraId: null, isMuted: true });
      }
      return updated.slice(0, newCount).map((c, i) => ({ ...c, slotIndex: i }));
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
    // También quitar de celdas asignadas
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
