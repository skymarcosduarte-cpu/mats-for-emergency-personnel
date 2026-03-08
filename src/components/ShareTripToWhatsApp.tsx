// Button to share trip details to WhatsApp
import React from 'react';
import { Button } from '@/components/ui/button';
import { MessageCircle, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TripDetails {
  id: string;
  transitType: 'ROAD' | 'FLIGHT' | 'HELICOPTER';
  origin: string;
  destination: string;
  eta: string;
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
  shareToken?: string | null;
}

interface ShareTripToWhatsAppProps {
  trip: TripDetails;
  isOwnTrip?: boolean;
  className?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  showLabel?: boolean;
}

const VEHICLE_TYPE_LABELS: Record<string, string> = {
  'auto': '🚗 Auto',
  'camioneta': '🚙 Camioneta',
  'moto': '🏍️ Moto',
  'autobus': '🚌 Autobús',
  'trailer': '🚛 Tráiler',
  'otro': '🚐 Otro vehículo',
};

export const ShareTripToWhatsApp: React.FC<ShareTripToWhatsAppProps> = ({
  trip,
  isOwnTrip = false,
  className,
  variant = 'outline',
  size = 'sm',
  showLabel = true,
}) => {
  const handleShare = () => {
    const etaDate = new Date(trip.eta);
    const etaFormatted = etaDate.toLocaleString('es-MX', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });

    const now = new Date().toLocaleString('es-MX', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });

    let message = '';

    if (trip.transitType === 'ROAD') {
      // Road trip message
      const vehicleLabel = trip.vehicleType 
        ? VEHICLE_TYPE_LABELS[trip.vehicleType.toLowerCase()] || `🚗 ${trip.vehicleType}`
        : '🚗 Vehículo';

      message = `🚗 *VIAJE EN CARRETERA* 🚗\n`;
      message += `━━━━━━━━━━━━━━━━━━\n\n`;
      
      if (trip.nickname) {
        message += `👤 *Viajero:* ${trip.nickname}\n`;
      }
      
      message += `📍 *Origen:* ${trip.origin}\n`;
      message += `🎯 *Destino:* ${trip.destination}\n`;
      message += `⏰ *Hora estimada de llegada:* ${etaFormatted}\n\n`;
      
      message += `🚙 *Vehículo:* ${vehicleLabel}\n`;
      
      if (trip.plates) {
        message += `🔢 *Placas:* ${trip.plates.toUpperCase()}\n`;
      }
      
      if (trip.companions) {
        message += `👥 *Acompañantes:* ${trip.companions}\n`;
      }
      
    } else {
      // Flight trip message
      message = `✈️ *VIAJE EN AVIÓN* ✈️\n`;
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
      
      message += `🛫 *Sale de:* ${trip.departureAirport || trip.origin}\n`;
      message += `🛬 *Llega a:* ${trip.arrivalAirport || trip.destination}\n`;
      message += `⏰ *Hora estimada de llegada:* ${etaFormatted}\n`;
      
      if (trip.companions) {
        message += `👥 *Acompañantes:* ${trip.companions}\n`;
      }
    }

    // Add location links if available
    message += `\n━━━━━━━━━━━━━━━━━━\n`;
    message += `📍 *UBICACIONES:*\n\n`;

    if (trip.originLat && trip.originLng) {
      const originLink = `https://maps.google.com/?q=${trip.originLat},${trip.originLng}`;
      message += `📌 Origen: ${originLink}\n`;
    }

    if (trip.destinationLat && trip.destinationLng) {
      const destLink = `https://maps.google.com/?q=${trip.destinationLat},${trip.destinationLng}`;
      message += `🎯 Destino: ${destLink}\n`;
    }

    // Add share link if available
    if (trip.shareToken) {
      message += `\n🔗 *Seguir viaje en tiempo real:*\n`;
      message += `${window.location.origin}/viaje/${trip.shareToken}\n`;
    }

    message += `\n━━━━━━━━━━━━━━━━━━\n`;
    message += `🕐 Compartido: ${now}\n`;
    message += `_Enviado desde M.A.T.S. - Tránsito Seguro_`;

    // Open WhatsApp share
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
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
      <MessageCircle className="h-4 w-4" />
      {showLabel && (
        <>
          <span className="hidden sm:inline">
            {isOwnTrip ? 'Compartir mi viaje' : 'Compartir viaje'}
          </span>
          <span className="sm:hidden">WhatsApp</span>
        </>
      )}
      <ExternalLink className="h-3 w-3 opacity-70" />
    </Button>
  );
};

export default ShareTripToWhatsApp;
