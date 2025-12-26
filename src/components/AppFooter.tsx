import { MatsLogo } from "@/components/MatsLogo";
import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";

export function AppFooter() {
  return (
    <footer className="py-6 px-4 border-t border-border bg-muted/30">
      <div className="flex flex-col items-center gap-4 text-center max-w-md mx-auto">
        <div className="flex items-center gap-2">
          <MatsLogo size={28} />
          <span className="font-semibold text-sm">COMUNIDAD EX SOS</span>
        </div>
        
        <div className="space-y-1">
          <p className="text-xs font-medium text-foreground">
            M.A.T.S. - Mutual Aid Tracking System
          </p>
          <p className="text-xs text-muted-foreground italic">
            Sistema de Seguimiento de Ayuda Mutua
          </p>
        </div>
        
        <div className="bg-primary/10 border border-primary/30 rounded-lg px-4 py-2">
          <p className="text-xs font-semibold text-primary">
            Versión Gratuita
          </p>
          <p className="text-xs text-muted-foreground">
            Disponible solo por Invitación
          </p>
        </div>
        
        <p className="text-xs text-muted-foreground leading-relaxed">
          APP gratuita, sin fines de lucro, creada para mantener el contacto y apoyo 
          entre los miembros y familiares de la comunidad EX SOS global.
        </p>
        
        <Button variant="ghost" size="sm" asChild>
          <a href="mailto:contacto@latamgrowthoperators.com">
            <MessageSquare className="h-4 w-4 mr-2" />
            Contáctanos
          </a>
        </Button>
        
        <p className="text-xs text-muted-foreground">
          © 2025 M.A.T.S.
        </p>
        <p className="text-xs text-muted-foreground">
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
