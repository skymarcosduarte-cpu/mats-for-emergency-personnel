import { useEffect, useState, useLayoutEffect, useRef } from "react";
import matsLogo from "@/assets/mats-logo.png";
import { playWelcomeSound } from "@/lib/welcomeSound";

interface SplashScreenProps {
  onComplete: () => void;
  minDuration?: number;
}

export function SplashScreen({ onComplete, minDuration = 5500 }: SplashScreenProps) {
  const [phase, setPhase] = useState<"initial" | "reveal" | "logo" | "glow" | "text" | "tagline" | "ready" | "exit">("initial");
  const soundPlayedRef = useRef(false);

  // Hide native splash immediately when React splash mounts
  useLayoutEffect(() => {
    if (typeof window !== 'undefined' && (window as any).hideNativeSplash) {
      (window as any).hideNativeSplash();
    }
  }, []);

  // Play welcome sound when logo appears
  useEffect(() => {
    if (phase === "logo" && !soundPlayedRef.current) {
      soundPlayedRef.current = true;
      playWelcomeSound();
    }
  }, [phase]);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase("reveal"), 200),
      setTimeout(() => setPhase("logo"), 600),
      setTimeout(() => setPhase("glow"), 1200),
      setTimeout(() => setPhase("text"), 2000),
      setTimeout(() => setPhase("tagline"), 3000),
      setTimeout(() => setPhase("ready"), 4000),
      setTimeout(() => setPhase("exit"), minDuration - 800),
      setTimeout(onComplete, minDuration),
    ];
    return () => timers.forEach(clearTimeout);
  }, [onComplete, minDuration]);

  const isVisible = (targetPhase: string) => {
    const order = ["initial", "reveal", "logo", "glow", "text", "tagline", "ready", "exit"];
    return order.indexOf(phase) >= order.indexOf(targetPhase);
  };

  return (
    <div 
      className={`fixed inset-0 z-[100] flex items-center justify-center transition-all duration-1200 ${
        phase === "exit" ? "opacity-0 scale-105" : "opacity-100 scale-100"
      }`}
      style={{
        background: "radial-gradient(ellipse at 30% 20%, rgba(20,30,20,1) 0%, rgba(5,10,5,1) 50%, rgba(0,0,0,1) 100%)"
      }}
    >
      {/* Ambient aurora effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div 
          className={`absolute w-[200%] h-[200%] -left-1/2 -top-1/2 transition-opacity duration-3000 ${
            isVisible("glow") ? "opacity-100" : "opacity-0"
          }`}
          style={{
            background: `
              radial-gradient(ellipse 80% 50% at 20% 40%, rgba(34,197,94,0.08) 0%, transparent 50%),
              radial-gradient(ellipse 60% 40% at 80% 60%, rgba(16,185,129,0.06) 0%, transparent 50%),
              radial-gradient(ellipse 50% 30% at 50% 80%, rgba(5,150,105,0.04) 0%, transparent 50%)
            `,
            animation: "aurora 15s ease-in-out infinite",
          }}
        />
      </div>

      {/* Floating particles - luxury style */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className={`absolute rounded-full transition-opacity duration-2000 ${
              isVisible("glow") ? "opacity-100" : "opacity-0"
            }`}
            style={{
              width: `${2 + Math.random() * 3}px`,
              height: `${2 + Math.random() * 3}px`,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              background: `rgba(${180 + Math.random() * 75}, ${220 + Math.random() * 35}, ${180 + Math.random() * 75}, ${0.3 + Math.random() * 0.4})`,
              boxShadow: `0 0 ${6 + Math.random() * 8}px rgba(74,222,128,0.3)`,
              animation: `float-luxury ${10 + Math.random() * 10}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 5}s`,
            }}
          />
        ))}
      </div>

      {/* Primary radial glow */}
      <div 
        className={`absolute rounded-full transition-all duration-2000 ease-out ${
          isVisible("glow") ? "opacity-100 scale-100" : "opacity-0 scale-50"
        }`}
        style={{
          width: "min(90vw, 600px)",
          height: "min(90vw, 600px)",
          background: "radial-gradient(circle, rgba(34,197,94,0.15) 0%, rgba(22,163,74,0.08) 30%, rgba(21,128,61,0.03) 60%, transparent 80%)",
          filter: "blur(80px)",
        }}
      />

      {/* Central content container */}
      <div className="relative flex flex-col items-center z-10">
        
        {/* Premium logo reveal */}
        <div 
          className={`relative transition-all duration-1200 ease-out ${
            phase === "initial" 
              ? "opacity-0 scale-75 blur-sm" 
              : isVisible("reveal")
                ? "opacity-100 scale-100 blur-0"
                : "opacity-0 scale-90"
          }`}
        >
          {/* Outer orbital ring */}
          <div 
            className={`absolute -inset-16 md:-inset-20 rounded-full transition-all duration-2000 ${
              isVisible("text") ? "opacity-100" : "opacity-0"
            }`}
            style={{
              border: "1px solid rgba(74,222,128,0.1)",
              animation: isVisible("text") ? "rotate-slow 30s linear infinite" : "none",
            }}
          >
            {/* Orbital dot */}
            <div 
              className="absolute w-2 h-2 rounded-full bg-green-400/60"
              style={{
                top: "50%",
                left: "-4px",
                transform: "translateY(-50%)",
                boxShadow: "0 0 10px rgba(74,222,128,0.5)",
              }}
            />
          </div>

          {/* Inner orbital ring */}
          <div 
            className={`absolute -inset-10 md:-inset-12 rounded-full transition-all duration-1500 ${
              isVisible("glow") ? "opacity-100" : "opacity-0"
            }`}
            style={{
              border: "1px solid rgba(255,255,255,0.08)",
              animation: isVisible("glow") ? "rotate-slow 20s linear infinite reverse" : "none",
            }}
          />

          {/* Pulsing glow behind logo */}
          <div 
            className={`absolute -inset-4 rounded-3xl transition-all duration-1500 ${
              isVisible("glow") ? "opacity-100" : "opacity-0"
            }`}
            style={{
              background: "radial-gradient(circle at center, rgba(34,197,94,0.25), rgba(22,163,74,0.1) 50%, transparent 70%)",
              filter: "blur(25px)",
              animation: isVisible("glow") ? "pulse-glow 3s ease-in-out infinite" : "none",
            }}
          />

          {/* Logo frame with glass morphism */}
          <div 
            className="relative p-1 rounded-3xl overflow-hidden"
            style={{
              background: "linear-gradient(145deg, rgba(255,255,255,0.15), rgba(255,255,255,0.02))",
              boxShadow: `
                0 25px 50px -12px rgba(0,0,0,0.5),
                0 0 0 1px rgba(255,255,255,0.1),
                inset 0 1px 0 rgba(255,255,255,0.1)
              `,
            }}
          >
            <div 
              className="relative overflow-hidden rounded-2xl"
              style={{
                background: "rgba(0,0,0,0.3)",
                backdropFilter: "blur(10px)",
              }}
            >
              <img
                src={matsLogo}
                alt="M.A.T.S."
                className="w-36 h-36 md:w-48 md:h-48 lg:w-56 lg:h-56 rounded-2xl"
              />
              
              {/* Sweeping light effect */}
              <div 
                className={`absolute inset-0 transition-opacity duration-1000 ${
                  isVisible("glow") ? "opacity-100" : "opacity-0"
                }`}
                style={{
                  background: "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.2) 45%, rgba(255,255,255,0.3) 50%, rgba(255,255,255,0.2) 55%, transparent 70%)",
                  animation: isVisible("glow") ? "sweep-light 4s ease-in-out infinite" : "none",
                }}
              />
              
              {/* Subtle inner glow */}
              <div 
                className="absolute inset-0 rounded-2xl pointer-events-none"
                style={{
                  boxShadow: "inset 0 0 40px rgba(34,197,94,0.1)",
                }}
              />
            </div>
          </div>
        </div>

        {/* Text reveal with elegant stagger */}
        <div 
          className={`text-center mt-12 transition-all duration-1000 ${
            isVisible("text") ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          {/* COMUNIDAD text with letter spacing animation */}
          <div className="overflow-hidden">
            <h1 
              className="text-2xl md:text-3xl lg:text-4xl font-extralight tracking-[0.4em] text-white/80"
              style={{
                textShadow: "0 2px 20px rgba(0,0,0,0.5)",
              }}
            >
              COMUNIDAD
            </h1>
          </div>

          {/* SOS with premium gradient */}
          <div className="mt-2 overflow-hidden">
            <span 
              className="text-5xl md:text-6xl lg:text-7xl font-black tracking-[0.15em] bg-clip-text text-transparent"
              style={{
                backgroundImage: "linear-gradient(135deg, #22c55e 0%, #4ade80 25%, #86efac 50%, #4ade80 75%, #22c55e 100%)",
                backgroundSize: "200% 100%",
                animation: isVisible("text") ? "gradient-shift 4s ease-in-out infinite" : "none",
                filter: "drop-shadow(0 4px 20px rgba(34,197,94,0.3))",
              }}
            >
              SOS
            </span>
          </div>

          {/* Elegant separator */}
          <div className="relative h-px mt-8 mx-auto overflow-hidden">
            <div 
              className={`absolute inset-0 transition-all duration-1500 ${
                isVisible("tagline") ? "opacity-100" : "opacity-0"
              }`}
              style={{
                width: "120px",
                left: "50%",
                transform: "translateX(-50%)",
                background: "linear-gradient(90deg, transparent, rgba(74,222,128,0.5), transparent)",
              }}
            />
          </div>
        </div>

        {/* Tagline with typewriter-like reveal */}
        <div 
          className={`mt-8 transition-all duration-1000 ${
            isVisible("tagline") ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <p 
            className="text-white/50 text-sm md:text-base lg:text-lg font-light italic tracking-wider"
            style={{
              textShadow: "0 2px 10px rgba(0,0,0,0.3)",
            }}
          >
            Con M.A.T.S. nunca estarás solo
          </p>
        </div>

        {/* Premium loading indicator */}
        <div 
          className={`mt-12 transition-all duration-800 ${
            phase === "exit" ? "opacity-0 scale-90" : isVisible("ready") ? "opacity-100 scale-100" : "opacity-0 scale-90"
          }`}
        >
          <div className="relative">
            {/* Loading bar container */}
            <div 
              className="w-32 h-0.5 rounded-full overflow-hidden"
              style={{
                background: "rgba(255,255,255,0.1)",
              }}
            >
              <div 
                className="h-full rounded-full"
                style={{
                  background: "linear-gradient(90deg, transparent, rgba(74,222,128,0.8), transparent)",
                  animation: "loading-sweep 1.5s ease-in-out infinite",
                }}
              />
            </div>
            
            {/* Glow under loader */}
            <div 
              className="absolute -inset-2 rounded-full"
              style={{
                background: "radial-gradient(ellipse at center, rgba(74,222,128,0.15), transparent)",
                filter: "blur(8px)",
              }}
            />
          </div>
        </div>
      </div>

      {/* Bottom gradient fade */}
      <div 
        className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
        style={{
          background: "linear-gradient(to top, rgba(0,0,0,0.5), transparent)",
        }}
      />

      <style>{`
        @keyframes aurora {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          33% { transform: translate(-5%, 3%) rotate(1deg); }
          66% { transform: translate(3%, -2%) rotate(-1deg); }
        }
        
        @keyframes float-luxury {
          0%, 100% { 
            transform: translateY(0) translateX(0) scale(1);
            opacity: 0.4;
          }
          25% { 
            transform: translateY(-30px) translateX(15px) scale(1.1);
            opacity: 0.7;
          }
          50% { 
            transform: translateY(-15px) translateX(-10px) scale(0.9);
            opacity: 0.5;
          }
          75% { 
            transform: translateY(-40px) translateX(20px) scale(1.2);
            opacity: 0.8;
          }
        }
        
        @keyframes rotate-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        @keyframes pulse-glow {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.1); }
        }
        
        @keyframes sweep-light {
          0% { transform: translateX(-150%) rotate(15deg); }
          100% { transform: translateX(250%) rotate(15deg); }
        }
        
        @keyframes gradient-shift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        
        @keyframes loading-sweep {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(0%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
