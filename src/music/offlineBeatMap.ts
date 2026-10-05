export const OFFLINE_BEAT_ANALYSIS_SAMPLE_RATE = 2000;
export const OFFLINE_BEAT_FRAME_SECONDS = 0.02;
export const OFFLINE_BEAT_RECOVERY_SECONDS = 0.28;

export interface OfflineBeatMap {
  timestamps: Float32Array;
  duration: number;
  analysisSampleRate: number;
  analysisTimeMs: number;
}

interface AnalysisOptions {
  shouldCancel?: () => boolean;
  yieldEveryOutputSamples?: number;
}

export async function analyzeAudioBufferForMajorBeats(
  buffer: Pick<AudioBuffer, 'duration' | 'numberOfChannels' | 'sampleRate' | 'getChannelData'>,
  options: AnalysisOptions = {},
): Promise<OfflineBeatMap | null> {
  const startedAt = performance.now();
  const reduced = await createReducedMono(buffer, options);
  if (!reduced || options.shouldCancel?.()) return null;
  const timestamps = analyzeReducedPcm(reduced, OFFLINE_BEAT_ANALYSIS_SAMPLE_RATE, buffer.duration);
  return {
    timestamps,
    duration: buffer.duration,
    analysisSampleRate: OFFLINE_BEAT_ANALYSIS_SAMPLE_RATE,
    analysisTimeMs: performance.now() - startedAt,
  };
}

export function analyzePcmForMajorBeats(
  channels: readonly Float32Array[],
  sampleRate: number,
  duration = channels[0]?.length ? channels[0].length / sampleRate : 0,
): OfflineBeatMap {
  const startedAt = performance.now();
  const reduced = reduceChannelsSync(channels, sampleRate, OFFLINE_BEAT_ANALYSIS_SAMPLE_RATE);
  return {
    timestamps: analyzeReducedPcm(reduced, OFFLINE_BEAT_ANALYSIS_SAMPLE_RATE, duration),
    duration,
    analysisSampleRate: OFFLINE_BEAT_ANALYSIS_SAMPLE_RATE,
    analysisTimeMs: performance.now() - startedAt,
  };
}

async function createReducedMono(
  buffer: Pick<AudioBuffer, 'numberOfChannels' | 'sampleRate' | 'getChannelData'>,
  options: AnalysisOptions,
) {
  const sourceLength = buffer.getChannelData(0).length;
  const outputLength = Math.ceil(sourceLength * OFFLINE_BEAT_ANALYSIS_SAMPLE_RATE / buffer.sampleRate);
  const output = new Float32Array(outputLength);
  const channelCount = Math.max(1, buffer.numberOfChannels);
  const channels = Array.from({ length: channelCount }, (_, index) => buffer.getChannelData(index));
  const yieldEvery = Math.max(4096, options.yieldEveryOutputSamples ?? 32768);

  for (let outputIndex = 0; outputIndex < outputLength; outputIndex += 1) {
    if (options.shouldCancel?.()) return null;
    const sourceIndex = Math.min(sourceLength - 1, Math.floor(outputIndex * buffer.sampleRate / OFFLINE_BEAT_ANALYSIS_SAMPLE_RATE));
    let mono = 0;
    for (let channel = 0; channel < channelCount; channel += 1) mono += channels[channel][sourceIndex] ?? 0;
    output[outputIndex] = mono / channelCount;
    if (outputIndex > 0 && outputIndex % yieldEvery === 0) await yieldToMainThread();
  }
  return output;
}

function reduceChannelsSync(channels: readonly Float32Array[], sourceRate: number, targetRate: number) {
  const sourceLength = channels[0]?.length ?? 0;
  const outputLength = Math.ceil(sourceLength * targetRate / sourceRate);
  const output = new Float32Array(outputLength);
  const channelCount = Math.max(1, channels.length);
  for (let outputIndex = 0; outputIndex < outputLength; outputIndex += 1) {
    const sourceIndex = Math.min(sourceLength - 1, Math.floor(outputIndex * sourceRate / targetRate));
    let mono = 0;
    for (let channel = 0; channel < channelCount; channel += 1) mono += channels[channel]?.[sourceIndex] ?? 0;
    output[outputIndex] = mono / channelCount;
  }
  return output;
}

function analyzeReducedPcm(samples: Float32Array, sampleRate: number, duration: number) {
  if (!samples.length || duration <= 0) return new Float32Array();
  const hopSize = Math.max(1, Math.round(sampleRate * OFFLINE_BEAT_FRAME_SECONDS));
  const frameSize = Math.max(hopSize, Math.round(sampleRate * 0.04));
  const frameCount = Math.max(0, Math.floor((samples.length - frameSize) / hopSize) + 1);
  if (frameCount < 3) return new Float32Array();

  const energy = new Float32Array(frameCount);
  const lowEnergy = new Float32Array(frameCount);
  const flux = new Float32Array(frameCount);
  const lowPassAlpha = 1 - Math.exp(-2 * Math.PI * 180 / sampleRate);
  let lowPass = 0;
  let previous = samples[0] ?? 0;

  for (let frame = 0; frame < frameCount; frame += 1) {
    const start = frame * hopSize;
    let totalSquared = 0;
    let lowSquared = 0;
    let difference = 0;
    for (let offset = 0; offset < frameSize; offset += 1) {
      const sample = samples[start + offset] ?? 0;
      lowPass += (sample - lowPass) * lowPassAlpha;
      totalSquared += sample * sample;
      lowSquared += lowPass * lowPass;
      difference += Math.abs(sample - previous);
      previous = sample;
    }
    energy[frame] = Math.sqrt(totalSquared / frameSize);
    lowEnergy[frame] = Math.sqrt(lowSquared / frameSize);
    flux[frame] = difference / frameSize;
  }

  const raw = new Float32Array(frameCount);
  for (let frame = 2; frame < frameCount; frame += 1) {
    const energyReference = (energy[frame - 1] + energy[frame - 2]) * 0.5;
    const lowReference = (lowEnergy[frame - 1] + lowEnergy[frame - 2]) * 0.5;
    const fluxReference = (flux[frame - 1] + flux[frame - 2]) * 0.5;
    const energyRise = Math.max(0, energy[frame] - energyReference);
    const lowRise = Math.max(0, lowEnergy[frame] - lowReference);
    const fluxRise = Math.max(0, flux[frame] - fluxReference);
    raw[frame] = energyRise * 0.9 + lowRise * 1.55 + fluxRise * 0.22;
  }

  const localRadius = Math.max(8, Math.round(1.2 / OFFLINE_BEAT_FRAME_SECONDS));
  const localPeakRadius = Math.max(2, Math.round(0.5 / OFFLINE_BEAT_FRAME_SECONDS));
  const candidates: Array<{ frame: number; score: number; amplitude: number }> = [];
  let rollingSum = 0;
  let rollingSquared = 0;
  let rollingStart = 0;

  for (let frame = 0; frame < frameCount; frame += 1) {
    while (rollingStart < frame - localRadius) {
      const value = raw[rollingStart];
      rollingSum -= value;
      rollingSquared -= value * value;
      rollingStart += 1;
    }
    const historyCount = Math.max(1, frame - rollingStart);
    const mean = rollingSum / historyCount;
    const variance = Math.max(1e-8, rollingSquared / historyCount - mean * mean);
    const deviation = Math.sqrt(variance);
    const normalized = (raw[frame] - mean) / Math.max(0.00035, deviation);
    const left = raw[Math.max(0, frame - 1)] ?? 0;
    const right = raw[Math.min(frameCount - 1, frame + 1)] ?? 0;
    let surroundingPeak = 0;
    const peakStart = Math.max(0, frame - localPeakRadius);
    const peakEnd = Math.min(frameCount - 1, frame + localPeakRadius);
    for (let index = peakStart; index <= peakEnd; index += 1) surroundingPeak = Math.max(surroundingPeak, energy[index]);
    const amplitudeRatio = energy[frame] / Math.max(0.0005, surroundingPeak);
    const absoluteEvidence = raw[frame] > 0.0012 || (lowEnergy[frame] > 0.018 && raw[frame] > 0.00055);
    if (absoluteEvidence && raw[frame] >= left && raw[frame] > right && normalized >= 1.45 && amplitudeRatio >= 0.38) {
      candidates.push({ frame, score: normalized + amplitudeRatio * 0.75 + lowEnergy[frame] * 1.4, amplitude: energy[frame] });
    }
    const current = raw[frame];
    rollingSum += current;
    rollingSquared += current * current;
  }

  const recoveryFrames = Math.round(OFFLINE_BEAT_RECOVERY_SECONDS / OFFLINE_BEAT_FRAME_SECONDS);
  const accepted: Array<{ frame: number; score: number; amplitude: number }> = [];
  for (const candidate of candidates) {
    const previousAccepted = accepted.at(-1);
    if (!previousAccepted || candidate.frame - previousAccepted.frame >= recoveryFrames) {
      accepted.push(candidate);
    } else if (candidate.score > previousAccepted.score * 1.08) {
      accepted[accepted.length - 1] = candidate;
    }
  }

  const timestamps = accepted
    .map(({ frame }) => Math.min(duration, (frame * hopSize + frameSize * 0.5) / sampleRate))
    .filter((time, index, list) => time >= 0 && time <= duration && (index === 0 || time > list[index - 1]));
  return Float32Array.from(timestamps);
}

function yieldToMainThread() {
  return new Promise<void>((resolve) => window.setTimeout(resolve, 0));
}
