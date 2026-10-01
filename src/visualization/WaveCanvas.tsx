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
const bodyRingCount = 34;
const bodyRadialSegments = 14;
const energyFlowCount = 3;
const energyFlowPointCount = 38;
const wakePointCount = 46;
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
    const bodySurfaceMaterial = new THREE.MeshBasicMaterial({ color: 0x9ddff5, vertexColors: true, depthTest: false, depthWrite: false, transparent: true, opacity: 0.24, side: THREE.FrontSide });
    const bodyInnerMaterial = new THREE.MeshBasicMaterial({ color: 0xdff8ff, vertexColors: true, depthTest: false, depthWrite: false, transparent: true, opacity: 0.18, side: THREE.FrontSide });
    const bodyGlowMaterial = new THREE.MeshBasicMaterial({ color: 0x8edfff, vertexColors: true, depthTest: false, depthWrite: false, transparent: true, opacity: 0.09, blending: THREE.AdditiveBlending, side: THREE.FrontSide });
    const wingMaterials = [
      new THREE.MeshBasicMaterial({ color: 0x79cfee, vertexColors: true, depthTest: false, depthWrite: false, transparent: true, opacity: 0.2, side: THREE.DoubleSide }),
      new THREE.MeshBasicMaterial({ color: 0xa99bea, vertexColors: true, depthTest: false, depthWrite: false, transparent: true, opacity: 0.22, side: THREE.DoubleSide }),
    ];
    const wingEdgeMaterials = [
      new THREE.LineBasicMaterial({ color: 0x71ddff, vertexColors: true, depthTest: false, transparent: true, opacity: 0.46, blending: THREE.AdditiveBlending }),
      new THREE.LineBasicMaterial({ color: 0xc8f8ff, vertexColors: true, depthTest: false, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending }),
    ];
    const energyFlowMaterials = Array.from({ length: energyFlowCount }, (_, index) => new THREE.MeshBasicMaterial({ color: index === 1 ? 0xffe3b0 : 0xaeefff, vertexColors: true, depthTest: false, depthWrite: false, transparent: true, opacity: 0.24, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    const wakeMaterial = new THREE.MeshBasicMaterial({ color: 0x77dbff, vertexColors: true, depthTest: false, depthWrite: false, transparent: true, opacity: 0.11, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const moteMaterial = new THREE.PointsMaterial({ color: 0xffe4a8, depthTest: false, size: 4, transparent: true, opacity: 0.86, sizeAttenuation: false, blending: THREE.AdditiveBlending });
    const particleMaterial = new THREE.PointsMaterial({ color: 0x65cfff, depthTest: false, size: 1.2, transparent: true, opacity: 0.34, sizeAttenuation: false, blending: THREE.AdditiveBlending });

    const spiritTexture = new THREE.TextureLoader().load(new URL('assets/sound-spirit-master.png', document.baseURI).href);
    spiritTexture.colorSpace = THREE.SRGBColorSpace;
    spiritTexture.minFilter = THREE.LinearFilter;
    spiritTexture.magFilter = THREE.LinearFilter;
    const spiritVertexShader = `
      varying vec2 vUv;
      uniform float uTime;
      uniform float uLife;
      uniform float uStroke;
      uniform float uPart;
      void main() {
        vUv = uv;
        vec3 transformed = position;
        if (uPart == 1.0) {
          float span = clamp((0.49 - uv.x) / 0.16, 0.0, 1.0);
          float wave = sin(uTime * (0.8 + uLife * 1.4) - span * 2.2) * uStroke;
          transformed.y += wave * span * 0.052;
          transformed.x -= wave * span * 0.024;
          transformed.z -= abs(wave) * span * 0.06;
        } else if (uPart == 2.0) {
          float span = clamp((uv.x - 0.52) / 0.15, 0.0, 1.0);
          float wave = sin(uTime * (0.8 + uLife * 1.4) - span * 2.2 + 0.56) * uStroke * 1.05;
          transformed.y -= wave * span * 0.048;
          transformed.x += wave * span * 0.022;
          transformed.z += wave * span * 0.065;
        } else if (uPart == 0.0) {
          float bodyProgress = clamp((0.7 - uv.y) / 0.43, 0.0, 1.0);
          transformed.x += sin(uTime * 0.45 + bodyProgress * 2.1) * (0.004 + uLife * 0.012) * bodyProgress;
          transformed.y += sin(uTime * 0.62 + bodyProgress) * uLife * 0.004;
        }
        gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
      }
    `;
    const spiritFragmentShader = `
      varying vec2 vUv;
      uniform sampler2D uTexture;
      uniform float uPart;
      uniform float uOpacity;
      uniform float uLife;
      uniform float uBass;
      uniform float uTreble;
      float ellipseMask(vec2 point, vec2 center, vec2 radius) {
        vec2 normalized = (point - center) / radius;
        return 1.0 - smoothstep(0.72, 1.08, length(normalized));
      }
      float segmentDistance(vec2 point, vec2 start, vec2 end) {
        vec2 line = end - start;
        float position = clamp(dot(point - start, line) / dot(line, line), 0.0, 1.0);
        return length(point - (start + line * position));
      }
      void main() {
        vec4 source = texture2D(uTexture, vUv);
        float luminance = max(source.r, max(source.g, source.b));
        float imageAlpha = smoothstep(0.035, 0.19, luminance) * source.a;
        float bounds = smoothstep(0.33, 0.38, vUv.x) * (1.0 - smoothstep(0.73, 0.77, vUv.x));
        bounds *= smoothstep(0.23, 0.28, vUv.y) * (1.0 - smoothstep(0.76, 0.81, vUv.y));
        float body = 1.0 - smoothstep(0.055, 0.115, segmentDistance(vUv, vec2(0.47, 0.71), vec2(0.68, 0.28)));
        body = max(body, ellipseMask(vUv, vec2(0.47, 0.7), vec2(0.065, 0.085)));
        float leftWing = ellipseMask(vUv, vec2(0.43, 0.54), vec2(0.11, 0.14));
        float rightWing = ellipseMask(vUv, vec2(0.57, 0.61), vec2(0.095, 0.115));
        float mask = uPart == 0.0 ? body : uPart == 1.0 ? leftWing : uPart == 2.0 ? rightWing : bounds;
        float energy = uLife * 0.42 + uBass * 0.2 + uTreble * 0.12;
        vec3 color = source.rgb * (0.92 + energy);
        color += vec3(0.08, 0.28, 0.42) * uTreble * imageAlpha;
        float alpha = imageAlpha * mask * uOpacity;
        if (alpha < 0.004) discard;
        gl_FragColor = vec4(color, alpha);
      }
    `;
    const createSpiritMaterial = (part: number, opacity: number) => new THREE.ShaderMaterial({
      uniforms: {
        uTexture: { value: spiritTexture },
        uTime: { value: 0 },
        uLife: { value: 0 },
        uStroke: { value: 0.3 },
        uBass: { value: 0 },
        uTreble: { value: 0 },
        uPart: { value: part },
        uOpacity: { value: opacity },
      },
      vertexShader: spiritVertexShader,
      fragmentShader: spiritFragmentShader,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: part === 3 ? THREE.AdditiveBlending : THREE.NormalBlending,
      side: THREE.DoubleSide,
    });
    const spiritMaterials = [createSpiritMaterial(0, 1.15), createSpiritMaterial(1, 1.05), createSpiritMaterial(2, 1.05), createSpiritMaterial(3, 0.16)];
    const spiritPlaneGeometry = new THREE.PlaneGeometry(1.2, 0.8, compact ? 28 : 48, compact ? 18 : 32);
    const spiritMeshes = spiritMaterials.map((material) => new THREE.Mesh(spiritPlaneGeometry, material));
    const approvedSpirit = new THREE.Group();
    spiritMeshes.forEach((mesh, index) => {
      mesh.renderOrder = 4 + index;
      approvedSpirit.add(mesh);
    });
    spiritMeshes[0].position.z = 0.02;
    spiritMeshes[1].position.z = -0.035;
    spiritMeshes[2].position.z = 0.045;
    spiritMeshes[3].scale.set(1.07, 1.07, 1);
    approvedSpirit.visible = false;

    const wavePositions = new Float32Array(wavePointLimit * 3);
    const waveColors = new Float32Array(wavePointLimit * 3);
    const secondaryPositions = new Float32Array(wavePointLimit * 3);
    const samplePositions = new Float32Array(samplePointLimit * 3);
    const sampleStemPositions = new Float32Array(samplePointLimit * 2 * 3);
    const playheadPositions = new Float32Array(2 * 3);
    const playheadMarkerPositions = new Float32Array(3);
    const bodyVertexCount = bodyRingCount * (bodyRadialSegments + 1);
    const bodySurfacePositions = new Float32Array(bodyVertexCount * 3);
    const bodyInnerPositions = new Float32Array(bodyVertexCount * 3);
    const bodyGlowPositions = new Float32Array(bodyVertexCount * 3);
    const bodySurfaceColors = new Float32Array(bodyVertexCount * 3);
    const bodyInnerColors = new Float32Array(bodyVertexCount * 3);
    const bodyGlowColors = new Float32Array(bodyVertexCount * 3);
    const wingSpanSegments = compact ? 18 : 28;
    const wingChordSegments = compact ? 6 : 10;
    const wingVertexCount = (wingSpanSegments + 1) * (wingChordSegments + 1);
    const wingPositions = [new Float32Array(wingVertexCount * 3), new Float32Array(wingVertexCount * 3)];
    const wingColors = [new Float32Array(wingVertexCount * 3), new Float32Array(wingVertexCount * 3)];
    const wingEdgePositions = [new Float32Array((wingSpanSegments + 1) * 3), new Float32Array((wingSpanSegments + 1) * 3)];
    const wingEdgeColors = [new Float32Array((wingSpanSegments + 1) * 3), new Float32Array((wingSpanSegments + 1) * 3)];
    const energyFlowPositions = Array.from({ length: energyFlowCount }, () => new Float32Array(energyFlowPointCount * 2 * 3));
    const energyFlowColors = Array.from({ length: energyFlowCount }, () => new Float32Array(energyFlowPointCount * 2 * 3));
    const wakePositions = new Float32Array(wakePointCount * 2 * 3);
    const wakeColors = new Float32Array(wakePointCount * 2 * 3);
    const motePositions = new Float32Array(moteLimit * 3);
    const particlePositions = new Float32Array(particleCount * 3);
    const particleSeeds = new Float32Array(particleCount * 3);

    const waveGeometry = dynamicGeometry(wavePositions);
    waveGeometry.setAttribute('color', new THREE.BufferAttribute(waveColors, 3).setUsage(THREE.DynamicDrawUsage));
    const secondaryGeometry = dynamicGeometry(secondaryPositions);
    const pointGeometry = dynamicGeometry(samplePositions);
    const stemGeometry = dynamicGeometry(sampleStemPositions);
    const playheadGeometry = dynamicGeometry(playheadPositions);
    const playheadMarkerGeometry = dynamicGeometry(playheadMarkerPositions);
    const bodySurfaceGeometry = dynamicSurfaceGeometry(bodySurfacePositions, bodyRingCount, bodyRadialSegments + 1);
    const bodyInnerGeometry = dynamicSurfaceGeometry(bodyInnerPositions, bodyRingCount, bodyRadialSegments + 1);
    const bodyGlowGeometry = dynamicSurfaceGeometry(bodyGlowPositions, bodyRingCount, bodyRadialSegments + 1);
    bodySurfaceGeometry.setAttribute('color', new THREE.BufferAttribute(bodySurfaceColors, 3).setUsage(THREE.DynamicDrawUsage));
    bodyInnerGeometry.setAttribute('color', new THREE.BufferAttribute(bodyInnerColors, 3).setUsage(THREE.DynamicDrawUsage));
    bodyGlowGeometry.setAttribute('color', new THREE.BufferAttribute(bodyGlowColors, 3).setUsage(THREE.DynamicDrawUsage));
    const wingGeometries = wingPositions.map((positions, index) => {
      const geometry = dynamicSurfaceGeometry(positions, wingSpanSegments + 1, wingChordSegments + 1);
      geometry.setAttribute('color', new THREE.BufferAttribute(wingColors[index], 3).setUsage(THREE.DynamicDrawUsage));
      return geometry;
    });
    const wingEdgeGeometries = wingEdgePositions.map((positions, index) => {
      const geometry = dynamicGeometry(positions);
      geometry.setAttribute('color', new THREE.BufferAttribute(wingEdgeColors[index], 3).setUsage(THREE.DynamicDrawUsage));
      geometry.setDrawRange(0, wingSpanSegments + 1);
      return geometry;
    });
    const energyFlowGeometries = energyFlowPositions.map((positions, index) => {
      const geometry = dynamicBandGeometry(positions, energyFlowPointCount);
      geometry.setAttribute('color', new THREE.BufferAttribute(energyFlowColors[index], 3).setUsage(THREE.DynamicDrawUsage));
      return geometry;
    });
    const wakeGeometry = dynamicBandGeometry(wakePositions, wakePointCount);
    wakeGeometry.setAttribute('color', new THREE.BufferAttribute(wakeColors, 3).setUsage(THREE.DynamicDrawUsage));
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
    const bodySurface = new THREE.Mesh(bodySurfaceGeometry, bodySurfaceMaterial);
    const bodyInner = new THREE.Mesh(bodyInnerGeometry, bodyInnerMaterial);
    const bodyGlow = new THREE.Mesh(bodyGlowGeometry, bodyGlowMaterial);
    const wings = wingGeometries.map((geometry, index) => new THREE.Mesh(geometry, wingMaterials[index]));
    const wingEdges = wingEdgeGeometries.map((geometry, index) => new THREE.Line(geometry, wingEdgeMaterials[index]));
    const energyFlows = energyFlowGeometries.map((geometry, index) => new THREE.Mesh(geometry, energyFlowMaterials[index]));
    const energyWake = new THREE.Mesh(wakeGeometry, wakeMaterial);
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
    const corePetalMaterials = Array.from({ length: 4 }, () => new THREE.SpriteMaterial({ map: haloTexture, color: 0xffe0a8, depthTest: false, transparent: true, opacity: 0, blending: THREE.AdditiveBlending }));
    const corePetals = corePetalMaterials.map((material) => new THREE.Sprite(material));

    particles.renderOrder = 0;
    musicHalo.renderOrder = 1;
    secondaryLine.renderOrder = 2;
    wings[0].renderOrder = 1;
    bodyGlow.renderOrder = 2;
    bodySurface.renderOrder = 3;
    bodyInner.renderOrder = 4;
    wings[1].renderOrder = 5;
    wingEdges[0].renderOrder = 6;
    wingEdges[1].renderOrder = 7;
    energyFlows.forEach((flow, index) => { flow.renderOrder = 7.2 + index * 0.05; });
    motes.renderOrder = 9;
    energyWake.renderOrder = 2.5;
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
      approvedSpirit,
      musicHalo,
      secondaryLine,
      energyWake,
      wings[0],
      bodyGlow,
      bodySurface,
      bodyInner,
      wings[1],
      ...wingEdges,
      ...energyFlows,
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
    let rmsEnergy = 0;
    let spectralCentroid = 0;
    let fastEnergy = 0;
    let slowEnergy = 0;
    let adaptivePeak = 0.025;
    let adaptiveVariancePeak = 0.01;
    let localVariance = 0;
    let longTermEnergy = 0.04;
    let shortTermPeak = 0.08;
    let lifeEnergy = 0;
    let previousOverallEnergy = 0;
    let previousRelativeEnergy = 0;
    let onsetPulse = 0;
    let rhythmImpulse = 0;
    let veilPulse = 0;
    let ribbonPulse = 0;
    let motePulse = 0;
    let contractionPulse = 0;
    let rhythmClock = 0;
    let pendingVeilPulse = 0;
    let pendingVeilAt = -1;
    let pendingRibbonPulse = 0;
    let pendingRibbonAt = -1;
    let pendingMotePulse = 0;
    let pendingMoteAt = -1;
    let profileSeed = -1;
    let creatureGenome = createSpiritProfile(musicVisualSeed);
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
    const wingSpring = [new Float32Array(3), new Float32Array(3)];
    const wingVelocity = [new Float32Array(3), new Float32Array(3)];

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
      approvedSpirit.visible = false;
      bodySurface.visible = false;
      bodyInner.visible = false;
      bodyGlow.visible = false;
      wings.forEach((wing) => { wing.visible = false; });
      wingEdges.forEach((edge) => { edge.visible = false; });
      energyFlows.forEach((flow) => { flow.visible = false; });
      energyWake.visible = false;
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
      let squaredEnergy = 0;
      let weightedEnergy = 0;
      let spectralEnergy = 0;
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
      const lifeTarget = playing && overallEnergy > 0.002 ? Math.min(1, Math.max(0.2, lifeSignal)) : 0;
      const lifeRate = lifeTarget > lifeEnergy ? 3.1 : 1.35;
      lifeEnergy += (lifeTarget - lifeEnergy) * (1 - Math.exp(-deltaTime * lifeRate));
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
      if (nextImpulse > (playing ? 0.055 : 0.16) && nextImpulse >= pendingVeilPulse) {
        contractionPulse = Math.max(contractionPulse, nextImpulse);
        pendingVeilPulse = nextImpulse;
        pendingVeilAt = rhythmClock + creatureGenome.veilDelay;
        pendingRibbonPulse = nextImpulse;
        pendingRibbonAt = rhythmClock + creatureGenome.ribbonDelay;
        pendingMotePulse = nextImpulse;
        pendingMoteAt = rhythmClock + creatureGenome.moteDelay;
      }
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

    const updateSpiritPhysics = (time: number, deltaTime: number, current: WaveCanvasProps) => {
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
      const desiredSpeed = (0.014 + activity * creatureGenome.wanderSpeed * 0.13 + rhythmImpulse * 0.045) * motionScale;
      let accelerationX = (Math.cos(wanderAngle) * desiredSpeed - creatureVelocityX) * (0.42 + creatureGenome.turningTendency);
      let accelerationY = (Math.sin(wanderAngle) * desiredSpeed - creatureVelocityY) * (0.42 + creatureGenome.turningTendency);
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
          const impulse = influence * (0.04 + Math.min(0.18, swipeSpeed * 0.06));
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
          const rippleImpulse = influence * 0.09;
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
        const escapeSpeed = (0.11 + nearestThreat * 0.16 + startlePulse * 0.08) * motionScale;
        accelerationX = (awayX * escapeSpeed - creatureVelocityX) * 4.4;
        accelerationY = (awayY * escapeSpeed - creatureVelocityY) * 4.4;
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
      const maxSpeed = (0.075 + overallEnergy * 0.07 + threatResponse * 0.16 + startlePulse * 0.12 + (time < escapeUntil ? 0.06 : 0)) * motionScale;
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
    };


    const drawSoundSpirit = (time: number, deltaTime: number, current: WaveCanvasProps) => {
      const viewportAspect = Math.min(1, canvasHeight / canvasWidth);
      const scale = current.creatureScale ?? 1;
      const baseRadius = creatureGenome.bodyRadius * scale;
      const motionScale = reducedMotion ? 0.34 : 1;
      const speed = Math.hypot(creatureVelocityX, creatureVelocityY);
      const movementHeading = speed > 0.002 ? Math.atan2(creatureVelocityY, creatureVelocityX) : creatureHeading;
      const turnDelta = Math.atan2(Math.sin(movementHeading - creatureGenome.orientation), Math.cos(movementHeading - creatureGenome.orientation));
      const bodyAngle = creatureGenome.orientation + turnDelta * 0.16;
      const upX = Math.cos(bodyAngle);
      const upY = Math.sin(bodyAngle);
      const sideX = -upY;
      const sideY = upX;
      const idleBreath = Math.sin(time * 0.72 + creatureGenome.breathPhase) * 0.018 * motionScale;
      const bassDrive = current.musicPlaying ? bassEnergy * creatureGenome.bassSensitivity : 0;
      const midDrive = current.musicPlaying ? midEnergy * creatureGenome.midSensitivity : 0;
      const trebleDrive = current.musicPlaying ? trebleEnergy * creatureGenome.trebleSensitivity : 0;
      const bodyLength = baseRadius * creatureGenome.bodyLength * (1 + lifeEnergy * 0.075 - bassDrive * 0.045 - contractionPulse * 0.035);
      const bodyWidth = baseRadius * creatureGenome.bodyWidth * (1 + idleBreath + bassDrive * 0.12 + veilPulse * 0.05);
      const bodyBend = turnDelta * baseRadius * 0.14 + Math.sin(time * (0.55 + midDrive * 0.5)) * baseRadius * (0.016 + lifeEnergy * 0.055) * motionScale;
      const bodyPositionSets = [bodySurfacePositions, bodyInnerPositions, bodyGlowPositions];
      const bodyColorSets = [bodySurfaceColors, bodyInnerColors, bodyGlowColors];
      const bodyScales = [1, 0.68, 1.08];

      for (let layerIndex = 0; layerIndex < bodyPositionSets.length; layerIndex += 1) {
        const positions = bodyPositionSets[layerIndex];
        const colors = bodyColorSets[layerIndex];
        const layerScale = bodyScales[layerIndex];
        for (let ring = 0; ring < bodyRingCount; ring += 1) {
          const progress = ring / (bodyRingCount - 1);
          const lowerRound = 0.62 + 0.38 * Math.sin(Math.min(1, progress / 0.3) * Math.PI * 0.5);
          const upperRound = 0.58 + 0.42 * Math.sin(Math.min(1, (1 - progress) / 0.16) * Math.PI * 0.5);
          const longTorso = 0.34 + progress * 0.28;
          const shoulder = Math.exp(-Math.pow((progress - 0.72) / 0.32, 2)) * 0.17;
          const headVolume = Math.exp(-Math.pow((progress - 0.92) / 0.18, 2)) * 0.12;
          const radiusProfile = (longTorso + shoulder + headVolume) * lowerRound * upperRound;
          const along = (progress - 0.47) * bodyLength;
          const bend = bodyBend * Math.sin(progress * Math.PI) + Math.sin(time * 0.32 + progress * 2.4) * baseRadius * 0.01 * motionScale;
          const centerX = creatureX + (upX * along + sideX * bend) * viewportAspect;
          const centerY = creatureY + upY * along + sideY * bend;
          const radius = bodyWidth * radiusProfile * layerScale;
          for (let radial = 0; radial <= bodyRadialSegments; radial += 1) {
            const radialProgress = radial / bodyRadialSegments;
            const theta = radialProgress * Math.PI * 2;
            const sideOffset = Math.cos(theta) * radius;
            const depthOffset = Math.sin(theta) * radius * 0.72;
            const index = (ring * (bodyRadialSegments + 1) + radial) * 3;
            positions[index] = centerX + sideX * sideOffset * viewportAspect;
            positions[index + 1] = centerY + sideY * sideOffset;
            positions[index + 2] = depthOffset + (layerIndex - 1) * 0.004;
            const centerGlow = Math.pow(Math.abs(Math.sin(theta)), 0.7);
            const edgeGlow = Math.pow(Math.abs(Math.cos(theta)), 2.2);
            const longitudinal = 0.35 + Math.pow(Math.sin(progress * Math.PI), 0.55) * 0.65;
            const intensity = longitudinal * (layerIndex === 0 ? 0.34 + centerGlow * 0.46 + edgeGlow * 0.2 : layerIndex === 1 ? 0.3 + centerGlow * 0.7 : 0.22 + edgeGlow * 0.5);
            colors[index] = intensity;
            colors[index + 1] = intensity;
            colors[index + 2] = intensity;
          }
        }
      }

      const idleAmplitude = 0.3;
      const musicAmplitude = lifeEnergy * 0.44;
      const accentAmplitude = ribbonPulse * 0.15;
      const startleFold = startlePulse * 0.42;
      const wingRate = 0.62 + lifeEnergy * 1.15 + midDrive * 0.45;
      for (let wingIndex = 0; wingIndex < 2; wingIndex += 1) {
        const direction = wingIndex === 0 ? -1 : 1;
        const asymmetry = wingIndex === 0 ? 0.92 : 1.06;
        const lengthAsymmetry = wingIndex === 0 ? 0.94 : 1.04;
        const phaseOffset = wingIndex === 0 ? 0 : creatureGenome.wingPhaseOffset;
        const turnBias = Math.max(-0.12, Math.min(0.12, turnDelta * direction * 0.1));
        for (let zone = 0; zone < 3; zone += 1) {
          const propagation = zone * (0.34 + lifeEnergy * 0.08);
          const target = Math.sin(time * wingRate + phaseOffset - propagation) * (idleAmplitude + musicAmplitude + accentAmplitude) * asymmetry + turnBias - startleFold;
          const stiffness = 18 - zone * 2.1;
          const damping = 6.2 - zone * 0.45;
          wingVelocity[wingIndex][zone] += (target - wingSpring[wingIndex][zone]) * stiffness * deltaTime;
          wingVelocity[wingIndex][zone] *= Math.exp(-damping * deltaTime);
          wingSpring[wingIndex][zone] += wingVelocity[wingIndex][zone] * deltaTime;
        }

        const positions = wingPositions[wingIndex];
        const colors = wingColors[wingIndex];
        for (let spanIndex = 0; spanIndex <= wingSpanSegments; spanIndex += 1) {
          const span = spanIndex / wingSpanSegments;
          const zonePosition = span * 2;
          const zoneIndex = Math.min(1, Math.floor(zonePosition));
          const zoneBlend = zonePosition - zoneIndex;
          const stroke = wingSpring[wingIndex][zoneIndex] * (1 - zoneBlend) + wingSpring[wingIndex][zoneIndex + 1] * zoneBlend;
          const phase = time * wingRate + phaseOffset - span * (0.72 + lifeEnergy * 0.22);
          const spanEase = Math.sin(span * Math.PI * 0.5);
          const rootBlend = Math.sin(Math.min(1, span / 0.22) * Math.PI * 0.5);
          const outward = baseRadius * creatureGenome.wingLength * lengthAsymmetry * spanEase * (0.86 + lifeEnergy * 0.22 + bassDrive * 0.08 + speed * 0.7);
          const rootSide = bodyWidth * (0.5 + span * 0.18);
          const verticalSweep = baseRadius * (0.16 - span * 0.28 + stroke * (0.09 + span * 0.2));
          const backwardSweep = Math.cos(phase) * baseRadius * (0.035 + span * 0.09) * motionScale;
          const centerAlong = bodyLength * 0.17 + verticalSweep + baseRadius * (wingIndex === 0 ? -0.045 : 0.035);
          const centerSide = direction * (rootSide + outward + backwardSweep);
          const membraneEnvelope = (0.22 * (1 - span) + Math.pow(Math.sin(span * Math.PI), 0.58)) * rootBlend;
          const halfChord = baseRadius * creatureGenome.wingChord * membraneEnvelope * (1 + midDrive * 0.22);
          for (let chordIndex = 0; chordIndex <= wingChordSegments; chordIndex += 1) {
            const chord = chordIndex / wingChordSegments * 2 - 1;
            const chordCurve = Math.sqrt(Math.max(0, 1 - chord * chord));
            const surfaceWave = Math.sin(phase - chord * 0.38) * baseRadius * (0.025 + lifeEnergy * 0.045) * span * chordCurve * motionScale;
            const localAlong = centerAlong + chord * halfChord;
            const localSide = centerSide + direction * chord * chord * baseRadius * 0.025 * span;
            const index = (spanIndex * (wingChordSegments + 1) + chordIndex) * 3;
            positions[index] = creatureX + (upX * localAlong + sideX * localSide) * viewportAspect;
            positions[index + 1] = creatureY + upY * localAlong + sideY * localSide;
            positions[index + 2] = (wingIndex === 0 ? -0.07 : 0.055) + surfaceWave + stroke * baseRadius * 0.045 * span;
            const chordCenter = Math.pow(chordCurve, 0.62);
            const rim = Math.pow(Math.abs(chord), 3);
            const intensity = (0.22 + chordCenter * 0.46 + rim * (0.16 + trebleDrive * 0.24)) * Math.pow(Math.sin(Math.min(0.999, span) * Math.PI), 0.2);
            colors[index] = intensity;
            colors[index + 1] = intensity;
            colors[index + 2] = intensity;
          }
          const edgeVertex = (spanIndex * (wingChordSegments + 1)) * 3;
          const edgeIndex = spanIndex * 3;
          wingEdgePositions[wingIndex][edgeIndex] = positions[edgeVertex];
          wingEdgePositions[wingIndex][edgeIndex + 1] = positions[edgeVertex + 1];
          wingEdgePositions[wingIndex][edgeIndex + 2] = positions[edgeVertex + 2] + 0.002;
          const edgeIntensity = Math.pow(Math.sin(span * Math.PI), 0.4) * (0.42 + trebleDrive * 0.52 + motePulse * 0.12);
          wingEdgeColors[wingIndex].fill(edgeIntensity, edgeIndex, edgeIndex + 3);
        }
      }

      const heartAlong = bodyLength * 0.18;
      const heartSide = bodyBend * 0.35;
      const heartX = creatureX + (upX * heartAlong + sideX * heartSide) * viewportAspect;
      const heartY = creatureY + upY * heartAlong + sideY * heartSide;
      for (let flowIndex = 0; flowIndex < energyFlowCount; flowIndex += 1) {
        const positions = energyFlowPositions[flowIndex];
        const colors = energyFlowColors[flowIndex];
        const toWing = flowIndex < 2;
        const direction = flowIndex === 0 ? -1 : 1;
        const flowSpeed = 0.45 + lifeEnergy * 1.9 + midDrive * 0.55;
        for (let pointIndex = 0; pointIndex < energyFlowPointCount; pointIndex += 1) {
          const progress = pointIndex / (energyFlowPointCount - 1);
          const along = toWing ? heartAlong * (1 - progress) + bodyLength * 0.15 * progress : heartAlong - bodyLength * 0.58 * progress;
          const side = toWing ? direction * baseRadius * creatureGenome.wingLength * 0.54 * Math.pow(progress, 1.35) : Math.sin(progress * Math.PI * 1.4 + time * 0.3) * baseRadius * 0.055;
          const travelling = Math.sin(progress * Math.PI * 5 - time * flowSpeed + flowIndex * 1.7) * baseRadius * 0.018 * progress;
          const centerX = creatureX + (upX * along + sideX * (side + travelling)) * viewportAspect;
          const centerY = creatureY + upY * along + sideY * (side + travelling);
          const width = baseRadius * (toWing ? 0.022 : 0.028) * Math.pow(Math.sin(progress * Math.PI), 0.6) * (0.7 + lifeEnergy * 0.55);
          const offset = pointIndex * 6;
          positions[offset] = centerX + sideX * width * viewportAspect;
          positions[offset + 1] = centerY + sideY * width;
          positions[offset + 2] = 0.066;
          positions[offset + 3] = centerX - sideX * width * viewportAspect;
          positions[offset + 4] = centerY - sideY * width;
          positions[offset + 5] = 0.066;
          const pulse = 0.38 + 0.42 * Math.pow(0.5 + 0.5 * Math.sin(progress * Math.PI * 3 - time * flowSpeed), 2);
          const intensity = Math.pow(Math.sin(progress * Math.PI), 0.45) * pulse * (0.7 + lifeEnergy * 0.45);
          colors.fill(intensity, offset, offset + 6);
        }
      }

      const wakeDirectionX = -upX * 0.78 - Math.cos(movementHeading) * 0.22;
      const wakeDirectionY = -upY * 0.78 - Math.sin(movementHeading) * 0.22;
      for (let index = 0; index < wakePointCount; index += 1) {
        const progress = index / (wakePointCount - 1);
        const fade = Math.pow(1 - progress, 1.65);
        const lag = Math.sin(progress * Math.PI * 2.2 + time * (0.28 + lifeEnergy * 0.8) + creatureGenome.wakePhase) * baseRadius * 0.12 * progress;
        const along = bodyLength * 0.43 + baseRadius * (0.28 + lifeEnergy * 0.62 + speed * 2.4) * progress;
        const centerX = creatureX + (wakeDirectionX * along + sideX * (lag - turnDelta * baseRadius * progress * 0.08)) * viewportAspect;
        const centerY = creatureY + wakeDirectionY * along + sideY * (lag - turnDelta * baseRadius * progress * 0.08);
        const width = baseRadius * 0.11 * fade * (0.35 + lifeEnergy * 0.85 + trebleDrive * 0.28);
        const offset = index * 6;
        wakePositions[offset] = centerX + sideX * width * viewportAspect;
        wakePositions[offset + 1] = centerY + sideY * width;
        wakePositions[offset + 2] = -0.09;
        wakePositions[offset + 3] = centerX - sideX * width * viewportAspect;
        wakePositions[offset + 4] = centerY - sideY * width;
        wakePositions[offset + 5] = -0.09;
        const intensity = fade * (0.2 + lifeEnergy * 0.62 + trebleDrive * 0.25 + motePulse * 0.12);
        wakeColors.fill(intensity, offset, offset + 6);
      }

      const activeMotes = Math.min(compact ? 7 : moteLimit, creatureGenome.moteCount);
      for (let index = 0; index < activeMotes; index += 1) {
        const mote = creatureGenome.motes[index];
        const drift = Math.sin(time * mote.speed * (1 + lifeEnergy) + mote.phase) * (0.1 + lifeEnergy * 0.18);
        const along = baseRadius * (mote.along + drift - motePulse * mote.scatter * 0.12);
        const side = baseRadius * (mote.side + Math.cos(time * mote.speed + mote.phase) * (0.08 + trebleDrive * 0.08));
        writeOrganicPoint(motePositions, index, creatureX + (upX * along + sideX * side) * viewportAspect, creatureY + upY * along + sideY * side);
      }
      moteGeometry.setDrawRange(0, activeMotes);

      [bodySurfaceGeometry, bodyInnerGeometry, bodyGlowGeometry, ...wingGeometries, ...wingEdgeGeometries, ...energyFlowGeometries, wakeGeometry, moteGeometry].forEach((geometry) => {
        geometry.attributes.position.needsUpdate = true;
        if (geometry.attributes.color) geometry.attributes.color.needsUpdate = true;
      });

      musicHalo.position.set(creatureX, creatureY, -0.2);
      const auraScale = baseRadius * (1.15 + lifeEnergy * 0.38 + startlePulse * 0.08);
      musicHalo.scale.set(auraScale * viewportAspect * 1.05, auraScale * 1.65, 1);
      innerCore.position.set(heartX, heartY, 0.075);
      const heartScale = baseRadius * (0.28 + idleBreath * 0.5 + lifeEnergy * 0.17 + bassDrive * 0.13 + onsetPulse * 0.065 + startlePulse * 0.05);
      innerCore.scale.set(heartScale * viewportAspect * 0.9, heartScale * 1.2, 1);
      corePetals.forEach((petal, index) => {
        const angle = bodyAngle + index * (Math.PI * 2 / corePetals.length) + Math.sin(time * (0.3 + lifeEnergy * 0.4) + index) * 0.2;
        const petalOffset = heartScale * (0.15 + index * 0.02);
        petal.position.set(heartX + Math.cos(angle) * petalOffset * viewportAspect, heartY + Math.sin(angle) * petalOffset, 0.07 + index * 0.001);
        petal.scale.set(heartScale * viewportAspect * (0.58 + index * 0.035), heartScale * (0.86 + index * 0.05), 1);
        petal.material.rotation = angle;
      });
    };

    const drawApprovedSpirit = (time: number, current: WaveCanvasProps) => {
      const viewportAspect = Math.min(1, canvasHeight / canvasWidth);
      const scale = current.creatureScale ?? 1;
      const speed = Math.hypot(creatureVelocityX, creatureVelocityY);
      const movementHeading = speed > 0.002 ? Math.atan2(creatureVelocityY, creatureVelocityX) : creatureHeading;
      const sourceHeading = 2.54;
      const breathing = reducedMotion ? 0 : Math.sin(time * 0.68 + creatureGenome.breathPhase) * 0.018;
      const presence = 0.96 + breathing + lifeEnergy * 0.08 + onsetPulse * 0.025;
      const turn = Math.atan2(Math.sin(movementHeading - sourceHeading), Math.cos(movementHeading - sourceHeading));

      approvedSpirit.visible = true;
      approvedSpirit.position.set(creatureX, creatureY, 0);
      approvedSpirit.rotation.z = (reducedMotion ? 0 : Math.sin(time * 0.24 + creatureGenome.wanderPhase) * 0.018) + turn * 0.008;
      approvedSpirit.scale.set(viewportAspect * scale * presence * 1.65, scale * presence * 1.65, 1);

      const wingStroke = (reducedMotion ? 0.12 : 0.25) + lifeEnergy * 0.48 + ribbonPulse * 0.18 - startlePulse * 0.08;
      spiritMaterials.forEach((material, index) => {
        material.uniforms.uTime.value = time;
        material.uniforms.uLife.value = lifeEnergy;
        material.uniforms.uStroke.value = wingStroke;
        material.uniforms.uBass.value = bassEnergy;
        material.uniforms.uTreble.value = trebleEnergy;
        material.uniforms.uOpacity.value = index === 3
          ? 0.09 + lifeEnergy * 0.12 + onsetPulse * 0.05
          : 0.98 + lifeEnergy * 0.12;
      });

      const activeMotes = Math.min(compact ? 7 : moteLimit, creatureGenome.moteCount);
      for (let index = 0; index < activeMotes; index += 1) {
        const mote = creatureGenome.motes[index];
        const orbit = time * mote.speed * (0.3 + lifeEnergy * 0.7) + mote.phase;
        const radius = 0.15 + Math.abs(mote.side) * 0.05 + trebleEnergy * 0.035;
        const scatter = motePulse * mote.scatter * 0.035;
        writeOrganicPoint(
          motePositions,
          index,
          creatureX + Math.cos(orbit) * (radius + scatter) * viewportAspect * scale,
          creatureY + Math.sin(orbit * 0.82) * (radius * 0.72 + scatter) * scale,
        );
      }
      moteGeometry.setDrawRange(0, activeMotes);
      moteGeometry.attributes.position.needsUpdate = true;
    };

    const drawSpectrum = (current: WaveCanvasProps, time: number, deltaTime: number) => {
      if (profileSeed !== current.musicVisualSeed) {
        profileSeed = current.musicVisualSeed ?? 1;
        creatureGenome = createSpiritProfile(profileSeed);
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
        longTermEnergy = 0.04;
        shortTermPeak = 0.08;
        lifeEnergy = 0;
        previousOverallEnergy = 0;
        previousRelativeEnergy = 0;
        rmsEnergy = 0;
        spectralCentroid = 0;
        onsetPulse = 0;
        rhythmImpulse = 0;
        veilPulse = 0;
        ribbonPulse = 0;
        motePulse = 0;
        contractionPulse = 0;
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
        bodySurfaceMaterial.color.setHex(0x9ddff5);
        bodyInnerMaterial.color.setHex(0xf5ffff);
        bodyGlowMaterial.color.setHex(creatureGenome.primaryHue);
        wingMaterials[0].color.setHex(0x79cfee);
        wingMaterials[1].color.setHex(0xa99bea);
        wingEdgeMaterials[0].color.setHex(creatureGenome.primaryHue);
        wingEdgeMaterials[1].color.setHex(creatureGenome.secondaryHue);
        energyFlowMaterials.forEach((material, index) => material.color.setHex(index === 1 ? creatureGenome.highlightHue : creatureGenome.primaryHue));
        wakeMaterial.color.setHex(creatureGenome.primaryHue);
        moteMaterial.color.setHex(creatureGenome.highlightHue);
        particleMaterial.color.setHex(creatureGenome.primaryHue);
        haloMaterial.color.setHex(creatureGenome.primaryHue);
        coreMaterial.color.setHex(creatureGenome.highlightColor);
        corePetalMaterials.forEach((material, index) => material.color.setHex(index % 3 === 0 ? creatureGenome.highlightHue : index % 3 === 1 ? creatureGenome.secondaryHue : creatureGenome.primaryHue));
      }
      updateSpiritPhysics(time, deltaTime, current);
      drawApprovedSpirit(time, current);

      bodySurface.visible = false;
      bodyInner.visible = false;
      bodyGlow.visible = false;
      wings.forEach((wing) => { wing.visible = false; });
      wingEdges.forEach((edge) => { edge.visible = false; });
      energyFlows.forEach((flow) => { flow.visible = false; });
      energyWake.visible = false;
      motes.visible = true;
      musicHalo.visible = false;
      innerCore.visible = false;
      corePetals.forEach((petal) => { petal.visible = false; });
      bodySurfaceMaterial.opacity = 0.045 + lifeEnergy * 0.025 + bassEnergy * 0.02;
      bodyInnerMaterial.opacity = 0.026 + lifeEnergy * 0.034 + bassEnergy * 0.024;
      bodyGlowMaterial.opacity = 0.012 + lifeEnergy * 0.032 + veilPulse * 0.018;
      wingMaterials.forEach((material, index) => { material.opacity = 0.15 + index * 0.018 + lifeEnergy * 0.12 + midEnergy * 0.08; });
      wingEdgeMaterials.forEach((material) => { material.opacity = 0.34 + trebleEnergy * 0.35 + ribbonPulse * 0.12; });
      energyFlowMaterials.forEach((material) => { material.opacity = 0.12 + lifeEnergy * 0.22 + midEnergy * 0.08; });
      wakeMaterial.opacity = 0.035 + lifeEnergy * 0.16 + trebleEnergy * 0.08;
      moteMaterial.opacity = 0.82 + trebleEnergy * 0.16 + onsetPulse * 0.02;
      moteMaterial.size = 4.8 + trebleEnergy * (reducedMotion ? 1.2 : 4.5) + startlePulse * 1.5;
      haloMaterial.opacity = creatureGenome.glowIntensity * (0.08 + lifeEnergy * 0.16 + onsetPulse * 0.08);
      coreMaterial.opacity = 0.78 + lifeEnergy * 0.14 + bassEnergy * 0.12 + onsetPulse * 0.08;
      corePetalMaterials.forEach((material, index) => { material.opacity = 0.18 + index * 0.018 + lifeEnergy * 0.14 + bassEnergy * 0.1 + onsetPulse * 0.08; });
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
          particlePositions[offset] = creatureX + (flowX * along + normalX * side) * Math.min(1, canvasHeight / canvasWidth);
          particlePositions[offset + 1] = creatureY + flowY * along + normalY * side;
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
      [waveGeometry, secondaryGeometry, pointGeometry, stemGeometry, playheadGeometry, playheadMarkerGeometry, bodySurfaceGeometry, bodyInnerGeometry, bodyGlowGeometry, moteGeometry, particleGeometry, sampleRingGeometry, wakeGeometry, spiritPlaneGeometry, ...wingGeometries, ...wingEdgeGeometries, ...energyFlowGeometries].forEach((geometry) => geometry.dispose());
      haloTexture.dispose();
      spiritTexture.dispose();
      [waveMaterial, secondaryMaterial, pointMaterial, pointGlowMaterial, contactMaterial, stemMaterial, ringMaterial, wavePointMaterial, playheadMaterial, playheadMarkerMaterial, bodySurfaceMaterial, bodyInnerMaterial, bodyGlowMaterial, moteMaterial, particleMaterial, haloMaterial, coreMaterial, wakeMaterial, ...spiritMaterials, ...corePetalMaterials, ...wingMaterials, ...wingEdgeMaterials, ...energyFlowMaterials].forEach((material) => material.dispose());
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

function createSpiritProfile(seed: number) {
  const random = seededRandom(seed);
  const orientation = Math.PI * 0.5 + 0.24;
  const moteCount = 12;
  const motes = Array.from({ length: moteCount }, () => ({
    along: -1.15 + random() * 2,
    side: (random() - 0.5) * (0.8 + random() * 0.55),
    speed: 0.11 + random() * 0.27,
    phase: random() * Math.PI * 2,
    scatter: 0.16 + random() * 0.28,
  }));

  return {
    bodyRadius: 0.135,
    bodyLength: 2.55,
    bodyWidth: 0.78,
    bodyAsymmetry: 0.1,
    orientation,
    flowDirection: orientation,
    wingLength: 1.4,
    wingChord: 0.34,
    wingPhaseOffset: Math.PI * 0.18,
    wakePhase: random() * Math.PI * 2,
    moteCount,
    motes,
    trailDensity: 88,
    bassSensitivity: 1.02,
    midSensitivity: 1.08,
    trebleSensitivity: 1.06,
    rhythmSensitivity: 1.04,
    breathPhase: random() * Math.PI * 2,
    veilDelay: 0.04 + random() * 0.04,
    ribbonDelay: 0.07 + random() * 0.06,
    moteDelay: 0.1 + random() * 0.06,
    glowIntensity: 0.86,
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
    primaryHue: 0x6ee7ff,
    secondaryHue: 0xa48bff,
    highlightHue: 0xffcf86,
    highlightColor: 0xffb968,
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
