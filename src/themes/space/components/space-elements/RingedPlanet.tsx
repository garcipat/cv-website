import type { ElementTransform } from './types';

export interface RingedPlanetProps {
  transform: ElementTransform;
}

/**
 * Scroll-driven ringed planet.
 *
 * Pure CSS shape: radial-gradient circle body with an elliptical ring
 * formed by the ::after pseudo-element. Rendered as a `<div>` with
 * `pointer-events: none`.
 */
export const RingedPlanet = ({ transform }: RingedPlanetProps) => {
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
      {/* Planet body */}
      <div
        className="absolute rounded-full"
        style={{
          width: '120px',
          height: '120px',
          marginLeft: '-60px',
          marginTop: '-60px',
          transform: `scale(${scale}) rotate(${rotation}deg)`,
          background: `
            radial-gradient(
              ellipse at 35% 30%,
              oklch(0.75 0.12 100) 0%,
              oklch(0.55 0.15 65) 30%,
              oklch(0.35 0.08 55) 70%,
              oklch(0.15 0.04 40) 100%
            )
          `,
          boxShadow: `
            inset 0 -4px 8px oklch(0 0 0 / 0.3),
            0 0 30px oklch(0.55 0.15 65 / 0.15)
          `,
        }}
      />
      {/* Elliptical ring via ::after equivalent — rendered as a sibling div for reliability */}
      <div
        className="absolute rounded-full"
        style={{
          width: '200px',
          height: '50px',
          marginLeft: '-100px',
          marginTop: '-25px',
          transform: `scale(${scale}) rotateX(75deg) rotate(${rotation + 15}deg)`,
          background: 'transparent',
          border: '3px solid oklch(0.7 0.05 80 / 0.5)',
          boxShadow: '0 0 12px oklch(0.7 0.1 80 / 0.25)',
        }}
      />
    </div>
  );
};
