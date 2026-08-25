import { useEffect, useRef } from 'react';
import { FloatingControls } from './components/FloatingControls';
import { loadImage } from './engine/SpriteLoader';
import { drawTerrain, drawPlayer } from './engine/Renderer';
import { level1 } from './level/level1';
import { RENDERED_TILE_SIZE } from './level/Terrain';
import { playerState } from './PlatformerState';

export const PlatformerPage = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tilesetRef = useRef<HTMLImageElement | null>(null);
  const playerSpriteRef = useRef<HTMLImageElement | null>(null);

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

      // Anchor the level to the bottom of the canvas so a taller viewport
      // shows more sky above the ground instead of empty space below it.
      const levelPixelHeight = level1.height * RENDERED_TILE_SIZE;
      const originY = canvas.height - levelPixelHeight;

      if (tilesetRef.current) {
        drawTerrain(ctx, level1, tilesetRef.current, originY);
      }

      if (playerSpriteRef.current) {
        drawPlayer(ctx, playerState.value, playerSpriteRef.current, originY);
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
    loadImage('/sprites/knight.png')
      .then((img) => {
        if (cancelled) return;
        playerSpriteRef.current = img;
        draw();
      })
      .catch(() => {
        // Player simply won't render if the sprite fails to load; the
        // terrain still shows.
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
