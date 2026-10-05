export interface FileSizeWaveTrace {
  stepPoints: Float32Array;
  samples: Float32Array;
}

export interface FileSizeWaveModel {
  sampleCount: number;
  quantizationLevels: number;
  channelCount: number;
  sourceCycles: number;
  phaseSpeed: number;
  traces: readonly FileSizeWaveTrace[];
  signature: string;
}

export const FILE_SIZE_WAVE_SOURCE_CYCLES = 3;
export const FILE_SIZE_WAVE_PHASE_SPEED = 0.11;

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
  const traces = Array.from({ length: traceCount }, (_, channel) => createTrace(sampleCount, quantizationLevels, channel, traceCount, 0));
  return Object.freeze({
    sampleCount,
    quantizationLevels,
    channelCount: traceCount,
    sourceCycles: FILE_SIZE_WAVE_SOURCE_CYCLES,
    phaseSpeed: FILE_SIZE_WAVE_PHASE_SPEED,
    traces: Object.freeze(traces),
    signature: `${sampleRate}:${bitDepth}:${traceCount}`,
  });
}

export function getFileSizeWavePhase(elapsedSeconds: number, model: FileSizeWaveModel) {
  return fract(Math.max(0, elapsedSeconds) * model.phaseSpeed);
}

export function fillFileSizeWaveTrace(
  model: FileSizeWaveModel,
  channel: number,
  phase: number,
  stepTarget: Float32Array,
  sampleTarget: Float32Array,
  stride = 3,
) {
  const sampleCount = model.sampleCount;
  const channelIndex = Math.min(model.channelCount - 1, Math.max(0, channel));
  const laneCenter = model.channelCount === 1 ? 0 : channelIndex === 0 ? 0.34 : -0.34;
  const amplitude = model.channelCount === 1 ? 0.5 : 0.24;
  const wrappedPhase = fract(phase);

  for (let index = 0; index < sampleCount; index += 1) {
    const t = index / Math.max(1, sampleCount - 1);
    const quantized = quantizeNormalized(sourceWave(t, wrappedPhase, channelIndex, model.sourceCycles), model.quantizationLevels);
    const target = index * stride;
    sampleTarget[target] = t * 1.8 - 0.9;
    sampleTarget[target + 1] = laneCenter + quantized * amplitude;
    if (stride > 2) sampleTarget[target + 2] = 0;
  }

  for (let index = 0; index < sampleCount - 1; index += 1) {
    const target = index * 2 * stride;
    const sample = index * stride;
    const nextSample = (index + 1) * stride;
    stepTarget[target] = sampleTarget[sample];
    stepTarget[target + 1] = sampleTarget[sample + 1];
    stepTarget[target + stride] = sampleTarget[nextSample];
    stepTarget[target + stride + 1] = sampleTarget[sample + 1];
    if (stride > 2) {
      stepTarget[target + 2] = 0;
      stepTarget[target + stride + 2] = 0;
    }
  }
  const finalPoint = (sampleCount - 1) * 2 * stride;
  const finalSample = (sampleCount - 1) * stride;
  stepTarget[finalPoint] = sampleTarget[finalSample];
  stepTarget[finalPoint + 1] = sampleTarget[finalSample + 1];
  if (stride > 2) stepTarget[finalPoint + 2] = 0;
}

function createTrace(sampleCount: number, levels: number, channel: number, channelCount: number, phase: number): FileSizeWaveTrace {
  const samples = new Float32Array(sampleCount * 2);
  const stepPoints = new Float32Array(Math.max(3, (sampleCount - 1) * 2 + 1) * 2);
  const model = { sampleCount, quantizationLevels: levels, channelCount, sourceCycles: FILE_SIZE_WAVE_SOURCE_CYCLES } as FileSizeWaveModel;
  fillFileSizeWaveTrace(model, channel, phase, stepPoints, samples, 2);
  return Object.freeze({ stepPoints, samples });
}

function sourceWave(t: number, phase: number, channel: number, cycles: number) {
  const angle = (t + phase) * Math.PI * 2 * cycles;
  return channel === 0
    ? Math.sin(angle)
    : Math.sin(angle + 0.62) * 0.82 + Math.sin(angle * 2 + 0.2) * 0.18;
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

function fract(value: number) {
  return value - Math.floor(value);
}
