// Emergency Contacts Manager Component for COMUNIDAD EX SOS
// Manage local emergency contacts for WhatsApp integration

import React, { useState } from 'react';
import { UserPlus, Trash2, MessageCircle, Edit2, Check, X, Phone, Users } from 'lucide-react';
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
import { useEmergencyContacts, EmergencyContact } from '@/hooks/useEmergencyContacts';
import { cn } from '@/lib/utils';

interface EmergencyContactsManagerProps {
  className?: string;
}

export const EmergencyContactsManager: React.FC<EmergencyContactsManagerProps> = ({
  className,
}) => {
  const { contacts, loading, addContact, updateContact, deleteContact, getWhatsAppUrl } = useEmergencyContacts();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    relationship: '',
  });

  const handleAddSubmit = async () => {
    if (!formData.name || !formData.phone) return;
    
    await addContact(formData);
    setFormData({ name: '', phone: '', relationship: '' });
    setShowAddDialog(false);
  };

  const handleEditSubmit = async (id: string) => {
    if (!formData.name || !formData.phone) return;
    
    await updateContact(id, formData);
    setEditingId(null);
    setFormData({ name: '', phone: '', relationship: '' });
  };

  const startEditing = (contact: EmergencyContact) => {
    setEditingId(contact.id);
    setFormData({
      name: contact.name,
      phone: contact.phone,
      relationship: contact.relationship,
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setFormData({ name: '', phone: '', relationship: '' });
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Eliminar este contacto de emergencia?')) {
      await deleteContact(id);
    }
  };

  const testWhatsApp = (contact: EmergencyContact) => {
    const url = getWhatsAppUrl(contact, '🧪 Prueba de contacto de emergencia - COMUNIDAD EX SOS');
    window.open(url, '_blank');
  };

  if (loading) {
    return (
      <Card className={cn("bg-card border-border", className)}>
        <CardContent className="p-4 text-center text-muted-foreground">
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
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowAddDialog(true)}
            >
              <UserPlus className="w-4 h-4 mr-1" />
              Agregar
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Estos contactos se usarán para enviar alertas automáticas por WhatsApp.
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
                  className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg"
                >
                  {editingId === contact.id ? (
                    <div className="flex-1 space-y-2">
                      <Input
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Nombre"
                        className="h-8"
                      />
                      <Input
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="Teléfono"
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
                          className="flex-1"
                        >
                          <Check className="w-4 h-4 mr-1" />
                          Guardar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={cancelEditing}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                        {contact.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">{contact.name}</p>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {contact.phone}
                        </p>
                        {contact.relationship && (
                          <p className="text-xs text-muted-foreground">{contact.relationship}</p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-primary"
                          onClick={() => testWhatsApp(contact)}
                        >
                          <MessageCircle className="w-4 h-4" />
                        </Button>
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
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
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
        <DialogContent className="sm:max-w-md bg-card border-border">
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
                Se agregará código de México (+52) automáticamente si es necesario
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
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleAddSubmit}
                disabled={!formData.name || !formData.phone}
                className="flex-1"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Agregar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
