// M.A.T.S. Logo Component using uploaded image
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
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <img
        src={matsLogo}
        alt="M.A.T.S. Logo"
        width={size}
        height={size}
        className="flex-shrink-0 rounded-lg"
      />
      
      {showText && (
        <div className="flex flex-col">
          <span className="text-lg font-bold tracking-wider text-foreground">
            M.A.T.S.
          </span>
          <span className="text-xs text-muted-foreground">
            COMUNIDAD EX SOS
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
    className="rounded"
  />
);

export default MatsLogo;
