// Image Compression Utility for COMUNIDAD EX SOS
// Compresses images before upload to minimize bandwidth and storage

export const IMAGE_LIMITS = {
  MAX_FILES: 3,
  MAX_ORIGINAL_BYTES: 15 * 1024 * 1024, // 15MB - increased for camera photos
  MAX_DIM: 1280, // Max dimension (width or height)
  TARGET_BYTES: 500 * 1024, // 500KB target
  HARD_MAX_BYTES: 1200 * 1024, // 1.2MB absolute max
  QUALITY_START: 0.80,
  QUALITY_MIN: 0.40,
  QUALITY_STEP: 0.05,
} as const;

export interface CompressResult {
  file: File;
  originalSize: number;
  compressedSize: number;
  width: number;
  height: number;
}

export interface CompressError {
  file: File;
  error: string;
}

/**
 * Check if browser supports WebP encoding
 */
function supportsWebP(): boolean {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  return canvas.toDataURL('image/webp').startsWith('data:image/webp');
}

/**
 * Load image from File
 */
async function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Calculate scaled dimensions maintaining aspect ratio
 */
function getScaledDimensions(
  width: number, 
  height: number, 
  maxDim: number
): { width: number; height: number } {
  if (width <= maxDim && height <= maxDim) {
    return { width, height };
  }

  const ratio = Math.min(maxDim / width, maxDim / height);
  return {
    width: Math.round(width * ratio),
    height: Math.round(height * ratio),
  };
}

/**
 * Compress a single image
 */
async function compressSingleImage(file: File): Promise<CompressResult> {
  const originalSize = file.size;

  // Validate original size
  if (originalSize > IMAGE_LIMITS.MAX_ORIGINAL_BYTES) {
    throw new Error(
      `Foto demasiado grande (${(originalSize / 1024 / 1024).toFixed(1)}MB). ` +
      `Máximo permitido: ${IMAGE_LIMITS.MAX_ORIGINAL_BYTES / 1024 / 1024}MB`
    );
  }

  // Load and decode image
  const img = await loadImage(file);
  const { width, height } = getScaledDimensions(
    img.naturalWidth, 
    img.naturalHeight, 
    IMAGE_LIMITS.MAX_DIM
  );

  // Create canvas
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Canvas context not available');
  }

  // Draw scaled image
  ctx.drawImage(img, 0, 0, width, height);

  // Determine output format
  const useWebP = supportsWebP();
  const mimeType = useWebP ? 'image/webp' : 'image/jpeg';
  const extension = useWebP ? 'webp' : 'jpg';

  // Compress with decreasing quality until target size met
  let quality = IMAGE_LIMITS.QUALITY_START;
  let blob: Blob | null = null;

  while (quality >= IMAGE_LIMITS.QUALITY_MIN) {
    blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, mimeType, quality);
    });

    if (!blob) {
      throw new Error('Failed to compress image');
    }

    if (blob.size <= IMAGE_LIMITS.TARGET_BYTES) {
      break;
    }

    quality -= IMAGE_LIMITS.QUALITY_STEP;
  }

  // Final validation
  if (!blob || blob.size > IMAGE_LIMITS.HARD_MAX_BYTES) {
    throw new Error(
      `Foto demasiado pesada después de comprimir. ` +
      `Intenta con una foto más pequeña o con menos detalles.`
    );
  }

  // Create new File
  const baseName = file.name.replace(/\.[^/.]+$/, '');
  const newFileName = `${baseName}_compressed.${extension}`;
  const compressedFile = new File([blob], newFileName, { type: mimeType });

  // Clean up
  URL.revokeObjectURL(img.src);

  return {
    file: compressedFile,
    originalSize,
    compressedSize: compressedFile.size,
    width,
    height,
  };
}

/**
 * Compress multiple images
 */
export async function compressImages(
  files: File[]
): Promise<{ results: CompressResult[]; errors: CompressError[] }> {
  // Validate file count
  if (files.length > IMAGE_LIMITS.MAX_FILES) {
    throw new Error(
      `Máximo ${IMAGE_LIMITS.MAX_FILES} fotos permitidas. ` +
      `Seleccionaste ${files.length}.`
    );
  }

  const results: CompressResult[] = [];
  const errors: CompressError[] = [];

  // Process images in parallel
  const promises = files.map(async (file) => {
    try {
      const result = await compressSingleImage(file);
      results.push(result);
    } catch (error) {
      errors.push({
        file,
        error: error instanceof Error ? error.message : 'Error desconocido',
      });
    }
  });

  await Promise.all(promises);

  return { results, errors };
}

/**
 * Get human-readable file size
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Validate image file type
 */
export function isValidImageType(file: File): boolean {
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic'];
  return validTypes.includes(file.type.toLowerCase());
}
