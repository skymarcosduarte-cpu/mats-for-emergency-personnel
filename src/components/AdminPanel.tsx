import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Users, Shield, Ticket, Calendar, Search, RefreshCw, X, Plus, Copy, Check, Loader2, MessageSquare, Mail, MailOpen, TrendingUp, Pencil } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { UserEditDialog } from './UserEditDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface AdminUser {
  user_id: string;
  full_name: string | null;
  nickname: string | null;
  phone: string | null;
  invite_code_used: string | null;
  registered_at: string | null;
  role: string | null;
}

interface InviteStats {
  code: string;
  max_uses: number | null;
  used_count: number;
  created_at: string;
}

interface MessageStats {
  total_messages: number;
  total_read: number;
  total_unread: number;
  unique_senders: number;
  unique_receivers: number;
  messages_today: number;
  messages_this_week: number;
}

interface BroadcastMessage {
  id: string;
  message: string;
  created_at: string;
  total_sent: number;
  total_read: number;
}

interface AdminPanelProps {
  open: boolean;
  onClose: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ open, onClose }) => {
  const { role, user } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [invites, setInvites] = useState<InviteStats[]>([]);
  const [messageStats, setMessageStats] = useState<MessageStats | null>(null);
  const [broadcastMessages, setBroadcastMessages] = useState<BroadcastMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'users' | 'invites' | 'messages'>('users');
  
  // Create invite form state
  const [showCreateInvite, setShowCreateInvite] = useState(false);
  const [newCodeName, setNewCodeName] = useState('');
  const [newCodeMaxUses, setNewCodeMaxUses] = useState<string>('10');
  const [creatingCode, setCreatingCode] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  
  // User edit state
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  const isAdmin = role === 'SOS_ACTIVO';

  const fetchData = async () => {
    if (!isAdmin) return;
    
    setLoading(true);
    try {
      // Fetch users from admin view
      const { data: usersData, error: usersError } = await supabase
        .from('admin_users_view')
        .select('*')
        .order('registered_at', { ascending: false });

      if (usersError) {
        console.error('Error fetching users:', usersError);
      } else {
        setUsers(usersData || []);
      }

      // Fetch invite codes
      const { data: invitesData, error: invitesError } = await supabase
        .from('invites')
        .select('code, max_uses, used_count, created_at')
        .order('created_at', { ascending: false });

      if (invitesError) {
        console.error('Error fetching invites:', invitesError);
      } else {
        setInvites(invitesData || []);
      }

      // Fetch message statistics
      await fetchMessageStats();
    } finally {
      setLoading(false);
    }
  };

  const fetchMessageStats = async () => {
    try {
      // Get all messages for stats (using admin query)
      const { data: allMessages, error: messagesError } = await supabase
        .from('internal_messages')
        .select('id, read, sender_id, receiver_id, created_at, message');

      if (messagesError) {
        console.error('Error fetching messages:', messagesError);
        return;
      }

      const messages = allMessages || [];
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(todayStart);
      weekStart.setDate(weekStart.getDate() - 7);

      const stats: MessageStats = {
        total_messages: messages.length,
        total_read: messages.filter(m => m.read).length,
        total_unread: messages.filter(m => !m.read).length,
        unique_senders: new Set(messages.map(m => m.sender_id)).size,
        unique_receivers: new Set(messages.map(m => m.receiver_id)).size,
        messages_today: messages.filter(m => new Date(m.created_at) >= todayStart).length,
        messages_this_week: messages.filter(m => new Date(m.created_at) >= weekStart).length,
      };

      setMessageStats(stats);

      // Find broadcast messages (messages sent by same sender to many recipients at similar times)
      const senderGroups = messages.reduce((acc, msg) => {
        const key = `${msg.sender_id}-${msg.message.substring(0, 50)}`;
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(msg);
        return acc;
      }, {} as Record<string, typeof messages>);

      const broadcasts: BroadcastMessage[] = Object.entries(senderGroups)
        .filter(([_, msgs]) => msgs.length >= 5) // At least 5 recipients = broadcast
        .map(([_, msgs]) => ({
          id: msgs[0].id,
          message: msgs[0].message.length > 100 ? msgs[0].message.substring(0, 100) + '...' : msgs[0].message,
          created_at: msgs[0].created_at,
          total_sent: msgs.length,
          total_read: msgs.filter(m => m.read).length,
        }))
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 10);

      setBroadcastMessages(broadcasts);
    } catch (err) {
      console.error('Error calculating message stats:', err);
    }
  };

  useEffect(() => {
    if (open && isAdmin) {
      fetchData();
    }
  }, [open, isAdmin]);

  const filteredUsers = users.filter(user => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      user.full_name?.toLowerCase().includes(query) ||
      user.nickname?.toLowerCase().includes(query) ||
      user.phone?.includes(query) ||
      user.invite_code_used?.toLowerCase().includes(query)
    );
  });

  const getRoleBadge = (role: string | null) => {
    switch (role) {
      case 'SOS_ACTIVO':
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">SOS Activo</Badge>;
      case 'EX_SOS':
        return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">Ex SOS</Badge>;
      case 'FAMILIAR':
        return <Badge variant="secondary">Familiar</Badge>;
      default:
        return <Badge variant="outline">Sin rol</Badge>;
    }
  };

  // Generate random code
  const generateRandomCode = (): string => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid confusing chars like 0/O, 1/I
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  // Create new invite code
  const handleCreateInvite = async () => {
    if (!user?.id) return;

    setCreatingCode(true);
    try {
      // Generate code: use custom name or random
      const codeBase = newCodeName.trim().toUpperCase().replace(/[^A-Z0-9]/g, '') || generateRandomCode();
      const code = codeBase.length > 20 ? codeBase.slice(0, 20) : codeBase;
      
      // Parse max uses
      const maxUses = newCodeMaxUses.trim() === '' || newCodeMaxUses === '0' 
        ? null 
        : parseInt(newCodeMaxUses, 10);

      if (maxUses !== null && (isNaN(maxUses) || maxUses < 1)) {
        toast.error('El límite de usos debe ser un número positivo o vacío para ilimitado');
        setCreatingCode(false);
        return;
      }

      // Check if code already exists
      const { data: existing } = await supabase
        .from('invites')
        .select('code')
        .eq('code', code)
        .maybeSingle();

      if (existing) {
        toast.error('Este código ya existe. Usa otro nombre.');
        setCreatingCode(false);
        return;
      }

      // Create the invite
      const { error } = await supabase
        .from('invites')
        .insert({
          code,
          max_uses: maxUses,
          created_by: user.id,
        });

      if (error) {
        console.error('Error creating invite:', error);
        toast.error('Error al crear código: ' + error.message);
      } else {
        toast.success(`Código ${code} creado exitosamente`);
        setShowCreateInvite(false);
        setNewCodeName('');
        setNewCodeMaxUses('10');
        fetchData(); // Refresh list
      }
    } finally {
      setCreatingCode(false);
    }
  };

  // Copy code to clipboard
  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      toast.success('Código copiado');
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (err) {
      toast.error('Error al copiar');
    }
  };

  if (!isAdmin) {
    return (
      <Dialog open={open} onOpenChange={() => onClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Acceso Restringido</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            Solo los administradores (SOS Activo) pueden acceder a este panel.
          </p>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={() => onClose()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Panel de Administración
            </DialogTitle>
          </DialogHeader>

          {/* Stats summary */}
          <div className="grid grid-cols-4 gap-3 mb-4">
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <Users className="w-5 h-5 mx-auto mb-1 text-primary" />
              <div className="text-2xl font-bold">{users.length}</div>
              <div className="text-xs text-muted-foreground">Usuarios</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <Ticket className="w-5 h-5 mx-auto mb-1 text-amber-500" />
              <div className="text-2xl font-bold">{invites.length}</div>
              <div className="text-xs text-muted-foreground">Códigos</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <MessageSquare className="w-5 h-5 mx-auto mb-1 text-blue-500" />
              <div className="text-2xl font-bold">{messageStats?.total_messages || 0}</div>
              <div className="text-xs text-muted-foreground">Mensajes</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <Calendar className="w-5 h-5 mx-auto mb-1 text-emerald-500" />
              <div className="text-2xl font-bold">
                {users.filter(u => {
                  if (!u.registered_at) return false;
                  const date = new Date(u.registered_at);
                  const now = new Date();
                  return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
                }).length}
              </div>
              <div className="text-xs text-muted-foreground">Este mes</div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 border-b border-border pb-2 flex-wrap">
            <Button
              variant={activeTab === 'users' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('users')}
            >
              <Users className="w-4 h-4 mr-1" />
              Usuarios
            </Button>
            <Button
              variant={activeTab === 'invites' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('invites')}
            >
              <Ticket className="w-4 h-4 mr-1" />
              Códigos
            </Button>
            <Button
              variant={activeTab === 'messages' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('messages')}
            >
              <MessageSquare className="w-4 h-4 mr-1" />
              Mensajes
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchData}
              className="ml-auto"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {activeTab === 'users' && (
            <>
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre, teléfono o código..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Users table */}
              <div className="flex-1 overflow-auto">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Apodo</TableHead>
                        <TableHead>Código Usado</TableHead>
                        <TableHead>Rol</TableHead>
                        <TableHead>Registro</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            {searchQuery ? 'No se encontraron usuarios' : 'No hay usuarios registrados'}
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredUsers.map((user) => (
                          <TableRow key={user.user_id}>
                            <TableCell className="font-medium">
                              {user.full_name || <span className="text-muted-foreground italic">Sin nombre</span>}
                            </TableCell>
                            <TableCell>{user.nickname || '-'}</TableCell>
                            <TableCell>
                              {user.invite_code_used ? (
                                <code className="bg-muted px-1.5 py-0.5 rounded text-xs">
                                  {user.invite_code_used}
                                </code>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>{getRoleBadge(user.role)}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {user.registered_at
                                ? format(new Date(user.registered_at), 'dd MMM yyyy', { locale: es })
                                : '-'}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditingUserId(user.user_id)}
                                className="h-8 w-8 p-0"
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                )}
              </div>
            </>
          )}

          {activeTab === 'invites' && (
            <div className="flex-1 overflow-auto flex flex-col gap-4">
              {/* Create new code button */}
              <Button
                onClick={() => setShowCreateInvite(true)}
                className="w-full"
                variant="outline"
              >
                <Plus className="w-4 h-4 mr-2" />
                Crear Nuevo Código
              </Button>

              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Usos</TableHead>
                      <TableHead>Límite</TableHead>
                      <TableHead>Creado</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invites.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          No hay códigos de invitación
                        </TableCell>
                      </TableRow>
                    ) : (
                      invites.map((invite) => (
                        <TableRow key={invite.code}>
                          <TableCell>
                            <code className="bg-muted px-2 py-1 rounded font-mono">
                              {invite.code}
                            </code>
                          </TableCell>
                          <TableCell>
                            <span className="font-medium">{invite.used_count}</span>
                          </TableCell>
                          <TableCell>
                            {invite.max_uses !== null ? (
                              <Badge variant={invite.used_count >= invite.max_uses ? 'destructive' : 'outline'}>
                                {invite.max_uses}
                              </Badge>
                            ) : (
                              <Badge variant="secondary">∞</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {format(new Date(invite.created_at), 'dd MMM yyyy', { locale: es })}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCopyCode(invite.code)}
                            >
                              {copiedCode === invite.code ? (
                                <Check className="w-4 h-4 text-emerald-500" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </div>
          )}

          {activeTab === 'messages' && (
            <div className="flex-1 overflow-auto space-y-4">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : messageStats ? (
                <>
                  {/* Message Stats Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-center">
                      <MessageSquare className="w-5 h-5 mx-auto mb-1 text-blue-500" />
                      <div className="text-xl font-bold">{messageStats.total_messages}</div>
                      <div className="text-xs text-muted-foreground">Total mensajes</div>
                    </div>
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 text-center">
                      <MailOpen className="w-5 h-5 mx-auto mb-1 text-emerald-500" />
                      <div className="text-xl font-bold">{messageStats.total_read}</div>
                      <div className="text-xs text-muted-foreground">Leídos</div>
                    </div>
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-center">
                      <Mail className="w-5 h-5 mx-auto mb-1 text-amber-500" />
                      <div className="text-xl font-bold">{messageStats.total_unread}</div>
                      <div className="text-xs text-muted-foreground">No leídos</div>
                    </div>
                    <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3 text-center">
                      <TrendingUp className="w-5 h-5 mx-auto mb-1 text-purple-500" />
                      <div className="text-xl font-bold">
                        {messageStats.total_messages > 0 
                          ? Math.round((messageStats.total_read / messageStats.total_messages) * 100) 
                          : 0}%
                      </div>
                      <div className="text-xs text-muted-foreground">Tasa lectura</div>
                    </div>
                  </div>

                  {/* Activity Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-muted/50 rounded-lg p-3 text-center">
                      <div className="text-lg font-bold text-primary">{messageStats.messages_today}</div>
                      <div className="text-xs text-muted-foreground">Hoy</div>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3 text-center">
                      <div className="text-lg font-bold text-primary">{messageStats.messages_this_week}</div>
                      <div className="text-xs text-muted-foreground">Esta semana</div>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3 text-center">
                      <div className="text-lg font-bold">{messageStats.unique_senders}</div>
                      <div className="text-xs text-muted-foreground">Remitentes</div>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3 text-center">
                      <div className="text-lg font-bold">{messageStats.unique_receivers}</div>
                      <div className="text-xs text-muted-foreground">Destinatarios</div>
                    </div>
                  </div>

                  {/* Broadcast Messages */}
                  {broadcastMessages.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="font-semibold text-sm flex items-center gap-2">
                        <MessageSquare className="w-4 h-4" />
                        Mensajes Masivos Recientes
                      </h3>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Mensaje</TableHead>
                            <TableHead className="w-20">Enviados</TableHead>
                            <TableHead className="w-20">Leídos</TableHead>
                            <TableHead className="w-20">%</TableHead>
                            <TableHead className="w-28">Fecha</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {broadcastMessages.map((msg) => (
                            <TableRow key={msg.id}>
                              <TableCell className="max-w-[200px] truncate text-sm">
                                {msg.message}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{msg.total_sent}</Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-600">
                                  {msg.total_read}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <span className="font-medium">
                                  {Math.round((msg.total_read / msg.total_sent) * 100)}%
                                </span>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {format(new Date(msg.created_at), 'dd MMM HH:mm', { locale: es })}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {broadcastMessages.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No hay mensajes masivos recientes</p>
                      <p className="text-xs">Los mensajes enviados a 5+ usuarios aparecerán aquí</p>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No se pudieron cargar las estadísticas
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Invite Dialog */}
      <Dialog open={showCreateInvite} onOpenChange={setShowCreateInvite}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ticket className="w-5 h-5 text-primary" />
              Crear Código de Invitación
            </DialogTitle>
            <DialogDescription>
              Crea un nuevo código para invitar usuarios a la comunidad.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="code-name">Nombre del código (opcional)</Label>
              <Input
                id="code-name"
                placeholder="Ej: MATS2025, EVENTO, etc."
                value={newCodeName}
                onChange={(e) => setNewCodeName(e.target.value.toUpperCase())}
                maxLength={20}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Deja vacío para generar un código aleatorio. Solo letras y números.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="max-uses">Límite de usos</Label>
              <Input
                id="max-uses"
                type="number"
                placeholder="10"
                value={newCodeMaxUses}
                onChange={(e) => setNewCodeMaxUses(e.target.value)}
                min={0}
              />
              <p className="text-xs text-muted-foreground">
                Deja en 0 o vacío para usos ilimitados.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateInvite(false)}
              disabled={creatingCode}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreateInvite}
              disabled={creatingCode}
            >
              {creatingCode ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              Crear Código
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* User Edit Dialog */}
      <UserEditDialog
        open={!!editingUserId}
        onClose={() => setEditingUserId(null)}
        userId={editingUserId || ''}
        onUpdated={fetchData}
      />
    </>
  );
};
