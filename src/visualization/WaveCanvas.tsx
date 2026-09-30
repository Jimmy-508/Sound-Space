import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { PointerPoint, Waveform } from '../types';
import type { Repulsor } from './repulsor';

interface WaveCanvasProps {
  amplitude: number;
  frequency: number;
  waveform?: Waveform;
  mode?: 'home' | 'wave' | 'sample' | 'quantize' | 'music';
  sampleCount?: number;
  bitDepth?: number;
  musicData?: Float32Array | null;
  musicPcmData?: Float32Array | null;
  musicSampleRate?: number;
  spectrumData?: Uint8Array | null;
  musicProgress?: number;
  musicZoom?: number;
  musicViewStart?: number;
  musicVolume?: number;
  musicTime?: number;
  musicVisualSeed?: number;
  musicPlaying?: boolean;
  creatureScale?: number;
  repulsors?: Repulsor[];
  pointer: PointerPoint;
}

const wavePointLimit = 768;
const samplePointLimit = 64;
const spectrumBandCount = 64;
const organicPointLimit = 144;
const nucleusPointLimit = 48;
const innerMembranePointLimit = 112;
const tendrilLimit = 12;
const tendrilSegmentLimit = 10;
const internalFilamentLimit = 4;
const internalFilamentSegmentLimit = 8;
const particleCount = 220;
const silentSpectrumData = new Uint8Array(512);

export function WaveCanvas({
  amplitude,
  frequency,
  waveform = 'sine',
  mode = 'wave',
  sampleCount = 16,
  bitDepth = 4,
  musicData = null,
  musicPcmData = null,
  musicSampleRate = 0,
  spectrumData = null,
  musicProgress = 0,
  musicZoom = 1,
  musicViewStart = 0,
  musicVolume = 0.8,
  musicTime = 0,
  musicVisualSeed = 1,
  musicPlaying = false,
  creatureScale = 1,
  repulsors = [],
  pointer,
}: WaveCanvasProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef({
    amplitude,
    frequency,
    waveform,
    mode,
    sampleCount,
    bitDepth,
    musicData,
    musicPcmData,
    musicSampleRate,
    spectrumData,
    musicProgress,
    musicZoom,
    musicViewStart,
    musicVolume,
    musicTime,
    musicVisualSeed,
    musicPlaying,
    creatureScale,
    repulsors,
    pointer,
  });

  stateRef.current = {
    amplitude,
    frequency,
    waveform,
    mode,
    sampleCount,
    bitDepth,
    musicData,
    musicPcmData,
    musicSampleRate,
    spectrumData,
    musicProgress,
    musicZoom,
    musicViewStart,
    musicVolume,
    musicTime,
    musicVisualSeed,
    musicPlaying,
    creatureScale,
    repulsors,
    pointer,
  };

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const compact = window.innerWidth < 760;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, compact ? 1.35 : 1.7));
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    camera.position.z = 2;

    const waveMaterial = new THREE.LineBasicMaterial({ color: 0x79cbea, depthTest: false, transparent: true, opacity: 0.72 });
    const secondaryMaterial = new THREE.LineBasicMaterial({ color: 0x4d94e6, depthTest: false, transparent: true, opacity: 0.32 });
    const pointMaterial = new THREE.PointsMaterial({ color: 0xffffff, depthTest: false, size: 4.5, transparent: true, opacity: 1, sizeAttenuation: false });
    const pointGlowMaterial = new THREE.PointsMaterial({ color: 0x58dfff, depthTest: false, size: 15, transparent: true, opacity: 0.19, sizeAttenuation: false, blending: THREE.AdditiveBlending });
    const contactMaterial = new THREE.PointsMaterial({ color: 0xbaf6ff, depthTest: false, size: 8, transparent: true, opacity: 0.34, sizeAttenuation: false, blending: THREE.AdditiveBlending });
    const stemMaterial = new THREE.LineBasicMaterial({ color: 0x76dcff, depthTest: false, transparent: true, opacity: 0.27, blending: THREE.AdditiveBlending });
    const ringMaterial = new THREE.MeshBasicMaterial({ color: 0x8cecff, depthTest: false, transparent: true, opacity: 0.38, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const wavePointMaterial = new THREE.PointsMaterial({ color: 0xbef7ff, depthTest: false, size: 1.2, transparent: true, opacity: 0.5, sizeAttenuation: false });
    const playheadMaterial = new THREE.LineBasicMaterial({ color: 0xe6feff, depthTest: false, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending });
    const playheadMarkerMaterial = new THREE.PointsMaterial({ color: 0xffffff, depthTest: false, size: 6, transparent: true, opacity: 0.96, sizeAttenuation: false, blending: THREE.AdditiveBlending });
    const dnaPrimaryMaterial = new THREE.LineBasicMaterial({ color: 0x83edff, depthTest: false, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending });
    const dnaSecondaryMaterial = new THREE.LineBasicMaterial({ color: 0x638cff, depthTest: false, transparent: true, opacity: 0.58, blending: THREE.AdditiveBlending });
    const innerMembraneMaterial = new THREE.LineBasicMaterial({ color: 0x8edfff, depthTest: false, transparent: true, opacity: 0.24, blending: THREE.AdditiveBlending });
    const dnaAccentMaterial = new THREE.LineBasicMaterial({ color: 0xb3a9ff, depthTest: false, transparent: true, opacity: 0.42, blending: THREE.AdditiveBlending });
    const dnaSparkMaterial = new THREE.PointsMaterial({ color: 0xf4feff, depthTest: false, size: 3.8, transparent: true, opacity: 0.78, sizeAttenuation: false, blending: THREE.AdditiveBlending });
    const particleMaterial = new THREE.PointsMaterial({ color: 0x65cfff, depthTest: false, size: 1.2, transparent: true, opacity: 0.34, sizeAttenuation: false, blending: THREE.AdditiveBlending });

    const wavePositions = new Float32Array(wavePointLimit * 3);
    const secondaryPositions = new Float32Array(wavePointLimit * 3);
    const samplePositions = new Float32Array(samplePointLimit * 3);
    const sampleStemPositions = new Float32Array(samplePointLimit * 2 * 3);
    const playheadPositions = new Float32Array(2 * 3);
    const playheadMarkerPositions = new Float32Array(3);
    const dnaPrimaryPositions = new Float32Array((organicPointLimit + 1) * 3);
    const dnaSecondaryPositions = new Float32Array((tendrilLimit * tendrilSegmentLimit + internalFilamentLimit * internalFilamentSegmentLimit) * 2 * 3);
    const dnaAccentPositions = new Float32Array(nucleusPointLimit * 3);
    const innerMembranePositions = new Float32Array(innerMembranePointLimit * 3);
    const particlePositions = new Float32Array(particleCount * 3);
    const particleSeeds = new Float32Array(particleCount * 3);

    const waveGeometry = dynamicGeometry(wavePositions);
    const secondaryGeometry = dynamicGeometry(secondaryPositions);
    const pointGeometry = dynamicGeometry(samplePositions);
    const stemGeometry = dynamicGeometry(sampleStemPositions);
    const playheadGeometry = dynamicGeometry(playheadPositions);
    const playheadMarkerGeometry = dynamicGeometry(playheadMarkerPositions);
    const dnaPrimaryGeometry = dynamicGeometry(dnaPrimaryPositions);
    const dnaSecondaryGeometry = dynamicGeometry(dnaSecondaryPositions);
    const dnaAccentGeometry = dynamicGeometry(dnaAccentPositions);
    const innerMembraneGeometry = dynamicGeometry(innerMembranePositions);
    const particleGeometry = dynamicGeometry(particlePositions);

    const waveLine = new THREE.Line(waveGeometry, waveMaterial);
    const wavePoints = new THREE.Points(waveGeometry, wavePointMaterial);
    const secondaryLine = new THREE.Line(secondaryGeometry, secondaryMaterial);
    const sampleStems = new THREE.LineSegments(stemGeometry, stemMaterial);
    const sampleContactPoints = new THREE.Points(pointGeometry, contactMaterial);
    const sampleGlowPoints = new THREE.Points(pointGeometry, pointGlowMaterial);
    const samplePoints = new THREE.Points(pointGeometry, pointMaterial);
    const sampleRingGeometry = new THREE.RingGeometry(0.014, 0.022, 16);
    const sampleRings = new THREE.InstancedMesh(sampleRingGeometry, ringMaterial, samplePointLimit);
    sampleRings.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const playheadLine = new THREE.Line(playheadGeometry, playheadMaterial);
    const playheadMarker = new THREE.Points(playheadMarkerGeometry, playheadMarkerMaterial);
    const dnaPrimary = new THREE.Line(dnaPrimaryGeometry, dnaPrimaryMaterial);
    const dnaSecondary = new THREE.LineSegments(dnaSecondaryGeometry, dnaSecondaryMaterial);
    const dnaAccent = new THREE.LineLoop(dnaAccentGeometry, dnaAccentMaterial);
    const innerMembrane = new THREE.LineLoop(innerMembraneGeometry, innerMembraneMaterial);
    const dnaSparks = new THREE.Points(dnaAccentGeometry, dnaSparkMaterial);
    const particles = new THREE.Points(particleGeometry, particleMaterial);

    const haloTexture = createGlowTexture();
    dnaSparkMaterial.map = haloTexture;
    dnaSparkMaterial.alphaTest = 0.02;
    particleMaterial.map = haloTexture;
    particleMaterial.alphaTest = 0.02;
    dnaSparkMaterial.needsUpdate = true;
    particleMaterial.needsUpdate = true;
    const haloMaterial = new THREE.SpriteMaterial({ map: haloTexture, color: 0x72dcff, depthTest: false, transparent: true, opacity: 0, blending: THREE.AdditiveBlending });
    const musicHalo = new THREE.Sprite(haloMaterial);
    musicHalo.position.set(0, -0.02, -0.2);
    const nucleusMaterial = new THREE.SpriteMaterial({ map: haloTexture, color: 0xe9fdff, depthTest: false, transparent: true, opacity: 0, blending: THREE.AdditiveBlending });
    const creatureNucleus = new THREE.Sprite(nucleusMaterial);

    particles.renderOrder = 0;
    musicHalo.renderOrder = 1;
    creatureNucleus.renderOrder = 2;
    secondaryLine.renderOrder = 2;
    dnaSecondary.renderOrder = 3;
    innerMembrane.renderOrder = 4;
    dnaAccent.renderOrder = 4;
    dnaPrimary.renderOrder = 5;
    dnaSparks.renderOrder = 6;
    sampleStems.renderOrder = 7;
    waveLine.renderOrder = 8;
    wavePoints.renderOrder = 9;
    sampleContactPoints.renderOrder = 10;
    sampleGlowPoints.renderOrder = 11;
    sampleRings.renderOrder = 12;
    samplePoints.renderOrder = 13;
    playheadLine.renderOrder = 15;
    playheadMarker.renderOrder = 16;
    scene.add(
      particles,
      musicHalo,
      creatureNucleus,
      secondaryLine,
      dnaSecondary,
      innerMembrane,
      dnaAccent,
      dnaPrimary,
      dnaSparks,
      sampleStems,
      waveLine,
      wavePoints,
      sampleContactPoints,
      sampleGlowPoints,
      sampleRings,
      samplePoints,
      playheadLine,
      playheadMarker,
    );

    for (let index = 0; index < particleCount; index += 1) {
      const offset = index * 3;
      const x = (Math.random() - 0.5) * 2;
      const y = (Math.random() - 0.5) * 2;
      particlePositions[offset] = x;
      particlePositions[offset + 1] = y;
      particleSeeds[offset] = x;
      particleSeeds[offset + 1] = 0.35 + Math.random() * 0.8;
      particleSeeds[offset + 2] = Math.random() * Math.PI * 2;
    }
    particleGeometry.attributes.position.needsUpdate = true;

    const spectrumLevels = new Float32Array(spectrumBandCount);
    const peakLevels = new Float32Array(spectrumBandCount);
    const matrixHelper = new THREE.Object3D();
    let canvasWidth = 1;
    let canvasHeight = 1;
    let displayedSampleCount = sampleCount;
    let previousSampleTarget = sampleCount;
    let samplePulse = 0;
    let displayedViewStart = musicViewStart;
    let displayedProgress = musicProgress;
    let bassEnergy = 0;
    let midEnergy = 0;
    let trebleEnergy = 0;
    let overallEnergy = 0;
    let fastEnergy = 0;
    let slowEnergy = 0;
    let adaptivePeak = 0.025;
    let previousRelativeEnergy = 0;
    let onsetPulse = 0;
    let rhythmImpulse = 0;
    let profileSeed = -1;
    let creatureGenome = createCreatureGenome(musicVisualSeed);
    let creatureX = creatureGenome.spawnX;
    let creatureY = creatureGenome.spawnY;
    let creatureVelocityX = Math.cos(creatureGenome.wanderPhase) * 0.025;
    let creatureVelocityY = Math.sin(creatureGenome.wanderPhase) * 0.025;
    let creatureHeading = creatureGenome.wanderPhase;
    let threatResponse = 0;
    let startlePulse = 0;
    let lastRepulsorUpdate = -1;
    let escapeTargetX = 0;
    let escapeTargetY = 0;
    let escapeUntil = 0;

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reducedMotion = motionQuery.matches;
    const updateMotionPreference = (event: MediaQueryListEvent) => {
      reducedMotion = event.matches;
    };
    motionQuery.addEventListener?.('change', updateMotionPreference);

    const resize = () => {
      const rect = mount.getBoundingClientRect();
      canvasWidth = Math.max(1, Math.round(rect.width || mount.clientWidth));
      canvasHeight = Math.max(1, Math.round(rect.height || mount.clientHeight));
      renderer.setSize(canvasWidth, canvasHeight, false);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(mount);

    const hideSamples = () => {
      sampleStems.visible = false;
      sampleContactPoints.visible = false;
      sampleGlowPoints.visible = false;
      sampleRings.visible = false;
      samplePoints.visible = false;
    };

    const hideMusicWave = () => {
      playheadLine.visible = false;
      playheadMarker.visible = false;
    };

    const hideSpectrum = () => {
      dnaPrimary.visible = false;
      dnaSecondary.visible = false;
      innerMembrane.visible = false;
      dnaAccent.visible = false;
      dnaSparks.visible = false;
      musicHalo.visible = false;
      creatureNucleus.visible = false;
      bassEnergy = 0;
      midEnergy = 0;
      trebleEnergy = 0;
      overallEnergy = 0;
      onsetPulse *= 0.9;
      rhythmImpulse *= 0.86;
    };

    const updateSpectrumLevels = (data: Uint8Array, volume: number, deltaTime: number) => {
      let bassTotal = 0;
      let midTotal = 0;
      let trebleTotal = 0;
      let bassCount = 0;
      let midCount = 0;
      let trebleCount = 0;
      const volumeEnergy = 0.22 + volume * 0.78;

      for (let index = 0; index < spectrumBandCount; index += 1) {
        const start = logarithmicBin(index, spectrumBandCount, data.length);
        const end = Math.max(start + 1, logarithmicBin(index + 1, spectrumBandCount, data.length));
        let total = 0;
        let maximum = 0;
        for (let bin = start; bin < Math.min(end, data.length); bin += 1) {
          const value = data[bin] ?? 0;
          total += value;
          maximum = Math.max(maximum, value);
        }
        const groupedBinCount = Math.max(1, Math.min(end, data.length) - start);
        const target = Math.min(1, (total / groupedBinCount * 0.58 + maximum * 0.42) / 255 * volumeEnergy);
        const rise = 1 - Math.exp(-deltaTime * (target > spectrumLevels[index] ? 18 : 5));
        spectrumLevels[index] += (target - spectrumLevels[index]) * rise;
        peakLevels[index] = Math.max(spectrumLevels[index], peakLevels[index] - (reducedMotion ? 0.02 : 0.008));
        const band = index / spectrumBandCount;
        if (band < 0.24) {
          bassTotal += spectrumLevels[index];
          bassCount += 1;
        } else if (band < 0.68) {
          midTotal += spectrumLevels[index];
          midCount += 1;
        } else {
          trebleTotal += spectrumLevels[index];
          trebleCount += 1;
        }
      }

      bassEnergy = bassTotal / Math.max(1, bassCount);
      midEnergy = midTotal / Math.max(1, midCount);
      trebleEnergy = trebleTotal / Math.max(1, trebleCount);
      overallEnergy = bassEnergy * 0.34 + midEnergy * 0.44 + trebleEnergy * 0.22;
      const fastRate = overallEnergy > fastEnergy ? 16 : 7;
      fastEnergy += (overallEnergy - fastEnergy) * (1 - Math.exp(-deltaTime * fastRate));
      slowEnergy += (overallEnergy - slowEnergy) * (1 - Math.exp(-deltaTime * 0.85));
      const relativeEnergy = Math.max(0, fastEnergy - slowEnergy);
      adaptivePeak = Math.max(relativeEnergy, adaptivePeak * Math.exp(-deltaTime * 0.72), 0.018);
      const normalizedPulse = Math.min(1, relativeEnergy / Math.max(0.018, adaptivePeak * 0.82));
      const relativeRise = Math.max(0, normalizedPulse - previousRelativeEnergy);
      const pulseTarget = Math.min(1, normalizedPulse * 0.72 + relativeRise * 1.65);
      const envelopeRate = pulseTarget > onsetPulse ? 22 : 4.8;
      onsetPulse += (pulseTarget - onsetPulse) * (1 - Math.exp(-deltaTime * envelopeRate));
      rhythmImpulse = Math.max(rhythmImpulse * Math.exp(-deltaTime * 9), Math.min(1, relativeRise * 2.8));
      previousRelativeEnergy = normalizedPulse;
    };

    const writeOrganicPoint = (positions: Float32Array, index: number, x: number, y: number) => {
      positions[index * 3] = x;
      positions[index * 3 + 1] = y;
      positions[index * 3 + 2] = 0;
    };

    const updateCreaturePhysics = (time: number, deltaTime: number, current: WaveCanvasProps) => {
      const motionScale = reducedMotion ? 0.24 : 1;
      const scale = current.creatureScale ?? 1;
      const activity = current.musicPlaying ? 0.16 + overallEnergy * 0.84 : 0.1;
      startlePulse *= Math.exp(-deltaTime * 5.6);
      const wanderAngle = creatureGenome.wanderPhase
        + Math.sin(time * creatureGenome.wanderSpeed) * creatureGenome.turningTendency
        + Math.sin(time * 0.17 + creatureGenome.wanderPhase) * 0.65
        + midEnergy * creatureGenome.midSensitivity * Math.sin(time * 1.7);
      const desiredSpeed = (0.018 + activity * creatureGenome.wanderSpeed * 0.16 + rhythmImpulse * 0.075) * motionScale;
      let accelerationX = (Math.cos(wanderAngle) * desiredSpeed - creatureVelocityX) * (0.55 + creatureGenome.turningTendency);
      let accelerationY = (Math.sin(wanderAngle) * desiredSpeed - creatureVelocityY) * (0.55 + creatureGenome.turningTendency);

      const visualRadius = creatureGenome.bodyRadius * scale;
      const horizontalLimit = Math.max(0.18, 0.84 - visualRadius * Math.max(1, creatureGenome.bodyElongation) * 0.72);
      const verticalLimit = Math.max(0.16, 0.72 - visualRadius * 0.82);
      const insideEdgeZone = Math.abs(creatureX) > horizontalLimit || Math.abs(creatureY) > verticalLimit;
      if (insideEdgeZone && time >= escapeUntil) {
        const phase = creatureGenome.escapePhase + time * 1.618;
        escapeTargetX = Math.abs(creatureX) > horizontalLimit
          ? -Math.sign(creatureX || 1) * (0.08 + Math.abs(Math.sin(phase)) * 0.22)
          : Math.sin(phase * 1.37) * horizontalLimit * 0.48;
        escapeTargetY = Math.abs(creatureY) > verticalLimit
          ? -Math.sign(creatureY || 1) * (0.07 + Math.abs(Math.cos(phase * 0.91)) * 0.2)
          : Math.cos(phase * 1.11) * verticalLimit * 0.48;
        escapeUntil = time + creatureGenome.escapeCommitment;
      }
      if (time < escapeUntil) {
        const escapeX = escapeTargetX - creatureX;
        const escapeY = escapeTargetY - creatureY;
        const escapeDistance = Math.max(0.001, Math.hypot(escapeX, escapeY));
        const escapeSpeed = 0.1 + visualRadius * 0.08;
        accelerationX += (escapeX / escapeDistance * escapeSpeed - creatureVelocityX) * 2.6;
        accelerationY += (escapeY / escapeDistance * escapeSpeed - creatureVelocityY) * 2.6;
      } else {
        if (creatureX > horizontalLimit) accelerationX -= (creatureX - horizontalLimit) * 3.4;
        if (creatureX < -horizontalLimit) accelerationX += (-horizontalLimit - creatureX) * 3.4;
        if (creatureY > verticalLimit) accelerationY -= (creatureY - verticalLimit) * 3.4;
        if (creatureY < -verticalLimit) accelerationY += (-verticalLimit - creatureY) * 3.4;
      }

      let nearestThreat = 0;
      for (const repulsor of current.repulsors ?? []) {
        const repulsorX = repulsor.x * 1.8 - 0.9;
        const repulsorY = (1 - repulsor.y) * 1.34 - 0.67;
        const deltaX = creatureX - repulsorX;
        const deltaY = creatureY - repulsorY;
        const rawDistance = Math.hypot(deltaX, deltaY);
        const distance = Math.max(0.001, rawDistance);
        const fallbackAngle = creatureHeading + Math.PI;
        const awayX = rawDistance < 0.006 ? Math.cos(fallbackAngle) : deltaX / distance;
        const awayY = rawDistance < 0.006 ? Math.sin(fallbackAngle) : deltaY / distance;
        const collisionRadius = visualRadius * (0.72 + creatureGenome.bodyElongation * 0.18);
        const radius = repulsor.type === 'ripple' ? repulsor.currentRadius ?? repulsor.radius : repulsor.radius + collisionRadius;
        const rippleDistance = repulsor.type === 'ripple' ? Math.abs(Math.max(0, distance - collisionRadius) - radius) : distance;
        const influence = Math.max(0, 1 - rippleDistance / Math.max(0.06, repulsor.type === 'ripple' ? repulsor.radius : radius));
        if (influence <= 0) continue;
        const force = influence * influence * repulsor.strength * creatureGenome.avoidanceSensitivity * 1.35;
        accelerationX += awayX * force;
        accelerationY += awayY * force;
        const isNewRepulsorUpdate = repulsor.updatedAt !== undefined && repulsor.updatedAt !== lastRepulsorUpdate;
        if (isNewRepulsorUpdate) {
          const swipeSpeed = Math.hypot(repulsor.velocityX ?? 0, repulsor.velocityY ?? 0);
          const impulse = influence * (0.055 + Math.min(0.24, swipeSpeed * 0.075));
          creatureVelocityX += awayX * impulse;
          creatureVelocityY += awayY * impulse;
          startlePulse = Math.max(startlePulse, Math.min(1, influence * 0.72 + swipeSpeed * 0.2));
          lastRepulsorUpdate = repulsor.updatedAt ?? lastRepulsorUpdate;
        }
        if (repulsor.type === 'ripple' && influence > threatResponse + 0.16) {
          const rippleImpulse = influence * 0.13;
          creatureVelocityX += awayX * rippleImpulse;
          creatureVelocityY += awayY * rippleImpulse;
          startlePulse = Math.max(startlePulse, influence);
        }
        nearestThreat = Math.max(nearestThreat, influence);
      }

      threatResponse += (nearestThreat - threatResponse) * (1 - Math.exp(-deltaTime * (nearestThreat > threatResponse ? 18 : 4.2)));
      accelerationX += Math.cos(creatureHeading) * rhythmImpulse * creatureGenome.onsetSensitivity * 0.12;
      accelerationY += Math.sin(creatureHeading) * rhythmImpulse * creatureGenome.onsetSensitivity * 0.12;
      creatureVelocityX += accelerationX * deltaTime;
      creatureVelocityY += accelerationY * deltaTime;
      const maxSpeed = (0.1 + overallEnergy * 0.1 + threatResponse * 0.22 + startlePulse * 0.2 + (time < escapeUntil ? 0.08 : 0)) * motionScale;
      const speed = Math.hypot(creatureVelocityX, creatureVelocityY);
      if (speed > maxSpeed) {
        creatureVelocityX = creatureVelocityX / speed * maxSpeed;
        creatureVelocityY = creatureVelocityY / speed * maxSpeed;
      }
      creatureX += creatureVelocityX * deltaTime;
      creatureY += creatureVelocityY * deltaTime;
      if (speed > 0.003) {
        const targetHeading = Math.atan2(creatureVelocityY, creatureVelocityX);
        const turn = Math.atan2(Math.sin(targetHeading - creatureHeading), Math.cos(targetHeading - creatureHeading));
        creatureHeading += turn * Math.min(1, deltaTime * (3.2 + midEnergy * 3 + startlePulse * 4));
      }
    };

    const drawSoundCreature = (time: number, current: WaveCanvasProps) => {
      const aspect = Math.min(1, canvasHeight / canvasWidth);
      const audioPhase = current.musicTime ?? 0;
      const scale = current.creatureScale ?? 1;
      const baseRadius = creatureGenome.bodyRadius * scale;
      const contraction = 1 - rhythmImpulse * creatureGenome.onsetSensitivity * 0.16 - startlePulse * 0.24;
      const breath = 1 + Math.sin(time * 0.82 + creatureGenome.wanderPhase) * 0.045
        + onsetPulse * creatureGenome.bassSensitivity * 0.24
        + bassEnergy * 0.08;
      const bodyRotation = creatureHeading + Math.sin(time * 0.31 + creatureGenome.wanderPhase) * 0.18
        + midEnergy * creatureGenome.midSensitivity * 0.28;

      for (let index = 0; index <= organicPointLimit; index += 1) {
        const t = index / organicPointLimit;
        const angle = t * Math.PI * 2;
        const bandPosition = t * spectrumBandCount;
        const bandIndex = Math.floor(bandPosition) % spectrumBandCount;
        const nextBandIndex = (bandIndex + 1) % spectrumBandCount;
        const blend = bandPosition - Math.floor(bandPosition);
        const energy = spectrumLevels[bandIndex] * (1 - blend) + spectrumLevels[nextBandIndex] * blend;
        const peak = peakLevels[bandIndex] * (1 - blend) + peakLevels[nextBandIndex] * blend;
        const asymmetry = Math.sin(angle + creatureGenome.asymmetryPhase) * creatureGenome.asymmetry;
        const unevenLobes = Math.sin(angle * creatureGenome.lobeCount + creatureGenome.contourPhase + time * creatureGenome.membraneElasticity + audioPhase * 0.18) * creatureGenome.lobeDepth;
        const secondaryContour = Math.sin(angle * creatureGenome.secondaryLobes - creatureGenome.contourPhase * 0.7 + time * 0.19) * creatureGenome.secondaryLobeDepth;
        const offCenterMass = Math.cos(angle - creatureGenome.massAngle) * creatureGenome.massBias;
        const surface = Math.sin(angle * (creatureGenome.lobeCount + 5) - time * (0.7 + trebleEnergy)) * trebleEnergy * creatureGenome.trebleSensitivity * baseRadius * 0.2;
        const tail = Math.max(0, Math.cos(angle - creatureGenome.tailAngle)) ** 7 * creatureGenome.tailLength * scale * (0.55 + midEnergy * 0.8);
        const forwardExtension = Math.max(0, Math.cos(angle)) ** 8 * scale * (0.018 + midEnergy * creatureGenome.midSensitivity * 0.07);
        const radius = baseRadius * breath * contraction * (1 + asymmetry + unevenLobes + secondaryContour + offCenterMass)
          + creatureGenome.membraneRipple * scale * Math.sin(angle * 3 + time * 0.6)
          + surface + energy * scale * 0.045 + peak * scale * 0.018 + forwardExtension + tail;
        const localX = Math.cos(angle) * radius * creatureGenome.bodyElongation;
        const localY = Math.sin(angle) * radius;
        const rotatedX = localX * Math.cos(bodyRotation) - localY * Math.sin(bodyRotation);
        const rotatedY = localX * Math.sin(bodyRotation) + localY * Math.cos(bodyRotation);
        writeOrganicPoint(dnaPrimaryPositions, index, creatureX + rotatedX * aspect, creatureY + rotatedY);
      }

      for (let index = 0; index < innerMembranePointLimit; index += 1) {
        const angle = index / innerMembranePointLimit * Math.PI * 2;
        const flow = Math.sin(angle * creatureGenome.secondaryLobes - time * 0.42 + creatureGenome.contourPhase) * 0.055;
        const radius = baseRadius * creatureGenome.innerMembraneScale * (1 + flow + Math.sin(angle + creatureGenome.massAngle) * creatureGenome.asymmetry * 0.42)
          * (1 + onsetPulse * 0.1 - startlePulse * 0.12);
        const localX = Math.cos(angle) * radius * (creatureGenome.bodyElongation * 0.9 + 0.1);
        const localY = Math.sin(angle) * radius;
        const rotatedX = localX * Math.cos(bodyRotation) - localY * Math.sin(bodyRotation);
        const rotatedY = localX * Math.sin(bodyRotation) + localY * Math.cos(bodyRotation);
        writeOrganicPoint(innerMembranePositions, index, creatureX + rotatedX * aspect, creatureY + rotatedY);
      }

      const activeTendrils = compact ? Math.min(7, creatureGenome.tendrilCount) : creatureGenome.tendrilCount;
      const segments = compact ? 6 : tendrilSegmentLimit;
      let tendrilVertex = 0;
      for (let tendril = 0; tendril < activeTendrils; tendril += 1) {
        const baseAngle = tendril / activeTendrils * Math.PI * 2 + creatureGenome.tendrilBias;
        const tendrilHeading = bodyRotation - Math.sin(time * 0.7 + tendril) * (0.06 + startlePulse * 0.2);
        let previousX = creatureX + Math.cos(baseAngle + tendrilHeading) * baseRadius * 0.78 * aspect;
        let previousY = creatureY + Math.sin(baseAngle + tendrilHeading) * baseRadius * 0.78;
        for (let segment = 1; segment <= segments; segment += 1) {
          const progress = segment / segments;
          const flick = Math.sin(time * (1.2 + trebleEnergy * 3.4) + tendril * 1.7 + progress * 5.2) * (0.018 + trebleEnergy * 0.055);
          const trailX = -Math.cos(creatureHeading) * (threatResponse + startlePulse * 0.8) * progress * 0.16 * scale;
          const trailY = -Math.sin(creatureHeading) * (threatResponse + startlePulse * 0.8) * progress * 0.16 * scale;
          const length = creatureGenome.tendrilLength * scale * progress * (1 + onsetPulse * 0.18);
          const angle = baseAngle + tendrilHeading + flick * creatureGenome.tendrilFlex;
          const nextX = creatureX + Math.cos(angle) * (baseRadius * 0.78 + length) * aspect + trailX;
          const nextY = creatureY + Math.sin(angle) * (baseRadius * 0.78 + length) + trailY;
          const offset = tendrilVertex * 3;
          dnaSecondaryPositions[offset] = previousX;
          dnaSecondaryPositions[offset + 1] = previousY;
          dnaSecondaryPositions[offset + 2] = 0;
          dnaSecondaryPositions[offset + 3] = nextX;
          dnaSecondaryPositions[offset + 4] = nextY;
          dnaSecondaryPositions[offset + 5] = 0;
          tendrilVertex += 2;
          previousX = nextX;
          previousY = nextY;
        }
      }

      const nucleusAngle = bodyRotation + creatureGenome.nucleusAngle;
      const nucleusDrift = Math.sin(time * 0.63 + creatureGenome.contourPhase) * 0.012 * scale;
      const nucleusX = creatureX + Math.cos(nucleusAngle) * (creatureGenome.nucleusOffset * scale + nucleusDrift) * aspect;
      const nucleusY = creatureY + Math.sin(nucleusAngle) * (creatureGenome.nucleusOffset * scale + nucleusDrift);
      const nucleusPulse = creatureGenome.nucleusSize * scale * (1 + onsetPulse * 0.42 - rhythmImpulse * 0.16 - startlePulse * 0.3);
      for (let index = 0; index < nucleusPointLimit; index += 1) {
        const angle = index / nucleusPointLimit * Math.PI * 2;
        const ripple = 1 + Math.sin(angle * creatureGenome.nucleusLobes + time * 1.4) * creatureGenome.nucleusIrregularity;
        const localX = Math.cos(angle) * nucleusPulse * creatureGenome.nucleusStretch * ripple;
        const localY = Math.sin(angle) * nucleusPulse * ripple;
        const rotatedX = localX * Math.cos(nucleusAngle) - localY * Math.sin(nucleusAngle);
        const rotatedY = localX * Math.sin(nucleusAngle) + localY * Math.cos(nucleusAngle);
        writeOrganicPoint(dnaAccentPositions, index, nucleusX + rotatedX * aspect, nucleusY + rotatedY);
      }

      const activeFilaments = compact ? 2 : creatureGenome.internalFilamentCount;
      for (let filament = 0; filament < activeFilaments; filament += 1) {
        const targetAngle = bodyRotation + creatureGenome.filamentBias + filament / Math.max(1, activeFilaments) * Math.PI * 2;
        let previousX = nucleusX;
        let previousY = nucleusY;
        for (let segment = 1; segment <= internalFilamentSegmentLimit; segment += 1) {
          const progress = segment / internalFilamentSegmentLimit;
          const bend = Math.sin(time * 0.8 + filament * 2.1 + progress * 4.4) * creatureGenome.filamentFlow * progress;
          const nextX = nucleusX + Math.cos(targetAngle + bend) * baseRadius * progress * 0.66 * aspect;
          const nextY = nucleusY + Math.sin(targetAngle + bend) * baseRadius * progress * 0.66;
          const offset = tendrilVertex * 3;
          dnaSecondaryPositions[offset] = previousX;
          dnaSecondaryPositions[offset + 1] = previousY;
          dnaSecondaryPositions[offset + 2] = 0;
          dnaSecondaryPositions[offset + 3] = nextX;
          dnaSecondaryPositions[offset + 4] = nextY;
          dnaSecondaryPositions[offset + 5] = 0;
          tendrilVertex += 2;
          previousX = nextX;
          previousY = nextY;
        }
      }

      dnaPrimaryGeometry.setDrawRange(0, organicPointLimit + 1);
      dnaSecondaryGeometry.setDrawRange(0, tendrilVertex);
      dnaAccentGeometry.setDrawRange(0, nucleusPointLimit);
      innerMembraneGeometry.setDrawRange(0, innerMembranePointLimit);
      dnaPrimaryGeometry.attributes.position.needsUpdate = true;
      dnaSecondaryGeometry.attributes.position.needsUpdate = true;
      dnaAccentGeometry.attributes.position.needsUpdate = true;
      innerMembraneGeometry.attributes.position.needsUpdate = true;

      musicHalo.position.set(creatureX, creatureY, -0.2);
      const haloScale = baseRadius * (2.45 + onsetPulse * 0.7 + startlePulse * 0.18);
      musicHalo.scale.set(haloScale * creatureGenome.bodyElongation, haloScale, 1);
      creatureNucleus.position.set(nucleusX, nucleusY, 0.05);
      creatureNucleus.scale.set(nucleusPulse * 2.7 * creatureGenome.nucleusStretch, nucleusPulse * 2.45, 1);
      nucleusMaterial.rotation = nucleusAngle;
      nucleusMaterial.opacity = 0.12 + onsetPulse * 0.32 + bassEnergy * 0.08;
    };

    const drawSpectrum = (data: Uint8Array, current: WaveCanvasProps, time: number, deltaTime: number) => {
      if (profileSeed !== current.musicVisualSeed) {
        profileSeed = current.musicVisualSeed ?? 1;
        creatureGenome = createCreatureGenome(profileSeed);
        creatureX = creatureGenome.spawnX;
        creatureY = creatureGenome.spawnY;
        creatureVelocityX = Math.cos(creatureGenome.wanderPhase) * 0.025;
        creatureVelocityY = Math.sin(creatureGenome.wanderPhase) * 0.025;
        creatureHeading = creatureGenome.wanderPhase;
        fastEnergy = 0;
        slowEnergy = 0;
        adaptivePeak = 0.025;
        previousRelativeEnergy = 0;
        onsetPulse = 0;
        rhythmImpulse = 0;
        startlePulse = 0;
        escapeUntil = 0;
        dnaPrimaryMaterial.color.setHex(creatureGenome.membraneColor);
        dnaSecondaryMaterial.color.setHex(creatureGenome.tendrilColor);
        innerMembraneMaterial.color.setHex(creatureGenome.innerMembraneColor);
        dnaAccentMaterial.color.setHex(creatureGenome.nucleusColor);
        dnaSparkMaterial.color.setHex(creatureGenome.sparkColor);
        particleMaterial.color.setHex(creatureGenome.particleColor);
        haloMaterial.color.setHex(creatureGenome.glowColor);
        nucleusMaterial.color.setHex(creatureGenome.nucleusColor);
      }
      updateSpectrumLevels(data, current.musicVolume ?? 0.8, deltaTime);
      updateCreaturePhysics(time, deltaTime, current);
      drawSoundCreature(time, current);

      dnaPrimary.visible = true;
      dnaSecondary.visible = true;
      innerMembrane.visible = true;
      dnaAccent.visible = true;
      dnaSparks.visible = !reducedMotion;
      musicHalo.visible = true;
      creatureNucleus.visible = true;
      dnaPrimaryMaterial.opacity = 0.62 + midEnergy * 0.3 + onsetPulse * 0.08;
      dnaSecondaryMaterial.opacity = 0.25 + trebleEnergy * 0.48 + threatResponse * 0.16;
      innerMembraneMaterial.opacity = 0.18 + midEnergy * 0.18 + onsetPulse * 0.12;
      dnaAccentMaterial.opacity = 0.48 + bassEnergy * 0.4;
      dnaSparkMaterial.opacity = 0.14 + trebleEnergy * 0.55 + onsetPulse * 0.18;
      haloMaterial.opacity = creatureGenome.glowIntensity * (0.08 + bassEnergy * 0.22 + onsetPulse * 0.08);
    };

    const drawMusicWave = (current: WaveCanvasProps) => {
      const overview = current.musicData;
      if (!overview?.length) return false;
      displayedViewStart += ((current.musicViewStart ?? 0) - displayedViewStart) * (reducedMotion ? 1 : 0.16);
      displayedProgress += ((current.musicProgress ?? 0) - displayedProgress) * (reducedMotion ? 1 : 0.24);
      const zoom = Math.max(1, current.musicZoom ?? 1);
      const visibleFraction = 1 / zoom;
      const visualAmplitude = 0.08 + (current.musicVolume ?? 0.8) * 0.92;
      const pcm = current.musicPcmData;
      const visiblePcmSamples = pcm ? Math.max(2, Math.floor(pcm.length * visibleFraction)) : 0;
      const usePcm = Boolean(pcm?.length) && visiblePcmSamples <= 262144;
      const source = usePcm && pcm ? pcm : overview;
      const viewportPointBudget = Math.min(wavePointLimit, Math.max(192, Math.round(canvasWidth * 0.9)));
      const pointTotal = usePcm ? Math.min(viewportPointBudget, visiblePcmSamples) : Math.min(viewportPointBudget, overview.length);

      for (let index = 0; index < pointTotal; index += 1) {
        const t = index / Math.max(1, pointTotal - 1);
        const sourceT = Math.min(1, displayedViewStart + t * visibleFraction);
        const sourcePosition = sourceT * (source.length - 1);
        const sourceIndex = Math.min(source.length - 1, Math.floor(sourcePosition));
        const nextIndex = Math.min(source.length - 1, sourceIndex + 1);
        const blend = sourcePosition - sourceIndex;
        const sample = (source[sourceIndex] ?? 0) * (1 - blend) + (source[nextIndex] ?? 0) * blend;
        const x = t * 1.8 - 0.9;
        const y = sample * 0.7 * visualAmplitude;
        wavePositions[index * 3] = x;
        wavePositions[index * 3 + 1] = y;
        wavePositions[index * 3 + 2] = 0;
      }

      const localProgress = (displayedProgress - displayedViewStart) / visibleFraction;
      waveGeometry.setDrawRange(0, pointTotal);
      waveGeometry.attributes.position.needsUpdate = true;
      waveMaterial.opacity = 0.9;
      secondaryLine.visible = false;

      const playheadVisible = localProgress >= 0 && localProgress <= 1;
      if (playheadVisible) {
        const x = -0.9 + localProgress * 1.8;
        playheadPositions[0] = x;
        playheadPositions[1] = -0.66;
        playheadPositions[2] = 0;
        playheadPositions[3] = x;
        playheadPositions[4] = 0.66;
        playheadPositions[5] = 0;
        playheadMarkerPositions[0] = x;
        playheadMarkerPositions[1] = 0.69;
        playheadMarkerPositions[2] = 0;
        playheadGeometry.setDrawRange(0, 2);
        playheadMarkerGeometry.setDrawRange(0, 1);
        playheadGeometry.attributes.position.needsUpdate = true;
        playheadMarkerGeometry.attributes.position.needsUpdate = true;
      }
      playheadLine.visible = playheadVisible;
      playheadMarker.visible = playheadVisible;
      return true;
    };

    const drawWave = (time: number, deltaTime: number) => {
      const current = stateRef.current;
      const spectrumActive = current.mode === 'music' && current.musicData === null && Boolean(current.musicPcmData?.length);
      hideSamples();
      hideMusicWave();

      if (spectrumActive) {
        waveLine.visible = false;
        wavePoints.visible = false;
        secondaryLine.visible = false;
        drawSpectrum(current.spectrumData ?? silentSpectrumData, current, time, deltaTime);
        return;
      }

      hideSpectrum();
      waveLine.visible = true;
      if (current.mode === 'music' && drawMusicWave(current)) {
        wavePoints.visible = true;
        return;
      }

      const pointTotal = 280;
      for (let index = 0; index < pointTotal; index += 1) {
        const t = index / Math.max(pointTotal - 1, 1);
        const x = t * 1.8 - 0.9;
        const y = resolveY(t, time, current);
        wavePositions[index * 3] = x;
        wavePositions[index * 3 + 1] = y;
        wavePositions[index * 3 + 2] = 0;
        secondaryPositions[index * 3] = x;
        secondaryPositions[index * 3 + 1] = current.mode === 'quantize' ? quantize(y, current.bitDepth ?? 4) : y * 0.52 - 0.34;
        secondaryPositions[index * 3 + 2] = 0;
      }
      waveGeometry.setDrawRange(0, pointTotal);
      secondaryGeometry.setDrawRange(0, pointTotal);
      waveGeometry.attributes.position.needsUpdate = true;
      secondaryGeometry.attributes.position.needsUpdate = true;

      if (current.mode === 'sample') {
        if (previousSampleTarget !== current.sampleCount) {
          previousSampleTarget = current.sampleCount ?? 16;
          samplePulse = 1;
        }
        samplePulse *= reducedMotion ? 0 : 0.86;
        displayedSampleCount += ((current.sampleCount ?? 16) - displayedSampleCount) * (reducedMotion ? 1 : 0.2);
        if (Math.abs((current.sampleCount ?? 16) - displayedSampleCount) < 0.08) displayedSampleCount = current.sampleCount ?? 16;
        const visibleSamples = Math.max(1, Math.min(samplePointLimit, Math.round(displayedSampleCount)));
        for (let index = 0; index < visibleSamples; index += 1) {
          const t = index / Math.max(visibleSamples - 1, 1);
          const x = t * 1.8 - 0.9;
          const y = resolveY(t, time, current);
          samplePositions[index * 3] = x;
          samplePositions[index * 3 + 1] = y;
          samplePositions[index * 3 + 2] = 0;
          const stemIndex = index * 6;
          sampleStemPositions[stemIndex] = x;
          sampleStemPositions[stemIndex + 1] = -0.62;
          sampleStemPositions[stemIndex + 2] = 0;
          sampleStemPositions[stemIndex + 3] = x;
          sampleStemPositions[stemIndex + 4] = y;
          sampleStemPositions[stemIndex + 5] = 0;
          matrixHelper.position.set(x, y, 0);
          const ringScale = 1 + samplePulse * 0.45;
          matrixHelper.scale.set(ringScale, ringScale, 1);
          matrixHelper.updateMatrix();
          sampleRings.setMatrixAt(index, matrixHelper.matrix);
        }
        sampleRings.count = visibleSamples;
        sampleRings.instanceMatrix.needsUpdate = true;
        pointGeometry.setDrawRange(0, visibleSamples);
        stemGeometry.setDrawRange(0, visibleSamples * 2);
        pointGeometry.attributes.position.needsUpdate = true;
        stemGeometry.attributes.position.needsUpdate = true;
        sampleStems.visible = true;
        sampleContactPoints.visible = true;
        sampleGlowPoints.visible = !reducedMotion;
        sampleRings.visible = true;
        samplePoints.visible = true;
        ringMaterial.opacity = 0.3 + samplePulse * 0.22;
      }

      secondaryLine.visible = current.mode === 'quantize';
      wavePoints.visible = current.mode !== 'sample';
      waveMaterial.opacity = current.mode === 'home' ? 0.62 : 0.95;
      wavePointMaterial.opacity = current.mode === 'home' ? 0.34 : 0.5;
    };

    const drawParticles = (time: number) => {
      const current = stateRef.current;
      const spectrumActive = current.mode === 'music' && current.musicData === null && Boolean(current.musicPcmData?.length);
      const motionScale = reducedMotion ? 0.18 : 1;
      const activeParticleCount = spectrumActive ? Math.min(compact ? 120 : particleCount, creatureGenome.particleCount) : particleCount;
      particleGeometry.setDrawRange(0, activeParticleCount);
      const creatureSpeed = Math.max(0.001, Math.hypot(creatureVelocityX, creatureVelocityY));
      for (let index = 0; index < activeParticleCount; index += 1) {
        const offset = index * 3;
        if (spectrumActive) {
          const scale = current.creatureScale ?? 1;
          const phase = particleSeeds[offset + 2] + time * (0.18 + particleSeeds[offset + 1] * 0.22) * creatureGenome.particleOrbit * motionScale;
          const scatter = startlePulse * particleSeeds[offset + 1] * 0.16 * scale;
          const clusterRadius = creatureGenome.bodyRadius * scale * (0.3 + particleSeeds[offset + 1] * 1.35) + onsetPulse * 0.055 * scale + scatter;
          const trailAmount = particleSeeds[offset + 1] * (0.04 + creatureSpeed * 0.9 + threatResponse * 0.12 + startlePulse * 0.18) * scale;
          const trailX = -creatureVelocityX / creatureSpeed * trailAmount;
          const trailY = -creatureVelocityY / creatureSpeed * trailAmount;
          particlePositions[offset] = creatureX + Math.cos(phase) * clusterRadius * Math.min(1, canvasHeight / canvasWidth) + trailX;
          particlePositions[offset + 1] = creatureY + Math.sin(phase * (0.88 + creatureGenome.asymmetry * 0.5)) * clusterRadius + trailY;
          particlePositions[offset + 2] = bassEnergy * 0.06 + onsetPulse * 0.04;
        } else {
          particlePositions[offset + 1] += Math.sin(time + index) * 0.0003 * motionScale;
          const px = current.pointer.x * 2 - 1;
          const py = 1 - current.pointer.y * 2;
          const dx = particlePositions[offset] - px;
          const dy = particlePositions[offset + 1] - py;
          particlePositions[offset + 2] = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) * 2.8) * 0.08;
        }
      }
      particleMaterial.opacity = spectrumActive ? 0.1 + midEnergy * 0.18 + trebleEnergy * 0.34 + onsetPulse * 0.1 + startlePulse * 0.12 : 0.32;
      particleMaterial.size = spectrumActive ? 2.5 + trebleEnergy * (reducedMotion ? 1.2 : 4.8) + onsetPulse * 1.8 + startlePulse * 1.4 : 1.2;
      particleGeometry.attributes.position.needsUpdate = true;
    };

    let frame = 0;
    let lastFrameTime = performance.now();
    const animate = (timestamp = performance.now()) => {
      frame = requestAnimationFrame(animate);
      const deltaTime = Math.min(0.05, Math.max(0.001, (timestamp - lastFrameTime) / 1000));
      lastFrameTime = timestamp;
      drawWave(timestamp / 1000, deltaTime);
      drawParticles(timestamp / 1000);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      motionQuery.removeEventListener?.('change', updateMotionPreference);
      mount.removeChild(renderer.domElement);
      renderer.dispose();
      [waveGeometry, secondaryGeometry, pointGeometry, stemGeometry, playheadGeometry, playheadMarkerGeometry, dnaPrimaryGeometry, dnaSecondaryGeometry, dnaAccentGeometry, innerMembraneGeometry, particleGeometry, sampleRingGeometry].forEach((geometry) => geometry.dispose());
      haloTexture.dispose();
      [waveMaterial, secondaryMaterial, pointMaterial, pointGlowMaterial, contactMaterial, stemMaterial, ringMaterial, wavePointMaterial, playheadMaterial, playheadMarkerMaterial, dnaPrimaryMaterial, dnaSecondaryMaterial, innerMembraneMaterial, dnaAccentMaterial, dnaSparkMaterial, particleMaterial, haloMaterial, nucleusMaterial].forEach((material) => material.dispose());
    };
  }, []);

  return <div className="wave-canvas" ref={mountRef} aria-hidden="true" />;
}

function dynamicGeometry(positions: Float32Array) {
  const geometry = new THREE.BufferGeometry();
  const attribute = new THREE.BufferAttribute(positions, 3);
  attribute.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', attribute);
  geometry.setDrawRange(0, 0);
  return geometry;
}

function logarithmicBin(index: number, bandCount: number, binCount: number) {
  if (index <= 0) return 1;
  if (index >= bandCount) return binCount;
  return Math.min(binCount - 1, Math.max(1, Math.round(Math.exp(index / bandCount * Math.log(binCount)))));
}

function createCreatureGenome(seed: number) {
  const random = seededRandom(seed);
  const palette = [0x84edff, 0x6bd6ff, 0x9cc8ff, 0xaaa6ff, 0xd8f8ff];
  const pickColor = () => palette[Math.floor(random() * palette.length)];
  return {
    bodyRadius: 0.16 + random() * 0.075,
    bodyElongation: 0.82 + random() * 0.62,
    asymmetry: 0.13 + random() * 0.2,
    asymmetryPhase: random() * Math.PI * 2,
    contourPhase: random() * Math.PI * 2,
    lobeDepth: 0.08 + random() * 0.11,
    secondaryLobes: 2 + Math.floor(random() * 4),
    secondaryLobeDepth: 0.035 + random() * 0.065,
    massBias: 0.08 + random() * 0.13,
    massAngle: random() * Math.PI * 2,
    tailLength: 0.025 + random() * 0.085,
    tailAngle: random() * Math.PI * 2,
    innerMembraneScale: 0.52 + random() * 0.2,
    membraneElasticity: 0.45 + random() * 0.85,
    membraneRipple: 0.012 + random() * 0.032,
    lobeCount: 3 + Math.floor(random() * 7),
    tendrilCount: 5 + Math.floor(random() * 8),
    tendrilLength: 0.08 + random() * 0.18,
    tendrilFlex: 1.8 + random() * 3.2,
    tendrilBias: random() * Math.PI * 2,
    nucleusSize: 0.026 + random() * 0.032,
    nucleusOffset: 0.07 + random() * 0.095,
    nucleusAngle: random() * Math.PI * 2,
    nucleusStretch: 0.72 + random() * 0.9,
    nucleusIrregularity: 0.1 + random() * 0.14,
    nucleusLobes: 3 + Math.floor(random() * 4),
    internalFilamentCount: 2 + Math.floor(random() * 3),
    filamentBias: random() * Math.PI * 2,
    filamentFlow: 0.12 + random() * 0.24,
    glowIntensity: 0.65 + random() * 0.35,
    particleCount: 110 + Math.floor(random() * 111),
    particleOrbit: (random() > 0.5 ? 1 : -1) * (0.55 + random() * 0.95),
    wanderSpeed: 0.18 + random() * 0.32,
    wanderPhase: random() * Math.PI * 2,
    turningTendency: 0.35 + random() * 0.8,
    escapeCommitment: 0.8 + random() * 1.2,
    escapePhase: random() * Math.PI * 2,
    bassSensitivity: 0.7 + random() * 0.65,
    midSensitivity: 0.7 + random() * 0.7,
    trebleSensitivity: 0.7 + random() * 0.8,
    onsetSensitivity: 0.75 + random() * 0.7,
    avoidanceSensitivity: 0.85 + random() * 0.75,
    spawnX: (random() - 0.5) * 0.45,
    spawnY: (random() - 0.5) * 0.34,
    membraneColor: pickColor(),
    innerMembraneColor: pickColor(),
    tendrilColor: pickColor(),
    nucleusColor: random() > 0.4 ? 0xe9fdff : pickColor(),
    sparkColor: random() > 0.35 ? 0xf4feff : pickColor(),
    particleColor: pickColor(),
    glowColor: pickColor(),
  };
}

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function createGlowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  if (context) {
    const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(226, 255, 255, 0.95)');
    gradient.addColorStop(0.18, 'rgba(103, 230, 255, 0.55)');
    gradient.addColorStop(0.52, 'rgba(65, 139, 255, 0.18)');
    gradient.addColorStop(1, 'rgba(27, 64, 180, 0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 128, 128);
  }
  return new THREE.CanvasTexture(canvas);
}

function resolveY(t: number, time: number, current: WaveCanvasProps) {
  const cycles = current.mode === 'home' ? 2.1 : current.frequency / 170;
  const phase = t * Math.PI * 2 * cycles + time * 0.9;
  const raw = current.waveform === 'square' ? Math.sign(Math.sin(phase)) : current.waveform === 'triangle' ? (2 / Math.PI) * Math.asin(Math.sin(phase)) : Math.sin(phase);
  const disturbance = Math.max(0, 1 - Math.abs(t - current.pointer.x) * 7) * 0.045 * Math.sin(time * 6);
  return raw * current.amplitude * 0.52 + disturbance;
}

function quantize(value: number, bitDepth: number) {
  const levels = Math.min(64, 2 ** bitDepth);
  return Math.round(((value + 0.55) / 1.1) * (levels - 1)) / (levels - 1) * 1.1 - 0.55;
}
