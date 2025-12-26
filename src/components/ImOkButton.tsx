// ImOkButton - Quick "I'm OK" check-in to emergency contacts via WhatsApp
import React, { useState, useCallback } from 'react';
import { Heart, MessageCircle, ChevronRight, Loader2, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEmergencyContactsDB, type EmergencyContactDB } from '@/hooks/useEmergencyContactsDB';
import { toast } from 'sonner';

interface ImOkButtonProps {
  position: { lat: number; lng: number } | null;
  className?: string;
}

export function ImOkButton({ position, className }: ImOkButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const { contacts, loading, getWhatsAppUrl, hasMinimumContacts } = useEmergencyContactsDB();

  const getGoogleMapsLink = useCallback((lat: number, lng: number) => {
    return `https://maps.google.com/?q=${lat},${lng}`;
  }, []);

  const buildMessage = useCallback((includeLocation: boolean) => {
    let message = '✅ ¡Estoy bien!\n\nEste es un mensaje automático para confirmarte que me encuentro bien.';
    
    if (includeLocation && position) {
      const mapsLink = getGoogleMapsLink(position.lat, position.lng);
      message += `\n\n📍 Mi ubicación actual:\n${mapsLink}`;
    }
    
    message += '\n\n— Enviado desde M.A.T.S.';
    return message;
  }, [position, getGoogleMapsLink]);

  const handleSendToContact = useCallback((contact: EmergencyContactDB, includeLocation: boolean) => {
    setSendingTo(contact.id);
    const message = buildMessage(includeLocation);
    const url = getWhatsAppUrl(contact, message);
    window.open(url, '_blank');
    
    setTimeout(() => {
      setSendingTo(null);
      toast.success(`Mensaje enviado a ${contact.name}`);
    }, 500);
  }, [buildMessage, getWhatsAppUrl]);

  const handleSendToAll = useCallback((includeLocation: boolean) => {
    if (contacts.length === 0) {
      toast.error('No tienes contactos de emergencia');
      return;
    }

    const message = buildMessage(includeLocation);
    
    // Open WhatsApp for each contact with a small delay
    contacts.forEach((contact, index) => {
      setTimeout(() => {
        const url = getWhatsAppUrl(contact, message);
        window.open(url, '_blank');
      }, index * 800);
    });

    toast.success(`Abriendo WhatsApp para ${contacts.length} contacto(s)`);
    setIsOpen(false);
  }, [contacts, buildMessage, getWhatsAppUrl]);

  if (loading) return null;

  return (
    <div className={className}>
      {/* Main button */}
      <Button
        variant="outline"
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        className="bg-card/95 backdrop-blur-sm shadow-lg border-border hover:bg-accent"
        aria-label="Estoy bien"
      >
        <Heart className={`w-5 h-5 ${isOpen ? 'text-safe fill-safe' : 'text-safe'}`} />
      </Button>

      {/* Expanded panel */}
      {isOpen && (
        <div className="absolute bottom-full mb-2 right-0 bg-card/95 backdrop-blur-sm rounded-lg shadow-lg border border-border p-3 min-w-[240px]">
          <div className="text-xs font-medium text-foreground mb-2 flex items-center gap-1.5">
            <Heart className="w-3.5 h-3.5 text-safe" />
            Enviar "Estoy bien"
          </div>

          {!hasMinimumContacts ? (
            <div className="text-xs text-muted-foreground py-2">
              Agrega contactos de emergencia en Configuración para usar esta función.
            </div>
          ) : (
            <>
              {/* Quick send to all */}
              <div className="space-y-1.5 mb-3">
                <button
                  onClick={() => handleSendToAll(true)}
                  className="w-full flex items-center justify-between gap-2 px-2.5 py-2 text-sm rounded-md bg-safe/10 hover:bg-safe/20 text-safe transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <MessageCircle className="w-4 h-4" />
                    <span>Enviar a todos ({contacts.length})</span>
                  </span>
                  <ChevronRight className="w-4 h-4" />
                </button>
                
                {position && (
                  <button
                    onClick={() => handleSendToAll(false)}
                    className="w-full flex items-center justify-between gap-2 px-2.5 py-2 text-xs rounded-md hover:bg-accent text-muted-foreground transition-colors"
                  >
                    <span>Enviar sin ubicación</span>
                  </button>
                )}
              </div>

              {/* Individual contacts */}
              {contacts.length > 1 && (
                <>
                  <div className="text-[10px] uppercase text-muted-foreground mb-1.5 tracking-wide">
                    O enviar individualmente
                  </div>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {contacts.map(contact => (
                      <button
                        key={contact.id}
                        onClick={() => handleSendToContact(contact, !!position)}
                        disabled={sendingTo === contact.id}
                        className="w-full flex items-center justify-between gap-2 px-2 py-1.5 text-xs rounded hover:bg-accent transition-colors disabled:opacity-50"
                      >
                        <span className="flex items-center gap-2 truncate">
                          {contact.is_primary && (
                            <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                          )}
                          <span className="truncate">{contact.name}</span>
                          {contact.relationship && (
                            <span className="text-muted-foreground">({contact.relationship})</span>
                          )}
                        </span>
                        {sendingTo === contact.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <MessageCircle className="w-3 h-3 text-[#25D366]" />
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* Location indicator */}
              {position && (
                <div className="mt-2 pt-2 border-t border-border/50 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <MapPin className="w-3 h-3" />
                  <span>Incluirá tu ubicación actual</span>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
