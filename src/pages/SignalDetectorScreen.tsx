// Pantalla propia del Detector / Buscador de Señales
// Vive fuera de Red Mesh para que sea una sección independiente.

import React from 'react';
import { BackToHomeButton } from '@/components/BackToHomeButton';
import { SignalScanner } from '@/components/SignalScanner';

interface SignalDetectorScreenProps {
  onGoHome?: () => void;
}

export const SignalDetectorScreen: React.FC<SignalDetectorScreenProps> = ({ onGoHome }) => {
  return (
    <div className="flex-1 overflow-auto scrollbar-thin pb-[calc(5rem+env(safe-area-inset-bottom,0px))]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border p-4 flex items-center gap-3">
        {onGoHome && <BackToHomeButton onClick={onGoHome} />}
        <h1 className="text-xl font-bold text-foreground">Detector de Señales</h1>
      </div>

      <div className="space-y-6 p-4">
        <section aria-label="Detector de señales">
          <SignalScanner />
        </section>
      </div>
    </div>
  );
};

export default SignalDetectorScreen;
