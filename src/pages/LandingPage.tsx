import { useState } from "react";
import { MatsLogo } from "@/components/MatsLogo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  ArrowRight
} from "lucide-react";
import { toast } from "sonner";

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

const betaCodes = [
  { code: "BETA2025", uses: "50 usos", expires: "1 Mar 2025" },
  { code: "RESCATE01", uses: "20 usos", expires: "1 Mar 2025" },
  { code: "FAMILIA01", uses: "30 usos", expires: "1 Mar 2025" },
  { code: "COMUNIDAD", uses: "100 usos", expires: "1 Jun 2025" }
];

const installSteps = [
  { step: 1, title: "Abre la app", description: "Visita la app desde tu navegador móvil (Safari en iPhone, Chrome en Android)" },
  { step: 2, title: "Menú del navegador", description: "Toca el ícono de compartir (iPhone) o el menú de 3 puntos (Android)" },
  { step: 3, title: "Agregar a inicio", description: "Selecciona 'Agregar a pantalla de inicio' o 'Instalar aplicación'" },
  { step: 4, title: "Confirmar", description: "Toca 'Agregar' y la app aparecerá en tu pantalla de inicio" }
];

export default function LandingPage() {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success(`Código ${code} copiado`);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-background" />
        <div className="relative container mx-auto px-4 py-16 md:py-24">
          <div className="flex flex-col items-center text-center space-y-6">
            <Badge variant="secondary" className="text-sm">
              🚀 Beta Abierta
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
              <Button size="lg" onClick={() => scrollToSection("install")}>
                <Download className="mr-2 h-5 w-5" />
                Instalar App
              </Button>
              <Button size="lg" variant="outline" onClick={() => scrollToSection("codes")}>
                Obtener Código Beta
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

      {/* Beta Codes Section */}
      <section id="codes" className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4">Acceso Limitado</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Códigos de Invitación Beta</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Usa uno de estos códigos para registrarte en la app
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl mx-auto">
            {betaCodes.map((item) => (
              <Card 
                key={item.code} 
                className="bg-card hover:bg-accent/50 transition-colors cursor-pointer group"
                onClick={() => copyCode(item.code)}
              >
                <CardContent className="p-6 text-center">
                  <div className="font-mono text-2xl font-bold text-primary mb-2 flex items-center justify-center gap-2">
                    {item.code}
                    {copiedCode === item.code ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{item.uses}</p>
                  <p className="text-xs text-muted-foreground">Expira: {item.expires}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

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

      {/* Footer */}
      <footer className="py-8 border-t border-border">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <MatsLogo size={32} />
              <span className="font-semibold">COMUNIDAD EX SOS</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2025 M.A.T.S. - Mutual Aid & Tactical Support
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
