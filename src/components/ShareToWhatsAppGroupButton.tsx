// Button to share emergency alerts to WhatsApp group

import React from 'react';
import { Button } from '@/components/ui/button';
import { MessageCircle, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ShareToWhatsAppGroupButtonProps {
  alertType: string;
  lat: number;
  lng: number;
  message?: string;
  userName?: string;
  className?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

// WhatsApp group invite link - this is the link to join the group
// To share TO a group, users need to be in the group and use the share feature
const WHATSAPP_GROUP_NAME = 'Emergencias SOS Araba';

const ALERT_TYPE_LABELS: Record<string, string> = {
  'ambulancia_propia': '🚑 AMBULANCIA (para mí)',
  'ambulancia_tercero': '🚑 AMBULANCIA (tercero)',
  'patrulla': '🚔 PATRULLA',
  'bomberos': '🔥 BOMBEROS',
  'mecanico': '🔧 MECÁNICO',
  'proteccion_civil': '🏗️ PROTECCIÓN CIVIL',
  'robo': '🚨 ROBO',
  'accidente': '💥 ACCIDENTE',
  'medico': '⚕️ EMERGENCIA MÉDICA',
  'otro': '🆘 EMERGENCIA',
};

export const ShareToWhatsAppGroupButton: React.FC<ShareToWhatsAppGroupButtonProps> = ({
  alertType,
  lat,
  lng,
  message,
  userName,
  className,
  variant = 'outline',
  size = 'sm',
}) => {
  const handleShare = () => {
    const googleMapsLink = `https://maps.google.com/?q=${lat},${lng}`;
    const alertLabel = ALERT_TYPE_LABELS[alertType.toLowerCase()] || '🆘 EMERGENCIA';
    const name = userName || 'Un miembro de M.A.T.S.';
    const time = new Date().toLocaleString('es-MX', { 
      hour: '2-digit', 
      minute: '2-digit',
      day: '2-digit',
      month: 'short'
    });

    let emergencyMessage = `⚠️ *ALERTA M.A.T.S.* ⚠️\n\n`;
    emergencyMessage += `${alertLabel}\n\n`;
    emergencyMessage += `👤 *${name}*\n`;
    emergencyMessage += `🕐 ${time}\n\n`;
    
    if (message) {
      emergencyMessage += `📝 "${message}"\n\n`;
    }
    
    emergencyMessage += `📍 *Ubicación:*\n${googleMapsLink}\n\n`;
    emergencyMessage += `_Compartido desde M.A.T.S._`;

    // Use WhatsApp's share URL - this opens WhatsApp and lets user choose recipient
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(emergencyMessage)}`;
    
    window.open(whatsappUrl, '_blank');
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleShare}
      className={cn(
        'gap-2 bg-green-600 hover:bg-green-700 text-white border-green-600',
        className
      )}
    >
      <MessageCircle className="h-4 w-4" />
      <span className="hidden sm:inline">Compartir en WhatsApp</span>
      <span className="sm:hidden">WhatsApp</span>
      <ExternalLink className="h-3 w-3 opacity-70" />
    </Button>
  );
};

export default ShareToWhatsAppGroupButton;
