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
  spectrumData?: Uint8Array | null;
  pointer: PointerPoint;
}

const wavePointLimit = 512;
const samplePointLimit = 64;
const spectrumBarLimit = 56;
const particleCount = 240;

export function WaveCanvas({
  amplitude,
  frequency,
  waveform = 'sine',
  mode = 'wave',
  sampleCount = 16,
  bitDepth = 4,
  musicData = null,
  spectrumData = null,
  pointer,
}: WaveCanvasProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef({ amplitude, frequency, waveform, mode, sampleCount, bitDepth, musicData, spectrumData, pointer });

  stateRef.current = { amplitude, frequency, waveform, mode, sampleCount, bitDepth, musicData, spectrumData, pointer };

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    camera.position.z = 2;

    const waveMaterial = new THREE.LineBasicMaterial({ color: 0x8fdfff, depthTest: false, transparent: true, opacity: 0.95 });
    const secondaryMaterial = new THREE.LineBasicMaterial({ color: 0x53a8ff, depthTest: false, transparent: true, opacity: 0.52 });
    const pointMaterial = new THREE.PointsMaterial({ color: 0xd9fbff, depthTest: false, size: 6, transparent: true, opacity: 0.96, sizeAttenuation: false });
    const pointGlowMaterial = new THREE.PointsMaterial({ color: 0x58dfff, depthTest: false, size: 14, transparent: true, opacity: 0.2, sizeAttenuation: false, blending: THREE.AdditiveBlending });
    const stemMaterial = new THREE.LineBasicMaterial({ color: 0x76dcff, depthTest: false, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending });
    const wavePointMaterial = new THREE.PointsMaterial({ color: 0xbef7ff, depthTest: false, size: 1.2, transparent: true, opacity: 0.58, sizeAttenuation: false });
    const particleMaterial = new THREE.PointsMaterial({ color: 0x65cfff, depthTest: false, size: 1.25, transparent: true, opacity: 0.42, sizeAttenuation: false, blending: THREE.AdditiveBlending });
    const peakMaterial = new THREE.PointsMaterial({ color: 0xf4feff, depthTest: false, size: 4.5, transparent: true, opacity: 0.9, sizeAttenuation: false, blending: THREE.AdditiveBlending });

    const wavePositions = new Float32Array(wavePointLimit * 3);
    const secondaryPositions = new Float32Array(wavePointLimit * 3);
    const samplePositions = new Float32Array(samplePointLimit * 3);
    const sampleStemPositions = new Float32Array(samplePointLimit * 2 * 3);
    const peakPositions = new Float32Array(spectrumBarLimit * 3);
    const particlePositions = new Float32Array(particleCount * 3);
    const particleSeeds = new Float32Array(particleCount * 3);

    const waveGeometry = dynamicGeometry(wavePositions);
    const secondaryGeometry = dynamicGeometry(secondaryPositions);
    const pointGeometry = dynamicGeometry(samplePositions);
    const stemGeometry = dynamicGeometry(sampleStemPositions);
    const peakGeometry = dynamicGeometry(peakPositions);
    const particleGeometry = dynamicGeometry(particlePositions);

    const waveLine = new THREE.Line(waveGeometry, waveMaterial);
    const wavePoints = new THREE.Points(waveGeometry, wavePointMaterial);
    const secondaryLine = new THREE.Line(secondaryGeometry, secondaryMaterial);
    const sampleStems = new THREE.LineSegments(stemGeometry, stemMaterial);
    const sampleGlowPoints = new THREE.Points(pointGeometry, pointGlowMaterial);
    const samplePoints = new THREE.Points(pointGeometry, pointMaterial);
    const spectrumPeaks = new THREE.Points(peakGeometry, peakMaterial);
    const particles = new THREE.Points(particleGeometry, particleMaterial);

    const barGeometry = new THREE.PlaneGeometry(1, 1);
    const barMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, transparent: true, opacity: 0.82, blending: THREE.AdditiveBlending });
    const barGlowMaterial = new THREE.MeshBasicMaterial({ color: 0x68cfff, depthTest: false, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending });
    const reflectionMaterial = new THREE.MeshBasicMaterial({ color: 0x4e9fff, depthTest: false, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending });
    const spectrumBars = new THREE.InstancedMesh(barGeometry, barMaterial, spectrumBarLimit);
    const spectrumGlow = new THREE.InstancedMesh(barGeometry, barGlowMaterial, spectrumBarLimit);
    const spectrumReflection = new THREE.InstancedMesh(barGeometry, reflectionMaterial, spectrumBarLimit);
    spectrumBars.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    spectrumGlow.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    spectrumReflection.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const haloTexture = createGlowTexture();
    const haloMaterial = new THREE.SpriteMaterial({ map: haloTexture, color: 0x72dcff, depthTest: false, transparent: true, opacity: 0, blending: THREE.AdditiveBlending });
    const musicHalo = new THREE.Sprite(haloMaterial);
    musicHalo.position.set(0, -0.04, -0.2);

    particles.renderOrder = 0;
    musicHalo.renderOrder = 1;
    spectrumReflection.renderOrder = 2;
    spectrumGlow.renderOrder = 3;
    spectrumBars.renderOrder = 4;
    secondaryLine.renderOrder = 5;
    sampleStems.renderOrder = 6;
    waveLine.renderOrder = 7;
    wavePoints.renderOrder = 8;
    sampleGlowPoints.renderOrder = 9;
    samplePoints.renderOrder = 10;
    spectrumPeaks.renderOrder = 11;
    scene.add(particles, musicHalo, spectrumReflection, spectrumGlow, spectrumBars, secondaryLine, sampleStems, waveLine, wavePoints, sampleGlowPoints, samplePoints, spectrumPeaks);

    for (let i = 0; i < particleCount; i += 1) {
      const ix = i * 3;
      const x = (Math.random() - 0.5) * 2;
      const y = (Math.random() - 0.5) * 2;
      particlePositions[ix] = x;
      particlePositions[ix + 1] = y;
      particleSeeds[ix] = x;
      particleSeeds[ix + 1] = 0.35 + Math.random() * 0.8;
      particleSeeds[ix + 2] = Math.random() * Math.PI * 2;
    }
    particleGeometry.attributes.position.needsUpdate = true;

    const barLevels = new Float32Array(spectrumBarLimit);
    const peakLevels = new Float32Array(spectrumBarLimit);
    const matrixHelper = new THREE.Object3D();
    const lowColor = new THREE.Color(0x76efff);
    const midColor = new THREE.Color(0x56a9ff);
    const highColor = new THREE.Color(0xa59cff);
    const mixedColor = new THREE.Color();
    let renderedBarCount = 0;
    let canvasWidth = 1;
    let displayedSampleCount = sampleCount;
    let bassEnergy = 0;
    let midEnergy = 0;
    let trebleEnergy = 0;

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reducedMotion = motionQuery.matches;
    const updateMotionPreference = (event: MediaQueryListEvent) => {
      reducedMotion = event.matches;
    };
    motionQuery.addEventListener?.('change', updateMotionPreference);

    const resize = () => {
      const rect = mount.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width || mount.clientWidth));
      const height = Math.max(1, Math.round(rect.height || mount.clientHeight));
      canvasWidth = width;
      renderer.setSize(width, height, false);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(mount);

    const hideSpectrum = () => {
      spectrumBars.visible = false;
      spectrumGlow.visible = false;
      spectrumReflection.visible = false;
      spectrumPeaks.visible = false;
      musicHalo.visible = false;
      bassEnergy = 0;
      midEnergy = 0;
      trebleEnergy = 0;
    };

    const drawSpectrum = (data: Uint8Array) => {
      const barCount = Math.max(32, Math.min(spectrumBarLimit, Math.round(canvasWidth / 18)));
      if (renderedBarCount !== barCount) {
        for (let i = 0; i < barCount; i += 1) {
          const t = i / Math.max(1, barCount - 1);
          mixedColor.copy(t < 0.58 ? lowColor : midColor);
          mixedColor.lerp(t < 0.58 ? midColor : highColor, t < 0.58 ? t / 0.58 : (t - 0.58) / 0.42);
          spectrumBars.setColorAt(i, mixedColor);
        }
        if (spectrumBars.instanceColor) spectrumBars.instanceColor.needsUpdate = true;
        renderedBarCount = barCount;
      }

      let bassTotal = 0;
      let midTotal = 0;
      let trebleTotal = 0;
      let bassCount = 0;
      let midCount = 0;
      let trebleCount = 0;
      const width = 1.66 / barCount;

      for (let i = 0; i < barCount; i += 1) {
        const start = logarithmicBin(i, barCount, data.length);
        const end = Math.max(start + 1, logarithmicBin(i + 1, barCount, data.length));
        let total = 0;
        let maximum = 0;
        for (let bin = start; bin < Math.min(end, data.length); bin += 1) {
          const value = data[bin] ?? 0;
          total += value;
          maximum = Math.max(maximum, value);
        }
        const groupedBinCount = Math.max(1, Math.min(end, data.length) - start);
        const target = Math.min(1, (total / groupedBinCount * 0.58 + maximum * 0.42) / 255);
        const rise = target > barLevels[i] ? 0.48 : 0.1;
        barLevels[i] += (target - barLevels[i]) * rise;
        peakLevels[i] = Math.max(barLevels[i], peakLevels[i] - (reducedMotion ? 0.018 : 0.009));

        const x = -0.83 + (i + 0.5) / barCount * 1.66;
        const height = 0.018 + barLevels[i] * 1.08;
        matrixHelper.position.set(x, -0.56 + height / 2, 0);
        matrixHelper.scale.set(width * 0.56, height, 1);
        matrixHelper.updateMatrix();
        spectrumBars.setMatrixAt(i, matrixHelper.matrix);

        matrixHelper.scale.set(width * 1.35, height * 1.04, 1);
        matrixHelper.updateMatrix();
        spectrumGlow.setMatrixAt(i, matrixHelper.matrix);

        const reflectionHeight = 0.01 + barLevels[i] * 0.2;
        matrixHelper.position.set(x, -0.59 - reflectionHeight / 2, 0);
        matrixHelper.scale.set(width * 0.5, reflectionHeight, 1);
        matrixHelper.updateMatrix();
        spectrumReflection.setMatrixAt(i, matrixHelper.matrix);

        peakPositions[i * 3] = x;
        peakPositions[i * 3 + 1] = -0.54 + peakLevels[i] * 1.08;
        peakPositions[i * 3 + 2] = 0;

        const band = i / barCount;
        if (band < 0.24) {
          bassTotal += barLevels[i];
          bassCount += 1;
        } else if (band < 0.68) {
          midTotal += barLevels[i];
          midCount += 1;
        } else {
          trebleTotal += barLevels[i];
          trebleCount += 1;
        }
      }

      bassEnergy = bassTotal / Math.max(1, bassCount);
      midEnergy = midTotal / Math.max(1, midCount);
      trebleEnergy = trebleTotal / Math.max(1, trebleCount);
      spectrumBars.count = barCount;
      spectrumGlow.count = barCount;
      spectrumReflection.count = barCount;
      spectrumBars.instanceMatrix.needsUpdate = true;
      spectrumGlow.instanceMatrix.needsUpdate = true;
      spectrumReflection.instanceMatrix.needsUpdate = true;
      peakGeometry.setDrawRange(0, barCount);
      peakGeometry.attributes.position.needsUpdate = true;

      spectrumBars.visible = true;
      spectrumGlow.visible = !reducedMotion;
      spectrumReflection.visible = !reducedMotion;
      spectrumPeaks.visible = true;
      musicHalo.visible = true;
      const haloScale = 0.55 + bassEnergy * (reducedMotion ? 0.22 : 0.52);
      musicHalo.scale.set(haloScale, haloScale, 1);
      haloMaterial.opacity = 0.08 + bassEnergy * 0.24;
    };

    const drawWave = (time: number) => {
      const current = stateRef.current;
      const spectrumActive = current.mode === 'music' && Boolean(current.spectrumData?.length);
      sampleStems.visible = false;
      sampleGlowPoints.visible = false;
      samplePoints.visible = false;

      if (spectrumActive && current.spectrumData) {
        waveLine.visible = false;
        wavePoints.visible = false;
        secondaryLine.visible = false;
        drawSpectrum(current.spectrumData);
        return;
      }

      hideSpectrum();
      waveLine.visible = true;
      const pointTotal = current.mode === 'music' && current.musicData ? Math.min(current.musicData.length, wavePointLimit) : 280;
      for (let i = 0; i < pointTotal; i += 1) {
        const t = i / Math.max(pointTotal - 1, 1);
        const x = t * 1.8 - 0.9;
        const y = resolveY(t, time, current);
        wavePositions[i * 3] = x;
        wavePositions[i * 3 + 1] = y;
        wavePositions[i * 3 + 2] = 0;

        secondaryPositions[i * 3] = x;
        secondaryPositions[i * 3 + 1] = current.mode === 'quantize' ? quantize(y, current.bitDepth) : y * 0.52 - 0.34;
        secondaryPositions[i * 3 + 2] = 0;
      }
      waveGeometry.setDrawRange(0, pointTotal);
      secondaryGeometry.setDrawRange(0, pointTotal);
      waveGeometry.attributes.position.needsUpdate = true;
      secondaryGeometry.attributes.position.needsUpdate = true;

      if (current.mode === 'sample') {
        displayedSampleCount += (current.sampleCount - displayedSampleCount) * (reducedMotion ? 1 : 0.2);
        if (Math.abs(current.sampleCount - displayedSampleCount) < 0.08) displayedSampleCount = current.sampleCount;
        const visibleSamples = Math.max(1, Math.min(samplePointLimit, Math.round(displayedSampleCount)));
        for (let i = 0; i < visibleSamples; i += 1) {
          const t = i / Math.max(visibleSamples - 1, 1);
          const x = t * 1.8 - 0.9;
          const y = resolveY(t, time, current);
          samplePositions[i * 3] = x;
          samplePositions[i * 3 + 1] = y;
          samplePositions[i * 3 + 2] = 0;
          const stemIndex = i * 6;
          sampleStemPositions[stemIndex] = x;
          sampleStemPositions[stemIndex + 1] = -0.62;
          sampleStemPositions[stemIndex + 2] = 0;
          sampleStemPositions[stemIndex + 3] = x;
          sampleStemPositions[stemIndex + 4] = y;
          sampleStemPositions[stemIndex + 5] = 0;
        }
        pointGeometry.setDrawRange(0, visibleSamples);
        stemGeometry.setDrawRange(0, visibleSamples * 2);
        pointGeometry.attributes.position.needsUpdate = true;
        stemGeometry.attributes.position.needsUpdate = true;
        sampleStems.visible = true;
        sampleGlowPoints.visible = !reducedMotion;
        samplePoints.visible = true;
      }

      secondaryLine.visible = current.mode === 'quantize' || (current.mode === 'music' && Boolean(current.musicData));
      wavePoints.visible = current.mode !== 'sample';
      waveMaterial.opacity = current.mode === 'home' ? 0.62 : 0.95;
      wavePointMaterial.opacity = current.mode === 'home' ? 0.34 : 0.58;
    };

    const drawParticles = (time: number) => {
      const current = stateRef.current;
      const spectrumActive = current.mode === 'music' && Boolean(current.spectrumData?.length);
      const motionScale = reducedMotion ? 0.22 : 1;
      for (let i = 0; i < particleCount; i += 1) {
        const ix = i * 3;
        if (spectrumActive) {
          particlePositions[ix] += Math.sin(time * 0.7 + particleSeeds[ix + 2]) * trebleEnergy * 0.0008 * motionScale;
          particlePositions[ix + 1] += (0.00035 + particleSeeds[ix + 1] * (0.0004 + midEnergy * 0.0032)) * motionScale;
          if (particlePositions[ix + 1] > 1) {
            particlePositions[ix] = particleSeeds[ix];
            particlePositions[ix + 1] = -1;
          }
          particlePositions[ix + 2] = bassEnergy * 0.08;
        } else {
          particlePositions[ix + 1] += Math.sin(time + i) * 0.0003 * motionScale;
          const px = current.pointer.x * 2 - 1;
          const py = 1 - current.pointer.y * 2;
          const dx = particlePositions[ix] - px;
          const dy = particlePositions[ix + 1] - py;
          particlePositions[ix + 2] = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) * 2.8) * 0.08;
        }
      }
      particleMaterial.opacity = spectrumActive ? 0.07 + midEnergy * 0.28 + trebleEnergy * 0.22 : 0.42;
      particleMaterial.size = spectrumActive ? 1 + trebleEnergy * (reducedMotion ? 0.8 : 2.4) : 1.25;
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
      waveGeometry.dispose();
      secondaryGeometry.dispose();
      pointGeometry.dispose();
      stemGeometry.dispose();
      peakGeometry.dispose();
      particleGeometry.dispose();
      barGeometry.dispose();
      haloTexture.dispose();
      waveMaterial.dispose();
      secondaryMaterial.dispose();
      pointMaterial.dispose();
      pointGlowMaterial.dispose();
      stemMaterial.dispose();
      wavePointMaterial.dispose();
      particleMaterial.dispose();
      peakMaterial.dispose();
      barMaterial.dispose();
      barGlowMaterial.dispose();
      reflectionMaterial.dispose();
      haloMaterial.dispose();
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

function logarithmicBin(index: number, barCount: number, binCount: number) {
  if (index <= 0) return 1;
  if (index >= barCount) return binCount;
  return Math.min(binCount - 1, Math.max(1, Math.round(Math.exp(index / barCount * Math.log(binCount)))));
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
  if (current.mode === 'music' && current.musicData?.length) {
    const index = Math.floor(t * (current.musicData.length - 1));
    return (current.musicData[index] ?? 0) * 0.76;
  }

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
