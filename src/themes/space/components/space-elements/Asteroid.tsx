import type { ElementTransform } from './types';

export interface AsteroidProps {
  transform: ElementTransform;
}

/**
 * Scroll-driven tumbling asteroid.
 *
 * Pure CSS shape: irregular blob via asymmetric border-radius,
 * dark gradient body with small nested crater circles.
 * Uses `pointer-events: none`.
 */
export const Asteroid = ({ transform }: AsteroidProps) => {
  const { x, y, scale, rotation, opacity } = transform;

  // Random-ish seed for crater positions (stable per render)
  const craterSeed = 42;

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: 0,
        top: 0,
        width: '1px',
        height: '1px',
        transform: `translate(${x}vw, ${y}vh)`,
        opacity,
      }}
    >
      <div
        style={{
          transform: `scale(${scale}) rotate(${rotation}deg)`,
          marginTop: '-28px',
          marginLeft: '-25px',
          position: 'relative',
          width: '50px',
          height: '55px',
        }}
      >
        {/* Main rock body — irregular shape */}
        <div
          style={{
            position: 'absolute',
            width: '50px',
            height: '55px',
            borderRadius: '60% 40% 50% 50% / 55% 45% 55% 45%',
            background: `
              linear-gradient(
                135deg,
                oklch(0.35 0.02 80) 0%,
                oklch(0.25 0.02 70) 40%,
                oklch(0.18 0.02 60) 100%
              )
            `,
            boxShadow: `
              inset 2px -2px 6px oklch(0.45 0.02 80 / 0.3),
              inset -3px 2px 8px oklch(0.1 0.02 50 / 0.4),
              0 0 8px oklch(0.15 0.02 60 / 0.2)
            `,
          }}
        />

        {/* Crater 1 */}
        <div
          style={{
            position: 'absolute',
            left: `${12 + ((craterSeed * 7) % 20)}px`,
            top: `${10 + ((craterSeed * 3) % 15)}px`,
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            background: 'oklch(0.15 0.02 60 / 0.6)',
            boxShadow: 'inset 1px 1px 2px oklch(0.35 0.02 80 / 0.3)',
          }}
        />

        {/* Crater 2 */}
        <div
          style={{
            position: 'absolute',
            left: `${25 + ((craterSeed * 5) % 15)}px`,
            top: `${20 + ((craterSeed * 2) % 10)}px`,
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: 'oklch(0.12 0.02 60 / 0.5)',
            boxShadow: 'inset 1px 1px 1px oklch(0.3 0.02 80 / 0.25)',
          }}
        />

        {/* Crater 3 */}
        <div
          style={{
            position: 'absolute',
            left: `${8 + ((craterSeed * 9) % 18)}px`,
            top: `${32 + ((craterSeed * 4) % 12)}px`,
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            background: 'oklch(0.14 0.02 60 / 0.55)',
            boxShadow: 'inset 1px 1px 1px oklch(0.32 0.02 80 / 0.2)',
          }}
        />

        {/* Crater 4 (small) */}
        <div
          style={{
            position: 'absolute',
            left: `${30 + ((craterSeed * 11) % 12)}px`,
            top: `${38 + ((craterSeed * 6) % 8)}px`,
            width: '4px',
            height: '4px',
            borderRadius: '50%',
            background: 'oklch(0.13 0.02 60 / 0.5)',
          }}
        />
      </div>
    </div>
  );
};
