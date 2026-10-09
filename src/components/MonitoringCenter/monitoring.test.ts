import { describe, it, expect } from 'vitest';
import { DEFAULT_CAMERAS, DEFAULT_INITIAL_CAMERA_IDS } from './cameraData';
import { createDefaultCells, toggleCellAudio } from './useCameraStore';

describe('Fixed monitoring streams', () => {
  it('offers only the four requested streams in their default order', () => {
    expect(DEFAULT_CAMERAS.map(camera => camera.id)).toEqual([
      'yt-nplus-live', 'yt-cnn-es-live', 'yt-euronews-es', 'yt-earthquake-monitor',
    ]);
    expect(DEFAULT_INITIAL_CAMERA_IDS).toEqual(DEFAULT_CAMERAS.map(camera => camera.id));
    expect(createDefaultCells().map(cell => cell.cameraId)).toEqual(DEFAULT_INITIAL_CAMERA_IDS);
  });

  it('starts all four streams muted', () => {
    expect(createDefaultCells().map(cell => cell.isMuted)).toEqual([true, true, true, true]);
    for (const camera of DEFAULT_CAMERAS) {
      expect(new URL(camera.embedUrl).searchParams.get('mute')).toBe('1');
    }
  });

  it('toggles only the requested stream audio without changing assignments', () => {
    const initial = createDefaultCells();
    const toggled = toggleCellAudio(initial, 1);
    expect(toggled.map(cell => cell.isMuted)).toEqual([true, false, true, true]);
    expect(toggled.map(cell => cell.cameraId)).toEqual(DEFAULT_INITIAL_CAMERA_IDS);
    expect(toggleCellAudio(toggled, 1)).toEqual(initial);
  });
});