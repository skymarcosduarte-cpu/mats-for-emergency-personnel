// M.A.T.S. Logo SVG Component
// Green Star of Life with M.A.T.S. siglas

import React from 'react';

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
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="flex-shrink-0"
      >
        {/* Star of Life - 6 pointed cross */}
        <g transform="translate(50, 50)">
          {/* Main cross arms with rounded ends */}
          {[0, 60, 120, 180, 240, 300].map((angle, i) => (
            <g key={i} transform={`rotate(${angle})`}>
              <rect
                x="-8"
                y="-45"
                width="16"
                height="35"
                rx="4"
                fill="hsl(var(--mats-green))"
              />
              <circle
                cx="0"
                cy="-45"
                r="8"
                fill="hsl(var(--mats-green))"
              />
            </g>
          ))}
          
          {/* Center circle */}
          <circle
            cx="0"
            cy="0"
            r="18"
            fill="hsl(var(--mats-green))"
          />
          
          {/* Inner circle (dark) */}
          <circle
            cx="0"
            cy="0"
            r="14"
            fill="hsl(var(--background))"
          />
          
          {/* Rod of Asclepius simplified snake */}
          <path
            d="M-1 -12 L-1 12 M-1 -8 C5 -6 5 -2 -1 0 C-7 2 -7 6 -1 8"
            stroke="hsl(var(--mats-green))"
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="none"
          />
        </g>
        
        {/* Glow effect */}
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
      </svg>
      
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

// Simplified marker icon for map
export const MatsMarkerIcon = ({ size = 32 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle
      cx="16"
      cy="16"
      r="14"
      fill="hsl(var(--mats-green))"
      stroke="hsl(var(--background))"
      strokeWidth="2"
    />
    <g transform="translate(16, 16) scale(0.4)">
      {[0, 60, 120, 180, 240, 300].map((angle, i) => (
        <g key={i} transform={`rotate(${angle})`}>
          <rect
            x="-6"
            y="-35"
            width="12"
            height="25"
            rx="3"
            fill="hsl(var(--background))"
          />
        </g>
      ))}
      <circle cx="0" cy="0" r="12" fill="hsl(var(--background))" />
    </g>
  </svg>
);

export default MatsLogo;
