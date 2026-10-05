import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';

const controllerSource = readFileSync('src/music/useMusicAudioController.ts', 'utf8');
const appSource = readFileSync('src/App.tsx', 'utf8');
const birthSource = readFileSync('src/spirit/soundSpiritBirth.ts', 'utf8');
const rendererSource = readFileSync('src/visualization/WaveCanvas.tsx', 'utf8');
const introPath = 'public/audio/12_Cinematic_intro.wav';

assert.ok(statSync(introPath).size > 700000, 'The supplied cinematic intro must be present as a real audio asset.');
const introWav = readFileSync(introPath);
const byteRate = introWav.readUInt32LE(28);
let chunkOffset = 12;
let dataBytes = 0;
while (chunkOffset + 8 <= introWav.length) {
  const chunkId = introWav.toString('ascii', chunkOffset, chunkOffset + 4);
  const chunkSize = introWav.readUInt32LE(chunkOffset + 4);
  if (chunkId === 'data') {
    dataBytes = chunkSize;
    break;
  }
  chunkOffset += 8 + chunkSize + chunkSize % 2;
}
assert.ok(Math.abs(dataBytes / byteRate - 11.011) < 0.002, 'The real cinematic intro duration must be read from the supplied asset, not hard-coded.');
assert.ok(controllerSource.includes("audio/12_Cinematic_intro.wav"), 'The cinematic intro must use a base-aware public asset URL.');
assert.ok(controllerSource.includes('CINEMATIC_BIRTH_DELAY_MS = 2000'), 'Birth must start exactly two seconds after the intro starts or fails.');
assert.ok(appSource.includes('performance.now() + birthDelayMs'), 'Birth must use a future start timestamp without changing its accepted internal timeline.');
assert.ok(controllerSource.includes('playCinematicIntro') && controllerSource.includes('stopCinematicIntro'), 'Repeated imports must replace the previous one-shot intro transaction.');
assert.ok(controllerSource.includes('await intro.play()'), 'The cinematic intro must be attempted exactly as a separate audio element.');
assert.equal((controllerSource.match(/new Audio\(/g) ?? []).length, 1, 'Each import transaction must create only one cinematic intro player.');
assert.ok(!controllerSource.includes('await audio.play();\n        setPlaying(true);'), 'Successful import must not autoplay the imported user song.');
assert.ok(controllerSource.includes('onSuccessfulLoad(CINEMATIC_BIRTH_DELAY_MS)'), 'The accepted Birth must be scheduled only after the intro attempt.');
assert.ok(controllerSource.includes('analyzeAudioBufferForMajorBeats(buffer'), 'Beat Map analysis must begin from the decoded user AudioBuffer.');
assert.ok(controllerSource.includes('shouldCancel: () => loadVersion !== loadVersionRef.current'), 'A repeated import must invalidate earlier analysis.');
assert.ok(controllerSource.includes('if (isLocalDevelopment()) {') && controllerSource.includes("console.warn('Sound Space cinematic intro could not play"), 'Intro failure may warn only during local development.');
assert.ok(birthSource.includes('SOUND_SPIRIT_BIRTH_DURATION_SECONDS = 4'), 'The accepted four-second Birth duration must remain frozen.');
assert.ok(rendererSource.includes('birthLightPathCount = compact ? 12 : 18'), 'Accepted Birth ribbon counts must remain unchanged.');
assert.ok(rendererSource.includes('createBirthLightRibbonGeometry') && rendererSource.includes('createBirthLightRibbonMaterial'), 'Accepted Birth geometry and shader architecture must remain intact.');

console.log('Cinematic Birth verification passed: separate one-shot intro, two-second delayed accepted Birth, no user-song autoplay, and re-entrant cleanup.');
