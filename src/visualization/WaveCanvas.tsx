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
  const stateRef = useRef({
    amplitude,
    frequency,
    waveform,
    mode,
    sampleCount,
    bitDepth,
    musicData,
    spectrumData,
    pointer,
  });

  stateRef.current = { amplitude, frequency, waveform, mode, sampleCount, bitDepth, musicData, spectrumData, pointer };

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    camera.position.z = 2;

    const waveMaterial = new THREE.LineBasicMaterial({ color: 0x8fdfff, depthTest: false, transparent: true, opacity: 0.95 });
    const secondaryMaterial = new THREE.LineBasicMaterial({ color: 0x53a8ff, depthTest: false, transparent: true, opacity: 0.52 });
    const pointMaterial = new THREE.PointsMaterial({
      color: 0xbef7ff,
      depthTest: false,
      size: 0.025,
      transparent: true,
      opacity: 0.9,
      sizeAttenuation: false,
    });
    const wavePointMaterial = new THREE.PointsMaterial({
      color: 0xbef7ff,
      depthTest: false,
      size: 0.012,
      transparent: true,
      opacity: 0.58,
      sizeAttenuation: false,
    });
    const particleMaterial = new THREE.PointsMaterial({
      color: 0x4fbfff,
      depthTest: false,
      size: 0.006,
      transparent: true,
      opacity: 0.5,
      sizeAttenuation: false,
    });

    const waveGeometry = new THREE.BufferGeometry();
    const secondaryGeometry = new THREE.BufferGeometry();
    const pointGeometry = new THREE.BufferGeometry();
    const particleGeometry = new THREE.BufferGeometry();

    const waveLine = new THREE.Line(waveGeometry, waveMaterial);
    const wavePoints = new THREE.Points(waveGeometry, wavePointMaterial);
    const secondaryLine = new THREE.Line(secondaryGeometry, secondaryMaterial);
    const samplePoints = new THREE.Points(pointGeometry, pointMaterial);
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    particles.renderOrder = 0;
    secondaryLine.renderOrder = 1;
    samplePoints.renderOrder = 2;
    waveLine.renderOrder = 3;
    wavePoints.renderOrder = 4;
    scene.add(particles, secondaryLine, waveLine, wavePoints, samplePoints);

    const particlePositions = new Float32Array(360 * 3);
    for (let i = 0; i < 360; i += 1) {
      particlePositions[i * 3] = (Math.random() - 0.5) * 2;
      particlePositions[i * 3 + 1] = (Math.random() - 0.5) * 2;
      particlePositions[i * 3 + 2] = 0;
    }
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));

    const resize = () => {
      const rect = mount.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width || mount.clientWidth));
      const height = Math.max(1, Math.round(rect.height || mount.clientHeight));
      renderer.setSize(width, height, false);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(mount);

    let frame = 0;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      drawWave(frame / 60);
      drawParticles(frame / 80);
      renderer.render(scene, camera);
    };

    const drawParticles = (time: number) => {
      const { pointer } = stateRef.current;
      for (let i = 0; i < 360; i += 1) {
        const ix = i * 3;
        const baseX = particlePositions[ix];
        particlePositions[ix + 1] += Math.sin(time + i) * 0.0003;
        const px = pointer.x * 2 - 1;
        const py = 1 - pointer.y * 2;
        const dx = baseX - px;
        const dy = particlePositions[ix + 1] - py;
        const nearby = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) * 2.8);
        particlePositions[ix + 2] = nearby * 0.08;
      }
      particleGeometry.attributes.position.needsUpdate = true;
    };

    const drawWave = (time: number) => {
      const current = stateRef.current;
      const pointTotal = current.mode === 'music' && current.musicData ? Math.min(current.musicData.length, 512) : 280;
      const positions = new Float32Array(pointTotal * 3);
      const secondary = new Float32Array(pointTotal * 3);
      const samples = new Float32Array(Math.min(current.sampleCount, 64) * 3);

      for (let i = 0; i < pointTotal; i += 1) {
        const t = i / Math.max(pointTotal - 1, 1);
        const x = t * 1.8 - 0.9;
        const y = resolveY(t, time, current);
        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = 0;

        const q = quantize(y, current.bitDepth);
        secondary[i * 3] = x;
        secondary[i * 3 + 1] = current.mode === 'quantize' ? q : y * 0.52 - 0.34;
        secondary[i * 3 + 2] = 0;
      }

      if (current.mode === 'sample') {
        for (let i = 0; i < current.sampleCount; i += 1) {
          const t = i / Math.max(current.sampleCount - 1, 1);
          samples[i * 3] = t * 1.8 - 0.9;
          samples[i * 3 + 1] = resolveY(t, time, current);
          samples[i * 3 + 2] = 0;
        }
      }

      waveGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      secondaryGeometry.setAttribute('position', new THREE.BufferAttribute(secondary, 3));
      pointGeometry.setAttribute('position', new THREE.BufferAttribute(samples, 3));
      samplePoints.visible = current.mode === 'sample';
      secondaryLine.visible = current.mode === 'quantize' || current.mode === 'music';
      wavePoints.visible = current.mode !== 'sample';
      waveMaterial.opacity = current.mode === 'home' ? 0.62 : 0.95;
      wavePointMaterial.opacity = current.mode === 'home' ? 0.34 : 0.58;
    };

    animate();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      mount.removeChild(renderer.domElement);
      renderer.dispose();
      waveGeometry.dispose();
      secondaryGeometry.dispose();
      pointGeometry.dispose();
      particleGeometry.dispose();
      waveMaterial.dispose();
      secondaryMaterial.dispose();
      pointMaterial.dispose();
      wavePointMaterial.dispose();
      particleMaterial.dispose();
    };
  }, []);

  return <div className="wave-canvas" ref={mountRef} aria-hidden="true" />;
}

function resolveY(t: number, time: number, current: WaveCanvasProps) {
  if (current.mode === 'music' && current.spectrumData?.length) {
    const index = Math.floor(t * (current.spectrumData.length - 1));
    return ((current.spectrumData[index] ?? 0) / 255 - 0.45) * 0.95;
  }
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
