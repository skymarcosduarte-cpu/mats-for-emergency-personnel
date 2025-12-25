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
        
        <p className="text-xs text-muted-foreground leading-relaxed">
          APP gratuita, sin fines de lucro, creada para mantener el contacto y apoyo 
          entre los miembros y familiares de la comunidad EX SOS global.
        </p>
        
        <Button variant="ghost" size="sm" asChild>
          <a href="mailto:contacto@businessfirstaid.online">
            <MessageSquare className="h-4 w-4 mr-2" />
            Contáctanos
          </a>
        </Button>
        
        <p className="text-xs text-muted-foreground">
          © 2025 M.A.T.S.
        </p>
      </div>
    </footer>
  );
}
