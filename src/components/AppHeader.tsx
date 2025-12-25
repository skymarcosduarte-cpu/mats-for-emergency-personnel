import React from 'react';
import { MatsLogo } from './MatsLogo';
import { AlertTriangle } from 'lucide-react';

interface AppHeaderProps {
  onPanicClick: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({ onPanicClick }) => {
  return (
    <header className="app-header">
      <MatsLogo size={36} showText />
      
      <button
        onClick={onPanicClick}
        className="relative w-12 h-12 rounded-full bg-panic text-primary-foreground shadow-panic flex items-center justify-center touch-target"
        aria-label="Botón de pánico"
        type="button"
      >
        <AlertTriangle className="w-6 h-6" />
        <span className="absolute inset-0 rounded-full border-2 border-panic animate-ping opacity-30 pointer-events-none" />
      </button>
    </header>
  );
};

export default AppHeader;
