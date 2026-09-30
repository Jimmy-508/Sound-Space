export type MusicSpectrumMode = 'radial' | 'mirror' | 'orbital';

export interface MusicSessionState {
  sourceUrl: string | null;
  fileName: string;
  fileSize: number;
  fileType: string;
  duration: number;
  current: number;
  volume: number;
  zoom: number;
  viewStart: number;
  waveformData: Float32Array | null;
  dnaSeed: number;
  spectrumMode: MusicSpectrumMode;
}

export const initialMusicSession: MusicSessionState = {
  sourceUrl: null,
  fileName: '',
  fileSize: 0,
  fileType: '',
  duration: 0,
  current: 0,
  volume: 0.8,
  zoom: 1,
  viewStart: 0,
  waveformData: null,
  dnaSeed: 1,
  spectrumMode: 'radial',
};

export function createFileSeed(file: File) {
  return hashText(`${file.name}|${file.size}|${file.type}|${file.lastModified}`);
}

export function createDecodedMusicDna(file: File, duration: number, channel: Float32Array) {
  const stride = Math.max(1, Math.floor(channel.length / 2048));
  let energy = 0;
  let crossings = 0;
  let previous = channel[0] ?? 0;
  let weightedChange = 0;
  let samples = 0;

  for (let index = 0; index < channel.length; index += stride) {
    const value = channel[index] ?? 0;
    energy += value * value;
    if ((value >= 0) !== (previous >= 0)) crossings += 1;
    weightedChange += Math.abs(value - previous);
    previous = value;
    samples += 1;
  }

  const rms = Math.sqrt(energy / Math.max(1, samples));
  const texture = weightedChange / Math.max(1, samples);
  const signature = `${file.name}|${file.size}|${duration.toFixed(3)}|${rms.toFixed(5)}|${crossings}|${texture.toFixed(5)}`;
  const seed = hashText(signature);
  return { seed, mode: spectrumModeFromSeed(seed) };
}

export function spectrumModeFromSeed(seed: number): MusicSpectrumMode {
  return (['radial', 'mirror', 'orbital'] as const)[seed % 3];
}

function hashText(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
