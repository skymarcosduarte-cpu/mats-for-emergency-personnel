// Alert Sound Utility for COMUNIDAD EX SOS
// Plays notification sounds using Web Audio API

let audioContext: AudioContext | null = null;
let audioUnlocked = false;

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
 * Unlock audio context for iOS/mobile devices
 * Must be called from a user interaction event
 */
export function unlockAudioContext(): Promise<void> {
  return new Promise((resolve) => {
    const ctx = getAudioContext();
    if (!ctx) {
      resolve();
      return;
    }
    
    if (audioUnlocked && ctx.state === 'running') {
      resolve();
      return;
    }
    
    // Resume the audio context
    if (ctx.state === 'suspended') {
      ctx.resume().then(() => {
        console.log('Audio context resumed');
        audioUnlocked = true;
        resolve();
      }).catch((e) => {
        console.warn('Failed to resume audio context:', e);
        resolve();
      });
    } else {
      // Play a silent sound to unlock on iOS
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
      audioUnlocked = true;
      console.log('Audio unlocked with silent buffer');
      resolve();
    }
  });
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
 * Play a STRONG message notification sound (for internal messages)
 * Loud, attention-grabbing multi-tone sequence
 */
export function playMessageSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  if (ctx.state === 'suspended') {
    ctx.resume();
  }

  const now = ctx.currentTime;
  
  // Attention-grabbing ascending notification with harmonics
  const tones = [
    // First chord - bright start
    { freq: 784, delay: 0, duration: 0.15, volume: 0.35, type: 'sine' as OscillatorType },      // G5
    { freq: 988, delay: 0, duration: 0.15, volume: 0.25, type: 'sine' as OscillatorType },      // B5 (harmony)
    // Second chord - higher energy
    { freq: 1047, delay: 0.12, duration: 0.18, volume: 0.4, type: 'sine' as OscillatorType },   // C6
    { freq: 1319, delay: 0.12, duration: 0.18, volume: 0.3, type: 'sine' as OscillatorType },   // E6 (harmony)
    // Third chord - peak attention
    { freq: 1175, delay: 0.28, duration: 0.2, volume: 0.45, type: 'triangle' as OscillatorType }, // D6
    { freq: 1480, delay: 0.28, duration: 0.2, volume: 0.35, type: 'triangle' as OscillatorType }, // F#6 (harmony)
    // Final bright accent
    { freq: 1568, delay: 0.45, duration: 0.25, volume: 0.4, type: 'sine' as OscillatorType },   // G6
  ];
  
  tones.forEach(({ freq, delay, duration, volume, type }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = freq;
    osc.type = type;
    const startTime = now + delay;
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(volume, startTime + 0.02);
    gain.gain.setValueAtTime(volume, startTime + duration * 0.6);
    gain.gain.linearRampToValueAtTime(0, startTime + duration);
    osc.start(startTime);
    osc.stop(startTime + duration);
  });
}

/**
 * Trigger a strong vibration pattern for messages
 * More noticeable than before
 */
export function triggerMessageVibration(): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      // Strong double-pulse pattern
      navigator.vibrate([
        150, 80, 150, 80, 200,  // Three strong pulses
        150,                     // Pause
        100, 50, 100, 50, 100   // Quick attention bursts
      ]);
    } catch (e) {
      console.warn('Vibration not supported');
    }
  }
}

/**
 * Play message notification (sound + vibration)
 * Strong and attention-grabbing
 * Automatically tries to resume audio context if suspended
 */
export function playMessageNotification(): void {
  const ctx = getAudioContext();
  
  // Try to resume context if suspended (common when app was in background)
  if (ctx && ctx.state === 'suspended') {
    console.log('🔊 [AlertSound] Audio context suspended, attempting to resume...');
    ctx.resume().then(() => {
      console.log('🔊 [AlertSound] Audio context resumed successfully');
      playMessageSound();
      triggerMessageVibration();
      
      // Repeat sound after a short delay for extra attention
      setTimeout(() => {
        playMessageSound();
      }, 800);
    }).catch((e) => {
      console.warn('🔇 [AlertSound] Failed to resume audio context:', e);
      // Still try to vibrate even if audio fails
      triggerMessageVibration();
    });
  } else {
    console.log('🔔 [AlertSound] Playing message notification sound');
    playMessageSound();
    triggerMessageVibration();
    
    // Repeat sound after a short delay for extra attention
    setTimeout(() => {
      playMessageSound();
    }, 800);
  }
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

/**
 * Play EXTREME emergency alert sound for Clave 100
 * Maximum volume, piercing alarm - this is the highest priority alert
 */
export function playClave100Sound(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) {
      console.warn('Clave100: No audio context available');
      return;
    }

    // Resume audio context if suspended (user gesture required)
    if (ctx.state === 'suspended') {
      ctx.resume().catch(e => console.warn('Failed to resume audio context:', e));
    }

    const now = ctx.currentTime;
    
    // Create a compressor for maximum loudness
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -50;
    compressor.knee.value = 40;
    compressor.ratio.value = 12;
    compressor.attack.value = 0;
    compressor.release.value = 0.25;
    compressor.connect(ctx.destination);
    
    // Intense continuous siren - European emergency style
    const sirenDuration = 3; // 3 seconds of continuous alarm
    
    // Main siren oscillator with frequency sweep
    const sirenOsc = ctx.createOscillator();
    const sirenGain = ctx.createGain();
    sirenOsc.connect(sirenGain);
    sirenGain.connect(compressor);
    sirenOsc.type = 'sawtooth'; // Harsh, attention-grabbing
    sirenGain.gain.setValueAtTime(0.8, now);
    
    // Sweep frequency up and down like a real siren
    sirenOsc.frequency.setValueAtTime(600, now);
    for (let i = 0; i < 6; i++) {
      const cycleStart = now + i * 0.5;
      sirenOsc.frequency.linearRampToValueAtTime(1400, cycleStart + 0.25);
      sirenOsc.frequency.linearRampToValueAtTime(600, cycleStart + 0.5);
    }
    sirenOsc.start(now);
    sirenOsc.stop(now + sirenDuration);
    sirenGain.gain.setValueAtTime(0.8, now + sirenDuration - 0.1);
    sirenGain.gain.linearRampToValueAtTime(0, now + sirenDuration);
    
    // Add a secondary piercing alarm layer
    const alarmOsc = ctx.createOscillator();
    const alarmGain = ctx.createGain();
    alarmOsc.connect(alarmGain);
    alarmGain.connect(compressor);
    alarmOsc.type = 'square'; // Very piercing
    alarmGain.gain.setValueAtTime(0.5, now);
    
    // Rapid alternating beeps
    for (let i = 0; i < 15; i++) {
      const beepStart = now + i * 0.2;
      alarmOsc.frequency.setValueAtTime(i % 2 === 0 ? 1800 : 1200, beepStart);
    }
    alarmOsc.start(now);
    alarmOsc.stop(now + sirenDuration);
    alarmGain.gain.setValueAtTime(0.5, now + sirenDuration - 0.1);
    alarmGain.gain.linearRampToValueAtTime(0, now + sirenDuration);
    
    // Add low frequency rumble for physical impact
    const bassOsc = ctx.createOscillator();
    const bassGain = ctx.createGain();
    bassOsc.connect(bassGain);
    bassGain.connect(compressor);
    bassOsc.type = 'sine';
    bassOsc.frequency.value = 80; // Deep bass
    bassGain.gain.setValueAtTime(0.6, now);
    bassOsc.start(now);
    bassOsc.stop(now + sirenDuration);
    bassGain.gain.setValueAtTime(0.6, now + sirenDuration - 0.1);
    bassGain.gain.linearRampToValueAtTime(0, now + sirenDuration);
    
    // Final piercing warning beeps after siren - connect to destination directly
    const warningTones = [
      { freq: 2000, delay: sirenDuration + 0.1, duration: 0.15 },
      { freq: 2000, delay: sirenDuration + 0.3, duration: 0.15 },
      { freq: 2000, delay: sirenDuration + 0.5, duration: 0.15 },
      { freq: 2400, delay: sirenDuration + 0.7, duration: 0.3 },
    ];
    
    warningTones.forEach(({ freq, delay, duration }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination); // Connect directly to avoid timing issues
      osc.frequency.value = freq;
      osc.type = 'square';
      const startTime = now + delay;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.9, startTime + 0.01);
      gain.gain.setValueAtTime(0.9, startTime + duration - 0.02);
      gain.gain.linearRampToValueAtTime(0, startTime + duration);
      osc.start(startTime);
      osc.stop(startTime + duration);
    });
    
    console.log('Clave100: Sound playing');
  } catch (e) {
    console.error('Clave100: Error playing sound:', e);
  }
}

/**
 * Trigger EXTREME vibration pattern for Clave 100
 * Continuous, intense, impossible to ignore
 */
export function triggerClave100Vibration(): void {
  console.log('Clave100: Triggering vibration');
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      const result = navigator.vibrate([
        // Initial shock - very long continuous
        1000, 100,
        // Rapid intense bursts
        200, 50, 200, 50, 200, 50, 200, 50, 200, 50,
        150,
        // Long emergency pulses
        800, 100, 800, 100, 800,
        150,
        // Machine gun bursts
        100, 30, 100, 30, 100, 30, 100, 30, 100, 30, 100, 30, 100, 30, 100,
        200,
        // Final long attention grab
        1200, 150,
        // Quick finish
        150, 50, 150, 50, 150, 50, 150
      ]);
      console.log('Clave100: Vibration result:', result);
    } catch (e) {
      console.warn('Clave100: Vibration not supported', e);
    }
  } else {
    console.log('Clave100: Vibration API not available');
  }
}

// Store interval IDs for persistent alerts
let clave100SoundInterval: ReturnType<typeof setInterval> | null = null;
let clave100VibrationInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Stop the persistent Clave 100 alert
 */
export function stopClave100Alert(): void {
  if (clave100SoundInterval) {
    clearInterval(clave100SoundInterval);
    clave100SoundInterval = null;
  }
  if (clave100VibrationInterval) {
    clearInterval(clave100VibrationInterval);
    clave100VibrationInterval = null;
  }
  // Stop any ongoing vibration
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(0);
  }
}

/**
 * Play Clave 100 alert - MAXIMUM EMERGENCY
 * Continuous sound and vibration until dismissed
 */
export async function playClave100Alert(): Promise<void> {
  console.log('🚨 Clave100Alert: STARTING MAXIMUM EMERGENCY ALERT');
  
  // Stop any existing alert first
  stopClave100Alert();
  
  // Unlock audio context first (critical for iOS/mobile)
  await unlockAudioContext();
  
  // Resume audio context if needed
  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') {
    try {
      await ctx.resume();
      console.log('Clave100Alert: Audio context resumed');
    } catch (e) {
      console.error('Clave100Alert: Failed to resume audio context:', e);
    }
  }
  
  // Play immediately
  try {
    playClave100Sound();
    triggerClave100Vibration();
  } catch (e) {
    console.error('Clave100Alert: Error on initial play:', e);
  }
  
  // Retry after a short delay (helps with audio context issues on mobile)
  setTimeout(() => {
    try {
      playClave100Sound();
      triggerClave100Vibration();
    } catch (e) {
      console.error('Clave100Alert: Error on retry:', e);
    }
  }, 500);
  
  // Additional retry for stubborn mobile browsers
  setTimeout(() => {
    try {
      playClave100Sound();
    } catch (e) {
      console.error('Clave100Alert: Error on second retry:', e);
    }
  }, 1500);
  
  // Keep repeating sound every 4 seconds until stopped
  clave100SoundInterval = setInterval(() => {
    try {
      playClave100Sound();
    } catch (e) {
      console.error('Clave100Alert: Error in sound interval:', e);
    }
  }, 4000);
  
  // Keep repeating vibration every 6 seconds until stopped
  clave100VibrationInterval = setInterval(() => {
    try {
      triggerClave100Vibration();
    } catch (e) {
      console.error('Clave100Alert: Error in vibration interval:', e);
    }
  }, 6000);
  
  // Auto-stop after 60 seconds as a safety measure
  setTimeout(() => {
    console.log('Clave100Alert: Auto-stopping after 60 seconds');
    stopClave100Alert();
  }, 60000);
}
