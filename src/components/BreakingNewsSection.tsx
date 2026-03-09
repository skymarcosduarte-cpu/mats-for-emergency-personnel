// Últimas Noticias Section - Clean, fluid display of emergency news

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  Newspaper, 
  ExternalLink, 
  RefreshCw, 
  AlertCircle,
  Clock,
  Loader2,
  Filter,
  Radio,
  AlertTriangle,
  ThumbsUp,
  MapPin,
  Navigation
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useBreakingNews, NewsItem } from '@/hooks/useBreakingNews';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

// Available sources with category info
const SOURCE_CONFIG: Record<string, { category: 'nacionales' | 'internacionales' | 'deportes' | 'emergencias' | 'seguridad'; color: string }> = {
  // Nacionales (expanded)
  'Milenio': { category: 'nacionales', color: 'bg-amber-500/10 text-amber-600 border-amber-500/30' },
  'El Universal': { category: 'nacionales', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' },
  'El Informador': { category: 'nacionales', color: 'bg-rose-500/10 text-rose-600 border-rose-500/30' },
  'La Jornada': { category: 'nacionales', color: 'bg-red-500/10 text-red-600 border-red-500/30' },
  'Excélsior': { category: 'nacionales', color: 'bg-blue-500/10 text-blue-600 border-blue-500/30' },
  'Reforma': { category: 'nacionales', color: 'bg-slate-500/10 text-slate-600 border-slate-500/30' },
  'Proceso': { category: 'nacionales', color: 'bg-orange-500/10 text-orange-600 border-orange-500/30' },
  'Expansión': { category: 'nacionales', color: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/30' },
  'El Financiero': { category: 'nacionales', color: 'bg-green-500/10 text-green-600 border-green-500/30' },
  'El Economista': { category: 'nacionales', color: 'bg-teal-500/10 text-teal-600 border-teal-500/30' },
  
  // Internacionales (expanded)
  'CNN en Español': { category: 'internacionales', color: 'bg-red-500/10 text-red-500 border-red-500/30' },
  'BBC Mundo': { category: 'internacionales', color: 'bg-blue-500/10 text-blue-500 border-blue-500/30' },
  'Reuters': { category: 'internacionales', color: 'bg-orange-500/10 text-orange-600 border-orange-500/30' },
  'Al Jazeera': { category: 'internacionales', color: 'bg-teal-500/10 text-teal-600 border-teal-500/30' },
  'France24 Español': { category: 'internacionales', color: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/30' },
  'DW Español': { category: 'internacionales', color: 'bg-purple-500/10 text-purple-600 border-purple-500/30' },
  'El País': { category: 'internacionales', color: 'bg-sky-500/10 text-sky-600 border-sky-500/30' },
  'Infobae': { category: 'internacionales', color: 'bg-amber-500/10 text-amber-600 border-amber-500/30' },
  'RTVE': { category: 'internacionales', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' },
  'TeleSUR': { category: 'internacionales', color: 'bg-green-600/10 text-green-600 border-green-600/30' },
  
  // Deportes en Español (expanded)
  'ESPN Latam': { category: 'deportes', color: 'bg-red-500/10 text-red-500 border-red-500/30' },
  'Marca': { category: 'deportes', color: 'bg-red-500/10 text-red-500 border-red-500/30' },
  'AS': { category: 'deportes', color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30' },
  'TyC Sports': { category: 'deportes', color: 'bg-blue-500/10 text-blue-600 border-blue-500/30' },
  'Olé': { category: 'deportes', color: 'bg-orange-500/10 text-orange-600 border-orange-500/30' },
  'Goal': { category: 'deportes', color: 'bg-purple-500/10 text-purple-600 border-purple-500/30' },
  'Medio Tiempo': { category: 'deportes', color: 'bg-amber-500/10 text-amber-600 border-amber-500/30' },
  'Récord': { category: 'deportes', color: 'bg-rose-500/10 text-rose-600 border-rose-500/30' },
  'Depor': { category: 'deportes', color: 'bg-green-500/10 text-green-600 border-green-500/30' },
  'Mundo Deportivo': { category: 'deportes', color: 'bg-sky-500/10 text-sky-600 border-sky-500/30' },
  'Sport': { category: 'deportes', color: 'bg-pink-500/10 text-pink-600 border-pink-500/30' },
  
  // Emergencias (solo fuentes dedicadas a emergencias)
  'CENAPRED': { category: 'emergencias', color: 'bg-orange-600/10 text-orange-600 border-orange-600/30' },
  'ReliefWeb México': { category: 'emergencias', color: 'bg-blue-600/10 text-blue-600 border-blue-600/30' },

  // Seguridad México
  'Milenio Policía': { category: 'seguridad', color: 'bg-red-700/10 text-red-700 border-red-700/30' },
  'Informador Jalisco': { category: 'seguridad', color: 'bg-rose-600/10 text-rose-600 border-rose-600/30' },
  'La Jornada Seguridad': { category: 'seguridad', color: 'bg-red-600/10 text-red-600 border-red-600/30' },
  'Aristegui Noticias': { category: 'seguridad', color: 'bg-violet-600/10 text-violet-600 border-violet-600/30' },
};

const CATEGORY_LABELS: Record<string, string> = {
  all: 'Todas',
  seguridad: '🚨 Seguridad',
  nacionales: 'Nacionales',
  internacionales: 'Internacionales',
  deportes: 'Deportes',
  emergencias: 'Emergencias',
};

// Keywords to identify emergency news by content (not just source)
// Using phrases/patterns to reduce false positives
const EMERGENCY_KEYWORDS = [
  'accidente vial', 'accidente de tránsito', 'accidente carretero', 'accidente fatal',
  'emergencia médica', 'emergencia sanitaria', 'estado de emergencia', 'alerta de emergencia',
  'explosión', 'explosion', 'desastre natural', 
  'huracán', 'huracan', 'incendio forestal', 'incendio devastador',
  'terremoto', 'sismo de magnitud', 'temblor',
  'inundación', 'inundacion', 'tornado', 'tsunami', 
  'evacuación masiva', 'evacuacion de emergencia',
  'derrumbe', 'colapso de edificio', 'atentado',
  'tormenta tropical', 'ciclón', 'ciclon', 
  'erupción volcánica', 'erupcion volcanica', 'volcán en erupción',
  'rescate de víctimas', 'operativo de rescate', 'brigada de rescate',
  'deslizamiento de tierra', 'avalancha', 
  'fuga de gas', 'naufragio', 
  'tragedia en', 'catástrofe', 'catastrofe',
  'apagón masivo', 'apagon', 'epidemia de', 'pandemia',
  'alerta sísmica', 'alerta roja', 'alerta por huracán',
  'muertos por', 'víctimas del', 'heridos en el'
];

// Keywords to auto-classify security news from any source
const SECURITY_KEYWORDS = [
  'bloqueo', 'narcobloqueo', 'narco bloqueo', 'bloqueo carretero', 'bloqueos en',
  'tiroteo', 'balacera', 'enfrentamiento armado', 'enfrentamiento entre',
  'captura de', 'detención de', 'detenido', 'operativo militar', 'operativo policial',
  'cartel', 'cártel', 'crimen organizado', 'grupo criminal', 'sicarios',
  'cierre de carretera', 'cierre vial', 'corte de carretera',
  'secuestro', 'levantón', 'extorsión', 'cobro de piso',
  'homicidio', 'asesinato', 'emboscada', 'persecución',
  'guardia nacional', 'ejército mexicano', 'sedena', 'marina',
  'narco', 'narcotráfico', 'narcoviolencia', 'narcomanta',
  'quema de vehículos', 'quema de autos', 'vehículos incendiados',
  'toque de queda', 'alerta de seguridad', 'zona de riesgo',
  'robo de vehículo', 'asalto en carretera', 'robo en carretera',
];

// Check if a news item matches emergency keywords
function isEmergencyNews(item: NewsItem): boolean {
  const textToSearch = `${item.title} ${item.description || ''}`.toLowerCase();
  return EMERGENCY_KEYWORDS.some(keyword => textToSearch.includes(keyword.toLowerCase()));
}

// Check if a news item matches security keywords
function isSecurityNews(item: NewsItem): boolean {
  const textToSearch = `${item.title} ${item.description || ''}`.toLowerCase();
  return SECURITY_KEYWORDS.some(keyword => textToSearch.includes(keyword.toLowerCase()));
}

// Format relative time for news items (only for past dates)
function formatNewsTime(pubDate: string): string {
  try {
    const date = new Date(pubDate);
    if (isNaN(date.getTime())) return '';
    
    // If date is in the future, don't show relative time (RSS parsing error)
    const now = new Date();
    if (date > now) {
      return '';
    }
    
    return formatDistanceToNow(date, { addSuffix: true, locale: es });
  } catch {
    return '';
  }
}

// Get source color based on name
function getSourceColor(source: string): string {
  return SOURCE_CONFIG[source]?.color || 'bg-primary/10 text-primary border-primary/30';
}

interface NewsCardProps {
  item: NewsItem;
}

const NewsCard: React.FC<NewsCardProps> = ({ item }) => {
  const timeAgo = formatNewsTime(item.pubDate);
  
  return (
    <a
      href={item.link}
      target="_blank"
      rel="noopener noreferrer"
      className="block group"
    >
      <div className={cn(
        "p-3 rounded-lg border border-border/50 bg-card/50",
        "hover:bg-card hover:border-primary/30 hover:shadow-sm",
        "transition-all duration-200 active:scale-[0.99]"
      )}>
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            {/* Source and time */}
            <div className="flex items-center gap-2 mb-1.5">
              <Badge 
                variant="outline" 
                className={cn("text-xs px-2 py-0.5", getSourceColor(item.source))}
              >
                {item.source}
              </Badge>
              {timeAgo && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {timeAgo}
                </span>
              )}
            </div>
            
            {/* Title */}
            <h3 className="text-base font-medium text-foreground line-clamp-2 group-hover:text-primary transition-colors leading-snug">
              {item.title}
            </h3>
            
            {/* Description preview */}
            {item.description && (
              <p className="text-sm text-muted-foreground line-clamp-2 mt-1.5 leading-relaxed">
                {item.description}
              </p>
            )}
          </div>
          
          {/* External link icon */}
          <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary flex-shrink-0 mt-0.5 transition-colors" />
        </div>
      </div>
    </a>
  );
};

// Filter out news with future dates (RSS parsing errors)
function isValidNewsDate(pubDate: string): boolean {
  try {
    const date = new Date(pubDate);
    if (isNaN(date.getTime())) return true; // Keep if can't parse
    return date <= new Date();
  } catch {
    return true;
  }
}

const REPORT_CATEGORY_LABELS: Record<string, { label: string; emoji: string }> = {
  'BLOCKADE': { label: 'Bloqueo', emoji: '🚧' },
  'ACCIDENT': { label: 'Accidente', emoji: '🚨' },
  'PROTEST': { label: 'Manifestación', emoji: '📢' },
  'HAZARD': { label: 'Peligro', emoji: '⚠️' },
  'ROAD_REPAIR': { label: 'Obra vial', emoji: '🔧' },
  'HEAVY_TRAFFIC': { label: 'Tráfico pesado', emoji: '🚗' },
  'STOPPED_TRAFFIC': { label: 'Tráfico detenido', emoji: '🛑' },
  'TOLL_CLOSED': { label: 'Caseta cerrada', emoji: '🚫' },
  'TOLL_OPEN': { label: 'Caseta abierta', emoji: '✅' },
  'FOG': { label: 'Neblina', emoji: '🌫️' },
  'HAIL_SNOW': { label: 'Granizo/Nieve', emoji: '🌨️' },
  'OTHER': { label: 'Incidente', emoji: '📍' },
};

interface RoadReportItem {
  id: string;
  category: string;
  severity: number;
  title: string;
  description: string | null;
  created_at: string;
  verification_count: number;
  author_nickname?: string;
  image_url?: string | null;
}

// Emergency alert types for panic/help events
const EMERGENCY_TYPE_LABELS: Record<string, { label: string; emoji: string }> = {
  'AMBULANCIA_PROPIA': { label: 'Ambulancia para mí', emoji: '🚑' },
  'AMBULANCIA_TERCERO': { label: 'Ambulancia Tercero', emoji: '🚑' },
  'PATRULLA': { label: 'Patrulla', emoji: '🚔' },
  'MECANICO': { label: 'Mecánico', emoji: '🔧' },
  'PROTECCION_CIVIL': { label: 'Protección Civil', emoji: '🆘' },
  'BOMBEROS': { label: 'Bomberos', emoji: '🚒' },
  'GRUA': { label: 'Grúa', emoji: '🚚' },
  'SISMO_AYUDA_14': { label: 'Ayuda por Sismo', emoji: '🏚️' },
  'medical': { label: 'Ayuda Médica', emoji: '🏥' },
  'supplies': { label: 'Suministros', emoji: '📦' },
  'transport': { label: 'Transporte', emoji: '🚗' },
  'shelter': { label: 'Refugio', emoji: '🏠' },
  'other': { label: 'Ayuda General', emoji: '🤝' },
};

interface ActiveEmergency {
  id: string;
  type: 'panic' | 'help';
  alertType: string;
  lat: number;
  lng: number;
  message: string | null;
  createdAt: string;
  creatorName: string;
}

const INITIAL_ITEMS_COUNT = 10;
const LOAD_MORE_COUNT = 10;
const MAX_ITEMS_COUNT = 30;

const ReportCard: React.FC<{ report: RoadReportItem }> = ({ report }) => {
  const catInfo = REPORT_CATEGORY_LABELS[report.category] || REPORT_CATEGORY_LABELS['OTHER'];
  const timeAgo = formatNewsTime(report.created_at);

  return (
    <div className={cn(
      "p-3 rounded-lg border border-orange-500/30 bg-orange-500/5",
      "transition-all duration-200"
    )}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
          <span className="text-lg">{catInfo.emoji}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Badge variant="outline" className="text-xs px-2 py-0.5 bg-orange-500/10 text-orange-600 border-orange-500/30">
              {catInfo.label}
            </Badge>
            <span className="text-xs text-muted-foreground">
              Severidad {report.severity}/4
            </span>
            {report.verification_count > 0 && (
              <span className="text-xs text-safe flex items-center gap-0.5">
                <ThumbsUp className="w-3 h-3" /> {report.verification_count}
              </span>
            )}
          </div>
          <h3 className="text-base font-medium text-foreground line-clamp-2 leading-snug">
            {report.title}
          </h3>
          {report.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mt-1 leading-relaxed">
              {report.description}
            </p>
          )}
          {/* Report image */}
          {report.image_url && (
            <div className="mt-2 rounded-md overflow-hidden border border-border/50">
              <img
                src={report.image_url}
                alt={report.title}
                className="w-full h-40 object-cover"
                loading="lazy"
              />
            </div>
          )}
          <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
            {timeAgo && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {timeAgo}
              </span>
            )}
            {report.author_nickname && (
              <span>· por {report.author_nickname}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const BreakingNewsSection: React.FC = () => {
  const { items, loading, error, fetchedAt, refresh } = useBreakingNews();
  const { user } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [visibleCount, setVisibleCount] = useState(INITIAL_ITEMS_COUNT);
  const [roadReports, setRoadReports] = useState<RoadReportItem[]>([]);
  const [activeEmergencies, setActiveEmergencies] = useState<ActiveEmergency[]>([]);

  // Fetch road reports from last 12 hours
  const fetchRoadReports = useCallback(async () => {
    try {
      const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
      const { data, error: fetchError } = await supabase
        .from('road_reports')
        .select('id, category, severity, title, description, created_at, verification_count, user_id')
        .eq('is_active', true)
        .gte('created_at', twelveHoursAgo)
        .order('created_at', { ascending: false })
        .limit(10);

      if (fetchError) {
        console.error('[BreakingNews] Road reports error:', fetchError);
        return;
      }

      if (!data || data.length === 0) {
        setRoadReports([]);
        return;
      }

      const reportIds = data.map(r => r.id);
      const userIds = [...new Set(data.map(r => r.user_id))];

      // Fetch author nicknames and first image per report in parallel
      const [profilesRes, mediaRes] = await Promise.all([
        supabase
          .from('profiles_public')
          .select('user_id, nickname')
          .in('user_id', userIds),
        supabase
          .from('report_media')
          .select('report_id, storage_path')
          .eq('report_type', 'road_report')
          .eq('media_type', 'image')
          .in('report_id', reportIds),
      ]);

      const nicknameMap: Record<string, string> = {};
      profilesRes.data?.forEach(p => { nicknameMap[p.user_id] = p.nickname || 'Usuario'; });

      // Get signed URL for the first image of each report
      const imageMap: Record<string, string> = {};
      if (mediaRes.data && mediaRes.data.length > 0) {
        // Keep only first image per report
        const firstPerReport: Record<string, string> = {};
        mediaRes.data.forEach(m => {
          if (!firstPerReport[m.report_id]) {
            firstPerReport[m.report_id] = m.storage_path;
          }
        });

        const signedUrlPromises = Object.entries(firstPerReport).map(async ([reportId, path]) => {
          const { data: urlData } = await supabase.storage
            .from('reports_media')
            .createSignedUrl(path, 3600);
          if (urlData?.signedUrl) {
            imageMap[reportId] = urlData.signedUrl;
          }
        });
        await Promise.all(signedUrlPromises);
      }

      setRoadReports(data.map(r => ({
        ...r,
        author_nickname: nicknameMap[r.user_id] || 'Usuario',
        image_url: imageMap[r.id] || null,
      })));
    } catch (err) {
      console.error('[BreakingNews] Error fetching road reports:', err);
    }
  }, []);

  // Fetch active emergency alerts (panic events + help requests)
  const fetchActiveEmergencies = useCallback(async () => {
    try {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      
      const [panicRes, helpRes] = await Promise.all([
        supabase
          .from('panic_events')
          .select('id, panic_type, lat, lng, message, created_at, user_id')
          .eq('resolved', false)
          .gte('created_at', twoHoursAgo)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('help_requests')
          .select('id, kind, lat, lng, message, created_at, user_id')
          .eq('resolved', false)
          .gte('created_at', twoHoursAgo)
          .order('created_at', { ascending: false })
          .limit(5),
      ]);

      const userIds = new Set<string>();
      panicRes.data?.forEach(e => userIds.add(e.user_id));
      helpRes.data?.forEach(r => userIds.add(r.user_id));

      let profilesMap: Record<string, string> = {};
      if (userIds.size > 0) {
        const { data: profiles } = await supabase
          .from('profiles_public')
          .select('user_id, nickname')
          .in('user_id', Array.from(userIds));
        profiles?.forEach(p => { profilesMap[p.user_id] = p.nickname || 'Usuario'; });
      }

      const emergencies: ActiveEmergency[] = [];

      panicRes.data?.forEach(e => {
        if (e.user_id === user?.id) return;
        emergencies.push({
          id: e.id,
          type: 'panic',
          alertType: e.panic_type,
          lat: e.lat,
          lng: e.lng,
          message: e.message,
          createdAt: e.created_at!,
          creatorName: profilesMap[e.user_id] || 'Usuario',
        });
      });

      helpRes.data?.forEach(r => {
        if (r.user_id === user?.id) return;
        emergencies.push({
          id: r.id,
          type: 'help',
          alertType: r.kind,
          lat: r.lat,
          lng: r.lng,
          message: r.message,
          createdAt: r.created_at!,
          creatorName: profilesMap[r.user_id] || 'Usuario',
        });
      });

      emergencies.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setActiveEmergencies(emergencies);
    } catch (err) {
      console.error('[BreakingNews] Error fetching emergencies:', err);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchRoadReports();
    fetchActiveEmergencies();
    const interval = setInterval(() => {
      fetchRoadReports();
      fetchActiveEmergencies();
    }, 60 * 1000); // Refresh every minute for emergencies
    return () => clearInterval(interval);
  }, [fetchRoadReports, fetchActiveEmergencies]);

  // Subscribe to realtime emergency updates
  useEffect(() => {
    const channel = supabase
      .channel('breaking-news-emergencies')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'panic_events' }, () => {
        fetchActiveEmergencies();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'help_requests' }, () => {
        fetchActiveEmergencies();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchActiveEmergencies]);
  
  // Get all valid items (filtered by date only)
  const allValidItems = useMemo(() => {
    return items.filter(item => isValidNewsDate(item.pubDate));
  }, [items]);

  // Calculate counts per category
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: Math.min(allValidItems.length, MAX_ITEMS_COUNT),
      seguridad: 0,
      nacionales: 0,
      internacionales: 0,
      deportes: 0,
      emergencias: 0,
    };
    
    allValidItems.forEach(item => {
      const sourceConfig = SOURCE_CONFIG[item.source];
      if (sourceConfig?.category) {
        counts[sourceConfig.category]++;
      }
      // Also count emergency news by keywords
      if (isEmergencyNews(item)) {
        if (sourceConfig?.category !== 'emergencias') {
          counts.emergencias++;
        }
      }
      // Also count security news by keywords
      if (isSecurityNews(item)) {
        if (sourceConfig?.category !== 'seguridad') {
          counts.seguridad++;
        }
      }
    });
    
    // Cap each count to MAX_ITEMS_COUNT
    Object.keys(counts).forEach(key => {
      counts[key] = Math.min(counts[key], MAX_ITEMS_COUNT);
    });
    
    return counts;
  }, [allValidItems]);

  // Filter items by selected category
  const validItems = useMemo(() => {
    return allValidItems
      .filter(item => {
        if (selectedCategory === 'all') return true;
        
        // For emergencies, check both source AND content keywords
        if (selectedCategory === 'emergencias') {
          const sourceConfig = SOURCE_CONFIG[item.source];
          const isEmergencySource = sourceConfig?.category === 'emergencias';
          return isEmergencySource || isEmergencyNews(item);
        }

        // For security, check both source AND content keywords
        if (selectedCategory === 'seguridad') {
          const sourceConfig = SOURCE_CONFIG[item.source];
          const isSecuritySource = sourceConfig?.category === 'seguridad';
          return isSecuritySource || isSecurityNews(item);
        }
        
        const sourceConfig = SOURCE_CONFIG[item.source];
        return sourceConfig?.category === selectedCategory;
      })
      .slice(0, MAX_ITEMS_COUNT); // Limit to max 30 items
  }, [allValidItems, selectedCategory]);

  // Reset visible count when category changes
  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    setVisibleCount(INITIAL_ITEMS_COUNT);
  };

  const visibleItems = validItems.slice(0, visibleCount);
  const hasMore = visibleCount < validItems.length;
  const remainingCount = validItems.length - visibleCount;

  const loadMore = () => {
    setVisibleCount(prev => prev + LOAD_MORE_COUNT);
  };

  const categories = ['all', 'seguridad', 'nacionales', 'internacionales', 'deportes', 'emergencias'];

  return (
    <Card className="bg-card/80 backdrop-blur-sm border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="p-1.5 rounded-full bg-destructive/10">
              <Newspaper className="w-4 h-4 text-destructive" />
            </div>
            Últimas Noticias
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={refresh}
            disabled={loading}
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </Button>
        </div>
        {fetchedAt && (
          <p className="text-[10px] text-muted-foreground mt-1">
            Actualizado {formatNewsTime(fetchedAt)}
          </p>
        )}
        
        {/* Category filter */}
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          <Filter className="w-3 h-3 text-muted-foreground" />
          {categories.map(category => {
            const count = categoryCounts[category] || 0;
            return (
              <Button
                key={category}
                variant={selectedCategory === category ? 'default' : 'outline'}
                size="sm"
                className="h-6 text-[10px] px-2 gap-1"
                onClick={() => handleCategoryChange(category)}
              >
                {CATEGORY_LABELS[category]}
                <span className={cn(
                  "text-[9px] px-1 py-0.5 rounded-full min-w-[16px] text-center",
                  selectedCategory === category 
                    ? "bg-primary-foreground/20 text-primary-foreground" 
                    : "bg-muted text-muted-foreground"
                )}>
                  {count}
                </span>
              </Button>
            );
          })}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-2">
        {/* Live streaming links */}
        {[
          { href: 'https://www.youtube.com/live/rvtygG4n6ew?si=6IWLvNa5CZNF6liG', label: 'LIVE Earthquake Monitor' },
          { href: 'https://www.youtube.com/live/p2AzyIEuFak?si=L9WTy72PmRc9YTai', label: 'N+ Streaming en vivo' },
          { href: 'https://www.youtube.com/MILENIO/live/1000', label: 'Milenio Noticias en vivo' },
        ].map((stream) => (
          <a
            key={stream.label}
            href={stream.href}
            target="_blank"
            rel="noopener noreferrer"
            className="block group"
          >
            <div className={cn(
              "p-3 rounded-lg border-2 border-red-500/50 bg-gradient-to-r from-red-500/10 to-orange-500/10",
              "hover:border-red-500 hover:shadow-md",
              "transition-all duration-200 active:scale-[0.99]"
            )}>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-red-500/20 animate-pulse">
                  <Radio className="w-5 h-5 text-red-500" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-red-500 uppercase tracking-wide">EN VIVO</span>
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  </div>
                  <h3 className="text-base font-bold text-foreground group-hover:text-red-500 transition-colors">
                    {stream.label}
                  </h3>
                </div>
                <ExternalLink className="w-5 h-5 text-red-500/70 group-hover:text-red-500 transition-colors" />
              </div>
            </div>
          </a>
        ))}

        {/* Active Emergency Alerts */}
        {activeEmergencies.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 pt-1">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-destructive" />
              </span>
              <span className="text-sm font-bold text-destructive uppercase tracking-wide">
                {activeEmergencies.length === 1 ? 'Emergencia Activa' : `${activeEmergencies.length} Emergencias Activas`}
              </span>
            </div>
            {activeEmergencies.map(emergency => {
              const typeInfo = EMERGENCY_TYPE_LABELS[emergency.alertType] || { label: 'Emergencia', emoji: '🆘' };
              const timeAgo = formatNewsTime(emergency.createdAt);
              return (
                <div
                  key={emergency.id}
                  className={cn(
                    "p-3 rounded-lg border-2 shadow-sm",
                    emergency.type === 'panic'
                      ? "border-destructive bg-destructive/10"
                      : "border-orange-500 bg-orange-500/10"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center",
                      emergency.type === 'panic' ? "bg-destructive/20" : "bg-orange-500/20"
                    )}>
                      <span className="text-lg">{typeInfo.emoji}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Badge variant="outline" className={cn(
                          "text-xs px-2 py-0.5",
                          emergency.type === 'panic'
                            ? "bg-destructive/10 text-destructive border-destructive/30"
                            : "bg-orange-500/10 text-orange-600 border-orange-500/30"
                        )}>
                          {emergency.type === 'panic' ? '🚨 ALERTA SOS' : '🆘 AYUDA'}
                        </Badge>
                        {timeAgo && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {timeAgo}
                          </span>
                        )}
                      </div>
                      <h3 className="text-base font-semibold text-foreground">
                        {typeInfo.label}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        por <span className="font-medium text-foreground">{emergency.creatorName}</span>
                      </p>
                      {emergency.message && (
                        <p className="text-sm text-muted-foreground italic mt-1 line-clamp-2">
                          "{emergency.message}"
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs gap-1"
                          onClick={() => window.open(`https://www.google.com/maps?q=${emergency.lat},${emergency.lng}`, '_blank')}
                        >
                          <MapPin className="w-3 h-3" />
                          Ver ubicación
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs gap-1"
                          onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${emergency.lat},${emergency.lng}&travelmode=driving`, '_blank')}
                        >
                          <Navigation className="w-3 h-3" />
                          Cómo llegar
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}


        {roadReports.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 pt-1">
              <AlertTriangle className="w-4 h-4 text-orange-500" />
              <span className="text-sm font-semibold text-foreground">
                Reportes de Usuarios ({roadReports.length})
              </span>
              <span className="text-[10px] text-muted-foreground">últimas 12h</span>
            </div>
            {roadReports.map(report => (
              <ReportCard key={report.id} report={report} />
            ))}
          </div>
        )}

        {loading && validItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin mb-2" />
            <p className="text-sm">Cargando noticias...</p>
          </div>
        ) : error && validItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <AlertCircle className="w-8 h-8 mb-2 text-destructive/50" />
            <p className="text-sm">Error al cargar noticias</p>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-2"
              onClick={refresh}
            >
              Reintentar
            </Button>
          </div>
        ) : validItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Newspaper className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-sm">Sin noticias en esta región</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {visibleItems.map((item, index) => (
                <NewsCard key={`${item.link}-${index}`} item={item} />
              ))}
            </div>
            
            {/* Load more button */}
            {hasMore && (
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-3"
                onClick={loadMore}
              >
                <Loader2 className="w-3 h-3 mr-2" />
                Ver más noticias ({remainingCount} restantes)
              </Button>
            )}
          </>
        )}
        
        {/* Sources info */}
        <div className="pt-2 border-t border-border/50">
          <p className="text-[10px] text-muted-foreground text-center">
            Fuentes: Milenio, El Universal, CNN, BBC, Reuters, ESPN, TyC Sports, Fox Sports, Olé, CENAPRED
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default BreakingNewsSection;
