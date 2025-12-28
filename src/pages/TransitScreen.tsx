// Transit Screen for COMUNIDAD EX SOS
// Road + Flight transit tracking with incident reports

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Car, Plane, AlertTriangle, Plus, MapPin, Clock, Loader2, ThumbsUp, Download, FileText, Navigation, Pencil, Trash2, MoreVertical, History, Filter, Calendar, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MediaCapture } from '@/components/MediaCapture';
import { VoiceRecorder } from '@/components/VoiceRecorder';
import { useLocation, getGoogleMapsLink } from '@/hooks/useLocation';
import { useRoadReports } from '@/hooks/useRealtime';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { TransitType, ReportCategory, ReportSeverity, UserRole } from '@/types';
import { cn } from '@/lib/utils';

const REPORT_CATEGORIES: { value: ReportCategory; label: string; emoji: string }[] = [
  { value: 'BLOCKADE', label: 'Bloqueo', emoji: '🚧' },
  { value: 'ACCIDENT', label: 'Accidente', emoji: '🚨' },
  { value: 'PROTEST', label: 'Manifestación', emoji: '✊' },
  { value: 'HAZARD', label: 'Peligro', emoji: '⚠️' },
  { value: 'OTHER', label: 'Otro', emoji: '📍' },
];

interface TransitScreenProps {
  userRole?: UserRole;
}

interface TransitTrip {
  id: string;
  user_id: string;
  transit_type: TransitType;
  origin: string;
  destination: string;
  eta: string;
  status: string;
  plates: string | null;
  companions: string | null;
  vehicle_type: string | null;
  airline: string | null;
  flight_number: string | null;
  departure_airport: string | null;
  arrival_airport: string | null;
  created_at: string;
  arrived_at: string | null;
}

export const TransitScreen: React.FC<TransitScreenProps> = ({
  userRole = 'RESCATISTA'
}) => {
  const [activeTab, setActiveTab] = useState<'trips' | 'reports' | 'history'>('trips');
  const [showTripDialog, setShowTripDialog] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [transitType, setTransitType] = useState<TransitType>('ROAD');
  const [submitting, setSubmitting] = useState(false);
  const [myTrips, setMyTrips] = useState<TransitTrip[]>([]);
  const [loadingTrips, setLoadingTrips] = useState(true);
  
  // History filters
  const [historyStatusFilter, setHistoryStatusFilter] = useState<'ALL' | 'COMPLETED' | 'CANCELLED'>('ALL');
  const [historyDateFilter, setHistoryDateFilter] = useState<'ALL' | 'WEEK' | 'MONTH' | 'YEAR'>('ALL');
  
  // Trip form state
  const [tripForm, setTripForm] = useState({
    plates: '',
    companions: '',
    origin: '',
    destination: '',
    vehicleType: '',
    airline: '',
    flightNumber: '',
    departureAirport: '',
    arrivalAirport: '',
    departureTime: '',
    arrivalTime: '',
    eta: '',
    // Destination coordinates (optional, for route display)
    destinationLat: null as number | null,
    destinationLng: null as number | null,
  });
  
  // Optional photo uploads for trips
  const [vehiclePhoto, setVehiclePhoto] = useState<File[]>([]);
  const [boardingPassPhoto, setBoardingPassPhoto] = useState<File[]>([]);

  // Report form state
  const [reportForm, setReportForm] = useState({
    category: '' as ReportCategory | '',
    severity: 2 as ReportSeverity,
    title: '',
    description: '',
  });
  const [reportImages, setReportImages] = useState<File[]>([]);
  const [reportAudio, setReportAudio] = useState<{ blob: Blob; duration: number } | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [editingReport, setEditingReport] = useState<string | null>(null);
  const [deletingReport, setDeletingReport] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  // ETA update state
  const [editingEtaTripId, setEditingEtaTripId] = useState<string | null>(null);
  const [newEta, setNewEta] = useState<string>('');
  const [updatingEta, setUpdatingEta] = useState(false);

  const { position } = useLocation();
  const { reports, refetch: refetchReports } = useRoadReports();

  // Get current user ID
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id || null);
    });
  }, []);

  // Fetch user's trips
  const fetchMyTrips = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('transit_trips')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMyTrips(data as TransitTrip[]);
    } catch (error) {
      console.error('Error fetching trips:', error);
    } finally {
      setLoadingTrips(false);
    }
  };

  // Load trips on mount + keep in sync across devices
  useEffect(() => {
    fetchMyTrips();

    if (!currentUserId) return;

    const channel = supabase
      .channel('transit_trips_my_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transit_trips' },
        (payload) => {
          const changedUserId =
            (payload.new as { user_id?: string } | null)?.user_id ??
            (payload.old as { user_id?: string } | null)?.user_id;

          if (changedUserId === currentUserId) {
            console.log('[TransitScreen] transit_trips changed for current user; refetching');
            fetchMyTrips();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  // Handle report verification (upvote)
  const handleVerifyReport = async (reportId: string) => {
    setVerifyingId(reportId);
    try {
      const { data, error } = await supabase.rpc('verify_report', { report_id: reportId });
      
      if (error) throw error;
      
      if (data) {
        toast.success('¡Reporte verificado!');
        refetchReports();
      } else {
        toast.info('Ya verificaste este reporte');
      }
    } catch (error) {
      console.error('Error verifying report:', error);
      toast.error('Error al verificar');
    } finally {
      setVerifyingId(null);
    }
  };

  // Handle report deletion
  const handleDeleteReport = async (reportId: string) => {
    setDeletingReport(reportId);
    try {
      const { error } = await supabase
        .from('road_reports')
        .update({ is_active: false })
        .eq('id', reportId);

      if (error) throw error;

      toast.success('Reporte eliminado');
      refetchReports();
    } catch (error) {
      console.error('Error deleting report:', error);
      toast.error('Error al eliminar reporte');
    } finally {
      setDeletingReport(null);
    }
  };

  // Handle report edit
  const handleEditReport = (report: typeof reports[0]) => {
    setReportForm({
      category: report.category as ReportCategory,
      severity: report.severity as ReportSeverity,
      title: report.title,
      description: report.description || '',
    });
    setEditingReport(report.id);
    setShowReportDialog(true);
  };

  // Handle report update
  const handleUpdateReport = async () => {
    if (!editingReport) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('road_reports')
        .update({
          category: reportForm.category,
          severity: reportForm.severity,
          title: reportForm.title,
          description: reportForm.description || null,
        })
        .eq('id', editingReport);

      if (error) throw error;

      toast.success('Reporte actualizado');
      setShowReportDialog(false);
      setEditingReport(null);
      resetReportForm();
      refetchReports();
    } catch (error) {
      console.error('Error updating report:', error);
      toast.error('Error al actualizar reporte');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle trip submission
  const handleTripSubmit = async () => {
    if (!position) {
      toast.error('Se requiere ubicación GPS');
      return;
    }

    if (!tripForm.eta) {
      toast.error('Se requiere hora de llegada estimada');
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No autenticado');

      let vehiclePhotoUrl: string | null = null;
      let boardingPassUrl: string | null = null;

      // Upload vehicle photo if provided (for road trips)
      if (transitType === 'ROAD' && vehiclePhoto.length > 0) {
        const photo = vehiclePhoto[0];
        const fileName = `vehicle_${user.id}_${Date.now()}_${photo.name}`;
        const filePath = `transit-photos/${fileName}`;
        
        const { error: uploadError } = await supabase.storage
          .from('reports_media')
          .upload(filePath, photo, {
            contentType: photo.type,
            upsert: false,
          });

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from('reports_media')
            .getPublicUrl(filePath);
          vehiclePhotoUrl = urlData?.publicUrl || null;
        }
      }

      // Upload boarding pass photo if provided (for flights)
      if (transitType === 'FLIGHT' && boardingPassPhoto.length > 0) {
        const photo = boardingPassPhoto[0];
        const fileName = `boarding_${user.id}_${Date.now()}_${photo.name}`;
        const filePath = `transit-photos/${fileName}`;
        
        const { error: uploadError } = await supabase.storage
          .from('reports_media')
          .upload(filePath, photo, {
            contentType: photo.type,
            upsert: false,
          });

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from('reports_media')
            .getPublicUrl(filePath);
          boardingPassUrl = urlData?.publicUrl || null;
        }
      }

      const tripData = {
        user_id: user.id,
        transit_type: transitType,
        origin: transitType === 'ROAD' ? tripForm.origin : tripForm.departureAirport,
        destination: transitType === 'ROAD' ? tripForm.destination : tripForm.arrivalAirport,
        eta: new Date(tripForm.eta).toISOString(),
        status: 'ACTIVE',
        plates: transitType === 'ROAD' ? tripForm.plates : null,
        companions: tripForm.companions || null,
        vehicle_type: transitType === 'ROAD' ? tripForm.vehicleType : null,
        airline: transitType === 'FLIGHT' ? tripForm.airline : null,
        flight_number: transitType === 'FLIGHT' ? tripForm.flightNumber : null,
        departure_airport: transitType === 'FLIGHT' ? tripForm.departureAirport : null,
        arrival_airport: transitType === 'FLIGHT' ? tripForm.arrivalAirport : null,
        // Store current location as origin coordinates
        origin_lat: position.lat,
        origin_lng: position.lng,
        // Store destination coordinates if provided
        destination_lat: tripForm.destinationLat,
        destination_lng: tripForm.destinationLng,
        // Optional photos
        vehicle_photo_url: vehiclePhotoUrl,
        boarding_pass_url: boardingPassUrl,
      };

      const { error } = await supabase.from('transit_trips').insert(tripData);
      if (error) throw error;

      toast.success('¡Viaje registrado! Tu ubicación será visible en el mapa.');
      setShowTripDialog(false);
      resetTripForm();
      fetchMyTrips(); // Refresh trips list
    } catch (error) {
      console.error('Error submitting trip:', error);
      toast.error('Error al registrar viaje');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle report submission
  const handleReportSubmit = async () => {
    if (!position) {
      toast.error('Se requiere ubicación GPS');
      return;
    }

    if (!reportForm.category || !reportForm.title) {
      toast.error('Completa los campos requeridos');
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No autenticado');

      // Insert road report into database
      const { data: reportData, error: reportError } = await supabase
        .from('road_reports')
        .insert({
          user_id: user.id,
          category: reportForm.category,
          severity: reportForm.severity,
          title: reportForm.title,
          description: reportForm.description || null,
          lat: position.lat,
          lng: position.lng,
          is_active: true,
        })
        .select()
        .single();

      if (reportError) throw reportError;

      console.log('[TransitScreen] Report created:', reportData.id);

      // Upload images if any
      if (reportImages.length > 0 && reportData) {
        for (const image of reportImages) {
          const fileName = `report_${reportData.id}_${Date.now()}_${image.name}`;
          const filePath = `road-reports/${fileName}`;
          
          const { error: uploadError } = await supabase.storage
            .from('reports_media')
            .upload(filePath, image, {
              contentType: image.type,
              upsert: false,
            });

          if (!uploadError) {
            await supabase.from('report_media').insert({
              report_id: reportData.id,
              report_type: 'road_report',
              media_type: 'image',
              mime_type: image.type,
              storage_path: filePath,
            });
          }
        }
      }

      // Upload audio if present
      if (reportAudio && reportData) {
        const mimeType = reportAudio.blob.type || 'audio/webm';
        const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('ogg') ? 'ogg' : 'webm';
        const fileName = `report_${reportData.id}_${Date.now()}.${ext}`;
        const filePath = `road-reports/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('reports_media')
          .upload(filePath, reportAudio.blob, {
            contentType: mimeType,
            upsert: false,
          });

        if (!uploadError) {
          await supabase.from('report_media').insert({
            report_id: reportData.id,
            report_type: 'road_report',
            media_type: 'audio',
            mime_type: mimeType,
            storage_path: filePath,
            duration_ms: reportAudio.duration,
          });
        }
      }

      // Notify nearby users about the new report
      try {
        await supabase.functions.invoke('notify-nearby-report', {
          body: {
            reportId: reportData.id,
            lat: position.lat,
            lng: position.lng,
            title: reportForm.title,
            category: reportForm.category,
            creatorId: user.id,
            radiusMeters: 5000, // 5km radius
          },
        });
        console.log('[TransitScreen] Nearby users notified');
      } catch (notifyError) {
        console.error('[TransitScreen] Error notifying nearby users:', notifyError);
        // Don't fail the report submission if notification fails
      }

      toast.success('¡Reporte enviado!', {
        description: 'Gracias por ayudar a la comunidad',
      });
      setShowReportDialog(false);
      resetReportForm();
      refetchReports(); // Refresh reports list
    } catch (error) {
      console.error('Error submitting report:', error);
      toast.error('Error al enviar reporte');
    } finally {
      setSubmitting(false);
    }
  };

  const resetTripForm = () => {
    setTripForm({
      plates: '',
      companions: '',
      origin: '',
      destination: '',
      vehicleType: '',
      airline: '',
      flightNumber: '',
      departureAirport: '',
      arrivalAirport: '',
      departureTime: '',
      arrivalTime: '',
      eta: '',
      destinationLat: null,
      destinationLng: null,
    });
    setTransitType('ROAD');
    setVehiclePhoto([]);
    setBoardingPassPhoto([]);
  };

  const resetReportForm = () => {
    setReportForm({
      category: '',
      severity: 2,
      title: '',
      description: '',
    });
    setReportImages([]);
    setReportAudio(null);
  };

  const getSeverityLabel = (severity: ReportSeverity) => {
    const labels: Record<ReportSeverity, string> = {
      1: 'Bajo',
      2: 'Medio',
      3: 'Alto',
      4: 'Crítico',
    };
    return labels[severity];
  };

  const getSeverityColor = (severity: ReportSeverity) => {
    const colors: Record<ReportSeverity, string> = {
      1: 'bg-safe',
      2: 'bg-warning',
      3: 'bg-panic',
      4: 'bg-destructive',
    };
    return colors[severity];
  };

  return (
    <div className="flex-1 overflow-auto pb-20 scrollbar-thin">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-foreground">Tránsito Seguro</h1>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowReportDialog(true)}
            >
              <AlertTriangle className="w-4 h-4 mr-1" />
              Reportar
            </Button>
            <Button
              size="sm"
              onClick={() => setShowTripDialog(true)}
            >
              <Plus className="w-4 h-4 mr-1" />
              Nuevo
            </Button>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'trips' | 'reports' | 'history')} className="p-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="trips">Activos</TabsTrigger>
          <TabsTrigger value="history" className="gap-1">
            <History className="w-3.5 h-3.5" />
            Historial
          </TabsTrigger>
          <TabsTrigger value="reports">Reportes</TabsTrigger>
        </TabsList>

        {/* Active Trips Tab */}
        <TabsContent value="trips" className="space-y-3 mt-4">
          {loadingTrips ? (
            <div className="text-center py-12 text-muted-foreground">
              <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin" />
              <p>Cargando viajes...</p>
            </div>
          ) : myTrips.filter(t => t.status === 'ACTIVE').length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Car className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No hay viajes activos</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setShowTripDialog(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Registrar viaje
              </Button>
            </div>
          ) : (
            myTrips.filter(t => t.status === 'ACTIVE').map((trip) => {
              const isActive = trip.status === 'ACTIVE';
              const etaDate = new Date(trip.eta);
              const isOverdue = isActive && etaDate < new Date();
              
              return (
                <Card key={trip.id} className={cn(
                  "bg-card border-border",
                  isOverdue && "border-destructive/50"
                )}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        'w-10 h-10 rounded-lg flex items-center justify-center',
                        isActive ? (isOverdue ? 'bg-destructive' : 'bg-primary') : 'bg-muted',
                        'text-white'
                      )}>
                        {trip.transit_type === 'ROAD' ? (
                          <Car className="w-5 h-5" />
                        ) : (
                          <Plane className="w-5 h-5" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-foreground">
                            {trip.origin} → {trip.destination}
                          </h3>
                          {isOverdue && (
                            <span className="text-xs bg-destructive/20 text-destructive px-2 py-0.5 rounded">
                              ATRASADO
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          <span>ETA: {etaDate.toLocaleString('es-MX', { 
                            day: 'numeric', 
                            month: 'short', 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}</span>
                          {isActive && (
                            <button
                              onClick={() => {
                                // Set default to current ETA + 30 min
                                const newTime = new Date(trip.eta);
                                newTime.setMinutes(newTime.getMinutes() + 30);
                                const localDateTime = new Date(newTime.getTime() - newTime.getTimezoneOffset() * 60000)
                                  .toISOString()
                                  .slice(0, 16);
                                setNewEta(localDateTime);
                                setEditingEtaTripId(trip.id);
                              }}
                              className="text-primary hover:underline"
                            >
                              (cambiar)
                            </button>
                          )}
                          {trip.plates && (
                            <>
                              <span>•</span>
                              <span>🚗 {trip.plates}</span>
                            </>
                          )}
                          {trip.companions && (
                            <>
                              <span>•</span>
                              <span>👥 {trip.companions}</span>
                            </>
                          )}
                        </div>
                        {trip.flight_number && (
                          <div className="text-xs text-muted-foreground mt-1">
                            ✈️ {trip.airline} {trip.flight_number}
                          </div>
                        )}
                        <div className="flex gap-2 mt-3">
                          {isActive && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs"
                              onClick={async () => {
                                try {
                                  // Update trip status
                                  await supabase
                                    .from('transit_trips')
                                    .update({ 
                                      status: 'COMPLETED', 
                                      arrived_at: new Date().toISOString() 
                                    })
                                    .eq('id', trip.id);
                                  
                                  // Notify emergency contacts
                                  try {
                                    await supabase.functions.invoke('notify-trip-update', {
                                      body: {
                                        tripId: trip.id,
                                        tripUserId: trip.user_id,
                                        eventType: 'arrived',
                                        origin: trip.origin,
                                        destination: trip.destination,
                                      }
                                    });
                                  } catch (notifyError) {
                                    console.error('Error notifying contacts:', notifyError);
                                  }
                                  
                                  toast.success('¡Viaje completado! Tus contactos fueron notificados.');
                                  fetchMyTrips();
                                } catch (e) {
                                  toast.error('Error al completar viaje');
                                }
                              }}
                            >
                              ✓ Llegué
                            </Button>
                          )}
                          {isActive && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-xs text-muted-foreground"
                              onClick={async () => {
                                try {
                                  // Update trip status
                                  await supabase
                                    .from('transit_trips')
                                    .update({ status: 'CANCELLED' })
                                    .eq('id', trip.id);
                                  
                                  // Notify contacts about cancellation
                                  try {
                                    await supabase.functions.invoke('notify-trip-update', {
                                      body: {
                                        tripId: trip.id,
                                        tripUserId: trip.user_id,
                                        eventType: 'cancelled',
                                        origin: trip.origin,
                                        destination: trip.destination,
                                      }
                                    });
                                  } catch (notifyError) {
                                    console.error('Error notifying contacts:', notifyError);
                                  }
                                  
                                  toast.success('Viaje cancelado');
                                  fetchMyTrips();
                                } catch (e) {
                                  toast.error('Error al cancelar');
                                }
                              }}
                            >
                              Cancelar
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs text-destructive hover:text-destructive hover:bg-destructive/10 ml-auto"
                            onClick={async () => {
                              if (!confirm('¿Eliminar este viaje permanentemente?')) return;
                              try {
                                await supabase
                                  .from('transit_trips')
                                  .delete()
                                  .eq('id', trip.id);
                                toast.success('Viaje eliminado');
                                fetchMyTrips();
                              } catch (e) {
                                toast.error('Error al eliminar viaje');
                              }
                            }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-3 mt-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-2 pb-2 border-b border-border">
            <Select value={historyStatusFilter} onValueChange={(v) => setHistoryStatusFilter(v as 'ALL' | 'COMPLETED' | 'CANCELLED')}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <Filter className="w-3 h-3 mr-1" />
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos</SelectItem>
                <SelectItem value="COMPLETED">Completados</SelectItem>
                <SelectItem value="CANCELLED">Cancelados</SelectItem>
              </SelectContent>
            </Select>
            <Select value={historyDateFilter} onValueChange={(v) => setHistoryDateFilter(v as 'ALL' | 'WEEK' | 'MONTH' | 'YEAR')}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <Calendar className="w-3 h-3 mr-1" />
                <SelectValue placeholder="Fecha" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todo el tiempo</SelectItem>
                <SelectItem value="WEEK">Última semana</SelectItem>
                <SelectItem value="MONTH">Último mes</SelectItem>
                <SelectItem value="YEAR">Último año</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(() => {
            const now = new Date();
            const filteredHistory = myTrips.filter(trip => {
              // Filter by status
              if (trip.status === 'ACTIVE') return false;
              if (historyStatusFilter !== 'ALL' && trip.status !== historyStatusFilter) return false;
              
              // Filter by date
              if (historyDateFilter !== 'ALL') {
                const tripDate = new Date(trip.arrived_at || trip.created_at);
                const diffDays = (now.getTime() - tripDate.getTime()) / (1000 * 60 * 60 * 24);
                if (historyDateFilter === 'WEEK' && diffDays > 7) return false;
                if (historyDateFilter === 'MONTH' && diffDays > 30) return false;
                if (historyDateFilter === 'YEAR' && diffDays > 365) return false;
              }
              
              return true;
            });

            if (loadingTrips) {
              return (
                <div className="text-center py-12 text-muted-foreground">
                  <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin" />
                  <p>Cargando historial...</p>
                </div>
              );
            }

            if (filteredHistory.length === 0) {
              return (
                <div className="text-center py-12 text-muted-foreground">
                  <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No hay viajes en el historial</p>
                  <p className="text-xs mt-1">Los viajes completados o cancelados aparecerán aquí</p>
                </div>
              );
            }

            return filteredHistory.map((trip) => {
              const isCompleted = trip.status === 'COMPLETED';
              const tripDate = new Date(trip.arrived_at || trip.created_at);
              
              return (
                <Card key={trip.id} className="bg-card border-border">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        'w-10 h-10 rounded-lg flex items-center justify-center',
                        isCompleted ? 'bg-safe' : 'bg-muted',
                        'text-white'
                      )}>
                        {isCompleted ? (
                          <CheckCircle className="w-5 h-5" />
                        ) : (
                          <XCircle className="w-5 h-5" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-foreground">
                            {trip.origin} → {trip.destination}
                          </h3>
                          <span className={cn(
                            "text-xs px-2 py-0.5 rounded",
                            isCompleted ? "bg-safe/20 text-safe" : "bg-muted text-muted-foreground"
                          )}>
                            {isCompleted ? 'COMPLETADO' : 'CANCELADO'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          {trip.transit_type === 'ROAD' ? (
                            <Car className="w-3 h-3" />
                          ) : (
                            <Plane className="w-3 h-3" />
                          )}
                          <span>{tripDate.toLocaleDateString('es-MX', { 
                            day: 'numeric', 
                            month: 'short',
                            year: 'numeric'
                          })}</span>
                          {trip.plates && (
                            <>
                              <span>•</span>
                              <span>🚗 {trip.plates}</span>
                            </>
                          )}
                          {trip.flight_number && (
                            <>
                              <span>•</span>
                              <span>✈️ {trip.flight_number}</span>
                            </>
                          )}
                        </div>
                        <div className="flex justify-end mt-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={async () => {
                              if (!confirm('¿Eliminar este viaje del historial?')) return;
                              try {
                                await supabase
                                  .from('transit_trips')
                                  .delete()
                                  .eq('id', trip.id);
                                toast.success('Viaje eliminado');
                                fetchMyTrips();
                              } catch (e) {
                                toast.error('Error al eliminar viaje');
                              }
                            }}
                          >
                            <Trash2 className="w-3 h-3 mr-1" />
                            Eliminar
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            });
          })()}
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports" className="space-y-3 mt-4">
          {reports.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No hay reportes recientes</p>
            </div>
          ) : (
            reports.map((report) => {
              const category = REPORT_CATEGORIES.find(c => c.value === report.category);
              const verificationCount = (report as unknown as { verification_count?: number }).verification_count || 0;
              const isOwner = currentUserId && report.user_id === currentUserId;
              
              return (
                <Card key={report.id} className={cn(
                  "bg-card border-border",
                  isOwner && "border-primary/30"
                )}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        'w-10 h-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0',
                        getSeverityColor(report.severity as ReportSeverity),
                        'text-white'
                      )}>
                        {category?.emoji || '📍'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-medium text-foreground">{report.title}</h3>
                          {isOwner && (
                            <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded flex-shrink-0">
                              MI REPORTE
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                          <span>{category?.label}</span>
                          <span>•</span>
                          <span>Severidad {report.severity}/4</span>
                          {verificationCount > 0 && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-1 text-safe">
                                <ThumbsUp className="w-3 h-3" />
                                {verificationCount}
                              </span>
                            </>
                          )}
                        </div>
                        {report.description && (
                          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                            {report.description}
                          </p>
                        )}
                        <div className="flex items-center justify-between mt-3 gap-2">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            {new Date(report.created_at).toLocaleString('es-MX', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                          <div className="flex items-center gap-1">
                            {isOwner && (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0"
                                  onClick={() => handleEditReport(report)}
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                  onClick={() => handleDeleteReport(report.id)}
                                  disabled={deletingReport === report.id}
                                >
                                  {deletingReport === report.id ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Trash2 className="w-3.5 h-3.5" />
                                  )}
                                </Button>
                              </>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => handleVerifyReport(report.id)}
                              disabled={verifyingId === report.id}
                            >
                              {verifyingId === report.id ? (
                                <Loader2 className="w-3 h-3 animate-spin mr-1" />
                              ) : (
                                <ThumbsUp className="w-3 h-3 mr-1" />
                              )}
                              Verificar
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>
      </Tabs>

      {/* New Trip Dialog */}
      <Dialog open={showTripDialog} onOpenChange={setShowTripDialog}>
        <DialogContent className="sm:max-w-md bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registrar Viaje</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Transit Type Selector */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={transitType === 'ROAD' ? 'default' : 'outline'}
                onClick={() => setTransitType('ROAD')}
                className="h-16"
              >
                <Car className="w-6 h-6 mr-2" />
                Carretera
              </Button>
              <Button
                variant={transitType === 'FLIGHT' ? 'default' : 'outline'}
                onClick={() => setTransitType('FLIGHT')}
                className="h-16"
              >
                <Plane className="w-6 h-6 mr-2" />
                Vuelo
              </Button>
            </div>

            {transitType === 'ROAD' ? (
              <>
                <div>
                  <Label>Placas del vehículo</Label>
                  <Input
                    value={tripForm.plates}
                    onChange={(e) => setTripForm({ ...tripForm, plates: e.target.value })}
                    placeholder="ABC-123"
                  />
                </div>
                <div>
                  <Label>Acompañantes</Label>
                  <Input
                    value={tripForm.companions}
                    onChange={(e) => setTripForm({ ...tripForm, companions: e.target.value })}
                    placeholder="Juan, María..."
                  />
                </div>
                <div>
                  <Label>Origen</Label>
                  <Input
                    value={tripForm.origin}
                    onChange={(e) => setTripForm({ ...tripForm, origin: e.target.value })}
                    placeholder="Ciudad de México"
                  />
                </div>
                <div>
                  <Label>Destino</Label>
                  <Input
                    value={tripForm.destination}
                    onChange={(e) => setTripForm({ ...tripForm, destination: e.target.value })}
                    placeholder="Guadalajara"
                  />
                </div>
                
                {/* Destination coordinates for route display */}
                <div className="p-3 rounded-lg bg-muted/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Navigation className="w-3 h-3" />
                      Coordenadas destino (opcional)
                    </div>
                    {tripForm.destinationLat && tripForm.destinationLng && (
                      <span className="text-xs text-primary">✓ Configurado</span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Latitud</Label>
                      <Input
                        type="number"
                        step="any"
                        value={tripForm.destinationLat ?? ''}
                        onChange={(e) => setTripForm({ 
                          ...tripForm, 
                          destinationLat: e.target.value ? parseFloat(e.target.value) : null 
                        })}
                        placeholder="20.6597"
                        className="h-8 text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Longitud</Label>
                      <Input
                        type="number"
                        step="any"
                        value={tripForm.destinationLng ?? ''}
                        onChange={(e) => setTripForm({ 
                          ...tripForm, 
                          destinationLng: e.target.value ? parseFloat(e.target.value) : null 
                        })}
                        placeholder="-103.3496"
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Si agregas coordenadas, tu ruta será visible en el mapa para la comunidad.
                  </p>
                </div>
                <div>
                  <Label>Tipo de vehículo</Label>
                  <Input
                    value={tripForm.vehicleType}
                    onChange={(e) => setTripForm({ ...tripForm, vehicleType: e.target.value })}
                    placeholder="Sedan, SUV, Pickup..."
                  />
                </div>
                
                {/* Optional vehicle photo */}
                <div className="p-3 rounded-lg bg-muted/30 space-y-2">
                  <Label className="text-sm flex items-center gap-2">
                    📷 Foto del vehículo (opcional)
                  </Label>
                  <MediaCapture
                    onImagesSelected={setVehiclePhoto}
                    maxImages={1}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Ayuda a identificar tu vehículo en caso de emergencia.
                  </p>
                </div>
              </>
            ) : (
              <>
                <div>
                  <Label>Aerolínea</Label>
                  <Input
                    value={tripForm.airline}
                    onChange={(e) => setTripForm({ ...tripForm, airline: e.target.value })}
                    placeholder="Volaris"
                  />
                </div>
                <div>
                  <Label>Número de vuelo</Label>
                  <Input
                    value={tripForm.flightNumber}
                    onChange={(e) => setTripForm({ ...tripForm, flightNumber: e.target.value })}
                    placeholder="Y4-123"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Aeropuerto salida</Label>
                    <Input
                      value={tripForm.departureAirport}
                      onChange={(e) => setTripForm({ ...tripForm, departureAirport: e.target.value })}
                      placeholder="MEX"
                    />
                  </div>
                  <div>
                    <Label>Aeropuerto llegada</Label>
                    <Input
                      value={tripForm.arrivalAirport}
                      onChange={(e) => setTripForm({ ...tripForm, arrivalAirport: e.target.value })}
                      placeholder="GDL"
                    />
                  </div>
                </div>
                
                {/* Optional boarding pass photo */}
                <div className="p-3 rounded-lg bg-muted/30 space-y-2">
                  <Label className="text-sm flex items-center gap-2">
                    🎫 Foto del pase de abordar (opcional)
                  </Label>
                  <MediaCapture
                    onImagesSelected={setBoardingPassPhoto}
                    maxImages={1}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Útil para verificar información de vuelo en emergencias.
                  </p>
                </div>
              </>
            )}

            <div>
              <Label>ETA (Hora estimada de llegada)</Label>
              <Input
                type="datetime-local"
                value={tripForm.eta}
                onChange={(e) => setTripForm({ ...tripForm, eta: e.target.value })}
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowTripDialog(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleTripSubmit}
                disabled={submitting}
                className="flex-1"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Iniciar Viaje
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Report Incident Dialog */}
      <Dialog 
        open={showReportDialog} 
        onOpenChange={(open) => {
          setShowReportDialog(open);
          if (!open) {
            setEditingReport(null);
            resetReportForm();
          }
        }}
      >
        <DialogContent className="sm:max-w-md bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-warning" />
              {editingReport ? 'Editar Reporte' : 'Reportar Incidente'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {userRole === 'FAMILIAR' && !editingReport && (
              <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 text-sm text-warning">
                ⚠️ FAMILIAR – NO PARAMÉDICO / NO EX PARAMÉDICO
              </div>
            )}

            <div>
              <Label>Categoría *</Label>
              <Select
                value={reportForm.category}
                onValueChange={(v) => setReportForm({ ...reportForm, category: v as ReportCategory })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona categoría" />
                </SelectTrigger>
                <SelectContent>
                  {REPORT_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.emoji} {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Severidad: {getSeverityLabel(reportForm.severity)}</Label>
              <div className="grid grid-cols-4 gap-2 mt-2">
                {([1, 2, 3, 4] as ReportSeverity[]).map((sev) => (
                  <Button
                    key={sev}
                    variant={reportForm.severity === sev ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setReportForm({ ...reportForm, severity: sev })}
                    className={cn(
                      reportForm.severity === sev && getSeverityColor(sev),
                      'text-xs'
                    )}
                  >
                    {sev}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <Label>Título *</Label>
              <Input
                value={reportForm.title}
                onChange={(e) => setReportForm({ ...reportForm, title: e.target.value })}
                placeholder="Ej: Bloqueo en Av. Principal"
              />
            </div>

            <div>
              <Label>Descripción (opcional)</Label>
              <textarea
                value={reportForm.description}
                onChange={(e) => setReportForm({ ...reportForm, description: e.target.value })}
                placeholder="Detalles adicionales..."
                className="w-full h-20 px-3 py-2 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground resize-none"
              />
            </div>

            {!editingReport && (
              <>
                <div>
                  <Label>Fotos (opcional)</Label>
                  <MediaCapture
                    onImagesSelected={setReportImages}
                    maxImages={3}
                  />
                </div>

                <div>
                  <Label>Nota de voz (opcional)</Label>
                  <VoiceRecorder
                    onRecordingComplete={(blob, duration) => setReportAudio({ blob, duration })}
                    onClear={() => setReportAudio(null)}
                  />
                </div>
              </>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowReportDialog(false);
                  setEditingReport(null);
                  resetReportForm();
                }}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={editingReport ? handleUpdateReport : handleReportSubmit}
                disabled={submitting || (!editingReport && !position)}
                className="flex-1 bg-warning text-warning-foreground hover:bg-warning/90"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {editingReport ? 'Guardar Cambios' : 'Enviar Reporte'}
              </Button>
            </div>

            {!editingReport && !position && (
              <p className="text-xs text-destructive text-center">
                Se requiere ubicación GPS para reportar
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ETA Update Dialog */}
      <Dialog open={!!editingEtaTripId} onOpenChange={(open) => !open && setEditingEtaTripId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Actualizar hora de llegada
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="new-eta">Nueva hora estimada de llegada</Label>
              <Input
                id="new-eta"
                type="datetime-local"
                value={newEta}
                onChange={(e) => setNewEta(e.target.value)}
                className="mt-1"
              />
            </div>
            
            <p className="text-sm text-muted-foreground">
              Tus contactos de emergencia serán notificados del cambio de ETA.
            </p>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setEditingEtaTripId(null)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={async () => {
                  if (!editingEtaTripId || !newEta) return;
                  
                  setUpdatingEta(true);
                  try {
                    const trip = myTrips.find(t => t.id === editingEtaTripId);
                    if (!trip) throw new Error('Trip not found');
                    
                    const oldEta = trip.eta;
                    const newEtaISO = new Date(newEta).toISOString();
                    
                    // Update trip ETA
                    const { error } = await supabase
                      .from('transit_trips')
                      .update({ eta: newEtaISO })
                      .eq('id', editingEtaTripId);

                    if (error) throw error;
                    
                    // Notify contacts about ETA change
                    try {
                      await supabase.functions.invoke('notify-trip-update', {
                        body: {
                          tripId: trip.id,
                          tripUserId: trip.user_id,
                          eventType: 'eta_updated',
                          origin: trip.origin,
                          destination: trip.destination,
                          eta: newEtaISO,
                          oldEta: oldEta,
                        }
                      });
                    } catch (notifyError) {
                      console.error('Error notifying contacts:', notifyError);
                    }
                    
                    toast.success('ETA actualizado. Tus contactos fueron notificados.');
                    setEditingEtaTripId(null);
                    setNewEta('');
                    fetchMyTrips();
                  } catch (e) {
                    console.error('Error updating ETA:', e);
                    toast.error('Error al actualizar ETA');
                  } finally {
                    setUpdatingEta(false);
                  }
                }}
                disabled={updatingEta || !newEta}
                className="flex-1"
              >
                {updatingEta && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Actualizar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TransitScreen;
