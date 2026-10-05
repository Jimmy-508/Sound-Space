export interface FileSizeWaveTrace {
  stepPoints: Float32Array;
  samples: Float32Array;
}

export interface FileSizeWaveModel {
  sampleCount: number;
  quantizationLevels: number;
  traces: readonly FileSizeWaveTrace[];
  signature: string;
}

const sampleDensityByRate = new Map([
  [8000, 10],
  [22050, 18],
  [44100, 30],
  [48000, 36],
  [96000, 56],
]);

const pedagogicalLevelsByDepth = new Map([
  [8, 6],
  [16, 12],
  [24, 24],
  [32, 48],
]);

export function calculatePcmFileSize(sampleRate: number, bitDepth: number, channels: number, duration: number) {
  return sampleRate * (bitDepth / 8) * channels * duration;
}

export function createFileSizeWaveModel(sampleRate: number, bitDepth: number, channels: number): FileSizeWaveModel {
  const sampleCount = sampleDensityByRate.get(sampleRate) ?? densityFromRate(sampleRate);
  const quantizationLevels = pedagogicalLevelsByDepth.get(bitDepth) ?? levelsFromDepth(bitDepth);
  const traceCount = channels === 1 ? 1 : 2;
  const traces = Array.from({ length: traceCount }, (_, channel) => createTrace(sampleCount, quantizationLevels, channel, traceCount));
  return Object.freeze({
    sampleCount,
    quantizationLevels,
    traces: Object.freeze(traces),
    signature: `${sampleRate}:${bitDepth}:${traceCount}`,
  });
}

function createTrace(sampleCount: number, levels: number, channel: number, channelCount: number): FileSizeWaveTrace {
  const samples = new Float32Array(sampleCount * 2);
  const stepPoints = new Float32Array(Math.max(3, (sampleCount - 1) * 2 + 1) * 2);
  const laneCenter = channelCount === 1 ? 0 : channel === 0 ? 0.34 : -0.34;
  const amplitude = channelCount === 1 ? 0.5 : 0.24;

  for (let index = 0; index < sampleCount; index += 1) {
    const t = index / Math.max(1, sampleCount - 1);
    const source = channel === 0
      ? Math.sin(t * Math.PI * 6)
      : Math.sin(t * Math.PI * 6 + 0.62) * 0.82 + Math.sin(t * Math.PI * 12 + 0.2) * 0.18;
    const quantized = quantizeNormalized(source, levels);
    samples[index * 2] = t * 1.8 - 0.9;
    samples[index * 2 + 1] = laneCenter + quantized * amplitude;
  }

  for (let index = 0; index < sampleCount - 1; index += 1) {
    const target = index * 4;
    stepPoints[target] = samples[index * 2];
    stepPoints[target + 1] = samples[index * 2 + 1];
    stepPoints[target + 2] = samples[(index + 1) * 2];
    stepPoints[target + 3] = samples[index * 2 + 1];
  }
  const finalStep = (stepPoints.length / 2 - 1) * 2;
  stepPoints[finalStep] = samples[(sampleCount - 1) * 2];
  stepPoints[finalStep + 1] = samples[(sampleCount - 1) * 2 + 1];
  return Object.freeze({ stepPoints, samples });
}

function quantizeNormalized(value: number, levels: number) {
  const normalized = (Math.max(-1, Math.min(1, value)) + 1) / 2;
  return Math.round(normalized * (levels - 1)) / (levels - 1) * 2 - 1;
}

function densityFromRate(sampleRate: number) {
  const normalized = Math.log(Math.max(8000, sampleRate) / 8000) / Math.log(96000 / 8000);
  return Math.round(10 + Math.max(0, Math.min(1, normalized)) * 46);
}

function levelsFromDepth(bitDepth: number) {
  return Math.round(6 + Math.max(0, Math.min(1, (bitDepth - 8) / 24)) * 42);
}
