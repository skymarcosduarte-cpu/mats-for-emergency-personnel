import { MatsLogo } from "@/components/MatsLogo";

export function AppFooter() {
  return (
    <footer className="py-4 px-4 border-t border-border bg-muted/20">
      <div className="flex flex-col items-center gap-3 text-center max-w-sm mx-auto">
        {/* M.A.T.S. Logo + Meaning */}
        <div className="flex items-center gap-2">
          <MatsLogo size={24} />
          <div className="text-left">
            <p className="text-xs font-bold text-primary tracking-wide">M.A.T.S.</p>
            <p className="text-[10px] text-muted-foreground leading-tight">
              Mutual Aid Tracking System
            </p>
          </div>
        </div>

        {/* Community Name */}
        <p className="text-sm font-semibold text-foreground">
          COMUNIDAD SOS
        </p>

        {/* Free Version Badge */}
        <p className="text-[10px] text-muted-foreground">
          Versión Gratuita · Solo por Invitación
        </p>

        {/* Powered by */}
        <p className="text-[10px] text-muted-foreground">
          Powered by{" "}
          <a
            href="https://latamgrowthoperators.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Latam Growth Operators
          </a>
        </p>
      </div>
    </footer>
  );
}
