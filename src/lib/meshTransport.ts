// Mesh BLE Transport Interface for COMUNIDAD EX SOS
// Web stub implementation - real BLE requires Capacitor wrapper

import type { MeshEnvelope, MeshMessageType } from '@/types';

export interface MeshTransport {
  isAvailable(): boolean;
  isActive(): boolean;
  start(): Promise<void>;
  stop(): void;
  broadcast(envelope: MeshEnvelope): void;
  onMessage(callback: (envelope: MeshEnvelope) => void): () => void;
}

// Check if BLE is available (always false in web)
function isBLEAvailable(): boolean {
  // In web browsers, BLE is limited and not suitable for mesh networking
  // Real implementation requires Capacitor with native BLE plugin
  return false;
}

// Detect iOS Safari
function isIOSSafari(): boolean {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) && !('MSStream' in window);
}

/**
 * Web Mesh Transport (Stub)
 * Real BLE mesh requires Capacitor native implementation
 */
class WebMeshTransport implements MeshTransport {
  private active = false;
  private messageCallbacks: Set<(envelope: MeshEnvelope) => void> = new Set();
  private messageQueue: MeshEnvelope[] = [];

  isAvailable(): boolean {
    return isBLEAvailable();
  }

  isActive(): boolean {
    return this.active;
  }

  async start(): Promise<void> {
    if (isIOSSafari()) {
      console.warn('Mesh BLE not available on iOS Safari. Requires native Capacitor app.');
      return;
    }

    if (!isBLEAvailable()) {
      console.warn('Mesh BLE not available in web browser. Requires native Capacitor app.');
      return;
    }

    this.active = true;
    console.log('Mesh transport started (stub mode)');
  }

  stop(): void {
    this.active = false;
    console.log('Mesh transport stopped');
  }

  broadcast(envelope: MeshEnvelope): void {
    if (!this.active) {
      // Queue for later if offline
      this.messageQueue.push(envelope);
      console.log('Mesh message queued (offline):', envelope.type);
      return;
    }

    // In stub mode, just log the message
    console.log('Mesh broadcast (stub):', envelope.type, envelope);
    
    // Simulate local echo for testing
    // In real implementation, this would go through BLE advertising
  }

  onMessage(callback: (envelope: MeshEnvelope) => void): () => void {
    this.messageCallbacks.add(callback);
    return () => {
      this.messageCallbacks.delete(callback);
    };
  }

  // For testing: simulate receiving a message
  simulateReceive(envelope: MeshEnvelope): void {
    this.messageCallbacks.forEach(cb => cb(envelope));
  }

  // Flush queued messages when coming back online
  flushQueue(): void {
    while (this.messageQueue.length > 0 && this.active) {
      const envelope = this.messageQueue.shift();
      if (envelope) {
        this.broadcast(envelope);
      }
    }
  }
}

// Singleton instance
let meshTransport: MeshTransport | null = null;

/**
 * Get mesh transport instance
 */
export function getMeshTransport(): MeshTransport {
  if (!meshTransport) {
    meshTransport = new WebMeshTransport();
  }
  return meshTransport;
}

/**
 * Create mesh envelope
 */
export function createMeshEnvelope(
  type: MeshMessageType,
  senderId: string,
  payload: unknown = {}
): MeshEnvelope {
  return {
    type,
    sender_id: senderId,
    timestamp: Date.now(),
    payload,
  };
}

/**
 * Check if mesh is available
 */
export function isMeshAvailable(): boolean {
  return getMeshTransport().isAvailable();
}

/**
 * Get mesh availability message
 */
export function getMeshStatusMessage(): string {
  if (isIOSSafari()) {
    return 'Mesh BLE no disponible en Safari iOS. Requiere app nativa.';
  }
  if (!isBLEAvailable()) {
    return 'Mesh BLE no disponible en navegador web. Requiere app nativa con Capacitor.';
  }
  return 'Mesh BLE disponible';
}

/*
 * CAPACITOR IMPLEMENTATION NOTES:
 * 
 * For real BLE mesh functionality, create a Capacitor plugin that:
 * 
 * 1. Uses CoreBluetooth (iOS) and BluetoothLeAdvertiser (Android)
 * 
 * 2. Implements BLE peripheral mode for advertising mesh messages
 * 
 * 3. Implements BLE central mode for scanning and receiving
 * 
 * 4. Store-and-forward: Cache received messages and re-broadcast
 * 
 * 5. Message deduplication using envelope timestamp + sender_id
 * 
 * 6. Encryption using mesh_group_keys from monthly test
 * 
 * Example Capacitor plugin interface:
 * 
 * interface CapacitorMeshPlugin {
 *   start(): Promise<void>;
 *   stop(): Promise<void>;
 *   broadcast(options: { envelope: string }): Promise<void>;
 *   addListener(eventName: 'messageReceived', callback: (data: { envelope: string }) => void): Promise<PluginListenerHandle>;
 * }
 */
