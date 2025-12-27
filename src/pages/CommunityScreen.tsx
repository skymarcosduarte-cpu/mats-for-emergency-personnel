// Community Events Screen for COMUNIDAD EX SOS
// Message board for birthdays, health notices, hospital support, announcements + notifications

import React, { useState } from 'react';
import { 
  Cake, Heart, MessageSquarePlus, Loader2, RefreshCw, 
  Clock, User, AlertTriangle, Megaphone, Trash2, Bell, Check, ShoppingBag 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import { useCommunityEvents, CommunityEventType } from '@/hooks/useCommunityEvents';
import { useNotifications } from '@/hooks/useNotifications';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

const EVENT_TYPES: { value: CommunityEventType; label: string; icon: React.ReactNode }[] = [
  { value: 'BIRTHDAY', label: '🎂 Cumpleaños', icon: <Cake className="w-4 h-4" /> },
  { value: 'HEALTH_NOTICE', label: '🏥 Aviso de Salud', icon: <Heart className="w-4 h-4" /> },
  { value: 'HOSPITAL_SUPPORT', label: '💊 Apoyo Hospitalario', icon: <Heart className="w-4 h-4" /> },
  { value: 'DECEASE', label: '🕯️ Fallecimiento', icon: <Heart className="w-4 h-4" /> },
  { value: 'ANNOUNCEMENT', label: '📢 Anuncio', icon: <Megaphone className="w-4 h-4" /> },
];

export const CommunityScreen: React.FC = () => {
  const { user } = useAuth();
  const { 
    events, 
    birthdays, 
    loading, 
    createEvent, 
    deleteEvent,
    refresh,
    getEventTypeLabel,
    getEventTypeColor,
  } = useCommunityEvents();
  
  const { 
    notifications, 
    unreadCount, 
    loading: notificationsLoading, 
    markAsRead, 
    markAllAsRead, 
    deleteNotification 
  } = useNotifications();
  
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    event_type: '' as CommunityEventType | '',
    title: '',
    message: '',
  });

  const handleSubmit = async () => {
    if (!formData.event_type || !formData.title.trim()) {
      toast.error('Completa los campos obligatorios');
      return;
    }

    setSubmitting(true);
    try {
      await createEvent({
        event_type: formData.event_type,
        title: formData.title,
        message: formData.message || undefined,
      });
      
      toast.success('Evento publicado');
      setShowNewDialog(false);
      setFormData({ event_type: '', title: '', message: '' });
    } catch (err) {
      console.error('Error creating event:', err);
      toast.error('Error al publicar');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este evento?')) return;
    
    try {
      await deleteEvent(id);
      toast.success('Evento eliminado');
    } catch (err) {
      console.error('Error deleting event:', err);
      toast.error('Error al eliminar');
    }
  };

  return (
    <div className="flex-1 overflow-auto pb-20 scrollbar-thin">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-foreground">Comunidad</h1>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={refresh}
              disabled={loading}
            >
              <RefreshCw className={cn('w-5 h-5', loading && 'animate-spin')} />
            </Button>
            <Button
              size="sm"
              onClick={() => setShowNewDialog(true)}
            >
              <MessageSquarePlus className="w-4 h-4 mr-1" />
              Publicar
            </Button>
          </div>
        </div>
      </div>

      <Tabs defaultValue="tablero" className="p-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="tablero" className="text-xs">
            📋 Tablero
          </TabsTrigger>
          <TabsTrigger value="avisos" className="relative text-xs">
            🔔 Avisos
            {unreadCount > 0 && (
              <Badge 
                variant="destructive" 
                className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px]"
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Tablero Tab */}
        <TabsContent value="tablero" className="mt-4 space-y-4">
          {/* Today's Birthdays */}
          {birthdays.length > 0 && (
            <Card className="bg-gradient-to-r from-primary/10 to-accent/10 border-primary/30">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Cake className="w-5 h-5 text-primary" />
                  Cumpleaños Hoy 🎉
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {birthdays.map((birthday) => (
                  <div 
                    key={birthday.user_id}
                    className="flex items-center gap-3 p-2 bg-background/50 rounded-lg"
                  >
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-xl">
                      🎂
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{birthday.full_name}</p>
                      <p className="text-sm text-muted-foreground">@{birthday.nickname}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Events Feed */}
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground">Tablero de Avisos</h2>
            
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : events.length === 0 ? (
              <Card className="bg-card border-border">
                <CardContent className="py-12 text-center text-muted-foreground">
                  <MessageSquarePlus className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No hay avisos publicados</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => setShowNewDialog(true)}
                  >
                    Publicar el primero
                  </Button>
                </CardContent>
              </Card>
            ) : (
              events.map((event) => (
                <Card 
                  key={event.id} 
                  className={cn("border-l-4", getEventTypeColor(event.event_type as CommunityEventType))}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted">
                            {getEventTypeLabel(event.event_type as CommunityEventType)}
                          </span>
                        </div>
                        <h3 className="font-medium text-foreground">{event.title}</h3>
                        {event.message && (
                          <p className="text-sm text-muted-foreground mt-1">{event.message}</p>
                        )}
                        <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDistanceToNow(new Date(event.created_at), { 
                              addSuffix: true, 
                              locale: es 
                            })}
                          </span>
                        </div>
                      </div>
                      {event.user_id === user?.id && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(event.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* Avisos/Notifications Tab */}
        <TabsContent value="avisos" className="mt-4 space-y-3">
          {notifications.length > 0 && (
            <div className="flex justify-end mb-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllAsRead}
                className="text-xs"
              >
                <Check className="w-3 h-3 mr-1" />
                Marcar todo como leído
              </Button>
            </div>
          )}
          
          {notificationsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Bell className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No tienes notificaciones</p>
            </div>
          ) : (
            notifications.map((notification) => (
              <Card 
                key={notification.id} 
                className={cn(
                  "bg-card border-border transition-colors",
                  !notification.read && "border-l-4 border-l-primary"
                )}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3 flex-1">
                      <div className={cn(
                        "p-2 rounded-full",
                        notification.type === 'marketplace_contact' 
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground"
                      )}>
                        {notification.type === 'marketplace_contact' ? (
                          <ShoppingBag className="w-4 h-4" />
                        ) : (
                          <Bell className="w-4 h-4" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "text-sm",
                          !notification.read && "font-semibold"
                        )}>
                          {notification.title}
                        </p>
                        {notification.message && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {notification.message}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">
                          {formatDistanceToNow(new Date(notification.created_at), { 
                            addSuffix: true,
                            locale: es 
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {!notification.read && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => markAsRead(notification.id)}
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteNotification(notification.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* New Event Dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquarePlus className="w-5 h-5 text-primary" />
              Publicar Aviso
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label>Tipo de aviso *</Label>
              <Select
                value={formData.event_type}
                onValueChange={(v) => setFormData({ ...formData, event_type: v as CommunityEventType })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona tipo" />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Título *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Ej: Cumpleaños de Juan"
                maxLength={100}
              />
            </div>

            <div>
              <Label>Mensaje (opcional)</Label>
              <textarea
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                placeholder="Detalles adicionales..."
                className="w-full h-24 px-3 py-2 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground resize-none"
                maxLength={500}
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowNewDialog(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting || !formData.event_type || !formData.title.trim()}
                className="flex-1"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Publicar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
