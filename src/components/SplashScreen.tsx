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
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-orange-500 transition-opacity duration-400 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="flex flex-col items-center gap-6 animate-fade-in">
        {/* Logo con shimmer */}
        <div className="relative">
          <div className="absolute inset-0 bg-white/20 blur-3xl rounded-full scale-125" />
          <div className="relative overflow-hidden rounded-3xl">
            <img
              src={matsLogo}
              alt="M.A.T.S."
              className="relative w-44 h-44 md:w-56 md:h-56"
            />
            {/* Shimmer effect */}
            <div 
              className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite]"
              style={{
                background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)"
              }}
            />
          </div>
        </div>
        
        {/* Texto */}
        <div className="text-center">
          <h1 className="text-2xl md:text-3xl font-bold tracking-wide text-white">
            COMUNIDAD <span className="text-orange-900">SOS</span>
          </h1>
          <p className="text-sm text-white/80 mt-1">
            Sistema de Emergencias
          </p>
          <p className="text-xs text-white/60 mt-3 italic">
            Con M.A.T.S. nunca estarás solo
          </p>
        </div>
      </div>

      <style>{`
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
