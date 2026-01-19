// Emergency Contacts Database Hook for COMUNIDAD EX SOS
// Store and manage emergency contacts in Supabase (min 1, max 5)

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

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

export const MAX_EMERGENCY_CONTACTS = 5;
export const MIN_EMERGENCY_CONTACTS = 1;

export function useEmergencyContactsDB() {
  const [contacts, setContacts] = useState<EmergencyContactDB[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch contacts
  const fetchContacts = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setContacts([]);
        setLoading(false);
        setInitialized(true);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('emergency_contacts')
        .select('*')
        .eq('user_id', user.id)
        .order('sort_order', { ascending: true });

      if (fetchError) throw fetchError;
      
      setContacts((data || []) as EmergencyContactDB[]);
      setInitialized(true);
    } catch (err) {
      console.error('Error fetching contacts:', err);
      setError('Error al cargar contactos');
      setInitialized(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  // Add contact
  const addContact = useCallback(async (contact: {
    name: string;
    phone: string;
    email?: string;
    whatsapp?: string;
    relationship?: string;
    is_primary?: boolean;
  }) => {
    if (contacts.length >= MAX_EMERGENCY_CONTACTS) {
      throw new Error(`Máximo ${MAX_EMERGENCY_CONTACTS} contactos permitidos`);
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) {
      console.error('Auth error when adding contact:', authError);
      throw new Error('Error de autenticación. Por favor, cierra sesión y vuelve a iniciar.');
    }
    if (!user) {
      throw new Error('Debes iniciar sesión para agregar contactos de emergencia');
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

    const { data, error: insertError } = await supabase
      .from('emergency_contacts')
      .insert({
        user_id: user.id,
        name: cleanName,
        phone: cleanPhone,
        email: contact.email?.trim() || null,
        whatsapp: contact.whatsapp?.trim() || cleanPhone, // Default to phone if not provided
        relationship: contact.relationship?.trim() || null,
        is_primary: contact.is_primary || contacts.length === 0, // First contact is primary
        sort_order: contacts.length,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      if (insertError.code === '42501') {
        throw new Error('No tienes permisos para agregar contactos. Intenta cerrar sesión y volver a iniciar.');
      }
      throw new Error(insertError.message || 'Error al guardar el contacto');
    }
    
    await fetchContacts();
    return data;
  }, [contacts, fetchContacts]);

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
    const { error: updateError } = await supabase
      .from('emergency_contacts')
      .update(updates)
      .eq('id', id);

    if (updateError) throw updateError;
    
    await fetchContacts();
  }, [fetchContacts]);

  // Delete contact
  const deleteContact = useCallback(async (id: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error: deleteError } = await supabase
      .from('emergency_contacts')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;
    
    await fetchContacts();
  }, [fetchContacts]);

  // Set primary contact
  const setPrimaryContact = useCallback(async (id: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // First, unset all as primary
    await supabase
      .from('emergency_contacts')
      .update({ is_primary: false })
      .eq('user_id', user.id);

    // Then set the selected one as primary
    await supabase
      .from('emergency_contacts')
      .update({ is_primary: true })
      .eq('id', id);

    await fetchContacts();
  }, [fetchContacts]);

  // Format phone for WhatsApp
  const formatPhoneForWhatsApp = (phone: string): string => {
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      cleaned = '52' + cleaned; // Mexico country code
    }
    return cleaned;
  };

  // Get WhatsApp URL
  const getWhatsAppUrl = (contact: EmergencyContactDB, message: string): string => {
    const phone = formatPhoneForWhatsApp(contact.whatsapp || contact.phone);
    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  };

  // Get all WhatsApp URLs for SOS
  const getSOSWhatsAppUrls = (message: string): { contact: EmergencyContactDB; url: string }[] => {
    return contacts.map(contact => ({
      contact,
      url: getWhatsAppUrl(contact, message),
    }));
  };

  // Check if user has minimum contacts - only valid after initialization
  const hasMinimumContacts = initialized && contacts.length >= MIN_EMERGENCY_CONTACTS;

  // Get primary contact
  const primaryContact = contacts.find(c => c.is_primary) || contacts[0];

  return {
    contacts,
    loading,
    initialized,
    error,
    addContact,
    updateContact,
    deleteContact,
    setPrimaryContact,
    getWhatsAppUrl,
    getSOSWhatsAppUrls,
    hasMinimumContacts,
    primaryContact,
    canAddMore: contacts.length < MAX_EMERGENCY_CONTACTS,
    refresh: fetchContacts,
    formatPhoneForWhatsApp,
  };
}
