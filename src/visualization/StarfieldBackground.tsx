import { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface StarLayerOptions {
  count: number;
  size: number;
  opacity: number;
  depthMin: number;
  depthMax: number;
  banded?: boolean;
  glow?: boolean;
  seed: number;
}

export function StarfieldBackground() {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const compact = window.innerWidth < 760;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, compact ? 1.15 : 1.35));
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 80);
    camera.position.z = 11;
    const glowTexture = createStarGlowTexture();
    const density = compact ? 0.52 : 1;
    const deepDust = createStarLayer({ count: Math.round(1100 * density), size: compact ? 1.05 : 0.9, opacity: 0.34, depthMin: -34, depthMax: -10, banded: true, seed: 508 });
    const galaxyDust = createStarLayer({ count: Math.round(820 * density), size: compact ? 1.35 : 1.15, opacity: 0.38, depthMin: -28, depthMax: -8, banded: true, glow: true, seed: 1307 });
    const brightStars = createStarLayer({ count: Math.round(360 * density), size: compact ? 2.1 : 1.8, opacity: 0.56, depthMin: -22, depthMax: -4, glow: true, seed: 2411 });
    const layers = [deepDust, galaxyDust, brightStars];
    layers.forEach((layer) => {
      if (layer.userData.useGlow) {
        (layer.material as THREE.PointsMaterial).map = glowTexture;
        (layer.material as THREE.PointsMaterial).needsUpdate = true;
      }
      scene.add(layer);
    });

    const resize = () => {
      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(1, mount.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(mount);

    let frame = 0;
    const animate = (time: number) => {
      frame = requestAnimationFrame(animate);
      if (!reducedMotion) {
        layers[0].rotation.y = time * 0.0000025;
        layers[1].rotation.y = -time * 0.0000038;
        layers[2].rotation.y = time * 0.000005;
        (layers[1].material as THREE.PointsMaterial).opacity = 0.36 + Math.sin(time * 0.00032) * 0.035;
        (layers[2].material as THREE.PointsMaterial).opacity = 0.52 + Math.sin(time * 0.00047 + 1.8) * 0.06;
      }
      renderer.render(scene, camera);
    };
    frame = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      mount.removeChild(renderer.domElement);
      renderer.dispose();
      layers.forEach((layer) => {
        layer.geometry.dispose();
        (layer.material as THREE.Material).dispose();
      });
      glowTexture.dispose();
    };
  }, []);

  return <div className="starfield-background" ref={mountRef} aria-hidden="true" />;
}

function createStarLayer({ count, size, opacity, depthMin, depthMax, banded = false, glow = false, seed }: StarLayerOptions) {
  const random = seededRandom(seed);
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  for (let index = 0; index < count; index += 1) {
    const depth = depthMin + random() * (depthMax - depthMin);
    const spread = 12 + Math.abs(depth) * 0.52;
    let x = (random() - 0.5) * spread * 2.2;
    let y = (random() - 0.5) * spread * 1.35;
    if (banded && random() < 0.72) {
      const along = (random() - 0.5) * spread * 2.3;
      const cross = gaussian(random) * spread * 0.12;
      x = along;
      y = along * -0.28 + cross + Math.sin(along * 0.24) * 0.8;
    }
    positions[index * 3] = x;
    positions[index * 3 + 1] = y;
    positions[index * 3 + 2] = depth;

    const highlight = random() < 0.08 ? 1.45 + random() * 0.65 : 0.72 + random() * 0.5;
    const warmth = random() * 0.12;
    colors[index * 3] = (0.62 + warmth) * highlight;
    colors[index * 3 + 1] = (0.78 + warmth) * highlight;
    colors[index * 3 + 2] = 1.08 * highlight;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    size,
    vertexColors: true,
    transparent: true,
    opacity,
    depthWrite: false,
    sizeAttenuation: false,
    blending: glow ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  const points = new THREE.Points(geometry, material);
  points.userData.useGlow = glow;
  return points;
}

function createStarGlowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  if (context) {
    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.18, 'rgba(226,242,255,0.88)');
    gradient.addColorStop(0.48, 'rgba(133,190,255,0.28)');
    gradient.addColorStop(1, 'rgba(90,150,255,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 64, 64);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  return texture;
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

function gaussian(random: () => number) {
  const first = Math.max(0.0001, random());
  const second = Math.max(0.0001, random());
  return Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * second);
}
