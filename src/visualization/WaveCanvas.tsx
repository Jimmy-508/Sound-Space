import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { PointerPoint, Waveform } from '../types';

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
  pointer: PointerPoint;
}

const wavePointLimit = 768;
const samplePointLimit = 64;
const spectrumBandCount = 64;
const organicPointLimit = 144;
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
    const playedMaterial = new THREE.LineBasicMaterial({ color: 0xc9fbff, depthTest: false, transparent: true, opacity: 0.98, blending: THREE.AdditiveBlending });
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
    const dnaAccentMaterial = new THREE.LineBasicMaterial({ color: 0xb3a9ff, depthTest: false, transparent: true, opacity: 0.42, blending: THREE.AdditiveBlending });
    const dnaSparkMaterial = new THREE.PointsMaterial({ color: 0xf4feff, depthTest: false, size: 3.8, transparent: true, opacity: 0.78, sizeAttenuation: false, blending: THREE.AdditiveBlending });
    const particleMaterial = new THREE.PointsMaterial({ color: 0x65cfff, depthTest: false, size: 1.2, transparent: true, opacity: 0.34, sizeAttenuation: false, blending: THREE.AdditiveBlending });

    const wavePositions = new Float32Array(wavePointLimit * 3);
    const playedPositions = new Float32Array(wavePointLimit * 3);
    const secondaryPositions = new Float32Array(wavePointLimit * 3);
    const samplePositions = new Float32Array(samplePointLimit * 3);
    const sampleStemPositions = new Float32Array(samplePointLimit * 2 * 3);
    const playheadPositions = new Float32Array(2 * 3);
    const playheadMarkerPositions = new Float32Array(3);
    const dnaPrimaryPositions = new Float32Array((organicPointLimit + 1) * 3);
    const dnaSecondaryPositions = new Float32Array((organicPointLimit + 1) * 3);
    const dnaAccentPositions = new Float32Array((organicPointLimit + 1) * 3);
    const particlePositions = new Float32Array(particleCount * 3);
    const particleSeeds = new Float32Array(particleCount * 3);

    const waveGeometry = dynamicGeometry(wavePositions);
    const playedGeometry = dynamicGeometry(playedPositions);
    const secondaryGeometry = dynamicGeometry(secondaryPositions);
    const pointGeometry = dynamicGeometry(samplePositions);
    const stemGeometry = dynamicGeometry(sampleStemPositions);
    const playheadGeometry = dynamicGeometry(playheadPositions);
    const playheadMarkerGeometry = dynamicGeometry(playheadMarkerPositions);
    const dnaPrimaryGeometry = dynamicGeometry(dnaPrimaryPositions);
    const dnaSecondaryGeometry = dynamicGeometry(dnaSecondaryPositions);
    const dnaAccentGeometry = dynamicGeometry(dnaAccentPositions);
    const particleGeometry = dynamicGeometry(particlePositions);

    const waveLine = new THREE.Line(waveGeometry, waveMaterial);
    const playedLine = new THREE.Line(playedGeometry, playedMaterial);
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
    const dnaSecondary = new THREE.Line(dnaSecondaryGeometry, dnaSecondaryMaterial);
    const dnaAccent = new THREE.Line(dnaAccentGeometry, dnaAccentMaterial);
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

    particles.renderOrder = 0;
    musicHalo.renderOrder = 1;
    secondaryLine.renderOrder = 2;
    dnaSecondary.renderOrder = 3;
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
    playedLine.renderOrder = 14;
    playheadLine.renderOrder = 15;
    playheadMarker.renderOrder = 16;
    scene.add(
      particles,
      musicHalo,
      secondaryLine,
      dnaSecondary,
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
      playedLine,
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
    let previousEnergy = 0;
    let onsetPulse = 0;
    let profileSeed = -1;
    let organicProfile = createOrganicProfile(musicVisualSeed);

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
      playedLine.visible = false;
      playheadLine.visible = false;
      playheadMarker.visible = false;
    };

    const hideSpectrum = () => {
      dnaPrimary.visible = false;
      dnaSecondary.visible = false;
      dnaAccent.visible = false;
      dnaSparks.visible = false;
      musicHalo.visible = false;
      bassEnergy = 0;
      midEnergy = 0;
      trebleEnergy = 0;
      overallEnergy = 0;
      onsetPulse *= 0.84;
    };

    const updateSpectrumLevels = (data: Uint8Array, volume: number) => {
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
        const rise = target > spectrumLevels[index] ? 0.48 : 0.09;
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
      const energyRise = Math.max(0, overallEnergy - previousEnergy);
      const bassRise = Math.max(0, bassEnergy - previousEnergy * 0.82);
      onsetPulse = Math.max(onsetPulse * (reducedMotion ? 0.76 : 0.9), Math.min(1, energyRise * 4.8 + bassRise * 1.7));
      previousEnergy += (overallEnergy - previousEnergy) * 0.2;
    };

    const writeOrganicPoint = (positions: Float32Array, index: number, x: number, y: number) => {
      positions[index * 3] = x;
      positions[index * 3 + 1] = y;
      positions[index * 3 + 2] = 0;
    };

    const drawOrganicSpectrum = (time: number) => {
      const pointCount = organicPointLimit + 1;
      const aspect = Math.min(1, canvasHeight / canvasWidth);
      const positionSets = [dnaPrimaryPositions, dnaSecondaryPositions, dnaAccentPositions];
      for (let organism = 0; organism < 3; organism += 1) {
        if (organism >= organicProfile.organismCount) continue;
        const positions = positionSets[organism];
        const slowPhase = time * organicProfile.driftSpeed[organism] * organicProfile.direction + organicProfile.phases[organism];
        const centerX = organicProfile.centersX[organism] + Math.sin(slowPhase * 0.73) * (0.035 + midEnergy * 0.045);
        const centerY = organicProfile.centersY[organism] + Math.cos(slowPhase * 0.61) * (0.03 + overallEnergy * 0.04);
        const breath = 1 + bassEnergy * 0.38 + onsetPulse * 0.2 + Math.sin(time * 0.7 + organicProfile.phases[organism]) * 0.035;
        for (let index = 0; index < pointCount; index += 1) {
          const t = index / organicPointLimit;
          const angle = t * Math.PI * 2;
          const bandPosition = ((t + organism * 0.21) % 1) * spectrumBandCount;
          const bandIndex = Math.floor(bandPosition) % spectrumBandCount;
          const nextBandIndex = (bandIndex + 1) % spectrumBandCount;
          const bandBlend = bandPosition - Math.floor(bandPosition);
          const energy = spectrumLevels[bandIndex] * (1 - bandBlend) + spectrumLevels[nextBandIndex] * bandBlend;
          const peak = peakLevels[bandIndex] * (1 - bandBlend) + peakLevels[nextBandIndex] * bandBlend;
          const localPulse = Math.sin(angle * organicProfile.lobes[organism] + slowPhase) * organicProfile.wobble[organism];
          const membraneRipple = Math.sin(angle * (organicProfile.lobes[organism] + 3) - time * 0.46 + energy * 2.4) * midEnergy * 0.055;
          const tendril = Math.max(0, Math.sin(angle * organicProfile.tendrils[organism] + slowPhase * 1.3)) ** 7 * (trebleEnergy * 0.11 + peak * 0.055);
          const radius = organicProfile.radii[organism] * breath + localPulse + membraneRipple + energy * (0.055 + organism * 0.012) + tendril;
          const twist = angle + Math.sin(angle * 2 + slowPhase) * (0.06 + midEnergy * 0.13);
          const x = centerX + Math.cos(twist) * radius * aspect * organicProfile.stretchX[organism];
          const y = centerY + Math.sin(angle) * radius * organicProfile.stretchY[organism];
          writeOrganicPoint(positions, index, x, y);
        }
      }
      setOrganicDrawRange(pointCount);
    };

    const setOrganicDrawRange = (pointCount: number) => {
      dnaPrimaryGeometry.setDrawRange(0, pointCount);
      dnaSecondaryGeometry.setDrawRange(0, pointCount);
      dnaAccentGeometry.setDrawRange(0, organicProfile.organismCount > 2 ? pointCount : 0);
      dnaPrimaryGeometry.attributes.position.needsUpdate = true;
      dnaSecondaryGeometry.attributes.position.needsUpdate = true;
      dnaAccentGeometry.attributes.position.needsUpdate = true;
    };

    const drawSpectrum = (data: Uint8Array, current: WaveCanvasProps) => {
      if (profileSeed !== current.musicVisualSeed) {
        profileSeed = current.musicVisualSeed ?? 1;
        organicProfile = createOrganicProfile(profileSeed);
      }
      updateSpectrumLevels(data, current.musicVolume ?? 0.8);
      drawOrganicSpectrum(current.musicTime ?? 0);

      dnaPrimary.visible = true;
      dnaSecondary.visible = true;
      dnaAccent.visible = !reducedMotion;
      dnaSparks.visible = !reducedMotion;
      musicHalo.visible = true;
      dnaPrimaryMaterial.opacity = 0.54 + midEnergy * 0.38 + onsetPulse * 0.08;
      dnaSecondaryMaterial.opacity = 0.3 + bassEnergy * 0.36;
      dnaAccentMaterial.opacity = 0.2 + trebleEnergy * 0.36;
      dnaSparkMaterial.opacity = 0.12 + trebleEnergy * 0.52 + onsetPulse * 0.16;
      const haloScale = 0.38 + bassEnergy * (reducedMotion ? 0.2 : 0.44) + onsetPulse * 0.12;
      musicHalo.scale.set(haloScale, haloScale, 1);
      haloMaterial.opacity = 0.045 + bassEnergy * 0.2 + onsetPulse * 0.08;
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
        playedPositions[index * 3] = x;
        playedPositions[index * 3 + 1] = y;
        playedPositions[index * 3 + 2] = 0;
        secondaryPositions[index * 3] = x;
        secondaryPositions[index * 3 + 1] = y * 0.34 - 0.39;
        secondaryPositions[index * 3 + 2] = 0;
      }

      const localProgress = (displayedProgress - displayedViewStart) / visibleFraction;
      const playedCount = Math.round(Math.min(1, Math.max(0, localProgress)) * pointTotal);
      waveGeometry.setDrawRange(0, pointTotal);
      playedGeometry.setDrawRange(0, playedCount);
      secondaryGeometry.setDrawRange(0, pointTotal);
      waveGeometry.attributes.position.needsUpdate = true;
      playedGeometry.attributes.position.needsUpdate = true;
      secondaryGeometry.attributes.position.needsUpdate = true;
      waveMaterial.opacity = 0.44;
      playedLine.visible = playedCount > 1;
      secondaryLine.visible = true;

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

    const drawWave = (time: number) => {
      const current = stateRef.current;
      const spectrumActive = current.mode === 'music' && current.musicData === null && Boolean(current.musicPcmData?.length);
      hideSamples();
      hideMusicWave();

      if (spectrumActive) {
        waveLine.visible = false;
        wavePoints.visible = false;
        secondaryLine.visible = false;
        drawSpectrum(current.spectrumData ?? silentSpectrumData, current);
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
      for (let index = 0; index < particleCount; index += 1) {
        const offset = index * 3;
        if (spectrumActive) {
          const organism = index % organicProfile.organismCount;
          const phase = particleSeeds[offset + 2] + time * (0.11 + particleSeeds[offset + 1] * 0.13) * organicProfile.direction * motionScale;
          const clusterRadius = organicProfile.radii[organism] * (0.65 + particleSeeds[offset + 1] * 1.5) + overallEnergy * 0.13 + onsetPulse * 0.07;
          const drift = time * organicProfile.driftSpeed[organism] + organicProfile.phases[organism];
          const centerX = organicProfile.centersX[organism] + Math.sin(drift * 0.73) * 0.045;
          const centerY = organicProfile.centersY[organism] + Math.cos(drift * 0.61) * 0.04;
          particlePositions[offset] = centerX + Math.cos(phase + Math.sin(time * 0.09 + index) * midEnergy) * clusterRadius * Math.min(1, canvasHeight / canvasWidth);
          particlePositions[offset + 1] = centerY + Math.sin(phase * (0.86 + particleSeeds[offset + 1] * 0.18)) * clusterRadius;
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
      particleMaterial.opacity = spectrumActive ? 0.13 + midEnergy * 0.2 + trebleEnergy * 0.3 : 0.32;
      particleMaterial.size = spectrumActive ? 2.6 + trebleEnergy * (reducedMotion ? 1.3 : 4.6) + onsetPulse * 1.4 : 1.2;
      particleGeometry.attributes.position.needsUpdate = true;
    };

    let frame = 0;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      drawWave(frame / 60);
      drawParticles(frame / 80);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      motionQuery.removeEventListener?.('change', updateMotionPreference);
      mount.removeChild(renderer.domElement);
      renderer.dispose();
      [waveGeometry, playedGeometry, secondaryGeometry, pointGeometry, stemGeometry, playheadGeometry, playheadMarkerGeometry, dnaPrimaryGeometry, dnaSecondaryGeometry, dnaAccentGeometry, particleGeometry, sampleRingGeometry].forEach((geometry) => geometry.dispose());
      haloTexture.dispose();
      [waveMaterial, playedMaterial, secondaryMaterial, pointMaterial, pointGlowMaterial, contactMaterial, stemMaterial, ringMaterial, wavePointMaterial, playheadMaterial, playheadMarkerMaterial, dnaPrimaryMaterial, dnaSecondaryMaterial, dnaAccentMaterial, dnaSparkMaterial, particleMaterial, haloMaterial].forEach((material) => material.dispose());
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

function createOrganicProfile(seed: number) {
  const random = seededRandom(seed);
  const organismCount = random() > 0.44 ? 3 : 2;
  return {
    organismCount,
    phases: [random() * Math.PI * 2, random() * Math.PI * 2, random() * Math.PI * 2],
    centersX: [-0.24 + random() * 0.15, 0.18 + random() * 0.18, (random() - 0.5) * 0.22],
    centersY: [(random() - 0.5) * 0.24, (random() - 0.5) * 0.28, (random() - 0.5) * 0.36],
    radii: [0.19 + random() * 0.1, 0.13 + random() * 0.08, 0.075 + random() * 0.07],
    stretchX: [0.9 + random() * 0.8, 0.8 + random() * 0.9, 0.75 + random() * 1.05],
    stretchY: [0.78 + random() * 0.55, 0.72 + random() * 0.62, 0.68 + random() * 0.72],
    wobble: [0.018 + random() * 0.035, 0.014 + random() * 0.032, 0.012 + random() * 0.028],
    lobes: [3 + Math.floor(random() * 5), 4 + Math.floor(random() * 6), 5 + Math.floor(random() * 7)],
    tendrils: [4 + Math.floor(random() * 5), 5 + Math.floor(random() * 7), 6 + Math.floor(random() * 8)],
    driftSpeed: [0.08 + random() * 0.08, 0.06 + random() * 0.09, 0.1 + random() * 0.12],
    direction: random() > 0.5 ? 1 : -1,
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
