export interface InteractionPlayback {
  startedAt: number;
  duration: number;
  envelope: Float32Array;
  token: number;
}

const envelopePointCount = 512;
const minimumPlayIntervalMs = 45;
export type InteractionSfx = 'select' | 'explosion' | 'blueTears';

const soundAssets: Record<InteractionSfx, string | null> = {
  select: 'audio/03_select_confirm.wav',
  explosion: 'audio/04_compound_shatter.wav',
  blueTears: null,
};

export class InteractionSoundPlayer {
  private context: AudioContext | null = null;
  private gain: GainNode | null = null;
  private buffers = new Map<InteractionSfx, AudioBuffer>();
  private envelopes = new Map<InteractionSfx, Float32Array>();
  private preloadPromise: Promise<void> | null = null;
  private lastStartedAt = -Infinity;
  private token = 0;
  private enabled = true;
  private failed = false;
  private warned = false;

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  preload() {
    if (this.failed) return Promise.resolve();
    if (this.preloadPromise) return this.preloadPromise;
    this.preloadPromise = this.load().catch((error) => {
      this.failed = true;
      if (!this.warned) {
        this.warned = true;
        console.warn('Interaction sound unavailable.', error);
      }
    });
    return this.preloadPromise;
  }

  async warm() {
    await this.preload();
    if (!this.context || this.context.state !== 'suspended') return;
    try {
      await this.context.resume();
    } catch {
      // A later user activation can retry without affecting visual interactions.
    }
  }

  hasCachedBuffer(kind: InteractionSfx) {
    return this.buffers.has(kind);
  }

  play(kind: InteractionSfx = 'select'): Promise<InteractionPlayback | null> {
    if (!this.enabled || !soundAssets[kind]) return Promise.resolve(null);
    if (performance.now() - this.lastStartedAt < minimumPlayIntervalMs) return Promise.resolve(null);
    const immediate = this.startCached(kind);
    if (immediate) return Promise.resolve(immediate);
    return this.playWhenReady(kind);
  }

  private async playWhenReady(kind: InteractionSfx) {
    await this.preload();
    if (!this.context) return null;
    if (this.context.state === 'suspended') {
      try {
        await this.context.resume();
      } catch {
        return null;
      }
    }
    return this.startCached(kind);
  }

  private startCached(kind: InteractionSfx): InteractionPlayback | null {
    const buffer = this.buffers.get(kind);
    const envelope = this.envelopes.get(kind);
    if (!this.context || this.context.state !== 'running' || !this.gain || !buffer || !envelope) return null;

    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.gain);
    source.start();
    this.lastStartedAt = performance.now();
    this.token += 1;
    return {
      startedAt: this.lastStartedAt,
      duration: buffer.duration,
      envelope,
      token: this.token,
    };
  }

  private async load() {
    try {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      const context = new AudioCtor();
      const gain = context.createGain();
      gain.gain.value = 0.56;
      gain.connect(context.destination);
      const entries = await Promise.all(Object.entries(soundAssets).map(async ([kind, path]) => {
        if (!path) return null;
        const response = await fetch(new URL(path, document.baseURI));
        if (!response.ok) throw new Error(`Unable to preload interaction sound: ${response.status}`);
        const buffer = await context.decodeAudioData(await response.arrayBuffer());
        return [kind as InteractionSfx, buffer] as const;
      }));
      this.context = context;
      this.gain = gain;
      entries.forEach((entry) => {
        if (!entry) return;
        this.buffers.set(entry[0], entry[1]);
        this.envelopes.set(entry[0], buildEnvelope(entry[1], envelopePointCount));
      });
    } catch (error) {
      throw error;
    }
  }
}

function buildEnvelope(buffer: AudioBuffer, pointCount: number) {
  const envelope = new Float32Array(pointCount);
  const samplesPerPoint = Math.max(1, Math.floor(buffer.length / pointCount));
  let maximum = 0;

  for (let point = 0; point < pointCount; point += 1) {
    const start = point * samplesPerPoint;
    const end = Math.min(buffer.length, start + samplesPerPoint);
    let signedPeak = 0;
    for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
      const data = buffer.getChannelData(channel);
      for (let index = start; index < end; index += 1) {
        if (Math.abs(data[index]) > Math.abs(signedPeak)) signedPeak = data[index];
      }
    }
    envelope[point] = signedPeak;
    maximum = Math.max(maximum, Math.abs(signedPeak));
  }

  const normalization = maximum > 0.0001 ? 1 / maximum : 1;
  for (let index = 0; index < envelope.length; index += 1) {
    envelope[index] = Math.min(1, envelope[index] * normalization);
  }
  return envelope;
}

export const interactionSound = new InteractionSoundPlayer();

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
