import { useMemo, useState } from "react";
import { MatsLogo } from "@/components/MatsLogo";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export function AppFooter() {
  const { user, profile } = useAuth();
  const defaultName = useMemo(
    () => profile?.nickname || profile?.full_name || "Anónimo",
    [profile?.nickname, profile?.full_name],
  );
  const defaultEmail = useMemo(() => user?.email || "", [user?.email]);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setName(defaultName);
      setEmail(defaultEmail);
    }
  };

  const handleSend = async () => {
    const cleanMessage = message.trim();
    if (!cleanMessage) {
      toast.error("Escribe un mensaje");
      return;
    }

    const cleanName = (name || defaultName).trim() || "Anónimo";
    const cleanEmail = (email || defaultEmail).trim() || "no-reply@comunidad.local";

    setSending(true);
    try {
      const { error } = await supabase.from("beta_feedback").insert({
        category: "contact",
        name: cleanName,
        email: cleanEmail,
        message: cleanMessage,
      });

      if (error) {
        console.error("Feedback insert error:", error);
        toast.error("No se pudo enviar", { description: "Intenta de nuevo" });
        return;
      }

      toast.success("Enviado", { description: "Gracias por tu mensaje" });
      setOpen(false);
      setMessage("");
    } finally {
      setSending(false);
    }
  };

  return (
    <footer className="py-6 px-4 border-t border-border bg-muted/30">
      <div className="flex flex-col items-center gap-4 text-center max-w-md mx-auto">
        <div className="flex items-center gap-2">
          <MatsLogo size={28} />
          <span className="font-semibold text-sm">COMUNIDAD EX SOS</span>
        </div>

        <div className="space-y-2">
          <div className="bg-primary/15 border border-primary/30 rounded-lg px-4 py-3">
            <p className="text-base font-bold text-primary tracking-wide">M.A.T.S.</p>
            <p className="text-sm font-semibold text-foreground">Mutual Aid Tracking System</p>
            <p className="text-xs text-muted-foreground italic mt-1">
              Sistema de Seguimiento de Ayuda Mutua
            </p>
          </div>
        </div>

        <div className="bg-primary/10 border border-primary/30 rounded-lg px-4 py-2">
          <p className="text-xs font-semibold text-primary">Versión Gratuita</p>
          <p className="text-xs text-muted-foreground">Disponible solo por Invitación</p>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          APP gratuita, sin fines de lucro, creada para mantener el contacto y apoyo entre los miembros
          y familiares de la comunidad EX SOS global.
        </p>

        <Button variant="ghost" size="sm" onClick={() => handleOpenChange(true)}>
          <MessageSquare className="h-4 w-4 mr-2" />
          Contáctanos (in-app)
        </Button>

        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Enviar mensaje</DialogTitle>
            </DialogHeader>

            <div className="grid gap-3">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-foreground">Nombre</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" />
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium text-foreground">Email (opcional)</label>
                <Input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  inputMode="email"
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium text-foreground">Mensaje</label>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="¿Qué necesitas?"
                  rows={4}
                />
              </div>

              <Button onClick={handleSend} disabled={sending}>
                <Send className="h-4 w-4 mr-2" />
                {sending ? "Enviando..." : "Enviar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <p className="text-xs text-muted-foreground">© 2025 M.A.T.S.</p>
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

