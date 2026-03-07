// Modal/drawer con la lista de cámaras disponibles para asignar a una celda

import React, { useState } from 'react';
import { Camera } from './types';
import { DEFAULT_CAMERAS } from './cameraData';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Video, Plus, Wifi, WifiOff } from 'lucide-react';

interface CameraLibraryProps {
  open: boolean;
  onClose: () => void;
  onSelectCamera: (camera: Camera) => void;
  customCameras: Camera[];
  onAddCustom: (camera: Camera) => void;
  assignedCameraIds: string[];
}

function extractYouTubeId(input: string): string {
  const trimmed = input.trim();
  // Si es un ID simple (11 chars)
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  // Extraer de URL
  const match = trimmed.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match?.[1] ?? '';
}

const CameraLibrary: React.FC<CameraLibraryProps> = ({
  open,
  onClose,
  onSelectCamera,
  customCameras,
  onAddCustom,
  assignedCameraIds,
}) => {
  const [search, setSearch] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [customName, setCustomName] = useState('');
  const [showCustomForm, setShowCustomForm] = useState(false);

  const allCameras = [...DEFAULT_CAMERAS, ...customCameras];
  const filtered = allCameras.filter(c =>
    `${c.name} ${c.city} ${c.country}`.toLowerCase().includes(search.toLowerCase())
  );

  // Agrupar por país
  const grouped = filtered.reduce<Record<string, Camera[]>>((acc, cam) => {
    (acc[cam.country] ??= []).push(cam);
    return acc;
  }, {});

  const handleAddCustom = () => {
    const ytId = extractYouTubeId(customUrl);
    if (!customName.trim()) return;
    const cam: Camera = {
      id: `custom-${Date.now()}`,
      name: customName.trim(),
      city: customName.trim(),
      country: 'Personalizada',
      youtubeId: ytId,
      isCustom: true,
    };
    onAddCustom(cam);
    onSelectCamera(cam);
    setCustomUrl('');
    setCustomName('');
    setShowCustomForm(false);
  };

  return (
    <Drawer open={open} onOpenChange={v => !v && onClose()}>
      <DrawerContent className="bg-[#0d0d0d] border-[#222] max-h-[85vh]">
        <DrawerHeader className="border-b border-[#222]">
          <DrawerTitle className="font-mono text-[#00ff88] uppercase tracking-wider text-sm">
            Biblioteca de Cámaras
          </DrawerTitle>
          <DrawerDescription className="font-mono text-[10px] text-[#666]">
            Selecciona una cámara para asignarla
          </DrawerDescription>
        </DrawerHeader>

        <div className="p-3 space-y-3 overflow-y-auto flex-1">
          {/* Búsqueda */}
          <Input
            placeholder="Buscar ciudad..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-[#111] border-[#333] font-mono text-xs text-white placeholder:text-[#555]"
          />

          {/* Lista agrupada */}
          {Object.entries(grouped).map(([country, cameras]) => (
            <div key={country}>
              <h3 className="font-mono text-[10px] text-[#00ff88] uppercase tracking-widest mb-1 px-1">
                {country}
              </h3>
              <div className="space-y-0.5">
                {cameras.map(cam => {
                  const assigned = assignedCameraIds.includes(cam.id);
                  return (
                    <button
                      key={cam.id}
                      onClick={() => { onSelectCamera(cam); onClose(); }}
                      disabled={assigned}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 text-left transition-colors ${
                        assigned
                          ? 'opacity-40 cursor-not-allowed'
                          : 'hover:bg-[#1a1a1a]'
                      }`}
                    >
                      {cam.youtubeId ? (
                        <Wifi className="w-3 h-3 text-[#00ff88] shrink-0" />
                      ) : (
                        <WifiOff className="w-3 h-3 text-[#555] shrink-0" />
                      )}
                      <span className="font-mono text-xs text-[#ccc] truncate">{cam.name}</span>
                      <span className="font-mono text-[9px] text-[#555] ml-auto shrink-0">
                        {cam.city}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Agregar cámara personalizada */}
          {!showCustomForm ? (
            <Button
              variant="ghost"
              onClick={() => setShowCustomForm(true)}
              className="w-full font-mono text-xs text-[#00ff88] hover:bg-[#1a1a1a] hover:text-[#00ff88] gap-1"
            >
              <Plus className="w-3 h-3" /> Agregar cámara personalizada
            </Button>
          ) : (
            <div className="space-y-2 p-2 border border-[#333] bg-[#111]">
              <Input
                placeholder="Nombre de la cámara"
                value={customName}
                onChange={e => setCustomName(e.target.value)}
                className="bg-[#0a0a0a] border-[#333] font-mono text-xs text-white placeholder:text-[#555]"
              />
              <Input
                placeholder="YouTube URL o Video ID"
                value={customUrl}
                onChange={e => setCustomUrl(e.target.value)}
                className="bg-[#0a0a0a] border-[#333] font-mono text-xs text-white placeholder:text-[#555]"
              />
              <div className="flex gap-2">
                <Button
                  onClick={handleAddCustom}
                  disabled={!customName.trim()}
                  className="flex-1 font-mono text-xs bg-[#00ff88] text-black hover:bg-[#00cc6a] h-8"
                >
                  Agregar
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setShowCustomForm(false)}
                  className="font-mono text-xs text-[#888] hover:text-white h-8"
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default CameraLibrary;
