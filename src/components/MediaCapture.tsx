// Media Capture Component for COMUNIDAD EX SOS
// Image capture with compression

import React, { useState, useRef, useCallback } from 'react';
import { Camera, X, Plus, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  compressImages, 
  IMAGE_LIMITS, 
  formatFileSize,
  isValidImageType,
  type CompressResult 
} from '@/lib/imageCompress';
import { cn } from '@/lib/utils';

interface MediaCaptureProps {
  onImagesSelected: (files: File[]) => void;
  maxImages?: number;
  className?: string;
}

export const MediaCapture: React.FC<MediaCaptureProps> = ({
  onImagesSelected,
  maxImages = IMAGE_LIMITS.MAX_FILES,
  className,
}) => {
  const [images, setImages] = useState<CompressResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const files = Array.from(input.files || []);
    if (files.length === 0) return;

    // Validate file types
    const invalidFiles = files.filter((f) => !isValidImageType(f));
    if (invalidFiles.length > 0) {
      setError('Solo se permiten imágenes (JPG, PNG, WebP)');
      // Reset input so same file can be selected again
      input.value = '';
      return;
    }

    // Check total count
    const totalCount = images.length + files.length;
    if (totalCount > maxImages) {
      setError(`Máximo ${maxImages} fotos permitidas`);
      input.value = '';
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { results, errors } = await compressImages(files);

      if (errors.length > 0) {
        setError(errors.map((e) => e.error).join('. '));
      }

      if (results.length > 0) {
        const newImages = [...images, ...results];
        setImages(newImages);
        onImagesSelected(newImages.map((r) => r.file));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al procesar imágenes');
    } finally {
      setLoading(false);
      // Reset input so the same file can be selected again (iOS behavior)
      input.value = '';
    }
  }, [images, maxImages, onImagesSelected]);

  const removeImage = useCallback((index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    setImages(newImages);
    onImagesSelected(newImages.map(r => r.file));
  }, [images, onImagesSelected]);

  const openFilePicker = useCallback((source: 'camera' | 'gallery') => {
    if (source === 'camera') cameraInputRef.current?.click();
    else galleryInputRef.current?.click();
  }, []);

  const canAddMore = images.length < maxImages;

  return (
    <div className={cn('space-y-3', className)}>
      {/* Hidden file inputs (iOS: `capture` forces camera, so we separate camera vs gallery) */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        multiple
        capture="environment"
        className="hidden"
        onChange={handleFileSelect}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Error message */}
      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Image grid */}
      <div className="grid grid-cols-3 gap-2">
        {images.map((img, index) => (
          <div key={index} className="relative aspect-square">
            <img
              src={URL.createObjectURL(img.file)}
              alt={`Foto ${index + 1}`}
              className="w-full h-full object-cover rounded-lg"
            />
            <button
              onClick={() => removeImage(index)}
              className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center shadow-lg touch-target"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="absolute bottom-1 left-1 right-1 bg-background/80 backdrop-blur-sm rounded px-1 py-0.5 text-[10px] text-foreground truncate">
              {formatFileSize(img.compressedSize)}
            </div>
          </div>
        ))}

        {/* Add button */}
        {canAddMore && (
          <button
            onClick={() => openFilePicker('gallery')}
            disabled={loading}
            className={cn(
              'aspect-square border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-1 transition-colors touch-target',
              loading 
                ? 'opacity-50 cursor-not-allowed' 
                : 'hover:border-primary hover:bg-primary/5'
            )}
          >
            {loading ? (
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Plus className="w-6 h-6 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground">
                  {images.length === 0 ? 'Agregar' : `${images.length}/${maxImages}`}
                </span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Quick capture buttons */}
      {images.length === 0 && (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => openFilePicker('camera')}
            disabled={loading}
            className="flex-1"
          >
            <Camera className="w-4 h-4 mr-2" />
            Tomar foto
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => openFilePicker('gallery')}
            disabled={loading}
            className="flex-1"
          >
            <ImageIcon className="w-4 h-4 mr-2" />
            Galería
          </Button>
        </div>
      )}

      {/* Info text */}
      <p className="text-xs text-muted-foreground text-center">
        Máximo {maxImages} fotos • Las imágenes se comprimen automáticamente
      </p>
    </div>
  );
};

export default MediaCapture;
