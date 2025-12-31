import React, { useState, useRef } from 'react';
import { X, ZoomIn, ZoomOut } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface ImageZoomViewerProps {
  src: string;
  alt: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const getDistance = (touch1: React.Touch, touch2: React.Touch) => {
  const dx = touch1.clientX - touch2.clientX;
  const dy = touch1.clientY - touch2.clientY;
  return Math.sqrt(dx * dx + dy * dy);
};

export const ImageZoomViewer: React.FC<ImageZoomViewerProps> = ({
  src,
  alt,
  open,
  onOpenChange,
}) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isPinching, setIsPinching] = useState(false);
  const lastPosition = useRef({ x: 0, y: 0 });
  const startDrag = useRef({ x: 0, y: 0 });
  const initialPinchDistance = useRef(0);
  const initialPinchScale = useRef(1);

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.5, 4));
  };

  const handleZoomOut = () => {
    setScale(prev => {
      const newScale = Math.max(prev - 0.5, 1);
      if (newScale === 1) {
        setPosition({ x: 0, y: 0 });
      }
      return newScale;
    });
  };

  const handleDoubleClick = () => {
    if (scale > 1) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    } else {
      setScale(2);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Pinch gesture start
      setIsPinching(true);
      setIsDragging(false);
      initialPinchDistance.current = getDistance(e.touches[0], e.touches[1]);
      initialPinchScale.current = scale;
    } else if (e.touches.length === 1 && scale > 1 && !isPinching) {
      // Single finger drag (only when zoomed)
      setIsDragging(true);
      startDrag.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      lastPosition.current = { ...position };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && isPinching) {
      // Pinch gesture move
      const currentDistance = getDistance(e.touches[0], e.touches[1]);
      const scaleChange = currentDistance / initialPinchDistance.current;
      const newScale = Math.min(Math.max(initialPinchScale.current * scaleChange, 1), 4);
      
      setScale(newScale);
      
      // Reset position if zooming back to 1
      if (newScale === 1) {
        setPosition({ x: 0, y: 0 });
      }
    } else if (isDragging && scale > 1 && e.touches.length === 1) {
      // Single finger drag
      const deltaX = e.touches[0].clientX - startDrag.current.x;
      const deltaY = e.touches[0].clientY - startDrag.current.y;
      
      setPosition({
        x: lastPosition.current.x + deltaX,
        y: lastPosition.current.y + deltaY,
      });
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    setIsPinching(false);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true);
      startDrag.current = { x: e.clientX, y: e.clientY };
      lastPosition.current = { ...position };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && scale > 1) {
      const deltaX = e.clientX - startDrag.current.x;
      const deltaY = e.clientY - startDrag.current.y;
      
      setPosition({
        x: lastPosition.current.x + deltaX,
        y: lastPosition.current.y + deltaY,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleClose = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[100vw] max-h-[100vh] w-screen h-screen p-0 bg-black/95 border-none">
        {/* Controls */}
        <div className="absolute top-4 right-4 z-50 flex gap-2">
          <Button
            variant="secondary"
            size="icon"
            onClick={handleZoomOut}
            disabled={scale <= 1}
            className="bg-background/80 backdrop-blur-sm"
          >
            <ZoomOut className="w-5 h-5" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            onClick={handleZoomIn}
            disabled={scale >= 4}
            className="bg-background/80 backdrop-blur-sm"
          >
            <ZoomIn className="w-5 h-5" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            onClick={handleClose}
            className="bg-background/80 backdrop-blur-sm"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Zoom indicator */}
        {scale > 1 && (
          <div className="absolute top-4 left-4 z-50 bg-background/80 backdrop-blur-sm px-3 py-1.5 rounded-full text-sm font-medium">
            {Math.round(scale * 100)}%
          </div>
        )}

        {/* Image container */}
        <div
          className="w-full h-full flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onDoubleClick={handleDoubleClick}
        >
          <img
            src={src}
            alt={alt}
            className="max-w-full max-h-full object-contain select-none transition-transform duration-100"
            style={{
              transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
            }}
            draggable={false}
          />
        </div>

        {/* Hint */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-center text-sm text-muted-foreground bg-background/60 backdrop-blur-sm px-4 py-2 rounded-full">
          Pellizca para zoom • Doble tap para {scale > 1 ? 'restablecer' : 'ampliar'} • Arrastra para mover
        </div>
      </DialogContent>
    </Dialog>
  );
};
