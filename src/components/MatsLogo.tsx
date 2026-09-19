// M.A.T.S. Logo Component
import React, { forwardRef, memo } from 'react';
import matsLogo from '@/assets/mats-logo.png';

interface MatsLogoProps {
  size?: number;
  className?: string;
  showText?: boolean;
}

export const MatsLogo = memo(forwardRef<HTMLDivElement, MatsLogoProps>(({ 
  size = 48, 
  className = '',
  showText = false 
}, ref) => {
  // Responsive size classes based on size prop
  const sizeClass = size <= 32 ? 'rounded-md' : size <= 64 ? 'rounded-lg' : 'rounded-xl';
  
  return (
    <div ref={ref} className={`flex items-center gap-2 min-w-0 ${className}`}>
      <img
        src={matsLogo}
        alt="M.A.T.S. Logo"
        width={size}
        height={size}
        className={`flex-shrink-0 ${sizeClass} object-contain`}
        style={{
          maxWidth: size,
          maxHeight: size,
        }}
        loading="lazy"
      />

      {showText && (
        <div className="flex flex-col min-w-0">
          <span className="text-base sm:text-lg font-bold tracking-wider text-foreground truncate leading-none">
            M.A.T.S.
          </span>
          <span className="text-[10px] sm:text-xs text-muted-foreground truncate">
            M.A.T.S. for Emergency Personnel
          </span>
        </div>
      )}
    </div>
  );
}));

MatsLogo.displayName = 'MatsLogo';

// Simplified marker icon for map - uses the same logo
export const MatsMarkerIcon = memo(({ size = 32 }: { size?: number }) => (
  <img
    src={matsLogo}
    alt="M.A.T.S."
    width={size}
    height={size}
    className="rounded-md object-contain"
    style={{ maxWidth: size, maxHeight: size }}
    loading="lazy"
  />
));

MatsMarkerIcon.displayName = 'MatsMarkerIcon';

export default MatsLogo;
