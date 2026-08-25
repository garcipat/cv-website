import { useEffect, useRef } from 'react';
import { FloatingControls } from './components/FloatingControls';
import { loadImage } from './engine/SpriteLoader';
import { drawTerrain } from './engine/Renderer';
import { level1 } from './level/level1';

export const PlatformerPage = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tilesetRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const draw = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const backgroundColor = getComputedStyle(document.documentElement)
        .getPropertyValue('--background')
        .trim();
      ctx.fillStyle = backgroundColor || '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (tilesetRef.current) {
        drawTerrain(ctx, level1, tilesetRef.current);
      }
    };

    draw();
    window.addEventListener('resize', draw);

    let cancelled = false;
    loadImage('/sprites/world_tileset.png')
      .then((img) => {
        if (cancelled) return;
        tilesetRef.current = img;
        draw();
      })
      .catch(() => {
        // Terrain simply won't render if the tileset fails to load; the
        // background fill still shows so the page isn't blank.
      });

    return () => {
      cancelled = true;
      window.removeEventListener('resize', draw);
    };
  }, []);

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <canvas ref={canvasRef} data-testid="platformer-canvas" className="block" />
      <FloatingControls />
    </div>
  );
};
