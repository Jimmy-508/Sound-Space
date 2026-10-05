import assert from 'node:assert/strict';
import { analyzePcmForMajorBeats } from '../src/music/offlineBeatMap';

const sampleRate = 2000;

function synthesize(duration: number, pulses: Array<{ time: number; amplitude: number }>, ambient = false) {
  const samples = new Float32Array(Math.ceil(duration * sampleRate));
  for (let index = 0; index < samples.length; index += 1) {
    const time = index / sampleRate;
    if (ambient) samples[index] = Math.sin(time * Math.PI * 2 * 83) * (0.014 + Math.sin(time * 0.37) * 0.003);
  }
  for (const pulse of pulses) {
    const start = Math.floor(pulse.time * sampleRate);
    const length = Math.floor(sampleRate * 0.12);
    for (let offset = 0; offset < length && start + offset < samples.length; offset += 1) {
      const age = offset / sampleRate;
      samples[start + offset] += Math.sin(age * Math.PI * 2 * 72) * Math.exp(-age * 28) * pulse.amplitude;
      if (offset < 8) samples[start + offset] += pulse.amplitude * (1 - offset / 8) * 0.45;
    }
  }
  return samples;
}

function map(duration: number, pulses: Array<{ time: number; amplitude: number }>, ambient = false) {
  return analyzePcmForMajorBeats([synthesize(duration, pulses, ambient)], sampleRate, duration).timestamps;
}

function closeTo(actual: Float32Array, expected: number[], tolerance = 0.065) {
  assert.equal(actual.length, expected.length, `Expected ${expected.length} beats, received ${actual.length}: ${Array.from(actual).join(', ')}`);
  expected.forEach((time, index) => assert.ok(Math.abs(actual[index] - time) <= tolerance, `Beat ${index} must stay near ${time}s, got ${actual[index]}s.`));
}

assert.equal(map(3, []).length, 0, 'Silence must create no Beat Map events.');
assert.equal(map(5, [], true).length, 0, 'Gentle non-rhythmic audio must not create a fake grid.');

const periodicTimes = [0.5, 1, 1.5, 2, 2.5, 3];
const periodicPulses = periodicTimes.map((time) => ({ time, amplitude: 0.9 }));
closeTo(map(3.5, periodicPulses), periodicTimes);
closeTo(map(1.4, [{ time: 0.42, amplitude: 1 }]), [0.42]);

const strongWithWeak = map(2.4, [
  { time: 0.4, amplitude: 1 },
  { time: 0.7, amplitude: 0.12 },
  { time: 1.05, amplitude: 0.95 },
  { time: 1.35, amplitude: 0.1 },
  { time: 1.7, amplitude: 1 },
]);
closeTo(strongWithWeak, [0.4, 1.05, 1.7]);

const irregularTimes = [0.36, 0.91, 1.48, 2.21, 2.69];
closeTo(map(3.1, irregularTimes.map((time) => ({ time, amplitude: 0.92 }))), irregularTimes);

const tempoChangeTimes = [0.4, 1.0, 1.6, 2.2, 2.6, 3.0, 3.4];
const tempoMap = map(3.9, tempoChangeTimes.map((time) => ({ time, amplitude: 0.94 })));
closeTo(tempoMap, tempoChangeTimes);
const intervals = Array.from(tempoMap.slice(1), (time, index) => Number((time - tempoMap[index]).toFixed(2)));
assert.ok(intervals.some((interval) => interval > 0.55) && intervals.some((interval) => interval < 0.45), 'Tempo changes must produce nonuniform Beat Map intervals.');

const breakTimes = [0.4, 0.9, 1.4, 4.1, 4.6, 5.1];
const breakMap = map(5.6, breakTimes.map((time) => ({ time, amplitude: 0.96 })), true);
closeTo(breakMap, breakTimes);
assert.equal(Array.from(breakMap).filter((time) => time > 1.6 && time < 3.9).length, 0, 'A musical break must remain empty rather than becoming a BPM grid.');

const deterministicInput = synthesize(3.5, periodicPulses);
assert.deepEqual(
  analyzePcmForMajorBeats([deterministicInput], sampleRate, 3.5).timestamps,
  analyzePcmForMajorBeats([deterministicInput], sampleRate, 3.5).timestamps,
  'Identical PCM must produce a deterministic Beat Map.',
);
assert.ok(Array.from(breakMap).every((time, index, values) => time >= 0 && time <= 5.6 && (index === 0 || time > values[index - 1])), 'Beat timestamps must be sorted and inside the song duration.');

console.log('Offline Beat Map verification passed: real PCM peaks, sparse breaks, irregular accents, tempo changes, and deterministic timestamps.');
