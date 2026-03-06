/**
 * Transparent matrix-style falling characters (canvas). Sits behind content, low opacity.
 */
import React, { useRef, useEffect } from 'react';

const CHARS = '0123456789PBALL$%';
const COLUMN_COUNT = 28;
const FALL_SPEED = 0.8;
const FONT_SIZE = 14;
const OPACITY_HEAD = 0.5;
const OPACITY_TAIL = 0.04;

interface Drop {
  y: number;
  speed: number;
  chars: string[];
}

export const MatrixRain: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animationId: number;
    let drops: Drop[] = [];
    let lastWidth = 0;
    let lastHeight = 0;

    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        lastWidth = w;
        lastHeight = h;
        const cols = Math.max(12, Math.floor(w / 36));
        drops = Array.from({ length: cols }, (_, i) => ({
          y: (i * (h / cols)) % h - h * 0.2,
          speed: FALL_SPEED + Math.random() * 0.6,
          chars: Array.from({ length: 8 + Math.floor(Math.random() * 12) }, () =>
            CHARS[Math.floor(Math.random() * CHARS.length)]
          ),
        }));
      }
    };

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const colWidth = w / drops.length;
      ctx.font = `${FONT_SIZE}px "JetBrains Mono", monospace`;

      drops.forEach((drop, i) => {
        const x = i * colWidth + colWidth * 0.3;
        drop.chars.forEach((char, j) => {
          const y = drop.y + j * (FONT_SIZE + 2);
          if (y < -FONT_SIZE) return;
          const t = j / drop.chars.length;
          const opacity = OPACITY_TAIL + (1 - t) * (OPACITY_HEAD - OPACITY_TAIL);
          ctx.fillStyle = `rgba(0, 255, 65, ${opacity})`;
          ctx.fillText(char, x, y);
        });
        drop.y += drop.speed;
        if (drop.y > h + 80) drop.y = -100;
      });

      animationId = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener('resize', resize);
    draw();
    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0 }}
      aria-hidden
    />
  );
};

export default MatrixRain;
