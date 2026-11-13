'use client';
import { useEffect, useRef, useState } from 'react';

const COLORS = [
  '#ff4b4b', // Coral Red
  '#00d2ff', // Sky Blue
  '#ffbe0b', // Canary Gold
  '#ff006e', // Party Pink
  '#8338ec', // Purple
  '#06d6a0', // Mint Green
  '#ff70a6', // Soft Rose
  '#3a86ff', // Electric Blue
  '#fb5607', // Tangerine
  '#ffffff', // Crisp Paper White
];

function createParticle(x, y, angle, speed, isLate = false) {
  const rad = (angle * Math.PI) / 180;
  const spread = (Math.random() - 0.5) * 0.45;
  const finalRad = rad + spread;
  const s = speed * (0.8 + Math.random() * 0.45);

  const shapes = ['rect', 'rect', 'circle', 'strip'];
  const shape = shapes[Math.floor(Math.random() * shapes.length)];

  return {
    x,
    y,
    vx: Math.cos(finalRad) * s,
    vy: Math.sin(finalRad) * s,
    w: shape === 'strip' ? 12 + Math.random() * 6 : 7 + Math.random() * 5,
    h: shape === 'strip' ? 4 + Math.random() * 2 : shape === 'rect' ? 6 + Math.random() * 4 : 8,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    shape,
    rotation: Math.random() * Math.PI * 2,
    rotationSpeed: (Math.random() - 0.5) * 0.18,
    wobble: Math.random() * Math.PI * 2,
    wobbleSpeed: 0.08 + Math.random() * 0.08,
    opacity: 1,
    drag: isLate ? 0.982 : 0.985,
    gravity: 0.28 + Math.random() * 0.1,
  };
}

export default function ConfettiBlaster({ onComplete }) {
  const canvasRef = useRef(null);
  const [active, setActive] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
    }
    resize();
    window.addEventListener('resize', resize);

    const particles = [];

    // Cannon 1 & 2: Dual Party Cannons blasting from bottom-left & bottom-right
    function fireCannon(fromLeft = true, count = 45, isLate = false) {
      const originX = fromLeft ? width * 0.12 : width * 0.88;
      const originY = height * 0.82;
      const baseAngle = fromLeft ? -62 : -118;
      const baseSpeed = Math.min(height, width) > 600 ? 19 : 15;

      for (let i = 0; i < count; i++) {
        particles.push(createParticle(originX, originY, baseAngle, baseSpeed, isLate));
      }
    }

    // Center Confetti Pop
    function fireCenterPop(count = 35, isLate = false) {
      const originX = width * 0.5;
      const originY = height * 0.65;
      for (let i = 0; i < count; i++) {
        const angle = -90 + (Math.random() - 0.5) * 80;
        const speed = 14 + Math.random() * 8;
        particles.push(createParticle(originX, originY, angle, speed, isLate));
      }
    }

    // Initial Blaster Wave (t = 0)
    fireCannon(true, 42);
    fireCannon(false, 42);
    fireCenterPop(30);

    // Secondary Cascade Wave (t = 280ms) for realistic party popper flutter
    const wave2Timer = setTimeout(() => {
      fireCannon(true, 24, true);
      fireCannon(false, 24, true);
    }, 280);

    let animationId;
    let startTime = performance.now();
    const DURATION = 3400; // 3.4 seconds total animation

    function render(now) {
      const elapsed = now - startTime;
      ctx.clearRect(0, 0, width, height);

      // Global fade-out in final 1000ms
      const globalAlpha = elapsed > 2400 ? Math.max(0, 1 - (elapsed - 2400) / 1000) : 1;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Apply physics
        p.vx *= p.drag;
        p.vy *= p.drag;
        p.vy += p.gravity;
        p.x += p.vx + Math.sin(p.wobble) * 0.7; // slight air wobble
        p.y += p.vy;

        p.rotation += p.rotationSpeed;
        p.wobble += p.wobbleSpeed;

        // 3D scale transformation mimicking tumbling paper in air
        const scaleX = Math.cos(p.wobble);
        const scaleY = Math.sin(p.wobble * 0.7);

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.scale(scaleX, Math.abs(scaleY) > 0.15 ? scaleY : 0.15);
        ctx.globalAlpha = p.opacity * globalAlpha;
        ctx.fillStyle = p.color;

        if (p.shape === 'circle') {
          ctx.beginPath();
          ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Rounded rectangular paper flake
          const hw = p.w / 2;
          const hh = p.h / 2;
          ctx.beginPath();
          ctx.roundRect ? ctx.roundRect(-hw, -hh, p.w, p.h, 2) : ctx.rect(-hw, -hh, p.w, p.h);
          ctx.fill();
        }

        ctx.restore();
      }

      if (elapsed < DURATION) {
        animationId = requestAnimationFrame(render);
      } else {
        ctx.clearRect(0, 0, width, height);
        setActive(false);
        if (onComplete) onComplete();
      }
    }

    animationId = requestAnimationFrame(render);

    return () => {
      clearTimeout(wave2Timer);
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
    };
  }, [onComplete]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 9999,
      }}
    />
  );
}

