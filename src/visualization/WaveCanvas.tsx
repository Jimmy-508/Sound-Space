import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { MusicSpectrumMode } from '../music/musicSession';
import type { PointerPoint, Waveform } from '../types';

interface WaveCanvasProps {
  amplitude: number;
  frequency: number;
  waveform?: Waveform;
  mode?: 'home' | 'wave' | 'sample' | 'quantize' | 'music';
  sampleCount?: number;
  bitDepth?: number;
  musicData?: Float32Array | null;
  spectrumData?: Uint8Array | null;
  musicProgress?: number;
  musicZoom?: number;
  musicViewStart?: number;
  musicVolume?: number;
  musicTime?: number;
  musicDnaSeed?: number;
  musicSpectrumMode?: MusicSpectrumMode;
  pointer: PointerPoint;
}

const wavePointLimit = 768;
const samplePointLimit = 64;
const spectrumBandCount = 64;
const dnaPointLimit = 128;
const particleCount = 220;

export function WaveCanvas({
  amplitude,
  frequency,
  waveform = 'sine',
  mode = 'wave',
  sampleCount = 16,
  bitDepth = 4,
  musicData = null,
  spectrumData = null,
  musicProgress = 0,
  musicZoom = 1,
  musicViewStart = 0,
  musicVolume = 0.8,
  musicTime = 0,
  musicDnaSeed = 1,
  musicSpectrumMode = 'radial',
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
    spectrumData,
    musicProgress,
    musicZoom,
    musicViewStart,
    musicVolume,
    musicTime,
    musicDnaSeed,
    musicSpectrumMode,
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
    spectrumData,
    musicProgress,
    musicZoom,
    musicViewStart,
    musicVolume,
    musicTime,
    musicDnaSeed,
    musicSpectrumMode,
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
    const dnaPrimaryPositions = new Float32Array((dnaPointLimit + 1) * 3);
    const dnaSecondaryPositions = new Float32Array((dnaPointLimit + 1) * 3);
    const dnaAccentPositions = new Float32Array((dnaPointLimit + 1) * 3);
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
    let profileSeed = -1;
    let dnaProfile = createDnaProfile(musicDnaSeed);

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
    };

    const writeDnaPoint = (positions: Float32Array, index: number, x: number, y: number) => {
      positions[index * 3] = x;
      positions[index * 3 + 1] = y;
      positions[index * 3 + 2] = 0;
    };

    const drawRadialSpectrum = (phase: number) => {
      const pointCount = spectrumBandCount + 1;
      const aspect = Math.min(1, canvasHeight / canvasWidth);
      for (let index = 0; index < pointCount; index += 1) {
        const bandIndex = index % spectrumBandCount;
        const angle = index / spectrumBandCount * Math.PI * 2 + phase * dnaProfile.direction;
        const energy = spectrumLevels[bandIndex];
        const peak = peakLevels[bandIndex];
        const ripple = Math.sin(angle * dnaProfile.lobes + dnaProfile.phase) * dnaProfile.curvature;
        const outer = 0.26 + energy * 0.42 + ripple * 0.035;
        const inner = 0.17 + energy * 0.14 + ripple * 0.018;
        writeDnaPoint(dnaPrimaryPositions, index, Math.cos(angle) * outer * aspect, Math.sin(angle) * outer);
        writeDnaPoint(dnaSecondaryPositions, index, Math.cos(-angle + dnaProfile.phase) * inner * aspect, Math.sin(-angle + dnaProfile.phase) * inner);
        const peakRadius = outer + 0.018 + peak * 0.045;
        writeDnaPoint(dnaAccentPositions, index, Math.cos(angle) * peakRadius * aspect, Math.sin(angle) * peakRadius);
      }
      setDnaDrawRange(pointCount);
    };

    const drawMirrorSpectrum = (phase: number) => {
      const pointCount = 96;
      for (let index = 0; index < pointCount; index += 1) {
        const t = index / Math.max(1, pointCount - 1);
        const distance = Math.abs(t * 2 - 1);
        const bandIndex = Math.min(spectrumBandCount - 1, Math.floor(distance * spectrumBandCount));
        const energy = spectrumLevels[bandIndex];
        const peak = peakLevels[bandIndex];
        const envelope = Math.sin(t * Math.PI) ** 0.55;
        const drift = Math.sin(t * Math.PI * dnaProfile.lobes + phase + dnaProfile.phase) * dnaProfile.curvature;
        const height = (0.035 + energy * 0.46) * envelope + drift * 0.08;
        const x = t * 1.72 - 0.86;
        writeDnaPoint(dnaPrimaryPositions, index, x, height);
        writeDnaPoint(dnaSecondaryPositions, index, x, -height * (0.72 + dnaProfile.symmetry * 0.22));
        writeDnaPoint(dnaAccentPositions, index, x, height + 0.012 + peak * 0.035);
      }
      setDnaDrawRange(pointCount);
    };

    const drawOrbitalSpectrum = (phase: number) => {
      const pointCount = spectrumBandCount + 1;
      const aspect = Math.min(1, canvasHeight / canvasWidth);
      for (let index = 0; index < pointCount; index += 1) {
        const t = index / spectrumBandCount;
        const angle = t * Math.PI * 2;
        const bassIndex = Math.min(15, Math.floor(t * 16));
        const midIndex = 16 + Math.min(27, Math.floor(t * 28));
        const trebleIndex = 44 + Math.min(19, Math.floor(t * 20));
        const bassRadius = 0.16 + spectrumLevels[bassIndex] * 0.22;
        const midRadius = 0.3 + spectrumLevels[midIndex] * 0.25;
        const trebleRadius = 0.44 + peakLevels[trebleIndex] * 0.2;
        const tilt = dnaProfile.tilt;
        writeDnaPoint(dnaPrimaryPositions, index, Math.cos(angle + phase) * bassRadius * aspect, Math.sin(angle + phase) * bassRadius * (0.78 + tilt));
        writeDnaPoint(dnaSecondaryPositions, index, Math.cos(-angle + phase * 0.58 + dnaProfile.phase) * midRadius * aspect, Math.sin(-angle + phase * 0.58 + dnaProfile.phase) * midRadius * (0.9 - tilt * 0.4));
        writeDnaPoint(dnaAccentPositions, index, Math.cos(angle + phase * 0.32) * trebleRadius * aspect, Math.sin(angle + phase * 0.32) * trebleRadius);
      }
      setDnaDrawRange(pointCount);
    };

    const setDnaDrawRange = (pointCount: number) => {
      dnaPrimaryGeometry.setDrawRange(0, pointCount);
      dnaSecondaryGeometry.setDrawRange(0, pointCount);
      dnaAccentGeometry.setDrawRange(0, pointCount);
      dnaPrimaryGeometry.attributes.position.needsUpdate = true;
      dnaSecondaryGeometry.attributes.position.needsUpdate = true;
      dnaAccentGeometry.attributes.position.needsUpdate = true;
    };

    const drawSpectrum = (data: Uint8Array, current: WaveCanvasProps) => {
      if (profileSeed !== current.musicDnaSeed) {
        profileSeed = current.musicDnaSeed ?? 1;
        dnaProfile = createDnaProfile(profileSeed);
      }
      updateSpectrumLevels(data, current.musicVolume ?? 0.8);
      const phase = (current.musicTime ?? 0) * dnaProfile.speed + dnaProfile.phase;
      if (current.musicSpectrumMode === 'mirror') drawMirrorSpectrum(phase);
      else if (current.musicSpectrumMode === 'orbital') drawOrbitalSpectrum(phase);
      else drawRadialSpectrum(phase);

      dnaPrimary.visible = true;
      dnaSecondary.visible = true;
      dnaAccent.visible = !reducedMotion;
      dnaSparks.visible = !reducedMotion;
      musicHalo.visible = true;
      dnaPrimaryMaterial.opacity = 0.66 + midEnergy * 0.32;
      dnaSecondaryMaterial.opacity = 0.34 + bassEnergy * 0.34;
      dnaAccentMaterial.opacity = 0.18 + trebleEnergy * 0.42;
      dnaSparkMaterial.opacity = 0.22 + trebleEnergy * 0.62;
      const haloScale = 0.46 + bassEnergy * (reducedMotion ? 0.18 : 0.5);
      musicHalo.scale.set(haloScale, haloScale, 1);
      haloMaterial.opacity = 0.06 + bassEnergy * 0.25;
    };

    const drawMusicWave = (current: WaveCanvasProps) => {
      const data = current.musicData;
      if (!data?.length) return false;
      displayedViewStart += ((current.musicViewStart ?? 0) - displayedViewStart) * (reducedMotion ? 1 : 0.16);
      displayedProgress += ((current.musicProgress ?? 0) - displayedProgress) * (reducedMotion ? 1 : 0.24);
      const zoom = Math.max(1, current.musicZoom ?? 1);
      const visibleFraction = 1 / zoom;
      const visualAmplitude = 0.08 + (current.musicVolume ?? 0.8) * 0.92;
      const pointTotal = Math.min(wavePointLimit, data.length);

      for (let index = 0; index < pointTotal; index += 1) {
        const t = index / Math.max(1, pointTotal - 1);
        const sourceT = Math.min(1, displayedViewStart + t * visibleFraction);
        const sourceIndex = Math.min(data.length - 1, Math.floor(sourceT * (data.length - 1)));
        const x = t * 1.8 - 0.9;
        const y = (data[sourceIndex] ?? 0) * 0.7 * visualAmplitude;
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
      const spectrumActive = current.mode === 'music' && Boolean(current.spectrumData?.length);
      hideSamples();
      hideMusicWave();

      if (spectrumActive && current.spectrumData) {
        waveLine.visible = false;
        wavePoints.visible = false;
        secondaryLine.visible = false;
        drawSpectrum(current.spectrumData, current);
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
      const spectrumActive = current.mode === 'music' && Boolean(current.spectrumData?.length);
      const motionScale = reducedMotion ? 0.18 : 1;
      const direction = dnaProfile.direction;
      for (let index = 0; index < particleCount; index += 1) {
        const offset = index * 3;
        if (spectrumActive) {
          const x = particlePositions[offset];
          const y = particlePositions[offset + 1];
          const orbit = (0.00008 + trebleEnergy * 0.00045) * direction * dnaProfile.orbit * motionScale;
          particlePositions[offset] = x - y * orbit + Math.sin(time + particleSeeds[offset + 2]) * trebleEnergy * 0.0003;
          particlePositions[offset + 1] = y + x * orbit + particleSeeds[offset + 1] * (0.00015 + midEnergy * 0.0011) * motionScale;
          if (Math.abs(particlePositions[offset]) > 1.12 || Math.abs(particlePositions[offset + 1]) > 1.12) {
            particlePositions[offset] = particleSeeds[offset] * 0.72;
            particlePositions[offset + 1] = -0.82 + (index % 9) * 0.03;
          }
          particlePositions[offset + 2] = bassEnergy * 0.08;
        } else {
          particlePositions[offset + 1] += Math.sin(time + index) * 0.0003 * motionScale;
          const px = current.pointer.x * 2 - 1;
          const py = 1 - current.pointer.y * 2;
          const dx = particlePositions[offset] - px;
          const dy = particlePositions[offset + 1] - py;
          particlePositions[offset + 2] = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) * 2.8) * 0.08;
        }
      }
      particleMaterial.opacity = spectrumActive ? 0.05 + midEnergy * 0.24 + trebleEnergy * 0.2 : 0.32;
      particleMaterial.size = spectrumActive ? 1 + trebleEnergy * (reducedMotion ? 0.7 : 2.2) : 1.2;
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

function createDnaProfile(seed: number) {
  const random = seededRandom(seed);
  return {
    phase: random() * Math.PI * 2,
    curvature: 0.28 + random() * 0.58,
    symmetry: 0.35 + random() * 0.65,
    lobes: 3 + Math.floor(random() * 6),
    tilt: (random() - 0.5) * 0.24,
    speed: 0.12 + random() * 0.18,
    orbit: 0.45 + random() * 0.75,
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
