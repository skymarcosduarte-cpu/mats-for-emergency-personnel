// Cuadrícula de celdas de video con layouts configurables

import React from 'react';
import { LayoutType, CellConfig, Camera } from './types';
import VideoCell from './VideoCell';

interface GridLayoutProps {
  layout: LayoutType;
  cells: CellConfig[];
  allCameras: Camera[];
  onToggleMute: (slot: number) => void;
  onExpand: (slot: number) => void;
  onAddToSlot: (slot: number) => void;
  onRemoveFromSlot: (slot: number) => void;
}

function getGridClass(layout: LayoutType): string {
  switch (layout) {
    case '1x1': return 'grid-cols-1 grid-rows-1';
    case '2x1': return 'grid-cols-2 grid-rows-1';
    case '2x2': return 'grid-cols-2 grid-rows-2';
    case '1+2': return 'grid-cols-2 grid-rows-2';
    case '1+4': return 'grid-cols-3 grid-rows-2';
    case '3x3': return 'grid-cols-3 grid-rows-3';
    default: return 'grid-cols-2 grid-rows-2';
  }
}

function getCellStyle(layout: LayoutType, index: number): React.CSSProperties | undefined {
  if (layout === '1+2' && index === 0) {
    return { gridRow: '1 / 3' }; // celda grande ocupa 2 filas
  }
  if (layout === '1+4' && index === 0) {
    return { gridRow: '1 / 3', gridColumn: '1 / 3' }; // celda grande 2x2
  }
  return undefined;
}

const GridLayout: React.FC<GridLayoutProps> = ({
  layout,
  cells,
  allCameras,
  onToggleMute,
  onExpand,
  onAddToSlot,
  onRemoveFromSlot,
}) => {
  const findCamera = (cameraId: string | null) =>
    cameraId ? allCameras.find(c => c.id === cameraId) ?? null : null;

  return (
    <div className={`grid ${getGridClass(layout)} gap-[1px] bg-[#111] flex-1 w-full h-full`}>
      {cells.map((cell, idx) => (
        <div key={cell.slotIndex} style={getCellStyle(layout, idx)} className="min-h-0">
          <VideoCell
            camera={findCamera(cell.cameraId)}
            isMuted={cell.isMuted}
            onToggleMute={() => onToggleMute(cell.slotIndex)}
            onExpand={() => onExpand(cell.slotIndex)}
            onAdd={() => onAddToSlot(cell.slotIndex)}
            onRemove={() => onRemoveFromSlot(cell.slotIndex)}
          />
        </div>
      ))}
    </div>
  );
};

export default GridLayout;
