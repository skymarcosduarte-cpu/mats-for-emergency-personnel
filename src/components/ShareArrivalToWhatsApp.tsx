// Button to share trip arrival confirmation to WhatsApp
import React from 'react';
import { Button } from '@/components/ui/button';
import { MessageCircle, CheckCircle, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ArrivalTripDetails {
  id: string;
  transitType: 'ROAD' | 'FLIGHT' | 'HELICOPTER';
  origin: string;
  destination: string;
  eta: string;
  arrivedAt: string;
  // Road specific
  plates?: string | null;
  vehicleType?: string | null;
  companions?: string | null;
  // Flight specific
  airline?: string | null;
  flightNumber?: string | null;
  departureAirport?: string | null;
  arrivalAirport?: string | null;
  // Coordinates
  originLat?: number | null;
  originLng?: number | null;
  destinationLat?: number | null;
  destinationLng?: number | null;
  // User info
  nickname?: string | null;
}

interface ShareArrivalToWhatsAppProps {
  trip: ArrivalTripDetails;
  className?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  showLabel?: boolean;
  onShared?: () => void;
}

const VEHICLE_TYPE_LABELS: Record<string, string> = {
  'auto': '🚗 Auto',
  'camioneta': '🚙 Camioneta',
  'moto': '🏍️ Moto',
  'autobus': '🚌 Autobús',
  'trailer': '🚛 Tráiler',
  'otro': '🚐 Otro vehículo',
};

export const ShareArrivalToWhatsApp: React.FC<ShareArrivalToWhatsAppProps> = ({
  trip,
  className,
  variant = 'default',
  size = 'sm',
  showLabel = true,
  onShared,
}) => {
  const handleShare = () => {
    const arrivedDate = new Date(trip.arrivedAt);
    const arrivedFormatted = arrivedDate.toLocaleString('es-MX', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });

    const etaDate = new Date(trip.eta);
    const etaFormatted = etaDate.toLocaleString('es-MX', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });

    // Calculate if arrived early, on time, or late
    const diffMinutes = Math.round((arrivedDate.getTime() - etaDate.getTime()) / (1000 * 60));
    let statusEmoji = '✅';
    let statusText = 'a tiempo';
    
    if (diffMinutes < -5) {
      statusEmoji = '🏃';
      statusText = `${Math.abs(diffMinutes)} min antes`;
    } else if (diffMinutes > 5) {
      statusEmoji = '⏰';
      statusText = `${diffMinutes} min después`;
    }

    let message = '';

    if (trip.transitType === 'ROAD') {
      // Road trip arrival message
      const vehicleLabel = trip.vehicleType 
        ? VEHICLE_TYPE_LABELS[trip.vehicleType.toLowerCase()] || `🚗 ${trip.vehicleType}`
        : '🚗 Vehículo';

      message = `✅ *¡LLEGUÉ A MI DESTINO!* ✅\n`;
      message += `━━━━━━━━━━━━━━━━━━\n\n`;
      
      if (trip.nickname) {
        message += `👤 *Viajero:* ${trip.nickname}\n`;
      }
      
      message += `📍 *Origen:* ${trip.origin}\n`;
      message += `🎯 *Destino:* ${trip.destination}\n\n`;
      
      message += `⏰ *ETA original:* ${etaFormatted}\n`;
      message += `🏁 *Llegada real:* ${arrivedFormatted}\n`;
      message += `${statusEmoji} *Estado:* ${statusText}\n\n`;
      
      message += `🚙 *Vehículo:* ${vehicleLabel}\n`;
      
      if (trip.plates) {
        message += `🔢 *Placas:* ${trip.plates.toUpperCase()}\n`;
      }
      
      if (trip.companions) {
        message += `👥 *Acompañantes:* ${trip.companions}\n`;
      }
      
    } else if (trip.transitType === 'HELICOPTER') {
      // Helicopter arrival message
      message = `✅ *¡ATERRICÉ!* 🚁\n`;
      message += `━━━━━━━━━━━━━━━━━━\n\n`;
      
      if (trip.nickname) {
        message += `👤 *Viajero:* ${trip.nickname}\n`;
      }
      
      if (trip.airline) {
        message += `🛩️ *Tipo de aeronave:* ${trip.airline}\n`;
      }
      
      if (trip.flightNumber) {
        message += `🔢 *Matrícula:* ${trip.flightNumber.toUpperCase()}\n`;
      }
      
      message += `🛫 *Salió de:* ${trip.departureAirport || trip.origin}\n`;
      message += `🛬 *Llegó a:* ${trip.arrivalAirport || trip.destination}\n\n`;
      
      message += `⏰ *ETA original:* ${etaFormatted}\n`;
      message += `🏁 *Llegada real:* ${arrivedFormatted}\n`;
      message += `${statusEmoji} *Estado:* ${statusText}\n`;
      
      if (trip.companions) {
        message += `\n👥 *Acompañantes:* ${trip.companions}\n`;
      }
    } else {
      // Flight arrival message
      message = `✅ *¡ATERRICÉ!* ✈️\n`;
      message += `━━━━━━━━━━━━━━━━━━\n\n`;
      
      if (trip.nickname) {
        message += `👤 *Viajero:* ${trip.nickname}\n`;
      }
      
      if (trip.airline) {
        message += `🏢 *Aerolínea:* ${trip.airline}\n`;
      }
      
      if (trip.flightNumber) {
        message += `🎫 *Vuelo:* ${trip.flightNumber.toUpperCase()}\n`;
      }
      
      message += `🛫 *Salió de:* ${trip.departureAirport || trip.origin}\n`;
      message += `🛬 *Llegó a:* ${trip.arrivalAirport || trip.destination}\n\n`;
      
      message += `⏰ *ETA original:* ${etaFormatted}\n`;
      message += `🏁 *Llegada real:* ${arrivedFormatted}\n`;
      message += `${statusEmoji} *Estado:* ${statusText}\n`;
      
      if (trip.companions) {
        message += `\n👥 *Acompañantes:* ${trip.companions}\n`;
      }
    }

    // Add destination location link if available
    if (trip.destinationLat && trip.destinationLng) {
      message += `\n━━━━━━━━━━━━━━━━━━\n`;
      message += `📍 *UBICACIÓN DE LLEGADA:*\n`;
      const destLink = `https://maps.google.com/?q=${trip.destinationLat},${trip.destinationLng}`;
      message += `${destLink}\n`;
    }

    message += `\n━━━━━━━━━━━━━━━━━━\n`;
    message += `_Viaje completado con M.A.T.S. - Tránsito Seguro_ ✅`;

    // Open WhatsApp share
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
    
    onShared?.();
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleShare}
      className={cn(
        'gap-2 bg-safe hover:bg-safe/90 text-safe-foreground border-safe',
        className
      )}
    >
      <CheckCircle className="h-4 w-4" />
      {showLabel && (
        <>
          <span className="hidden sm:inline">Reportar llegada</span>
          <span className="sm:hidden">WhatsApp</span>
        </>
      )}
      <MessageCircle className="h-3 w-3 opacity-70" />
    </Button>
  );
};

export default ShareArrivalToWhatsApp;
