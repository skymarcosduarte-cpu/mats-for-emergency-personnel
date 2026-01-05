import { useEffect, useState } from "react";
import matsLogo from "@/assets/mats-logo.png";

interface SplashScreenProps {
  onComplete: () => void;
  minDuration?: number;
}

export function SplashScreen({ onComplete, minDuration = 3500 }: SplashScreenProps) {
  const [phase, setPhase] = useState<"initial" | "logo" | "text" | "exit">("initial");

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase("logo"), 200),
      setTimeout(() => setPhase("text"), 1200),
      setTimeout(() => setPhase("exit"), minDuration - 600),
      setTimeout(onComplete, minDuration),
    ];
    return () => timers.forEach(clearTimeout);
  }, [onComplete, minDuration]);

  return (
    <div 
      className={`fixed inset-0 z-[100] flex items-center justify-center transition-opacity duration-700 ${
        phase === "exit" ? "opacity-0" : "opacity-100"
      }`}
      style={{
        background: "linear-gradient(145deg, #0a0a0a 0%, #1a1a2e 50%, #0f0f1a 100%)"
      }}
    >
      {/* Ambient glow */}
      <div 
        className={`absolute w-96 h-96 rounded-full transition-all duration-1000 ${
          phase !== "initial" ? "opacity-100 scale-100" : "opacity-0 scale-50"
        }`}
        style={{
          background: "radial-gradient(circle, rgba(34,197,94,0.15) 0%, transparent 70%)",
          filter: "blur(40px)"
        }}
      />

      <div className="relative flex flex-col items-center gap-8">
        {/* Logo container */}
        <div 
          className={`relative transition-all duration-1000 ease-out ${
            phase === "initial" 
              ? "opacity-0 scale-75" 
              : "opacity-100 scale-100"
          }`}
        >
          {/* Outer ring */}
          <div 
            className={`absolute -inset-4 rounded-full border border-white/10 transition-all duration-1000 ${
              phase !== "initial" ? "opacity-100 scale-100" : "opacity-0 scale-90"
            }`}
          />
          
          {/* Logo with shimmer */}
          <div className="relative overflow-hidden rounded-2xl p-1 bg-gradient-to-br from-white/10 to-transparent">
            <img
              src={matsLogo}
              alt="M.A.T.S."
              className="w-36 h-36 md:w-44 md:h-44 rounded-xl"
            />
            {/* Shimmer */}
            <div 
              className="absolute inset-0 -translate-x-full"
              style={{
                background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)",
                animation: phase !== "initial" ? "shimmer 2.5s ease-in-out infinite" : "none"
              }}
            />
          </div>
        </div>
        
        {/* Text content */}
        <div 
          className={`text-center transition-all duration-700 delay-100 ${
            phase === "text" || phase === "exit"
              ? "opacity-100 translate-y-0" 
              : "opacity-0 translate-y-4"
          }`}
        >
          <h1 className="text-3xl md:text-4xl font-light tracking-[0.2em] text-white/90">
            COMUNIDAD
          </h1>
          <span className="text-4xl md:text-5xl font-bold tracking-wider bg-gradient-to-r from-green-400 to-emerald-500 bg-clip-text text-transparent">
            SOS
          </span>
          
          <div className="mt-6 flex flex-col items-center gap-3">
            <div className="w-12 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
            <p className="text-sm tracking-widest text-white/50 uppercase">
              Sistema de Emergencias
            </p>
          </div>
          
          <p className="mt-6 text-white/40 text-sm font-light italic">
            Con M.A.T.S. nunca estarás solo
          </p>
        </div>

        {/* Loading dots */}
        <div 
          className={`flex gap-2 mt-4 transition-opacity duration-500 ${
            phase === "exit" ? "opacity-0" : phase === "text" ? "opacity-100" : "opacity-0"
          }`}
        >
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-white/40"
              style={{
                animation: "pulse-dot 1.4s ease-in-out infinite",
                animationDelay: `${i * 0.2}s`
              }}
            />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes shimmer {
          0%, 100% { transform: translateX(-100%); }
          50% { transform: translateX(100%); }
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}
