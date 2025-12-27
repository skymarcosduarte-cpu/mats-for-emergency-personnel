// Alert Sound Utility for COMUNIDAD EX SOS
// Plays notification sounds using Web Audio API

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  
  if (!audioContext) {
    try {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (e) {
      console.warn('Web Audio API not supported');
      return null;
    }
  }
  return audioContext;
}

/**
 * Play a short, gentle notification tone (for earthquakes)
 * Uses two soft tones (like a gentle "ding-dong")
 */
export function playAlertSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  if (ctx.state === 'suspended') {
    ctx.resume();
  }

  const now = ctx.currentTime;
  
  // First tone - higher pitch
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.connect(gain1);
  gain1.connect(ctx.destination);
  osc1.frequency.value = 880; // A5
  osc1.type = 'sine';
  gain1.gain.setValueAtTime(0, now);
  gain1.gain.linearRampToValueAtTime(0.15, now + 0.02);
  gain1.gain.linearRampToValueAtTime(0, now + 0.15);
  osc1.start(now);
  osc1.stop(now + 0.15);

  // Second tone - lower pitch
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.connect(gain2);
  gain2.connect(ctx.destination);
  osc2.frequency.value = 659; // E5
  osc2.type = 'sine';
  gain2.gain.setValueAtTime(0, now + 0.12);
  gain2.gain.linearRampToValueAtTime(0.15, now + 0.14);
  gain2.gain.linearRampToValueAtTime(0, now + 0.35);
  osc2.start(now + 0.12);
  osc2.stop(now + 0.35);
}

/**
 * Play a subtle, non-disturbing notification sound
 * For distant help requests (>30 miles)
 */
export function playSubtleSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  if (ctx.state === 'suspended') {
    ctx.resume();
  }

  const now = ctx.currentTime;
  
  // Single soft chime
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.frequency.value = 523; // C5
  osc.type = 'sine';
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.08, now + 0.02);
  gain.gain.linearRampToValueAtTime(0, now + 0.25);
  osc.start(now);
  osc.stop(now + 0.25);
}

/**
 * Play a more prominent urgent alert sound
 * For nearby help requests (<30 miles) - ENHANCED for attention
 */
export function playUrgentSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  if (ctx.state === 'suspended') {
    ctx.resume();
  }

  const now = ctx.currentTime;
  
  // Enhanced attention-grabbing siren-like pattern with 3 cycles
  // Uses alternating high-low tones like emergency sirens
  const sirenCycles = [
    // Cycle 1
    { freq: 880, delay: 0, duration: 0.15, volume: 0.35 },      // A5 high
    { freq: 587, delay: 0.15, duration: 0.15, volume: 0.35 },   // D5 low
    // Cycle 2
    { freq: 988, delay: 0.35, duration: 0.15, volume: 0.4 },    // B5 higher
    { freq: 659, delay: 0.5, duration: 0.15, volume: 0.4 },     // E5 low
    // Cycle 3 - loudest
    { freq: 1047, delay: 0.7, duration: 0.2, volume: 0.45 },    // C6 highest
    { freq: 784, delay: 0.9, duration: 0.2, volume: 0.45 },     // G5 
    // Final attention beeps
    { freq: 1175, delay: 1.15, duration: 0.1, volume: 0.5 },    // D6
    { freq: 1175, delay: 1.3, duration: 0.1, volume: 0.5 },     // D6
    { freq: 1175, delay: 1.45, duration: 0.15, volume: 0.5 },   // D6 (longer)
  ];
  
  sirenCycles.forEach(({ freq, delay, duration, volume }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = freq;
    osc.type = 'square'; // Square wave is more piercing/attention-grabbing
    const startTime = now + delay;
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(volume, startTime + 0.02);
    gain.gain.linearRampToValueAtTime(volume * 0.8, startTime + duration * 0.5);
    gain.gain.linearRampToValueAtTime(0, startTime + duration);
    osc.start(startTime);
    osc.stop(startTime + duration);
  });
}

/**
 * Trigger a short vibration pattern (gentle double tap)
 */
export function triggerVibration(): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([100, 50, 100]);
    } catch (e) {
      console.warn('Vibration not supported');
    }
  }
}

/**
 * Trigger a longer, more attention-grabbing vibration pattern for urgent alerts
 * Extended SOS-like pattern with multiple repetitions for silent mode
 */
export function triggerUrgentVibration(): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      // Extended intense vibration pattern - longer and more persistent
      // Perfect for when device is in silent mode (cine, junta, etc.)
      navigator.vibrate([
        // Round 1 - SOS pattern
        150, 75, 150, 75, 150,   // 3 short bursts
        200,                      // pause
        300, 100, 300, 100, 300, // 3 long bursts
        200,                      // pause
        150, 75, 150, 75, 150,   // 3 short bursts
        400,                      // longer pause
        // Round 2 - continuous attention
        200, 50, 200, 50, 200, 50, 200, 50, 200,
        300,                      // pause
        // Round 3 - final urgent bursts
        100, 30, 100, 30, 100, 30, 100, 30, 100, 30, 100
      ]);
    } catch (e) {
      console.warn('Vibration not supported');
    }
  }
}

/**
 * Trigger repeated urgent vibrations over time
 * For maximum attention in silent mode scenarios
 */
export function triggerPersistentUrgentVibration(): void {
  // Vibrate immediately
  triggerUrgentVibration();
  
  // Repeat vibration after 3 seconds if user hasn't interacted
  setTimeout(() => {
    triggerUrgentVibration();
  }, 3000);
  
  // One more time after 6 seconds
  setTimeout(() => {
    triggerUrgentVibration();
  }, 6000);
}

/**
 * Play alert sound and vibration together (for earthquakes)
 */
export function playAlertWithVibration(): void {
  playAlertSound();
  triggerVibration();
}

/**
 * Play subtle alert for distant help requests
 */
export function playSubtleAlert(): void {
  playSubtleSound();
  triggerVibration();
}

/**
 * Play urgent alert for nearby help requests
 * Uses persistent vibration for silent mode scenarios
 */
export function playUrgentAlert(): void {
  playUrgentSound();
  triggerPersistentUrgentVibration();
}

/**
 * Play a positive, reassuring sound for good news (e.g., help is on the way)
 * Uses ascending tones to convey hope/relief
 */
export function playPositiveSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  if (ctx.state === 'suspended') {
    ctx.resume();
  }

  const now = ctx.currentTime;
  
  // Ascending three-tone sequence (hopeful/positive)
  const frequencies = [523, 659, 784]; // C5, E5, G5 (major chord arpeggio)
  const delays = [0, 0.15, 0.3];
  
  frequencies.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = freq;
    osc.type = 'sine';
    const startTime = now + delays[i];
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(0.18, startTime + 0.03);
    gain.gain.linearRampToValueAtTime(0, startTime + 0.2);
    osc.start(startTime);
    osc.stop(startTime + 0.2);
  });
}

/**
 * Trigger a gentle reassuring vibration pattern
 */
export function triggerPositiveVibration(): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([80, 80, 80, 80, 150]);
    } catch (e) {
      console.warn('Vibration not supported');
    }
  }
}

/**
 * Play positive alert for good news (help arriving, resolved, etc.)
 */
export function playPositiveAlert(): void {
  playPositiveSound();
  triggerPositiveVibration();
}

/**
 * Play a soft message notification sound (for internal messages)
 * Uses two gentle ascending tones
 */
export function playMessageSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  if (ctx.state === 'suspended') {
    ctx.resume();
  }

  const now = ctx.currentTime;
  
  // Two soft ascending tones (like a gentle notification)
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.connect(gain1);
  gain1.connect(ctx.destination);
  osc1.frequency.value = 587; // D5
  osc1.type = 'sine';
  gain1.gain.setValueAtTime(0, now);
  gain1.gain.linearRampToValueAtTime(0.12, now + 0.02);
  gain1.gain.linearRampToValueAtTime(0, now + 0.12);
  osc1.start(now);
  osc1.stop(now + 0.12);

  // Second higher tone
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.connect(gain2);
  gain2.connect(ctx.destination);
  osc2.frequency.value = 880; // A5
  osc2.type = 'sine';
  gain2.gain.setValueAtTime(0, now + 0.1);
  gain2.gain.linearRampToValueAtTime(0.12, now + 0.12);
  gain2.gain.linearRampToValueAtTime(0, now + 0.25);
  osc2.start(now + 0.1);
  osc2.stop(now + 0.25);
}

/**
 * Trigger a short gentle vibration for messages
 */
export function triggerMessageVibration(): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([50, 30, 50]);
    } catch (e) {
      console.warn('Vibration not supported');
    }
  }
}

/**
 * Play message notification (sound + vibration)
 */
export function playMessageNotification(): void {
  playMessageSound();
  triggerMessageVibration();
}

/**
 * Play a descending "cancelled/warning" sound
 * Uses descending tones to convey something stopped or was cancelled
 */
export function playCancelledSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  if (ctx.state === 'suspended') {
    ctx.resume();
  }

  const now = ctx.currentTime;
  
  // Descending two-tone sequence (like a "woop-woop" down)
  const frequencies = [659, 440]; // E5 to A4 (descending)
  const delays = [0, 0.2];
  
  frequencies.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = freq;
    osc.type = 'triangle';
    const startTime = now + delays[i];
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(0.2, startTime + 0.03);
    gain.gain.linearRampToValueAtTime(0, startTime + 0.18);
    osc.start(startTime);
    osc.stop(startTime + 0.18);
  });
}

/**
 * Trigger a soft vibration for cancellation
 */
export function triggerCancelVibration(): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([100, 100, 200]);
    } catch (e) {
      console.warn('Vibration not supported');
    }
  }
}

/**
 * Play cancelled alert (sound + vibration)
 */
export function playCancelledAlert(): void {
  playCancelledSound();
  triggerCancelVibration();
}
