import type { ElementTransform } from './types';

export interface ShootingStarProps {
  transform: ElementTransform;
}

/**
 * Scroll-driven shooting star (comet).
 *
 * Pure CSS shape: bright dot head with a linear-gradient trail via
 * a sibling div. Diagonal orientation via rotation.
 * Uses `pointer-events: none`.
 */
export const ShootingStar = ({ transform }: ShootingStarProps) => {
  const { x, y, scale, rotation, opacity } = transform;

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
          marginTop: '-1px',
          marginLeft: '-50px',
          position: 'relative',
        }}
      >
        {/* Trail: long fading gradient behind the head */}
        <div
          style={{
            position: 'absolute',
            right: '4px',
            top: '50%',
            width: '70px',
            height: '2px',
            marginTop: '-1px',
            borderRadius: '1px',
            background: `
              linear-gradient(
                90deg,
                transparent 0%,
                oklch(0.95 0.15 80 / 0.8) 50%,
                oklch(1 0.05 90) 100%
              )
            `,
            boxShadow: '0 0 6px oklch(0.9 0.2 80 / 0.5)',
            animation: 'shooting-star-trail 0.4s ease-out forwards',
          }}
        />

        {/* Bright head: small glowing dot */}
        <div
          style={{
            position: 'absolute',
            right: '-6px',
            top: '50%',
            width: '8px',
            height: '8px',
            marginTop: '-4px',
            borderRadius: '50%',
            background: 'oklch(1 0.02 95)',
            boxShadow: `
              0 0 8px 2px oklch(1 0.1 85 / 0.8),
              0 0 16px 4px oklch(0.9 0.15 80 / 0.5),
              0 0 24px 6px oklch(0.8 0.2 75 / 0.3)
            `,
          }}
        />
      </div>
    </div>
  );
};
