import { useEffect, useRef } from 'react';

export const NeuralMesh = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let particles: Particle[] = [];
    const particleCount = Math.min(75, Math.floor(window.innerWidth / 18));
    const connectionDistance = 150;
    const mouseDistance = 220;

    let mouse = { x: -1000, y: -1000 };
    let time = 0;
    let animationFrameId: number;

    // Slowly drifting colorful background nebulas with dynamic base hues
    const nebulas = [
      { x: 0.15, y: 0.25, r: 0.38, vx: 0.00015, vy: 0.0001, hue: 140, alpha: 0.08 }, // Mint base
      { x: 0.85, y: 0.75, r: 0.48, vx: -0.0001, vy: 0.00015, hue: 270, alpha: 0.12 }, // Violet base
      { x: 0.50, y: 0.50, r: 0.42, vx: 0.00008, vy: -0.0001, hue: 190, alpha: 0.10 }  // Cyan base
    ];

    class Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      baseRadius: number;
      pulseSpeed: number;
      color: string;
      alpha: number;

      constructor() {
        this.x = Math.random() * canvas!.width;
        this.y = Math.random() * canvas!.height;
        this.vx = (Math.random() - 0.5) * 0.25;
        this.vy = (Math.random() - 0.5) * 0.25;
        this.baseRadius = Math.random() * 1.8 + 0.6;
        this.radius = this.baseRadius;
        this.pulseSpeed = Math.random() * 0.015 + 0.005;
        
        // Colors corresponding to theme accents
        const rand = Math.random();
        if (rand < 0.45) {
          this.color = '130, 242, 168'; // Mint
        } else if (rand < 0.85) {
          this.color = '34, 211, 238';  // Cyan
        } else {
          this.color = '192, 132, 252'; // Violet
        }
        this.alpha = Math.random() * 0.5 + 0.15;
      }

      update() {
        this.x += this.vx;
        this.y += this.vy;

        // Bounce borders
        if (this.x < 0 || this.x > canvas!.width) this.vx *= -1;
        if (this.y < 0 || this.y > canvas!.height) this.vy *= -1;

        // Subtle breathe animation
        this.radius = this.baseRadius + Math.sin(time * this.pulseSpeed * 8) * 0.3;
      }

      draw() {
        if (!ctx) return;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${this.color}, ${this.alpha})`;
        
        if (this.baseRadius > 1.8) {
          ctx.shadowBlur = 6;
          ctx.shadowColor = `rgba(${this.color}, 0.5)`;
        }
        ctx.fill();
        ctx.shadowBlur = 0; // Reset
      }
    }

    const init = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      particles = [];
      for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle());
      }
    };

    const animate = () => {
      if (!ctx || !canvas) return;
      time += 0.5;

      // Cosmic background base
      ctx.fillStyle = '#030108';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Shifting auroral background clouds (screen composition for neon layering)
      ctx.globalCompositeOperation = 'screen';
      nebulas.forEach(nb => {
        nb.x += nb.vx;
        nb.y += nb.vy;
        
        // Wrap/bounce within grid bounds
        if (nb.x < -0.1 || nb.x > 1.1) nb.vx *= -1;
        if (nb.y < -0.1 || nb.y > 1.1) nb.vy *= -1;

        const px = nb.x * canvas.width;
        const py = nb.y * canvas.height;
        const rad = nb.r * Math.max(canvas.width, canvas.height);

        const shiftedHue = (nb.hue + time * 0.04) % 360;
        const colorString = `hsla(${shiftedHue}, 75%, 60%, ${nb.alpha})`;
        const gradient = ctx.createRadialGradient(px, py, 0, px, py, rad);
        gradient.addColorStop(0, colorString);
        gradient.addColorStop(0.4, `hsla(${shiftedHue}, 75%, 60%, ${nb.alpha * 0.2})`);
        gradient.addColorStop(1, `hsla(${shiftedHue}, 75%, 60%, 0)`);

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(px, py, rad, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalCompositeOperation = 'source-over';

      // Draw particle nodes and neural lines
      for (let i = 0; i < particles.length; i++) {
        for (let j = i; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < connectionDistance) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            
            // Shifting line color opacity
            const opacity = (1 - distance / connectionDistance) * 0.09;
            ctx.strokeStyle = `rgba(130, 242, 168, ${opacity})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }

        // Mouse gravity pull and network illumination
        const dxMouse = particles[i].x - mouse.x;
        const dyMouse = particles[i].y - mouse.y;
        const distanceMouse = Math.sqrt(dxMouse * dxMouse + dyMouse * dyMouse);
        
        if (distanceMouse < mouseDistance) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(mouse.x, mouse.y);
          
          const opacity = (1 - distanceMouse / mouseDistance) * 0.06;
          ctx.strokeStyle = `rgba(34, 211, 238, ${opacity})`;
          ctx.lineWidth = 0.6;
          ctx.stroke();
          
          // Soft magnetic pull
          particles[i].x -= dxMouse * 0.006;
          particles[i].y -= dyMouse * 0.006;
          // Temporarily light up node
          particles[i].alpha = Math.min(0.85, particles[i].alpha + 0.015);
        } else {
          // Fade back to normal drift alpha
          particles[i].alpha = Math.max(0.18, particles[i].alpha - 0.004);
        }

        particles[i].update();
        particles[i].draw();
      }

      // Mouse interactive radial pulse
      if (mouse.x > 0 && mouse.y > 0) {
        ctx.globalCompositeOperation = 'screen';
        const mouseGlow = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 200);
        mouseGlow.addColorStop(0, 'rgba(34, 211, 238, 0.12)');
        mouseGlow.addColorStop(0.5, 'rgba(192, 132, 252, 0.04)');
        mouseGlow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = mouseGlow;
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, 200, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };

    const handleMouseLeave = () => {
      mouse.x = -1000;
      mouse.y = -1000;
    };

    const handleResize = () => {
      init();
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);
    window.addEventListener('resize', handleResize);

    init();
    animate();

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-0"
    />
  );
};
