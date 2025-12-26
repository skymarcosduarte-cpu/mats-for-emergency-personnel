// M.A.T.S. Logo Component
import React from 'react';
import matsLogo from '@/assets/mats-logo.png';

interface MatsLogoProps {
  size?: number;
  className?: string;
  showText?: boolean;
}

export const MatsLogo: React.FC<MatsLogoProps> = ({ 
  size = 48, 
  className = '',
  showText = false 
}) => {
  // Responsive size classes based on size prop
  const sizeClass = size <= 32 ? 'rounded-md' : size <= 64 ? 'rounded-lg' : 'rounded-xl';
  
  return (
    <div className={`flex items-center gap-2 ${className}`}>
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
        <div className="flex flex-col">
          <span className="text-lg font-bold tracking-wider text-foreground">
            M.A.T.S.
          </span>
          <span className="text-xs text-muted-foreground">
            COMUNIDAD SOS
          </span>
        </div>
      )}
    </div>
  );
};

// Simplified marker icon for map - uses the same logo
export const MatsMarkerIcon = ({ size = 32 }: { size?: number }) => (
  <img
    src={matsLogo}
    alt="M.A.T.S."
    width={size}
    height={size}
    className="rounded-md object-contain"
    style={{ maxWidth: size, maxHeight: size }}
    loading="lazy"
  />
);

export default MatsLogo;
