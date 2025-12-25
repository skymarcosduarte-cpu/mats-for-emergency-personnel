// Emergency Contacts Manager Component for COMUNIDAD EX SOS
// Manage emergency contacts in database for WhatsApp integration

import React, { useState } from 'react';
import { UserPlus, Trash2, MessageCircle, Edit2, Check, X, Phone, Users, Star, Mail, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useEmergencyContactsDB, EmergencyContactDB, MAX_EMERGENCY_CONTACTS, MIN_EMERGENCY_CONTACTS } from '@/hooks/useEmergencyContactsDB';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface EmergencyContactsManagerProps {
  className?: string;
}

export const EmergencyContactsManager: React.FC<EmergencyContactsManagerProps> = ({
  className,
}) => {
  const { 
    contacts, 
    loading, 
    error,
    addContact, 
    updateContact, 
    deleteContact, 
    setPrimaryContact,
    getWhatsAppUrl,
    canAddMore,
    hasMinimumContacts
  } = useEmergencyContactsDB();
  const { toast } = useToast();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    whatsapp: '',
    relationship: '',
  });

  const resetForm = () => {
    setFormData({ name: '', phone: '', email: '', whatsapp: '', relationship: '' });
  };

  const handleAddSubmit = async () => {
    if (!formData.name || !formData.phone || !formData.email) {
      toast({ title: 'Error', description: 'Nombre, teléfono y email son requeridos', variant: 'destructive' });
      return;
    }
    
    setSubmitting(true);
    try {
      await addContact(formData);
      resetForm();
      setShowAddDialog(false);
      toast({ title: 'Contacto agregado', description: `${formData.name} fue agregado correctamente` });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (id: string) => {
    if (!formData.name || !formData.phone || !formData.email) {
      toast({ title: 'Error', description: 'Nombre, teléfono y email son requeridos', variant: 'destructive' });
      return;
    }
    
    setSubmitting(true);
    try {
      await updateContact(id, formData);
      setEditingId(null);
      resetForm();
      toast({ title: 'Contacto actualizado' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const startEditing = (contact: EmergencyContactDB) => {
    setEditingId(contact.id);
    setFormData({
      name: contact.name,
      phone: contact.phone,
      email: contact.email || '',
      whatsapp: contact.whatsapp || '',
      relationship: contact.relationship || '',
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    resetForm();
  };

  const handleDelete = async (id: string) => {
    if (contacts.length <= MIN_EMERGENCY_CONTACTS) {
      toast({ 
        title: 'No se puede eliminar', 
        description: `Se requiere al menos ${MIN_EMERGENCY_CONTACTS} contacto de emergencia`,
        variant: 'destructive'
      });
      return;
    }
    
    if (confirm('¿Eliminar este contacto de emergencia?')) {
      try {
        await deleteContact(id);
        toast({ title: 'Contacto eliminado' });
      } catch (err: any) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' });
      }
    }
  };

  const handleSetPrimary = async (id: string) => {
    try {
      await setPrimaryContact(id);
      toast({ title: 'Contacto principal actualizado' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const testWhatsApp = (contact: EmergencyContactDB) => {
    const url = getWhatsAppUrl(contact, '🧪 Prueba de contacto de emergencia - COMUNIDAD EX SOS');
    window.open(url, '_blank');
  };

  if (loading) {
    return (
      <Card className={cn("bg-card border-border", className)}>
        <CardContent className="p-4 flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Cargando contactos...
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className={cn("bg-card border-border", className)}>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Contactos de Emergencia
              <span className="text-xs font-normal text-muted-foreground">
                ({contacts.length}/{MAX_EMERGENCY_CONTACTS})
              </span>
            </div>
            {canAddMore && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowAddDialog(true)}
              >
                <UserPlus className="w-4 h-4 mr-1" />
                Agregar
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Warning if no minimum contacts */}
          {!hasMinimumContacts && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-sm">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>Se requiere al menos {MIN_EMERGENCY_CONTACTS} contacto de emergencia con email, teléfono y WhatsApp para poder usar el botón SOS.</span>
            </div>
          )}

          <p className="text-sm text-muted-foreground">
            Estos contactos serán notificados automáticamente cuando actives el botón SOS.
          </p>
          
          {contacts.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No hay contactos agregados</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => setShowAddDialog(true)}
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Agregar contacto
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {contacts.map((contact) => (
                <div
                  key={contact.id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg",
                    contact.is_primary ? "bg-primary/10 border border-primary/30" : "bg-muted/30"
                  )}
                >
                  {editingId === contact.id ? (
                    <div className="flex-1 space-y-2">
                      <Input
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Nombre *"
                        className="h-8"
                      />
                      <Input
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="Teléfono *"
                        type="tel"
                        className="h-8"
                      />
                      <Input
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="Email *"
                        type="email"
                        className="h-8"
                      />
                      <Input
                        value={formData.whatsapp}
                        onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                        placeholder="WhatsApp (si es diferente al teléfono)"
                        type="tel"
                        className="h-8"
                      />
                      <Input
                        value={formData.relationship}
                        onChange={(e) => setFormData({ ...formData, relationship: e.target.value })}
                        placeholder="Relación (opcional)"
                        className="h-8"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleEditSubmit(contact.id)}
                          disabled={submitting}
                          className="flex-1"
                        >
                          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
                          Guardar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={cancelEditing}
                          disabled={submitting}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="relative">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                          {contact.name.charAt(0).toUpperCase()}
                        </div>
                        {contact.is_primary && (
                          <Star className="w-4 h-4 text-primary absolute -top-1 -right-1 fill-primary" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-foreground truncate">{contact.name}</p>
                          {contact.is_primary && (
                            <span className="text-xs text-primary font-medium">Principal</span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {contact.phone}
                        </p>
                        {contact.email && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {contact.email}
                          </p>
                        )}
                        {contact.relationship && (
                          <p className="text-xs text-muted-foreground">{contact.relationship}</p>
                        )}
                      </div>
                      <div className="flex flex-col gap-1">
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-primary"
                            onClick={() => testWhatsApp(contact)}
                            title="Probar WhatsApp"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </Button>
                          {!contact.is_primary && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-muted-foreground hover:text-primary"
                              onClick={() => handleSetPrimary(contact.id)}
                              title="Marcar como principal"
                            >
                              <Star className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => startEditing(contact)}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive"
                            onClick={() => handleDelete(contact.id)}
                            disabled={contacts.length <= MIN_EMERGENCY_CONTACTS}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Contact Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" />
              Agregar Contacto de Emergencia
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label>Nombre *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Juan Pérez"
              />
            </div>
            <div>
              <Label>Teléfono *</Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="55 1234 5678"
                type="tel"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Se agregará código de México (+52) automáticamente
              </p>
            </div>
            <div>
              <Label>Email *</Label>
              <Input
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="contacto@email.com"
                type="email"
              />
            </div>
            <div>
              <Label>WhatsApp (opcional)</Label>
              <Input
                value={formData.whatsapp}
                onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                placeholder="Si es diferente al teléfono"
                type="tel"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Dejar vacío si es el mismo que el teléfono
              </p>
            </div>
            <div>
              <Label>Relación (opcional)</Label>
              <Input
                value={formData.relationship}
                onChange={(e) => setFormData({ ...formData, relationship: e.target.value })}
                placeholder="Familiar, amigo, vecino..."
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowAddDialog(false)}
                disabled={submitting}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleAddSubmit}
                disabled={!formData.name || !formData.phone || !formData.email || submitting}
                className="flex-1"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <UserPlus className="w-4 h-4 mr-2" />
                )}
                Agregar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
