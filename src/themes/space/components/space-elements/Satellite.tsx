import type { ElementTransform } from './types';

export interface SatelliteProps {
  transform: ElementTransform;
}

/**
 * Scroll-driven retro satellite probe.
 *
 * Pure CSS shape with gray body, blue-gradient solar panels, antenna
 * with blinking red light. Uses `pointer-events: none`.
 */
export const Satellite = ({ transform }: SatelliteProps) => {
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
          marginTop: '-30px',
          marginLeft: '-28px',
        }}
      >
        <div
          style={{
            position: 'relative',
            width: '56px',
            height: '60px',
          }}
        >
          {/* Upper solar panel */}
          <div
            style={{
              position: 'absolute',
              left: '2px',
              top: '-20px',
              width: '52px',
              height: '14px',
              borderRadius: '2px',
              background: `
                linear-gradient(
                  90deg,
                  oklch(0.5 0.08 245) 0%,
                  oklch(0.4 0.06 255) 50%,
                  oklch(0.5 0.08 245) 100%
                )
              `,
              border: '1px solid oklch(0.3 0.04 250 / 0.6)',
            }}
          />

          {/* Panel grid lines (upper) */}
          <div
            style={{
              position: 'absolute',
              left: '16px',
              top: '-20px',
              width: '1px',
              height: '14px',
              background: 'oklch(0.3 0.04 250 / 0.4)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: '35px',
              top: '-20px',
              width: '1px',
              height: '14px',
              background: 'oklch(0.3 0.04 250 / 0.4)',
            }}
          />

          {/* Central body */}
          <div
            style={{
              position: 'absolute',
              left: '18px',
              top: '8px',
              width: '20px',
              height: '44px',
              borderRadius: '4px',
              background: `
                linear-gradient(
                  180deg,
                  oklch(0.55 0.02 100) 0%,
                  oklch(0.4 0.02 100) 100%
                )
              `,
              border: '1px solid oklch(0.3 0.02 100)',
              boxShadow: 'inset 0 0 4px oklch(0 0 0 / 0.15)',
            }}
          />

          {/* Antenna mast */}
          <div
            style={{
              position: 'absolute',
              left: '26px',
              top: '-14px',
              width: '2px',
              height: '22px',
              background: 'oklch(0.7 0.02 100)',
            }}
          />

          {/* Blinking red light on antenna tip */}
          <div
            className="absolute rounded-full"
            style={{
              left: '23px',
              top: '-18px',
              width: '8px',
              height: '8px',
              background: 'oklch(0.6 0.2 25)',
              boxShadow: '0 0 8px oklch(0.6 0.2 25 / 0.6)',
              animation: 'star-twinkle 1.2s ease-in-out infinite',
            }}
          />

          {/* Lower solar panel */}
          <div
            style={{
              position: 'absolute',
              left: '2px',
              top: '56px',
              width: '52px',
              height: '14px',
              borderRadius: '2px',
              background: `
                linear-gradient(
                  90deg,
                  oklch(0.5 0.08 245) 0%,
                  oklch(0.4 0.06 255) 50%,
                  oklch(0.5 0.08 245) 100%
                )
              `,
              border: '1px solid oklch(0.3 0.04 250 / 0.6)',
            }}
          />

          {/* Panel grid lines (lower) */}
          <div
            style={{
              position: 'absolute',
              left: '16px',
              top: '56px',
              width: '1px',
              height: '14px',
              background: 'oklch(0.3 0.04 250 / 0.4)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: '35px',
              top: '56px',
              width: '1px',
              height: '14px',
              background: 'oklch(0.3 0.04 250 / 0.4)',
            }}
          />
        </div>
      </div>
    </div>
  );
};
