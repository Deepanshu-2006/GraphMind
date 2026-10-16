import React, { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  baseAlpha: number;
  alpha: number;
  phase: number;
  pulseSpeed: number;
  colorType: 'white' | 'accent';
}

interface PersonaAtmosphereProps {
  particleCount?: number;
}

export const PersonaAtmosphere: React.FC<PersonaAtmosphereProps> = ({
  particleCount = 40
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number | null = null;
    let lastTime = performance.now();
    let isDisposed = false;

    // Respect user's motion preference
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Responsive dimensions
    const resizeCanvas = () => {
      if (!canvas) return;
      const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
      const width = canvas.clientWidth || window.innerWidth;
      const height = canvas.clientHeight || window.innerHeight;

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const getWidth = () => canvas.clientWidth || window.innerWidth;
    const getHeight = () => canvas.clientHeight || window.innerHeight;

    // Initialize restrained particles
    const particles: Particle[] = [];
    const count = particleCount;
    const width = getWidth();
    const height = getHeight();

    for (let i = 0; i < count; i++) {
      // 80% subtle white/gray, 20% faint signature lime accent
      const isAccent = Math.random() < 0.2;
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.12,
        vy: (Math.random() - 0.5) * 0.12,
        radius: 0.8 + Math.random() * 1.4,
        baseAlpha: isAccent ? 0.08 + Math.random() * 0.12 : 0.05 + Math.random() * 0.14,
        alpha: 0.1,
        phase: Math.random() * Math.PI * 2,
        pulseSpeed: 0.001 + Math.random() * 0.002,
        colorType: isAccent ? 'accent' : 'white'
      });
    }

    // Single static render for reduced motion users
    if (prefersReducedMotion) {
      ctx.clearRect(0, 0, width, height);
      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle =
          p.colorType === 'accent'
            ? `rgba(163, 255, 18, ${p.baseAlpha})`
            : `rgba(245, 245, 245, ${p.baseAlpha})`;
        ctx.fill();
      }
      return () => {
        isDisposed = true;
        window.removeEventListener('resize', resizeCanvas);
      };
    }

    // Frame-rate independent render loop
    const render = (currentTime: number) => {
      if (isDisposed) return;

      const dt = Math.min((currentTime - lastTime) / 1000, 0.1);
      lastTime = currentTime;

      const curWidth = getWidth();
      const curHeight = getHeight();

      ctx.clearRect(0, 0, curWidth, curHeight);

      // Draw subtle particles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Update position with wrap-around
        p.x += p.vx * (dt * 60);
        p.y += p.vy * (dt * 60);

        if (p.x < 0) p.x = curWidth;
        else if (p.x > curWidth) p.x = 0;

        if (p.y < 0) p.y = curHeight;
        else if (p.y > curHeight) p.y = 0;

        // Subtle alpha pulsation
        p.phase += p.pulseSpeed * (dt * 1000);
        p.alpha = Math.max(0.02, p.baseAlpha + Math.sin(p.phase) * 0.04);

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle =
          p.colorType === 'accent'
            ? `rgba(163, 255, 18, ${p.alpha})`
            : `rgba(245, 245, 245, ${p.alpha})`;
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      isDisposed = true;
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [particleCount]);

  return (
    <canvas
      ref={canvasRef}
      className="persona-atmosphere-canvas"
      aria-hidden="true"
    />
  );
};
