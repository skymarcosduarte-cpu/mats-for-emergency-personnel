// EmergencyDirectory - Directorio de Protección Civil y Cruz Roja Internacional
// Combines both JSON directories with geolocation search, manual search, and hierarchical listing

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Phone,
  MapPin,
  Search,
  Navigation,
  Clock,
  Mail,
  Globe,
  AlertTriangle,
  Locate,
  ChevronRight,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocation } from '@/hooks/useLocation';
import { toast } from 'sonner';

// ─── Types ──────────────────────────────────────────────────────

interface NationalPhone {
  servicio: string;
  numero: string;
  descripcion: string;
  disponibilidad: string;
  gratuito: boolean;
}

interface Dependency {
  nombre: string;
  tipo: string;
  telefono: string;
  telefono_emergencia?: string;
  telefonos_adicionales?: string[];
  direccion?: string;
  email?: string;
  web?: string;
  horario?: string;
  servicios?: string[];
  descripcion?: string;
  ciudad?: string;
  codigo_postal?: string;
  coordenadas?: { latitud: number; longitud: number };
  source: 'pc' | 'cruz_roja';
  distance?: number;
}

interface Division {
  codigo: string;
  nombre: string;
  capital?: string;
  coordenadas?: { latitud: number; longitud: number };
  dependencias: Dependency[];
}

interface Country {
  codigo_pais: string;
  nombre: string;
  bandera: string;
  telefonos_nacionales: NationalPhone[];
  division_tipo: string;
  divisiones: Division[];
}

type ViewMode = 'nearby' | 'search' | 'list';

// ─── Helpers ────────────────────────────────────────────────────

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function formatPhone(phone: string): string {
  return phone.replace(/[^0-9+\-() ]/g, '');
}

const SERVICE_LABELS: Record<string, string> = {
  emergencias: '🚨 Emergencias',
  ambulancias: '🚑 Ambulancias',
  urgencias: '🏥 Urgencias',
  banco_sangre: '🩸 Banco de Sangre',
  capacitacion: '📚 Capacitación',
  prevencion: '🛡️ Prevención',
  rescate: '⛑️ Rescate',
  sismos: '🌍 Sismos',
  incendios: '🔥 Incendios',
  incendios_forestales: '🌲🔥 Inc. Forestales',
  huracanes: '🌀 Huracanes',
  inundaciones: '🌊 Inundaciones',
  volcanes: '🌋 Volcanes',
  rescate_maritimo: '⚓ Rescate Marítimo',
  rescate_montana: '⛰️ Rescate Montaña',
  atlas_riesgo: '🗺️ Atlas de Riesgo',
  informacion: 'ℹ️ Información',
  reporte_personas: '👤 Reporte Personas',
  orientacion: '🧭 Orientación',
  emergencias_quimicas: '☣️ Emerg. Químicas',
  atencion_turistas: '✈️ Atención Turistas',
  atencion_migrantes: '🌐 Atención Migrantes',
  atencion_frontera: '🛂 Atención Frontera',
  coordinacion_nacional: '🏛️ Coordinación Nacional',
  bomberos: '🚒 Bomberos',
  primeros_auxilios: '🩹 Primeros Auxilios',
  desastres_naturales: '🌊 Desastres Naturales',
};

// ─── Data Loading ───────────────────────────────────────────────

async function loadDirectories(): Promise<Country[]> {
  const [pcRes, crRes] = await Promise.all([
    fetch('/directorio_emergencias_completo.json'),
    fetch('/cruz_roja_directorio_completo.json'),
  ]);

  const pcData = await pcRes.json();
  const crData = await crRes.json();

  const countries: Country[] = [];

  // Process PC data as base
  for (const pais of pcData.paises) {
    const divisionKey = pais.division_tipo || 'estados';
    const rawDivisions: any[] = pais[divisionKey] || pais.estados || [];

    const divisiones: Division[] = rawDivisions.map((div: any) => {
      const deps: Dependency[] = (div.dependencias || []).map((d: any) => ({
        ...d,
        source: 'pc' as const,
        coordenadas: d.coordenadas || div.coordenadas,
      }));
      return {
        codigo: div.codigo,
        nombre: div.nombre,
        capital: div.capital,
        coordenadas: div.coordenadas,
        dependencias: deps,
      };
    });

    countries.push({
      codigo_pais: pais.codigo_pais,
      nombre: pais.nombre,
      bandera: pais.bandera,
      telefonos_nacionales: pais.telefonos_nacionales || [],
      division_tipo: divisionKey,
      divisiones,
    });
  }

  // Merge Cruz Roja data
  for (const crPais of crData.paises) {
    const country = countries.find((c) => c.codigo_pais === crPais.codigo_pais);
    if (!country) continue;

    const crDivisions: any[] = crPais[crPais.codigo_pais === 'MX' ? 'estados' : 'delegaciones'] || crPais.estados || crPais.provincias || crPais.departamentos || crPais.regiones || crPais.comunidades_autonomas || [];

    for (const crDiv of crDivisions) {
      const delegaciones = crDiv.delegaciones || [];
      const matchDiv = country.divisiones.find(
        (d) => d.codigo === crDiv.codigo || d.nombre === crDiv.nombre
      );

      const crDeps: Dependency[] = delegaciones.map((del: any) => ({
        nombre: del.nombre,
        tipo: del.tipo || 'cruz_roja',
        telefono: del.telefono,
        telefono_emergencia: del.telefono_emergencia,
        telefonos_adicionales: del.telefonos_adicionales,
        direccion: del.direccion,
        email: del.email,
        horario: del.horario,
        servicios: del.servicios,
        ciudad: del.ciudad,
        codigo_postal: del.codigo_postal,
        coordenadas: del.coordenadas,
        source: 'cruz_roja' as const,
      }));

      if (matchDiv) {
        matchDiv.dependencias.push(...crDeps);
      } else {
        country.divisiones.push({
          codigo: crDiv.codigo || crDiv.nombre,
          nombre: crDiv.nombre,
          coordenadas: delegaciones[0]?.coordenadas,
          dependencias: crDeps,
        });
      }
    }

    // Add sede nacional as a special dependency if exists
    if (crPais.sede_nacional) {
      const capitalDiv = country.divisiones.find(
        (d) => d.codigo === 'CDMX' || d.nombre === 'Ciudad de México' || d.nombre === 'Madrid' || d.codigo === 'BOGOTA'
      );
      if (capitalDiv) {
        capitalDiv.dependencias.push({
          nombre: crPais.sede_nacional.nombre,
          tipo: 'sede_nacional_cruz_roja',
          telefono: crPais.sede_nacional.telefono,
          email: crPais.sede_nacional.email,
          direccion: crPais.sede_nacional.direccion,
          servicios: crPais.sede_nacional.servicios,
          source: 'cruz_roja',
        });
      }
    }
  }

  return countries;
}

// ─── Sub-Components ─────────────────────────────────────────────

const NationalBanner: React.FC<{ country: Country }> = ({ country }) => (
  <div className="bg-destructive/15 border-2 border-destructive/40 rounded-2xl p-4 space-y-2">
    <div className="flex items-center gap-2">
      <span className="text-2xl">{country.bandera}</span>
      <span className="font-bold text-destructive text-lg">
        Emergencias en {country.nombre}
      </span>
    </div>
    <div className="space-y-2">
      {country.telefonos_nacionales.slice(0, 3).map((tel, i) => (
        <a
          key={i}
          href={`tel:${tel.numero.replace(/[^0-9+]/g, '')}`}
          className="flex items-center gap-3 bg-destructive text-destructive-foreground rounded-xl p-3 active:scale-[0.97] transition-transform"
        >
          <Phone className="w-6 h-6 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-lg">{tel.numero}</p>
            <p className="text-sm opacity-90 truncate">{tel.servicio}</p>
          </div>
          {tel.gratuito && (
            <Badge variant="outline" className="border-destructive-foreground/40 text-destructive-foreground text-xs shrink-0">
              Gratis
            </Badge>
          )}
        </a>
      ))}
    </div>
    {country.telefonos_nacionales.length > 3 && (
      <Accordion type="single" collapsible>
        <AccordionItem value="more" className="border-0">
          <AccordionTrigger className="py-2 text-sm text-destructive hover:no-underline">
            +{country.telefonos_nacionales.length - 3} números más
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2">
              {country.telefonos_nacionales.slice(3).map((tel, i) => (
                <a
                  key={i}
                  href={`tel:${tel.numero.replace(/[^0-9+]/g, '')}`}
                  className="flex items-center gap-3 bg-card border border-border rounded-xl p-3 active:scale-[0.97] transition-transform"
                >
                  <Phone className="w-5 h-5 text-destructive shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold">{tel.numero}</p>
                    <p className="text-xs text-muted-foreground truncate">{tel.servicio}</p>
                  </div>
                </a>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    )}
  </div>
);

const DependencyCard: React.FC<{ dep: Dependency; countryName?: string; divisionName?: string }> = ({
  dep,
  countryName,
  divisionName,
}) => {
  const isCruzRoja = dep.source === 'cruz_roja';

  return (
    <div
      className={cn(
        'rounded-2xl border-2 p-4 space-y-3 bg-card shadow-sm',
        isCruzRoja ? 'border-destructive/30' : 'border-border'
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-lg',
            isCruzRoja ? 'bg-destructive/20' : 'bg-primary/15'
          )}
        >
          {isCruzRoja ? '✚' : '🛡️'}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-base leading-tight">{dep.nombre}</h3>
          {(divisionName || dep.ciudad) && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {dep.ciudad && dep.ciudad !== divisionName
                ? `${dep.ciudad}, ${divisionName}`
                : divisionName}
            </p>
          )}
          {dep.distance !== undefined && (
            <Badge variant="secondary" className="mt-1 text-xs">
              📍 {dep.distance < 1 ? `${Math.round(dep.distance * 1000)}m` : `${dep.distance.toFixed(1)} km`}
            </Badge>
          )}
        </div>
      </div>

      {/* Main call button */}
      <a
        href={`tel:${dep.telefono.replace(/[^0-9+]/g, '')}`}
        className="flex items-center justify-center gap-3 w-full bg-destructive text-destructive-foreground rounded-xl p-3.5 font-bold text-lg active:scale-[0.97] transition-transform"
      >
        <Phone className="w-6 h-6" />
        📞 Llamar: {dep.telefono}
      </a>

      {/* Additional phones */}
      {dep.telefonos_adicionales && dep.telefonos_adicionales.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {dep.telefonos_adicionales.map((tel, i) => (
            <a
              key={i}
              href={`tel:${tel.replace(/[^0-9+]/g, '')}`}
              className="flex items-center gap-1.5 text-sm bg-muted px-3 py-1.5 rounded-lg active:scale-[0.97] transition-transform"
            >
              <Phone className="w-3.5 h-3.5 text-muted-foreground" />
              {tel}
            </a>
          ))}
        </div>
      )}

      {/* Info */}
      <div className="space-y-1.5 text-sm">
        {dep.direccion && (
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
            <span className="text-muted-foreground">{dep.direccion}</span>
          </div>
        )}
        {dep.horario && (
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">{dep.horario}</span>
          </div>
        )}
        {dep.email && (
          <a href={`mailto:${dep.email}`} className="flex items-center gap-2 text-primary">
            <Mail className="w-4 h-4 shrink-0" />
            <span className="underline truncate">{dep.email}</span>
          </a>
        )}
        {dep.web && (
          <a href={dep.web} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-primary">
            <Globe className="w-4 h-4 shrink-0" />
            <span className="underline truncate">Sitio web</span>
          </a>
        )}
      </div>

      {/* Services */}
      {dep.servicios && dep.servicios.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {dep.servicios.map((s, i) => (
            <Badge key={i} variant="outline" className="text-xs">
              {SERVICE_LABELS[s] || s}
            </Badge>
          ))}
        </div>
      )}

      {/* Navigate button */}
      {dep.coordenadas && (
        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${dep.coordenadas.latitud},${dep.coordenadas.longitud}&travelmode=driving`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full bg-primary/10 text-primary rounded-xl p-2.5 font-medium text-sm active:scale-[0.97] transition-transform border border-primary/30"
        >
          <Navigation className="w-4 h-4" />
          Cómo llegar
        </a>
      )}
    </div>
  );
};

// ─── Main Component ─────────────────────────────────────────────

export default function EmergencyDirectory() {
  const { position } = useLocation();
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('nearby');
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [searchText, setSearchText] = useState('');
  const [expandedCountry, setExpandedCountry] = useState<string | null>(null);

  // Load data
  useEffect(() => {
    loadDirectories()
      .then((data) => {
        setCountries(data);
        setLoading(false);
      })
      .catch((e) => {
        console.error('[EmergencyDirectory] Load error:', e);
        setLoading(false);
        toast.error('Error al cargar el directorio');
      });
  }, []);

  // Auto-detect country from position
  const detectedCountry = useMemo(() => {
    if (!position || countries.length === 0) return null;
    let minDist = Infinity;
    let closest: Country | null = null;
    for (const c of countries) {
      for (const d of c.divisiones) {
        if (d.coordenadas) {
          const dist = haversineDistance(
            position.lat,
            position.lng,
            d.coordenadas.latitud,
            d.coordenadas.longitud
          );
          if (dist < minDist) {
            minDist = dist;
            closest = c;
          }
        }
      }
    }
    return closest;
  }, [position, countries]);

  // Set default country
  useEffect(() => {
    if (!selectedCountry && detectedCountry) {
      setSelectedCountry(detectedCountry.codigo_pais);
    } else if (!selectedCountry && countries.length > 0) {
      setSelectedCountry(countries[0].codigo_pais);
    }
  }, [detectedCountry, countries, selectedCountry]);

  const activeCountry = countries.find((c) => c.codigo_pais === selectedCountry);

  // Nearby dependencies (sorted by distance)
  const nearbyDeps = useMemo(() => {
    if (!position || !activeCountry) return [];
    const results: (Dependency & { divisionName: string })[] = [];
    for (const div of activeCountry.divisiones) {
      for (const dep of div.dependencias) {
        const coords = dep.coordenadas || div.coordenadas;
        if (!coords) continue;
        const dist = haversineDistance(
          position.lat,
          position.lng,
          coords.latitud,
          coords.longitud
        );
        if (dist <= 100) {
          results.push({ ...dep, distance: dist, divisionName: div.nombre });
        }
      }
    }
    results.sort((a, b) => (a.distance || 0) - (b.distance || 0));
    return results.slice(0, 20);
  }, [position, activeCountry]);

  // Search results
  const searchResults = useMemo(() => {
    if (!searchText.trim() || !activeCountry) return [];
    const q = searchText.toLowerCase();
    const results: (Dependency & { divisionName: string })[] = [];
    for (const div of activeCountry.divisiones) {
      const divMatch = div.nombre.toLowerCase().includes(q);
      for (const dep of div.dependencias) {
        if (
          divMatch ||
          dep.nombre.toLowerCase().includes(q) ||
          dep.ciudad?.toLowerCase().includes(q) ||
          dep.direccion?.toLowerCase().includes(q) ||
          dep.servicios?.some((s) => s.toLowerCase().includes(q))
        ) {
          results.push({ ...dep, divisionName: div.nombre });
        }
      }
    }
    return results.slice(0, 30);
  }, [searchText, activeCountry]);

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-10 w-full" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-40 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="p-4 space-y-4 pb-24">
        {/* Disclaimer */}
        <div className="bg-amber-500/20 border border-amber-500/30 rounded-xl p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-foreground leading-relaxed">
              En caso de emergencia real, llama inmediatamente. Verifica los números localmente, la información puede variar.
            </p>
          </div>
        </div>

        {/* Country selector */}
        <Select value={selectedCountry} onValueChange={setSelectedCountry}>
          <SelectTrigger className="h-12 text-base">
            <SelectValue placeholder="Seleccionar país" />
          </SelectTrigger>
          <SelectContent>
            {countries.map((c) => (
              <SelectItem key={c.codigo_pais} value={c.codigo_pais}>
                <span className="flex items-center gap-2">
                  <span className="text-lg">{c.bandera}</span>
                  <span>{c.nombre}</span>
                  {detectedCountry?.codigo_pais === c.codigo_pais && (
                    <Badge variant="secondary" className="text-xs ml-1">📍 Tu ubicación</Badge>
                  )}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* National emergency banner */}
        {activeCountry && <NationalBanner country={activeCountry} />}

        {/* View mode tabs */}
        <div className="flex gap-2 overflow-x-auto">
          <Button
            variant={viewMode === 'nearby' ? 'default' : 'outline'}
            size="sm"
            className="flex-shrink-0"
            onClick={() => setViewMode('nearby')}
          >
            <Locate className="w-4 h-4 mr-1" />
            Cerca de ti
          </Button>
          <Button
            variant={viewMode === 'search' ? 'default' : 'outline'}
            size="sm"
            className="flex-shrink-0"
            onClick={() => setViewMode('search')}
          >
            <Search className="w-4 h-4 mr-1" />
            Buscar
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            className="flex-shrink-0"
            onClick={() => setViewMode('list')}
          >
            <ChevronRight className="w-4 h-4 mr-1" />
            Listado Completo
          </Button>
        </div>

        {/* ── Nearby View ── */}
        {viewMode === 'nearby' && (
          <div className="space-y-3">
            {!position && (
              <div className="text-center py-8 space-y-2">
                <Locate className="w-10 h-10 text-muted-foreground mx-auto" />
                <p className="text-muted-foreground">Activa tu ubicación para ver las dependencias más cercanas</p>
              </div>
            )}
            {position && nearbyDeps.length === 0 && (
              <div className="text-center py-8 space-y-2">
                <MapPin className="w-10 h-10 text-muted-foreground mx-auto" />
                <p className="text-muted-foreground">No se encontraron dependencias cercanas en este país</p>
                <p className="text-xs text-muted-foreground">Intenta con otro país o usa la búsqueda manual</p>
              </div>
            )}
            {nearbyDeps.map((dep, i) => (
              <DependencyCard key={`${dep.nombre}-${i}`} dep={dep} divisionName={dep.divisionName} />
            ))}
          </div>
        )}

        {/* ── Search View ── */}
        {viewMode === 'search' && (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar estado, ciudad, servicio..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="pl-9 pr-9 h-12 text-base"
                autoFocus
              />
              {searchText && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                  onClick={() => setSearchText('')}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            {searchText.trim() && searchResults.length === 0 && (
              <p className="text-center text-muted-foreground py-6">No se encontraron resultados para "{searchText}"</p>
            )}
            {searchResults.map((dep, i) => (
              <DependencyCard key={`${dep.nombre}-${i}`} dep={dep} divisionName={dep.divisionName} />
            ))}
            {!searchText.trim() && (
              <p className="text-center text-muted-foreground py-6 text-sm">
                Escribe el nombre de un estado, ciudad o tipo de servicio
              </p>
            )}
          </div>
        )}

        {/* ── List View ── */}
        {viewMode === 'list' && (
          <div className="space-y-4">
            {/* Prominent PAÍSES header */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20 border-2 border-primary/30 p-5">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,hsl(var(--primary)/0.15),transparent_70%)]" />
              <div className="relative flex items-center justify-center gap-3">
                <span className="text-4xl animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite]">🌎</span>
                <div className="text-center">
                  <h2 className="text-2xl font-black tracking-widest text-primary uppercase animate-fade-in">
                    PAÍSES
                  </h2>
                  <p className="text-sm text-muted-foreground font-medium">
                    {countries.length} países · Selecciona uno para explorar
                  </p>
                </div>
                <span className="text-4xl animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite] [animation-delay:1s]">🌍</span>
              </div>
            </div>

            {/* Country list - each country is a button that expands inline */}
            <div className="space-y-3">
              {countries.map((country) => {
                const totalDeps = country.divisiones.reduce((acc: number, d: any) => acc + d.dependencias.length, 0);
                const isExpanded = expandedCountry === country.codigo_pais;
                return (
                  <div key={country.codigo_pais}>
                    <button
                      type="button"
                      onClick={() => setExpandedCountry(isExpanded ? null : country.codigo_pais)}
                      className={cn(
                        'flex items-center gap-3 w-full p-4 rounded-2xl border-2 transition-all duration-200 active:scale-[0.97] text-left',
                        isExpanded
                          ? 'border-primary bg-primary/10 shadow-lg shadow-primary/20'
                          : 'border-border bg-card hover:border-primary/50'
                      )}
                    >
                      <span className="text-4xl">{country.bandera}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-base">{country.nombre}</p>
                        <p className="text-xs text-muted-foreground">
                          {country.divisiones.length} {country.division_tipo} · {totalDeps} dependencias
                        </p>
                      </div>
                      <ChevronRight className={cn(
                        'w-5 h-5 text-muted-foreground transition-transform duration-200 shrink-0',
                        isExpanded && 'rotate-90 text-primary'
                      )} />
                    </button>

                    {/* Expanded detail inline */}
                    {isExpanded && (
                      <div className="mt-2 animate-fade-in border-2 border-primary/30 rounded-2xl p-4 bg-card space-y-3">
                        <NationalBanner country={country} />

                        <Accordion type="single" collapsible className="space-y-2">
                          {country.divisiones.map((div) => (
                            <AccordionItem
                              key={div.codigo}
                              value={`${country.codigo_pais}-${div.codigo}`}
                              className="border border-border rounded-xl overflow-hidden bg-background"
                            >
                              <AccordionTrigger className="px-3 py-2.5 hover:no-underline">
                                <div className="flex items-center gap-2 text-left">
                                  <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center">
                                    <MapPin className="w-3.5 h-3.5 text-primary" />
                                  </div>
                                  <div>
                                    <p className="font-bold text-sm">{div.nombre}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {div.dependencias.length} dependencia{div.dependencias.length !== 1 ? 's' : ''}
                                    </p>
                                  </div>
                                </div>
                              </AccordionTrigger>
                              <AccordionContent className="px-3 pb-3">
                                <div className="space-y-3">
                                  {div.dependencias.map((dep, i) => (
                                    <DependencyCard
                                      key={`${dep.nombre}-${i}`}
                                      dep={dep}
                                      divisionName={div.nombre}
                                    />
                                  ))}
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          ))}
                        </Accordion>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
