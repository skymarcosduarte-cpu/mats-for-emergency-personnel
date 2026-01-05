import { useEffect, useState, useLayoutEffect } from "react";
import matsLogo from "@/assets/mats-logo.png";

interface SplashScreenProps {
  onComplete: () => void;
  minDuration?: number;
}

export function SplashScreen({ onComplete, minDuration = 5000 }: SplashScreenProps) {
  const [phase, setPhase] = useState<"initial" | "logo" | "glow" | "text" | "tagline" | "exit">("initial");

  // Hide native splash immediately when React splash mounts
  useLayoutEffect(() => {
    if (typeof window !== 'undefined' && (window as any).hideNativeSplash) {
      (window as any).hideNativeSplash();
    }
  }, []);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase("logo"), 100),
      setTimeout(() => setPhase("glow"), 600),
      setTimeout(() => setPhase("text"), 1500),
      setTimeout(() => setPhase("tagline"), 2500),
      setTimeout(() => setPhase("exit"), minDuration - 1000),
      setTimeout(onComplete, minDuration),
    ];
    return () => timers.forEach(clearTimeout);
  }, [onComplete, minDuration]);

  const isVisible = (targetPhase: string) => {
    const order = ["initial", "logo", "glow", "text", "tagline", "exit"];
    return order.indexOf(phase) >= order.indexOf(targetPhase);
  };

  return (
    <div 
      className={`fixed inset-0 z-[100] flex items-center justify-center transition-opacity duration-1000 ${
        phase === "exit" ? "opacity-0" : "opacity-100"
      }`}
      style={{
        background: "linear-gradient(145deg, #0a0a0a 0%, #1a1a2e 50%, #0f0f1a 100%)"
      }}
    >
      {/* Animated background particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-green-500/5"
            style={{
              width: `${60 + i * 40}px`,
              height: `${60 + i * 40}px`,
              left: `${10 + i * 15}%`,
              top: `${20 + (i % 3) * 25}%`,
              animation: `float-particle ${8 + i * 2}s ease-in-out infinite`,
              animationDelay: `${i * 0.5}s`,
              opacity: isVisible("glow") ? 1 : 0,
              transition: "opacity 1s ease-out",
            }}
          />
        ))}
      </div>

      {/* Primary ambient glow */}
      <div 
        className={`absolute rounded-full transition-all duration-1500 ease-out ${
          isVisible("glow") ? "opacity-100 scale-100" : "opacity-0 scale-50"
        }`}
        style={{
          width: "500px",
          height: "500px",
          background: "radial-gradient(circle, rgba(34,197,94,0.12) 0%, rgba(34,197,94,0.05) 40%, transparent 70%)",
          filter: "blur(60px)",
        }}
      />
      
      {/* Secondary glow ring */}
      <div 
        className={`absolute rounded-full transition-all duration-2000 ease-out ${
          isVisible("text") ? "opacity-100 scale-100" : "opacity-0 scale-75"
        }`}
        style={{
          width: "700px",
          height: "700px",
          background: "radial-gradient(circle, transparent 50%, rgba(34,197,94,0.03) 70%, transparent 100%)",
          filter: "blur(40px)",
        }}
      />

      <div className="relative flex flex-col items-center">
        {/* Logo container with premium effects */}
        <div 
          className={`relative transition-all duration-1000 ease-out ${
            phase === "initial" 
              ? "opacity-0 scale-90 translate-y-4" 
              : "opacity-100 scale-100 translate-y-0"
          }`}
        >
          {/* Outer decorative rings */}
          <div 
            className={`absolute -inset-6 rounded-full transition-all duration-1500 ${
              isVisible("glow") ? "opacity-100 scale-100" : "opacity-0 scale-90"
            }`}
            style={{
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          />
          <div 
            className={`absolute -inset-12 rounded-full transition-all duration-2000 ${
              isVisible("text") ? "opacity-100 scale-100" : "opacity-0 scale-85"
            }`}
            style={{
              border: "1px solid rgba(255,255,255,0.03)",
            }}
          />
          
          {/* Logo glow effect */}
          <div 
            className={`absolute -inset-2 rounded-3xl transition-all duration-1000 ${
              isVisible("glow") ? "opacity-100" : "opacity-0"
            }`}
            style={{
              background: "radial-gradient(circle at center, rgba(34,197,94,0.2), transparent 70%)",
              filter: "blur(20px)",
            }}
          />
          
          {/* Main logo with shimmer */}
          <div className="relative overflow-hidden rounded-2xl p-1 bg-gradient-to-br from-white/10 via-white/5 to-transparent">
            <div className="relative overflow-hidden rounded-xl">
              <img
                src={matsLogo}
                alt="M.A.T.S."
                className="w-40 h-40 md:w-52 md:h-52 rounded-xl"
              />
              {/* Shimmer effect */}
              <div 
                className={`absolute inset-0 transition-opacity duration-500 ${
                  isVisible("glow") ? "opacity-100" : "opacity-0"
                }`}
                style={{
                  background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.15) 50%, transparent 60%)",
                  animation: "shimmer 3s ease-in-out infinite",
                }}
              />
            </div>
          </div>
        </div>
        
        {/* Text content with staggered reveal */}
        <div 
          className={`text-center mt-10 transition-all duration-800 ${
            isVisible("text")
              ? "opacity-100 translate-y-0" 
              : "opacity-0 translate-y-6"
          }`}
        >
          <h1 className="text-3xl md:text-4xl font-light tracking-[0.25em] text-white/85">
            COMUNIDAD
          </h1>
          <div className="mt-1">
            <span 
              className="text-5xl md:text-6xl font-bold tracking-wider bg-clip-text text-transparent"
              style={{
                backgroundImage: "linear-gradient(135deg, #22c55e 0%, #4ade80 50%, #86efac 100%)",
              }}
            >
              SOS
            </span>
          </div>
          
          {/* Decorative line */}
          <div 
            className={`mt-8 h-px mx-auto transition-all duration-1000 ${
              isVisible("tagline") ? "w-16 opacity-100" : "w-0 opacity-0"
            }`}
            style={{
              background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)",
            }}
          />
        </div>
        
        {/* Tagline with fade in */}
        <p 
          className={`mt-8 text-white/50 text-sm md:text-base font-light italic tracking-wide transition-all duration-800 ${
            isVisible("tagline")
              ? "opacity-100 translate-y-0" 
              : "opacity-0 translate-y-4"
          }`}
        >
          Con M.A.T.S. nunca estarás solo
        </p>

        {/* Premium loading indicator */}
        <div 
          className={`mt-10 flex items-center gap-1.5 transition-all duration-500 ${
            phase === "exit" ? "opacity-0" : isVisible("tagline") ? "opacity-100" : "opacity-0"
          }`}
        >
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="w-1 h-1 rounded-full bg-green-400/60"
              style={{
                animation: "loader-dot 1.4s ease-in-out infinite",
                animationDelay: `${i * 0.15}s`,
              }}
            />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-150%); }
          50%, 100% { transform: translateX(150%); }
        }
        @keyframes float-particle {
          0%, 100% { transform: translateY(0) translateX(0); opacity: 0.3; }
          25% { transform: translateY(-20px) translateX(10px); opacity: 0.5; }
          50% { transform: translateY(-10px) translateX(-5px); opacity: 0.4; }
          75% { transform: translateY(-25px) translateX(15px); opacity: 0.6; }
        }
        @keyframes loader-dot {
          0%, 80%, 100% { 
            transform: scale(0.6);
            opacity: 0.3;
          }
          40% { 
            transform: scale(1.2);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
