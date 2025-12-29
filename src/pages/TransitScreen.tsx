// Transit Screen for COMUNIDAD EX SOS
// Road + Flight transit tracking with incident reports

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Car, Plane, AlertTriangle, Plus, MapPin, Clock, Loader2, ThumbsUp, Download, FileText, Navigation, Pencil, Trash2, MoreVertical, History, Filter, Calendar, CheckCircle, XCircle, Route, Map, Users } from 'lucide-react';
import { GpsStatusBanner } from '@/components/GpsStatusBanner';
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
import { TripLocationPicker } from '@/components/TripLocationPicker';
import TripRouteMap from '@/components/TripRouteMap';
import MapErrorBoundary from '@/components/MapErrorBoundary';
import { useLocation, getGoogleMapsLink, calculateDistance, formatDistance } from '@/hooks/useLocation';
import { useTripPositionHistory } from '@/hooks/useTripPositionHistory';
import { useDynamicEta, formatEtaInfo } from '@/hooks/useDynamicEta';
import { useRoadReports } from '@/hooks/useRealtime';
import { useActiveTrips, type ActiveTrip } from '@/hooks/useActiveTrips';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { TransitType, ReportCategory, ReportSeverity, UserRole } from '@/types';
import { cn } from '@/lib/utils';
import { dateTimeLocalToISOString } from '@/lib/datetimeLocal';

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
  vehicle_photo_url: string | null;
  boarding_pass_url: string | null;
  origin_lat: number | null;
  origin_lng: number | null;
  destination_lat: number | null;
  destination_lng: number | null;
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
  const [historyStatusFilter, setHistoryStatusFilter] = useState<'ALL' | 'ARRIVED' | 'CANCELLED'>('ALL');
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
    // Origin coordinates (captured from location picker or GPS)
    originLat: null as number | null,
    originLng: null as number | null,
    // Destination coordinates (for route display)
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
  
  // Map display state
  const [showRouteMapTripId, setShowRouteMapTripId] = useState<string | null>(null);

  // Community trip map dialog state
  const [selectedCommunityTrip, setSelectedCommunityTrip] = useState<ActiveTrip | null>(null);

  const { position, getCurrentPosition, startWatching, stopWatching, watching, loading: locationLoading, error: locationError } = useLocation({ autoWatch: false });
  const { reports, refetch: refetchReports } = useRoadReports();
  const { trips: communityTrips, loading: communityTripsLoading } = useActiveTrips();
  
  // Get the first active IN_PROGRESS trip for position recording
  const activeInProgressTrip = useMemo(() => {
    return myTrips.find(trip => trip.status === 'ACTIVE');
  }, [myTrips]);
  
  // Position history hook for the active trip
  const {
    history: positionHistory,
    recordPosition,
    getRouteCoordinates,
    positionCount,
    fetchHistory: fetchPositionHistory,
  } = useTripPositionHistory({
    tripId: activeInProgressTrip?.id || null,
    userId: currentUserId,
    minDistanceMeters: 50,
    minIntervalMs: 15000, // Record every 15 seconds if moved 50m+
  });

  // Position history for selected community trip (read-only fetch)
  const {
    loading: communityRouteLoading,
    getRouteCoordinates: getCommunityRouteCoordinates,
  } = useTripPositionHistory({
    tripId: selectedCommunityTrip?.id || null,
    userId: currentUserId,
    minDistanceMeters: 0,
    minIntervalMs: 0,
  });
  
  // Dynamic ETA calculation based on GPS position
  const {
    etaInfo,
    updating: etaUpdating,
    processPositionUpdate,
    forceUpdateEta,
  } = useDynamicEta({
    tripId: activeInProgressTrip?.id || null,
    destinationLat: activeInProgressTrip?.destination_lat || null,
    destinationLng: activeInProgressTrip?.destination_lng || null,
    enabled: !!activeInProgressTrip,
    minUpdateIntervalMs: 60000, // Update ETA every 60 seconds max
  });
  
  // Record position and update ETA when GPS updates during active trip
  useEffect(() => {
    if (position && activeInProgressTrip && currentUserId) {
      // Record position history
      recordPosition(
        position.lat,
        position.lng,
        position.accuracy,
        position.speed,
        position.heading
      );
      
      // Process for ETA calculation
      processPositionUpdate(position);
    }
  }, [position, activeInProgressTrip, currentUserId, recordPosition, processPositionUpdate]);

  // Check if there are active trips
  const hasActiveTrips = useMemo(() => {
    return myTrips.some(trip => trip.status === 'ACTIVE');
  }, [myTrips]);

  // Auto-enable GPS tracking when there are active trips
  useEffect(() => {
    if (hasActiveTrips && !watching) {
      console.log('[TransitScreen] Active trips detected, starting GPS tracking');
      startWatching();
    } else if (!hasActiveTrips && watching) {
      console.log('[TransitScreen] No active trips, stopping GPS tracking');
      stopWatching();
    }
  }, [hasActiveTrips, watching, startWatching, stopWatching]);

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

  // Small helper to surface actionable errors (especially on mobile)
  const getErrMsg = (err: unknown) => {
    if (typeof err === 'string') return err;
    if (err && typeof err === 'object') {
      const anyErr = err as any;
      return (
        anyErr?.message ||
        anyErr?.error_description ||
        anyErr?.details ||
        anyErr?.hint ||
        'Error desconocido'
      );
    }
    return 'Error desconocido';
  };

  // Handle trip submission
  const handleTripSubmit = async () => {
    if (submitting) return;

    console.log('[TransitScreen] Start trip button pressed');

    // Validate ETA first (before GPS wait)
    if (!tripForm.eta) {
      toast.error('Se requiere hora de llegada estimada', {
        description: 'Selecciona una fecha y hora en el campo "ETA".',
      });
      console.warn('[TransitScreen] Cannot submit trip: missing ETA');
      return;
    }

    // Disable button immediately (important for iOS perceived responsiveness)
    setSubmitting(true);

    // Show immediate feedback to user (important for iOS)
    toast.info('Obteniendo ubicación GPS...', { id: 'gps-toast', duration: 15000 });

    // Ensure we have a fresh GPS position (iOS sometimes delays it)
    let pos = position;
    if (!pos) {
      try {
        // Create a timeout promise for GPS acquisition
        const gpsTimeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('GPS timeout')), 15000)
        );

        pos = await Promise.race([getCurrentPosition(), gpsTimeout]);
      } catch (e) {
        toast.dismiss('gps-toast');
        setSubmitting(false);

        const geoCode =
          e && typeof e === 'object' && 'code' in e ? (e as any).code as number : null;

        const errorMsg =
          e instanceof Error && e.message === 'GPS timeout'
            ? 'No se pudo obtener ubicación a tiempo. Intenta de nuevo.'
            : geoCode === 1
            ? 'Permite la ubicación en Safari para poder iniciar el viaje.'
            : geoCode === 2
            ? 'Ubicación no disponible. Revisa GPS/señal e intenta de nuevo.'
            : geoCode === 3
            ? 'La solicitud de ubicación expiró. Intenta de nuevo.'
            : getErrMsg(e);

        toast.error('Se requiere ubicación GPS', { description: errorMsg });
        console.warn('[TransitScreen] Cannot submit trip: missing position', {
          locationLoading,
          locationError,
          geoCode,
          error: e,
        });
        return;
      }
    }

    toast.dismiss('gps-toast');
    console.log('[TransitScreen] Submitting trip', {
      transitType,
      hasVehiclePhoto: vehiclePhoto.length > 0,
      hasBoardingPass: boardingPassPhoto.length > 0,
      origin: tripForm.origin,
      destination: tripForm.destination,
      departureAirport: tripForm.departureAirport,
      arrivalAirport: tripForm.arrivalAirport,
      eta: tripForm.eta,
      ua: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    });

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No autenticado');

      let vehiclePhotoUrl: string | null = null;
      let boardingPassUrl: string | null = null;

      // Upload vehicle photo if provided (for road trips)
      if (transitType === 'ROAD' && vehiclePhoto.length > 0) {
        try {
          const photo = vehiclePhoto[0];
          const fileName = `vehicle_${user.id}_${Date.now()}_${photo.name || 'photo.jpg'}`;
          const filePath = `transit-photos/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('reports_media')
            .upload(filePath, photo, {
              contentType: photo.type || 'image/jpeg',
              upsert: false,
            });

          if (uploadError) {
            console.warn('[TransitScreen] Vehicle photo upload failed:', uploadError);
          } else {
            const { data: urlData } = supabase.storage
              .from('reports_media')
              .getPublicUrl(filePath);
            vehiclePhotoUrl = urlData?.publicUrl || null;
          }
        } catch (photoError) {
          console.warn('[TransitScreen] Error processing vehicle photo:', photoError);
          // Continue without photo - it's optional
        }
      }

      // Upload boarding pass photo if provided (for flights)
      if (transitType === 'FLIGHT' && boardingPassPhoto.length > 0) {
        try {
          const photo = boardingPassPhoto[0];
          const fileName = `boarding_${user.id}_${Date.now()}_${photo.name || 'boarding.jpg'}`;
          const filePath = `transit-photos/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('reports_media')
            .upload(filePath, photo, {
              contentType: photo.type || 'image/jpeg',
              upsert: false,
            });

          if (uploadError) {
            console.warn('[TransitScreen] Boarding pass upload failed:', uploadError);
          } else {
            const { data: urlData } = supabase.storage
              .from('reports_media')
              .getPublicUrl(filePath);
            boardingPassUrl = urlData?.publicUrl || null;
          }
        } catch (photoError) {
          console.warn('[TransitScreen] Error processing boarding pass:', photoError);
          // Continue without photo - it's optional
        }
      }

      const tripData = {
        user_id: user.id,
        transit_type: transitType,
        origin: transitType === 'ROAD' ? tripForm.origin : tripForm.departureAirport,
        destination: transitType === 'ROAD' ? tripForm.destination : tripForm.arrivalAirport,
        eta: (() => {
          const iso = dateTimeLocalToISOString(tripForm.eta);
          if (!iso) throw new Error('ETA inválida');
          return iso;
        })(),
        status: 'ACTIVE',
        plates: transitType === 'ROAD' ? tripForm.plates : null,
        companions: tripForm.companions || null,
        vehicle_type: transitType === 'ROAD' ? tripForm.vehicleType : null,
        airline: transitType === 'FLIGHT' ? tripForm.airline : null,
        flight_number: transitType === 'FLIGHT' ? tripForm.flightNumber : null,
        departure_airport: transitType === 'FLIGHT' ? tripForm.departureAirport : null,
        arrival_airport: transitType === 'FLIGHT' ? tripForm.arrivalAirport : null,
        // Use form origin coords if provided, otherwise fall back to GPS position
        origin_lat: tripForm.originLat ?? pos.lat,
        origin_lng: tripForm.originLng ?? pos.lng,
        // Store destination coordinates if provided
        destination_lat: tripForm.destinationLat,
        destination_lng: tripForm.destinationLng,
        // Optional photos
        vehicle_photo_url: vehiclePhotoUrl,
        boarding_pass_url: boardingPassUrl,
      };

      const { data: insertedTrip, error } = await supabase.from('transit_trips').insert(tripData).select().single();
      if (error) throw error;

      // Notify all active users about the new trip
      try {
        await supabase.functions.invoke('notify-trip-update', {
          body: {
            tripId: insertedTrip.id,
            tripUserId: user.id,
            eventType: 'started',
            origin: tripData.origin,
            destination: tripData.destination,
            eta: tripData.eta,
            originLat: tripData.origin_lat,
            originLng: tripData.origin_lng,
            destinationLat: tripData.destination_lat,
            destinationLng: tripData.destination_lng,
          }
        });
        console.log('[TransitScreen] Active users notified about new trip');
      } catch (notifyError) {
        console.error('[TransitScreen] Error notifying active users:', notifyError);
        // Don't fail trip creation if notification fails
      }

      toast.success('¡Viaje registrado! Tu ubicación será visible en el mapa.');
      setShowTripDialog(false);
      resetTripForm();
      fetchMyTrips(); // Refresh trips list
    } catch (error) {
      const msg = getErrMsg(error);
      console.error('[TransitScreen] Error submitting trip:', error);
      toast.error('Error al registrar viaje', {
        description: msg,
      });
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
      originLat: null,
      originLng: null,
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
      {/* GPS Status Banner */}
      <div className="p-2 bg-background sticky top-0 z-20">
        <GpsStatusBanner
          position={position}
          loading={locationLoading}
          error={locationError}
          watching={watching}
          onRetry={getCurrentPosition}
        />
      </div>

      {/* Header */}
      <div className="sticky top-12 z-10 bg-background/95 backdrop-blur-sm border-b border-border p-4">
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
          {/* GPS tracking indicator */}
          {hasActiveTrips && (
            <div className={cn(
              "flex items-center gap-2 text-xs px-3 py-2 rounded-lg",
              watching ? "bg-safe/10 text-safe" : "bg-muted text-muted-foreground"
            )}>
              <div className={cn(
                "w-2 h-2 rounded-full",
                watching ? "bg-safe animate-pulse" : "bg-muted-foreground"
              )} />
              <Navigation className="w-3.5 h-3.5" />
              <span>
                {watching 
                  ? "GPS activo - actualizando progreso en tiempo real" 
                  : "Activando seguimiento GPS..."}
              </span>
            </div>
          )}
          {loadingTrips ? (
            <div className="text-center py-12 text-muted-foreground">
              <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin" />
              <p>Cargando viajes...</p>
            </div>
          ) : myTrips.filter(t => t.status === 'ACTIVE').length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Car className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No tienes viajes activos</p>
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
              
              // Calculate trip progress if we have all coordinates
              const tripProgress = (() => {
                if (!trip.origin_lat || !trip.origin_lng || !trip.destination_lat || !trip.destination_lng || !position) {
                  return null;
                }
                
                const totalDistance = calculateDistance(
                  trip.origin_lat,
                  trip.origin_lng,
                  trip.destination_lat,
                  trip.destination_lng
                );
                
                const remainingDistance = calculateDistance(
                  position.lat,
                  position.lng,
                  trip.destination_lat,
                  trip.destination_lng
                );
                
                const distanceFromOrigin = calculateDistance(
                  trip.origin_lat,
                  trip.origin_lng,
                  position.lat,
                  position.lng
                );
                
                // Progress percentage (clamped between 0-100)
                const progress = Math.min(100, Math.max(0, 
                  ((totalDistance - remainingDistance) / totalDistance) * 100
                ));
                
                // Estimate remaining time based on current speed
                // Speed from GPS is in m/s, convert to km/h
                const currentSpeedKmh = position.speed ? position.speed * 3.6 : null;
                let estimatedTimeRemaining: string | null = null;
                
                if (currentSpeedKmh && currentSpeedKmh > 5) {
                  // Use actual speed if moving (> 5 km/h)
                  const hoursRemaining = remainingDistance / currentSpeedKmh;
                  if (hoursRemaining < 1) {
                    estimatedTimeRemaining = `${Math.round(hoursRemaining * 60)} min`;
                  } else {
                    const h = Math.floor(hoursRemaining);
                    const m = Math.round((hoursRemaining - h) * 60);
                    estimatedTimeRemaining = m > 0 ? `${h}h ${m}min` : `${h}h`;
                  }
                } else {
                  // Fallback to average speed estimate
                  const avgSpeed = trip.transit_type === 'FLIGHT' ? 800 : 60;
                  const hoursRemaining = remainingDistance / avgSpeed;
                  if (hoursRemaining < 1) {
                    estimatedTimeRemaining = `~${Math.round(hoursRemaining * 60)} min`;
                  } else {
                    const h = Math.floor(hoursRemaining);
                    const m = Math.round((hoursRemaining - h) * 60);
                    estimatedTimeRemaining = `~${m > 0 ? `${h}h ${m}min` : `${h}h`}`;
                  }
                }
                
                return {
                  totalDistance,
                  remainingDistance,
                  distanceFromOrigin,
                  progress: Math.round(progress),
                  currentSpeedKmh,
                  estimatedTimeRemaining,
                };
              })();
              
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
                        
                        {/* Trip progress bar */}
                        {tripProgress && (
                          <div className="mt-3 space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground flex items-center gap-1">
                                <Navigation className="w-3 h-3" />
                                Progreso del viaje
                              </span>
                              <span className="font-medium text-primary">{tripProgress.progress}%</span>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-safe to-primary transition-all duration-500 rounded-full"
                                style={{ width: `${tripProgress.progress}%` }}
                              />
                            </div>
                            <div className="flex justify-between text-[10px] text-muted-foreground">
                              <span>Recorrido: {formatDistance(tripProgress.distanceFromOrigin)}</span>
                              <span>Restante: {formatDistance(tripProgress.remainingDistance)}</span>
                            </div>
                            {/* Estimated time remaining and current speed */}
                            <div className="flex items-center justify-between text-xs bg-primary/10 rounded px-2 py-1.5 mt-1">
                              <div className="flex items-center gap-1.5">
                                <Clock className={cn(
                                  "w-3 h-3 text-primary",
                                  etaUpdating && trip.id === activeInProgressTrip?.id && "animate-spin"
                                )} />
                                <span className="text-foreground font-medium">
                                  Llegada en: {tripProgress.estimatedTimeRemaining}
                                </span>
                                {trip.id === activeInProgressTrip?.id && (
                                  <span className="text-[9px] bg-safe/20 text-safe px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                                    <span className="w-1.5 h-1.5 bg-safe rounded-full animate-pulse" />
                                    Auto
                                  </span>
                                )}
                              </div>
                              {tripProgress.currentSpeedKmh && tripProgress.currentSpeedKmh > 1 && (
                                <div className="flex items-center gap-1 text-muted-foreground">
                                  <span>🚗</span>
                                  <span>{Math.round(tripProgress.currentSpeedKmh)} km/h</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {/* Distance and time estimate for trips with coordinates (no progress available) */}
                        {!tripProgress &&
                          trip.origin_lat !== null &&
                          trip.origin_lng !== null &&
                          trip.destination_lat !== null &&
                          trip.destination_lng !== null && (
                          <div className="flex items-center gap-3 mt-2 text-xs bg-muted/30 rounded px-2 py-1.5">
                            <div className="flex items-center gap-1">
                              <Route className="w-3 h-3 text-primary" />
                              <span className="text-muted-foreground">
                                {formatDistance(calculateDistance(
                                  trip.origin_lat,
                                  trip.origin_lng,
                                  trip.destination_lat,
                                  trip.destination_lng
                                ))}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-muted-foreground" />
                              <span className="text-muted-foreground">
                                ~{(() => {
                                  const distKm = calculateDistance(
                                    trip.origin_lat!,
                                    trip.origin_lng!,
                                    trip.destination_lat!,
                                    trip.destination_lng!
                                  );
                                  // For flights use ~800 km/h, for road ~60 km/h
                                  const speed = trip.transit_type === 'FLIGHT' ? 800 : 60;
                                  const hours = distKm / speed;
                                  if (hours < 1) {
                                    return `${Math.round(hours * 60)} min`;
                                  }
                                  const h = Math.floor(hours);
                                  const m = Math.round((hours - h) * 60);
                                  return m > 0 ? `${h}h ${m}min` : `${h}h`;
                                })()}
                              </span>
                            </div>
                          </div>
                        )}
                        
                        {/* Route map toggle button and map display */}
                        {(positionCount > 0 ||
                          (trip.origin_lat !== null &&
                            trip.origin_lng !== null &&
                            trip.destination_lat !== null &&
                            trip.destination_lng !== null)) &&
                          activeInProgressTrip?.id === trip.id && (
                          <div className="mt-3 space-y-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full text-xs gap-2"
                              onClick={() =>
                                setShowRouteMapTripId(showRouteMapTripId === trip.id ? null : trip.id)
                              }
                            >
                              <Map className="w-3.5 h-3.5" />
                              {showRouteMapTripId === trip.id ? 'Ocultar mapa' : 'Ver ruta recorrida'}
                              {positionCount > 0 && (
                                <span className="bg-primary/20 text-primary px-1.5 py-0.5 rounded text-[10px]">
                                  {positionCount} puntos
                                </span>
                              )}
                            </Button>

                            {showRouteMapTripId === trip.id && (
                              <MapErrorBoundary
                                context={{
                                  source: 'TransitScreen.activeTripInline',
                                  tripId: trip.id,
                                  positionCount,
                                  hasGps: !!position,
                                  origin: { lat: trip.origin_lat, lng: trip.origin_lng },
                                  destination: { lat: trip.destination_lat, lng: trip.destination_lng },
                                }}
                              >
                                <TripRouteMap
                                  routeCoordinates={getRouteCoordinates()}
                                  originCoords={
                                    trip.origin_lat !== null && trip.origin_lng !== null
                                      ? { lat: trip.origin_lat, lng: trip.origin_lng }
                                      : null
                                  }
                                  destinationCoords={
                                    trip.destination_lat !== null && trip.destination_lng !== null
                                      ? { lat: trip.destination_lat, lng: trip.destination_lng }
                                      : null
                                  }
                                  currentPosition={position ? { lat: position.lat, lng: position.lng } : null}
                                  originName={trip.origin}
                                  destinationName={trip.destination}
                                  height="250px"
                                />
                              </MapErrorBoundary>
                            )}
                          </div>
                        )}
                        
                        {/* Show trip photos */}
                        {(trip.vehicle_photo_url || trip.boarding_pass_url) && (
                          <div className="mt-2 flex gap-2">
                            {trip.vehicle_photo_url && (
                              <a 
                                href={trip.vehicle_photo_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="block"
                              >
                                <img 
                                  src={trip.vehicle_photo_url} 
                                  alt="Foto del vehículo" 
                                  className="w-16 h-16 object-cover rounded-lg border border-border hover:opacity-80 transition-opacity"
                                />
                              </a>
                            )}
                            {trip.boarding_pass_url && (
                              <a 
                                href={trip.boarding_pass_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="block"
                              >
                                <img 
                                  src={trip.boarding_pass_url} 
                                  alt="Pase de abordar" 
                                  className="w-16 h-16 object-cover rounded-lg border border-border hover:opacity-80 transition-opacity"
                                />
                              </a>
                            )}
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
                                  // Update trip status - use 'ARRIVED' to match DB constraint
                                  const { error: updateError } = await supabase
                                    .from('transit_trips')
                                    .update({ 
                                      status: 'ARRIVED', 
                                      arrived_at: new Date().toISOString() 
                                    })
                                    .eq('id', trip.id);
                                  
                                  if (updateError) {
                                    console.error('Error updating trip status:', updateError);
                                    throw updateError;
                                  }
                                  
                                  // Notify all active users about arrival
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
                                    console.error('Error notifying users:', notifyError);
                                  }
                                  
                                  toast.success('¡Viaje completado! Todos los usuarios activos fueron notificados.');
                                  fetchMyTrips();
                                } catch (e) {
                                  console.error('Error completing trip:', e);
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
          
          {/* Community Active Trips Section */}
          {(() => {
            // Filter out current user's trips from community trips
            const otherUsersTrips = communityTrips.filter(trip => trip.user_id !== currentUserId);
            
            if (otherUsersTrips.length === 0 && !communityTripsLoading) {
              return null; // Don't show section if no community trips
            }
            
            return (
              <div className="mt-6 pt-4 border-t border-border">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">Viajes de la Comunidad</h3>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {otherUsersTrips.length}
                  </span>
                </div>
                
                {communityTripsLoading ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <Loader2 className="w-6 h-6 mx-auto mb-2 animate-spin" />
                    <p className="text-xs">Cargando viajes...</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {otherUsersTrips.map((trip) => {
                      const etaDate = new Date(trip.eta);
                      const isOverdue = etaDate < new Date();
                      const displayName = trip.nickname || 'Miembro';
                      
                      return (
                        <Card key={trip.id} className={cn(
                          "bg-card/50 border-border",
                          isOverdue && "border-warning/50"
                        )}>
                          <CardContent className="p-3">
                            <div className="flex items-start gap-2">
                              <div className={cn(
                                'w-8 h-8 rounded-lg flex items-center justify-center',
                                isOverdue ? 'bg-warning' : 'bg-primary/80',
                                'text-white text-sm'
                              )}>
                                {trip.transit_type === 'ROAD' ? (
                                  <Car className="w-4 h-4" />
                                ) : (
                                  <Plane className="w-4 h-4" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded">
                                    {displayName}
                                  </span>
                                  {isOverdue && (
                                    <span className="text-[10px] bg-warning/20 text-warning px-1.5 py-0.5 rounded">
                                      ATRASADO
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm font-medium text-foreground mt-1 truncate">
                                  {trip.origin} → {trip.destination}
                                </p>
                                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    ETA: {etaDate.toLocaleString('es-MX', {
                                      day: 'numeric',
                                      month: 'short',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </span>
                                  {trip.plates && (
                                    <span>🚗 {trip.plates}</span>
                                  )}
                                  {trip.companions && (
                                    <span>👥 {trip.companions}</span>
                                  )}
                                </div>
                                {trip.transit_type === 'FLIGHT' && trip.airline && (
                                  <div className="text-xs text-muted-foreground mt-1">
                                    ✈️ {trip.airline} {trip.flight_number || ''}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="mt-3">
                              <Button
                                size="sm"
                                variant="outline"
                                className="w-full text-xs gap-2"
                                onClick={() => setSelectedCommunityTrip(trip)}
                              >
                                <Map className="w-3.5 h-3.5" />
                                Ver en mapa
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-3 mt-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-2 pb-2 border-b border-border">
            <Select value={historyStatusFilter} onValueChange={(v) => setHistoryStatusFilter(v as 'ALL' | 'ARRIVED' | 'CANCELLED')}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <Filter className="w-3 h-3 mr-1" />
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos</SelectItem>
                <SelectItem value="ARRIVED">Completados</SelectItem>
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
              const isCompleted = trip.status === 'ARRIVED';
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
                        
                        {/* Show trip photos in history */}
                        {(trip.vehicle_photo_url || trip.boarding_pass_url) && (
                          <div className="mt-2 flex gap-2">
                            {trip.vehicle_photo_url && (
                              <a 
                                href={trip.vehicle_photo_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="block"
                              >
                                <img 
                                  src={trip.vehicle_photo_url} 
                                  alt="Foto del vehículo" 
                                  className="w-14 h-14 object-cover rounded-lg border border-border hover:opacity-80 transition-opacity"
                                />
                              </a>
                            )}
                            {trip.boarding_pass_url && (
                              <a 
                                href={trip.boarding_pass_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="block"
                              >
                                <img 
                                  src={trip.boarding_pass_url} 
                                  alt="Pase de abordar" 
                                  className="w-14 h-14 object-cover rounded-lg border border-border hover:opacity-80 transition-opacity"
                                />
                              </a>
                            )}
                          </div>
                        )}
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
      <Dialog 
        open={showTripDialog} 
        onOpenChange={(open) => {
          setShowTripDialog(open);
          if (!open) {
            resetTripForm();
          }
        }}
      >
        <DialogContent className="sm:max-w-md bg-card border-border flex flex-col p-0 max-h-[100dvh] h-[100dvh] sm:h-auto sm:max-h-[90vh]">
          <DialogHeader className="px-6 pt-6 pb-2 flex-shrink-0">
            <DialogTitle>Registrar Viaje</DialogTitle>
          </DialogHeader>

          {/* Scrollable content area */}
          <div className="flex-1 overflow-y-auto px-6 pb-2 [-webkit-overflow-scrolling:touch]">
            <div className="space-y-4 py-2">
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
                  {/* Origin location picker */}
                  <TripLocationPicker
                    label="Origen"
                    placeholder="Buscar origen en mapa..."
                    currentPosition={position}
                    markerColor="green"
                    value={tripForm.origin && tripForm.originLat && tripForm.originLng ? {
                      name: tripForm.origin,
                      lat: tripForm.originLat,
                      lng: tripForm.originLng,
                    } : null}
                    onChange={(loc) => {
                      if (loc) {
                        setTripForm({
                          ...tripForm,
                          origin: loc.name,
                          originLat: loc.lat,
                          originLng: loc.lng,
                        });
                      } else {
                        setTripForm({
                          ...tripForm,
                          origin: '',
                          originLat: null,
                          originLng: null,
                        });
                      }
                    }}
                  />
                  
                  {/* Destination location picker */}
                  <TripLocationPicker
                    label="Destino"
                    placeholder="Buscar destino en mapa..."
                    currentPosition={position}
                    markerColor="orange"
                    value={tripForm.destination && tripForm.destinationLat && tripForm.destinationLng ? {
                      name: tripForm.destination,
                      lat: tripForm.destinationLat,
                      lng: tripForm.destinationLng,
                    } : null}
                    onChange={(loc) => {
                      if (loc) {
                        setTripForm({
                          ...tripForm,
                          destination: loc.name,
                          destinationLat: loc.lat,
                          destinationLng: loc.lng,
                        });
                      } else {
                        setTripForm({
                          ...tripForm,
                          destination: '',
                          destinationLat: null,
                          destinationLng: null,
                        });
                      }
                    }}
                  />
                  
                  {/* Distance and time estimate */}
                  {tripForm.originLat && tripForm.originLng && tripForm.destinationLat && tripForm.destinationLng && (
                    <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <Route className="w-4 h-4 text-primary" />
                          <span className="text-sm font-medium">Distancia:</span>
                          <span className="text-sm text-primary">
                            {formatDistance(calculateDistance(
                              tripForm.originLat,
                              tripForm.originLng,
                              tripForm.destinationLat,
                              tripForm.destinationLng
                            ))}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm font-medium">~</span>
                          <span className="text-sm text-muted-foreground">
                            {(() => {
                              const distKm = calculateDistance(
                                tripForm.originLat!,
                                tripForm.originLng!,
                                tripForm.destinationLat!,
                                tripForm.destinationLng!
                              );
                              // Estimate: ~60km/h average road speed
                              const hours = distKm / 60;
                              if (hours < 1) {
                                return `${Math.round(hours * 60)} min`;
                              }
                              const h = Math.floor(hours);
                              const m = Math.round((hours - h) * 60);
                              return m > 0 ? `${h}h ${m}min` : `${h}h`;
                            })()}
                          </span>
                        </div>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Tiempo estimado en carretera (velocidad promedio 60 km/h)
                      </p>
                    </div>
                  )}
                  
                  <p className="text-[10px] text-muted-foreground bg-muted/30 p-2 rounded">
                    💡 Selecciona ubicaciones en el mapa para que tu ruta sea visible para la comunidad.
                  </p>
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
            </div>
          </div>

          {/* Fixed footer buttons */}
          <div className="flex-shrink-0 px-6 py-4 border-t border-border bg-card" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowTripDialog(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!submitting) {
                    handleTripSubmit();
                  }
                }}
                disabled={submitting}
                className="flex-1 inline-flex touch-manipulation items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
                style={{ WebkitTapHighlightColor: 'transparent', WebkitUserSelect: 'none', userSelect: 'none' }}
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Iniciar Viaje
              </button>
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

      {/* Community Trip Map Dialog */}
      {selectedCommunityTrip && (
        <Dialog open={true} onOpenChange={(open) => !open && setSelectedCommunityTrip(null)}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-auto bg-card">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Map className="w-5 h-5 text-primary" />
                Viaje de {selectedCommunityTrip.nickname || 'Miembro'}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="relative">
                {communityRouteLoading && (
                  <div className="absolute inset-0 z-20 flex items-center justify-center bg-muted/80 rounded-lg">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                )}
                <MapErrorBoundary
                  context={{
                    source: 'TransitScreen.communityTripDialog',
                    tripId: selectedCommunityTrip.id,
                    origin: { lat: selectedCommunityTrip.origin_lat, lng: selectedCommunityTrip.origin_lng },
                    destination: {
                      lat: selectedCommunityTrip.destination_lat,
                      lng: selectedCommunityTrip.destination_lng,
                    },
                    current: { lat: selectedCommunityTrip.current_lat, lng: selectedCommunityTrip.current_lng },
                  }}
                  onClose={() => setSelectedCommunityTrip(null)}
                >
                  <TripRouteMap
                    routeCoordinates={getCommunityRouteCoordinates()}
                    originCoords={
                      selectedCommunityTrip.origin_lat !== null && selectedCommunityTrip.origin_lng !== null
                        ? { lat: selectedCommunityTrip.origin_lat, lng: selectedCommunityTrip.origin_lng }
                        : null
                    }
                    destinationCoords={
                      selectedCommunityTrip.destination_lat !== null &&
                      selectedCommunityTrip.destination_lng !== null
                        ? { lat: selectedCommunityTrip.destination_lat, lng: selectedCommunityTrip.destination_lng }
                        : null
                    }
                    currentPosition={
                      selectedCommunityTrip.current_lat !== null && selectedCommunityTrip.current_lng !== null
                        ? { lat: selectedCommunityTrip.current_lat, lng: selectedCommunityTrip.current_lng }
                        : null
                    }
                    originName={selectedCommunityTrip.origin}
                    destinationName={selectedCommunityTrip.destination}
                    height="280px"
                  />
                </MapErrorBoundary>
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => setSelectedCommunityTrip(null)}
              >
                Cerrar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

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
                    const newEtaISO = dateTimeLocalToISOString(newEta);
                    if (!newEtaISO) throw new Error('ETA inválida');
                    
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
