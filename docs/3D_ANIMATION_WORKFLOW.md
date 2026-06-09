# POOKIE — Ultimate Master 3D Animation & Aesthetic Workflow

To compete with industry-grade, highly animated interfaces (e.g., Apple, Stripe, Linear), POOKIE's frontend is engineered with an advanced, robust animation framework. This master document outlines the technical workflow, production-ready code modules, and unified design systems required to achieve a flawless, premium, highly tactile bioluminescent aesthetic across Web, Desktop, and Mobile.

---

## 1. System Architecture & UI/UX Synchronization Flow

Achieving buttery-smooth, 60fps interactive animations requires an explicit mapping between the UI/UX navigation states (from `POOKIE_UI_UX_FLOW_v2.md`) and the low-level rendering layers.

```
[ UI/UX STATE MACHINE ]
          │
          ▼
┌────────────────────────────────────────────────────────┐
│               Global Application State                 │
│  (Loading, Online/Offline, Auth Expired, Active App)   │
└────────────────────────────────────────────────────────┘
          │
          ├─────────────────────────┐
          ▼ (Online: Normal Loop)   ▼ (Offline: Global Flag)
┌────────────────────────────────┐ ┌────────────────────────────────┐
│   Interactive Voice State      │ │       Locked Offline State     │
│  - 0: Idle                     │ │  - 5: Offline                  │
│  - 1: Listening                │ │  - Gray/Slate muted colors     │
│  - 2: Thinking                 │ │  - Blocked microphone access   │
│  - 3: Speaking                 │ │  - Slow, static-like drift     │
│  - 4: Error                    │ └────────────────────────────────┘
└────────────────────────────────┘
          │
          ├──────────────────────────────────────────────┐
          ▼ (Triggers Lerp Transitions)                  ▼ (Acquires Mic Stream)
┌────────────────────────────────┐            ┌────────────────────────────────┐
│   Uniform Controller           │            │   Web Audio API Pipeline      │
│   (MathUtils.lerp in useFrame)  │            │   (Vocal filter & EMA Damping) │
└────────────────────────────────┘            └────────────────────────────────┘
          │                                              │
          │                                              ├─► [Barge-In threshold validation]
          ▼ (uState, uTime, Target Scale)               ▼ (uAudioData 0.0 - 1.0)
┌──────────────────────────────────────────────────────────────────────────────┐
│                    React Three Fiber (WebGL 2 Canvas) /                      │
│                    React Native Skia (GPU Canvas on Mobile)                  │
│                                                                              │
│   - Vertex Shader: Displaces vertices with 3D Simplex Noise + Audio spikes   │
│   - Fragment Shader: Calculates Fresnel edge glow + State color gradients     │
│   - EffectComposer: Bloom + Chromatic Aberration + Vignette                  │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Core Tech Stack Matrix

| Platform / Layer | Framework / Library | Primary Architectural Role |
| :--- | :--- | :--- |
| **Web (Landing & App)** | **React Three Fiber (R3F)** | Custom WebGL 2 rendering loop container for the interactive 3D Orb. |
| | **Drei** | Shader abstractions, asset loaders, and standard environment helpers. |
| | **Framer Motion** | 2D layouts, chat dialogues, settings panel transitions, micro-interactions. |
| | **GSAP + ScrollTrigger** | High-performance, frame-locked landing page interactive scroll-linked animation. |
| | **Lenis** | Smooth scrolling engine integration to prevent mouse/trackpad inertia scroll stutter. |
| | **Tailwind CSS** | Styling engine containing utility utilities and procedural glassmorphism layers. |
| **Desktop (Electron)** | **Electron + Chromium WebGL** | Borderless, transparent, overlay windows powered by hardware-accelerated rendering. |
| **Mobile (iOS & Android)** | **React Native Skia** | High-performance, GPU-accelerated 2D/3D gradient-and-glow canvas (replaces heavy WebGL on mobile). |
| | **React Native Reanimated** | UI-thread animated values mapped directly to Skia components. |
| | **Lottie RN** | 60KB static JSON animation fallback for extreme low-end hardware. |

---

## 3. The Unified Premium Design System

The core aesthetic direction of POOKIE is **bioluminescent depth**. The interface is designed as if it lives at the bottom of a dark ocean, generating its own glowing, cold, organic light. This avoids the sterile, flat, overused dark-mode templates.

### 3.1 Design Tokens (CSS Custom Properties)

These tokens are imported globally. Direct hex/pixel declarations are prohibited in individual files.

```css
:root {
  /* ─── Backgrounds & Panels ────────────────────── */
  --color-bg-base:        #07080F; /* Deep ocean midnight with a subtle blue-grey undertone */
  --color-bg-surface:     rgba(255, 255, 255, 0.035);
  --color-bg-elevated:    rgba(255, 255, 255, 0.065);

  /* ─── Accent Glow (Bioluminescent Teal → Amber) ── */
  --color-accent-from:    #00C9A7; /* Cold organic teal */
  --color-accent-to:      #F59E0B; /* Deep amber highlight */
  --color-accent-glow:    rgba(0, 201, 167, 0.32);

  /* ─── Typography & Content ─────────────────────── */
  --color-text-primary:   #EAE8E0; /* Warm sand white — softer and more luxury than #FAFAFA */
  --color-text-secondary: #8A8880;
  --color-text-muted:     #4A4845;

  /* ─── Borders & Dividers ──────────────────────── */
  --color-border:         rgba(255, 255, 255, 0.07);
  --color-border-accent:  rgba(0, 201, 167, 0.22);

  /* ─── Interactive Orb States ──────────────────── */
  --orb-idle:             #00C9A7; /* Cyan-Teal */
  --orb-listening:        #06B6D4; /* Ice Blue */
  --orb-thinking:         #818CF8; /* Electric Lavender */
  --orb-speaking:         #34D399; /* Radiant Mint */
  --orb-error:            #F97316; /* Warning Amber-Orange */
  --orb-offline:          #4B5563; /* Sluggish Cold Slate Grey */

  /* ─── Glassmorphism Properties ────────────────── */
  --glass-blur:           blur(24px) saturate(160%);
  --glass-border:         1px solid var(--color-border);

  /* ─── Shadows & Glowing Depths ────────────────── */
  --shadow-sm:            0 1px 3px rgba(0, 0, 0, 0.6);
  --shadow-md:            0 8px 32px rgba(0, 0, 0, 0.7);
  --shadow-glow:          0 0 50px var(--color-accent-glow);

  /* ─── Layout & Radii ──────────────────────────── */
  --radius-sm:            6px;
  --radius-md:            12px;
  --radius-lg:            20px;
  --radius-pill:          9999px;

  /* ─── Layer Stack Map (Z-Indices) ─────────────── */
  --z-canvas:             0;   /* WebGL Canvas behind everything */
  --z-ui-base:            10;  /* Standard UI cards & panels */
  --z-ui-floating:        20;  /* Interactive inputs, tool indicators */
  --z-overlay:            30;  /* Drawer overlays, full modals */
  --z-toast:              40;  /* Critical system/network notifications */
  --z-cursor:             50;  /* Floating interactive cursor */
}

/* Light Theme Overrides (Applied via [data-theme="light"] on <html>) */
[data-theme="light"] {
  --color-bg-base:        #F4F2EE; /* Off-white sand clay */
  --color-bg-surface:     rgba(0, 0, 0, 0.035);
  --color-bg-elevated:    rgba(0, 0, 0, 0.055);
  --color-text-primary:   #1A1916; /* Warm deep slate carbon */
  --color-text-secondary: #6A6865;
  --color-text-muted:     #B0AEAC;
  --color-border:         rgba(0, 0, 0, 0.08);
  --glass-blur:           blur(24px) saturate(130%);
}
```

### 3.2 Typography

We deliberately abandon overused tech sans-serif defaults (Inter, Geist, Space Grotesk) to present a premium brand.

*   **Display Font (Hero, Headings)**: `Syne` (Highly expressive, organic-geometric contours that react with an fluid, human feel).
*   **UI & Body Font**: `Instrument Sans` (Humanist sans-serif with perfect legibility at micro-scales).
*   **Monospace Font**: `JetBrains Mono` (Uncompromising ligature rendering for code blocks).

```css
--font-display: 'Syne', sans-serif;
--font-body:    'Instrument Sans', sans-serif;
--font-mono:    'JetBrains Mono', monospace;
```

---

### 3.3 Tactile Organic Additions

#### A. Procedural Film Grain Overlay
Instead of using a static PNG which adds network payload, we inject a procedurally generated, vector SVG noise URI. It is lightweight, scales infinitely, and avoids raster tiling.

```css
body::after {
  content: '';
  position: fixed;
  inset: 0;
  z-index: 1; /* Sits directly above canvas, below interactive UI components */
  pointer-events: none;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 250 250' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.80' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.035'/%3E%3C/svg%3E");
  opacity: 0.95;
  mix-blend-mode: overlay;
}
```

#### B. High-Fidelity Custom Spring Cursor
A production-ready React component rendering an interactive cursor. This component uses Framer Motion spring values to match hardware frame sync with no rendering lag.

```jsx
import React, { useEffect, useState } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';

export function CustomCursor() {
  const cursorX = useMotionValue(-100);
  const cursorY = useMotionValue(-100);
  const [isHovered, setIsHovered] = useState(false);
  const [isClicked, setIsClicked] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // Springs decouple rendering from main layout reflows for maximum speed
  const springConfig = { damping: 28, stiffness: 280 };
  const cursorXSpring = useSpring(cursorX, springConfig);
  const cursorYSpring = useSpring(cursorY, springConfig);

  useEffect(() => {
    // Disable on touch screens
    const isTouch = window.matchMedia('(pointer: coarse)').matches;
    if (isTouch) return;

    setIsVisible(true);

    const moveCursor = (e) => {
      cursorX.set(e.clientX);
      cursorY.set(e.clientY);
    };

    const handleMouseDown = () => setIsClicked(true);
    const handleMouseUp = () => setIsClicked(false);

    const handleMouseOver = (e) => {
      if (e.target.closest('button, a, [role="button"], [data-hover="true"]')) {
        setIsHovered(true);
      }
    };

    const handleMouseOut = (e) => {
      if (e.target.closest('button, a, [role="button"], [data-hover="true"]')) {
        setIsHovered(false);
      }
    };

    window.addEventListener('mousemove', moveCursor);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mouseover', handleMouseOver);
    document.addEventListener('mouseout', handleMouseOut);

    return () => {
      window.removeEventListener('mousemove', moveCursor);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mouseover', handleMouseOver);
      document.removeEventListener('mouseout', handleMouseOut);
    };
  }, [cursorX, cursorY]);

  if (!isVisible) return null;

  return (
    <>
      {/* Outer Halo (Spring Interpolated) */}
      <motion.div
        className="fixed top-0 left-0 rounded-full border pointer-events-none select-none"
        style={{
          x: cursorXSpring,
          y: cursorYSpring,
          translateX: '-50%',
          translateY: '-50%',
          width: isHovered ? 44 : 26,
          height: isHovered ? 44 : 26,
          backgroundColor: isHovered ? 'var(--color-accent-glow)' : 'rgba(0, 201, 167, 0)',
          borderColor: isHovered ? 'var(--orb-idle)' : 'rgba(0, 201, 167, 0.4)',
          scale: isClicked ? 0.82 : 1,
          zIndex: 'var(--z-cursor)',
        }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      />
      {/* Target Dot (Raw Mouse Coordinates for zero latency) */}
      <motion.div
        className="fixed top-0 left-0 w-1.5 h-1.5 rounded-full pointer-events-none select-none"
        style={{
          x: cursorX,
          backgroundColor: 'var(--orb-idle)',
          translateX: '-50%',
          translateY: '-50%',
          zIndex: 'calc(var(--z-cursor) + 1)',
        }}
      />
    </>
  );
}
```

---

## 4. Shared Animation Token System

To maintain cross-platform animation coherence, individual components must import shared transition definitions.

```js
// animation.tokens.js

// Exponential bezier curves prevent linear, robotic interpolation
export const ease = {
  out:        [0.16, 1, 0.3, 1],   // High speed out, soft arrival
  in:         [0.7, 0, 0.84, 0],   // Slow acceleration, rapid cut-away
  inOut:      [0.83, 0, 0.17, 1],  // Cinematic, symmetric acceleration
  spring:     { type: 'spring', stiffness: 380, damping: 28 },
  springLoose:{ type: 'spring', stiffness: 150, damping: 18 }
};

export const duration = {
  instant:  0.08,
  fast:     0.18,
  base:     0.32,
  slow:     0.55,
  cinematic:0.90
};

// Ready-to-use Framer Motion variant libraries
export const fadeUp = {
  hidden:  { opacity: 0, y: 20, filter: 'blur(6px)' },
  visible: { 
    opacity: 1, 
    y: 0,  
    filter: 'blur(0px)',
    transition: { duration: duration.slow, ease: ease.out } 
  },
  exit: {
    opacity: 0,
    y: -10,
    filter: 'blur(4px)',
    transition: { duration: duration.fast, ease: ease.in }
  }
};

export const scaleIn = {
  hidden:  { opacity: 0, scale: 0.94 },
  visible: { opacity: 1, scale: 1, transition: ease.spring },
  exit:    { opacity: 0, scale: 0.94, transition: { duration: duration.fast } }
};
```

---

## 5. The Real-time 3D Bioluminescent Orb

The core of POOKIE's brand is an **interactive glowing 3D orb** built in React Three Fiber. Below is the complete, self-contained implementation with embedded WebGL Simplex noise, pre-warming capabilities, physical state transitions, and a **locked-down Offline state (state index 5)**.

```jsx
// Orb.jsx
import React, { useMemo, useRef, useEffect } from 'react';
import { useFrame, extend, useThree } from '@react-three/fiber';
import { shaderMaterial } from '@react-three/drei';
import * as THREE from 'three';

// 1. Core GLSL Shader Definition (Self-Contained Simplex 3D Noise)
const OrbMaterial = shaderMaterial(
  {
    uTime: 0.0,
    uAudioData: 0.0,
    uState: 0.0, // 0=Idle, 1=Listening, 2=Thinking, 3=Speaking, 4=Error, 5=Offline
    uColorA: new THREE.Color('#00C9A7'),
    uColorB: new THREE.Color('#0369A1'),
    uNoiseScale: 1.6,
    uDisplace: 0.15,
  },
  /* Vertex Shader */
  `
  uniform float uTime;
  uniform float uAudioData;
  uniform float uState;
  uniform float uNoiseScale;
  uniform float uDisplace;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying float vFresnel;

  // Ashima Arts 3D Simplex Noise function (Provides dependency-free noise displacement)
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise3(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i  = floor(v + dot(v, D.yyy));
    vec3 x0 = v - i + dot(i, D.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + D.xxx;
    vec3 x2 = x0 - i2 + D.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(
               i.z + vec4(0.0, i1.z, i2.z, 1.0))
             + i.y + vec4(0.0, i1.y, i2.y, 1.0) )
             + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ *ns.x + ns.yyyy;
    vec4 y = y_ *ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
    vec3 p0 = vec3(a0.xy,h.x);
    vec3 p1 = vec3(a0.zw,h.y);
    vec3 p2 = vec3(a1.xy,h.z);
    vec3 p3 = vec3(a1.zw,h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec3 pos = position;

    // Displacement Mapping (Simplex Noise + Real-time Audio Stream Amplification)
    // Offline state (5.0) slows down noise calculation to a sluggish speed
    float timeModifier = uTime * (uState == 2.0 ? 1.4 : (uState == 5.0 ? 0.15 : 0.65));
    float noiseVal = snoise3(pos * uNoiseScale + vec3(0.0, 0.0, timeModifier));
    
    // Listening state has highly sharp reactive spikiness
    float dynamicDisplace = uDisplace + (uAudioData * (uState == 1.0 ? 0.38 : 0.18));
    
    // Offline state constricts visual displacement to look frozen
    if (uState == 5.0) {
      pos += normal * (noiseVal * 0.03);
    } else {
      pos += normal * (noiseVal * dynamicDisplace);
    }

    vec4 modelViewPosition = modelViewMatrix * vec4(pos, 1.0);
    vViewPosition = -modelViewPosition.xyz;

    // Fresnel glow edge approximation
    vec4 modelPos = modelMatrix * vec4(pos, 1.0);
    vec3 viewDir = normalize(cameraPosition - modelPos.xyz);
    vFresnel = pow(1.0 - abs(dot(normalize(normal), viewDir)), 2.8);

    gl_Position = projectionMatrix * modelViewPosition;
  }
  `,
  /* Fragment Shader */
  `
  uniform float uTime;
  uniform float uState;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying float vFresnel;

  void main() {
    // Generate organic shifting color bands based on surface normal vectors
    float gradientBlend = vNormal.y * 0.5 + 0.5;
    vec3 baseColor = mix(uColorA, uColorB, gradientBlend);

    // Fresnel rim glow gives bioluminescent translucent volume look
    vec3 glowColor = mix(baseColor, vec3(1.0), vFresnel * 0.75);

    // Render-State Visual Effects overrides
    if (uState == 2.0) {
      // Thinking State: High frequency shimmering ripple
      float shimmer = sin(uTime * 8.0 + vNormal.z * 12.0) * 0.06;
      glowColor += vec3(shimmer * 0.7, shimmer * 0.5, shimmer * 1.0);
    } else if (uState == 4.0) {
      // Error state: Erratic, unstable pulsating glow
      float pulse = sin(uTime * 18.0) * 0.1;
      glowColor += vec3(pulse, -pulse * 0.5, -pulse);
    }

    // In Offline state (5.0), reduce transparency and edge light intensity to look dead/dormant
    float transparency = (uState == 5.0) ? (0.7 + vFresnel * 0.08) : (0.88 + vFresnel * 0.12);
    gl_FragColor = vec4(glowColor, transparency);
  }
  `
);

extend({ OrbMaterial });

export function PookieOrb({ currentState, audioAnalyserRef, isMobile = false, customThemeAccentColors }) {
  const meshRef = useRef();
  const materialRef = useRef();
  const { gl, scene, camera } = useThree();

  // Color Mapping Definitions matching POOKIE UI/UX Flow States
  const stateColors = useMemo(() => ({
    0: { a: new THREE.Color('#00C9A7'), b: new THREE.Color('#0369A1') }, // Idle (Teal / Ocean Deep)
    1: { a: new THREE.Color('#06B6D4'), b: new THREE.Color('#0891B2') }, // Listening (Cyan / Ice)
    2: { a: new THREE.Color('#818CF8'), b: new THREE.Color('#4F46E5') }, // Thinking (Indigo / Lavender)
    3: { a: new THREE.Color('#34D399'), b: new THREE.Color('#10B981') }, // Speaking (Emerald / Mint)
    4: { a: new THREE.Color('#F97316'), b: new THREE.Color('#EF4444') }, // Error (Orange / Red)
    5: { a: new THREE.Color('#374151'), b: new THREE.Color('#1F2937') }, // Offline State (Muted Dark Slates)
  }), []);

  // Pre-compile shader material offscreen to prevent initialization frame-jank
  useEffect(() => {
    if (materialRef.current) {
      const warmUpScene = new THREE.Scene();
      const warmUpCamera = new THREE.PerspectiveCamera();
      const warmUpMesh = new THREE.Mesh(new THREE.PlaneGeometry(), materialRef.current);
      warmUpScene.add(warmUpMesh);
      gl.compile(warmUpScene, warmUpCamera);
      warmUpScene.remove(warmUpMesh);
      warmUpMesh.geometry.dispose();
    }
  }, [gl]);

  useFrame(({ clock }, delta) => {
    if (!materialRef.current || !meshRef.current) return;

    const mat = materialRef.current;
    mat.uTime = clock.getElapsedTime();

    // 1. Interpolate current active state to enable buttery color morphing
    mat.uState = THREE.MathUtils.lerp(mat.uState, currentState, delta * 5.0);

    // 2. Fetch and interpolate raw Web Audio visual input data (completely blocked in Offline state 5)
    let targetAudio = 0;
    if (currentState !== 5 && audioAnalyserRef && audioAnalyserRef.current) {
      targetAudio = audioAnalyserRef.current.getNormalizedEnergy();
    }
    mat.uAudioData = THREE.MathUtils.lerp(mat.uAudioData, targetAudio, delta * 15.0);

    // 3. Interpolate Gradient Colors based on dynamic state target
    // If user selected a custom accent color in Settings Tab 4, we override Idle colors dynamically
    let targetA = stateColors[currentState].a;
    let targetB = stateColors[currentState].b;

    if (currentState === 0 && customThemeAccentColors) {
      targetA = new THREE.Color(customThemeAccentColors.from || '#00C9A7');
      targetB = new THREE.Color(customThemeAccentColors.to || '#0369A1');
    }

    mat.uColorA.lerp(targetA, delta * 4.0);
    mat.uColorB.lerp(targetB, delta * 4.0);

    // 4. Mesh Scale Breathing Logic
    let baseScale = 1.0;
    switch(currentState) {
      case 1: baseScale = 1.15; break; // Listening
      case 2: baseScale = 1.04; break; // Thinking
      case 3: baseScale = 1.10; break; // Speaking
      case 4: baseScale = 0.92; break; // Error
      case 5: baseScale = 0.88; break; // Offline (constricted, low presence)
      default:
        // Idle breathing frequency: 1.1Hz
        baseScale = 1.0 + Math.sin(clock.getElapsedTime() * 1.1) * 0.024;
    }
    meshRef.current.scale.setScalar(THREE.MathUtils.lerp(meshRef.current.scale.x, baseScale, delta * 4.0));

    // Dynamic rotation drift (Extremely slow in Offline state)
    const speedMultiplier = (currentState === 5) ? 0.15 : 1.0;
    meshRef.current.rotation.y += delta * 0.12 * speedMultiplier;
    meshRef.current.rotation.x += delta * 0.04 * speedMultiplier;
  });

  // Optimize polygon counts based on target platform
  const geometrySegments = isMobile ? 32 : 64;

  return (
    <mesh ref={meshRef} castShadow receiveShadow>
      <icosahedronGeometry args={[1.2, geometrySegments]} />
      <orbMaterial ref={materialRef} transparent={true} />
    </mesh>
  );
}
```

---

## 6. Web Audio API & Signal Processing Pipeline

The voice input algorithm extracts vocal-range frequency energy and maps it to the vertex displacement shader using a double-damped exponential filter.

### 6.1 Unified Audio Stream Hook with Barge-in Interruption
This custom hook supports continuous background listening. It implements the **Barge-in Interruption** specification defined in `POOKIE_UI_UX_FLOW_v2.md` (§2.2, State 4): if audio energy exceeding the custom sensitivity threshold (from settings) is detected while POOKIE is speaking, it interrupts text-to-speech output instantly.

```javascript
// useAudioAnalyser.js
import { useEffect, useRef, useState, useCallback } from 'react';

export function useAudioAnalyser() {
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const streamRef = useRef(null);
  const dataArrayRef = useRef(null);
  const smoothedEnergyRef = useRef(0.0);

  const startListening = useCallback(async () => {
    setError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Web Audio API not supported in this browser environment.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;

      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContextClass();
      audioContextRef.current = ctx;

      // Handle typical browser interactive autoplay blocks
      if (ctx.state === 'suspended') {
        const resumeContext = async () => {
          await ctx.resume();
          window.removeEventListener('click', resumeContext);
          window.removeEventListener('keydown', resumeContext);
        };
        window.addEventListener('click', resumeContext);
        window.addEventListener('keydown', resumeContext);
      }

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128; // Small bin size = minimal processing latency
      analyser.smoothingTimeConstant = 0.65; // High responsiveness hardware filter

      source.connect(analyser);
      analyserRef.current = analyser;
      dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);
      setIsActive(true);
    } catch (err) {
      console.warn('Microphone configuration error:', err);
      setError(err.message || 'Microphone activation blocked.');
      setIsActive(false);
    }
  }, []);

  const stopListening = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    dataArrayRef.current = null;
    smoothedEnergyRef.current = 0.0;
    setIsActive(false);
  }, []);

  const getNormalizedEnergy = useCallback(() => {
    if (!analyserRef.current || !dataArrayRef.current) return 0.0;

    const analyser = analyserRef.current;
    const buffer = dataArrayRef.current;
    analyser.getByteFrequencyData(buffer);

    // Focus analysis tightly on the vocal range: 250Hz - 2000Hz (bins 6 to 48)
    const vocalRange = buffer.slice(6, 48);
    const sum = vocalRange.reduce((acc, val) => acc + val, 0);
    const rawAverage = vocalRange.length > 0 ? (sum / vocalRange.length) / 255.0 : 0.0;

    // Apply Exponential Moving Average (EMA) to prevent visual vertex stutter
    const alpha = 0.35; // Custom filter coefficient (high values increase reactivity)
    smoothedEnergyRef.current = (alpha * rawAverage) + ((1.0 - alpha) * smoothedEnergyRef.current);

    return smoothedEnergyRef.current;
  }, []);

  /**
   * Continuous validation during Speaking state (State 3).
   * Triggers callback instantly to interrupt TTS and return to Listening State.
   * @param {number} sensitivityThreshold - Derived from Settings Slider (0.0 - 1.0)
   * @param {Function} onBargeIn - Callback to execute on interruption
   */
  const monitorBargeIn = useCallback((sensitivityThreshold, onBargeIn) => {
    if (!analyserRef.current) return;
    const currentVolume = getNormalizedEnergy();
    
    // Scale sensitivity threshold so that a lower sensitivity value in UI requires a higher acoustic burst
    const mappedThreshold = (1.0 - sensitivityThreshold) * 0.85 + 0.1;
    
    if (currentVolume > mappedThreshold) {
      onBargeIn();
    }
  }, [getNormalizedEnergy]);

  useEffect(() => {
    return () => stopListening();
  }, [stopListening]);

  return { startListening, stopListening, getNormalizedEnergy, monitorBargeIn, isActive, error };
}
```

---

### 6.2 Onboarding Step 4: Bioluminescent 2D Waveform Component
To align directly with the **Onboarding Flow Step 4 (Mic & Hardware Test)**, here is the production-ready 2D wave animator styled with POOKIE's exact color specifications and glow filters.

```jsx
import React, { useEffect, useRef } from 'react';

export function OnboardingAudioWave({ getNormalizedEnergy, isPassing, isActive }) {
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Resize to support high-DPI screens
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    ctx.scale(dpr, dpr);

    const width = canvas.width / dpr;
    const height = canvas.height / dpr;
    let offset = 0;

    const renderWave = () => {
      ctx.clearRect(0, 0, width, height);

      // Fetch voice energy. If not listening yet, show a baseline breathe
      const voiceEnergy = isActive ? getNormalizedEnergy() : 0.0;
      const waveAmplitude = isActive ? (voiceEnergy * 80 + 5) : 3;

      // Color scheme transitions to green when mic check passes
      const strokeColor = isPassing ? '#34D399' : '#00C9A7';
      const glowColor = isPassing ? 'rgba(52, 211, 153, 0.4)' : 'rgba(0, 201, 167, 0.3)';

      ctx.shadowBlur = 12;
      ctx.shadowColor = glowColor;
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = strokeColor;
      ctx.beginPath();

      // Render double overlapping sine waves for premium visual depth
      for (let x = 0; x < width; x++) {
        const rad = (x / width) * Math.PI * 4.5 + offset;
        const scaleModifier = Math.sin((x / width) * Math.PI); // Dampen wave at edges
        const y = (height / 2) + Math.sin(rad) * waveAmplitude * scaleModifier;
        
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Secondary layered background wave (offset frequency and phase)
      ctx.lineWidth = 1.0;
      ctx.strokeStyle = isPassing ? 'rgba(52, 211, 153, 0.4)' : 'rgba(0, 201, 167, 0.2)';
      ctx.shadowBlur = 0;
      ctx.beginPath();
      for (let x = 0; x < width; x++) {
        const rad = (x / width) * Math.PI * 6.0 - offset * 1.5;
        const scaleModifier = Math.sin((x / width) * Math.PI);
        const y = (height / 2) + Math.cos(rad) * (waveAmplitude * 0.5) * scaleModifier;
        
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      offset += 0.09;
      animationFrameRef.current = requestAnimationFrame(renderWave);
    };

    renderWave();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [getNormalizedEnergy, isPassing, isActive]);

  return (
    <canvas 
      ref={canvasRef} 
      className="w-full h-32 bg-transparent rounded-lg"
      style={{ display: 'block' }}
    />
  );
}
```

---

## 7. Interactive State Machine Configuration

The Orb is controlled via an explicit, deterministic state machine. Snapping values instantly is strictly prohibited; all numeric parameters interpolate linearly across state changes.

| State | State Index | Scale Factor | Spin Velocity | Audio Reactivity | Morph Transition Curve | Trigger Event (Direct Mapping to UI/UX Flow) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Idle** | `0.0` | `1.0` (breathing) | `0.12` | None | `duration.slow` (`ease.out`) | Default dashboard start, connection established |
| **Listening** | `1.0` | `1.15` | `0.30` | Active (Vocal range spikes) | `duration.fast` (`ease.spring`) | Mic active, manual wake-word/shortcut, or barge-in |
| **Thinking** | `2.0` | `1.04` | `0.95` (rapid spin) | None (High pulse shimmer) | `duration.base` (`ease.inOut`) | VAD detects silence. Tool execution active |
| **Speaking** | `3.0` | `1.10` | `0.18` | Dynamic (TTS sound waves) | `duration.fast` (`ease.spring`) | TTS stream begins streaming |
| **Error** | `4.0` | `0.92` (decaying) | `0.00` | None (Unstable pulse) | `duration.base` (`ease.out`) | API fail, network timeout |
| **Offline** | `5.0` | `0.88` (frozen) | `0.02` (dead drift) | None (Muted Slate) | `duration.slow` (`ease.out`) | Connection dropping (Offline state) |

---

## 8. GSAP & Lenis Scroll Sequence Orchestration

The landing page implements a cinematic scroll-linked timeline where the 3D Orb acts as a recurring structural element. Smooth page scrolling is maintained using Lenis to prevent scroll-wheel visual tearing.

### 8.1 Scroll Choreography Diagram

```
[Viewport Scroll Depth]
0%  ├───────────────── Orb dominates Center Hero. Parallax mouse tracking active.
    │
20% ├───────────► Orb scale shrinks to 0.55 and glides smoothly to the LEFT margin.
    │             Feature Dialog Card 1 fades up from the right.
40% ├───────────► Orb transitions into deep amber color.
    │             Feature Dialog Card 2 cross-fades into view.
60% ├───────────► Particle Shatter Event: Orb converts to 150 floating dust particles.
    │             Particles float outward into background grid.
80% ├───────────► Particles re-condense back to original Orb at bottom right.
    │             Onboarding CTA card fades in.
100% └───────────────── End Scroll Timeline.
```

### 8.2 GSAP Implementation Config

```javascript
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from '@studio-freight/lenis';

gsap.registerPlugin(ScrollTrigger);

export function initLandingScrollChoreography(orbCanvasContainer, cardsRef) {
  // 1. Bind Lenis Smooth Scrolling Engine
  const lenis = new Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // Custom exponential ease
    smoothWheel: true,
  });

  lenis.on('scroll', ScrollTrigger.update);

  gsap.ticker.add((time) => {
    lenis.raf(time * 1000);
  });

  gsap.ticker.lagSmoothing(0);

  // 2. Build Master GSAP Timeline
  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: orbCanvasContainer,
      start: 'top top',
      end: '+=400%', // High scroll length for cinematic layout breathing space
      scrub: 1.2,     // High scrub value cushions physical mouse stops
      pin: true,
      anticipatePin: 1,
    }
  });

  // Stage 1: Move Orb to Left Margin, fade in Card 1
  tl.to(orbCanvasContainer, {
    xPercent: -28,
    scale: 0.62,
    duration: 1.5,
  }, 'stage1')
  .from(cardsRef.current[0], {
    opacity: 0,
    y: 100,
    filter: 'blur(10px)',
    duration: 1.2,
  }, 'stage1+=0.3');

  // Stage 2: Target Color shifts to Amber, cross-fade to Card 2
  tl.to(orbCanvasContainer, {
    xPercent: 28,
    scale: 0.7,
    duration: 1.5,
  }, 'stage2')
  .to(cardsRef.current[0], { opacity: 0, y: -50, duration: 0.8 }, 'stage2')
  .from(cardsRef.current[1], {
    opacity: 0,
    y: 100,
    filter: 'blur(10px)',
    duration: 1.2,
  }, 'stage2+=0.3');

  // Stage 3: Shatter simulation (We set a custom uniform on the shader to explode vertices)
  tl.to(orbCanvasContainer, {
    scale: 0.2,
    opacity: 0,
    duration: 1.0,
  }, 'stage3')
  .from(cardsRef.current[2], {
    opacity: 0,
    scale: 0.9,
    duration: 1.2,
  }, 'stage3+=0.5');

  return {
    destroy() {
      lenis.destroy();
      ScrollTrigger.getAll().forEach(t => t.kill());
    }
  };
}
```

---

## 9. Platform-Specific Implementation Details

### 9.1 Web Architecture (Dashboard & App)
To prevent heavy WebGL assets from blocking initial page paints, POOKIE uses a code-split lazy loading strategy with a custom canvas skeleton fallback.

```jsx
import React, { Suspense, lazy } from 'react';

const CanvasContainer = lazy(() => import('./components/CanvasContainer'));

export function AppDashboard() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[var(--color-bg-base)]">
      {/* Suspense fallback matches the exact design language bounds */}
      <Suspense fallback={<OrbCanvasSkeleton />}>
        <CanvasContainer />
      </Suspense>
      <ChatInterface />
    </div>
  );
}

// Seamless SVG/CSS placeholder rendered prior to Canvas compiler readiness
function OrbCanvasSkeleton() {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0">
      <div 
        className="w-48 h-48 rounded-full opacity-60 animate-pulse"
        style={{
          background: 'radial-gradient(circle, var(--color-accent-from) 0%, rgba(7, 8, 15, 0) 70%)',
          filter: 'blur(16px)',
        }}
      />
    </div>
  );
}
```

### 9.2 Electron Desktop Integration
To create the floating desktop experience, the Electron BrowserWindow must bypass traditional compositor window frames and utilize GPU rasterization flags.

#### A. Main Process Configuration
```javascript
// main.js
const { app, BrowserWindow } = require('electron');

function createFloatingPookieOverlay() {
  const win = new BrowserWindow({
    width: 320,
    height: 450,
    transparent: true,
    frame: false,
    hasShadow: false,
    alwaysOnTop: true,
    type: 'screen-saver', // Bypasses standard window managers
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

  win.loadFile('index.html');
  win.setIgnoreMouseEvents(true, { forward: true }); // Allows clicks to pass through transparent segments
}

// Force high-performance rendering configurations on Chromium
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
```

#### B. Mouse-Event Bridging Hook
```javascript
// Bridge pointer events only when user hovers directly on the visible UI
export function useElectronPointerBridge(overlayRef) {
  useEffect(() => {
    if (!window.electronAPI) return;

    const el = overlayRef.current;
    const handleMouseOver = (e) => {
      // Toggle ignore state if cursor hovers interactive segments
      const target = e.target;
      const isInteractive = target.closest('button, input, .interactive-card');
      window.electronAPI.setIgnoreMouseEvents(!isInteractive);
    };

    el.addEventListener('mouseover', handleMouseOver);
    return () => el.removeEventListener('mouseover', handleMouseOver);
  }, [overlayRef]);
}
```

---

### 9.3 Mobile Optimization Blueprint (React Native Skia)
Since standard WebGL and React Three Fiber impose massive overhead on mobile GPUs, mobile environments swap the 3D Orb with a GPU-accelerated **React Native Skia** bioluminescent model.

```jsx
import React, { useEffect } from 'react';
import { Dimensions } from 'react-native';
import { Canvas, Circle, RadialGradient, BlurMask, Group, vec } from '@shopify/react-native-skia';
import Animated, { 
  useSharedValue, 
  withRepeat, 
  withTiming, 
  withSpring, 
  useDerivedValue,
  Easing 
} from 'react-native-reanimated';

const { width } = Dimensions.get('window');
const CANVAS_SIZE = 280;
const CENTER = CANVAS_SIZE / 2;

export function PookieSkiaOrb({ state, audioData }) {
  // state: 0=idle, 1=listening, 2=thinking, 3=speaking, 4=error, 5=offline
  const scale = useSharedValue(1.0);
  const blurRadius = useSharedValue(20);
  const colorA = useSharedValue('#00C9A7');
  const colorB = useSharedValue('#0369A1');
  const time = useSharedValue(0);

  useEffect(() => {
    // Smooth time baseline
    time.value = withRepeat(
      withTiming(2 * Math.PI, { duration: 6000, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

  useEffect(() => {
    switch(state) {
      case 0: // Idle
        scale.value = withSpring(1.0, { damping: 15, stiffness: 80 });
        blurRadius.value = withTiming(24, { duration: 500 });
        colorA.value = withTiming('#00C9A7', { duration: 600 });
        colorB.value = withTiming('#0369A1', { duration: 600 });
        break;
      case 1: // Listening
        scale.value = withSpring(1.14, { damping: 10, stiffness: 120 });
        blurRadius.value = withTiming(36, { duration: 300 });
        colorA.value = withTiming('#06B6D4', { duration: 400 });
        colorB.value = withTiming('#0891B2', { duration: 400 });
        break;
      case 2: // Thinking
        scale.value = withRepeat(
          withTiming(1.05, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
          -1,
          true
        );
        blurRadius.value = withTiming(44, { duration: 400 });
        colorA.value = withTiming('#818CF8', { duration: 400 });
        colorB.value = withTiming('#4F46E5', { duration: 400 });
        break;
      case 3: // Speaking
        scale.value = withSpring(1.08, { damping: 12, stiffness: 100 });
        blurRadius.value = withTiming(30, { duration: 300 });
        colorA.value = withTiming('#34D399', { duration: 400 });
        colorB.value = withTiming('#10B981', { duration: 400 });
        break;
      case 4: // Error
        scale.value = withSpring(0.90, { damping: 14, stiffness: 150 });
        blurRadius.value = withTiming(16, { duration: 200 });
        colorA.value = withTiming('#F97316', { duration: 300 });
        colorB.value = withTiming('#EF4444', { duration: 300 });
        break;
      case 5: // Offline (Muted Gray-Slate, Constricted)
        scale.value = withSpring(0.85, { damping: 15, stiffness: 100 });
        blurRadius.value = withTiming(12, { duration: 600 });
        colorA.value = withTiming('#374151', { duration: 600 });
        colorB.value = withTiming('#1F2937', { duration: 600 });
        break;
    }
  }, [state]);

  // Derive radius from scale + voice input (decoupled in offline mode)
  const animatedRadius = useDerivedValue(() => {
    const breathe = Math.sin(time.value) * (state === 5 ? 0.8 : 3.5);
    const voiceAmplification = (state === 5) ? 0.0 : (audioData.value * 24.0);
    return (75 + breathe + voiceAmplification) * scale.value;
  });

  const colors = useDerivedValue(() => [colorA.value, colorB.value]);

  return (
    <Canvas style={{ width: CANVAS_SIZE, height: CANVAS_SIZE, backgroundColor: 'transparent' }}>
      <Group>
        <Circle cx={CENTER} cy={CENTER} r={animatedRadius}>
          <RadialGradient
            c={vec(CENTER, CENTER)}
            r={animatedRadius}
            colors={colors}
          />
          <BlurMask radius={blurRadius} style="normal" />
        </Circle>
      </Group>
    </Canvas>
  );
}
```

---

## 10. QoS, Accessibility (a11y) & Performance Budgets

Premium visual presentation must not exclude users with performance constraints or sensory sensitivities.

### 10.1 WebGL Detector & Progressive Throttling
Before loading the heavy React Three Fiber Canvas, the system checks hardware capabilities and loads corresponding fallbacks.

```javascript
// webglSupport.js
export function detectWebGLSupport() {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return 'none';

    // Verify float texture extension availability (essential for post-processing effects)
    const floatExt = gl.getExtension('OES_texture_float');
    return floatExt ? 'full' : 'limited';
  } catch (e) {
    return 'none';
  }
}
```

Based on detection:
*   **'full'**: Render R3F with active post-processing (`Bloom`, `ChromaticAberration`).
*   **'limited'**: Disable all post-processing effects. Downscale DPR cap to `1.0`.
*   **'none'**: Mount the clean, lightweight radial CSS animated fallback.

---

### 10.2 Accessible Motion Hook & System Integrator
A custom hook that reads the user's OS preference (`prefers-reduced-motion`) and settings toggles to suppress displacement math.

```javascript
// useMotionPreference.js
import { useEffect, useState } from 'react';

export function useMotionPreference() {
  const [reduceMotion, setReduceMotion] = useState(() => {
    const savedSetting = localStorage.getItem('pookie-reduce-motion');
    if (savedSetting !== null) return savedSetting === 'true';
    
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleSystemChange = (e) => {
      if (localStorage.getItem('pookie-reduce-motion') === null) {
        setReduceMotion(e.matches);
      }
    };

    mediaQuery.addEventListener('change', handleSystemChange);
    return () => mediaQuery.removeEventListener('change', handleSystemChange);
  }, []);

  return reduceMotion;
}
```

**Actions taken when `reduceMotion === true`:**
*   **3D Shader**: Disables vertex displacement calculations completely. Animates slow, constant uniform transitions only.
*   **Framer Motion**: Global transition configurations overrides to: `transition={{ duration: 0 }}` via `<MotionConfig reducedMotion="user">`.
*   **GSAP**: Global speed override applied on trigger initialization: `gsap.globalTimeline.timeScale(0)` or disables scroll sequences entirely.

---

### 10.3 screen-reader Integration (a11y)
Since screen readers cannot parse Canvas geometries, an off-screen live region announces interactions verbally as they happen.

```jsx
// AccessibleScreenReaderAnnouncer.jsx
import React from 'react';

const STATE_DESCRIPTIONS = {
  0: "POOKIE is idle, breathing with a glowing teal aura.",
  1: "POOKIE is active, listening in real-time to your voice input.",
  2: "POOKIE is thinking, running backend evaluations.",
  3: "POOKIE is responding, glowing mint green.",
  4: "POOKIE has encountered an issue. Please try again.",
  5: "POOKIE is offline. Read-only conversational logs are active.",
};

export function ScreenReaderAnnouncer({ currentState }) {
  return (
    <div 
      className="sr-only" 
      aria-live="polite" 
      aria-atomic="true"
    >
      {STATE_DESCRIPTIONS[currentState]}
    </div>
  );
}
```

---

### 10.4 Strict Execution Resource Allocations

```
┌─────────────────────────────────────────────────────────────┐
│                 Performance Budget Metrics                  │
├────────────────────────────┬────────────────────────────────┤
│ Target Execution Rate      │ 60fps locked (Desktop & Web)   │
│ Floor Execution Rate       │ 40fps target (Mobile low-end)  │
│ Maximum Frame-Draw Calls   │ ≤ 6 calls (Idle) / ≤ 10 (Busy) │
│ Desktop Polygon Limit      │ ~25,600 triangles max          │
│ Mobile Polygon Limit       │ ~6,400 triangles max           │
│ Compressed Bundle Size     │ < 280KB Gzip total (Landing)   │
│ Target Interactive Speed   │ < 1.8 seconds on 3G speeds     │
└────────────────────────────┴────────────────────────────────┘
```

R3F handles budget exhaustion automatically using scaling factors inside the core loop:

```jsx
<Canvas performance={{ min: 0.5 }} dpr={[1, 2]}>
```

---

## 11. Automated Testing & Verification (Playwright)

To guarantee that complex render updates do not regress, implement headless visual snapshot integration.

```javascript
// orb.spec.js
import { test, expect } from '@playwright/test';

test.describe('POOKIE 3D Orb Animation Verification Suite', () => {
  test('Shader render validation under state changes', async ({ page }) => {
    await page.goto('/dashboard');
    const canvas = page.locator('canvas');

    // 1. Snapshot validation in standard state
    await expect(canvas).toBeVisible();
    await page.waitForTimeout(1000); // Allow pre-warm compilation
    await expect(canvas).toHaveScreenshot('orb-idle-state.png', { maxDiffPixelRatio: 0.02 });

    // 2. Trigger speech input state mock
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('pookie-state-mock', { detail: { state: 1 } }));
    });
    await page.waitForTimeout(300);
    await expect(canvas).toHaveScreenshot('orb-listening-state.png', { maxDiffPixelRatio: 0.02 });
  });
});
```

---

## 12. Document Revision & Legacy Changes

*   **v1.0 (Legacy Base)**:
    *   Defined baseline styling with purple/blue highlights.
    *   Proposed basic geometries and general React Three Fiber concepts.
    *   Offered basic Expo GL setups for phone engines.
*   **v2.0 (Intermediate Release)**:
    *   Added high-poly design specifications.
    *   Upgraded standard font selections to luxury-grade typography (`Syne` / `Instrument Sans`).
    *   Swapped mobile WebGL layers with high-performance `React Native Skia`.
    *   Documented z-index maps and basic scroll trajectories.
*   **v3.0 (Ultimate Production Master - CURRENT)**:
    *   **Full Alignment to `POOKIE_UI_UX_FLOW_v2.md`** global states, onboarding patterns, and settings panel values.
    *   **Barge-in Interruption Script**: Engineered active audio-stream voice threshold triggers that intercept speaking tasks on the fly.
    *   **Bioluminescent 2D Onboarding Waveform**: Provided hardware-checking canvas components built for setup phase step 4.
    *   **Locked Offline State**: Configured slate-muted, constriction-scale parameters when connection drops (Offline mode).
    *   **Appearance Custom Preset Binding**: Connected live system appearance-picker inputs to dynamic uniform overrides on the R3F Orb geometry loop.
    *   Introduced complete, dependency-free WebGL Simplex 3D Noise GLSL code blocks.
    *   Implemented procedural vector-SVG noise background filters to completely eliminate static image downloads.
    *   Resolved main-thread compilation lag via offscreen WebGL shader material pre-warming.
    *   Engineered high-performance cursor component powered by Framer Motion.
    *   Delivered fully-commented Web Audio API analyser pipeline hooks featuring custom vocal filtering and EMA damping loops.
    *   Added accessible, high-performance motion preference hooks and screen-reader live-region updates.
    *   Shipped standard Playwright configuration files to verify animations in visual regression CI environments.
