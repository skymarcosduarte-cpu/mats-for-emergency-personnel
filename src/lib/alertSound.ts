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
 * For nearby help requests (<30 miles)
 */
export function playUrgentSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  if (ctx.state === 'suspended') {
    ctx.resume();
  }

  const now = ctx.currentTime;
  
  // Three-tone urgent sequence
  const frequencies = [784, 988, 784]; // G5, B5, G5
  const delays = [0, 0.12, 0.24];
  
  frequencies.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = freq;
    osc.type = 'sine';
    const startTime = now + delays[i];
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(0.2, startTime + 0.02);
    gain.gain.linearRampToValueAtTime(0, startTime + 0.1);
    osc.start(startTime);
    osc.stop(startTime + 0.1);
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
 * Trigger a longer vibration pattern for urgent alerts
 */
export function triggerUrgentVibration(): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([150, 75, 150, 75, 150]);
    } catch (e) {
      console.warn('Vibration not supported');
    }
  }
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
 */
export function playUrgentAlert(): void {
  playUrgentSound();
  triggerUrgentVibration();
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
