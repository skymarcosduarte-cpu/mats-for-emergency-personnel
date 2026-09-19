// Guía sonora del Detector de Señales: pitidos más rápidos cuando la señal se
// hace más fuerte (más caliente) y avisos de voz cuando cambia de nivel, para
// que el rescatista no tenga que mirar la pantalla entre escombros.

import { classifySignal, SIGNAL_LABELS, type SignalStrength } from './signalScanner';

function intervalFor(rssi: number): number {
  if (rssi >= -55) return 250;
  if (rssi >= -70) return 600;
  if (rssi >= -85) return 1200;
  return 2200;
}

function toneFor(rssi: number): number {
  if (rssi >= -55) return 1400;
  if (rssi >= -70) return 1100;
  if (rssi >= -85) return 850;
  return 650;
}

class SignalGuide {
  private enabled = false;
  private ctx: AudioContext | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private rssi: number | null = null;
  private lastLevel: SignalStrength | null = null;
  private lastSpoke = 0;

  isEnabled(): boolean {
    return this.enabled;
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (!on) {
      this.stopLoop();
      this.lastLevel = null;
      return;
    }
    this.ensureContext();
    this.scheduleNext();
  }

  /** Se llama en cada actualización con la mejor señal oída (o null) */
  update(rssi: number | null): void {
    this.rssi = rssi;
    if (!this.enabled || rssi === null) return;
    const level = classifySignal(rssi);
    if (level !== this.lastLevel) {
      const previous = this.lastLevel;
      this.lastLevel = level;
      const trend =
        previous === null
          ? ''
          : intervalFor(rssi) < intervalFor(this.thresholdOf(previous))
            ? 'Más caliente. '
            : 'Más frío. ';
      this.speak(`${trend}${SIGNAL_LABELS[level]}`);
    }
    this.scheduleNext();
  }

  private thresholdOf(level: SignalStrength): number {
    if (level === 'inmediato') return -50;
    if (level === 'muy-cerca') return -65;
    if (level === 'cerca') return -80;
    return -95;
  }

  private speak(text: string): void {
    const now = Date.now();
    if (now - this.lastSpoke < 5000) return;
    this.lastSpoke = now;
    try {
      const synth = window.speechSynthesis;
      if (!synth) return;
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'es-MX';
      utter.rate = 1.05;
      synth.speak(utter);
    } catch {
      /* voz no disponible */
    }
  }

  private ensureContext(): void {
    if (this.ctx) return;
    try {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctor) this.ctx = new Ctor();
    } catch {
      this.ctx = null;
    }
  }

  private beep(rssi: number): void {
    this.ensureContext();
    const ctx = this.ctx;
    if (!ctx) return;
    try {
      if (ctx.state === 'suspended') void ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = toneFor(rssi);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.09);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } catch {
      /* sin audio */
    }
  }

  private stopLoop(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private scheduleNext(): void {
    if (!this.enabled) return;
    if (this.timer) return;
    const rssi = this.rssi;
    const delay = rssi === null ? 2500 : intervalFor(rssi);
    this.timer = setTimeout(() => {
      this.timer = null;
      if (!this.enabled) return;
      if (this.rssi !== null) this.beep(this.rssi);
      this.scheduleNext();
    }, delay);
  }
}

export const signalGuide = new SignalGuide();
