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
  homeMusicData?: Uint8Array | null;
  homeMusicPlaying?: boolean;
  pointer: PointerPoint;
}

const wavePointLimit = 768;
const samplePointLimit = 64;
const spectrumBandCount = 64;
const membranePointLimit = 160;
const filamentLimit = 8;
const filamentSegmentLimit = 24;
const tendrilLimit = 12;
const tendrilSegmentLimit = 20;
const moteLimit = 36;
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
  homeMusicData = null,
  homeMusicPlaying = false,
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
    homeMusicData,
    homeMusicPlaying,
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
    homeMusicData,
    homeMusicPlaying,
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
    const innerMembraneMaterial = new THREE.MeshBasicMaterial({ color: 0x8cecff, depthTest: false, transparent: true, opacity: 0.08, side: THREE.DoubleSide });
    const outerMembraneMaterial = new THREE.MeshBasicMaterial({ color: 0x8a9eff, depthTest: false, transparent: true, opacity: 0.055, side: THREE.DoubleSide });
    const spectralSkinMaterial = new THREE.MeshBasicMaterial({ color: 0x83edff, depthTest: false, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const outerEdgeMaterial = new THREE.LineBasicMaterial({ color: 0x83edff, depthTest: false, transparent: true, opacity: 0.62, blending: THREE.AdditiveBlending });
    const innerEdgeMaterial = new THREE.LineBasicMaterial({ color: 0xd5fbff, depthTest: false, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending });
    const filamentMaterial = new THREE.LineBasicMaterial({ color: 0xb7f5ff, depthTest: false, transparent: true, opacity: 0.72, blending: THREE.AdditiveBlending });
    const tendrilMaterial = new THREE.LineBasicMaterial({ color: 0x9c9cff, depthTest: false, transparent: true, opacity: 0.48, blending: THREE.AdditiveBlending });
    const moteMaterial = new THREE.PointsMaterial({ color: 0xffe4a8, depthTest: false, size: 4, transparent: true, opacity: 0.86, sizeAttenuation: false, blending: THREE.AdditiveBlending });
    const particleMaterial = new THREE.PointsMaterial({ color: 0x65cfff, depthTest: false, size: 1.2, transparent: true, opacity: 0.34, sizeAttenuation: false, blending: THREE.AdditiveBlending });

    const wavePositions = new Float32Array(wavePointLimit * 3);
    const waveColors = new Float32Array(wavePointLimit * 3);
    const secondaryPositions = new Float32Array(wavePointLimit * 3);
    const samplePositions = new Float32Array(samplePointLimit * 3);
    const sampleStemPositions = new Float32Array(samplePointLimit * 2 * 3);
    const playheadPositions = new Float32Array(2 * 3);
    const playheadMarkerPositions = new Float32Array(3);
    const innerMembranePositions = new Float32Array((membranePointLimit + 1) * 3);
    const outerMembranePositions = new Float32Array((membranePointLimit + 1) * 3);
    const spectralSkinPositions = new Float32Array(membranePointLimit * 2 * 3);
    const outerEdgePositions = new Float32Array(membranePointLimit * 3);
    const innerEdgePositions = new Float32Array(membranePointLimit * 3);
    const filamentPositions = new Float32Array(filamentLimit * filamentSegmentLimit * 2 * 3);
    const tendrilPositions = new Float32Array(tendrilLimit * tendrilSegmentLimit * 2 * 3);
    const motePositions = new Float32Array(moteLimit * 3);
    const membraneRaw = new Float32Array(membranePointLimit);
    const membraneSmoothed = new Float32Array(membranePointLimit);
    const particlePositions = new Float32Array(particleCount * 3);
    const particleSeeds = new Float32Array(particleCount * 3);

    const waveGeometry = dynamicGeometry(wavePositions);
    waveGeometry.setAttribute('color', new THREE.BufferAttribute(waveColors, 3).setUsage(THREE.DynamicDrawUsage));
    const secondaryGeometry = dynamicGeometry(secondaryPositions);
    const pointGeometry = dynamicGeometry(samplePositions);
    const stemGeometry = dynamicGeometry(sampleStemPositions);
    const playheadGeometry = dynamicGeometry(playheadPositions);
    const playheadMarkerGeometry = dynamicGeometry(playheadMarkerPositions);
    const innerMembraneGeometry = dynamicFanGeometry(innerMembranePositions, membranePointLimit);
    const outerMembraneGeometry = dynamicFanGeometry(outerMembranePositions, membranePointLimit);
    const spectralSkinGeometry = dynamicBandGeometry(spectralSkinPositions, membranePointLimit);
    const outerEdgeGeometry = dynamicGeometry(outerEdgePositions);
    const innerEdgeGeometry = dynamicGeometry(innerEdgePositions);
    const filamentGeometry = dynamicGeometry(filamentPositions);
    const tendrilGeometry = dynamicGeometry(tendrilPositions);
    const moteGeometry = dynamicGeometry(motePositions);
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
    const innerMembrane = new THREE.Mesh(innerMembraneGeometry, innerMembraneMaterial);
    const outerMembrane = new THREE.Mesh(outerMembraneGeometry, outerMembraneMaterial);
    const spectralSkin = new THREE.Mesh(spectralSkinGeometry, spectralSkinMaterial);
    const outerEdge = new THREE.LineLoop(outerEdgeGeometry, outerEdgeMaterial);
    const innerEdge = new THREE.LineLoop(innerEdgeGeometry, innerEdgeMaterial);
    const filaments = new THREE.LineSegments(filamentGeometry, filamentMaterial);
    const tendrils = new THREE.LineSegments(tendrilGeometry, tendrilMaterial);
    const motes = new THREE.Points(moteGeometry, moteMaterial);
    const particles = new THREE.Points(particleGeometry, particleMaterial);

    const haloTexture = createGlowTexture();
    playheadMarkerMaterial.map = haloTexture;
    playheadMarkerMaterial.alphaTest = 0.02;
    moteMaterial.map = haloTexture;
    moteMaterial.alphaTest = 0.02;
    particleMaterial.map = haloTexture;
    particleMaterial.alphaTest = 0.02;
    playheadMarkerMaterial.needsUpdate = true;
    moteMaterial.needsUpdate = true;
    particleMaterial.needsUpdate = true;
    const haloMaterial = new THREE.SpriteMaterial({ map: haloTexture, color: 0x72dcff, depthTest: false, transparent: true, opacity: 0, blending: THREE.AdditiveBlending });
    const musicHalo = new THREE.Sprite(haloMaterial);
    musicHalo.position.set(0, -0.02, -0.2);
    const coreMaterial = new THREE.SpriteMaterial({ map: haloTexture, color: 0xf4ffff, depthTest: false, transparent: true, opacity: 0, blending: THREE.AdditiveBlending });
    const innerCore = new THREE.Sprite(coreMaterial);
    const corePetalMaterials = Array.from({ length: 3 }, () => new THREE.SpriteMaterial({ map: haloTexture, color: 0x9c9cff, depthTest: false, transparent: true, opacity: 0, blending: THREE.AdditiveBlending }));
    const corePetals = corePetalMaterials.map((material) => new THREE.Sprite(material));

    particles.renderOrder = 0;
    musicHalo.renderOrder = 1;
    secondaryLine.renderOrder = 2;
    outerMembrane.renderOrder = 2;
    spectralSkin.renderOrder = 3;
    outerEdge.renderOrder = 4;
    innerMembrane.renderOrder = 5;
    innerEdge.renderOrder = 6;
    tendrils.renderOrder = 7;
    filaments.renderOrder = 8;
    motes.renderOrder = 9;
    innerCore.renderOrder = 10;
    corePetals.forEach((petal, index) => { petal.renderOrder = 9 + index * 0.1; });
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
      outerMembrane,
      spectralSkin,
      outerEdge,
      innerMembrane,
      innerEdge,
      tendrils,
      filaments,
      motes,
      ...corePetals,
      innerCore,
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
    let adaptiveVariancePeak = 0.01;
    let localVariance = 0;
    let previousOverallEnergy = 0;
    let previousRelativeEnergy = 0;
    let onsetPulse = 0;
    let rhythmImpulse = 0;
    let outerPulse = 0;
    let skinPulse = 0;
    let contractionPulse = 0;
    let rhythmClock = 0;
    let pendingOuterPulse = 0;
    let pendingOuterAt = -1;
    let pendingSkinPulse = 0;
    let pendingSkinAt = -1;
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
      innerMembrane.visible = false;
      outerMembrane.visible = false;
      spectralSkin.visible = false;
      outerEdge.visible = false;
      innerEdge.visible = false;
      filaments.visible = false;
      tendrils.visible = false;
      motes.visible = false;
      musicHalo.visible = false;
      innerCore.visible = false;
      corePetals.forEach((petal) => { petal.visible = false; });
    };

    const updateSpectrumLevels = (data: Uint8Array, deltaTime: number, playing: boolean) => {
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
      const energyDelta = Math.abs(overallEnergy - previousOverallEnergy);
      localVariance += (energyDelta - localVariance) * (1 - Math.exp(-deltaTime * (energyDelta > localVariance ? 18 : 2.4)));
      adaptiveVariancePeak = Math.max(localVariance, adaptiveVariancePeak * Math.exp(-deltaTime * 0.55), 0.0035);
      const fastRate = overallEnergy > fastEnergy ? 16 : 7;
      fastEnergy += (overallEnergy - fastEnergy) * (1 - Math.exp(-deltaTime * fastRate));
      slowEnergy += (overallEnergy - slowEnergy) * (1 - Math.exp(-deltaTime * 0.85));
      const relativeEnergy = Math.max(0, fastEnergy - slowEnergy);
      adaptivePeak = Math.max(relativeEnergy, adaptivePeak * Math.exp(-deltaTime * 0.72), 0.018);
      const normalizedPulse = Math.sqrt(Math.min(1, relativeEnergy / Math.max(0.012, adaptivePeak * 0.78)));
      const variancePulse = Math.sqrt(Math.min(1, localVariance / Math.max(0.0035, adaptiveVariancePeak * 0.82)));
      const relativeRise = Math.max(0, normalizedPulse - previousRelativeEnergy);
      const rhythmFloor = playing && overallEnergy > 0.004 ? 0.055 + variancePulse * 0.17 : 0;
      const pulseTarget = Math.min(1, Math.max(rhythmFloor, normalizedPulse * 0.68 + variancePulse * 0.2 + relativeRise * 1.5));
      const envelopeRate = pulseTarget > onsetPulse ? 22 : 4.8;
      onsetPulse += (pulseTarget - onsetPulse) * (1 - Math.exp(-deltaTime * envelopeRate));
      const nextImpulse = Math.min(1, (relativeRise * 3 + variancePulse * (playing ? 0.22 : 0.04)) * creatureGenome.rhythmSensitivity);
      rhythmImpulse = Math.max(rhythmImpulse * Math.exp(-deltaTime * 8.5), nextImpulse);
      if (nextImpulse > (playing ? 0.055 : 0.16) && nextImpulse >= pendingOuterPulse) {
        contractionPulse = Math.max(contractionPulse, nextImpulse);
        pendingOuterPulse = nextImpulse;
        pendingOuterAt = rhythmClock + creatureGenome.outerDelay;
        pendingSkinPulse = nextImpulse;
        pendingSkinAt = pendingOuterAt + creatureGenome.skinDelay;
      }
      contractionPulse *= Math.exp(-deltaTime * 15);
      outerPulse *= Math.exp(-deltaTime * 4.6);
      skinPulse *= Math.exp(-deltaTime * 5.2);
      if (pendingOuterAt >= 0 && rhythmClock >= pendingOuterAt) {
        outerPulse = Math.max(outerPulse, pendingOuterPulse);
        pendingOuterPulse = 0;
        pendingOuterAt = -1;
      }
      if (pendingSkinAt >= 0 && rhythmClock >= pendingSkinAt) {
        skinPulse = Math.max(skinPulse, pendingSkinPulse);
        pendingSkinPulse = 0;
        pendingSkinAt = -1;
      }
      previousRelativeEnergy = normalizedPulse;
      previousOverallEnergy = overallEnergy;
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
        const collisionRadius = visualRadius * (0.9 + creatureGenome.bodyAsymmetry);
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


    const drawBioluminescentOrganism = (time: number, current: WaveCanvasProps) => {
      const viewportAspect = Math.min(1, canvasHeight / canvasWidth);
      const scale = current.creatureScale ?? 1;
      const baseRadius = creatureGenome.bodyRadius * scale;
      const motionScale = reducedMotion ? 0.28 : 1;
      const speed = Math.hypot(creatureVelocityX, creatureVelocityY);
      const heading = speed > 0.002 ? Math.atan2(creatureVelocityY, creatureVelocityX) : creatureHeading;
      const breath = reducedMotion ? 0 : (
        Math.sin(time * creatureGenome.idleBreathRate + creatureGenome.breathPhase)
        + Math.sin(time * creatureGenome.idleBreathRate * 0.63 + creatureGenome.breathPhase * 1.7) * 0.34
        + Math.sin(time * creatureGenome.idleBreathRate * 1.71 - creatureGenome.breathPhase * 0.6) * 0.18
      ) / 1.52 * creatureGenome.idleBreathDepth;
      const innerBeat = Math.min(0.1, bassEnergy * creatureGenome.bassSensitivity * 0.055 + onsetPulse * 0.07);
      const outerBeat = Math.min(0.18, midEnergy * creatureGenome.midSensitivity * 0.065 + outerPulse * 0.12);
      const contraction = contractionPulse * 0.055 + startlePulse * 0.035;
      const stretch = Math.min(0.16, speed * 0.72 + threatResponse * 0.05);
      const rotation = time * creatureGenome.rotationTendency + creatureGenome.bodyPhase;
      const coreX = creatureX + Math.cos(rotation + creatureGenome.coreOffsetAngle) * creatureGenome.coreOffset * scale * viewportAspect;
      const coreY = creatureY + Math.sin(rotation + creatureGenome.coreOffsetAngle) * creatureGenome.coreOffset * scale;

      writeOrganicPoint(innerMembranePositions, 0, coreX, coreY);
      writeOrganicPoint(outerMembranePositions, 0, creatureX, creatureY);
      for (let index = 0; index < membranePointLimit; index += 1) {
        const t = index / membranePointLimit;
        const folded = 1 - Math.abs(t * 2 - 1);
        const bandPosition = folded * (spectrumBandCount - 1);
        const bandIndex = Math.floor(bandPosition);
        const nextBandIndex = Math.min(spectrumBandCount - 1, bandIndex + 1);
        const blend = bandPosition - bandIndex;
        const energy = spectrumLevels[bandIndex] * (1 - blend) + spectrumLevels[nextBandIndex] * blend;
        const peak = peakLevels[bandIndex] * (1 - blend) + peakLevels[nextBandIndex] * blend;
        const angle = t * Math.PI * 2;
        const organic = Math.sin(angle * creatureGenome.lobeCount + creatureGenome.bodyPhase + time * 0.2) * creatureGenome.bodyAsymmetry
          + Math.sin(angle * (creatureGenome.lobeCount + 2) - time * 0.13 + creatureGenome.breathPhase) * creatureGenome.bodyAsymmetry * 0.42;
        const directional = Math.cos(angle - heading) * stretch + Math.sin(angle - heading) * Math.sin(time * 0.9 + creatureGenome.bodyPhase) * stretch * 0.24;
        membraneRaw[index] = baseRadius * (1 + organic + breath + outerBeat - contraction + directional)
          + (energy * 0.055 + peak * 0.017) * creatureGenome.outerElasticity * scale;
      }
      circularSmooth(membraneRaw, membraneSmoothed, compact ? 3 : 5);

      for (let index = 0; index < membranePointLimit; index += 1) {
        const angle = index / membranePointLimit * Math.PI * 2;
        const xAspect = viewportAspect * creatureGenome.bodyAspect;
        const outerRadius = membraneSmoothed[index];
        const innerOrganic = Math.sin(angle * (creatureGenome.lobeCount - 1) - time * 0.29 + creatureGenome.bodyPhase) * 0.035;
        const innerRadius = baseRadius * (0.58 + innerOrganic + breath * 0.74 + innerBeat - contraction * 0.72) * creatureGenome.innerElasticity;
        const outerX = creatureX + Math.cos(angle) * outerRadius * xAspect;
        const outerY = creatureY + Math.sin(angle) * outerRadius;
        const innerX = coreX + Math.cos(angle) * innerRadius * xAspect;
        const innerY = coreY + Math.sin(angle) * innerRadius;
        const skinWidth = baseRadius * (0.025 + trebleEnergy * creatureGenome.trebleSensitivity * 0.025 + skinPulse * 0.018);
        const shimmer = Math.sin(angle * 17 + time * 2.2 + creatureGenome.bodyPhase) * skinWidth * (0.18 + trebleEnergy);
        const skinOuterRadius = outerRadius + skinWidth + shimmer;
        const skinOffset = index * 6;
        spectralSkinPositions[skinOffset] = outerX;
        spectralSkinPositions[skinOffset + 1] = outerY;
        spectralSkinPositions[skinOffset + 3] = creatureX + Math.cos(angle) * skinOuterRadius * xAspect;
        spectralSkinPositions[skinOffset + 4] = creatureY + Math.sin(angle) * skinOuterRadius;
        writeOrganicPoint(outerEdgePositions, index, outerX, outerY);
        writeOrganicPoint(innerEdgePositions, index, innerX, innerY);
        writeOrganicPoint(outerMembranePositions, index + 1, outerX, outerY);
        writeOrganicPoint(innerMembranePositions, index + 1, innerX, innerY);
      }

      const filamentSegments = compact ? 16 : filamentSegmentLimit;
      let filamentVertex = 0;
      for (const filament of creatureGenome.filaments) {
        const angle = rotation * filament.rotationRate + filament.angle;
        const endAngle = angle + filament.curvature * creatureGenome.filamentCurvature + Math.sin(time * 0.72 + filament.phase) * 0.1 * motionScale;
        const startX = coreX + Math.cos(angle) * baseRadius * 0.09 * viewportAspect;
        const startY = coreY + Math.sin(angle) * baseRadius * 0.09;
        const endX = creatureX + Math.cos(endAngle) * baseRadius * filament.reach * viewportAspect * creatureGenome.bodyAspect;
        const endY = creatureY + Math.sin(endAngle) * baseRadius * filament.reach;
        const tangentX = -Math.sin(angle) * filament.curvature * baseRadius;
        const tangentY = Math.cos(angle) * filament.curvature * baseRadius;
        let previousX = startX;
        let previousY = startY;
        for (let segment = 1; segment <= filamentSegments; segment += 1) {
          const progress = segment / filamentSegments;
          const point = cubicBezier(progress, startX, startY, startX + tangentX * viewportAspect, startY + tangentY, endX - tangentX * 0.45 * viewportAspect, endY - tangentY * 0.45, endX, endY);
          const offset = filamentVertex * 3;
          filamentPositions[offset] = previousX;
          filamentPositions[offset + 1] = previousY;
          filamentPositions[offset + 3] = point.x;
          filamentPositions[offset + 4] = point.y;
          filamentVertex += 2;
          previousX = point.x;
          previousY = point.y;
        }
      }

      const tendrilSegments = compact ? 12 : tendrilSegmentLimit;
      let tendrilVertex = 0;
      for (const tendril of creatureGenome.tendrils) {
        const anchorAngle = tendril.angle + rotation * 0.2;
        const lag = (speed * 1.8 + startlePulse * 0.22) * tendril.length;
        const wave = Math.sin(time * (0.7 + trebleEnergy * 1.8) + tendril.phase) * (0.08 + trebleEnergy * 0.16) * motionScale;
        const startX = creatureX + Math.cos(anchorAngle) * baseRadius * viewportAspect * creatureGenome.bodyAspect;
        const startY = creatureY + Math.sin(anchorAngle) * baseRadius;
        let previousX = startX;
        let previousY = startY;
        for (let segment = 1; segment <= tendrilSegments; segment += 1) {
          const progress = segment / tendrilSegments;
          const curlAngle = anchorAngle + tendril.curvature * progress + wave * Math.sin(progress * Math.PI * 1.4);
          const radial = baseRadius * (1 + tendril.length * progress);
          const x = creatureX + Math.cos(curlAngle) * radial * viewportAspect * creatureGenome.bodyAspect - Math.cos(heading) * lag * progress * progress * viewportAspect;
          const y = creatureY + Math.sin(curlAngle) * radial - Math.sin(heading) * lag * progress * progress;
          const offset = tendrilVertex * 3;
          tendrilPositions[offset] = previousX;
          tendrilPositions[offset + 1] = previousY;
          tendrilPositions[offset + 3] = x;
          tendrilPositions[offset + 4] = y;
          tendrilVertex += 2;
          previousX = x;
          previousY = y;
        }
      }

      const activeMotes = Math.min(compact ? 8 : moteLimit, creatureGenome.moteCount);
      for (let index = 0; index < activeMotes; index += 1) {
        const mote = creatureGenome.motes[index];
        const angle = mote.angle + time * mote.speed * creatureGenome.orbitTendency;
        const scatter = startlePulse * mote.radius * 0.52;
        const radius = baseRadius * (mote.radius + scatter + onsetPulse * 0.06);
        writeOrganicPoint(motePositions, index, creatureX + Math.cos(angle) * radius * viewportAspect, creatureY + Math.sin(angle * mote.flatten + mote.phase) * radius);
      }

      outerEdgeGeometry.setDrawRange(0, membranePointLimit);
      innerEdgeGeometry.setDrawRange(0, membranePointLimit);
      filamentGeometry.setDrawRange(0, filamentVertex);
      tendrilGeometry.setDrawRange(0, tendrilVertex);
      moteGeometry.setDrawRange(0, activeMotes);
      innerMembraneGeometry.attributes.position.needsUpdate = true;
      outerMembraneGeometry.attributes.position.needsUpdate = true;
      spectralSkinGeometry.attributes.position.needsUpdate = true;
      outerEdgeGeometry.attributes.position.needsUpdate = true;
      innerEdgeGeometry.attributes.position.needsUpdate = true;
      filamentGeometry.attributes.position.needsUpdate = true;
      tendrilGeometry.attributes.position.needsUpdate = true;
      moteGeometry.attributes.position.needsUpdate = true;

      musicHalo.position.set(creatureX, creatureY, -0.2);
      const auraScale = baseRadius * (2.15 + breath * 2.6 + outerBeat * 0.8 + startlePulse * 0.08);
      musicHalo.scale.set(auraScale * viewportAspect * creatureGenome.bodyAspect, auraScale, 1);
      innerCore.position.set(coreX, coreY, 0.02);
      const coreScale = baseRadius * (0.54 + breath * 0.75 + innerBeat * 0.9 - contraction * 0.38);
      innerCore.scale.set(coreScale * viewportAspect, coreScale, 1);
      corePetals.forEach((petal, index) => {
        const angle = rotation * (index % 2 === 0 ? 1.7 : -1.25) + index * Math.PI * 2 / 3;
        const petalOffset = coreScale * 0.27;
        petal.position.set(coreX + Math.cos(angle) * petalOffset * viewportAspect, coreY + Math.sin(angle) * petalOffset, 0.01);
        petal.scale.set(coreScale * viewportAspect * 0.82, coreScale * 1.28, 1);
        petal.material.rotation = angle + Math.PI / 2;
      });
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
        adaptiveVariancePeak = 0.01;
        localVariance = 0;
        previousOverallEnergy = 0;
        previousRelativeEnergy = 0;
        onsetPulse = 0;
        rhythmImpulse = 0;
        outerPulse = 0;
        skinPulse = 0;
        contractionPulse = 0;
        rhythmClock = 0;
        pendingOuterPulse = 0;
        pendingOuterAt = -1;
        pendingSkinPulse = 0;
        pendingSkinAt = -1;
        startlePulse = 0;
        escapeUntil = 0;
        repulsorEscapeUntil = 0;
        innerMembraneMaterial.color.setHex(creatureGenome.primaryHue);
        outerMembraneMaterial.color.setHex(creatureGenome.secondaryHue);
        spectralSkinMaterial.color.setHex(creatureGenome.primaryHue);
        outerEdgeMaterial.color.setHex(creatureGenome.primaryHue);
        innerEdgeMaterial.color.setHex(creatureGenome.highlightHue);
        filamentMaterial.color.setHex(creatureGenome.highlightHue);
        tendrilMaterial.color.setHex(creatureGenome.secondaryHue);
        moteMaterial.color.setHex(creatureGenome.highlightHue);
        particleMaterial.color.setHex(creatureGenome.primaryHue);
        haloMaterial.color.setHex(creatureGenome.primaryHue);
        coreMaterial.color.setHex(creatureGenome.highlightColor);
        corePetalMaterials.forEach((material, index) => material.color.setHex(index === 1 ? creatureGenome.highlightHue : creatureGenome.secondaryHue));
      }
      updateCreaturePhysics(time, deltaTime, current);
      drawBioluminescentOrganism(time, current);

      innerMembrane.visible = true;
      outerMembrane.visible = true;
      spectralSkin.visible = true;
      outerEdge.visible = true;
      innerEdge.visible = true;
      filaments.visible = true;
      tendrils.visible = true;
      motes.visible = true;
      musicHalo.visible = true;
      innerCore.visible = true;
      corePetals.forEach((petal) => { petal.visible = true; });
      innerMembraneMaterial.opacity = 0.17 + bassEnergy * 0.15 + onsetPulse * 0.05;
      outerMembraneMaterial.opacity = 0.12 + midEnergy * 0.12 + outerPulse * 0.08;
      spectralSkinMaterial.opacity = 0.23 + trebleEnergy * 0.24 + skinPulse * 0.18;
      outerEdgeMaterial.opacity = 0.78 + trebleEnergy * 0.18 + skinPulse * 0.04;
      innerEdgeMaterial.opacity = 0.5 + bassEnergy * 0.25 + onsetPulse * 0.12;
      filamentMaterial.opacity = 0.82 + midEnergy * 0.16 + onsetPulse * 0.08;
      tendrilMaterial.opacity = 0.62 + trebleEnergy * 0.24 + startlePulse * 0.12;
      moteMaterial.opacity = 0.82 + trebleEnergy * 0.16 + onsetPulse * 0.02;
      moteMaterial.size = 4.8 + trebleEnergy * (reducedMotion ? 1.2 : 4.5) + startlePulse * 1.5;
      haloMaterial.opacity = creatureGenome.glowIntensity * (0.24 + onsetPulse * 0.17 + overallEnergy * 0.09);
      coreMaterial.opacity = 0.82 + bassEnergy * 0.12 + onsetPulse * 0.06;
      corePetalMaterials.forEach((material, index) => { material.opacity = 0.18 + index * 0.035 + bassEnergy * 0.16 + onsetPulse * 0.08; });
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
      if (musicReady) updateSpectrumLevels(current.spectrumData ?? silentSpectrumData, deltaTime, Boolean(current.musicPlaying));
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
      const homeMusicActive = Boolean(current.mode === 'home' && current.homeMusicPlaying && current.homeMusicData?.length);
      for (let index = 0; index < pointTotal; index += 1) {
        const t = index / Math.max(pointTotal - 1, 1);
        const x = t * 1.8 - 0.9;
        let y = resolveY(t, time, current);
        if (homeMusicActive && current.homeMusicData) {
          const sourcePosition = t * (current.homeMusicData.length - 1);
          const sourceIndex = Math.floor(sourcePosition);
          const nextIndex = Math.min(current.homeMusicData.length - 1, sourceIndex + 1);
          const blend = sourcePosition - sourceIndex;
          const sample = (current.homeMusicData[sourceIndex] ?? 128) * (1 - blend) + (current.homeMusicData[nextIndex] ?? 128) * blend;
          y = (sample - 128) / 128 * 0.52;
        }
        let soundEnergy = 0;
        if (homeSoundActive && current.homeSoundEnvelope) {
          const samplePosition = Math.min(1, Math.max(0, homeProgress + (t - 0.5) * 0.34));
          const envelopeIndex = Math.min(current.homeSoundEnvelope.length - 1, Math.floor(samplePosition * current.homeSoundEnvelope.length));
          const soundSample = current.homeSoundEnvelope[envelopeIndex] ?? 0;
          soundEnergy = Math.abs(soundSample) * homeRelease;
          y += soundSample * (homeMusicActive ? 0.2 : 0.48) * homeRelease;
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
      const activeParticleCount = spectrumActive ? Math.min(compact ? 70 : particleCount, creatureGenome.trailDensity) : particleCount;
      particleGeometry.setDrawRange(0, activeParticleCount);
      const creatureSpeed = Math.max(0.001, Math.hypot(creatureVelocityX, creatureVelocityY));
      for (let index = 0; index < activeParticleCount; index += 1) {
        const offset = index * 3;
        if (spectrumActive) {
          const scale = current.creatureScale ?? 1;
          const phase = particleSeeds[offset + 2] + time * (0.18 + particleSeeds[offset + 1] * 0.22) * creatureGenome.orbitTendency * motionScale;
          const scatter = startlePulse * particleSeeds[offset + 1] * 0.16 * scale;
          const clusterRadius = creatureGenome.bodyRadius * scale * (0.3 + particleSeeds[offset + 1] * 1.35) + onsetPulse * 0.055 * scale + scatter;
          const trailAmount = particleSeeds[offset + 1] * (0.04 + creatureSpeed * 0.9 + threatResponse * 0.12 + startlePulse * 0.18) * scale;
          const trailX = -creatureVelocityX / creatureSpeed * trailAmount;
          const trailY = -creatureVelocityY / creatureSpeed * trailAmount;
          particlePositions[offset] = creatureX + Math.cos(phase) * clusterRadius * Math.min(1, canvasHeight / canvasWidth) + trailX;
          particlePositions[offset + 1] = creatureY + Math.sin(phase * (0.88 + creatureGenome.bodyAsymmetry * 0.5)) * clusterRadius + trailY;
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
      [waveGeometry, secondaryGeometry, pointGeometry, stemGeometry, playheadGeometry, playheadMarkerGeometry, innerMembraneGeometry, outerMembraneGeometry, spectralSkinGeometry, outerEdgeGeometry, innerEdgeGeometry, filamentGeometry, tendrilGeometry, moteGeometry, particleGeometry, sampleRingGeometry].forEach((geometry) => geometry.dispose());
      haloTexture.dispose();
      [waveMaterial, secondaryMaterial, pointMaterial, pointGlowMaterial, contactMaterial, stemMaterial, ringMaterial, wavePointMaterial, playheadMaterial, playheadMarkerMaterial, innerMembraneMaterial, outerMembraneMaterial, spectralSkinMaterial, outerEdgeMaterial, innerEdgeMaterial, filamentMaterial, tendrilMaterial, moteMaterial, particleMaterial, haloMaterial, coreMaterial, ...corePetalMaterials].forEach((material) => material.dispose());
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

function circularSmooth(source: Float32Array, target: Float32Array, radius: number) {
  const count = source.length;
  for (let index = 0; index < count; index += 1) {
    let total = 0;
    let weightTotal = 0;
    for (let offset = -radius; offset <= radius; offset += 1) {
      const weight = radius + 1 - Math.abs(offset);
      total += source[(index + offset + count) % count] * weight;
      weightTotal += weight;
    }
    target[index] = total / weightTotal;
  }
}

function cubicBezier(
  progress: number,
  startX: number,
  startY: number,
  controlOneX: number,
  controlOneY: number,
  controlTwoX: number,
  controlTwoY: number,
  endX: number,
  endY: number,
) {
  const inverse = 1 - progress;
  const inverseSquared = inverse * inverse;
  const progressSquared = progress * progress;
  return {
    x: inverseSquared * inverse * startX + 3 * inverseSquared * progress * controlOneX + 3 * inverse * progressSquared * controlTwoX + progressSquared * progress * endX,
    y: inverseSquared * inverse * startY + 3 * inverseSquared * progress * controlOneY + 3 * inverse * progressSquared * controlTwoY + progressSquared * progress * endY,
  };
}

function logarithmicBin(index: number, bandCount: number, binCount: number) {
  if (index <= 0) return 1;
  if (index >= bandCount) return binCount;
  return Math.min(binCount - 1, Math.max(1, Math.round(Math.exp(index / bandCount * Math.log(binCount)))));
}

function createCreatureGenome(seed: number) {
  const random = seededRandom(seed);
  const paletteFamilies = [
    { primary: 0x66e4ff, secondary: 0x997cff, highlight: 0xffdfad },
    { primary: 0x58e2cf, secondary: 0x599ee8, highlight: 0xf5ffff },
    { primary: 0x81cfff, secondary: 0xd276df, highlight: 0xffd4c7 },
    { primary: 0xb190ff, secondary: 0x55dfe0, highlight: 0xffedbd },
  ];
  const palette = paletteFamilies[Math.floor(random() * paletteFamilies.length)];
  const bodyPhase = random() * Math.PI * 2;
  const filamentCount = 3 + Math.floor(random() * 6);
  const tendrilCount = 4 + Math.floor(random() * 9);
  const moteCount = 4 + Math.floor(random() * 9);
  const tendrilMin = 0.24 + random() * 0.14;
  const tendrilMax = tendrilMin + 0.32 + random() * 0.34;
  const filaments = Array.from({ length: filamentCount }, (_, index) => ({
    angle: bodyPhase + index / filamentCount * Math.PI * 2 + (random() - 0.5) * 0.3,
    curvature: (random() > 0.5 ? 1 : -1) * (0.24 + random() * 0.56),
    reach: 0.62 + random() * 0.28,
    rotationRate: (random() > 0.5 ? 1 : -1) * (0.08 + random() * 0.16),
    phase: random() * Math.PI * 2,
  }));
  const tendrils = Array.from({ length: tendrilCount }, (_, index) => ({
    angle: bodyPhase + index / tendrilCount * Math.PI * 2 + (random() - 0.5) * 0.4,
    curvature: (random() > 0.5 ? 1 : -1) * (0.18 + random() * 0.62),
    length: tendrilMin + random() * (tendrilMax - tendrilMin),
    phase: random() * Math.PI * 2,
  }));
  const motes = Array.from({ length: moteCount }, () => ({
    angle: random() * Math.PI * 2,
    radius: 1.08 + random() * 0.82,
    speed: (random() > 0.5 ? 1 : -1) * (0.12 + random() * 0.35),
    flatten: 0.84 + random() * 0.28,
    phase: (random() - 0.5) * 0.36,
  }));

  return {
    bodyRadius: 0.18 + random() * 0.08,
    bodyAspect: 0.84 + random() * 0.28,
    bodyAsymmetry: 0.028 + random() * 0.052,
    bodyPhase,
    coreOffset: 0.012 + random() * 0.035,
    coreOffsetAngle: random() * Math.PI * 2,
    innerElasticity: 0.92 + random() * 0.16,
    outerElasticity: 0.82 + random() * 0.42,
    lobeCount: 3 + Math.floor(random() * 4),
    filamentCount,
    filaments,
    filamentCurvature: 0.24 + random() * 0.56,
    tendrilCount,
    tendrils,
    tendrilLengthRange: [tendrilMin, tendrilMax] as const,
    moteCount,
    motes,
    orbitTendency: (random() > 0.5 ? 1 : -1) * (0.55 + random() * 0.8),
    trailDensity: 70 + Math.floor(random() * 111),
    bassSensitivity: 0.78 + random() * 0.58,
    midSensitivity: 0.76 + random() * 0.54,
    trebleSensitivity: 0.78 + random() * 0.64,
    rhythmSensitivity: 0.82 + random() * 0.56,
    idleBreathRate: 0.72 + random() * 0.48,
    idleBreathDepth: 0.018 + random() * 0.018,
    breathPhase: random() * Math.PI * 2,
    rotationTendency: (random() > 0.5 ? 1 : -1) * (0.025 + random() * 0.06),
    outerDelay: 0.04 + random() * 0.05,
    skinDelay: 0.02 + random() * 0.04,
    glowIntensity: 0.72 + random() * 0.28,
    wanderSpeed: 0.18 + random() * 0.28,
    wanderPhase: random() * Math.PI * 2,
    turningTendency: 0.38 + random() * 0.68,
    escapeCommitment: 0.8 + random() * 1.1,
    repulsorCommitment: 0.5 + random() * 0.65,
    escapePhase: random() * Math.PI * 2,
    onsetSensitivity: 0.82 + random() * 0.56,
    avoidanceSensitivity: 0.9 + random() * 0.64,
    spawnX: (random() - 0.5) * 0.42,
    spawnY: (random() - 0.5) * 0.32,
    primaryHue: palette.primary,
    secondaryHue: palette.secondary,
    highlightHue: palette.highlight,
    highlightColor: palette.highlight,
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
