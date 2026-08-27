import { useEffect, useRef } from 'react';
import { FloatingControls } from './components/FloatingControls';
import { loadImage } from './engine/SpriteLoader';
import { drawTerrain, drawPlayer } from './engine/Renderer';
import { drawDebugOverlay } from './engine/DebugOverlay';
import { createGameLoop } from './engine/GameLoop';
import { stepPlayerPhysics, checkPitFall, resolvePitFall } from './engine/Physics';
import { updateCamera } from './engine/Camera';
import { createKeyboardInput } from './engine/Input';
import { level1 } from './level/level1';
import { RENDERED_TILE_SIZE } from './level/Terrain';
import { advancePlayerAnimation, updatePlayerAnimState, PLAYER_RENDERED_SIZE } from './entities/Player';
import { takeDamage, PIT_FALL_DAMAGE } from './entities/Health';
import { playerState, cameraPositionX, healthState } from './PlatformerState';

export const PlatformerPage = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tilesetRef = useRef<HTMLImageElement | null>(null);
  const playerSpriteRef = useRef<HTMLImageElement | null>(null);
  const playerJumpSpriteRef = useRef<HTMLImageElement | null>(null);
  const debugHitboxes = new URLSearchParams(window.location.search).get('debug') === 'hitboxes';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Cached across frames: only recomputed on mount and on actual window
    // resize, since neither the canvas dimensions nor the CSS custom
    // property change on any other frame.
    let backgroundColor = '#000';

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      backgroundColor =
        getComputedStyle(document.documentElement).getPropertyValue('--background').trim() ||
        '#000';
    };

    const render = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Anchor the level to the bottom of the canvas so a taller viewport
      // shows more sky above the ground instead of empty space below it.
      const levelPixelHeight = level1.height * RENDERED_TILE_SIZE;
      const originY = canvas.height - levelPixelHeight;
      const originX = -cameraPositionX.value;

      if (tilesetRef.current) {
        drawTerrain(ctx, level1, tilesetRef.current, originX, originY);
      }

      if (playerSpriteRef.current) {
        drawPlayer(ctx, playerState.value, playerSpriteRef.current, originX, originY, playerJumpSpriteRef.current);
      }

      if (debugHitboxes) drawDebugOverlay(ctx, playerState.value, level1, originX, originY);
    };

    resize();
    render();
    canvas.focus();

    const onResize = () => {
      resize();
      render();
    };
    window.addEventListener('resize', onResize);

    const input = createKeyboardInput();

    const loop = createGameLoop((dt) => {
      // A/D accepted as an alternate to Arrow Left/Right (FR-007 only
      // requires arrows; this is an additive convenience, not a replacement).
      const horizontal = {
        left: input.isHeld('ArrowLeft') || input.isHeld('KeyA'),
        right: input.isHeld('ArrowRight') || input.isHeld('KeyD'),
      };
      // Both must be evaluated (not short-circuited) since consumePress has
      // the side effect of clearing the pending press it finds.
      const spacePressed = input.consumePress('Space');
      const arrowUpPressed = input.consumePress('ArrowUp');
      const jumpPressed = spacePressed || arrowUpPressed;
      const jumpHeld = input.isHeld('Space') || input.isHeld('ArrowUp');
      const dropThroughHeld = input.isHeld('ArrowDown') || input.isHeld('KeyS');

      let next = stepPlayerPhysics(playerState.value, level1, dt, {
        ...horizontal,
        jumpPressed,
        jumpHeld,
        dropThroughHeld,
      });
      next = updatePlayerAnimState(next);
      next = advancePlayerAnimation(next, dt);

      if (checkPitFall(next, level1)) {
        healthState.value = takeDamage(healthState.value, PIT_FALL_DAMAGE);
        next = resolvePitFall(next);
      }

      playerState.value = next;

      const levelPixelWidth = level1.width * RENDERED_TILE_SIZE;
      cameraPositionX.value = updateCamera(
        cameraPositionX.value,
        next.x,
        PLAYER_RENDERED_SIZE,
        canvas.width,
        levelPixelWidth,
      );

      render();
    });
    loop.start();

    let cancelled = false;
    loadImage('/sprites/world_tileset.png')
      .then((img) => {
        if (cancelled) return;
        tilesetRef.current = img;
        render();
      })
      .catch(() => {
        // Terrain simply won't render if the tileset fails to load; the
        // background fill still shows so the page isn't blank.
      });
    loadImage('/sprites/knight.png')
      .then((img) => {
        if (cancelled) return;
        playerSpriteRef.current = img;
        render();
      })
      .catch(() => {
        // Player simply won't render if the sprite fails to load; the
        // terrain still shows.
      });
    loadImage('/sprites/knight2.png')
      .then((img) => {
        if (cancelled) return;
        playerJumpSpriteRef.current = img;
        render();
      })
      .catch(() => {
        // Jump falls back to the primary sheet's current frame if this one
        // fails to load (see Renderer.ts's drawPlayer).
      });

    return () => {
      cancelled = true;
      loop.stop();
      input.destroy();
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <canvas ref={canvasRef} data-testid="platformer-canvas" className="block" tabIndex={-1} />
      <FloatingControls />
    </div>
  );
};
