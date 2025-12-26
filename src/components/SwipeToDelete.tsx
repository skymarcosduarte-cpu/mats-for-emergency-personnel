import React, { useState, useRef, useCallback } from 'react';
import { Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SwipeToDeleteProps {
  children: React.ReactNode;
  onDelete: () => void;
  disabled?: boolean;
  className?: string;
}

const SWIPE_THRESHOLD = 80;
const DELETE_TRIGGER_THRESHOLD = 120;

export const SwipeToDelete: React.FC<SwipeToDeleteProps> = ({
  children,
  onDelete,
  disabled = false,
  className,
}) => {
  const [translateX, setTranslateX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const currentXRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled) return;
    startXRef.current = e.touches[0].clientX;
    currentXRef.current = e.touches[0].clientX;
    setIsDragging(true);
  }, [disabled]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging || disabled) return;
    
    currentXRef.current = e.touches[0].clientX;
    const diff = startXRef.current - currentXRef.current;
    
    // Only allow swiping left (positive diff)
    if (diff > 0) {
      // Add resistance after threshold
      const resistance = diff > SWIPE_THRESHOLD ? 0.3 : 1;
      const dampedDiff = diff > SWIPE_THRESHOLD 
        ? SWIPE_THRESHOLD + (diff - SWIPE_THRESHOLD) * resistance
        : diff;
      
      setTranslateX(-Math.min(dampedDiff, DELETE_TRIGGER_THRESHOLD + 20));
    } else {
      setTranslateX(0);
    }
  }, [isDragging, disabled]);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging || disabled) return;
    
    const diff = startXRef.current - currentXRef.current;
    
    if (diff >= DELETE_TRIGGER_THRESHOLD) {
      // Trigger delete
      setTranslateX(-DELETE_TRIGGER_THRESHOLD);
      setTimeout(() => {
        onDelete();
        setTranslateX(0);
      }, 150);
    } else if (diff >= SWIPE_THRESHOLD) {
      // Show delete button
      setTranslateX(-SWIPE_THRESHOLD);
    } else {
      // Reset
      setTranslateX(0);
    }
    
    setIsDragging(false);
  }, [isDragging, disabled, onDelete]);

  const handleDeleteClick = useCallback(() => {
    if (disabled) return;
    onDelete();
    setTranslateX(0);
  }, [disabled, onDelete]);

  const resetSwipe = useCallback(() => {
    setTranslateX(0);
  }, []);

  // Calculate delete button opacity based on swipe distance
  const deleteOpacity = Math.min(Math.abs(translateX) / SWIPE_THRESHOLD, 1);
  const isDeleteVisible = Math.abs(translateX) > 20;

  return (
    <div 
      ref={containerRef}
      className={cn("relative overflow-hidden rounded-lg", className)}
    >
      {/* Delete background */}
      <div 
        className={cn(
          "absolute inset-y-0 right-0 flex items-center justify-end bg-destructive transition-opacity",
          isDeleteVisible ? "opacity-100" : "opacity-0"
        )}
        style={{ 
          width: Math.abs(translateX) + 20,
          opacity: deleteOpacity,
        }}
      >
        <button
          onClick={handleDeleteClick}
          className="flex items-center justify-center w-20 h-full text-destructive-foreground"
          aria-label="Eliminar"
        >
          <Trash2 className="w-6 h-6" />
        </button>
      </div>

      {/* Swipeable content */}
      <div
        className={cn(
          "relative bg-card",
          isDragging ? "" : "transition-transform duration-200 ease-out"
        )}
        style={{ transform: `translateX(${translateX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={translateX !== 0 ? resetSwipe : undefined}
      >
        {children}
      </div>
    </div>
  );
};

export default SwipeToDelete;
