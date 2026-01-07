// Welcome Sound Utility for COMUNIDAD EX SOS
// Creates an elegant, premium-feeling welcome chime

// Premium welcome chime using Web Audio API
export async function playWelcomeSound(): Promise<void> {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) {
      console.log('[welcomeSound] AudioContext not supported');
      return;
    }

    const ctx = new AudioContext();
    const masterGain = ctx.createGain();
    masterGain.connect(ctx.destination);
    masterGain.gain.value = 0.15; // Subtle volume

    const now = ctx.currentTime;

    // Create a luxurious multi-layered chime
    const playNote = (freq: number, startTime: number, duration: number, type: OscillatorType = 'sine') => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = type;
      osc.frequency.value = freq;
      
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.3, startTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
      
      osc.connect(gain);
      gain.connect(masterGain);
      
      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    // Ethereal ascending chord progression (C major 7th with extensions)
    // First chord - gentle entrance
    playNote(261.63, now, 2.0, 'sine');        // C4
    playNote(329.63, now + 0.05, 1.8, 'sine'); // E4
    playNote(392.00, now + 0.1, 1.6, 'sine');  // G4
    
    // Second chord - rising
    playNote(493.88, now + 0.3, 1.5, 'sine');  // B4
    playNote(523.25, now + 0.5, 1.3, 'sine');  // C5
    
    // Sparkle notes - higher octave
    playNote(659.25, now + 0.7, 1.0, 'sine');  // E5
    playNote(783.99, now + 0.9, 0.8, 'sine');  // G5
    
    // Final shimmer
    playNote(1046.50, now + 1.2, 0.6, 'triangle'); // C6 (softer triangle wave)

    // Close context after sound completes
    setTimeout(() => {
      ctx.close();
    }, 3000);

    console.log('[welcomeSound] Premium chime played');
  } catch (error) {
    console.error('[welcomeSound] Error playing sound:', error);
  }
}

// Check if audio can be played (user interaction required on mobile)
export function canPlayAudio(): boolean {
  const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
  return !!AudioContext;
}
