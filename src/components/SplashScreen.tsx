import { useEffect, useState } from "react";
import matsLogo from "@/assets/mats-logo.png";

interface SplashScreenProps {
  onComplete: () => void;
  minDuration?: number;
}

export function SplashScreen({ onComplete, minDuration = 2000 }: SplashScreenProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onComplete, 400);
    }, minDuration);
    return () => clearTimeout(timer);
  }, [onComplete, minDuration]);

  return (
    <div 
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-background transition-opacity duration-400 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="flex flex-col items-center gap-4 animate-fade-in">
        {/* Logo con glow sutil */}
        <div className="relative">
          <div className="absolute inset-0 bg-primary/30 blur-2xl rounded-full scale-110" />
          <img
            src={matsLogo}
            alt="M.A.T.S."
            className="relative w-28 h-28 md:w-36 md:h-36 animate-pulse"
          />
        </div>
        
        {/* Texto */}
        <div className="text-center">
          <h1 className="text-xl md:text-2xl font-bold tracking-wide text-foreground">
            COMUNIDAD <span className="text-primary">SOS</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Sistema de Emergencias
          </p>
        </div>
      </div>
    </div>
  );
}
