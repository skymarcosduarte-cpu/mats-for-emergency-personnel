import { useState, useEffect, useRef } from "react";
import { MatsLogo } from "@/components/MatsLogo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Shield, 
  MapPin, 
  Bell, 
  Car, 
  ShoppingBag, 
  Users, 
  Download, 
  Smartphone,
  CheckCircle2,
  Copy,
  ArrowRight,
  QrCode,
  MessageSquare,
  Send,
  Loader2,
  UserPlus
} from "lucide-react";
import { toast } from "sonner";
import QRCode from "qrcode";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

const features = [
  {
    icon: Shield,
    title: "Botón de Pánico",
    description: "Alerta inmediata a rescatistas en un radio de 5km con tu ubicación exacta"
  },
  {
    icon: MapPin,
    title: "Mapa en Tiempo Real",
    description: "Visualiza la ubicación de todos los miembros de la comunidad"
  },
  {
    icon: Bell,
    title: "Alertas Sísmicas",
    description: "Recibe notificaciones y reporta tu estado después de un sismo"
  },
  {
    icon: Car,
    title: "Registro de Tránsito",
    description: "Comparte tu ruta cuando viajas para que tu comunidad sepa dónde estás"
  },
  {
    icon: ShoppingBag,
    title: "Mercado Comunitario",
    description: "Compra y vende productos y servicios dentro de la comunidad"
  },
  {
    icon: Users,
    title: "Red de Rescatistas",
    description: "Conecta con voluntarios capacitados cerca de ti"
  }
];

// Beta codes removed during open beta period

const installSteps = [
  { step: 1, title: "Abre la app", description: "Visita la app desde tu navegador móvil (Safari en iPhone, Chrome en Android)" },
  { step: 2, title: "Menú del navegador", description: "Toca el ícono de compartir (iPhone) o el menú de 3 puntos (Android)" },
  { step: 3, title: "Agregar a inicio", description: "Selecciona 'Agregar a pantalla de inicio' o 'Instalar aplicación'" },
  { step: 4, title: "Confirmar", description: "Toca 'Agregar' y la app aparecerá en tu pantalla de inicio" }
];

// QR Code component for each invite code
function InviteQRCode({ code }: { code: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    if (canvasRef.current) {
      const appUrl = `${window.location.origin}/auth?invite=${code}`;
      QRCode.toCanvas(canvasRef.current, appUrl, {
        width: 200,
        margin: 2,
        color: {
          dark: '#16a34a',
          light: '#ffffff'
        }
      });
    }
  }, [code]);

  return <canvas ref={canvasRef} className="rounded-lg" />;
}

// Feedback form validation schema
const feedbackSchema = z.object({
  name: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres").max(100, "El nombre es muy largo"),
  email: z.string().trim().email("Ingresa un email válido").max(255, "El email es muy largo"),
  category: z.enum(["bug", "suggestion", "question", "other"], { required_error: "Selecciona una categoría" }),
  message: z.string().trim().min(10, "El mensaje debe tener al menos 10 caracteres").max(2000, "El mensaje es muy largo"),
  inviteCode: z.string().optional()
});

type FeedbackFormData = z.infer<typeof feedbackSchema>;

function FeedbackForm() {
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<FeedbackFormData>>({
    name: "",
    email: "",
    category: undefined,
    message: "",
    inviteCode: ""
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FeedbackFormData, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = feedbackSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof FeedbackFormData, string>> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as keyof FeedbackFormData] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("beta_feedback").insert({
        name: result.data.name,
        email: result.data.email,
        category: result.data.category,
        message: result.data.message,
        invite_code: result.data.inviteCode || null
      });

      if (error) throw error;

      setSubmitted(true);
      toast.success("¡Gracias por tu feedback!");
    } catch (error) {
      toast.error("Error al enviar. Intenta de nuevo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <Card className="max-w-lg mx-auto">
        <CardContent className="p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
          </div>
          <h3 className="text-xl font-semibold mb-2">¡Feedback Enviado!</h3>
          <p className="text-muted-foreground">
            Gracias por ayudarnos a mejorar la app. Revisaremos tu mensaje pronto.
          </p>
          <Button className="mt-6" variant="outline" onClick={() => { setSubmitted(false); setIsOpen(false); }}>
            Cerrar
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Initial state - just show button
  if (!isOpen) {
    return (
      <div className="max-w-lg mx-auto text-center">
        <Button size="lg" onClick={() => setIsOpen(true)}>
          <MessageSquare className="h-5 w-5 mr-2" />
          Enviar Feedback
        </Button>
      </div>
    );
  }

  return (
    <Card className="max-w-lg mx-auto">
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre *</Label>
              <Input
                id="name"
                placeholder="Tu nombre"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={errors.name ? "border-destructive" : ""}
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className={errors.email ? "border-destructive" : ""}
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">Categoría *</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value as FeedbackFormData["category"] })}
              >
                <SelectTrigger className={errors.category ? "border-destructive" : ""}>
                  <SelectValue placeholder="Selecciona..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bug">🐛 Bug / Error</SelectItem>
                  <SelectItem value="suggestion">💡 Sugerencia</SelectItem>
                  <SelectItem value="question">❓ Pregunta</SelectItem>
                  <SelectItem value="other">📝 Otro</SelectItem>
                </SelectContent>
              </Select>
              {errors.category && <p className="text-xs text-destructive">{errors.category}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="inviteCode">Código de invitación</Label>
              <Input
                id="inviteCode"
                placeholder="Opcional"
                value={formData.inviteCode}
                onChange={(e) => setFormData({ ...formData, inviteCode: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Mensaje *</Label>
            <Textarea
              id="message"
              placeholder="Describe el bug o comparte tu sugerencia..."
              rows={4}
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              className={errors.message ? "border-destructive" : ""}
            />
            {errors.message && <p className="text-xs text-destructive">{errors.message}</p>}
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Enviar Feedback
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function LandingPage() {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [qrDialogCode, setQrDialogCode] = useState<string | null>(null);

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success(`Código ${code} copiado`);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const showQR = (e: React.MouseEvent, code: string) => {
    e.stopPropagation();
    setQrDialogCode(code);
  };

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Open Beta Banner */}
      <div className="bg-primary text-primary-foreground py-3 px-4 text-center">
        <p className="text-sm md:text-base font-medium flex items-center justify-center gap-2 flex-wrap">
          <span className="animate-pulse">🎉</span>
          <span>¡Registro abierto! Durante la beta puedes registrarte sin código de invitación</span>
          <a href="/auth" className="underline font-bold hover:no-underline ml-1">
            Regístrate ahora →
          </a>
        </p>
      </div>

      {/* Hero Section */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-background" />
        <div className="relative container mx-auto px-4 py-16 md:py-24">
          <div className="flex flex-col items-center text-center space-y-6">
            <Badge variant="secondary" className="text-sm">
              🚀 Beta Abierta - Sin código requerido
            </Badge>
            <MatsLogo size={96} />
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
              COMUNIDAD <span className="text-primary">EX SOS</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl">
              Sistema de apoyo y seguridad comunitaria. Conecta con rescatistas, 
              recibe alertas y mantente seguro junto a tu comunidad.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 mt-8">
              <Button size="lg" asChild>
                <a href="/auth">
                  <UserPlus className="mr-2 h-5 w-5" />
                  Registrarme Gratis
                </a>
              </Button>
              <Button size="lg" variant="outline" onClick={() => scrollToSection("install")}>
                <Download className="mr-2 h-5 w-5" />
                Cómo Instalar
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Features Section */}
      <section className="py-16 md:py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Características</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Todo lo que necesitas para mantenerte conectado y seguro con tu comunidad
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <Card key={feature.title} className="bg-card/50 backdrop-blur border-border/50 hover:border-primary/50 transition-colors">
                <CardHeader>
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">{feature.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Beta Codes Section - Hidden during open beta */}

      {/* QR Code Dialog */}
      <Dialog open={!!qrDialogCode} onOpenChange={() => setQrDialogCode(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">Código de Invitación</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            {qrDialogCode && <InviteQRCode code={qrDialogCode} />}
            <div className="text-center">
              <p className="font-mono text-2xl font-bold text-primary">{qrDialogCode}</p>
              <p className="text-sm text-muted-foreground mt-2">
                Escanea el QR o comparte el código para invitar a nuevos usuarios
              </p>
            </div>
            <div className="flex gap-2 w-full">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => {
                  if (qrDialogCode) {
                    navigator.clipboard.writeText(qrDialogCode);
                    toast.success("Código copiado");
                  }
                }}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copiar Código
              </Button>
              <Button 
                className="flex-1"
                onClick={() => {
                  if (qrDialogCode) {
                    const url = `${window.location.origin}/auth?invite=${qrDialogCode}`;
                    navigator.clipboard.writeText(url);
                    toast.success("Enlace copiado");
                  }
                }}
              >
                Copiar Enlace
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Install Section */}
      <section id="install" className="py-16 md:py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
              <Smartphone className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Cómo Instalar</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Instala la app en tu teléfono en 4 simples pasos
            </p>
          </div>
          <div className="max-w-3xl mx-auto">
            <div className="space-y-6">
              {installSteps.map((item, index) => (
                <div key={item.step} className="flex gap-4 items-start">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                    {item.step}
                  </div>
                  <div className="flex-1 pt-1">
                    <h3 className="font-semibold text-lg mb-1">{item.title}</h3>
                    <p className="text-muted-foreground">{item.description}</p>
                  </div>
                  {index < installSteps.length - 1 && (
                    <ArrowRight className="h-5 w-5 text-muted-foreground/50 hidden md:block mt-2" />
                  )}
                </div>
              ))}
            </div>
            <div className="mt-12 text-center">
              <Button size="lg" asChild>
                <a href="/auth">
                  Comenzar Registro
                  <ArrowRight className="ml-2 h-5 w-5" />
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Feedback Section */}
      <section id="feedback" className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
              <MessageSquare className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Envíanos tu Feedback</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Ayúdanos a mejorar la app reportando bugs o compartiendo tus sugerencias
            </p>
          </div>
          <FeedbackForm />
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-border bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="flex items-center gap-2">
              <MatsLogo size={40} />
              <span className="font-bold text-lg">COMUNIDAD EX SOS</span>
            </div>
            
            <p className="text-sm text-muted-foreground max-w-2xl">
              APP gratuita, sin fines de lucro, creada para mantener el contacto y apoyo 
              entre los miembros y familiares de la comunidad EX SOS global.
            </p>
            
            <Button variant="outline" asChild>
              <a href="mailto:contacto@latamgrowthoperators.com">
                <MessageSquare className="h-4 w-4 mr-2" />
                Contáctanos
              </a>
            </Button>
            
            <p className="text-xs text-muted-foreground">
              © 2025 M.A.T.S. - Mutual Aid & Tactical Support
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
        </div>
      </footer>
    </div>
  );
}
