// Transit Screen for COMUNIDAD EX SOS
// Road + Flight transit tracking with incident reports

import React, { useState } from 'react';
import { Car, Plane, AlertTriangle, Plus, MapPin, Clock, Loader2 } from 'lucide-react';
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

export const TransitScreen: React.FC<TransitScreenProps> = ({
  userRole = 'RESCATISTA'
}) => {
  const [activeTab, setActiveTab] = useState<'trips' | 'reports'>('trips');
  const [showTripDialog, setShowTripDialog] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [transitType, setTransitType] = useState<TransitType>('ROAD');
  const [submitting, setSubmitting] = useState(false);
  
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
  });

  // Report form state
  const [reportForm, setReportForm] = useState({
    category: '' as ReportCategory | '',
    severity: 2 as ReportSeverity,
    title: '',
    description: '',
  });
  const [reportImages, setReportImages] = useState<File[]>([]);
  const [reportAudio, setReportAudio] = useState<{ blob: Blob; duration: number } | null>(null);

  const { position } = useLocation();
  const { reports } = useRoadReports();

  // Handle trip submission
  const handleTripSubmit = async () => {
    if (!position) {
      alert('Se requiere ubicación GPS');
      return;
    }

    setSubmitting(true);
    try {
      console.log('Trip submission:', {
        type: transitType,
        ...tripForm,
        lat: position.lat,
        lng: position.lng,
      });

      setShowTripDialog(false);
      resetTripForm();
    } catch (error) {
      console.error('Error submitting trip:', error);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle report submission
  const handleReportSubmit = async () => {
    if (!position) {
      alert('Se requiere ubicación GPS');
      return;
    }

    if (!reportForm.category || !reportForm.title) {
      alert('Completa los campos requeridos');
      return;
    }

    setSubmitting(true);
    try {
      console.log('Report submission:', {
        ...reportForm,
        lat: position.lat,
        lng: position.lng,
        images: reportImages.length,
        audio: reportAudio ? 'yes' : 'no',
      });

      setShowReportDialog(false);
      resetReportForm();
    } catch (error) {
      console.error('Error submitting report:', error);
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
    });
    setTransitType('ROAD');
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

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'trips' | 'reports')} className="p-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="trips">Mis Viajes</TabsTrigger>
          <TabsTrigger value="reports">Reportes</TabsTrigger>
        </TabsList>

        {/* Trips Tab */}
        <TabsContent value="trips" className="space-y-3 mt-4">
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
              return (
                <Card key={report.id} className="bg-card border-border">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        'w-10 h-10 rounded-lg flex items-center justify-center text-xl',
                        getSeverityColor(report.severity as ReportSeverity),
                        'text-white'
                      )}>
                        {category?.emoji || '📍'}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium text-foreground">{report.title}</h3>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <span>{category?.label}</span>
                          <span>•</span>
                          <span>Severidad {report.severity}/4</span>
                        </div>
                        {report.description && (
                          <p className="text-sm text-muted-foreground mt-2">
                            {report.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {new Date(report.created_at).toLocaleString()}
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
                <div>
                  <Label>Tipo de vehículo</Label>
                  <Input
                    value={tripForm.vehicleType}
                    onChange={(e) => setTripForm({ ...tripForm, vehicleType: e.target.value })}
                    placeholder="Sedan, SUV, Pickup..."
                  />
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
      <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
        <DialogContent className="sm:max-w-md bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-warning" />
              Reportar Incidente
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {userRole === 'FAMILIAR' && (
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

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowReportDialog(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleReportSubmit}
                disabled={submitting || !position}
                className="flex-1 bg-warning text-warning-foreground hover:bg-warning/90"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Enviar Reporte
              </Button>
            </div>

            {!position && (
              <p className="text-xs text-destructive text-center">
                Se requiere ubicación GPS para reportar
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TransitScreen;
