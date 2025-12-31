import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Users, Shield, Ticket, Calendar, Search, RefreshCw, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
} from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';

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

interface AdminPanelProps {
  open: boolean;
  onClose: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ open, onClose }) => {
  const { role } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [invites, setInvites] = useState<InviteStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'users' | 'invites'>('users');

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
    } finally {
      setLoading(false);
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
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Panel de Administración
          </DialogTitle>
        </DialogHeader>

        {/* Stats summary */}
        <div className="grid grid-cols-3 gap-4 mb-4">
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
        <div className="flex gap-2 border-b border-border pb-2">
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
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
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
          <div className="flex-1 overflow-auto">
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invites.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
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
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
