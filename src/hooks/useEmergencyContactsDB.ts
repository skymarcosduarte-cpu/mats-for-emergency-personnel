// Emergency Contacts Database Hook for COMUNIDAD EX SOS
// Store and manage emergency contacts in Supabase (min 1, max 5)
// With offline support and automatic sync

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  getOfflineQueue,
  addToOfflineQueue,
  removeFromOfflineQueue,
  incrementRetry,
  cacheContactsLocally,
  getCachedContacts,
  type ContactOperation,
} from '@/lib/contactsOfflineQueue';

export interface EmergencyContactDB {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  email: string | null;
  whatsapp: string | null;
  relationship: string | null;
  is_primary: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// Local pending contact (not yet synced)
export interface PendingContact extends Omit<EmergencyContactDB, 'id' | 'user_id' | 'created_at' | 'updated_at'> {
  id: string; // temporary local id
  _pending: true;
  _operationId: string;
}

export const MAX_EMERGENCY_CONTACTS = 5;
export const MIN_EMERGENCY_CONTACTS = 1;

export function useEmergencyContactsDB() {
  const [contacts, setContacts] = useState<(EmergencyContactDB | PendingContact)[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingSync, setPendingSync] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const syncingRef = useRef(false);

  const AUTH_TIMEOUT_MS = 8000;
  const FETCH_TIMEOUT_MS = 12000;
  const MUTATION_TIMEOUT_MS = 15000;

  const withTimeout = useCallback(<T,>(
    promise: PromiseLike<T>,
    ms: number,
    label: string
  ): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
      const t = setTimeout(() => {
        reject(new Error(`timeout:${label}`));
      }, ms);

      Promise.resolve(promise).then(
        (value) => {
          clearTimeout(t);
          resolve(value);
        },
        (err) => {
          clearTimeout(t);
          reject(err);
        }
      );
    });
  }, []);

  // Check online status
  const checkOnline = useCallback(() => {
    const online = typeof navigator !== 'undefined' && 'onLine' in navigator ? navigator.onLine : true;
    setIsOffline(!online);
    return online;
  }, []);

  // Process a single pending operation
  const processOperation = useCallback(async (op: ContactOperation, userId: string): Promise<boolean> => {
    try {
      if (op.type === 'add') {
        const { error: insertError } = await withTimeout(
          supabase
            .from('emergency_contacts')
            .insert({
              user_id: userId,
              name: op.data.name as string,
              phone: op.data.phone as string,
              email: (op.data.email as string) || null,
              whatsapp: (op.data.whatsapp as string) || (op.data.phone as string),
              relationship: (op.data.relationship as string) || null,
              is_primary: op.data.is_primary as boolean,
              sort_order: op.data.sort_order as number,
            }),
          MUTATION_TIMEOUT_MS,
          'sync_add'
        );
        if (insertError) throw insertError;
      } else if (op.type === 'update') {
        const { error: updateError } = await withTimeout(
          supabase
            .from('emergency_contacts')
            .update(op.data)
            .eq('id', op.data.id as string),
          MUTATION_TIMEOUT_MS,
          'sync_update'
        );
        if (updateError) throw updateError;
      } else if (op.type === 'delete') {
        const { error: deleteError } = await withTimeout(
          supabase
            .from('emergency_contacts')
            .delete()
            .eq('id', op.data.id as string),
          MUTATION_TIMEOUT_MS,
          'sync_delete'
        );
        if (deleteError) throw deleteError;
      }
      return true;
    } catch (err) {
      console.error('Failed to process operation:', op.type, err);
      return false;
    }
  }, [withTimeout]);

  // Sync pending operations
  const syncPendingOperations = useCallback(async () => {
    if (syncingRef.current || !checkOnline()) return;
    
    syncingRef.current = true;
    setSyncing(true);

    try {
      const { data: authData } = await withTimeout(
        supabase.auth.getUser(),
        AUTH_TIMEOUT_MS,
        'auth_sync'
      );
      if (!authData.user) {
        syncingRef.current = false;
        setSyncing(false);
        return;
      }

      const queue = await getOfflineQueue();
      if (queue.length === 0) {
        syncingRef.current = false;
        setSyncing(false);
        return;
      }

      console.log(`[ContactsSync] Processing ${queue.length} pending operations`);

      for (const op of queue) {
        const success = await processOperation(op, authData.user.id);
        if (success) {
          await removeFromOfflineQueue(op.id);
        } else {
          const shouldRetry = await incrementRetry(op.id);
          if (!shouldRetry) {
            console.warn('[ContactsSync] Operation failed after max retries:', op);
          }
        }
      }

      // Update pending count
      const remaining = await getOfflineQueue();
      setPendingSync(remaining.length);

    } catch (err) {
      console.error('[ContactsSync] Sync failed:', err);
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, [checkOnline, processOperation, withTimeout]);

  // Fetch contacts from server or cache
  const fetchContacts = useCallback(async () => {
    setError(null);
    const online = checkOnline();

    // If offline, try to load from cache
    if (!online) {
      const cached = await getCachedContacts();
      if (cached) {
        setContacts(cached.contacts as EmergencyContactDB[]);
        setError('Modo offline. Mostrando datos en caché.');
      } else {
        setContacts([]);
        setError('Sin conexión y sin datos en caché.');
      }
      setInitialized(true);
      setLoading(false);
      
      // Load any pending operations to show as pending contacts
      const pending = await getOfflineQueue();
      setPendingSync(pending.length);
      return;
    }

    setLoading(true);

    try {
      const { data: authData, error: authError } = await withTimeout(
        supabase.auth.getUser(),
        AUTH_TIMEOUT_MS,
        'auth'
      );

      if (authError) throw authError;

      const user = authData.user;
      if (!user) {
        setContacts([]);
        setInitialized(true);
        return;
      }

      const { data, error: fetchError } = await withTimeout(
        supabase
          .from('emergency_contacts')
          .select('*')
          .eq('user_id', user.id)
          .order('sort_order', { ascending: true }),
        FETCH_TIMEOUT_MS,
        'fetch_contacts'
      );

      if (fetchError) throw fetchError;

      const serverContacts = (data || []) as EmergencyContactDB[];
      setContacts(serverContacts);
      setInitialized(true);

      // Cache for offline use
      await cacheContactsLocally(serverContacts);

      // Sync any pending operations
      await syncPendingOperations();

      // Update pending count
      const pending = await getOfflineQueue();
      setPendingSync(pending.length);

    } catch (err) {
      console.error('Error fetching contacts:', err);
      const msg = err instanceof Error ? err.message : String(err);

      // Try cache on network error
      const cached = await getCachedContacts();
      if (cached) {
        setContacts(cached.contacts as EmergencyContactDB[]);
        setError('Error de red. Mostrando datos en caché.');
      } else if (msg.startsWith('timeout:')) {
        setError('Tiempo de espera al cargar contactos. Revisa tu conexión.');
      } else {
        setError('Error al cargar contactos');
      }

      setInitialized(true);
    } finally {
      setLoading(false);
    }
  }, [checkOnline, syncPendingOperations, withTimeout]);

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      console.log('[ContactsSync] Back online, syncing...');
      setIsOffline(false);
      syncPendingOperations().then(() => fetchContacts());
    };

    const handleOffline = () => {
      console.log('[ContactsSync] Went offline');
      setIsOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncPendingOperations, fetchContacts]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  // Add contact (with offline support)
  const addContact = useCallback(async (contact: {
    name: string;
    phone: string;
    email?: string;
    whatsapp?: string;
    relationship?: string;
    is_primary?: boolean;
  }) => {
    const realContacts = contacts.filter(c => !('_pending' in c));
    if (realContacts.length >= MAX_EMERGENCY_CONTACTS) {
      throw new Error(`Máximo ${MAX_EMERGENCY_CONTACTS} contactos permitidos`);
    }

    // Validate required fields
    const cleanName = contact.name?.trim();
    const cleanPhone = contact.phone?.trim();
    
    if (!cleanName || cleanName.length < 2) {
      throw new Error('El nombre debe tener al menos 2 caracteres');
    }
    if (!cleanPhone || cleanPhone.length < 8) {
      throw new Error('El teléfono debe tener al menos 8 dígitos');
    }

    const online = checkOnline();

    if (!online) {
      // Queue for later sync
      const pendingData = {
        name: cleanName,
        phone: cleanPhone,
        email: contact.email?.trim() || null,
        whatsapp: contact.whatsapp?.trim() || cleanPhone,
        relationship: contact.relationship?.trim() || null,
        is_primary: contact.is_primary || realContacts.length === 0,
        sort_order: realContacts.length,
      };

      const op = await addToOfflineQueue({ type: 'add', data: pendingData });
      
      // Add to local state as pending
      const pendingContact: PendingContact = {
        id: `pending_${op.id}`,
        name: cleanName,
        phone: cleanPhone,
        email: contact.email?.trim() || null,
        whatsapp: contact.whatsapp?.trim() || cleanPhone,
        relationship: contact.relationship?.trim() || null,
        is_primary: pendingData.is_primary,
        sort_order: pendingData.sort_order,
        _pending: true,
        _operationId: op.id,
      };

      setContacts(prev => [...prev, pendingContact]);
      setPendingSync(prev => prev + 1);

      // Also update cache
      const currentCache = await getCachedContacts();
      if (currentCache) {
        await cacheContactsLocally([...currentCache.contacts, pendingContact]);
      }

      return pendingContact;
    }

    // Online path
    try {
      const { data: authData, error: authError } = await withTimeout(
        supabase.auth.getUser(),
        AUTH_TIMEOUT_MS,
        'auth_add'
      );

      if (authError) {
        throw new Error('Error de autenticación. Cierra sesión y vuelve a iniciar.');
      }

      const user = authData.user;
      if (!user) {
        throw new Error('Debes iniciar sesión para agregar contactos');
      }

      const { data, error: insertError } = await withTimeout(
        supabase
          .from('emergency_contacts')
          .insert({
            user_id: user.id,
            name: cleanName,
            phone: cleanPhone,
            email: contact.email?.trim() || null,
            whatsapp: contact.whatsapp?.trim() || cleanPhone,
            relationship: contact.relationship?.trim() || null,
            is_primary: contact.is_primary || realContacts.length === 0,
            sort_order: realContacts.length,
          })
          .select()
          .single(),
        MUTATION_TIMEOUT_MS,
        'insert_contact'
      );

      if (insertError) {
        if (insertError.code === '42501') {
          throw new Error('No tienes permisos. Intenta cerrar sesión.');
        }
        throw new Error(insertError.message || 'Error al guardar');
      }
      
      await fetchContacts();
      return data;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.startsWith('timeout:')) {
        throw new Error('Tiempo de espera agotado. Revisa tu conexión.');
      }
      throw err;
    }
  }, [contacts, checkOnline, fetchContacts, withTimeout]);

  // Update contact
  const updateContact = useCallback(async (id: string, updates: Partial<{
    name: string;
    phone: string;
    email: string | null;
    whatsapp: string | null;
    relationship: string | null;
    is_primary: boolean;
    sort_order: number;
  }>) => {
    const online = checkOnline();

    if (!online) {
      // Queue for later
      await addToOfflineQueue({ type: 'update', data: { id, ...updates } });
      
      // Update local state
      setContacts(prev => prev.map(c => 
        c.id === id ? { ...c, ...updates } : c
      ));
      setPendingSync(prev => prev + 1);
      return;
    }

    try {
      const { error: updateError } = await withTimeout(
        supabase
          .from('emergency_contacts')
          .update(updates)
          .eq('id', id),
        MUTATION_TIMEOUT_MS,
        'update_contact'
      );

      if (updateError) throw updateError;
      
      await fetchContacts();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.startsWith('timeout:')) {
        throw new Error('Tiempo de espera agotado. Revisa tu conexión.');
      }
      throw err;
    }
  }, [checkOnline, fetchContacts, withTimeout]);

  // Delete contact
  const deleteContact = useCallback(async (id: string) => {
    const online = checkOnline();

    // Check if it's a pending contact
    const contact = contacts.find(c => c.id === id);
    if (contact && '_pending' in contact) {
      // Just remove from queue and local state
      await removeFromOfflineQueue(contact._operationId);
      setContacts(prev => prev.filter(c => c.id !== id));
      setPendingSync(prev => Math.max(0, prev - 1));
      return;
    }

    if (!online) {
      await addToOfflineQueue({ type: 'delete', data: { id } });
      setContacts(prev => prev.filter(c => c.id !== id));
      setPendingSync(prev => prev + 1);
      return;
    }

    try {
      const { data: authData } = await withTimeout(
        supabase.auth.getUser(),
        AUTH_TIMEOUT_MS,
        'auth_delete'
      );
      if (!authData.user) throw new Error('Not authenticated');

      const { error: deleteError } = await withTimeout(
        supabase
          .from('emergency_contacts')
          .delete()
          .eq('id', id),
        MUTATION_TIMEOUT_MS,
        'delete_contact'
      );

      if (deleteError) throw deleteError;
      
      await fetchContacts();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.startsWith('timeout:')) {
        throw new Error('Tiempo de espera agotado. Revisa tu conexión.');
      }
      throw err;
    }
  }, [contacts, checkOnline, fetchContacts, withTimeout]);

  // Set primary contact
  const setPrimaryContact = useCallback(async (id: string) => {
    const online = checkOnline();

    if (!online) {
      throw new Error('Sin conexión. Esta acción requiere internet.');
    }

    try {
      const { data: authData } = await withTimeout(
        supabase.auth.getUser(),
        AUTH_TIMEOUT_MS,
        'auth_primary'
      );
      if (!authData.user) throw new Error('Not authenticated');

      await withTimeout(
        supabase
          .from('emergency_contacts')
          .update({ is_primary: false })
          .eq('user_id', authData.user.id),
        MUTATION_TIMEOUT_MS,
        'unset_primary'
      );

      await withTimeout(
        supabase
          .from('emergency_contacts')
          .update({ is_primary: true })
          .eq('id', id),
        MUTATION_TIMEOUT_MS,
        'set_primary'
      );

      await fetchContacts();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.startsWith('timeout:')) {
        throw new Error('Tiempo de espera agotado. Revisa tu conexión.');
      }
      throw err;
    }
  }, [checkOnline, fetchContacts, withTimeout]);

  // Format phone for WhatsApp
  const formatPhoneForWhatsApp = (phone: string): string => {
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      cleaned = '52' + cleaned;
    }
    return cleaned;
  };

  // Get WhatsApp URL - accepts any object with phone and optional whatsapp
  const getWhatsAppUrl = (contact: { phone: string; whatsapp?: string | null }, message: string): string => {
    const phone = formatPhoneForWhatsApp(contact.whatsapp || contact.phone);
    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  };

  // Get all WhatsApp URLs for SOS
  const getSOSWhatsAppUrls = (message: string): { contact: EmergencyContactDB | PendingContact; url: string }[] => {
    return contacts.map(contact => ({
      contact,
      url: getWhatsAppUrl(contact, message),
    }));
  };

  // Filter out pending for minimum check
  const realContacts = contacts.filter(c => !('_pending' in c));
  const hasMinimumContacts = initialized && realContacts.length >= MIN_EMERGENCY_CONTACTS;
  const primaryContact = realContacts.find(c => c.is_primary) || realContacts[0];

  return {
    contacts,
    loading,
    initialized,
    error,
    isOffline,
    pendingSync,
    syncing,
    addContact,
    updateContact,
    deleteContact,
    setPrimaryContact,
    getWhatsAppUrl,
    getSOSWhatsAppUrls,
    hasMinimumContacts,
    primaryContact,
    canAddMore: realContacts.length < MAX_EMERGENCY_CONTACTS,
    refresh: fetchContacts,
    syncNow: syncPendingOperations,
    formatPhoneForWhatsApp,
  };
}
