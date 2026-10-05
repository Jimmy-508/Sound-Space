import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildInteractionWaveform } from '../src/audio/interactionSound';
import { HOME_SFX_RELEASE_SECONDS, getHomeSfxBlend, mixHomeAudioWave, sampleHomeSfxWaveform } from '../src/audio/homeAudioWaveform';

const signalA = new Float32Array([0, 0.25, -0.5, 1, -0.25, 0.1, 0, 0]);
const signalB = new Float32Array([0, -0.1, 0.2, -0.35, 0.8, -1, 0.3, 0]);
const fakeBuffer = (signal: Float32Array) => ({
  length: signal.length,
  numberOfChannels: 1,
  sampleRate: 8,
  duration: 1,
  getChannelData: () => signal,
}) as AudioBuffer;

const waveformA = buildInteractionWaveform(fakeBuffer(signalA));
const waveformB = buildInteractionWaveform(fakeBuffer(signalB));
assert.notDeepEqual([...waveformA], [...waveformB], 'Different decoded PCM must produce different cached waveforms.');
assert.equal(getHomeSfxBlend(-0.01, 1), 0, 'Idle before playback must have no SFX response.');
assert.ok(getHomeSfxBlend(0.013, 1) > 0 && getHomeSfxBlend(0.013, 1) < 1, 'SFX must blend in smoothly without input latency.');
assert.equal(getHomeSfxBlend(0.04, 1), 1, 'Active SFX must reach full response after the short attack.');
assert.ok(getHomeSfxBlend(1.2, 1) > 0 && getHomeSfxBlend(1.2, 1) < 1, 'SFX must decay smoothly after audio ends.');
assert.equal(getHomeSfxBlend(1 + HOME_SFX_RELEASE_SECONDS, 1), 0, 'SFX response must return fully to idle.');

const sampleA = sampleHomeSfxWaveform(waveformA, 8, 1, 0.5, 0.5);
const sampleB = sampleHomeSfxWaveform(waveformB, 8, 1, 0.5, 0.5);
assert.notEqual(sampleA, sampleB, 'Home waveform must read actual current PCM samples.');
assert.equal(mixHomeAudioWave(0.2, null, 0.9, 0), 0.2, 'No audible SFX must preserve the idle sine exactly.');
assert.equal(mixHomeAudioWave(0.2, 0.35, 0, 1), 0.35, 'Imported music must preserve its existing primary waveform.');
assert.ok(Math.abs(mixHomeAudioWave(0.2, 0.35, 0.5, 1) - 0.45) < 1e-9, 'Simultaneous SFX must layer deterministically without replacing music.');
assert.ok(Math.abs(mixHomeAudioWave(0.2, null, 1, 1)) <= 1, 'SFX-only visualization must remain visually bounded.');

const homeWaveSource = readFileSync('src/audio/homeAudioWaveform.ts', 'utf8');
const interactionSource = readFileSync('src/audio/interactionSound.ts', 'utf8');
const rendererSource = readFileSync('src/visualization/WaveCanvas.tsx', 'utf8');
const appSource = readFileSync('src/App.tsx', 'utf8');
assert.ok(!homeWaveSource.includes('Math.random'), 'Home audio response must not synthesize random fake waveform data.');
assert.ok(interactionSource.includes('getChannelData(channel)'), 'SFX cache must derive its waveform from decoded audio channels.');
assert.ok(!interactionSource.includes('buildEnvelope'), 'The old whole-file peak-envelope rail animation must be removed.');
assert.ok(rendererSource.includes('sampleHomeSfxWaveform(') && rendererSource.includes('mixHomeAudioWave('), 'Home renderer must consume the actual SFX waveform.');
assert.ok(rendererSource.includes('current.homeMusicData'), 'Existing imported-music analyser data must remain connected.');
assert.ok(appSource.includes('homePlayback?.waveform ?? null'), 'Only successful shared-SFX playback may trigger Home SFX response.');

console.log('Home audio waveform verification passed: decoded PCM, music-first mixing, smooth idle return, and no fake random response.');

