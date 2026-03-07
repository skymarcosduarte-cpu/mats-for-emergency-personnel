// Centro de Monitoreo — pantalla principal — v2

import React, { useState, useEffect } from 'react';
import { BackToHomeButton } from '@/components/BackToHomeButton';
import { useCameraStore } from './useCameraStore';
import { DEFAULT_CAMERAS, LAYOUT_OPTIONS } from './cameraData';
import { Camera, LayoutType } from './types';
import GridLayout from './GridLayout';
import CameraLibrary from './CameraLibrary';
import FullscreenModal from './FullscreenModal';
import { AlertTriangle } from 'lucide-react';

interface MonitoringCenterProps {
  onBack: () => void;
}

const MonitoringCenter: React.FC<MonitoringCenterProps> = ({ onBack }) => {
  const store = useCameraStore();
  const [clock, setClock] = useState(new Date());
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [pendingSlot, setPendingSlot] = useState<number | null>(null);
  const [expandedSlot, setExpandedSlot] = useState<number | null>(null);
  const [show3x3Warning, setShow3x3Warning] = useState(false);

  // Reloj en tiempo real
  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const allCameras: Camera[] = [...DEFAULT_CAMERAS, ...store.customCameras];
  const assignedIds = store.cells.map(c => c.cameraId).filter(Boolean) as string[];
  const activeCells = store.cells.filter(c => c.cameraId).length;

  // Abrir biblioteca para asignar a un slot
  const handleAddToSlot = (slot: number) => {
    setPendingSlot(slot);
    setLibraryOpen(true);
  };

  const handleSelectCamera = (camera: Camera) => {
    if (pendingSlot !== null) {
      store.assignCamera(pendingSlot, camera.id);
      setPendingSlot(null);
    }
  };

  const handleLayoutChange = (lt: LayoutType) => {
    if (lt === '3x3') {
      setShow3x3Warning(true);
      setTimeout(() => setShow3x3Warning(false), 4000);
    }
    store.setLayout(lt);
  };

  // Datos de celda expandida
  const expandedCell = expandedSlot !== null ? store.cells.find(c => c.slotIndex === expandedSlot) : null;
  const expandedCamera = expandedCell?.cameraId
    ? allCameras.find(c => c.id === expandedCell.cameraId) ?? null
    : null;

  const timeStr = clock.toLocaleTimeString('es-MX', { hour12: false });
  const dateStr = clock.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] text-white select-none">
      {/* Barra superior */}
      <div className="flex items-center gap-2 px-2 py-1.5 bg-[#0d0d0d] border-b border-[#222] shrink-0">
        <BackToHomeButton onClick={onBack} />

        <div className="flex items-center gap-1.5 mr-auto">
          <span className="w-2 h-2 rounded-full bg-[#00ff88] animate-pulse" />
          <h1 className="font-mono text-xs sm:text-sm font-bold text-[#00ff88] uppercase tracking-widest">
            Centro de Monitoreo
          </h1>
        </div>

        {/* Indicador cámaras activas */}
        <span className="font-mono text-[9px] text-[#666] hidden sm:block">
          {activeCells}/{store.cells.length} activas
        </span>

        {/* Selector de layout */}
        <div className="flex items-center gap-0.5 bg-[#111] border border-[#333] px-1 py-0.5">
          {LAYOUT_OPTIONS.map(opt => (
            <button
              key={opt.type}
              onClick={() => handleLayoutChange(opt.type)}
              className={`font-mono text-[10px] px-1.5 py-0.5 transition-colors ${
                store.layout === opt.type
                  ? 'bg-[#00ff88] text-black font-bold'
                  : 'text-[#888] hover:text-[#00ff88]'
              }`}
              title={opt.label}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Timestamp */}
        <div className="hidden sm:flex flex-col items-end font-mono text-[9px] text-[#666] leading-tight">
          <span>{timeStr}</span>
          <span>{dateStr}</span>
        </div>
      </div>

      {/* Advertencia 3x3 */}
      {show3x3Warning && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#332200] border-b border-[#553300] shrink-0">
          <AlertTriangle className="w-3.5 h-3.5 text-yellow-500 shrink-0" />
          <span className="font-mono text-[10px] text-yellow-400">
            El layout 3×3 puede afectar el rendimiento en dispositivos de gama baja
          </span>
        </div>
      )}

      {/* Cuadrícula */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <GridLayout
          layout={store.layout}
          cells={store.cells}
          allCameras={allCameras}
          onToggleMute={store.toggleMute}
          onExpand={setExpandedSlot}
          onAddToSlot={handleAddToSlot}
          onRemoveFromSlot={store.removeCamera}
        />
      </div>

      {/* Biblioteca de cámaras */}
      <CameraLibrary
        open={libraryOpen}
        onClose={() => { setLibraryOpen(false); setPendingSlot(null); }}
        onSelectCamera={handleSelectCamera}
        customCameras={store.customCameras}
        onAddCustom={store.addCustomCamera}
        assignedCameraIds={assignedIds}
      />

      {/* Modal fullscreen */}
      <FullscreenModal
        camera={expandedCamera}
        open={expandedSlot !== null}
        isMuted={expandedCell?.isMuted ?? true}
        onClose={() => setExpandedSlot(null)}
        onToggleMute={() => expandedSlot !== null && store.toggleMute(expandedSlot)}
      />
    </div>
  );
};

export default MonitoringCenter;
