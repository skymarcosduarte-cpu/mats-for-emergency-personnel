import { useState, useEffect } from "react";
import matsLogo from "@/assets/mats-logo.png";

interface SplashScreenProps {
  onComplete: () => void;
  minDuration?: number;
}

export function SplashScreen({ onComplete, minDuration = 2500 }: SplashScreenProps) {
  const [phase, setPhase] = useState<"logo" | "text" | "fadeout">("logo");

  useEffect(() => {
    // Phase 1: Logo appears and pulses
    const textTimer = setTimeout(() => setPhase("text"), 800);
    
    // Phase 2: Fade out and complete
    const fadeTimer = setTimeout(() => setPhase("fadeout"), minDuration - 500);
    
    // Complete after animation
    const completeTimer = setTimeout(onComplete, minDuration);

    return () => {
      clearTimeout(textTimer);
      clearTimeout(fadeTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete, minDuration]);

  return (
    <div 
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background transition-opacity duration-500 ${
        phase === "fadeout" ? "opacity-0" : "opacity-100"
      }`}
    >
      {/* Animated background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-primary/10" />
      
      {/* Glow effect behind logo */}
      <div 
        className={`absolute w-64 h-64 rounded-full bg-primary/20 blur-3xl transition-all duration-1000 ${
          phase !== "logo" ? "scale-150 opacity-30" : "scale-100 opacity-50"
        }`}
      />
      
      {/* Logo container with animations */}
      <div className="relative z-10 flex flex-col items-center gap-6">
        {/* Animated logo */}
        <div 
          className={`transition-all duration-700 ease-out ${
            phase === "logo" 
              ? "scale-90 opacity-0" 
              : "scale-100 opacity-100"
          }`}
          style={{
            animation: phase !== "logo" ? "pulse-glow 2s ease-in-out infinite" : "none"
          }}
        >
          <img
            src={matsLogo}
            alt="M.A.T.S. Logo"
            className="w-32 h-32 md:w-40 md:h-40 drop-shadow-2xl"
            style={{
              filter: "drop-shadow(0 0 20px rgba(22, 163, 74, 0.4))"
            }}
          />
        </div>

        {/* Animated text */}
        <div 
          className={`flex flex-col items-center gap-2 transition-all duration-500 delay-300 ${
            phase === "text" || phase === "fadeout"
              ? "opacity-100 translate-y-0" 
              : "opacity-0 translate-y-4"
          }`}
        >
          <h1 className="text-2xl md:text-3xl font-bold tracking-wider text-foreground">
            COMUNIDAD <span className="text-primary">EX SOS</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Sistema de Respuesta a Emergencias
          </p>
        </div>

        {/* Loading indicator */}
        <div 
          className={`flex gap-1 transition-opacity duration-300 ${
            phase === "fadeout" ? "opacity-0" : "opacity-100"
          }`}
        >
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-primary"
              style={{
                animation: "bounce 1s ease-in-out infinite",
                animationDelay: `${i * 0.15}s`
              }}
            />
          ))}
        </div>
      </div>

      {/* Custom animations */}
      <style>{`
        @keyframes pulse-glow {
          0%, 100% {
            transform: scale(1);
            filter: drop-shadow(0 0 20px rgba(22, 163, 74, 0.4));
          }
          50% {
            transform: scale(1.02);
            filter: drop-shadow(0 0 30px rgba(22, 163, 74, 0.6));
          }
        }
        
        @keyframes bounce {
          0%, 100% {
            transform: translateY(0);
            opacity: 0.5;
          }
          50% {
            transform: translateY(-6px);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
