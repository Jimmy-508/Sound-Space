export interface InteractionPlayback {
  startedAt: number;
  duration: number;
  envelope: Float32Array;
  token: number;
}

const envelopePointCount = 512;
const minimumPlayIntervalMs = 45;

class InteractionSoundPlayer {
  private context: AudioContext | null = null;
  private gain: GainNode | null = null;
  private buffer: AudioBuffer | null = null;
  private envelope: Float32Array | null = null;
  private preloadPromise: Promise<void> | null = null;
  private lastStartedAt = -Infinity;
  private token = 0;

  preload() {
    if (this.preloadPromise) return this.preloadPromise;
    this.preloadPromise = this.load();
    return this.preloadPromise;
  }

  async play(): Promise<InteractionPlayback | null> {
    if (performance.now() - this.lastStartedAt < minimumPlayIntervalMs) return null;
    await this.preload();
    if (!this.context || !this.gain || !this.buffer || !this.envelope) return null;
    if (this.context.state === 'suspended') await this.context.resume();

    const source = this.context.createBufferSource();
    source.buffer = this.buffer;
    source.connect(this.gain);
    source.start();
    this.lastStartedAt = performance.now();
    this.token += 1;
    return {
      startedAt: this.lastStartedAt,
      duration: this.buffer.duration,
      envelope: this.envelope,
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
      const assetUrl = new URL('audio/03_select_confirm.wav', document.baseURI);
      const response = await fetch(assetUrl);
      if (!response.ok) throw new Error(`Unable to preload interaction sound: ${response.status}`);
      const buffer = await context.decodeAudioData(await response.arrayBuffer());
      this.context = context;
      this.gain = gain;
      this.buffer = buffer;
      this.envelope = buildEnvelope(buffer, envelopePointCount);
    } catch (error) {
      this.preloadPromise = null;
      console.warn('Interaction sound unavailable.', error);
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
