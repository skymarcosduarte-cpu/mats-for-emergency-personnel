// Emergency Contacts Hook for COMUNIDAD EX SOS
// Store and manage local emergency contacts for WhatsApp integration

import { useState, useEffect, useCallback } from 'react';
import { get, set, createStore } from 'idb-keyval';

const CONTACTS_STORE = createStore('exsos-contacts', 'emergency');
const CONTACTS_KEY = 'emergency_contacts';

export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relationship: string;
}

/**
 * Hook for managing emergency contacts
 */
export function useEmergencyContacts() {
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [loading, setLoading] = useState(true);

  // Load contacts from IndexedDB
  const loadContacts = useCallback(async () => {
    try {
      const stored = await get<EmergencyContact[]>(CONTACTS_KEY, CONTACTS_STORE);
      setContacts(stored || []);
    } catch (error) {
      console.error('Error loading contacts:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  // Save contacts to IndexedDB
  const saveContacts = useCallback(async (newContacts: EmergencyContact[]) => {
    await set(CONTACTS_KEY, newContacts, CONTACTS_STORE);
    setContacts(newContacts);
  }, []);

  // Add a new contact
  const addContact = useCallback(async (contact: Omit<EmergencyContact, 'id'>) => {
    const newContact: EmergencyContact = {
      ...contact,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
    const updated = [...contacts, newContact];
    await saveContacts(updated);
    return newContact;
  }, [contacts, saveContacts]);

  // Update existing contact
  const updateContact = useCallback(async (id: string, updates: Partial<Omit<EmergencyContact, 'id'>>) => {
    const updated = contacts.map(c => 
      c.id === id ? { ...c, ...updates } : c
    );
    await saveContacts(updated);
  }, [contacts, saveContacts]);

  // Delete contact
  const deleteContact = useCallback(async (id: string) => {
    const updated = contacts.filter(c => c.id !== id);
    await saveContacts(updated);
  }, [contacts, saveContacts]);

  // Format phone for WhatsApp
  const formatPhoneForWhatsApp = useCallback((phone: string): string => {
    // Remove all non-numeric characters
    let cleaned = phone.replace(/\D/g, '');
    
    // Add Mexico country code if not present
    if (cleaned.length === 10) {
      cleaned = '52' + cleaned;
    }
    
    return cleaned;
  }, []);

  // Generate WhatsApp message URL for a contact
  const getWhatsAppUrl = useCallback((contact: EmergencyContact, message: string): string => {
    const phone = formatPhoneForWhatsApp(contact.phone);
    const encodedMessage = encodeURIComponent(message);
    return `https://wa.me/${phone}?text=${encodedMessage}`;
  }, [formatPhoneForWhatsApp]);

  // Get all WhatsApp URLs for emergency broadcast
  const getEmergencyBroadcastUrls = useCallback((message: string): { contact: EmergencyContact; url: string }[] => {
    return contacts.map(contact => ({
      contact,
      url: getWhatsAppUrl(contact, message),
    }));
  }, [contacts, getWhatsAppUrl]);

  // Open WhatsApp for first contact
  const sendToFirstContact = useCallback((message: string): boolean => {
    if (contacts.length === 0) return false;
    
    const url = getWhatsAppUrl(contacts[0], message);
    window.open(url, '_blank');
    return true;
  }, [contacts, getWhatsAppUrl]);

  return {
    contacts,
    loading,
    addContact,
    updateContact,
    deleteContact,
    getWhatsAppUrl,
    getEmergencyBroadcastUrls,
    sendToFirstContact,
    formatPhoneForWhatsApp,
    refresh: loadContacts,
  };
}
