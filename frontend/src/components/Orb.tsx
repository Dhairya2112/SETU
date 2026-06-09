import { useEffect, useRef } from 'react';

interface PookieOrbProps {
  currentState: number; // 0=Idle, 1=Listening, 2=Thinking, 3=Speaking, 4=Error, 5=Offline
  audioAnalyserRef?: { current: { getNormalizedEnergy: () => number } | null };
  isMobile?: boolean;
  customThemeAccentColors?: { from: string; to: string };
}

export function PookieOrb({ currentState, audioAnalyserRef, customThemeAccentColors }: PookieOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Bioluminescent color palettes for different system states
  const colors = {
    0: { from: 'rgba(0, 201, 167, 0.45)', to: 'rgba(3, 105, 161, 0.05)' }, // Idle (Teal / Ocean)
    1: { from: 'rgba(6, 182, 212, 0.55)', to: 'rgba(8, 145, 178, 0.05)' }, // Listening (Cyan)
    2: { from: 'rgba(129, 140, 248, 0.55)', to: 'rgba(79, 70, 229, 0.05)' }, // Thinking (Indigo / Lavender)
    3: { from: 'rgba(52, 211, 153, 0.55)', to: 'rgba(16, 185, 129, 0.05)' }, // Speaking (Emerald / Mint)
    4: { from: 'rgba(249, 115, orange, 0.55)', to: 'rgba(239, 68, 68, 0.05)' }, // Error (Orange / Red)
    5: { from: 'rgba(75, 85, 99, 0.3)', to: 'rgba(31, 41, 55, 0.05)' }, // Offline (Muted Gray)
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let time = 0;

    // Smoothed transition values to prevent stuttering
    let currentRadius = 80;
    let currentEnergy = 0;

    const render = () => {
      time += 0.04;

      // Handle dynamic resize/DPI scaling for sharp rendering
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      ctx.clearRect(0, 0, width, height);

      // Fetch current energy level from Web Audio API analysis
      let targetEnergy = 0;
      if (currentState !== 5 && audioAnalyserRef && audioAnalyserRef.current) {
        targetEnergy = audioAnalyserRef.current.getNormalizedEnergy();
      }
      currentEnergy = currentEnergy * 0.82 + targetEnergy * 0.18;

      // Determine state config: base size, wave speed, morph amplitude
      let targetRadius = 75;
      let waveSpeed = 0.04;
      let waveAmplitude = 10;

      switch (currentState) {
        case 1: // Listening
          targetRadius = 82 + currentEnergy * 25;
          waveSpeed = 0.08 + currentEnergy * 0.05;
          waveAmplitude = 14 + currentEnergy * 20;
          break;
        case 2: // Thinking
          targetRadius = 78;
          waveSpeed = 0.14;
          waveAmplitude = 6;
          break;
        case 3: // Speaking
          targetRadius = 80 + currentEnergy * 22;
          waveSpeed = 0.06 + currentEnergy * 0.04;
          waveAmplitude = 10 + currentEnergy * 16;
          break;
        case 4: // Error
          targetRadius = 70;
          waveSpeed = 0.18;
          waveAmplitude = 16;
          break;
        case 5: // Offline
          targetRadius = 62;
          waveSpeed = 0.005;
          waveAmplitude = 2;
          break;
        default: // Idle
          targetRadius = 75 + Math.sin(time * 1.5) * 2.5;
          waveSpeed = 0.02;
          waveAmplitude = 5;
      }

      currentRadius = currentRadius * 0.85 + targetRadius * 0.15;

      const centerX = width / 2;
      const centerY = height / 2;

      // Get color configurations
      const stateColor = colors[currentState as keyof typeof colors] || colors[0];
      let fromColor = stateColor.from;

      if (currentState === 4) {
        fromColor = 'rgba(239, 68, 68, 0.55)'; // Fixed red for error state fallback
      }

      // Custom theme overrides
      if (currentState === 0 && customThemeAccentColors) {
        fromColor = customThemeAccentColors.from;
      }

      // Draw background volumetric glow (soft radial gradient)
      const glowGrad = ctx.createRadialGradient(
        centerX, centerY, 0,
        centerX, centerY, currentRadius * 1.65
      );
      glowGrad.addColorStop(0, fromColor);
      glowGrad.addColorStop(0.5, fromColor.replace(/[\d.]+\)$/, '0.18)'));
      glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(centerX, centerY, currentRadius * 1.65, 0, Math.PI * 2);
      ctx.fill();

      // Draw layered morphing organic waves
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      
      const numLayers = currentState === 5 ? 1 : 3;
      for (let layer = 0; layer < numLayers; layer++) {
        ctx.beginPath();
        const layerPhase = time * waveSpeed * (1 + layer * 0.3) + layer * (Math.PI / 3);
        const points = 10;
        const layerRadius = currentRadius * (1 - layer * 0.12);

        for (let i = 0; i <= points; i++) {
          const angle = (i / points) * Math.PI * 2;
          // Shifting Perlin-like 2D noise approximation via layered sines and cosines
          const waveOffset = Math.sin(angle * 3 + layerPhase) * Math.cos(angle * 2 - layerPhase) * waveAmplitude;
          const r = layerRadius + waveOffset;
          const x = centerX + Math.cos(angle) * r;
          const y = centerY + Math.sin(angle) * r;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.closePath();

        const blobGrad = ctx.createRadialGradient(
          centerX, centerY, 0,
          centerX, centerY, layerRadius * 1.3
        );
        
        const opFactor = layer === 0 ? 0.85 : layer === 1 ? 0.55 : 0.35;
        blobGrad.addColorStop(0, fromColor.replace(/[\d.]+\)$/, `${0.45 * opFactor})`));
        blobGrad.addColorStop(0.7, fromColor.replace(/[\d.]+\)$/, `${0.18 * opFactor})`));
        blobGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = blobGrad;
        ctx.fill();

        // Thin glow organic perimeter stroke
        ctx.strokeStyle = fromColor.replace(/[\d.]+\)$/, `${0.4 / (layer + 1)})`);
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      ctx.restore();

      // Central core hot-spot glow
      const coreGrad = ctx.createRadialGradient(
        centerX - 3, centerY - 3, 0,
        centerX, centerY, currentRadius * 0.35
      );
      coreGrad.addColorStop(0, 'rgba(255, 255, 255, 0.55)');
      coreGrad.addColorStop(0.4, fromColor.replace(/[\d.]+\)$/, '0.35)'));
      coreGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(centerX, centerY, currentRadius * 0.35, 0, Math.PI * 2);
      ctx.fill();

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [currentState, audioAnalyserRef, customThemeAccentColors]);

  return (
    <canvas 
      ref={canvasRef} 
      className="w-full h-full block rounded-full"
      style={{ borderRadius: '50%' }}
    />
  );
}
