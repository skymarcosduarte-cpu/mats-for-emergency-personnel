// Mapa de indicios por sectores (A1–C3…) del Detector de Señales.
// Se colorea según la concentración de indicios registrada mientras el
// rescatista camina con el GPS activo, y resalta el vector de interés.

import React from 'react';
import { Crosshair } from 'lucide-react';
import { SectorGrid, SECTOR_SIZE_M, type SectorSnapshot } from '@/lib/mesh/signalSectors';
import { cn } from '@/lib/utils';

interface Props {
  snapshot: SectorSnapshot;
}

function heatClass(ratio: number): string {
  if (ratio >= 0.8) return 'bg-destructive text-destructive-foreground';
  if (ratio >= 0.55) return 'bg-orange-500 text-white';
  if (ratio >= 0.3) return 'bg-yellow-400 text-black';
  if (ratio > 0) return 'bg-emerald-500 text-white';
  return 'bg-muted text-muted-foreground';
}

export const SignalSectorMap: React.FC<Props> = ({ snapshot }) => {
  const { cells, rows, cols, hot } = snapshot;
  if (cells.length === 0) return null;

  const maxScore = Math.max(...cells.map((c) => SectorGrid.score(c)));
  const byKey = new Map(cells.map((c) => [`${c.row}:${c.col}`, c]));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground">
          MAPA DE INDICIOS · sectores de {SECTOR_SIZE_M} m
        </p>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <span className="w-3 h-3 rounded-sm bg-emerald-500" /> baja
          <span className="w-3 h-3 rounded-sm bg-yellow-400 ml-1" /> media
          <span className="w-3 h-3 rounded-sm bg-destructive ml-1" /> alta
        </div>
      </div>

      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${Math.max(cols.length, 1)}, minmax(0, 1fr))` }}
      >
        {rows.map((row) =>
          cols.map((col) => {
            const cell = byKey.get(`${row}:${col}`);
            const ratio = cell && maxScore > 0 ? SectorGrid.score(cell) / maxScore : 0;
            const isHot = Boolean(cell && hot && cell.row === hot.row && cell.col === hot.col);
            return (
              <div
                key={`${row}:${col}`}
                className={cn(
                  'aspect-square rounded-md flex flex-col items-center justify-center text-xs font-bold',
                  heatClass(ratio),
                  isHot && 'ring-4 ring-primary ring-offset-1 ring-offset-background',
                )}
              >
                <span>{cell ? cell.label : ''}</span>
                {cell && (
                  <span className="text-[10px] font-semibold opacity-90">
                    {cell.devices.size} disp.
                  </span>
                )}
              </div>
            );
          }),
        )}
      </div>

      {hot && (
        <div className="flex gap-2 items-start p-3 rounded-lg border-2 border-primary bg-primary/5">
          <Crosshair className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-foreground">
              Vector de interés: sector {hot.label}
            </p>
            <p className="text-xs text-muted-foreground">
              {hot.devices.size} dispositivo{hot.devices.size === 1 ? '' : 's'} detectado
              {hot.devices.size === 1 ? '' : 's'} · {hot.sustained.size} con presencia sostenida ·
              mejor intensidad {hot.bestRssi} dBm
            </p>
            <p className="text-xs text-muted-foreground">
              Estimación: {hot.devices.size} dispositivo{hot.devices.size === 1 ? '' : 's'} ={' '}
              {hot.devices.size} posible{hot.devices.size === 1 ? '' : 's'} persona
              {hot.devices.size === 1 ? '' : 's'}.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
