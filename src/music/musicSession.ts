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
  pcmData: Float32Array | null;
  sampleRate: number;
  visualSeed: number;
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
  pcmData: null,
  sampleRate: 0,
  visualSeed: 1,
};

export function createVisualSeed(file: File) {
  const entropy = new Uint32Array(1);
  crypto.getRandomValues(entropy);
  return hashText(`${file.name}|${file.size}|${file.type}|${file.lastModified}|${entropy[0]}|${performance.now()}`);
}

export function refineVisualSeed(baseSeed: number, file: File, duration: number, channel: Float32Array) {
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
  const signature = `${baseSeed}|${file.name}|${file.size}|${duration.toFixed(3)}|${rms.toFixed(5)}|${crossings}|${texture.toFixed(5)}`;
  return hashText(signature);
}

function hashText(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
