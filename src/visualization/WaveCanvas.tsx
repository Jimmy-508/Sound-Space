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
  musicTime?: number;
  musicVisualSeed?: number;
  musicPlaying?: boolean;
  creatureScale?: number;
  repulsors?: Repulsor[];
  homeSoundEnvelope?: Float32Array | null;
  homeSoundStartedAt?: number;
  homeSoundDuration?: number;
  homeSoundToken?: number;
  pointer: PointerPoint;
}

const wavePointLimit = 768;
const samplePointLimit = 64;
const spectrumBandCount = 64;
const bodyPointLimit = 128;
const shieldPointLimit = 192;
const totemStrokeLimit = 16;
const totemStrokeSegmentLimit = 22;
const totemRingLimit = 4;
const totemRingSegmentLimit = 40;
const totemNodeLimit = 24;
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
  musicTime = 0,
  musicVisualSeed = 1,
  musicPlaying = false,
  creatureScale = 1,
  repulsors = [],
  homeSoundEnvelope = null,
  homeSoundStartedAt = 0,
  homeSoundDuration = 0,
  homeSoundToken = 0,
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
    musicTime,
    musicVisualSeed,
    musicPlaying,
    creatureScale,
    repulsors,
    homeSoundEnvelope,
    homeSoundStartedAt,
    homeSoundDuration,
    homeSoundToken,
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
    musicTime,
    musicVisualSeed,
    musicPlaying,
    creatureScale,
    repulsors,
    homeSoundEnvelope,
    homeSoundStartedAt,
    homeSoundDuration,
    homeSoundToken,
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

    const waveMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, vertexColors: true, depthTest: false, transparent: true, opacity: 0.72 });
    const secondaryMaterial = new THREE.LineBasicMaterial({ color: 0x4d94e6, depthTest: false, transparent: true, opacity: 0.32 });
    const pointMaterial = new THREE.PointsMaterial({ color: 0xffffff, depthTest: false, size: 4.5, transparent: true, opacity: 1, sizeAttenuation: false });
    const pointGlowMaterial = new THREE.PointsMaterial({ color: 0x58dfff, depthTest: false, size: 15, transparent: true, opacity: 0.19, sizeAttenuation: false, blending: THREE.AdditiveBlending });
    const contactMaterial = new THREE.PointsMaterial({ color: 0xbaf6ff, depthTest: false, size: 8, transparent: true, opacity: 0.34, sizeAttenuation: false, blending: THREE.AdditiveBlending });
    const stemMaterial = new THREE.LineBasicMaterial({ color: 0x76dcff, depthTest: false, transparent: true, opacity: 0.27, blending: THREE.AdditiveBlending });
    const ringMaterial = new THREE.MeshBasicMaterial({ color: 0x8cecff, depthTest: false, transparent: true, opacity: 0.38, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const wavePointMaterial = new THREE.PointsMaterial({ color: 0xbef7ff, depthTest: false, size: 1.2, transparent: true, opacity: 0.5, sizeAttenuation: false });
    const playheadMaterial = new THREE.LineBasicMaterial({ color: 0xf2bd62, depthTest: false, transparent: true, opacity: 0.92, blending: THREE.AdditiveBlending });
    const playheadMarkerMaterial = new THREE.PointsMaterial({ color: 0xffdda0, depthTest: false, size: 7, transparent: true, opacity: 0.98, sizeAttenuation: false, blending: THREE.AdditiveBlending });
    const bodyMaterial = new THREE.MeshBasicMaterial({ color: 0x6fdcf2, depthTest: false, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const innerBodyMaterial = new THREE.MeshBasicMaterial({ color: 0xb9f7ff, depthTest: false, transparent: true, opacity: 0.11, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const bodyEdgeMaterial = new THREE.LineBasicMaterial({ color: 0xc5f8ff, depthTest: false, transparent: true, opacity: 0.62, blending: THREE.AdditiveBlending });
    const shieldBandMaterial = new THREE.MeshBasicMaterial({ color: 0x83edff, depthTest: false, transparent: true, opacity: 0.13, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const shieldOuterMaterial = new THREE.LineBasicMaterial({ color: 0x83edff, depthTest: false, transparent: true, opacity: 0.66, blending: THREE.AdditiveBlending });
    const shieldInnerMaterial = new THREE.LineBasicMaterial({ color: 0xd5fbff, depthTest: false, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending });
    const totemStrokeMaterial = new THREE.LineBasicMaterial({ color: 0xb7f5ff, depthTest: false, transparent: true, opacity: 0.86, blending: THREE.AdditiveBlending });
    const totemRingMaterial = new THREE.LineBasicMaterial({ color: 0x9c9cff, depthTest: false, transparent: true, opacity: 0.46, blending: THREE.AdditiveBlending });
    const totemNodeMaterial = new THREE.PointsMaterial({ color: 0xffe4a8, depthTest: false, size: 4, transparent: true, opacity: 0.86, sizeAttenuation: false, blending: THREE.AdditiveBlending });
    const particleMaterial = new THREE.PointsMaterial({ color: 0x65cfff, depthTest: false, size: 1.2, transparent: true, opacity: 0.34, sizeAttenuation: false, blending: THREE.AdditiveBlending });

    const wavePositions = new Float32Array(wavePointLimit * 3);
    const waveColors = new Float32Array(wavePointLimit * 3);
    const secondaryPositions = new Float32Array(wavePointLimit * 3);
    const samplePositions = new Float32Array(samplePointLimit * 3);
    const sampleStemPositions = new Float32Array(samplePointLimit * 2 * 3);
    const playheadPositions = new Float32Array(2 * 3);
    const playheadMarkerPositions = new Float32Array(3);
    const bodyPositions = new Float32Array((bodyPointLimit + 1) * 3);
    const innerBodyPositions = new Float32Array((bodyPointLimit + 1) * 3);
    const bodyEdgePositions = new Float32Array(bodyPointLimit * 3);
    const shieldBandPositions = new Float32Array(shieldPointLimit * 2 * 3);
    const shieldOuterPositions = new Float32Array(shieldPointLimit * 3);
    const shieldInnerPositions = new Float32Array(shieldPointLimit * 3);
    const totemStrokePositions = new Float32Array(totemStrokeLimit * totemStrokeSegmentLimit * 2 * 3);
    const totemRingPositions = new Float32Array(totemRingLimit * totemRingSegmentLimit * 2 * 3);
    const totemNodePositions = new Float32Array(totemNodeLimit * 3);
    const particlePositions = new Float32Array(particleCount * 3);
    const particleSeeds = new Float32Array(particleCount * 3);

    const waveGeometry = dynamicGeometry(wavePositions);
    waveGeometry.setAttribute('color', new THREE.BufferAttribute(waveColors, 3).setUsage(THREE.DynamicDrawUsage));
    const secondaryGeometry = dynamicGeometry(secondaryPositions);
    const pointGeometry = dynamicGeometry(samplePositions);
    const stemGeometry = dynamicGeometry(sampleStemPositions);
    const playheadGeometry = dynamicGeometry(playheadPositions);
    const playheadMarkerGeometry = dynamicGeometry(playheadMarkerPositions);
    const bodyGeometry = dynamicFanGeometry(bodyPositions, bodyPointLimit);
    const innerBodyGeometry = dynamicFanGeometry(innerBodyPositions, bodyPointLimit);
    const bodyEdgeGeometry = dynamicGeometry(bodyEdgePositions);
    const shieldBandGeometry = dynamicBandGeometry(shieldBandPositions, shieldPointLimit);
    const shieldOuterGeometry = dynamicGeometry(shieldOuterPositions);
    const shieldInnerGeometry = dynamicGeometry(shieldInnerPositions);
    const totemStrokeGeometry = dynamicGeometry(totemStrokePositions);
    const totemRingGeometry = dynamicGeometry(totemRingPositions);
    const totemNodeGeometry = dynamicGeometry(totemNodePositions);
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
    const creatureBody = new THREE.Mesh(bodyGeometry, bodyMaterial);
    const creatureInnerBody = new THREE.Mesh(innerBodyGeometry, innerBodyMaterial);
    const creatureBodyEdge = new THREE.LineLoop(bodyEdgeGeometry, bodyEdgeMaterial);
    const spectrumShieldBand = new THREE.Mesh(shieldBandGeometry, shieldBandMaterial);
    const spectrumShieldOuter = new THREE.LineLoop(shieldOuterGeometry, shieldOuterMaterial);
    const spectrumShieldInner = new THREE.LineLoop(shieldInnerGeometry, shieldInnerMaterial);
    const totemStrokes = new THREE.LineSegments(totemStrokeGeometry, totemStrokeMaterial);
    const totemRings = new THREE.LineSegments(totemRingGeometry, totemRingMaterial);
    const totemNodes = new THREE.Points(totemNodeGeometry, totemNodeMaterial);
    const particles = new THREE.Points(particleGeometry, particleMaterial);

    const haloTexture = createGlowTexture();
    playheadMarkerMaterial.map = haloTexture;
    playheadMarkerMaterial.alphaTest = 0.02;
    totemNodeMaterial.map = haloTexture;
    totemNodeMaterial.alphaTest = 0.02;
    particleMaterial.map = haloTexture;
    particleMaterial.alphaTest = 0.02;
    playheadMarkerMaterial.needsUpdate = true;
    totemNodeMaterial.needsUpdate = true;
    particleMaterial.needsUpdate = true;
    const haloMaterial = new THREE.SpriteMaterial({ map: haloTexture, color: 0x72dcff, depthTest: false, transparent: true, opacity: 0, blending: THREE.AdditiveBlending });
    const musicHalo = new THREE.Sprite(haloMaterial);
    musicHalo.position.set(0, -0.02, -0.2);

    particles.renderOrder = 0;
    musicHalo.renderOrder = 1;
    secondaryLine.renderOrder = 2;
    spectrumShieldBand.renderOrder = 3;
    spectrumShieldOuter.renderOrder = 4;
    spectrumShieldInner.renderOrder = 4;
    creatureBody.renderOrder = 5;
    creatureInnerBody.renderOrder = 6;
    creatureBodyEdge.renderOrder = 7;
    totemRings.renderOrder = 8;
    totemStrokes.renderOrder = 9;
    totemNodes.renderOrder = 10;
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
      secondaryLine,
      spectrumShieldBand,
      spectrumShieldOuter,
      spectrumShieldInner,
      creatureBody,
      creatureInnerBody,
      creatureBodyEdge,
      totemRings,
      totemStrokes,
      totemNodes,
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
    let shieldPulse = 0;
    let rhythmClock = 0;
    let pendingShieldPulse = 0;
    let pendingShieldAt = -1;
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
    let repulsorEscapeX = 0;
    let repulsorEscapeY = 0;
    let repulsorEscapeUntil = 0;

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
      spectrumShieldBand.visible = false;
      spectrumShieldOuter.visible = false;
      spectrumShieldInner.visible = false;
      creatureBody.visible = false;
      creatureInnerBody.visible = false;
      creatureBodyEdge.visible = false;
      totemStrokes.visible = false;
      totemRings.visible = false;
      totemNodes.visible = false;
      musicHalo.visible = false;
    };

    const updateSpectrumLevels = (data: Uint8Array, deltaTime: number) => {
      rhythmClock += deltaTime;
      let bassTotal = 0;
      let midTotal = 0;
      let trebleTotal = 0;
      let bassCount = 0;
      let midCount = 0;
      let trebleCount = 0;
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
        const target = Math.min(1, (total / groupedBinCount * 0.58 + maximum * 0.42) / 255);
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
      const nextImpulse = Math.min(1, relativeRise * 3.2);
      rhythmImpulse = Math.max(rhythmImpulse * Math.exp(-deltaTime * 8.5), nextImpulse);
      if (nextImpulse > 0.14 && nextImpulse >= pendingShieldPulse) {
        pendingShieldPulse = nextImpulse;
        pendingShieldAt = rhythmClock + creatureGenome.shieldDelay;
      }
      shieldPulse *= Math.exp(-deltaTime * 4.4);
      if (pendingShieldAt >= 0 && rhythmClock >= pendingShieldAt) {
        shieldPulse = Math.max(shieldPulse, pendingShieldPulse);
        pendingShieldPulse = 0;
        pendingShieldAt = -1;
      }
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
      const visualRadius = creatureGenome.bodyRadius * scale;
      const horizontalLimit = Math.max(0.18, 0.84 - visualRadius * 0.9);
      const verticalLimit = Math.max(0.16, 0.72 - visualRadius * 0.82);
      const horizontalEdge = Math.max(0, (Math.abs(creatureX) - (horizontalLimit - 0.12)) / 0.12);
      const verticalEdge = Math.max(0, (Math.abs(creatureY) - (verticalLimit - 0.12)) / 0.12);
      let inwardX = -Math.sign(creatureX || 1) * Math.min(1, horizontalEdge);
      let inwardY = -Math.sign(creatureY || 1) * Math.min(1, verticalEdge);
      const inwardLength = Math.hypot(inwardX, inwardY);
      if (inwardLength > 0.001) {
        inwardX /= inwardLength;
        inwardY /= inwardLength;
      }

      const wanderAngle = creatureGenome.wanderPhase
        + Math.sin(time * creatureGenome.wanderSpeed) * creatureGenome.turningTendency
        + Math.sin(time * 0.17 + creatureGenome.wanderPhase) * 0.65
        + midEnergy * creatureGenome.midSensitivity * Math.sin(time * 1.7);
      const desiredSpeed = (0.018 + activity * creatureGenome.wanderSpeed * 0.16 + rhythmImpulse * 0.075) * motionScale;
      let accelerationX = (Math.cos(wanderAngle) * desiredSpeed - creatureVelocityX) * (0.55 + creatureGenome.turningTendency);
      let accelerationY = (Math.sin(wanderAngle) * desiredSpeed - creatureVelocityY) * (0.55 + creatureGenome.turningTendency);
      const insideEdgeZone = Math.abs(creatureX) > horizontalLimit || Math.abs(creatureY) > verticalLimit;

      let nearestThreat = 0;
      let repulsorAwayX = 0;
      let repulsorAwayY = 0;
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
        const collisionRadius = visualRadius * (0.9 + creatureGenome.shieldAsymmetry);
        const radius = repulsor.type === 'ripple' ? repulsor.currentRadius ?? repulsor.radius : repulsor.radius + collisionRadius;
        const rippleDistance = repulsor.type === 'ripple' ? Math.abs(Math.max(0, distance - collisionRadius) - radius) : distance;
        const influence = Math.max(0, 1 - rippleDistance / Math.max(0.06, repulsor.type === 'ripple' ? repulsor.radius : radius));
        if (influence <= 0) continue;
        const force = influence * influence * repulsor.strength * creatureGenome.avoidanceSensitivity * 1.35;
        repulsorAwayX += awayX * force;
        repulsorAwayY += awayY * force;
        const isNewRepulsorUpdate = repulsor.updatedAt !== undefined && repulsor.updatedAt !== lastRepulsorUpdate;
        if (isNewRepulsorUpdate) {
          const swipeSpeed = Math.hypot(repulsor.velocityX ?? 0, repulsor.velocityY ?? 0);
          const impulse = influence * (0.055 + Math.min(0.24, swipeSpeed * 0.075));
          const safeAwayX = awayX + inwardX * Math.max(horizontalEdge, verticalEdge) * 0.9;
          const safeAwayY = awayY + inwardY * Math.max(horizontalEdge, verticalEdge) * 0.9;
          const safeLength = Math.max(0.001, Math.hypot(safeAwayX, safeAwayY));
          creatureVelocityX += safeAwayX / safeLength * impulse;
          creatureVelocityY += safeAwayY / safeLength * impulse;
          repulsorEscapeX = safeAwayX / safeLength;
          repulsorEscapeY = safeAwayY / safeLength;
          repulsorEscapeUntil = time + creatureGenome.repulsorCommitment;
          startlePulse = Math.max(startlePulse, Math.min(1, influence * 0.72 + swipeSpeed * 0.2));
          lastRepulsorUpdate = repulsor.updatedAt ?? lastRepulsorUpdate;
        }
        if (repulsor.type === 'ripple' && influence > threatResponse + 0.16) {
          const rippleImpulse = influence * 0.13;
          const safeAwayX = awayX + inwardX * Math.max(horizontalEdge, verticalEdge) * 0.9;
          const safeAwayY = awayY + inwardY * Math.max(horizontalEdge, verticalEdge) * 0.9;
          const safeLength = Math.max(0.001, Math.hypot(safeAwayX, safeAwayY));
          creatureVelocityX += safeAwayX / safeLength * rippleImpulse;
          creatureVelocityY += safeAwayY / safeLength * rippleImpulse;
          repulsorEscapeX = safeAwayX / safeLength;
          repulsorEscapeY = safeAwayY / safeLength;
          repulsorEscapeUntil = time + creatureGenome.repulsorCommitment;
          startlePulse = Math.max(startlePulse, influence);
        }
        nearestThreat = Math.max(nearestThreat, influence);
      }

      if (nearestThreat > 0) {
        repulsorAwayX += inwardX * Math.max(horizontalEdge, verticalEdge) * 2.2;
        repulsorAwayY += inwardY * Math.max(horizontalEdge, verticalEdge) * 2.2;
        const awayLength = Math.max(0.001, Math.hypot(repulsorAwayX, repulsorAwayY));
        const awayX = repulsorAwayX / awayLength;
        const awayY = repulsorAwayY / awayLength;
        const escapeSpeed = (0.15 + nearestThreat * 0.22 + startlePulse * 0.12) * motionScale;
        accelerationX = (awayX * escapeSpeed - creatureVelocityX) * 6.2;
        accelerationY = (awayY * escapeSpeed - creatureVelocityY) * 6.2;
        repulsorEscapeX = awayX;
        repulsorEscapeY = awayY;
      } else if (insideEdgeZone) {
        if (time >= escapeUntil) {
          const phase = creatureGenome.escapePhase + time * 1.618;
          escapeTargetX = Math.abs(creatureX) > horizontalLimit
            ? -Math.sign(creatureX || 1) * (0.08 + Math.abs(Math.sin(phase)) * 0.22)
            : Math.sin(phase * 1.37) * horizontalLimit * 0.48;
          escapeTargetY = Math.abs(creatureY) > verticalLimit
            ? -Math.sign(creatureY || 1) * (0.07 + Math.abs(Math.cos(phase * 0.91)) * 0.2)
            : Math.cos(phase * 1.11) * verticalLimit * 0.48;
          escapeUntil = time + creatureGenome.escapeCommitment;
        }
        const escapeX = escapeTargetX - creatureX + inwardX * 0.35;
        const escapeY = escapeTargetY - creatureY + inwardY * 0.35;
        const escapeLength = Math.max(0.001, Math.hypot(escapeX, escapeY));
        const escapeSpeed = (0.12 + visualRadius * 0.08) * motionScale;
        accelerationX = (escapeX / escapeLength * escapeSpeed - creatureVelocityX) * 3.8;
        accelerationY = (escapeY / escapeLength * escapeSpeed - creatureVelocityY) * 3.8;
      } else if (time < repulsorEscapeUntil) {
        accelerationX = (repulsorEscapeX * 0.11 * motionScale - creatureVelocityX) * 2.4;
        accelerationY = (repulsorEscapeY * 0.11 * motionScale - creatureVelocityY) * 2.4;
      } else if (time < escapeUntil) {
        const escapeX = escapeTargetX - creatureX;
        const escapeY = escapeTargetY - creatureY;
        const escapeLength = Math.max(0.001, Math.hypot(escapeX, escapeY));
        accelerationX = (escapeX / escapeLength * 0.09 * motionScale - creatureVelocityX) * 2.2;
        accelerationY = (escapeY / escapeLength * 0.09 * motionScale - creatureVelocityY) * 2.2;
      }

      threatResponse += (nearestThreat - threatResponse) * (1 - Math.exp(-deltaTime * (nearestThreat > threatResponse ? 18 : 4.2)));
      if (nearestThreat <= 0 && time >= repulsorEscapeUntil) {
        accelerationX += Math.cos(creatureHeading) * rhythmImpulse * creatureGenome.onsetSensitivity * 0.12;
        accelerationY += Math.sin(creatureHeading) * rhythmImpulse * creatureGenome.onsetSensitivity * 0.12;
      }
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

    const drawTotemCreature = (time: number, current: WaveCanvasProps) => {
      const aspect = Math.min(1, canvasHeight / canvasWidth);
      const scale = current.creatureScale ?? 1;
      const baseRadius = creatureGenome.bodyRadius * scale;
      const rhythmScale = (1 - rhythmImpulse * 0.026 - startlePulse * 0.16)
        * (1 + onsetPulse * creatureGenome.pulseSensitivity * 0.19);
      const rotation = creatureHeading * 0.22 + time * creatureGenome.rotationTendency
        + Math.sin(time * 0.37 + creatureGenome.asymmetryPhase) * 0.16
        + midEnergy * 0.22;
      const coreOffset = creatureGenome.coreOffset * scale;
      const coreX = creatureX + Math.cos(rotation + creatureGenome.coreOffsetAngle) * coreOffset * aspect;
      const coreY = creatureY + Math.sin(rotation + creatureGenome.coreOffsetAngle) * coreOffset;

      bodyPositions[0] = creatureX;
      bodyPositions[1] = creatureY;
      innerBodyPositions[0] = coreX;
      innerBodyPositions[1] = coreY;
      for (let index = 0; index < bodyPointLimit; index += 1) {
        const t = index / bodyPointLimit;
        const angle = t * Math.PI * 2;
        const lobeBias = 0.32 + 0.68 * (0.5 + 0.5 * Math.cos(angle - creatureGenome.asymmetryPhase));
        const primaryLobe = Math.sin(angle * creatureGenome.bodyLobes + creatureGenome.silhouettePhase) * creatureGenome.lobeDepth * lobeBias;
        const indentation = -Math.pow(Math.max(0, Math.cos(angle * creatureGenome.indentationCount + creatureGenome.indentationPhase)), 3)
          * creatureGenome.bodyIndentation;
        const secondaryLobe = Math.sin(angle * creatureGenome.secondaryLobes - creatureGenome.silhouettePhase * 0.7) * creatureGenome.secondaryLobeDepth;
        const directionalMass = creatureGenome.asymmetry * (
          Math.cos(angle - creatureGenome.asymmetryPhase) * 0.24
          + Math.sin(angle * 2 + creatureGenome.asymmetryPhase * 0.7) * 0.11
        );
        const compression = 1 - rhythmImpulse * 0.045 * (0.35 + Math.abs(Math.sin(angle + rotation)));
        const radius = baseRadius * rhythmScale * compression * (1 + primaryLobe + indentation + secondaryLobe + directionalMass);
        const warpedAngle = angle + rotation * 0.16 + Math.sin(angle + creatureGenome.asymmetryPhase) * creatureGenome.asymmetry * 0.14;
        const bodyX = creatureX + Math.cos(warpedAngle) * radius * creatureGenome.bodyElongation * aspect;
        const bodyY = creatureY + Math.sin(warpedAngle) * radius;
        const positionOffset = (index + 1) * 3;
        bodyPositions[positionOffset] = bodyX;
        bodyPositions[positionOffset + 1] = bodyY;
        bodyEdgePositions[index * 3] = bodyX;
        bodyEdgePositions[index * 3 + 1] = bodyY;

        const innerRadius = radius * (0.56 + creatureGenome.innerMembraneScale * 0.18)
          * (1 + Math.sin(angle * (creatureGenome.bodyLobes + 1) + time * 0.7) * 0.035);
        innerBodyPositions[positionOffset] = coreX + Math.cos(angle - rotation * 0.09) * innerRadius * creatureGenome.bodyElongation * aspect;
        innerBodyPositions[positionOffset + 1] = coreY + Math.sin(angle - rotation * 0.09) * innerRadius;
      }

      for (let index = 0; index < shieldPointLimit; index += 1) {
        const t = index / shieldPointLimit;
        const angle = t * Math.PI * 2;
        const bandPosition = t * spectrumBandCount;
        const bandIndex = Math.floor(bandPosition) % spectrumBandCount;
        const nextBandIndex = (bandIndex + 1) % spectrumBandCount;
        const blend = bandPosition - Math.floor(bandPosition);
        const energy = spectrumLevels[bandIndex] * (1 - blend) + spectrumLevels[nextBandIndex] * blend;
        const peak = peakLevels[bandIndex] * (1 - blend) + peakLevels[nextBandIndex] * blend;
        const broadShape = Math.sin(angle * creatureGenome.shieldLobes + creatureGenome.shieldPhase + time * 0.24) * creatureGenome.shieldAsymmetry;
        const midShape = Math.sin(angle * (creatureGenome.shieldLobes + 2) - time * 0.42) * midEnergy * creatureGenome.midSensitivity * 0.085;
        const edgeRipple = Math.sin(angle * (11 + creatureGenome.radialCount) + time * 2.1) * trebleEnergy * creatureGenome.trebleSensitivity * 0.032;
        const spectrumPush = energy * creatureGenome.shieldSensitivity * 0.1 + peak * 0.025;
        const bodyEcho = (
          Math.sin(angle * creatureGenome.bodyLobes + creatureGenome.silhouettePhase) * creatureGenome.lobeDepth
          + Math.cos(angle - creatureGenome.asymmetryPhase) * creatureGenome.asymmetry * 0.16
        ) * 0.42;
        const radius = baseRadius * (1.38 + shieldPulse * creatureGenome.shieldSensitivity * 0.58 + bodyEcho + broadShape + midShape + edgeRipple)
          + spectrumPush * scale;
        const bandWidth = baseRadius * (0.065 + shieldPulse * 0.035 + trebleEnergy * 0.025);
        const outerRadius = radius + bandWidth;
        const innerRadius = Math.max(baseRadius * 1.08, radius - bandWidth);
        const outerX = creatureX + Math.cos(angle) * outerRadius * creatureGenome.bodyElongation * aspect;
        const outerY = creatureY + Math.sin(angle) * outerRadius;
        const innerX = creatureX + Math.cos(angle) * innerRadius * creatureGenome.bodyElongation * aspect;
        const innerY = creatureY + Math.sin(angle) * innerRadius;
        const bandOffset = index * 6;
        shieldBandPositions[bandOffset] = innerX;
        shieldBandPositions[bandOffset + 1] = innerY;
        shieldBandPositions[bandOffset + 3] = outerX;
        shieldBandPositions[bandOffset + 4] = outerY;
        writeOrganicPoint(shieldOuterPositions, index, outerX, outerY);
        writeOrganicPoint(shieldInnerPositions, index, innerX, innerY);
      }

      const activeStrokeCount = Math.min(compact ? 10 : totemStrokeLimit, creatureGenome.motifs.length);
      const strokeSegments = compact ? 14 : totemStrokeSegmentLimit;
      let strokeVertex = 0;
      for (let stroke = 0; stroke < activeStrokeCount; stroke += 1) {
        const motif = creatureGenome.motifs[stroke];
        const startAngle = rotation + motif.angle - motif.span * motif.direction * 0.5;
        const startRadius = baseRadius * rhythmScale * motif.innerRadius;
        let previousX = coreX + Math.cos(startAngle) * startRadius * creatureGenome.bodyElongation * aspect;
        let previousY = coreY + Math.sin(startAngle) * startRadius;
        for (let segment = 1; segment <= strokeSegments; segment += 1) {
          const progress = segment / strokeSegments;
          const arcLift = Math.sin(progress * Math.PI) * motif.length;
          const radius = baseRadius * rhythmScale * (motif.innerRadius + arcLift + motif.radialDrift * (progress - 0.5));
          const flow = Math.sin(progress * Math.PI * motif.waveCount + motif.phase + time * 0.34) * motif.waveDepth;
          const angle = startAngle + motif.span * motif.direction * progress + flow
            + creatureGenome.asymmetry * Math.sin(stroke * 1.7) * 0.18;
          const nextX = coreX + Math.cos(angle) * radius * creatureGenome.bodyElongation * aspect;
          const nextY = coreY + Math.sin(angle) * radius;
          const offset = strokeVertex * 3;
          totemStrokePositions[offset] = previousX;
          totemStrokePositions[offset + 1] = previousY;
          totemStrokePositions[offset + 2] = 0;
          totemStrokePositions[offset + 3] = nextX;
          totemStrokePositions[offset + 4] = nextY;
          totemStrokePositions[offset + 5] = 0;
          strokeVertex += 2;
          previousX = nextX;
          previousY = nextY;
        }
      }

      const activeRingCount = Math.min(totemRingLimit, creatureGenome.innerRingCount);
      let ringVertex = 0;
      for (let ring = 0; ring < activeRingCount; ring += 1) {
        const ringRadius = baseRadius * rhythmScale * (0.18 + ring * 0.13 + creatureGenome.ringSpacing);
        const coverage = creatureGenome.ringCoverage[ring];
        for (let segment = 0; segment < totemRingSegmentLimit; segment += 1) {
          const progress = segment / totemRingSegmentLimit;
          if (progress > coverage) continue;
          const nextProgress = Math.min(coverage, (segment + 1) / totemRingSegmentLimit);
          const angle = rotation * (ring % 2 === 0 ? 0.7 : -0.45) + creatureGenome.ringPhases[ring] + progress * Math.PI * 2;
          const nextAngle = rotation * (ring % 2 === 0 ? 0.7 : -0.45) + creatureGenome.ringPhases[ring] + nextProgress * Math.PI * 2;
          const wobble = 1 + Math.sin(angle * (ring + 2) + time * 0.4) * creatureGenome.asymmetry * 0.16;
          const nextWobble = 1 + Math.sin(nextAngle * (ring + 2) + time * 0.4) * creatureGenome.asymmetry * 0.16;
          const offset = ringVertex * 3;
          totemRingPositions[offset] = coreX + Math.cos(angle) * ringRadius * wobble * aspect;
          totemRingPositions[offset + 1] = coreY + Math.sin(angle) * ringRadius * wobble;
          totemRingPositions[offset + 2] = 0;
          totemRingPositions[offset + 3] = coreX + Math.cos(nextAngle) * ringRadius * nextWobble * aspect;
          totemRingPositions[offset + 4] = coreY + Math.sin(nextAngle) * ringRadius * nextWobble;
          totemRingPositions[offset + 5] = 0;
          ringVertex += 2;
        }
      }

      const activeNodeCount = Math.min(totemNodeLimit, creatureGenome.nodeCount);
      for (let node = 0; node < activeNodeCount; node += 1) {
        if (node < creatureGenome.coreCount) {
          const coreAngle = rotation * 0.35 + node / creatureGenome.coreCount * Math.PI * 2 + creatureGenome.coreOffsetAngle;
          const coreRadius = baseRadius * rhythmScale * (0.05 + node * 0.055);
          writeOrganicPoint(
            totemNodePositions,
            node,
            coreX + Math.cos(coreAngle) * coreRadius * creatureGenome.bodyElongation * aspect,
            coreY + Math.sin(coreAngle) * coreRadius,
          );
          continue;
        }
        const motif = creatureGenome.motifs[node % activeStrokeCount];
        const progress = 0.34 + (node % 4) * 0.16;
        const radius = baseRadius * rhythmScale * (motif.innerRadius + Math.sin(progress * Math.PI) * motif.length + motif.radialDrift * (progress - 0.5));
        const angle = rotation + motif.angle - motif.span * motif.direction * 0.5 + motif.span * motif.direction * progress
          + Math.sin(progress * Math.PI * motif.waveCount + motif.phase) * motif.waveDepth;
        writeOrganicPoint(totemNodePositions, node, coreX + Math.cos(angle) * radius * creatureGenome.bodyElongation * aspect, coreY + Math.sin(angle) * radius);
      }

      bodyEdgeGeometry.setDrawRange(0, bodyPointLimit);
      shieldOuterGeometry.setDrawRange(0, shieldPointLimit);
      shieldInnerGeometry.setDrawRange(0, shieldPointLimit);
      totemStrokeGeometry.setDrawRange(0, strokeVertex);
      totemRingGeometry.setDrawRange(0, ringVertex);
      totemNodeGeometry.setDrawRange(0, activeNodeCount);
      bodyGeometry.attributes.position.needsUpdate = true;
      innerBodyGeometry.attributes.position.needsUpdate = true;
      bodyEdgeGeometry.attributes.position.needsUpdate = true;
      shieldBandGeometry.attributes.position.needsUpdate = true;
      shieldOuterGeometry.attributes.position.needsUpdate = true;
      shieldInnerGeometry.attributes.position.needsUpdate = true;
      totemStrokeGeometry.attributes.position.needsUpdate = true;
      totemRingGeometry.attributes.position.needsUpdate = true;
      totemNodeGeometry.attributes.position.needsUpdate = true;

      musicHalo.position.set(coreX, coreY, -0.2);
      const haloScale = baseRadius * rhythmScale * (1.7 + shieldPulse * 0.36);
      musicHalo.scale.set(haloScale, haloScale, 1);
    };

    const drawSpectrum = (current: WaveCanvasProps, time: number, deltaTime: number) => {
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
        shieldPulse = 0;
        rhythmClock = 0;
        pendingShieldPulse = 0;
        pendingShieldAt = -1;
        startlePulse = 0;
        escapeUntil = 0;
        repulsorEscapeUntil = 0;
        bodyMaterial.color.setHex(creatureGenome.bodyColor);
        innerBodyMaterial.color.setHex(creatureGenome.innerBodyColor);
        bodyEdgeMaterial.color.setHex(creatureGenome.highlightColor);
        shieldBandMaterial.color.setHex(creatureGenome.shieldColor);
        shieldOuterMaterial.color.setHex(creatureGenome.shieldColor);
        shieldInnerMaterial.color.setHex(creatureGenome.highlightColor);
        totemStrokeMaterial.color.setHex(creatureGenome.coreColor);
        totemRingMaterial.color.setHex(creatureGenome.accentColor);
        totemNodeMaterial.color.setHex(creatureGenome.nodeColor);
        particleMaterial.color.setHex(creatureGenome.particleColor);
        haloMaterial.color.setHex(creatureGenome.glowColor);
      }
      updateCreaturePhysics(time, deltaTime, current);
      drawTotemCreature(time, current);

      spectrumShieldBand.visible = true;
      spectrumShieldOuter.visible = true;
      spectrumShieldInner.visible = true;
      creatureBody.visible = true;
      creatureInnerBody.visible = true;
      creatureBodyEdge.visible = true;
      totemStrokes.visible = true;
      totemRings.visible = true;
      totemNodes.visible = !reducedMotion;
      musicHalo.visible = true;
      bodyMaterial.opacity = creatureGenome.bodyTransparency * (0.68 + onsetPulse * 0.34);
      innerBodyMaterial.opacity = creatureGenome.bodyTransparency * (0.36 + bassEnergy * 0.2 + onsetPulse * 0.26);
      bodyEdgeMaterial.opacity = (0.38 + onsetPulse * 0.32 + midEnergy * 0.12) * (1.12 - creatureGenome.edgeSoftness * 0.28);
      shieldBandMaterial.opacity = 0.08 + shieldPulse * 0.24 + overallEnergy * 0.05;
      shieldOuterMaterial.opacity = 0.4 + shieldPulse * 0.4 + trebleEnergy * 0.12;
      shieldInnerMaterial.opacity = 0.18 + shieldPulse * 0.22 + midEnergy * 0.1;
      totemStrokeMaterial.opacity = 0.68 + onsetPulse * 0.26 + startlePulse * 0.08;
      totemRingMaterial.opacity = 0.3 + midEnergy * 0.18 + onsetPulse * 0.12;
      totemNodeMaterial.opacity = 0.5 + trebleEnergy * 0.28 + onsetPulse * 0.2;
      totemNodeMaterial.size = 3.2 + creatureGenome.strokeThickness * 1.4 + onsetPulse * 3.2;
      haloMaterial.opacity = creatureGenome.glowIntensity * (0.05 + onsetPulse * 0.15 + overallEnergy * 0.06);
    };

    const drawMusicWave = (current: WaveCanvasProps) => {
      const overview = current.musicData;
      if (!overview?.length) return false;
      displayedViewStart += ((current.musicViewStart ?? 0) - displayedViewStart) * (reducedMotion ? 1 : 0.16);
      displayedProgress += ((current.musicProgress ?? 0) - displayedProgress) * (reducedMotion ? 1 : 0.24);
      const zoom = Math.max(1, current.musicZoom ?? 1);
      const visibleFraction = 1 / zoom;
      const visualAmplitude = 1;
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
        const played = sourceT <= displayedProgress;
        waveColors[index * 3] = played ? 0.7 : 0.27;
        waveColors[index * 3 + 1] = played ? 0.92 : 0.68;
        waveColors[index * 3 + 2] = played ? 1 : 0.86;
      }

      const localProgress = (displayedProgress - displayedViewStart) / visibleFraction;
      waveGeometry.setDrawRange(0, pointTotal);
      waveGeometry.attributes.position.needsUpdate = true;
      waveGeometry.attributes.color.needsUpdate = true;
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
      playheadMarkerMaterial.size = 7 + onsetPulse * 7;
      playheadMarkerMaterial.opacity = 0.86 + onsetPulse * 0.14;
      return true;
    };

    const drawWave = (time: number, deltaTime: number) => {
      const current = stateRef.current;
      const spectrumActive = current.mode === 'music' && current.musicData === null && Boolean(current.musicPcmData?.length);
      const musicReady = current.mode === 'music' && Boolean(current.musicPcmData?.length);
      if (musicReady) updateSpectrumLevels(current.spectrumData ?? silentSpectrumData, deltaTime);
      hideSamples();
      hideMusicWave();

      if (spectrumActive) {
        waveLine.visible = false;
        wavePoints.visible = false;
        secondaryLine.visible = false;
        drawSpectrum(current, time, deltaTime);
        return;
      }

      hideSpectrum();
      waveLine.visible = true;
      if (current.mode === 'music' && drawMusicWave(current)) {
        wavePoints.visible = true;
        return;
      }

      const pointTotal = 280;
      const homeElapsed = current.mode === 'home' ? (performance.now() - (current.homeSoundStartedAt ?? 0)) / 1000 : Infinity;
      const homeDuration = current.homeSoundDuration ?? 0;
      const homeRelease = homeElapsed > homeDuration ? Math.max(0, 1 - (homeElapsed - homeDuration) / 0.42) : 1;
      const homeSoundActive = Boolean(current.homeSoundEnvelope?.length && homeElapsed >= 0 && homeRelease > 0);
      const homeProgress = homeDuration > 0 ? Math.min(1, Math.max(0, homeElapsed / homeDuration)) : 0;
      for (let index = 0; index < pointTotal; index += 1) {
        const t = index / Math.max(pointTotal - 1, 1);
        const x = t * 1.8 - 0.9;
        let y = resolveY(t, time, current);
        let soundEnergy = 0;
        if (homeSoundActive && current.homeSoundEnvelope) {
          const samplePosition = Math.min(1, Math.max(0, homeProgress + (t - 0.5) * 0.34));
          const envelopeIndex = Math.min(current.homeSoundEnvelope.length - 1, Math.floor(samplePosition * current.homeSoundEnvelope.length));
          const soundSample = current.homeSoundEnvelope[envelopeIndex] ?? 0;
          soundEnergy = Math.abs(soundSample) * homeRelease;
          y = y * (1 - homeRelease * 0.74) + soundSample * 0.58 * homeRelease;
        }
        wavePositions[index * 3] = x;
        wavePositions[index * 3 + 1] = y;
        wavePositions[index * 3 + 2] = 0;
        waveColors[index * 3] = 0.48 + soundEnergy * 0.34;
        waveColors[index * 3 + 1] = 0.8 + soundEnergy * 0.18;
        waveColors[index * 3 + 2] = 0.92 + soundEnergy * 0.08;
        secondaryPositions[index * 3] = x;
        secondaryPositions[index * 3 + 1] = current.mode === 'quantize' ? quantize(y, current.bitDepth ?? 4) : y * 0.52 - 0.34;
        secondaryPositions[index * 3 + 2] = 0;
      }
      waveGeometry.setDrawRange(0, pointTotal);
      secondaryGeometry.setDrawRange(0, pointTotal);
      waveGeometry.attributes.position.needsUpdate = true;
      waveGeometry.attributes.color.needsUpdate = true;
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
      [waveGeometry, secondaryGeometry, pointGeometry, stemGeometry, playheadGeometry, playheadMarkerGeometry, bodyGeometry, innerBodyGeometry, bodyEdgeGeometry, shieldBandGeometry, shieldOuterGeometry, shieldInnerGeometry, totemStrokeGeometry, totemRingGeometry, totemNodeGeometry, particleGeometry, sampleRingGeometry].forEach((geometry) => geometry.dispose());
      haloTexture.dispose();
      [waveMaterial, secondaryMaterial, pointMaterial, pointGlowMaterial, contactMaterial, stemMaterial, ringMaterial, wavePointMaterial, playheadMaterial, playheadMarkerMaterial, bodyMaterial, innerBodyMaterial, bodyEdgeMaterial, shieldBandMaterial, shieldOuterMaterial, shieldInnerMaterial, totemStrokeMaterial, totemRingMaterial, totemNodeMaterial, particleMaterial, haloMaterial].forEach((material) => material.dispose());
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

function dynamicFanGeometry(positions: Float32Array, pointCount: number) {
  const geometry = dynamicGeometry(positions);
  const indices = new Uint16Array(pointCount * 3);
  for (let index = 0; index < pointCount; index += 1) {
    const offset = index * 3;
    indices[offset] = 0;
    indices[offset + 1] = index + 1;
    indices[offset + 2] = (index + 1) % pointCount + 1;
  }
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.setDrawRange(0, indices.length);
  return geometry;
}

function dynamicBandGeometry(positions: Float32Array, pointCount: number) {
  const geometry = dynamicGeometry(positions);
  const indices = new Uint16Array(pointCount * 6);
  for (let index = 0; index < pointCount; index += 1) {
    const next = (index + 1) % pointCount;
    const offset = index * 6;
    indices[offset] = index * 2;
    indices[offset + 1] = index * 2 + 1;
    indices[offset + 2] = next * 2 + 1;
    indices[offset + 3] = index * 2;
    indices[offset + 4] = next * 2 + 1;
    indices[offset + 5] = next * 2;
  }
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.setDrawRange(0, indices.length);
  return geometry;
}

function logarithmicBin(index: number, bandCount: number, binCount: number) {
  if (index <= 0) return 1;
  if (index >= bandCount) return binCount;
  return Math.min(binCount - 1, Math.max(1, Math.round(Math.exp(index / bandCount * Math.log(binCount)))));
}

function createCreatureGenome(seed: number) {
  const random = seededRandom(seed);
  const paletteFamilies = [
    [0x75e7ff, 0xc8faff, 0x879cff, 0xffdfa3, 0x68caee, 0x76dfff],
    [0xa18cff, 0xe0d7ff, 0x71bfff, 0xffd6af, 0x8b82e8, 0x9c8cff],
    [0x62e5d0, 0xbafbef, 0x5da9e9, 0xffe0a8, 0x58c9c2, 0x64ddcf],
    [0xf1c978, 0xffedbf, 0x8ed9e8, 0xfff3d1, 0xd6ae69, 0xe8ca83],
    [0xd18ad8, 0xf6d9f3, 0x8aa8f2, 0xffdfb0, 0xbc78c9, 0xca8edb],
    [0xcceeff, 0xf5fdff, 0xa9b3ff, 0xffe7b2, 0x9fd5ee, 0xd8f5ff],
  ];
  const palette = paletteFamilies[Math.floor(random() * paletteFamilies.length)];
  const silhouetteTendency = random();
  const symmetryTendency = 0.34 + random() * 0.58;
  const radialCount = 3 + Math.floor(random() * 7);
  const loopCount = 1 + Math.floor(random() * 3);
  const filamentCount = 2 + Math.floor(random() * 7);
  const ornamentDensity = 0.35 + random() * 0.65;
  const internalArcCount = Math.min(totemStrokeLimit, 4 + Math.floor(ornamentDensity * 4) + Math.floor(random() * 3));
  const motifCount = internalArcCount;
  const motifs = Array.from({ length: motifCount }, (_, index) => {
    const regularAngle = index / Math.max(1, motifCount) * Math.PI * 2;
    const randomAngle = random() * Math.PI * 2;
    return {
      angle: regularAngle * symmetryTendency + randomAngle * (1 - symmetryTendency),
      length: 0.08 + random() * 0.19,
      innerRadius: 0.22 + random() * 0.34,
      span: Math.PI * (0.22 + random() * 0.42),
      radialDrift: (random() - 0.5) * 0.24,
      curvature: 0.28 + random() * 1.08,
      direction: random() > 0.5 ? 1 : -1,
      returnBias: random() * 0.86,
      waveCount: 1 + Math.floor(random() * 4),
      waveDepth: 0.015 + random() * 0.07,
      phase: random() * Math.PI * 2,
    };
  });
  return {
    bodyRadius: 0.17 + random() * 0.07,
    silhouetteTendency,
    symmetryTendency,
    bodyLobes: 2 + Math.floor(random() * 3),
    bodyElongation: 0.78 + random() * 0.46,
    lobeDepth: 0.035 + random() * (0.055 + silhouetteTendency * 0.045),
    bodyIndentation: 0.018 + random() * (0.04 + (1 - silhouetteTendency) * 0.04),
    indentationCount: 2 + Math.floor(random() * 5),
    indentationPhase: random() * Math.PI * 2,
    secondaryLobes: 2 + Math.floor(random() * 6),
    secondaryLobeDepth: 0.015 + random() * 0.038,
    silhouettePhase: random() * Math.PI * 2,
    innerMembraneScale: 0.35 + random() * 0.55,
    internalArcCount,
    coreCount: 1 + Math.floor(random() * 3),
    radialCount,
    loopCount,
    filamentCount,
    motifs,
    curvature: 0.45 + random() * 0.85,
    innerRingCount: Math.max(1, Math.round(loopCount * (0.62 + ornamentDensity * 0.38))),
    ringSpacing: random() * 0.07,
    ringCoverage: Array.from({ length: totemRingLimit }, () => 0.28 + random() * 0.4),
    ringPhases: Array.from({ length: totemRingLimit }, () => random() * Math.PI * 2),
    nodeCount: 3 + Math.floor(ornamentDensity * 13 + random() * 5),
    coreOffset: 0.035 + random() * 0.085,
    coreOffsetAngle: random() * Math.PI * 2,
    strokeThickness: 0.65 + random() * 1.1,
    ornamentDensity,
    rotationTendency: (random() > 0.5 ? 1 : -1) * (0.035 + random() * 0.095),
    pulseSensitivity: 0.7 + random() * 0.52,
    shieldSensitivity: 0.7 + random() * 0.65,
    shieldDelay: 0.05 + random() * 0.07,
    shieldLobes: 3 + Math.floor(random() * 7),
    shieldAsymmetry: 0.035 + random() * 0.08,
    shieldPhase: random() * Math.PI * 2,
    asymmetry: 0.14 + random() * 0.24,
    asymmetryPhase: random() * Math.PI * 2,
    bodyTransparency: 0.16 + random() * 0.13,
    edgeSoftness: 0.45 + random() * 0.45,
    glowIntensity: 0.65 + random() * 0.35,
    particleCount: 90 + Math.floor(random() * 111),
    particleOrbit: (random() > 0.5 ? 1 : -1) * (0.55 + random() * 0.95),
    wanderSpeed: 0.18 + random() * 0.32,
    wanderPhase: random() * Math.PI * 2,
    turningTendency: 0.35 + random() * 0.8,
    escapeCommitment: 0.8 + random() * 1.2,
    repulsorCommitment: 0.5 + random() * 0.7,
    escapePhase: random() * Math.PI * 2,
    bassSensitivity: 0.7 + random() * 0.65,
    midSensitivity: 0.7 + random() * 0.7,
    trebleSensitivity: 0.7 + random() * 0.8,
    onsetSensitivity: 0.75 + random() * 0.7,
    avoidanceSensitivity: 0.85 + random() * 0.75,
    spawnX: (random() - 0.5) * 0.45,
    spawnY: (random() - 0.5) * 0.34,
    shieldColor: palette[0],
    bodyColor: palette[0],
    innerBodyColor: palette[4],
    coreColor: palette[1],
    accentColor: palette[2],
    highlightColor: palette[5],
    nodeColor: palette[3],
    particleColor: palette[4],
    glowColor: palette[5],
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
