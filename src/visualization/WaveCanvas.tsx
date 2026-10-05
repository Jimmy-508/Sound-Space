import { useEffect, useRef, type RefObject } from 'react';
import * as THREE from 'three';
import type { PointerPoint, Waveform } from '../types';
import { computeAttractionSteering, computeWavefrontInfluence, type Repulsor, type SpiritGestureForces } from './repulsor';
import {
  DEFAULT_SOUND_SPIRIT_PHENOTYPE,
  SOUND_SPIRIT_SPECIES_GUARDRAILS,
  type SoundSpiritPhenotypeConfig,
} from '../spirit/soundSpiritIdentity';

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
  repulsorsRef?: RefObject<Repulsor[]>;
  gestureForcesRef?: RefObject<SpiritGestureForces>;
  homeSoundEnvelope?: Float32Array | null;
  homeSoundStartedAt?: number;
  homeSoundDuration?: number;
  homeSoundToken?: number;
  homeMusicData?: Uint8Array | null;
  homeMusicPlaying?: boolean;
  spiritPhenotype?: SoundSpiritPhenotypeConfig;
  pointer: PointerPoint;
}

type SpiritLifeState = 'drift' | 'cruise' | 'glide' | 'curious' | 'startled';

const wavePointLimit = 768;
const samplePointLimit = 64;
const spectrumBandCount = 64;
const wakeRibbonCount = 2;
const wakePointCount = 26;
const moteLimit = 36;
const particleCount = 220;
const heartLobeDelays = new Float32Array([0.026, 0.05, 0.072, 0.038, 0]);
const silentSpectrumData = new Uint8Array(512);
const noRepulsors: Repulsor[] = [];
const funnelRingUniformNames = ['uFunnelRing0', 'uFunnelRing1', 'uFunnelRing2', 'uFunnelRing3', 'uFunnelRing4', 'uFunnelRing5'] as const;
const funnelTiltUniformNames = ['uFunnelTilt0', 'uFunnelTilt1', 'uFunnelTilt2', 'uFunnelTilt3', 'uFunnelTilt4', 'uFunnelTilt5'] as const;
const softbodyActiveX = new Float32Array([0, 0.006, 0.018, 0.038, 0.065, 0.09]);
const softbodyActiveZ = new Float32Array([0, -0.002, -0.006, -0.011, -0.016, -0.02]);
const softbodyActiveCompression = new Float32Array([0, 0.018, 0.045, 0.075, 0.1, 0.12]);
const softbodyActiveStretch = new Float32Array([0, 0.005, 0.012, 0.022, 0.034, 0.045]);
const softbodyActiveTilt = new Float32Array([0, 0.015, 0.04, 0.076, 0.118, 0.15]);
const funnelPowerX = new Float32Array([0, -0.003, -0.009, -0.018, -0.026, -0.031]);
const funnelPowerZ = new Float32Array([0, 0.001, 0.003, 0.005, 0.006, 0.007]);
const funnelGlideX = new Float32Array([0, 0.002, 0.007, 0.015, 0.025, 0.034]);
const funnelGlideZ = new Float32Array([0, -0.001, -0.002, -0.004, -0.006, -0.008]);
const funnelCenterStiffness = new Float32Array([68, 54, 42, 32, 24, 18]);
const funnelCenterDamping = new Float32Array([15, 13.8, 12.4, 11.2, 10.2, 9.4]);

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
  repulsorsRef,
  gestureForcesRef,
  homeSoundEnvelope = null,
  homeSoundStartedAt = 0,
  homeSoundDuration = 0,
  homeSoundToken = 0,
  homeMusicData = null,
  homeMusicPlaying = false,
  spiritPhenotype = DEFAULT_SOUND_SPIRIT_PHENOTYPE,
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
    repulsorsRef,
    gestureForcesRef,
    homeSoundEnvelope,
    homeSoundStartedAt,
    homeSoundDuration,
    homeSoundToken,
    homeMusicData,
    homeMusicPlaying,
    spiritPhenotype,
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
    repulsorsRef,
    gestureForcesRef,
    homeSoundEnvelope,
    homeSoundStartedAt,
    homeSoundDuration,
    homeSoundToken,
    homeMusicData,
    homeMusicPlaying,
    spiritPhenotype,
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
    const wakeMaterial = new THREE.MeshBasicMaterial({ color: spiritPhenotype.isDefault ? 0x77dbff : spiritPhenotype.primaryColor, vertexColors: true, depthTest: false, depthWrite: false, transparent: true, opacity: 0.11, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const moteMaterial = new THREE.PointsMaterial({ color: 0xffe4a8, depthTest: false, size: 4, transparent: true, opacity: 0.86, sizeAttenuation: false, blending: THREE.AdditiveBlending });
    const particleMaterial = new THREE.PointsMaterial({ color: spiritPhenotype.isDefault ? 0x65cfff : spiritPhenotype.primaryColor, depthTest: false, size: 1.2, transparent: true, opacity: 0.34, sizeAttenuation: false, blending: THREE.AdditiveBlending });
    const previewParams = new URLSearchParams(window.location.search);
    const localPreview = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';
    const previewPass = /^(A|B)$/.test(previewParams.get('spiritPass') ?? '') && localPreview
      ? previewParams.get('spiritPass')
      : null;
    const spiritDebug = /^(neutral|closeup|power|glide|funnel-neutral|funnel-power|funnel-glide|softbody)$/.test(previewParams.get('spiritDebug') ?? '') && localPreview
      ? previewParams.get('spiritDebug')
      : null;
    const softbodyDebug = /^(rest|active)$/.test(previewParams.get('softbody') ?? '') && localPreview
      ? previewParams.get('softbody')
      : null;
    const lifeDebug = /^(drift|cruise|glide|curious|startled)$/.test(previewParams.get('spiritLife') ?? '') && localPreview
      ? previewParams.get('spiritLife') as SpiritLifeState
      : null;
    const interactionDebugOff = previewParams.get('spiritHands') === 'off' && localPreview;
    const anchorDebug = previewParams.get('spiritAnchor') === 'center' && localPreview;
    const spiritLayer = /^(body|filaments|motes)$/.test(previewParams.get('spiritLayer') ?? '') && localPreview
      ? previewParams.get('spiritLayer')
      : null;
    const spiritRig = createMasterSpirit(compact, spiritPhenotype);
    const unifiedSpirit = spiritRig.group;
    unifiedSpirit.visible = false;

    const wavePositions = new Float32Array(wavePointLimit * 3);
    const waveColors = new Float32Array(wavePointLimit * 3);
    const secondaryPositions = new Float32Array(wavePointLimit * 3);
    const samplePositions = new Float32Array(samplePointLimit * 3);
    const sampleStemPositions = new Float32Array(samplePointLimit * 2 * 3);
    const playheadPositions = new Float32Array(2 * 3);
    const playheadMarkerPositions = new Float32Array(3);
    const wakePositions = Array.from({ length: wakeRibbonCount }, () => new Float32Array(wakePointCount * 2 * 3));
    const wakeColors = Array.from({ length: wakeRibbonCount }, () => new Float32Array(wakePointCount * 2 * 3));
    const motePositions = new Float32Array(moteLimit * 3);
    const particlePositions = new Float32Array(particleCount * 3);
    const particleSeeds = new Float32Array(particleCount * 3);
    const particleVelocityX = new Float32Array(particleCount);
    const particleVelocityY = new Float32Array(particleCount);
    let particleFieldInitialized = false;

    const waveGeometry = dynamicGeometry(wavePositions);
    waveGeometry.setAttribute('color', new THREE.BufferAttribute(waveColors, 3).setUsage(THREE.DynamicDrawUsage));
    const secondaryGeometry = dynamicGeometry(secondaryPositions);
    const pointGeometry = dynamicGeometry(samplePositions);
    const stemGeometry = dynamicGeometry(sampleStemPositions);
    const playheadGeometry = dynamicGeometry(playheadPositions);
    const playheadMarkerGeometry = dynamicGeometry(playheadMarkerPositions);
    const wakeGeometries = wakePositions.map((positions, index) => {
      const geometry = dynamicBandGeometry(positions, wakePointCount);
      geometry.setAttribute('color', new THREE.BufferAttribute(wakeColors[index], 3).setUsage(THREE.DynamicDrawUsage));
      return geometry;
    });
    const moteColors = new Float32Array(moteLimit * 3);
    const moteGeometry = dynamicGeometry(motePositions);
    moteGeometry.setAttribute('color', new THREE.BufferAttribute(moteColors, 3).setUsage(THREE.DynamicDrawUsage));
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
    const energyWakes = wakeGeometries.map((geometry) => new THREE.Mesh(geometry, wakeMaterial));
    moteMaterial.vertexColors = true;
    moteMaterial.color.setHex(0xffffff);
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
    particles.renderOrder = 0;
    motes.renderOrder = 9;
    energyWakes.forEach((wake, index) => { wake.renderOrder = 2.4 + index * 0.04; });
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
      unifiedSpirit,

      secondaryLine,
      ...energyWakes,







      motes,

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
    const previousSpectrumLevels = new Float32Array(spectrumBandCount);
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
    let rmsEnergy = 0;
    let spectralFlux = 0;
    let spectralCentroid = 0;
    let fastEnergy = 0;
    let slowEnergy = 0;
    let adaptivePeak = 0.025;
    let adaptiveVariancePeak = 0.01;
    let localVariance = 0;
    let longTermEnergy = 0.04;
    let shortTermPeak = 0.08;
    let lifeEnergy = 0;
    let musicAwake = 0;
    let beatAccent = 0;
    let previousOverallEnergy = 0;
    let previousRelativeEnergy = 0;
    let onsetPulse = 0;
    let rhythmImpulse = 0;
    let rhythmPulse = 0;
    let rhythmStrength = 0;
    let grooveEnergy = 0;
    let accentPulse = 0;
    let musicEnergy = 0;
    let veilPulse = 0;
    let ribbonPulse = 0;
    let motePulse = 0;
    let contractionPulse = 0;
    let beatBaseline = 0.055;
    let beatDeviation = 0.015;
    let previousBeatSignal = 0;
    let previousBassEnergy = 0;
    let lastMainBeatAt = -10;
    let expectedBeatInterval = 0;
    let acceptedBeatCount = 0;
    let acceptedBeatTotal = 0;
    let acceptedBeatCursor = 0;
    const recentBeatIntervals = new Float32Array(8);
    const beatIntervalScratch = new Float32Array(8);
    let rhythmClock = 0;
    let pendingVeilPulse = 0;
    let pendingVeilAt = -1;
    let pendingRibbonPulse = 0;
    let pendingRibbonAt = -1;
    let pendingMotePulse = 0;
    let pendingMoteAt = -1;
    let profileSeed = -1;
    let creatureGenome = createSpiritProfile(spiritPhenotype.seed, spiritPhenotype);
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
    let lifeState: SpiritLifeState = 'drift';
    let lifeStateUntil = 0;
    let lifeTargetX = creatureX;
    let lifeTargetY = creatureY;
    let lifeRandomState = (spiritPhenotype.seed * 2654435761) >>> 0;
    let wingCycle = creatureGenome.breathPhase;
    let curiousResponse = 0;
    let interactionX = creatureX;
    let interactionY = creatureY;
    let releaseLookUntil = 0;
    let contactPulse = 0;
    let contactAge = 10;
    let contactPointX = 0;
    let contactPointY = 0;
    let contactKind = 0;
    let contactFunnelRing = 0;
    let contactFunnelDirection = 0;
    let heartStartlePulse = 0;
    const wingContactPulse = new Float32Array(2);
    const wingContactSpan = new Float32Array(2);
    let lastDebugTelemetryTick = -1;
    let lastVisualTelemetryTick = -1;
    const wingSpring = [new Float32Array(5), new Float32Array(5)];
    const wingVelocity = [new Float32Array(5), new Float32Array(5)];
    const funnelRingCount = 6;
    const funnelCenterX = new Float32Array(funnelRingCount);
    const funnelCenterZ = new Float32Array(funnelRingCount);
    const funnelRadiusX = new Float32Array(funnelRingCount).fill(1);
    const funnelRadiusZ = new Float32Array(funnelRingCount).fill(1);
    const funnelTilt = new Float32Array(funnelRingCount);
    const funnelCompression = new Float32Array(funnelRingCount);
    const funnelStretch = new Float32Array(funnelRingCount);
    const funnelCenterVelocityX = new Float32Array(funnelRingCount);
    const funnelCenterVelocityZ = new Float32Array(funnelRingCount);
    const funnelRadiusVelocityX = new Float32Array(funnelRingCount);
    const funnelRadiusVelocityZ = new Float32Array(funnelRingCount);
    const funnelTiltVelocity = new Float32Array(funnelRingCount);
    const funnelCompressionVelocity = new Float32Array(funnelRingCount);
    const funnelStretchVelocity = new Float32Array(funnelRingCount);
    let creatureAccelerationX = 0;
    let creatureAccelerationY = 0;
    const moteStateX = new Float32Array(moteLimit);
    const moteStateY = new Float32Array(moteLimit);
    const moteVelocityX = new Float32Array(moteLimit);
    const moteVelocityY = new Float32Array(moteLimit);
    const moteDrag = new Float32Array(moteLimit);
    const moteAttachment = new Float32Array(moteLimit);
    const moteBrightness = new Float32Array(moteLimit);
    let motesInitialized = false;
    const trailHistoryX = new Float32Array(wakePointCount);
    const trailHistoryY = new Float32Array(wakePointCount);
    let trailInitialized = false;

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
      unifiedSpirit.visible = false;
      energyWakes.forEach((wake) => { wake.visible = false; });
      motes.visible = false;
    };

    const updateSpectrumLevels = (data: Uint8Array, deltaTime: number, playing: boolean) => {
      rhythmClock += deltaTime;
      let bassTotal = 0;
      let midTotal = 0;
      let trebleTotal = 0;
      let squaredEnergy = 0;
      let weightedEnergy = 0;
      let spectralEnergy = 0;
      let positiveFlux = 0;
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
        positiveFlux += Math.max(0, target - previousSpectrumLevels[index]);
        previousSpectrumLevels[index] = target;
        const rise = 1 - Math.exp(-deltaTime * (target > spectrumLevels[index] ? 18 : 5));
        spectrumLevels[index] += (target - spectrumLevels[index]) * rise;
        peakLevels[index] = Math.max(spectrumLevels[index], peakLevels[index] - (reducedMotion ? 0.02 : 0.008));
        squaredEnergy += spectrumLevels[index] * spectrumLevels[index];
        weightedEnergy += spectrumLevels[index] * index;
        spectralEnergy += spectrumLevels[index];
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
      rmsEnergy = Math.sqrt(squaredEnergy / spectrumBandCount);
      const rawFlux = positiveFlux / spectrumBandCount;
      spectralFlux += (rawFlux - spectralFlux) * (1 - Math.exp(-deltaTime * (rawFlux > spectralFlux ? 20 : 5)));
      spectralCentroid = spectralEnergy > 0.0001 ? weightedEnergy / spectralEnergy / (spectrumBandCount - 1) : 0;
      const energyDelta = Math.abs(overallEnergy - previousOverallEnergy);
      localVariance += (energyDelta - localVariance) * (1 - Math.exp(-deltaTime * (energyDelta > localVariance ? 18 : 2.4)));
      adaptiveVariancePeak = Math.max(localVariance, adaptiveVariancePeak * Math.exp(-deltaTime * 0.55), 0.0035);
      longTermEnergy += (overallEnergy - longTermEnergy) * (1 - Math.exp(-deltaTime * 0.32));
      shortTermPeak = Math.max(overallEnergy, shortTermPeak * Math.exp(-deltaTime * 0.8), 0.035);
      const varianceRatio = Math.min(1, localVariance / Math.max(0.004, adaptiveVariancePeak));
      const automaticGain = Math.min(2.8, Math.max(0.78, 0.19 / Math.max(0.055, longTermEnergy * 0.72 + shortTermPeak * 0.28)));
      const lifeSignal = (
        rmsEnergy * 0.31
        + bassEnergy * 0.2
        + midEnergy * 0.27
        + trebleEnergy * 0.09
        + varianceRatio * 0.08
        + Math.min(1, energyDelta * 8) * 0.05
      ) * automaticGain;
      const awakeTarget = playing ? 1 : 0;
      const awakeRate = awakeTarget > musicAwake ? 2.35 : 1.05;
      musicAwake += (awakeTarget - musicAwake) * (1 - Math.exp(-deltaTime * awakeRate));
      const lifeTarget = playing && overallEnergy > 0.002 ? Math.min(1, Math.max(0.2, lifeSignal + spectralFlux * automaticGain * 1.8)) : 0;
      const lifeRate = lifeTarget > lifeEnergy ? 3.1 : 1.35;
      lifeEnergy += (lifeTarget - lifeEnergy) * (1 - Math.exp(-deltaTime * lifeRate));
      const musicEnergyTarget = playing ? Math.min(1, lifeSignal + overallEnergy * automaticGain * 0.42) : 0;
      musicEnergy += (musicEnergyTarget - musicEnergy) * (1 - Math.exp(-deltaTime * (musicEnergyTarget > musicEnergy ? 3.8 : 1.05)));
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
      beatAccent = Math.max(beatAccent * Math.exp(-deltaTime * 7.2), Math.min(1, nextImpulse + spectralFlux * automaticGain * 2.4));
      const beatSignal = bassEnergy * 0.54 + rmsEnergy * 0.28 + Math.min(1, spectralFlux * automaticGain * 4.2) * 0.18;
      const baselineRate = beatSignal > beatBaseline ? 0.62 : 1.35;
      beatBaseline += (beatSignal - beatBaseline) * (1 - Math.exp(-deltaTime * baselineRate));
      const beatDistance = Math.abs(beatSignal - beatBaseline);
      beatDeviation += (beatDistance - beatDeviation) * (1 - Math.exp(-deltaTime * 1.8));
      const beatThreshold = beatBaseline + Math.max(0.018, beatDeviation * 1.55);
      const weakBeatThreshold = beatBaseline + Math.max(0.006, beatDeviation * 0.58);
      const beatRise = beatSignal - previousBeatSignal;
      const bassRise = bassEnergy - previousBassEnergy;
      const transientScore = Math.min(1, relativeRise * 2.6 + spectralFlux * automaticGain * 3.2 + variancePulse * 0.12);
      const timeSinceBeat = rhythmClock - lastMainBeatAt;
      const timingError = expectedBeatInterval > 0 ? Math.abs(timeSinceBeat - expectedBeatInterval) / expectedBeatInterval : 1;
      const timingConfidence = acceptedBeatCount >= 2
        ? 1 - smoothstep(0.16, 0.34, timingError)
        : 0;
      const localRiseEvidence = Math.min(1, Math.max(0, beatRise) / Math.max(0.006, beatDeviation * 0.42));
      const bassRiseEvidence = Math.min(1, Math.max(0, bassRise) / Math.max(0.008, beatDeviation * 0.55));
      const audioEvidence = Math.min(1, transientScore * 0.56 + localRiseEvidence * 0.25 + bassRiseEvidence * 0.19);
      const strongBeatCandidate = playing
        && musicAwake > 0.12
        && timeSinceBeat > 0.34
        && (beatSignal > beatThreshold || transientScore > 0.14)
        && (beatRise > Math.max(0.004, beatDeviation * 0.18) || transientScore > 0.24)
        && (acceptedBeatCount < 3 || timingError < 0.36 || transientScore > 0.34);
      const weakBeatCandidate = playing
        && musicAwake > 0.12
        && expectedBeatInterval > 0
        && timeSinceBeat > Math.max(0.32, expectedBeatInterval * 0.68)
        && timingConfidence > 0
        && beatSignal > weakBeatThreshold
        && audioEvidence > 0.11;
      if (strongBeatCandidate || weakBeatCandidate) {
        const baselineStrength = (beatSignal - beatThreshold) / Math.max(0.025, beatDeviation * 2.1);
        const beatConfidence = Math.min(1, audioEvidence * 0.72 + timingConfidence * 0.28);
        const detectedStrength = strongBeatCandidate
          ? Math.min(1, Math.max(0.48, baselineStrength, transientScore * 1.4))
          : Math.min(0.7, Math.max(0.3, 0.25 + beatConfidence * 0.46));
        if (lastMainBeatAt > 0 && timeSinceBeat >= 0.24 && timeSinceBeat <= 1.6) {
          recentBeatIntervals[acceptedBeatCursor] = timeSinceBeat;
          acceptedBeatCursor = (acceptedBeatCursor + 1) % recentBeatIntervals.length;
          acceptedBeatCount = Math.min(recentBeatIntervals.length, acceptedBeatCount + 1);
          expectedBeatInterval = medianBeatInterval(recentBeatIntervals, acceptedBeatCount, beatIntervalScratch);
        }
        rhythmStrength = 0.6 + detectedStrength * 0.58;
        acceptedBeatTotal += 1;
        rhythmPulse = 1;
        accentPulse = Math.max(accentPulse, strongBeatCandidate ? detectedStrength : detectedStrength * 0.34);
        lastMainBeatAt = rhythmClock;
        contractionPulse = Math.max(contractionPulse, detectedStrength);
        pendingVeilPulse = rhythmStrength;
        pendingVeilAt = rhythmClock + creatureGenome.veilDelay;
        pendingRibbonPulse = rhythmStrength;
        pendingRibbonAt = rhythmClock + creatureGenome.ribbonDelay;
        pendingMotePulse = rhythmStrength;
        pendingMoteAt = rhythmClock + creatureGenome.moteDelay;
      }
      previousBeatSignal = beatSignal;
      previousBassEnergy = bassEnergy;
      rhythmPulse *= Math.exp(-deltaTime * 13.5);
      accentPulse *= Math.exp(-deltaTime * 7.5);
      const grooveTarget = playing
        ? Math.min(1, musicEnergy * 0.38 + onsetPulse * 0.18 + rhythmImpulse * 0.18 + accentPulse * 0.34)
        : 0;
      grooveEnergy += (grooveTarget - grooveEnergy) * (1 - Math.exp(-deltaTime * (grooveTarget > grooveEnergy ? 5.2 : 1.35)));
      contractionPulse *= Math.exp(-deltaTime * 15);
      veilPulse *= Math.exp(-deltaTime * 4.6);
      ribbonPulse *= Math.exp(-deltaTime * 5.2);
      motePulse *= Math.exp(-deltaTime * 6.2);
      if (pendingVeilAt >= 0 && rhythmClock >= pendingVeilAt) {
        veilPulse = Math.max(veilPulse, pendingVeilPulse);
        pendingVeilPulse = 0;
        pendingVeilAt = -1;
      }
      if (pendingRibbonAt >= 0 && rhythmClock >= pendingRibbonAt) {
        ribbonPulse = Math.max(ribbonPulse, pendingRibbonPulse);
        pendingRibbonPulse = 0;
        pendingRibbonAt = -1;
      }
      if (pendingMoteAt >= 0 && rhythmClock >= pendingMoteAt) {
        motePulse = Math.max(motePulse, pendingMotePulse);
        pendingMotePulse = 0;
        pendingMoteAt = -1;
      }
      previousRelativeEnergy = normalizedPulse;
      previousOverallEnergy = overallEnergy;
    };

    const writeOrganicPoint = (positions: Float32Array, index: number, x: number, y: number) => {
      positions[index * 3] = x;
      positions[index * 3 + 1] = y;
      positions[index * 3 + 2] = 0;
    };

    const nextLifeRandom = () => {
      lifeRandomState = (Math.imul(lifeRandomState, 1664525) + 1013904223) >>> 0;
      return lifeRandomState / 4294967296;
    };

    const selectLifeState = (time: number, horizontalLimit: number, verticalLimit: number) => {
      const choice = nextLifeRandom();
      lifeState = choice < 0.24 ? 'drift' : choice < 0.78 ? 'cruise' : 'glide';
      const reach = lifeState === 'drift' ? 0.42 : lifeState === 'cruise' ? 0.92 : 0.68;
      const minimumDistance = lifeState === 'drift' ? 0.14 : lifeState === 'cruise' ? 0.3 : 0.22;
      let candidateX = creatureX;
      let candidateY = creatureY;
      let candidateDistance = 0;
      for (let attempt = 0; attempt < 5 && candidateDistance < minimumDistance; attempt += 1) {
        candidateX = THREE.MathUtils.clamp(
          creatureX + (nextLifeRandom() * 2 - 1) * horizontalLimit * reach,
          -horizontalLimit * 0.88,
          horizontalLimit * 0.88,
        );
        candidateY = THREE.MathUtils.clamp(
          creatureY + (nextLifeRandom() * 2 - 1) * verticalLimit * reach,
          -verticalLimit * 0.84,
          verticalLimit * 0.84,
        );
        candidateDistance = Math.hypot(candidateX - creatureX, candidateY - creatureY);
      }
      if (candidateDistance < minimumDistance) {
        const angle = nextLifeRandom() * Math.PI * 2;
        candidateX = THREE.MathUtils.clamp(creatureX + Math.cos(angle) * minimumDistance, -horizontalLimit * 0.88, horizontalLimit * 0.88);
        candidateY = THREE.MathUtils.clamp(creatureY + Math.sin(angle) * minimumDistance, -verticalLimit * 0.84, verticalLimit * 0.84);
      }
      lifeTargetX = candidateX;
      lifeTargetY = candidateY;
      const duration = lifeState === 'drift'
        ? 4.5 + nextLifeRandom() * 4.2
        : lifeState === 'cruise'
          ? 5.2 + nextLifeRandom() * 5.4
          : 2.4 + nextLifeRandom() * 2.8;
      lifeStateUntil = time + duration;
    };

    const updateSpiritPhysics = (time: number, deltaTime: number, current: WaveCanvasProps) => {
      const motionScale = reducedMotion ? 0.24 : 1;
      const scale = current.creatureScale ?? 1;
      startlePulse *= Math.exp(-deltaTime * 5.6);
      contactPulse *= Math.exp(-deltaTime * 3.8);
      contactAge += deltaTime;
      heartStartlePulse *= Math.exp(-deltaTime * 4.6);
      wingContactPulse[0] *= Math.exp(-deltaTime * 3.5);
      wingContactPulse[1] *= Math.exp(-deltaTime * 3.5);
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

      if (lifeDebug) {
        if (lifeState !== lifeDebug || time >= lifeStateUntil) {
          lifeState = lifeDebug;
          lifeTargetX = lifeDebug === 'curious' ? horizontalLimit * 0.28 : -horizontalLimit * 0.38;
          lifeTargetY = lifeDebug === 'glide' ? verticalLimit * 0.24 : -verticalLimit * 0.18;
          lifeStateUntil = time + 60;
        }
      } else if (time >= lifeStateUntil && time >= repulsorEscapeUntil && time >= releaseLookUntil) {
        selectLifeState(time, horizontalLimit, verticalLimit);
      }

      const targetDeltaX = lifeTargetX - creatureX;
      const targetDeltaY = lifeTargetY - creatureY;
      const targetDistance = Math.max(0.001, Math.hypot(targetDeltaX, targetDeltaY));
      const arrival = 0.22 + smoothstep(0.025, 0.42, targetDistance) * 0.78;
      const stateSpeed = lifeState === 'drift'
        ? 0.026
        : lifeState === 'cruise'
          ? 0.078
          : lifeState === 'glide'
            ? 0.05
            : lifeState === 'curious' ? 0.042 : 0.16;
      const musicMotion = current.musicPlaying ? overallEnergy * 0.032 + rhythmImpulse * 0.018 : 0;
      const desiredSpeed = (stateSpeed + musicMotion) * arrival * motionScale;
      let desiredVelocityX = targetDeltaX / targetDistance * desiredSpeed;
      let desiredVelocityY = targetDeltaY / targetDistance * desiredSpeed;
      if (lifeState === 'glide') {
        desiredVelocityX = creatureVelocityX * 0.985 + desiredVelocityX * 0.015;
        desiredVelocityY = creatureVelocityY * 0.985 + desiredVelocityY * 0.015;
      }
      const steering = lifeState === 'drift' ? 0.48 : lifeState === 'glide' ? 0.22 : 0.72;
      let accelerationX = (desiredVelocityX - creatureVelocityX) * steering;
      let accelerationY = (desiredVelocityY - creatureVelocityY) * steering;
      const insideEdgeZone = Math.abs(creatureX) > horizontalLimit || Math.abs(creatureY) > verticalLimit;

      let nearestThreat = 0;
      let repulsorAwayX = 0;
      let repulsorAwayY = 0;
      let curiousTarget = 0;
      const activeRepulsors = interactionDebugOff ? noRepulsors : current.repulsorsRef?.current ?? current.repulsors ?? noRepulsors;
      const gestureForces = interactionDebugOff ? undefined : current.gestureForcesRef?.current;
      const gestureRepulsor = gestureForces?.displacement?.active ? gestureForces.displacement : undefined;
      const repulsorCount = activeRepulsors.length + (gestureRepulsor ? 1 : 0);
      for (let repulsorIndex = 0; repulsorIndex < repulsorCount; repulsorIndex += 1) {
        const repulsor = repulsorIndex < activeRepulsors.length ? activeRepulsors[repulsorIndex] : gestureRepulsor!;
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
        const surfaceDistance = Math.max(0, distance - collisionRadius);
        const influence = repulsor.type === 'ripple'
          ? computeWavefrontInfluence(surfaceDistance, radius, Math.max(0.06, repulsor.radius))
          : Math.max(0, 1 - distance / Math.max(0.06, radius));
        const awareness = repulsor.type === 'ripple' ? 0 : Math.max(0, 1 - distance / Math.max(0.12, collisionRadius + 0.42));
        if (influence <= 0 && awareness <= 0) continue;
        const isNewRepulsorUpdate = repulsor.updatedAt !== undefined && repulsor.updatedAt !== lastRepulsorUpdate;
        const swipeSpeed = Math.hypot(repulsor.velocityX ?? 0, repulsor.velocityY ?? 0);
        const fastApproach = repulsor.type === 'ripple' || (swipeSpeed > 0.72 && awareness > 0.12);
        const directContact = Boolean(repulsor.contact) && distance < collisionRadius + 0.045;
        interactionX = repulsorX;
        interactionY = repulsorY;

        curiousTarget = Math.max(curiousTarget, awareness);

        if (isNewRepulsorUpdate && directContact) {
          const spiritScale = 0.37 * scale;
          const localX = (repulsorX - creatureX) / Math.max(0.001, spiritScale * Math.min(1, canvasHeight / canvasWidth));
          const localY = (repulsorY - creatureY) / Math.max(0.001, spiritScale);
          contactPointX = localX;
          contactPointY = localY;
          contactPulse = 1;
          contactAge = 0;
          if (localY > 0.34 && localY < 0.73 && Math.abs(localX) < 0.17) {
            contactKind = 3;
            heartStartlePulse = 1;
          } else if (localY > 0.16 && Math.abs(localX) > 0.16) {
            contactKind = 1;
            const sideIndex = localX < 0 ? 0 : 1;
            wingContactPulse[sideIndex] = 1;
            wingContactSpan[sideIndex] = THREE.MathUtils.clamp((Math.abs(localX) - 0.12) / 0.62, 0, 1);
          } else {
            contactKind = 2;
            contactFunnelRing = THREE.MathUtils.clamp(Math.round((0.35 - localY) / 1.08 * (funnelRingCount - 1)), 0, funnelRingCount - 1);
            contactFunnelDirection = localX < 0 ? 1 : -1;
          }
        }

        const avoidance = Math.max(influence, awareness * (directContact ? 1.12 : fastApproach ? 0.92 : 0.56));
        if (avoidance > 0) {
          const responseStrength = directContact ? 1.45 : fastApproach ? 1.18 : 0.48;
          const force = avoidance * Math.max(responseStrength, repulsor.strength) * creatureGenome.avoidanceSensitivity;
          repulsorAwayX += awayX * force;
          repulsorAwayY += awayY * force;
          nearestThreat = Math.max(nearestThreat, avoidance);
        }

        if (isNewRepulsorUpdate && (fastApproach || directContact)) {
          const impulse = Math.max(influence, awareness) * (directContact ? 0.065 : 0.04 + Math.min(0.18, swipeSpeed * 0.05));
          const safeAwayX = awayX + inwardX * Math.max(horizontalEdge, verticalEdge) * 0.9;
          const safeAwayY = awayY + inwardY * Math.max(horizontalEdge, verticalEdge) * 0.9;
          const safeLength = Math.max(0.001, Math.hypot(safeAwayX, safeAwayY));
          creatureVelocityX += safeAwayX / safeLength * impulse;
          creatureVelocityY += safeAwayY / safeLength * impulse;
          repulsorEscapeX = safeAwayX / safeLength;
          repulsorEscapeY = safeAwayY / safeLength;
          repulsorEscapeUntil = time + creatureGenome.repulsorCommitment;
          lifeState = 'startled';
          lifeStateUntil = repulsorEscapeUntil;
          startlePulse = Math.max(startlePulse, Math.min(1, awareness * (directContact ? 0.82 : 0.64) + swipeSpeed * 0.26));
          lastRepulsorUpdate = repulsor.updatedAt ?? lastRepulsorUpdate;
        } else if (isNewRepulsorUpdate) {
          lastRepulsorUpdate = repulsor.updatedAt ?? lastRepulsorUpdate;
        }
      }

      const attraction = gestureForces?.attraction;
      if (attraction?.active && nearestThreat < 0.2) {
        const targetX = attraction.x * 1.8 - 0.9;
        const targetY = (1 - attraction.y) * 1.34 - 0.67;
        const towardX = targetX - creatureX;
        const towardY = targetY - creatureY;
        const attractionSteering = computeAttractionSteering(
          towardX,
          towardY,
          attraction.strength,
          time,
          creatureGenome.wanderPhase,
        );
        accelerationX += attractionSteering.accelerationX;
        accelerationY += attractionSteering.accelerationY;
        curiousTarget = Math.max(curiousTarget, attractionSteering.curiosity);
        interactionX = targetX;
        interactionY = targetY;
      }

      curiousResponse += (curiousTarget - curiousResponse) * (1 - Math.exp(-deltaTime * (curiousTarget > curiousResponse ? 5.2 : 1.45)));
      if (nearestThreat > 0) {
        repulsorAwayX += inwardX * Math.max(horizontalEdge, verticalEdge) * 2.2;
        repulsorAwayY += inwardY * Math.max(horizontalEdge, verticalEdge) * 2.2;
        const awayLength = Math.max(0.001, Math.hypot(repulsorAwayX, repulsorAwayY));
        const awayX = repulsorAwayX / awayLength;
        const awayY = repulsorAwayY / awayLength;
        const escapeSpeed = (0.052 + nearestThreat * 0.2 + startlePulse * 0.1) * motionScale;
        accelerationX = (awayX * escapeSpeed - creatureVelocityX) * (2.8 + nearestThreat * 2.1);
        accelerationY = (awayY * escapeSpeed - creatureVelocityY) * (2.8 + nearestThreat * 2.1);
        repulsorEscapeX = awayX;
        repulsorEscapeY = awayY;
      } else if (time < repulsorEscapeUntil) {
        accelerationX = (repulsorEscapeX * 0.11 * motionScale - creatureVelocityX) * 2.4;
        accelerationY = (repulsorEscapeY * 0.11 * motionScale - creatureVelocityY) * 2.4;
      } else if (curiousResponse > 0.06) {
        lifeState = 'curious';
        lifeStateUntil = time + 0.8;
        releaseLookUntil = time + 1.4;
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
      } else if (time < releaseLookUntil) {
        accelerationX += (repulsorEscapeX * 0.045 * motionScale - creatureVelocityX) * 0.34;
        accelerationY += (repulsorEscapeY * 0.045 * motionScale - creatureVelocityY) * 0.34;
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
      const maxSpeed = (0.13 + overallEnergy * 0.07 + threatResponse * 0.18 + startlePulse * 0.14 + (time < escapeUntil ? 0.06 : 0)) * motionScale;
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
        creatureHeading += turn * Math.min(1, deltaTime * (2.1 + midEnergy * 1.8 + startlePulse * 2.4));
      }
      if (anchorDebug) {
        creatureX = 0;
        creatureY = 0;
        creatureVelocityX = 0;
        creatureVelocityY = 0;
      }
      creatureAccelerationX = accelerationX;
      creatureAccelerationY = accelerationY;
      const telemetryTick = Math.floor(time * 4);
      if (localPreview && telemetryTick !== lastDebugTelemetryTick) {
        lastDebugTelemetryTick = telemetryTick;
        mount.dataset.spiritLife = lifeState;
        mount.dataset.spiritCurious = curiousResponse.toFixed(2);
        mount.dataset.spiritContact = contactKind === 1 ? 'wing' : contactKind === 2 ? 'body' : contactKind === 3 ? 'heart' : 'none';
        mount.dataset.spiritStartled = startlePulse.toFixed(2);
        mount.dataset.spiritX = creatureX.toFixed(3);
        mount.dataset.spiritY = creatureY.toFixed(3);
      }
    };


    const drawUnifiedSpirit = (time: number, deltaTime: number, current: WaveCanvasProps) => {
      const viewportAspect = Math.min(1, canvasHeight / canvasWidth);
      const scale = current.creatureScale ?? 1;
      const motionScale = reducedMotion ? 0.32 : 1;
      const speed = Math.hypot(creatureVelocityX, creatureVelocityY);
      const movementHeading = speed > 0.002 ? Math.atan2(creatureVelocityY, creatureVelocityX) : creatureHeading;
      const turnDelta = Math.atan2(Math.sin(movementHeading - creatureGenome.orientation), Math.cos(movementHeading - creatureGenome.orientation));
      const beatAge = rhythmClock - lastMainBeatAt;
      const heartRelease = expectedBeatInterval > 0
        ? THREE.MathUtils.clamp(expectedBeatInterval * 0.48, 0.19, 0.31)
        : 0.3;
      const rootBeatPulse = sampleHeartEnvelope(beatAge - 0.045, heartRelease * 0.8) * rhythmStrength;
      const veinBeatPulse = sampleHeartEnvelope(beatAge - 0.09, heartRelease * 0.86) * rhythmStrength;
      const rimBeatPulse = sampleHeartEnvelope(beatAge - 0.145, heartRelease * 0.75) * rhythmStrength;
      const funnelBeatPulse = sampleHeartEnvelope(beatAge - 0.075, heartRelease) * rhythmStrength;
      const idleLife = 0.1 + curiousResponse * 0.08 + startlePulse * 0.14;
      const vitality = idleLife + 0.06 + musicAwake * (0.09 + musicEnergy * 0.18 + grooveEnergy * 0.32) + accentPulse * 0.16;
      const autonomousStrokeRate = lifeState === 'drift'
        ? 0.11
        : lifeState === 'cruise'
          ? 0.21
          : lifeState === 'glide'
            ? 0.055
            : lifeState === 'curious' ? 0.068 : 0.29;
      const autonomousStrokePower = lifeState === 'drift'
        ? 0.38
        : lifeState === 'cruise'
          ? 0.85
          : lifeState === 'glide'
            ? 0.18
            : lifeState === 'curious' ? 0.2 : 0.92;
      const musicStrokeRate = Math.min(0.42, 0.19 + grooveEnergy * 0.18 + musicEnergy * 0.06);
      const musicStrokePower = 0.36 + grooveEnergy * 0.34 + bassEnergy * 0.18 + accentPulse * 0.08;
      const strokeRate = THREE.MathUtils.lerp(autonomousStrokeRate, musicStrokeRate, musicAwake);
      const strokePower = THREE.MathUtils.lerp(autonomousStrokePower, musicStrokePower, musicAwake);
      const membraneTension = 0.28 + midEnergy * 0.2 + grooveEnergy * 0.22 + rootBeatPulse * 0.18;
      const energyFlow = 0.08 + musicAwake * (0.035 + musicEnergy * 0.08 + grooveEnergy * 0.08) + veinBeatPulse * 0.46;
      const rimActivity = 0.08 + musicAwake * (0.025 + trebleEnergy * 0.08 + grooveEnergy * 0.07) + rimBeatPulse * 0.58;
      const debugPhase = spiritDebug === 'power' || spiritDebug === 'funnel-power'
        ? 0.54
        : spiritDebug === 'glide' || spiritDebug === 'funnel-glide' ? 0.76 : 0.1;
      wingCycle = (wingCycle + deltaTime * strokeRate) % 1;
      const cycle = spiritDebug ? debugPhase : wingCycle;
      const phasePower = spiritDebug === 'power' || spiritDebug === 'funnel-power'
        ? 0.82
        : spiritDebug === 'glide' || spiritDebug === 'funnel-glide' ? 0.24 : strokePower;
      const actionStrength = spiritDebug ? 1 : 0.72 + musicAwake * 0.28;

      for (let sideIndex = 0; sideIndex < 2; sideIndex += 1) {
        const sidePhase = sideIndex === 0 ? -0.014 : 0.014;
        for (let zone = 0; zone < 5; zone += 1) {
          const zoneProgress = zone / 4;
          const delayedCycle = (cycle - zoneProgress * 0.112 + sidePhase + 1) % 1;
          const phaseStroke = sampleSwimmingCycle(delayedCycle);
          const idleUndulation = Math.sin(time * 0.24 - zoneProgress * 1.55 + sidePhase * 6) * (0.006 + zoneProgress * 0.022);
          const zoneAmplitude = 0.72 + zone * 0.135;
          const rootStability = 0.08 + Math.pow(zoneProgress, 0.72) * 0.92;
          const membraneDrag = (-creatureAccelerationY * 0.08 - creatureAccelerationX * (sideIndex === 0 ? -0.035 : 0.035)) * zoneProgress;
          const contactDistance = Math.abs(zoneProgress - wingContactSpan[sideIndex]);
          const localContact = wingContactPulse[sideIndex] * Math.max(0, 1 - contactDistance * 3.2) * (0.035 + zoneProgress * 0.055);
          const target = spiritDebug === 'neutral' || spiritDebug === 'closeup' || spiritDebug === 'funnel-neutral'
            ? 0
            : phaseStroke * phasePower * actionStrength * rootStability * zoneAmplitude
              + idleUndulation * (1 - musicAwake * 0.58)
              + turnDelta * (sideIndex === 0 ? -0.014 : 0.014) * zoneProgress
              + membraneDrag
              - localContact;
          const stiffness = 24 - zone * 4.45;
          const damping = 10 - zone * 1.22;
          wingVelocity[sideIndex][zone] += (target - wingSpring[sideIndex][zone]) * stiffness * deltaTime;
          wingVelocity[sideIndex][zone] *= Math.exp(-damping * deltaTime);
          wingSpring[sideIndex][zone] += wingVelocity[sideIndex][zone] * deltaTime;
        }
      }

      const rootStroke = (wingSpring[0][0] + wingSpring[1][0]) * 0.5;
      const waterResistance = THREE.MathUtils.clamp(turnDelta, -1, 1) * Math.min(1, speed * 10.5) * 0.072;
      const softbodyRest = spiritDebug === 'softbody' && softbodyDebug !== 'active';
      const softbodyActive = spiritDebug === 'softbody' && softbodyDebug === 'active';
      const funnelPower = spiritDebug === 'funnel-power';
      const funnelGlide = spiritDebug === 'funnel-glide';
      const propulsion = rootStroke * 0.24 * motionScale;
      const dragX = -creatureVelocityX * 2.25 - creatureAccelerationX * 0.92 + waterResistance * 2.6 + propulsion * 0.46;
      const dragZ = -creatureVelocityY * 0.56 - creatureAccelerationY * 0.29 + Math.abs(turnDelta) * speed * 0.3;
      for (let ring = 0; ring < funnelRingCount; ring += 1) {
        const progress = ring / (funnelRingCount - 1);
        const previousX = ring === 0 ? 0 : funnelCenterX[ring - 1];
        const previousZ = ring === 0 ? 0 : funnelCenterZ[ring - 1];
        const tissueInfluence = progress * progress * (3 - 2 * progress);
        let targetX = THREE.MathUtils.clamp(previousX + dragX * (0.045 + tissueInfluence * 0.34), -0.145, 0.145);
        let targetZ = THREE.MathUtils.clamp(previousZ + dragZ * (0.035 + tissueInfluence * 0.23), -0.09, 0.09);
        if (softbodyRest || spiritDebug === 'funnel-neutral') {
          targetX = 0;
          targetZ = 0;
        } else if (softbodyActive) {
          targetX = softbodyActiveX[ring];
          targetZ = softbodyActiveZ[ring];
        } else if (funnelPower) {
          targetX = funnelPowerX[ring];
          targetZ = funnelPowerZ[ring];
        } else if (funnelGlide) {
          targetX = funnelGlideX[ring];
          targetZ = funnelGlideZ[ring];
        }
        if (contactKind === 2 && contactPulse > 0.01) {
          const rippleRing = Math.min(funnelRingCount - 1, contactFunnelRing + contactAge * 2.1);
          const contactFalloff = Math.max(0, 1 - Math.abs(ring - rippleRing) * 0.58);
          targetX += contactFunnelDirection * contactPulse * contactFalloff * 0.022;
          targetZ += contactPulse * contactFalloff * 0.006;
        }
        const centerStiffness = funnelCenterStiffness[ring];
        const centerDamping = funnelCenterDamping[ring];
        funnelCenterVelocityX[ring] += (targetX - funnelCenterX[ring]) * centerStiffness * deltaTime;
        funnelCenterVelocityZ[ring] += (targetZ - funnelCenterZ[ring]) * centerStiffness * deltaTime;
        const centerDrag = Math.exp(-centerDamping * deltaTime);
        funnelCenterVelocityX[ring] *= centerDrag;
        funnelCenterVelocityZ[ring] *= centerDrag;
        funnelCenterX[ring] += funnelCenterVelocityX[ring] * deltaTime;
        funnelCenterZ[ring] += funnelCenterVelocityZ[ring] * deltaTime;

        const localBend = Math.abs(targetX - previousX) + Math.abs(targetZ - previousZ);
        let targetCompression = THREE.MathUtils.clamp(
          Math.abs(propulsion) * (0.72 + progress * 1.2)
            + localBend * (2.5 + progress * 2.1)
            + Math.abs(creatureAccelerationX) * tissueInfluence * 0.5,
          0,
          0.19,
        );
        let targetStretch = THREE.MathUtils.clamp(
          (speed * 0.42 + localBend * 2.25 + Math.abs(creatureAccelerationY) * 0.28) * tissueInfluence,
          0,
          0.13,
        );
        if (softbodyRest || spiritDebug === 'funnel-neutral') {
          targetCompression = 0;
          targetStretch = 0;
        } else if (softbodyActive) {
          targetCompression = softbodyActiveCompression[ring];
          targetStretch = softbodyActiveStretch[ring];
        }
        if (contactKind === 2 && contactPulse > 0.01) {
          const rippleRing = Math.min(funnelRingCount - 1, contactFunnelRing + contactAge * 2.1);
          const contactFalloff = Math.max(0, 1 - Math.abs(ring - rippleRing) * 0.58);
          targetCompression += contactPulse * contactFalloff * 0.026;
        }
        const tissueStiffness = 58 - ring * 5.8;
        const tissueDamping = 14.8 - ring * 0.72;
        funnelCompressionVelocity[ring] += (targetCompression - funnelCompression[ring]) * tissueStiffness * deltaTime;
        funnelStretchVelocity[ring] += (targetStretch - funnelStretch[ring]) * tissueStiffness * deltaTime;
        const tissueDrag = Math.exp(-tissueDamping * deltaTime);
        funnelCompressionVelocity[ring] *= tissueDrag;
        funnelStretchVelocity[ring] *= tissueDrag;
        funnelCompression[ring] += funnelCompressionVelocity[ring] * deltaTime;
        funnelStretch[ring] += funnelStretchVelocity[ring] * deltaTime;

        const targetRadiusX = 1 + funnelCompression[ring] * (1.1 + progress * 0.55) - funnelStretch[ring] * 0.28;
        const targetRadiusZ = 1 - funnelCompression[ring] * (0.58 + progress * 0.24) + funnelStretch[ring] * 0.14;
        const radiusStiffness = 58 - ring * 6.4;
        const radiusDamping = 14.5 - ring * 0.7;
        funnelRadiusVelocityX[ring] += (targetRadiusX - funnelRadiusX[ring]) * radiusStiffness * deltaTime;
        funnelRadiusVelocityZ[ring] += (targetRadiusZ - funnelRadiusZ[ring]) * radiusStiffness * deltaTime;
        const radiusDrag = Math.exp(-radiusDamping * deltaTime);
        funnelRadiusVelocityX[ring] *= radiusDrag;
        funnelRadiusVelocityZ[ring] *= radiusDrag;
        funnelRadiusX[ring] += funnelRadiusVelocityX[ring] * deltaTime;
        funnelRadiusZ[ring] += funnelRadiusVelocityZ[ring] * deltaTime;

        let targetTilt = THREE.MathUtils.clamp((targetX - previousX) * (3.2 + progress * 2.4) - creatureAccelerationX * progress * 0.7, -0.28, 0.28);
        if (softbodyRest || spiritDebug === 'funnel-neutral') targetTilt = 0;
        if (softbodyActive) targetTilt = softbodyActiveTilt[ring];
        funnelTiltVelocity[ring] += (targetTilt - funnelTilt[ring]) * (54 - ring * 6.2) * deltaTime;
        funnelTiltVelocity[ring] *= Math.exp(-(14.5 - ring * 0.74) * deltaTime);
        funnelTilt[ring] += funnelTiltVelocity[ring] * deltaTime;
      }
      unifiedSpirit.visible = true;
      unifiedSpirit.position.set(spiritDebug ? 0 : creatureX, spiritDebug ? -0.03 : creatureY, 0);
      unifiedSpirit.rotation.z = spiritDebug || previewPass ? 0 : THREE.MathUtils.clamp(turnDelta * (0.014 + musicAwake * 0.011), -0.035, 0.035);
      const debugScale = spiritDebug === 'closeup'
        ? 0.9
        : spiritDebug === 'power' || spiritDebug === 'glide' || spiritDebug === 'funnel-power' || spiritDebug === 'funnel-glide' || spiritDebug === 'softbody'
          ? 0.72
          : spiritDebug ? 0.47 : 0.37;
      unifiedSpirit.scale.set(debugScale * viewportAspect * scale, debugScale * scale, 1);
      spiritRig.surfaces.forEach(({ mesh, finalMaterial, geometryMaterial }) => {
        mesh.material = previewPass === 'A' ? geometryMaterial : finalMaterial;
        const kind = finalMaterial.uniforms.uKind.value as number;
        mesh.visible = spiritDebug === 'softbody'
          ? kind < 0.5
          : spiritLayer === null || (spiritLayer === 'body' && kind < 0.5);
      });
      spiritRig.finalMaterials.forEach((material) => {
        material.uniforms.uTime.value = time;
        material.uniforms.uLife.value = previewPass === 'B' || spiritLayer === 'body' ? 0 : Math.max(lifeEnergy, idleLife);
        material.uniforms.uMusicAwake.value = previewPass === 'B' ? 0 : musicAwake;
        material.uniforms.uBass.value = bassEnergy;
        material.uniforms.uMid.value = midEnergy;
        material.uniforms.uTreble.value = trebleEnergy;
        for (let ring = 0; ring < funnelRingCount; ring += 1) {
          material.uniforms[funnelRingUniformNames[ring]].value.set(
            funnelCenterX[ring],
            funnelCenterZ[ring],
            funnelRadiusX[ring],
            funnelRadiusZ[ring],
          );
          material.uniforms[funnelTiltUniformNames[ring]].value = funnelTilt[ring];
        }
        material.uniforms.uMembraneTension.value = membraneTension;
        material.uniforms.uEnergyFlow.value = energyFlow;
        material.uniforms.uRimActivity.value = rimActivity;
        material.uniforms.uCycle.value = cycle;
        material.uniforms.uHeartBeat.value = 0;
        material.uniforms.uBeatAge.value = beatAge;
        material.uniforms.uBeatStrength.value = spiritLayer === 'body' ? 0 : rhythmStrength;
        material.uniforms.uRhythmPulse.value = spiritLayer === 'body' ? 0 : rhythmPulse * rhythmStrength;
        material.uniforms.uRootPulse.value = spiritLayer === 'body' ? 0 : rootBeatPulse;
        material.uniforms.uVeinPulse.value = spiritLayer === 'body' ? 0 : veinBeatPulse;
        material.uniforms.uRimPulse.value = spiritLayer === 'body' ? 0 : rimBeatPulse;
        material.uniforms.uFunnelPulse.value = spiritLayer === 'body' ? 0 : funnelBeatPulse;
        material.uniforms.uContactPoint.value.set(contactPointX, contactPointY);
        material.uniforms.uContactPulse.value = contactPulse;
        material.uniforms.uContactAge.value = contactAge;
        material.uniforms.uContactKind.value = contactKind;
      });
      const wingMotion = previewPass || spiritDebug === 'neutral' || spiritDebug === 'closeup' ? 0 : 1;
      spiritRig.leftWing.userData.materials.forEach((material: THREE.ShaderMaterial) => {
        material.uniforms.uWingA.value.set(wingSpring[0][0], wingSpring[0][1], wingSpring[0][2]).multiplyScalar(wingMotion);
        material.uniforms.uWingB.value.set(wingSpring[0][3], wingSpring[0][4]).multiplyScalar(wingMotion);
      });
      spiritRig.rightWing.userData.materials.forEach((material: THREE.ShaderMaterial) => {
        material.uniforms.uWingA.value.set(wingSpring[1][0], wingSpring[1][1], wingSpring[1][2]).multiplyScalar(wingMotion);
        material.uniforms.uWingB.value.set(wingSpring[1][3], wingSpring[1][4]).multiplyScalar(wingMotion);
      });

      spiritRig.heartLobes.forEach((lobe, index) => {
        lobe.visible = spiritLayer !== 'body';
        const idlePhase = (time * 0.3 + index * 0.075) % 1;
        const idleBeat = Math.exp(-Math.pow((idlePhase - 0.18) / 0.1, 2)) * (0.052 + curiousResponse * 0.018);
        const lobeAge = beatAge - heartLobeDelays[index];
        const audioBeat = sampleHeartEnvelope(lobeAge, heartRelease) * rhythmStrength;
        const rebound = sampleHeartEnvelope(lobeAge - 0.1, heartRelease * 0.64) * rhythmStrength;
        const visibleBeat = THREE.MathUtils.lerp(idleBeat, audioBeat, musicAwake) + heartStartlePulse * 0.24;
        const phenotypePulse = (lobe.userData.pulseStrength as number | undefined) ?? 1;
        const beat = 1 - visibleBeat * 0.31 * phenotypePulse + rebound * musicAwake * 0.17 * phenotypePulse;
        lobe.scale.copy(lobe.userData.baseScale).multiplyScalar(beat);
        lobe.rotation.z = Math.sin(time * 0.2 + index * 1.31) * 0.038;
        (lobe.material as THREE.ShaderMaterial).uniforms.uHeartBeat.value = Math.min(1.35, visibleBeat * 1.16);
      });
      const visualTelemetryTick = Math.floor(time * 12);
      if (localPreview && visualTelemetryTick !== lastVisualTelemetryTick) {
        lastVisualTelemetryTick = visualTelemetryTick;
        const horizontalPixelsPerUnit = canvasWidth * 0.5 * debugScale * viewportAspect * scale;
        mount.dataset.spiritFunnelMidPx = (Math.abs(funnelCenterX[2]) * horizontalPixelsPerUnit).toFixed(2);
        mount.dataset.spiritFunnelLowerPx = (Math.abs(funnelCenterX[4]) * horizontalPixelsPerUnit).toFixed(2);
        mount.dataset.spiritFunnelTipPx = (Math.abs(funnelCenterX[5]) * horizontalPixelsPerUnit).toFixed(2);
        mount.dataset.spiritHeart = (sampleHeartEnvelope(beatAge, heartRelease) * rhythmStrength).toFixed(2);
        mount.dataset.spiritBeatStrength = rhythmStrength.toFixed(2);
        mount.dataset.spiritBeatTotal = String(acceptedBeatTotal);
        mount.dataset.spiritBeatAge = beatAge.toFixed(3);
      }
      spiritRig.energyMaterials.forEach((material, index) => {
        const propagation = sampleHeartEnvelope(beatAge - 0.055 - index * 0.048, heartRelease * 0.82) * rhythmStrength;
        const phenotypeEnergy = (material.userData.opacityFactor as number | undefined) ?? 1;
        material.opacity = (spiritLayer !== null
          ? 0
          : previewPass === 'A'
          ? 0.58
          : 0.035 + Math.max(lifeEnergy, idleLife) * 0.025 + propagation * 0.86 + rhythmImpulse * 0.01 + contactPulse * 0.035) * phenotypeEnergy;
      });

      const funnelTipX = (spiritDebug ? 0 : creatureX) + funnelCenterX[funnelRingCount - 1] * debugScale * scale * viewportAspect;
      const funnelTipY = (spiritDebug ? -0.03 : creatureY) - 0.72 * debugScale * scale;
      if (!trailInitialized) {
        for (let index = 0; index < wakePointCount; index += 1) {
          trailHistoryX[index] = funnelTipX + (spiritLayer === 'filaments' ? Math.sin(index * 0.38) * index * 0.0007 : 0);
          trailHistoryY[index] = funnelTipY - (spiritLayer === 'filaments' ? index * 0.006 : 0);
        }
        trailInitialized = true;
      }
      trailHistoryX[0] += (funnelTipX - trailHistoryX[0]) * 0.64;
      trailHistoryY[0] += (funnelTipY - trailHistoryY[0]) * 0.64;
      for (let index = 1; index < wakePointCount; index += 1) {
        const follow = 0.26 - index / wakePointCount * 0.1;
        trailHistoryX[index] += (trailHistoryX[index - 1] - trailHistoryX[index]) * follow;
        trailHistoryY[index] += (trailHistoryY[index - 1] - trailHistoryY[index]) * follow;
      }

      const atmosphereVisible = previewPass === null && spiritDebug === null && spiritLayer === null;
      const filamentDebugVisible = spiritLayer === 'filaments';
      for (let ribbonIndex = 0; ribbonIndex < wakeRibbonCount; ribbonIndex += 1) {
        const positions = wakePositions[ribbonIndex];
        const colors = wakeColors[ribbonIndex];
        for (let index = 0; index < wakePointCount; index += 1) {
          const progress = index / (wakePointCount - 1);
          const previous = Math.max(0, index - 1);
          const next = Math.min(wakePointCount - 1, index + 1);
          const tangentX = trailHistoryX[next] - trailHistoryX[previous];
          const tangentY = trailHistoryY[next] - trailHistoryY[previous];
          const tangentLength = Math.max(0.0001, Math.hypot(tangentX, tangentY));
          const normalX = -tangentY / tangentLength;
          const normalY = tangentX / tangentLength;
          const sideDrift = (ribbonIndex - 0.5) * (0.004 + progress * 0.007) + Math.sin(time * 0.36 - progress * 4 + ribbonIndex * 2.3) * progress * 0.002;
          const centerX = filamentDebugVisible
            ? funnelTipX + Math.sin(progress * Math.PI * 1.4 + ribbonIndex) * progress * 0.012
            : trailHistoryX[index] + normalX * sideDrift;
          const centerY = filamentDebugVisible
            ? funnelTipY - progress * 0.18
            : trailHistoryY[index] + normalY * sideDrift;
          const fade = Math.pow(1 - progress, 1.7);
          const width = (0.004 + musicEnergy * 0.005) * fade;
          const offset = index * 6;
          positions[offset] = centerX + normalX * width;
          positions[offset + 1] = centerY + normalY * width;
          positions[offset + 2] = -0.12 + ribbonIndex * 0.01;
          positions[offset + 3] = centerX - normalX * width;
          positions[offset + 4] = centerY - normalY * width;
          positions[offset + 5] = -0.12 + ribbonIndex * 0.01;
          const intensity = filamentDebugVisible
            ? fade * 0.42
            : fade * musicAwake * (0.06 + grooveEnergy * 0.16 + speed * 0.34);
          colors.fill(intensity, offset, offset + 6);
        }
        wakeGeometries[ribbonIndex].attributes.position.needsUpdate = true;
        wakeGeometries[ribbonIndex].attributes.color.needsUpdate = true;
        energyWakes[ribbonIndex].visible = (atmosphereVisible && musicAwake > 0.02) || filamentDebugVisible;
      }

      const activeMotes = atmosphereVisible || spiritLayer === 'motes'
        ? Math.min(Math.round((compact ? 5 : 9) * creatureGenome.particleRichness), creatureGenome.moteCount)
        : 0;
      if (!motesInitialized && activeMotes > 0) {
        for (let index = 0; index < activeMotes; index += 1) {
          const profile = creatureGenome.motes[index];
          const anchorIndex = Math.min(wakePointCount - 1, 3 + index * 2);
          moteStateX[index] = trailHistoryX[anchorIndex] + profile.side * 0.022 * viewportAspect;
          moteStateY[index] = trailHistoryY[anchorIndex] - Math.abs(profile.along) * 0.008;
          moteVelocityX[index] = 0;
          moteVelocityY[index] = 0;
          moteDrag[index] = 3.8 + profile.speed * 4.2;
          moteAttachment[index] = 5.2 + (1 - Math.min(1, Math.abs(profile.side))) * 3.4;
          moteBrightness[index] = 0.12;
        }
        motesInitialized = true;
      }
      for (let index = 0; index < activeMotes; index += 1) {
        const mote = creatureGenome.motes[index];
        const historyIndex = Math.min(wakePointCount - 1, 3 + index * 2);
        const localDrift = Math.sin(time * (0.19 + mote.speed * 0.24) + mote.phase) * (0.004 + mote.scatter * 0.007);
        const debugSpread = spiritLayer === 'motes' ? 2.8 : 1;
        const anchorX = trailHistoryX[historyIndex] + (mote.side * 0.022 * debugSpread + localDrift) * viewportAspect;
        const anchorY = trailHistoryY[historyIndex] - Math.abs(mote.along) * 0.008 * debugSpread - (spiritLayer === 'motes' ? index * 0.006 : 0) + localDrift * 0.45;
        moteVelocityX[index] += (anchorX - moteStateX[index]) * moteAttachment[index] * deltaTime;
        moteVelocityY[index] += (anchorY - moteStateY[index]) * moteAttachment[index] * deltaTime;
        moteVelocityX[index] += creatureVelocityX * deltaTime * 0.18;
        moteVelocityY[index] += creatureVelocityY * deltaTime * 0.18;
        const drag = Math.exp(-moteDrag[index] * deltaTime);
        moteVelocityX[index] *= drag;
        moteVelocityY[index] *= drag;
        moteStateX[index] += moteVelocityX[index] * deltaTime;
        moteStateY[index] += moteVelocityY[index] * deltaTime;
        writeOrganicPoint(motePositions, index, moteStateX[index], moteStateY[index]);

        const phaseFraction = mote.phase / (Math.PI * 2);
        const delayedEnergy = sampleHeartEnvelope(beatAge - 0.16 - phaseFraction * 0.12, heartRelease * 0.78) * rhythmStrength;
        const brightnessTarget = spiritLayer === 'motes'
          ? 0.76
          : 0.12 + trebleEnergy * 0.2 + delayedEnergy * (0.34 + phaseFraction * 0.26);
        moteBrightness[index] += (brightnessTarget - moteBrightness[index]) * (1 - Math.exp(-deltaTime * (brightnessTarget > moteBrightness[index] ? 12 : 3.6)));
        const colorOffset = index * 3;
        moteColors[colorOffset] = moteBrightness[index];
        moteColors[colorOffset + 1] = moteBrightness[index] * (0.78 + phaseFraction * 0.16);
        moteColors[colorOffset + 2] = moteBrightness[index] * (0.55 + phaseFraction * 0.3);
      }
      moteGeometry.setDrawRange(0, activeMotes);
      moteGeometry.attributes.position.needsUpdate = true;
      moteGeometry.attributes.color.needsUpdate = true;
      motes.visible = (atmosphereVisible && activeMotes > 0) || spiritLayer === 'motes';
      moteMaterial.opacity = 0.92;
      moteMaterial.size = spiritLayer === 'motes' ? 7 : 2.8 + trebleEnergy * 1.8 + motePulse * 0.35;
      wakeMaterial.opacity = filamentDebugVisible ? 0.78 : 0.12 + grooveEnergy * 0.08;
    };

    const drawSpectrum = (current: WaveCanvasProps, time: number, deltaTime: number) => {
      if (profileSeed !== current.spiritPhenotype?.seed) {
        profileSeed = current.spiritPhenotype?.seed ?? 1;
        creatureGenome = createSpiritProfile(profileSeed, current.spiritPhenotype ?? DEFAULT_SOUND_SPIRIT_PHENOTYPE);
        creatureX = creatureGenome.spawnX;
        creatureY = creatureGenome.spawnY;
        creatureVelocityX = Math.cos(creatureGenome.wanderPhase) * 0.025;
        creatureVelocityY = Math.sin(creatureGenome.wanderPhase) * 0.025;
        creatureHeading = creatureGenome.wanderPhase;
        lifeState = 'drift';
        lifeStateUntil = 0;
        lifeTargetX = creatureX;
        lifeTargetY = creatureY;
        lifeRandomState = ((profileSeed || 1) * 2654435761) >>> 0;
        wingCycle = creatureGenome.breathPhase;
        curiousResponse = 0;
        interactionX = creatureX;
        interactionY = creatureY;
        releaseLookUntil = 0;
        contactPulse = 0;
        contactAge = 10;
        contactPointX = 0;
        contactPointY = 0;
        contactKind = 0;
        contactFunnelRing = 0;
        contactFunnelDirection = 0;
        heartStartlePulse = 0;
        wingContactPulse.fill(0);
        wingContactSpan.fill(0);
        fastEnergy = 0;
        slowEnergy = 0;
        adaptivePeak = 0.025;
        adaptiveVariancePeak = 0.01;
        localVariance = 0;
        longTermEnergy = 0.04;
        shortTermPeak = 0.08;
        lifeEnergy = 0;
        musicAwake = 0;
        beatAccent = 0;
        previousOverallEnergy = 0;
        previousRelativeEnergy = 0;
        rmsEnergy = 0;
        spectralFlux = 0;
        spectralCentroid = 0;
        previousSpectrumLevels.fill(0);
        onsetPulse = 0;
        rhythmImpulse = 0;
        rhythmPulse = 0;
        rhythmStrength = 0;
        grooveEnergy = 0;
        accentPulse = 0;
        musicEnergy = 0;
        veilPulse = 0;
        ribbonPulse = 0;
        motePulse = 0;
        contractionPulse = 0;
        beatBaseline = 0.055;
        beatDeviation = 0.015;
        previousBeatSignal = 0;
        previousBassEnergy = 0;
        lastMainBeatAt = -10;
        expectedBeatInterval = 0;
        acceptedBeatCount = 0;
        acceptedBeatTotal = 0;
        acceptedBeatCursor = 0;
        recentBeatIntervals.fill(0);
        rhythmClock = 0;
        pendingVeilPulse = 0;
        pendingVeilAt = -1;
        pendingRibbonPulse = 0;
        pendingRibbonAt = -1;
        pendingMotePulse = 0;
        pendingMoteAt = -1;
        startlePulse = 0;
        escapeUntil = 0;
        repulsorEscapeUntil = 0;
        wingSpring.forEach((state) => state.fill(0));
        wingVelocity.forEach((state) => state.fill(0));
        funnelCenterX.fill(0);
        funnelCenterZ.fill(0);
        funnelRadiusX.fill(1);
        funnelRadiusZ.fill(1);
        funnelTilt.fill(0);
        funnelCompression.fill(0);
        funnelStretch.fill(0);
        funnelCenterVelocityX.fill(0);
        funnelCenterVelocityZ.fill(0);
        funnelRadiusVelocityX.fill(0);
        funnelRadiusVelocityZ.fill(0);
        funnelTiltVelocity.fill(0);
        funnelCompressionVelocity.fill(0);
        funnelStretchVelocity.fill(0);
        creatureAccelerationX = 0;
        creatureAccelerationY = 0;
        moteStateX.fill(0);
        moteStateY.fill(0);
        moteVelocityX.fill(0);
        moteVelocityY.fill(0);
        moteBrightness.fill(0);
        motesInitialized = false;
        particleVelocityX.fill(0);
        particleVelocityY.fill(0);
        particleFieldInitialized = false;
        trailInitialized = false;
        wakeMaterial.color.setHex(creatureGenome.primaryHue);
        moteMaterial.color.setHex(0xffffff);
        particleMaterial.color.setHex(creatureGenome.primaryHue);
      }
      updateSpiritPhysics(time, deltaTime, current);
      drawUnifiedSpirit(time, deltaTime, current);

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
      const spectrumActive = Boolean(previewPass || spiritDebug || spiritLayer) || (current.mode === 'music' && current.musicData === null && Boolean(current.musicPcmData?.length));
      const musicReady = Boolean(previewPass || spiritDebug || spiritLayer) || (current.mode === 'music' && Boolean(current.musicPcmData?.length));
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

    const drawParticles = (time: number, deltaTime: number) => {
      const current = stateRef.current;
      const spectrumActive = Boolean(previewPass || spiritDebug || spiritLayer) || (current.mode === 'music' && current.musicData === null && Boolean(current.musicPcmData?.length));
      const motionScale = reducedMotion ? 0.18 : 1;
      const activeParticleCount = spectrumActive ? Math.min(compact ? 70 : particleCount, creatureGenome.trailDensity) : particleCount;
      particleGeometry.setDrawRange(0, activeParticleCount);
      const creatureSpeed = Math.max(0.001, Math.hypot(creatureVelocityX, creatureVelocityY));
      for (let index = 0; index < activeParticleCount; index += 1) {
        const offset = index * 3;
        if (spectrumActive) {
          const scale = current.creatureScale ?? 1;
          const flowAngle = creatureGenome.flowDirection;
          const flowX = Math.cos(flowAngle);
          const flowY = Math.sin(flowAngle);
          const normalX = -flowY;
          const normalY = flowX;
          const seedAlong = particleSeeds[offset] * 1.15;
          const seedSide = (particleSeeds[offset + 1] - 0.75) * 0.9;
          const drift = Math.sin(particleSeeds[offset + 2] + time * (0.12 + particleSeeds[offset + 1] * 0.16)) * 0.11 * motionScale;
          const trailAmount = particleSeeds[offset + 1] * (0.04 + creatureSpeed * 0.9 + threatResponse * 0.12 + startlePulse * 0.18) * scale;
          const densityFalloff = 0.28 + Math.abs(seedAlong) * 0.42;
          const along = creatureGenome.bodyRadius * scale * (seedAlong - densityFalloff - trailAmount);
          const side = creatureGenome.bodyRadius * scale * (seedSide + drift);
          const anchorX = creatureX + (flowX * along + normalX * side) * Math.min(1, canvasHeight / canvasWidth);
          const anchorY = creatureY + flowY * along + normalY * side;
          if (!particleFieldInitialized) {
            particlePositions[offset] = anchorX;
            particlePositions[offset + 1] = anchorY;
          }
          const attachment = 1.8 + particleSeeds[offset + 1] * 1.4;
          particleVelocityX[index] += (anchorX - particlePositions[offset]) * attachment * deltaTime;
          particleVelocityY[index] += (anchorY - particlePositions[offset + 1]) * attachment * deltaTime;
          const viscousDrag = Math.exp(-(2.2 + particleSeeds[offset + 1] * 1.6) * deltaTime);
          particleVelocityX[index] *= viscousDrag;
          particleVelocityY[index] *= viscousDrag;
          particlePositions[offset] += particleVelocityX[index] * deltaTime;
          particlePositions[offset + 1] += particleVelocityY[index] * deltaTime;
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
      if (spectrumActive) particleFieldInitialized = true;
      particleMaterial.opacity = previewPass || spiritDebug || spiritLayer === 'body' || spiritLayer === 'filaments' ? 0 : spiritLayer === 'motes'
        ? 0.24
        : spectrumActive
        ? current.musicPlaying ? 0.055 + midEnergy * 0.1 + trebleEnergy * 0.18 + startlePulse * 0.06 : 0.012
        : 0.32;
      particleMaterial.size = spiritLayer === 'motes'
        ? 4.2
        : spectrumActive ? 2.2 + trebleEnergy * (reducedMotion ? 0.8 : 2.8) + startlePulse * 0.8 : 1.2;
      particleGeometry.attributes.position.needsUpdate = true;
    };

    let frame = 0;
    let lastFrameTime = performance.now();
    const animate = (timestamp = performance.now()) => {
      frame = requestAnimationFrame(animate);
      const deltaTime = Math.min(0.05, Math.max(0.001, (timestamp - lastFrameTime) / 1000));
      lastFrameTime = timestamp;
      drawWave(timestamp / 1000, deltaTime);
      drawParticles(timestamp / 1000, deltaTime);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      motionQuery.removeEventListener?.('change', updateMotionPreference);
      mount.removeChild(renderer.domElement);
      renderer.dispose();
      [waveGeometry, secondaryGeometry, pointGeometry, stemGeometry, playheadGeometry, playheadMarkerGeometry, moteGeometry, particleGeometry, sampleRingGeometry, ...wakeGeometries, ...spiritRig.geometries].forEach((geometry) => geometry.dispose());
      haloTexture.dispose();
      [waveMaterial, secondaryMaterial, pointMaterial, pointGlowMaterial, contactMaterial, stemMaterial, ringMaterial, wavePointMaterial, playheadMaterial, playheadMarkerMaterial, ...spiritRig.materials, moteMaterial, particleMaterial, wakeMaterial].forEach((material) => material.dispose());
    };
  }, [spiritPhenotype.key]);

  return <div className="wave-canvas" ref={mountRef} aria-hidden="true" />;
}

interface MasterSpiritRig {
  group: THREE.Group;
  leftWing: THREE.Group;
  rightWing: THREE.Group;
  surfaces: Array<{
    mesh: THREE.Mesh;
    finalMaterial: THREE.ShaderMaterial;
    geometryMaterial: THREE.MeshBasicMaterial;
  }>;
  heartLobes: THREE.Mesh[];
  finalMaterials: THREE.ShaderMaterial[];
  energyMaterials: THREE.LineBasicMaterial[];
  geometries: THREE.BufferGeometry[];
  materials: THREE.Material[];
}

const bodyProfile = [
  [-0.748, -0.0298, -0.014, 0, 0],
  [-0.6015, -0.0269, -0.016, 0.0544, 0.0327],
  [-0.455, -0.0212, -0.0148, 0.0935, 0.0561],
  [-0.3085, -0.0132, -0.0108, 0.1459, 0.0876],
  [-0.162, -0.0038, -0.0047, 0.1988, 0.1193],
  [-0.0155, 0.006, 0.0023, 0.2385, 0.1432],
  [0.1566, 0.0153, 0.0089, 0.2971, 0.1783],
  [0.3494, 0.0229, 0.0137, 0.36, 0.2161],
  [0.5422, 0.0281, 0.0159, 0.342, 0.2053],
  [0.736, 0.0302, 0.015, 0.231, 0.1373],
  [0.9166, 0.0294, 0.0118, 0.1029, 0.0454],
  [1.0197, 0.0279, 0.0092, 0.0747, 0.0199],
] as const;

function createMasterSpirit(compact: boolean, phenotype: SoundSpiritPhenotypeConfig): MasterSpiritRig {
  const group = new THREE.Group();
  const leftWing = new THREE.Group();
  const rightWing = new THREE.Group();
  leftWing.position.x = -SOUND_SPIRIT_SPECIES_GUARDRAILS.wingRootX;
  rightWing.position.x = SOUND_SPIRIT_SPECIES_GUARDRAILS.wingRootX;
  leftWing.scale.set(phenotype.wingSpan * (1 - phenotype.wingAsymmetry), phenotype.wingHeight, 1);
  rightWing.scale.set(phenotype.wingSpan * (1 + phenotype.wingAsymmetry), phenotype.wingHeight, 1);
  leftWing.rotation.z = -(phenotype.wingSweep - 1) * 0.16;
  rightWing.rotation.z = (phenotype.wingSweep - 1) * 0.16;
  leftWing.rotation.y = -phenotype.wingCurvature * 0.22;
  rightWing.rotation.y = phenotype.wingCurvature * 0.22;
  leftWing.userData.materials = [];
  rightWing.userData.materials = [];
  group.add(leftWing, rightWing);

  const surfaces: MasterSpiritRig['surfaces'] = [];
  const finalMaterials: THREE.ShaderMaterial[] = [];
  const energyMaterials: THREE.LineBasicMaterial[] = [];
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const geometryMaterials = {
    body: new THREE.MeshBasicMaterial({ color: 0xdaf5f7, side: THREE.DoubleSide, depthTest: false }),
    wing: new THREE.MeshBasicMaterial({ color: 0xa9dbe6, side: THREE.DoubleSide, depthTest: false }),
    veil: new THREE.MeshBasicMaterial({ color: 0x78b9ce, side: THREE.DoubleSide, depthTest: false }),
    spectral: new THREE.MeshBasicMaterial({ color: 0x829ee8, side: THREE.DoubleSide, depthTest: false }),
    detail: new THREE.MeshBasicMaterial({ color: 0xd0f8ff, side: THREE.DoubleSide, depthTest: false }),
    heart: new THREE.MeshBasicMaterial({ color: 0xffb596, side: THREE.DoubleSide, depthTest: false }),
  };
  materials.push(...Object.values(geometryMaterials));

  const addSurface = (
    parent: THREE.Group,
    geometry: THREE.BufferGeometry,
    material: THREE.ShaderMaterial,
    geometryMaterial: THREE.MeshBasicMaterial,
    order: number,
  ) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = order;
    parent.add(mesh);
    surfaces.push({ mesh, finalMaterial: material, geometryMaterial });
    finalMaterials.push(material);
    geometries.push(geometry);
    materials.push(material);
    return mesh;
  };

  const bodyGeometry = createMasterBodyGeometry(compact);
  const bodyOuter = addSurface(group, bodyGeometry, createMasterSpiritMaterial(0x7bd7e8, 0.27, 0, phenotype), geometryMaterials.body, 8.6);
  const bodyInner = addSurface(group, bodyGeometry, createMasterSpiritMaterial(0xd8fbff, 0.16, 0, phenotype), geometryMaterials.body, 5);
  bodyOuter.scale.set(1.025 * phenotype.bodyFullness, 1.01 * phenotype.bodyLength, 1.04 * phenotype.bodyFullness);
  bodyInner.scale.set(0.92 * phenotype.bodyFullness, 0.965 * phenotype.bodyLength, 0.86 * phenotype.bodyFullness);
  bodyOuter.position.x = phenotype.bodyAsymmetry;
  bodyInner.position.x = phenotype.bodyAsymmetry * 0.7;
  bodyInner.position.z = 0.008;

  for (const side of [-1, 1] as const) {
    const wingGroup = side < 0 ? leftWing : rightWing;
    const mainGeometry = createMasterWingGeometry(side, false, compact, phenotype);
    const veilGeometry = createMasterWingGeometry(side, true, compact, phenotype);
    const addWingSurface = (
      geometry: THREE.BufferGeometry,
      color: number,
      opacity: number,
      kind: number,
      geometryMaterial: THREE.MeshBasicMaterial,
      order: number,
      delay: number,
    ) => {
      const material = createMasterSpiritMaterial(color, opacity, kind, phenotype);
      material.uniforms.uWingSide.value = side;
      material.uniforms.uLayerDelay.value = delay;
      wingGroup.userData.materials.push(material);
      return addSurface(wingGroup, geometry, material, geometryMaterial, order);
    };

    addWingSurface(mainGeometry, 0xb9f5ff, 0.43 * phenotype.membraneOpacity, 1, geometryMaterials.wing, 3, 0);
    addWingSurface(veilGeometry, 0x91dcff, 0.25 * phenotype.membraneOpacity, 2, geometryMaterials.veil, 3.35, 0.065);
    addWingSurface(createWingRootBlendGeometry(side, compact, phenotype), 0xd8fbff, 0.24, 7, geometryMaterials.wing, 3.7, 0.025);

    const spectralRegions = [
      [0.13, 0.58, 0.22, 0.84],
      [0.36, 0.82, -0.3, 0.38],
      [0.58, 0.96, -0.82, -0.12],
    ] as const;
    spectralRegions.forEach(([start, end, lower, upper], index) => {
      const geometry = createWingRegionGeometry(side, start, end, lower, upper, compact, index, phenotype);
      addWingSurface(geometry, 0x675cff, 0.17, 4, geometryMaterials.spectral, 4.2 + index * 0.04, 0.095 + index * 0.012);
    });
    if (phenotype.membraneLayerExtra) {
      const geometry = createWingRegionGeometry(side, 0.2, 0.91, -0.58, 0.66, compact, 1, phenotype);
      addWingSurface(geometry, phenotype.accentColor, 0.09 * phenotype.iridescence, 4, geometryMaterials.spectral, 4.36, 0.13);
    }

    for (let index = 0; index < 5; index += 1) {
      const geometry = createWingVeinGeometry(side, index, false, compact, phenotype);
      addWingSurface(geometry, phenotype.isDefault ? 0x3c8dff : phenotype.secondaryColor, 0.18 * phenotype.veinOpacity, 5, geometryMaterials.detail, 6, 0.035 + index * 0.006);
    }
    const secondaryCount = (compact ? 3 : 5) + Math.min(1, phenotype.veinExtra);
    for (let index = 0; index < secondaryCount; index += 1) {
      const geometry = createWingVeinGeometry(side, index, true, compact, phenotype);
      addWingSurface(geometry, phenotype.isDefault ? 0x745ee8 : phenotype.accentColor, 0.1 * phenotype.veinOpacity, 5.5, geometryMaterials.detail, 6.1, 0.065 + index * 0.006);
    }
    addWingSurface(createWingRimGeometry(side, compact, 0.009, phenotype), phenotype.isDefault ? 0xd9faff : phenotype.accentColor, 0.34 * phenotype.rimOpacity, 6, geometryMaterials.detail, 6.4, 0.035);
    addWingSurface(createWingRimGeometry(side, compact, 0.023, phenotype), phenotype.isDefault ? 0x9b8cff : phenotype.secondaryColor, 0.11 * phenotype.rimOpacity, 6.5, geometryMaterials.spectral, 6.2, 0.05);
    if (phenotype.veinExtra > 1) {
      addWingSurface(createWingRimGeometry(side, compact, 0.035, phenotype), phenotype.accentColor, 0.065 * phenotype.rimOpacity, 6.5, geometryMaterials.spectral, 6.25, 0.075);
    }
  }

  const internalPathControls = [
    [[0, -0.025, 0.53], [-0.06, 0.015, 0.565], [-0.17, 0.022, 0.61], [-0.33, 0.056, 0.615], [-0.5, 0.035, 0.54]],
    [[0, 0.013, 0.52], [0.06, 0.023, 0.555], [0.17, 0.03, 0.6], [0.33, 0.06, 0.605], [0.5, 0.017, 0.53]],
    [[0.02, 0.028, 0.55], [-0.032, 0.016, 0.411], [-0.04, 0.041, 0.095], [-0.048, 0.047, -0.216], [-0.1, -0.003, -0.4]],
    [[0, 0.027, 0.48], [0.049, 0.016, 0.37], [0.05, 0.058, 0.122], [0.051, 0.039, -0.125], [0.1, 0.008, -0.28]],
  ];
  if (phenotype.energyPathExtra > 0) {
    internalPathControls.push([[0, 0.02, 0.5], [-0.1, 0.035, 0.36], [0.08, 0.045, 0.17], [-0.12, 0.04, -0.02], [0.04, 0.01, -0.34]]);
  }
  if (phenotype.energyPathExtra > 1) {
    internalPathControls.push([[0, 0.018, 0.49], [0.11, 0.032, 0.34], [-0.07, 0.05, 0.12], [0.13, 0.036, -0.08], [-0.03, 0.008, -0.38]]);
  }
  internalPathControls.forEach((controls, index) => {
    const routedControls = controls.map((control, controlIndex) => [
      control[0] + Math.sin((controlIndex + 1) * 1.73 + index * 0.91 + phenotype.energyRoutePhase) * phenotype.energyRouting,
      control[1],
      control[2],
    ]);
    const geometry = createMasterPathGeometry(routedControls, compact ? 34 : 70);
    const material = createEnergyLineMaterial(
      phenotype.isDefault ? (index < 2 ? 0x96eeff : 0xffca8d) : (index < 2 ? phenotype.primaryColor : phenotype.energyColor),
      (index < 2 ? 0.22 : 0.28) * phenotype.energyOpacity * phenotype.energyPathEmphasis,
    );
    material.userData.opacityFactor = phenotype.energyOpacity * phenotype.energyPathEmphasis;
    const line = new THREE.Line(geometry, material);
    line.renderOrder = 7;
    group.add(line);
    geometries.push(geometry);
    materials.push(material);
    energyMaterials.push(material);
  });

  const heartProfiles = [
    [-0.0602, -0.0126, 0.54, 0.0927, 0.0646, 0.1227],
    [0.0549, 0.0104, 0.548, 0.0845, 0.0633, 0.1135],
    [-0.0142, 0.0204, 0.478, 0.0964, 0.0721, 0.0999],
    [0.0198, -0.0165, 0.6, 0.0645, 0.0499, 0.0767],
    [0.005, 0.0017, 0.525, 0.0555, 0.0423, 0.0636],
  ] as const;
  const heartLobes: THREE.Mesh[] = [];
  heartProfiles.forEach((profile, index) => {
    const geometry = createHeartLobeGeometry(compact, index);
    const heartColor = phenotype.isDefault
      ? (index < 2 ? 0xff997e : 0xffd28d)
      : (index < 2 ? phenotype.accentColor : phenotype.energyColor);
    const material = createMasterSpiritMaterial(heartColor, 0.43 * phenotype.heartGlow * (phenotype.isDefault ? 1 : 1.18), 3, phenotype);
    const lobe = addSurface(group, geometry, material, geometryMaterials.heart, 8);
    lobe.position.set(profile[0], profile[2], profile[1] + 0.012);
    const variation = 1 + (index - 2) * phenotype.heartVariation * 0.34;
    const coreScale = index === 4 ? phenotype.heartCoreScale : 1;
    const baseScale = new THREE.Vector3(
      profile[3] * phenotype.heartLobeWidths[index],
      profile[5] * phenotype.heartLobeLengths[index],
      profile[4] * phenotype.heartLobeWidths[index],
    ).multiplyScalar(phenotype.heartScale * variation * coreScale);
    lobe.scale.copy(baseScale);
    lobe.userData.baseScale = baseScale;
    lobe.userData.pulseStrength = phenotype.heartPulse;
    heartLobes.push(lobe);
  });

  return { group, leftWing, rightWing, surfaces, heartLobes, finalMaterials, energyMaterials, geometries, materials };
}

function createMasterBodyGeometry(compact: boolean) {
  const rows = compact ? 48 : 84;
  const columns = compact ? 28 : 48;
  const positions = new Float32Array(rows * columns * 3);
  const funnelCoordinates = new Float32Array(rows * columns * 2);
  const funnelCenters = new Float32Array(rows * columns * 2);
  const funnelRadii = new Float32Array(rows * columns * 2);
  const funnelMasks = new Float32Array(rows * columns);
  for (let row = 0; row < rows; row += 1) {
    const progress = row / (rows - 1);
    const profileProgress = progress * (bodyProfile.length - 1);
    const profileIndex = Math.min(bodyProfile.length - 2, Math.floor(profileProgress));
    const mix = profileProgress - profileIndex;
    const first = bodyProfile[profileIndex];
    const second = bodyProfile[profileIndex + 1];
    const value = (index: number) => THREE.MathUtils.lerp(first[index], second[index], mix);
    const vertical = value(0);
    const centerX = value(1);
    const centerDepth = value(2);
    const radiusX = value(3);
    const radiusDepth = value(4);
    for (let column = 0; column < columns; column += 1) {
      const angle = column / (columns - 1) * Math.PI * 2;
      const crown = smoothstep(0.84, 1, progress) * Math.pow(Math.abs(Math.cos(angle)), 5) * 0.052;
      const asymmetry = Math.sin(progress * Math.PI) * Math.sin(angle * 2.0) * 0.012;
      const offset = (row * columns + column) * 3;
      positions[offset] = centerX + Math.cos(angle) * radiusX + asymmetry;
      positions[offset + 1] = vertical + crown;
      positions[offset + 2] = centerDepth + Math.sin(angle) * radiusDepth;
      const vertex = row * columns + column;
      funnelCoordinates[vertex * 2] = progress;
      funnelCoordinates[vertex * 2 + 1] = angle;
      funnelCenters[vertex * 2] = centerX;
      funnelCenters[vertex * 2 + 1] = centerDepth;
      funnelRadii[vertex * 2] = radiusX;
      funnelRadii[vertex * 2 + 1] = radiusDepth;
      funnelMasks[vertex] = 1 - smoothstep(0.48, 0.72, progress);
    }
  }
  const geometry = dynamicSurfaceGeometry(positions, rows, columns);
  geometry.setAttribute('funnelCoord', new THREE.BufferAttribute(funnelCoordinates, 2));
  geometry.setAttribute('funnelCenter', new THREE.BufferAttribute(funnelCenters, 2));
  geometry.setAttribute('funnelRadius', new THREE.BufferAttribute(funnelRadii, 2));
  geometry.setAttribute('funnelMask', new THREE.BufferAttribute(funnelMasks, 1));
  geometry.computeVertexNormals();
  return geometry;
}

function createMasterWingGeometry(side: -1 | 1, inner: boolean, compact: boolean, phenotype: SoundSpiritPhenotypeConfig) {
  const rows = compact ? 34 : 56;
  const columns = compact ? 22 : 34;
  const positions = new Float32Array(rows * columns * 3);
  const wingCoordinates = new Float32Array(rows * columns * 2);
  const masks = new Float32Array(rows * columns);
  for (let row = 0; row < rows; row += 1) {
    const span = row / (rows - 1);
    for (let column = 0; column < columns; column += 1) {
      const chord = column / (columns - 1) * 2 - 1;
      const point = sampleWingRest(side, span, chord, inner, phenotype);
      const offset = (row * columns + column) * 3;
      positions[offset] = point.x;
      positions[offset + 1] = point.y;
      positions[offset + 2] = point.z;
      const wingOffset = (row * columns + column) * 2;
      wingCoordinates[wingOffset] = span;
      wingCoordinates[wingOffset + 1] = chord;
      const rootFade = THREE.MathUtils.lerp(0.2, 1, smoothstep(0, inner ? 0.28 : 0.22, span));
      const edgeFeather = 0.82 + Math.pow(Math.max(0, 1 - Math.abs(chord)), 0.65) * 0.18;
      masks[row * columns + column] = rootFade * edgeFeather;
    }
  }
  return finalizeWingSurface(positions, wingCoordinates, rows, columns, masks);
}

function sampleWingRest(side: -1 | 1, span: number, chord: number, inner = false, phenotype = DEFAULT_SOUND_SPIRIT_PHENOTYPE) {
  const safeSpan = Math.min(1, Math.max(0, span));
  const membraneScale = inner ? 0.91 : 1;
  const roundedTip = 0.066 * Math.pow(Math.abs(chord), 1.7) * smoothstep(0.58, 1, safeSpan);
  const shoulderBlend = 1 - smoothstep(0, 0.27, safeSpan);
  const organicRoot = shoulderBlend * (0.078 + 0.058 * Math.pow(Math.max(0, 1 - chord * chord), 0.7));
  const scallop = phenotype.wingScallop * Math.sin(safeSpan * Math.PI * 3.15) * smoothstep(0.18, 0.98, safeSpan);
  const distance = (0.735 * Math.pow(safeSpan, 0.62) - 0.12 * safeSpan * safeSpan
    + 0.17 * Math.pow(Math.sin(Math.PI * safeSpan), 1.2) * (1 - chord * chord)
    - roundedTip + scallop) * membraneScale - organicRoot;
  const centerVertical = 0.53 + Math.sin(Math.PI * safeSpan) * 0.038 - 0.13 * Math.pow(safeSpan, 1.45)
    + (inner ? 0.008 : 0) + phenotype.wingInnerContour * Math.sin(Math.PI * safeSpan) * (1 - chord * chord);
  const halfChord = 0.195 * (1 - safeSpan * 0.1) * (0.88 + smoothstep(0, 0.24, safeSpan) * 0.12);
  const lowerScoop = -0.024 * Math.sin(Math.PI * safeSpan) * (1 - chord * chord) * (0.55 - chord * 0.45);
  const shoulderVolume = shoulderBlend * Math.pow(Math.max(0, 1 - chord * chord), 0.8) * 0.026;
  const depth = Math.pow(Math.sin(Math.PI * safeSpan), 0.78) * (1 - chord * chord) * 0.118
    + Math.sin(safeSpan * Math.PI * 1.5) * chord * 0.012
    + shoulderVolume + (inner ? -0.034 : 0);
  return new THREE.Vector3(side * distance, centerVertical + chord * halfChord + lowerScoop, depth);
}

function finalizeWingSurface(
  positions: Float32Array,
  wingCoordinates: Float32Array,
  rows: number,
  columns: number,
  masks?: Float32Array,
) {
  const geometry = dynamicSurfaceGeometry(positions, rows, columns);
  geometry.setAttribute('restPosition', new THREE.BufferAttribute(positions.slice(), 3));
  geometry.setAttribute('wingCoord', new THREE.BufferAttribute(wingCoordinates, 2));
  geometry.setAttribute('wingMask', new THREE.BufferAttribute(masks ?? new Float32Array(rows * columns).fill(1), 1));
  geometry.computeVertexNormals();
  return geometry;
}

function createWingRootBlendGeometry(side: -1 | 1, compact: boolean, phenotype: SoundSpiritPhenotypeConfig) {
  const rows = compact ? 12 : 18;
  const columns = compact ? 14 : 20;
  const positions = new Float32Array(rows * columns * 3);
  const coordinates = new Float32Array(rows * columns * 2);
  const masks = new Float32Array(rows * columns);
  for (let row = 0; row < rows; row += 1) {
    const span = row / (rows - 1) * 0.34;
    const blend = smoothstep(0, 0.3, span);
    for (let column = 0; column < columns; column += 1) {
      const chord = column / (columns - 1) * 2 - 1;
      const point = sampleWingRest(side, span, chord * (0.7 + blend * 0.3), false, phenotype);
      point.x -= side * (1 - blend) * 0.042 * Math.pow(Math.max(0, 1 - chord * chord), 0.7);
      point.z += (1 - blend) * 0.012 * (1 - chord * chord);
      const vertex = row * columns + column;
      positions.set([point.x, point.y, point.z], vertex * 3);
      coordinates.set([span, chord], vertex * 2);
      const chordFade = Math.pow(Math.max(0, Math.sin((chord + 1) * Math.PI * 0.5)), 0.62);
      const bodyFade = 0.16 + smoothstep(0, 0.1, span) * 0.84;
      masks[vertex] = chordFade * bodyFade * (1 - smoothstep(0.28, 0.34, span));
    }
  }
  return finalizeWingSurface(positions, coordinates, rows, columns, masks);
}

function createWingRegionGeometry(
  side: -1 | 1,
  spanStart: number,
  spanEnd: number,
  chordLower: number,
  chordUpper: number,
  compact: boolean,
  region: number,
  phenotype: SoundSpiritPhenotypeConfig,
) {
  const rows = compact ? 12 : 18;
  const columns = compact ? 9 : 13;
  const positions = new Float32Array(rows * columns * 3);
  const coordinates = new Float32Array(rows * columns * 2);
  const masks = new Float32Array(rows * columns);
  for (let row = 0; row < rows; row += 1) {
    const localSpan = row / (rows - 1);
    const span = THREE.MathUtils.lerp(spanStart, spanEnd, localSpan);
    for (let column = 0; column < columns; column += 1) {
      const localChord = column / (columns - 1);
      const curve = Math.sin(localSpan * Math.PI) * (region - 1) * 0.055;
      const chord = THREE.MathUtils.lerp(chordLower, chordUpper, localChord) + curve;
      const point = sampleWingRest(side, span, chord, true, phenotype);
      point.z += 0.012 + region * 0.005;
      const vertex = row * columns + column;
      positions.set([point.x, point.y, point.z], vertex * 3);
      coordinates.set([span, chord], vertex * 2);
      const edgeFade = Math.sin(localSpan * Math.PI) * Math.sin(localChord * Math.PI);
      masks[vertex] = Math.pow(Math.max(0, edgeFade), 0.62);
    }
  }
  return finalizeWingSurface(positions, coordinates, rows, columns, masks);
}

function createWingVeinGeometry(side: -1 | 1, index: number, secondary: boolean, compact: boolean, phenotype: SoundSpiritPhenotypeConfig) {
  const pointCount = compact ? 18 : 30;
  const positions = new Float32Array(pointCount * 2 * 3);
  const coordinates = new Float32Array(pointCount * 2 * 2);
  const startSpan = secondary ? 0.31 + index * 0.052 : 0.06 + index * 0.006;
  const endSpan = secondary ? 0.66 + index * 0.055 : 0.72 + index * 0.052;
  const startChord = secondary ? -0.46 + index * 0.21 : (index - 2) * 0.028;
  const fanPosition = secondary ? index - 2.5 : index - 2;
  const endChord = (secondary ? -0.7 + index * 0.34 : -0.78 + index * 0.39) + phenotype.veinFan * fanPosition * 0.34;
  const width = secondary ? 0.0024 : 0.0041;
  for (let pointIndex = 0; pointIndex < pointCount; pointIndex += 1) {
    const progress = pointIndex / (pointCount - 1);
    const spanProgress = secondary ? smoothstep(0, 1, progress) : Math.pow(progress, 0.88);
    const span = THREE.MathUtils.lerp(startSpan, Math.min(0.96, endSpan), spanProgress);
    const branchProgress = smoothstep(0.14, 1, progress);
    const rootBend = Math.sin(progress * Math.PI) * ((secondary ? 0.08 : 0.12) + phenotype.veinBranch)
      * (index < (secondary ? 3 : 2) ? -1 : 1);
    const chord = THREE.MathUtils.lerp(startChord, endChord, branchProgress) + rootBend;
    const point = sampleWingRest(side, span, chord, false, phenotype);
    point.z += secondary ? 0.012 : 0.014;
    for (let edge = 0; edge < 2; edge += 1) {
      const vertex = pointIndex * 2 + edge;
      const edgeOffset = edge === 0 ? -width : width;
      positions.set([point.x, point.y + edgeOffset, point.z], vertex * 3);
      coordinates.set([span, chord], vertex * 2);
    }
  }
  return finalizeWingSurface(positions, coordinates, pointCount, 2);
}

function createWingRimGeometry(side: -1 | 1, compact: boolean, width: number, phenotype: SoundSpiritPhenotypeConfig) {
  const pointCount = compact ? 28 : 48;
  const positions = new Float32Array(pointCount * 2 * 3);
  const coordinates = new Float32Array(pointCount * 2 * 2);
  for (let pointIndex = 0; pointIndex < pointCount; pointIndex += 1) {
    const chord = pointIndex / (pointCount - 1) * 2 - 1;
    const span = 0.988 - (1 - chord * chord) * 0.012;
    const point = sampleWingRest(side, span, chord, false, phenotype);
    point.z += 0.016;
    for (let edge = 0; edge < 2; edge += 1) {
      const vertex = pointIndex * 2 + edge;
      positions.set([point.x - side * width * edge, point.y, point.z], vertex * 3);
      coordinates.set([span - edge * 0.015, chord], vertex * 2);
    }
  }
  return finalizeWingSurface(positions, coordinates, pointCount, 2);
}

function createMasterPathGeometry(controls: number[][], divisions: number, wingLocal = false) {
  const points = controls.map(([x, depth, vertical]) => new THREE.Vector3(x, vertical, depth));
  const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.45);
  const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(divisions));
  if (wingLocal) geometry.computeBoundingSphere();
  return geometry;
}

function createEnergyLineMaterial(color: number, opacity: number) {
  return new THREE.LineBasicMaterial({
    color,
    depthTest: false,
    depthWrite: false,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
  });
}

function createMasterSpiritMaterial(color: number, opacity: number, kind: number, phenotype: SoundSpiritPhenotypeConfig) {
  const primary = phenotype.isDefault ? 0x38c7ff : phenotype.primaryColor;
  const secondary = phenotype.isDefault ? 0x8557f5 : phenotype.secondaryColor;
  const accent = phenotype.isDefault ? 0xeb61d1 : phenotype.accentColor;
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
      uKind: { value: kind },
      uTime: { value: 0 },
      uLife: { value: 0 },
      uMusicAwake: { value: 0 },
      uBass: { value: 0 },
      uMid: { value: 0 },
      uTreble: { value: 0 },
      uFunnelRing0: { value: new THREE.Vector4(0, 0, 1, 1) },
      uFunnelRing1: { value: new THREE.Vector4(0, 0, 1, 1) },
      uFunnelRing2: { value: new THREE.Vector4(0, 0, 1, 1) },
      uFunnelRing3: { value: new THREE.Vector4(0, 0, 1, 1) },
      uFunnelRing4: { value: new THREE.Vector4(0, 0, 1, 1) },
      uFunnelRing5: { value: new THREE.Vector4(0, 0, 1, 1) },
      uFunnelTilt0: { value: 0 },
      uFunnelTilt1: { value: 0 },
      uFunnelTilt2: { value: 0 },
      uFunnelTilt3: { value: 0 },
      uFunnelTilt4: { value: 0 },
      uFunnelTilt5: { value: 0 },
      uHeartBeat: { value: 0 },
      uBeatAge: { value: 10 },
      uBeatStrength: { value: 0 },
      uRhythmPulse: { value: 0 },
      uRootPulse: { value: 0 },
      uVeinPulse: { value: 0 },
      uRimPulse: { value: 0 },
      uFunnelPulse: { value: 0 },
      uContactPoint: { value: new THREE.Vector2() },
      uContactPulse: { value: 0 },
      uContactAge: { value: 10 },
      uContactKind: { value: 0 },
      uWingA: { value: new THREE.Vector3() },
      uWingB: { value: new THREE.Vector2() },
      uWingSide: { value: 0 },
      uLayerDelay: { value: 0 },
      uMembraneTension: { value: 0.3 },
      uEnergyFlow: { value: 0.2 },
      uRimActivity: { value: 0.15 },
      uCycle: { value: 0 },
      uPrimary: { value: new THREE.Color(primary) },
      uSecondary: { value: new THREE.Color(secondary) },
      uAccent: { value: new THREE.Color(accent) },
      uIndividuality: { value: phenotype.isDefault ? 0 : 1 },
      uIridescence: { value: phenotype.iridescence },
      uGlowIntensity: { value: phenotype.glowIntensity },
    },
    vertexShader: `
      attribute vec3 restPosition;
      attribute vec2 wingCoord;
      attribute float wingMask;
      attribute vec2 funnelCoord;
      attribute vec2 funnelCenter;
      attribute vec2 funnelRadius;
      attribute float funnelMask;
      uniform vec4 uFunnelRing0;
      uniform vec4 uFunnelRing1;
      uniform vec4 uFunnelRing2;
      uniform vec4 uFunnelRing3;
      uniform vec4 uFunnelRing4;
      uniform vec4 uFunnelRing5;
      uniform float uFunnelTilt0;
      uniform float uFunnelTilt1;
      uniform float uFunnelTilt2;
      uniform float uFunnelTilt3;
      uniform float uFunnelTilt4;
      uniform float uFunnelTilt5;
      uniform float uRhythmPulse;
      uniform float uKind;
      uniform float uTime;
      uniform float uLife;
      uniform vec3 uWingA;
      uniform vec2 uWingB;
      uniform float uWingSide;
      uniform float uLayerDelay;
      uniform float uMembraneTension;
      uniform float uCycle;
      varying vec3 vLocal;
      varying vec3 vNormalView;
      varying vec3 vViewPosition;
      varying float vSpan;
      varying float vChord;
      varying float vWingMask;
      varying float vFunnelResponse;
      vec4 sampleFunnelRing(float progress) {
        float scaled = clamp(progress, 0.0, 1.0) * 5.0;
        if (scaled < 1.0) return mix(uFunnelRing0, uFunnelRing1, smoothstep(0.0, 1.0, scaled));
        if (scaled < 2.0) return mix(uFunnelRing1, uFunnelRing2, smoothstep(0.0, 1.0, scaled - 1.0));
        if (scaled < 3.0) return mix(uFunnelRing2, uFunnelRing3, smoothstep(0.0, 1.0, scaled - 2.0));
        if (scaled < 4.0) return mix(uFunnelRing3, uFunnelRing4, smoothstep(0.0, 1.0, scaled - 3.0));
        return mix(uFunnelRing4, uFunnelRing5, smoothstep(0.0, 1.0, scaled - 4.0));
      }
      float sampleFunnelTilt(float progress) {
        float scaled = clamp(progress, 0.0, 1.0) * 5.0;
        if (scaled < 1.0) return mix(uFunnelTilt0, uFunnelTilt1, smoothstep(0.0, 1.0, scaled));
        if (scaled < 2.0) return mix(uFunnelTilt1, uFunnelTilt2, smoothstep(0.0, 1.0, scaled - 1.0));
        if (scaled < 3.0) return mix(uFunnelTilt2, uFunnelTilt3, smoothstep(0.0, 1.0, scaled - 2.0));
        if (scaled < 4.0) return mix(uFunnelTilt3, uFunnelTilt4, smoothstep(0.0, 1.0, scaled - 3.0));
        return mix(uFunnelTilt4, uFunnelTilt5, smoothstep(0.0, 1.0, scaled - 4.0));
      }
      float zoneStroke(float span) {
        if (span < 0.25) return mix(uWingA.x, uWingA.y, span * 4.0);
        if (span < 0.5) return mix(uWingA.y, uWingA.z, (span - 0.25) * 4.0);
        if (span < 0.75) return mix(uWingA.z, uWingB.x, (span - 0.5) * 4.0);
        return mix(uWingB.x, uWingB.y, (span - 0.75) * 4.0);
      }
      void main() {
        vec3 transformed = position;
        float wingSurface = step(0.5, uKind) * (1.0 - step(2.5, uKind))
          + step(3.5, uKind) * (1.0 - step(7.5, uKind));
        if (uKind < 0.5) {
          float ringProgress = clamp((0.72 - funnelCoord.x) / 0.72, 0.0, 1.0);
          vec4 ring = sampleFunnelRing(ringProgress);
          float tilt = sampleFunnelTilt(ringProgress);
          float localX = position.x - funnelCenter.x;
          float localZ = position.z - funnelCenter.y;
          vec3 deformed = position;
          deformed.x = funnelCenter.x + localX * ring.z + ring.x;
          deformed.y = position.y + localX * sin(tilt);
          deformed.z = funnelCenter.y + localZ * ring.w + ring.y;
          transformed = mix(position, deformed, funnelMask);
          vFunnelResponse = funnelMask * (abs(ring.x) + abs(ring.y) + abs(ring.z - 1.0) + abs(ring.w - 1.0));
        }
        if (wingSurface > 0.5) {
          transformed = restPosition;
          float span = clamp(wingCoord.x, 0.0, 1.0);
          float chord = clamp(wingCoord.y, -1.0, 1.0);
          float delayedSpan = clamp(span - uLayerDelay * (0.35 + span * 0.65), 0.0, 1.0);
          float stroke = zoneStroke(delayedSpan);
          float rootBlend = smoothstep(0.02, 0.32, span);
          float tipWeight = smoothstep(0.34, 1.0, span);
          float travelingRipple = sin(span * 8.0 - uTime * (0.34 + uLife * 0.7) + uWingSide * 0.12 - uLayerDelay * 9.0);
          float figureEight = sin(uCycle * 6.28318 + span * 1.7) * cos(uCycle * 6.28318 * 2.0 + span);
          transformed.z += rootBlend * stroke * (0.052 + span * 0.19);
          transformed.z += travelingRipple * tipWeight * (0.003 + uLife * 0.008);
          transformed.y += figureEight * tipWeight * (0.004 + abs(stroke) * 0.016);
          transformed.y -= abs(stroke) * (1.0 - chord * chord) * sin(span * 3.14159) * (0.038 + uMembraneTension * 0.07);
          transformed.y -= abs(stroke) * tipWeight * (0.038 + span * 0.105);
          transformed.x -= sign(transformed.x) * abs(stroke) * tipWeight * (0.042 + span * 0.128);
          transformed.z -= abs(stroke) * (1.0 - chord * chord) * sin(span * 3.14159) * (0.018 + uMembraneTension * 0.035);
          vSpan = span;
          vChord = chord;
          vWingMask = wingMask;
          vFunnelResponse = 0.0;
        } else {
          vSpan = 0.0;
          vChord = 0.0;
          vWingMask = 1.0;
          if (uKind >= 0.5) vFunnelResponse = 0.0;
        }
        vLocal = transformed;
        vNormalView = normalize(normalMatrix * normal);
        vec4 viewPosition = modelViewMatrix * vec4(transformed, 1.0);
        vViewPosition = viewPosition.xyz;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uOpacity;
      uniform float uKind;
      uniform float uTime;
      uniform float uLife;
      uniform float uMusicAwake;
      uniform float uBass;
      uniform float uMid;
      uniform float uTreble;
      uniform float uHeartBeat;
      uniform float uBeatAge;
      uniform float uBeatStrength;
      uniform float uEnergyFlow;
      uniform float uRimActivity;
      uniform float uCycle;
      uniform float uRootPulse;
      uniform float uVeinPulse;
      uniform float uRimPulse;
      uniform float uFunnelPulse;
      uniform vec2 uContactPoint;
      uniform float uContactPulse;
      uniform float uContactAge;
      uniform float uContactKind;
      uniform vec3 uPrimary;
      uniform vec3 uSecondary;
      uniform vec3 uAccent;
      uniform float uIndividuality;
      uniform float uIridescence;
      uniform float uGlowIntensity;
      varying vec3 vLocal;
      varying vec3 vNormalView;
      varying vec3 vViewPosition;
      varying float vSpan;
      varying float vChord;
      varying float vWingMask;
      varying float vFunnelResponse;
      void main() {
        vec3 viewDirection = normalize(-vViewPosition);
        float fresnel = pow(1.0 - abs(dot(normalize(vNormalView), viewDirection)), 1.55);
        float tissue = 0.86 + sin(vLocal.y * 18.0 + vLocal.x * 11.0 - uTime * (0.28 + uLife * 0.65)) * 0.14;
        float wing = step(0.5, uKind) * (1.0 - step(2.5, uKind))
          + step(3.5, uKind) * (1.0 - step(7.5, uKind));
        float heart = step(2.5, uKind) * (1.0 - step(3.5, uKind));
        float spectral = step(3.5, uKind) * (1.0 - step(4.5, uKind));
        float vein = step(4.5, uKind) * (1.0 - step(5.8, uKind));
        float rim = step(5.8, uKind) * (1.0 - step(6.8, uKind));
        float rootBlend = step(6.8, uKind) * (1.0 - step(7.5, uKind));
        float depthGlow = exp(-abs(vLocal.z) * (heart > 0.5 ? 8.0 : 4.0));
        float funnelProgress = clamp((0.5 - vLocal.y) / 1.24, 0.0, 1.0);
        float funnelTravel = exp(-pow(funnelProgress - (uBeatAge - 0.08) * 1.75, 2.0) / 0.018)
          * uFunnelPulse * step(funnelProgress, 0.24 + uBeatStrength * 0.76) * (1.0 - step(0.5, uKind));
        float contactDistance = distance(vLocal.xy, uContactPoint);
        float contactCore = exp(-contactDistance * contactDistance / 0.012) * uContactPulse * exp(-uContactAge * 2.8);
        float contactRadius = min(0.42, uContactAge * 0.24);
        float contactWave = exp(-pow(contactDistance - contactRadius, 2.0) / 0.0045)
          * uContactPulse * exp(-uContactAge * 1.9);
        float contactEnergy = (contactCore + contactWave * 0.72) * (0.82 + uContactKind * 0.06);
        vec3 pearl = vec3(0.78, 0.97, 1.0);
        vec3 cyan = uPrimary;
        vec3 blue = mix(vec3(0.2, 0.42, 1.0), mix(uPrimary, uSecondary, 0.35), uIndividuality);
        vec3 violet = uSecondary;
        vec3 magenta = uAccent;
        vec3 wingPalette = mix(pearl, cyan, smoothstep(0.02, 0.3, vSpan));
        wingPalette = mix(wingPalette, blue, smoothstep(0.3, 0.58, vSpan));
        wingPalette = mix(wingPalette, violet, smoothstep(0.58, 0.82, vSpan));
        wingPalette = mix(wingPalette, magenta, smoothstep(0.82, 1.0, vSpan));
        float iridescence = fresnel * (0.45 + 0.25 * sin(vSpan * 9.0 + vChord * 3.0 + uTime * 0.16));
        wingPalette = mix(wingPalette, mix(cyan, violet, fresnel), iridescence * (0.18 + uTreble * 0.2) * uIridescence);
        float energyPulse = 0.5 + 0.5 * sin(vSpan * 12.0 - uTime * (1.1 + uEnergyFlow * 2.2) - uCycle * 6.28318);
        float wingTravel = exp(-pow(vSpan - (uBeatAge - 0.1) * 1.85, 2.0) / 0.022)
          * uVeinPulse * step(vSpan, 0.3 + uBeatStrength * 0.7) * wing;
        float warmRoot = (1.0 - smoothstep(0.02, 0.24, vSpan)) * (energyPulse * uEnergyFlow * 0.42 + uRootPulse * 1.18);
        float localRimActivity = rim * (0.08 + uRimActivity * (0.18 + 0.36 * energyPulse))
          * (0.56 + 0.44 * sin(vChord * 5.3 + vSpan * 8.0 + uTime * 0.72)) + rim * uRimPulse * 0.92;
        float membraneLight = (1.0 - clamp(vein + rim, 0.0, 1.0)) * (0.64 + fresnel * 0.72 + spectral * 0.18);
        vec3 coolLight = wingPalette * wing * (membraneLight + vein * (0.06 + energyPulse * uEnergyFlow * 0.16) + localRimActivity);
        vec3 heartLight = mix(vec3(1.0, 0.5, 0.22), mix(uAccent, uColor, 0.35), uIndividuality);
        vec3 warmLight = heartLight * heart * (0.035 + uBass * 0.015 + uHeartBeat * 2.08);
        vec3 finalColor = uColor * (0.65 + depthGlow * 0.28 + uLife * 0.1 + vFunnelResponse * 0.8) + coolLight + warmLight;
        finalColor *= mix(1.0, 0.36 + uHeartBeat * 0.78, heart);
        finalColor += mix(vec3(1.0, 0.82, 0.5), uAccent, uIndividuality * 0.72) * heart * uHeartBeat * 1.08;
        finalColor += vec3(0.24, 0.76, 0.92) * vFunnelResponse * (0.35 + fresnel * 0.9);
        finalColor += vec3(0.34, 0.88, 1.0) * funnelTravel * 1.48;
        finalColor += vec3(0.28, 0.9, 1.0) * contactEnergy * 1.15;
        finalColor += mix(vec3(0.25, 0.8, 1.0), vec3(0.72, 0.46, 1.0), vSpan) * wingTravel * 1.34;
        finalColor += mix(vec3(1.0, 0.7, 0.32), mix(uAccent, uColor, 0.45), uIndividuality) * warmRoot * (vein + rootBlend + spectral * 0.35);
        finalColor += vec3(0.18, 0.62, 0.96) * uTreble * wing * (0.06 + localRimActivity * 0.14);
        finalColor *= uGlowIntensity;
        float detailAlpha = 1.0 + spectral * 0.12 + vein * (energyPulse * uEnergyFlow * 0.42) + localRimActivity * 0.32;
        float featheredMask = mix(1.0, vWingMask, clamp(wing + spectral + rootBlend, 0.0, 1.0));
        float membraneDepth = wing * (0.12 + (1.0 - abs(vChord)) * 0.16 + sin(vSpan * 4.8 + vChord * 2.2) * 0.035);
        float alpha = uOpacity * tissue * detailAlpha * featheredMask * (0.52 + fresnel * 0.62 + depthGlow * 0.18 + vFunnelResponse * 0.36 + funnelTravel * 0.86 + contactEnergy * 0.42 + wingTravel * 0.62 + rootBlend * uRootPulse * 0.48 + heart * (0.04 + uHeartBeat * 0.72) + membraneDepth + uMid * wing * 0.06);
        alpha *= mix(1.0, 0.5 + uHeartBeat * 0.62, heart);
        if (alpha < 0.008) discard;
        gl_FragColor = vec4(finalColor, alpha);
      }
    `,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: kind === 3 || (kind >= 4 && kind < 7) ? THREE.AdditiveBlending : THREE.NormalBlending,
    side: THREE.DoubleSide,
  });
}

function createTissueMaterial(color: number, opacity: number, additive: boolean) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
      uTime: { value: 0 },
      uLife: { value: 0 },
      uTreble: { value: 0 },
    },
    vertexShader: `
      varying vec3 vColor;
      varying vec3 vNormalView;
      varying vec3 vViewPosition;
      void main() {
        vColor = color;
        vNormalView = normalize(normalMatrix * normal);
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vViewPosition = viewPosition.xyz;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uOpacity;
      uniform float uTime;
      uniform float uLife;
      uniform float uTreble;
      varying vec3 vColor;
      varying vec3 vNormalView;
      varying vec3 vViewPosition;
      void main() {
        vec3 viewDirection = normalize(-vViewPosition);
        float rim = pow(1.0 - abs(dot(normalize(vNormalView), viewDirection)), 1.65);
        float tissue = 0.82 + 0.18 * sin(vViewPosition.y * 38.0 - uTime * (0.42 + uLife * 0.8) + vViewPosition.x * 19.0);
        float inner = 0.34 + vColor.r * 0.5 + vColor.g * 0.16;
        vec3 cyanLight = vec3(0.26, 0.82, 1.0) * (rim * 0.42 + uTreble * 0.12);
        vec3 finalColor = uColor * (inner * 0.62 + tissue * 0.2 + uLife * 0.14) + cyanLight;
        float alpha = uOpacity * (0.24 + inner * 0.34 + rim * 0.58) * tissue;
        if (alpha < 0.006) discard;
        gl_FragColor = vec4(finalColor, alpha);
      }
    `,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    side: THREE.DoubleSide,
    vertexColors: true,
  });
}

function createHeartLobeGeometry(compact: boolean, index: number) {
  const geometry = new THREE.IcosahedronGeometry(1, compact ? 1 : 2);
  const position = geometry.getAttribute('position');
  const colors = new Float32Array(position.count * 3);
  for (let vertex = 0; vertex < position.count; vertex += 1) {
    const x = position.getX(vertex);
    const y = position.getY(vertex);
    const z = position.getZ(vertex);
    const irregularity = 1 + Math.sin(x * 3.7 + y * 2.9 + z * 4.3 + index) * 0.075;
    position.setXYZ(vertex, x * irregularity, y * irregularity * (1.05 + index * 0.035), z * irregularity * 0.82);
    const energy = 0.55 + Math.max(0, y) * 0.28 + (index === 0 ? 0.16 : 0);
    colors[vertex * 3] = energy;
    colors[vertex * 3 + 1] = energy;
    colors[vertex * 3 + 2] = energy;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function smoothstep(edgeStart: number, edgeEnd: number, value: number) {
  const progress = Math.min(1, Math.max(0, (value - edgeStart) / Math.max(0.00001, edgeEnd - edgeStart)));
  return progress * progress * (3 - 2 * progress);
}

function sampleSwimmingCycle(phase: number) {
  const normalized = ((phase % 1) + 1) % 1;
  if (normalized < 0.24) return THREE.MathUtils.lerp(0, 0.24, smoothstep(0, 0.24, normalized));
  if (normalized < 0.46) return THREE.MathUtils.lerp(0.24, -1, smoothstep(0.24, 0.46, normalized));
  if (normalized < 0.78) return THREE.MathUtils.lerp(-1, -0.06, smoothstep(0.46, 0.78, normalized));
  return THREE.MathUtils.lerp(-0.06, 0, smoothstep(0.78, 1, normalized));
}

function sampleHeartEnvelope(age: number, release = 0.33) {
  const end = 0.09 + release;
  if (age <= 0 || age >= end) return 0;
  if (age < 0.06) return smoothstep(0, 0.06, age);
  if (age < 0.09) return 1;
  return 1 - smoothstep(0.09, end, age);
}

function medianBeatInterval(values: Float32Array, count: number, scratch: Float32Array) {
  const safeCount = Math.min(values.length, Math.max(0, count));
  for (let index = 0; index < safeCount; index += 1) scratch[index] = values[index];
  for (let index = 1; index < safeCount; index += 1) {
    const value = scratch[index];
    let cursor = index - 1;
    while (cursor >= 0 && scratch[cursor] > value) {
      scratch[cursor + 1] = scratch[cursor];
      cursor -= 1;
    }
    scratch[cursor + 1] = value;
  }
  if (safeCount === 0) return 0;
  const middle = Math.floor(safeCount / 2);
  return safeCount % 2 === 0 ? (scratch[middle - 1] + scratch[middle]) * 0.5 : scratch[middle];
}

function sampleCatmullSpine(controls: Float32Array, progress: number, target: { x: number; y: number }) {
  const controlCount = controls.length / 2;
  const scaled = Math.min(controlCount - 1, Math.max(0, progress) * (controlCount - 1));
  const index = Math.min(controlCount - 2, Math.floor(scaled));
  const local = scaled - index;
  const previous = Math.max(0, index - 1);
  const next = Math.min(controlCount - 1, index + 1);
  const following = Math.min(controlCount - 1, index + 2);
  const localSquared = local * local;
  const localCubed = localSquared * local;
  const sample = (axis: number) => 0.5 * (
    2 * controls[index * 2 + axis]
    + (-controls[previous * 2 + axis] + controls[next * 2 + axis]) * local
    + (2 * controls[previous * 2 + axis] - 5 * controls[index * 2 + axis] + 4 * controls[next * 2 + axis] - controls[following * 2 + axis]) * localSquared
    + (-controls[previous * 2 + axis] + 3 * controls[index * 2 + axis] - 3 * controls[next * 2 + axis] + controls[following * 2 + axis]) * localCubed
  );
  target.x = sample(0);
  target.y = sample(1);
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
  const indices = new Uint16Array((pointCount - 1) * 6);
  for (let index = 0; index < pointCount - 1; index += 1) {
    const next = index + 1;
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

function dynamicSurfaceGeometry(positions: Float32Array, rows: number, columns: number) {
  const geometry = dynamicGeometry(positions);
  const indices = new Uint16Array((rows - 1) * (columns - 1) * 6);
  let cursor = 0;
  for (let row = 0; row < rows - 1; row += 1) {
    for (let column = 0; column < columns - 1; column += 1) {
      const current = row * columns + column;
      const nextRow = current + columns;
      indices[cursor] = current;
      indices[cursor + 1] = current + 1;
      indices[cursor + 2] = nextRow + 1;
      indices[cursor + 3] = current;
      indices[cursor + 4] = nextRow + 1;
      indices[cursor + 5] = nextRow;
      cursor += 6;
    }
  }
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.setDrawRange(0, indices.length);
  return geometry;
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

function createSpiritProfile(seed: number, phenotype: SoundSpiritPhenotypeConfig) {
  const random = seededRandom(seed);
  const orientation = Math.PI * 0.5 + 0.24;
  const moteCount = Math.min(moteLimit, Math.round(12 * phenotype.particleRichness));
  const motes = Array.from({ length: moteCount }, () => ({
    along: -1.15 + random() * 2,
    side: (random() - 0.5) * (0.8 + random() * 0.55),
    speed: 0.11 + random() * 0.27,
    phase: random() * Math.PI * 2,
    scatter: 0.16 + random() * 0.28,
  }));

  return {
    bodyRadius: 0.225 * phenotype.bodyFullness,
    bodyLength: 2.55 * phenotype.bodyLength,
    bodyWidth: 0.78 * phenotype.bodyFullness,
    bodyAsymmetry: 0.1 + Math.abs(phenotype.bodyAsymmetry),
    orientation,
    flowDirection: orientation,
    wingLength: 1.62 * phenotype.wingSpan,
    wingChord: 0.52 * phenotype.wingHeight,
    wingPhaseOffset: Math.PI * 0.18,
    wakePhase: random() * Math.PI * 2,
    moteCount,
    motes,
    trailDensity: Math.min(118, Math.round(88 * phenotype.particleRichness)),
    bassSensitivity: 1.02,
    midSensitivity: 1.08,
    trebleSensitivity: 1.06,
    rhythmSensitivity: 1.04,
    breathPhase: random() * Math.PI * 2,
    veilDelay: 0.04 + random() * 0.04,
    ribbonDelay: 0.07 + random() * 0.06,
    moteDelay: 0.1 + random() * 0.06,
    glowIntensity: 0.86 * phenotype.glowIntensity,
    wanderSpeed: 0.2,
    wanderPhase: 2.34,
    turningTendency: 0.42,
    escapeCommitment: 1.45,
    repulsorCommitment: 0.9,
    escapePhase: 1.7,
    onsetSensitivity: 1.02,
    avoidanceSensitivity: 1.04,
    spawnX: 0,
    spawnY: 0,
    particleRichness: phenotype.particleRichness,
    primaryHue: phenotype.primaryColor,
    secondaryHue: phenotype.secondaryColor,
    highlightHue: phenotype.accentColor,
    highlightColor: phenotype.energyColor,
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
