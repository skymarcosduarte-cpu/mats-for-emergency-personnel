// Hook for notifying emergency contacts when an alert is triggered
import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  whatsapp: string | null;
}

export function useEmergencyNotification() {
  // Format phone for WhatsApp
  const formatPhoneForWhatsApp = (phone: string): string => {
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      cleaned = '52' + cleaned; // Mexico country code
    }
    return cleaned;
  };

  // Get emergency contacts for current user
  const getEmergencyContacts = useCallback(async (): Promise<EmergencyContact[]> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('emergency_contacts')
        .select('id, name, phone, whatsapp')
        .eq('user_id', user.id)
        .order('is_primary', { ascending: false });

      if (error) {
        console.error('[useEmergencyNotification] Error fetching contacts:', error);
        return [];
      }

      return (data || []) as EmergencyContact[];
    } catch (error) {
      console.error('[useEmergencyNotification] Error:', error);
      return [];
    }
  }, []);

  // Build emergency message
  const buildEmergencyMessage = (
    alertType: string,
    lat: number,
    lng: number,
    userName?: string,
    customMessage?: string
  ): string => {
    const googleMapsLink = `https://maps.google.com/?q=${lat},${lng}`;
    const typeLabels: Record<string, string> = {
      'ambulancia_propia': '🚑 AMBULANCIA (para mí)',
      'ambulancia_tercero': '🚑 AMBULANCIA (tercero)',
      'patrulla': '🚔 PATRULLA',
      'mecanico': '🔧 MECÁNICO',
      'proteccion_civil': '🏗️ PROTECCIÓN CIVIL',
    };

    const alertLabel = typeLabels[alertType.toLowerCase()] || '🆘 EMERGENCIA';
    const name = userName || 'Un miembro de M.A.T.S.';

    let msg = `⚠️ *ALERTA DE EMERGENCIA M.A.T.S.*\n\n`;
    msg += `${alertLabel}\n\n`;
    msg += `*${name}* necesita ayuda urgente.\n\n`;
    
    if (customMessage) {
      msg += `📝 Mensaje: "${customMessage}"\n\n`;
    }
    
    msg += `📍 *Ubicación:*\n${googleMapsLink}\n\n`;
    msg += `🕐 Hora: ${new Date().toLocaleString('es-MX')}\n\n`;
    msg += `_Enviado desde M.A.T.S. - Mutual Aid Tracking System_`;

    return msg;
  };

  // Notify all emergency contacts via WhatsApp links
  const notifyEmergencyContacts = useCallback(async (
    alertType: string,
    lat: number,
    lng: number,
    customMessage?: string
  ): Promise<void> => {
    try {
      // Get user profile for name
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle();

      const userName = profile?.full_name;
      
      // Get emergency contacts
      const contacts = await getEmergencyContacts();
      
      if (contacts.length === 0) {
        console.log('[useEmergencyNotification] No emergency contacts configured');
        return;
      }

      // Build the message
      const message = buildEmergencyMessage(alertType, lat, lng, userName, customMessage);
      const encodedMessage = encodeURIComponent(message);

      // Show toast with options to notify each contact
      toast.info('📱 Notificar contactos de emergencia', {
        duration: 15000,
        description: `Tienes ${contacts.length} contacto(s) de emergencia registrado(s)`,
        action: {
          label: 'Enviar WhatsApp',
          onClick: () => {
            // Open WhatsApp for the first (primary) contact
            const primaryContact = contacts[0];
            const phone = formatPhoneForWhatsApp(primaryContact.whatsapp || primaryContact.phone);
            const whatsappUrl = `https://wa.me/${phone}?text=${encodedMessage}`;
            window.open(whatsappUrl, '_blank');
            
            // If there are more contacts, show a follow-up toast
            if (contacts.length > 1) {
              setTimeout(() => {
                toast.info('¿Notificar más contactos?', {
                  duration: 10000,
                  description: `${contacts.length - 1} contacto(s) adicional(es)`,
                  action: {
                    label: 'Ver todos',
                    onClick: () => {
                      // Open all contacts in sequence
                      contacts.slice(1).forEach((contact, index) => {
                        setTimeout(() => {
                          const phone = formatPhoneForWhatsApp(contact.whatsapp || contact.phone);
                          const url = `https://wa.me/${phone}?text=${encodedMessage}`;
                          window.open(url, '_blank');
                        }, index * 1000);
                      });
                    },
                  },
                });
              }, 2000);
            }
          },
        },
      });

      console.log('[useEmergencyNotification] Toast shown for', contacts.length, 'contacts');
    } catch (error) {
      console.error('[useEmergencyNotification] Error notifying contacts:', error);
    }
  }, [getEmergencyContacts]);

  return {
    notifyEmergencyContacts,
    getEmergencyContacts,
    formatPhoneForWhatsApp,
    buildEmergencyMessage,
  };
}
