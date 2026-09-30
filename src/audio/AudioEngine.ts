import type { Waveform } from '../types';

export class AudioEngine {
  private context: AudioContext | null = null;
  private oscillator: OscillatorNode | null = null;
  private gain: GainNode | null = null;
  private waveform: Waveform = 'sine';
  private amplitude = 0.55;
  private frequency = 440;

  async ensureContext() {
    if (!this.context) {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      this.context = new AudioCtor();
      this.gain = this.context.createGain();
      this.gain.gain.value = this.amplitude;
      this.gain.connect(this.context.destination);
    }

    if (this.context.state === 'suspended') {
      await this.context.resume();
    }
  }

  async play() {
    await this.ensureContext();
    if (!this.context || !this.gain || this.oscillator) return;

    const oscillator = this.context.createOscillator();
    oscillator.type = this.waveform;
    oscillator.frequency.value = this.frequency;
    oscillator.connect(this.gain);
    oscillator.start();
    this.oscillator = oscillator;
  }

  stop() {
    if (!this.oscillator) return;
    this.oscillator.stop();
    this.oscillator.disconnect();
    this.oscillator = null;
  }

  setAmplitude(value: number) {
    this.amplitude = value;
    if (this.gain && this.context) {
      this.gain.gain.setTargetAtTime(value, this.context.currentTime, 0.015);
    }
  }

  setFrequency(value: number) {
    this.frequency = value;
    if (this.oscillator && this.context) {
      this.oscillator.frequency.setTargetAtTime(value, this.context.currentTime, 0.015);
    }
  }

  setWaveform(value: Waveform) {
    this.waveform = value;
    if (this.oscillator) this.oscillator.type = value;
  }
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
