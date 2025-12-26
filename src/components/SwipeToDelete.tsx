import React, { useCallback, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SwipeToDeleteProps {
  children: React.ReactNode;
  onDelete: () => void;
  disabled?: boolean;
  className?: string;
}

const SWIPE_THRESHOLD = 80;
const DELETE_TRIGGER_THRESHOLD = 120;
const ACTIVATE_SWIPE_PX = 10;

export const SwipeToDelete: React.FC<SwipeToDeleteProps> = ({
  children,
  onDelete,
  disabled = false,
  className,
}) => {
  const [translateX, setTranslateX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const currentXRef = useRef(0);
  const currentYRef = useRef(0);
  const isSwipingRef = useRef(false);

  const beginDrag = useCallback(
    (clientX: number, clientY: number) => {
      if (disabled) return;
      startXRef.current = clientX;
      startYRef.current = clientY;
      currentXRef.current = clientX;
      currentYRef.current = clientY;
      isSwipingRef.current = false;
      setIsDragging(true);
    },
    [disabled]
  );

  const moveDrag = useCallback(
    (clientX: number, clientY: number, preventDefault?: () => void) => {
      if (!isDragging || disabled) return;

      currentXRef.current = clientX;
      currentYRef.current = clientY;

      const dx = startXRef.current - currentXRef.current; // + when swiping left
      const dy = startYRef.current - currentYRef.current;

      // Decide whether this interaction is a horizontal swipe or a vertical scroll.
      if (!isSwipingRef.current) {
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);

        if (absDy >= ACTIVATE_SWIPE_PX && absDy > absDx) {
          // User is scrolling; don't hijack the gesture.
          setIsDragging(false);
          setTranslateX(0);
          return;
        }

        if (absDx >= ACTIVATE_SWIPE_PX && absDx > absDy) {
          isSwipingRef.current = true;
        }
      }

      if (!isSwipingRef.current) return;
      preventDefault?.();

      // Only allow swiping left
      if (dx > 0) {
        const resistance = dx > SWIPE_THRESHOLD ? 0.3 : 1;
        const dampedDx =
          dx > SWIPE_THRESHOLD
            ? SWIPE_THRESHOLD + (dx - SWIPE_THRESHOLD) * resistance
            : dx;

        setTranslateX(-Math.min(dampedDx, DELETE_TRIGGER_THRESHOLD + 20));
      } else {
        setTranslateX(0);
      }
    },
    [disabled, isDragging]
  );

  const endDrag = useCallback(() => {
    if (!isDragging || disabled) return;

    const dx = startXRef.current - currentXRef.current;

    if (!isSwipingRef.current) {
      setTranslateX(0);
      setIsDragging(false);
      return;
    }

    if (dx >= DELETE_TRIGGER_THRESHOLD) {
      setTranslateX(-DELETE_TRIGGER_THRESHOLD);
      window.setTimeout(() => {
        onDelete();
        setTranslateX(0);
      }, 150);
    } else if (dx >= SWIPE_THRESHOLD) {
      setTranslateX(-SWIPE_THRESHOLD);
    } else {
      setTranslateX(0);
    }

    isSwipingRef.current = false;
    setIsDragging(false);
  }, [disabled, isDragging, onDelete]);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (disabled) return;
      beginDrag(e.touches[0].clientX, e.touches[0].clientY);
    },
    [beginDrag, disabled]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      // React touchmove is commonly passive on mobile; rely on PointerEvents + touchAction for Android.
      moveDrag(e.touches[0].clientX, e.touches[0].clientY);
    },
    [moveDrag]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (disabled) return;
      if (e.pointerType === "mouse") return;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      beginDrag(e.clientX, e.clientY);
    },
    [beginDrag, disabled]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType === "mouse") return;
      moveDrag(e.clientX, e.clientY, () => e.preventDefault());
    },
    [moveDrag]
  );

  const handleDeleteClick = useCallback(() => {
    if (disabled) return;
    onDelete();
    setTranslateX(0);
  }, [disabled, onDelete]);

  const resetSwipe = useCallback(() => {
    setTranslateX(0);
  }, []);

  const deleteOpacity = Math.min(Math.abs(translateX) / SWIPE_THRESHOLD, 1);
  const isDeleteVisible = Math.abs(translateX) > 20;

  return (
    <div className={cn("relative overflow-hidden rounded-lg", className)}>
      {/* Delete background */}
      <div
        className={cn(
          "absolute inset-y-0 right-0 flex items-center justify-end bg-destructive transition-opacity",
          isDeleteVisible ? "opacity-100" : "opacity-0"
        )}
        style={{ width: Math.abs(translateX) + 20, opacity: deleteOpacity }}
      >
        <button
          onClick={handleDeleteClick}
          className="flex items-center justify-center w-20 h-full text-destructive-foreground"
          aria-label="Eliminar"
          type="button"
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
        style={{ transform: `translateX(${translateX}px)`, touchAction: "pan-y" }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={endDrag}
        onTouchCancel={endDrag}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClick={translateX !== 0 ? resetSwipe : undefined}
      >
        {children}
      </div>
    </div>
  );
};

export default SwipeToDelete;

