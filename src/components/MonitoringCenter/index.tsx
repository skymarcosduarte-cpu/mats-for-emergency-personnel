import React from 'react';
import { BackToHomeButton } from '@/components/BackToHomeButton';
import { useCameraStore } from './useCameraStore';
import { DEFAULT_CAMERAS } from './cameraData';
import VideoCell from './VideoCell';

interface MonitoringCenterProps {
  onBack: () => void;
}

const MonitoringCenter: React.FC<MonitoringCenterProps> = ({ onBack }) => {
  const { cells, toggleMute } = useCameraStore();
  return (
    <div className="flex h-full min-h-0 flex-col bg-background text-foreground">
      <header className="flex shrink-0 items-center gap-3 border-b border-border px-3 py-2">
        <BackToHomeButton onClick={onBack} />
        <h1 className="text-lg font-bold">Monitoreo de Noticias</h1>
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-2 gap-2 p-2">
        {cells.map(cell => (
          <VideoCell
            key={cell.cameraId}
            camera={DEFAULT_CAMERAS.find(camera => camera.id === cell.cameraId) ?? null}
            isMuted={cell.isMuted}
            onToggleMute={() => toggleMute(cell.slotIndex)}
          />
        ))}
      </div>
    </div>
  );
};

export default MonitoringCenter;
