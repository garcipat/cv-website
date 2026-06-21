import type { ElementTransform } from './types';

export interface RingedPlanetProps {
  transform: ElementTransform;
}

/**
 * Scroll-driven ringed planet — inline SVG.
 * Gradient sphere with perspective ring: back half behind, front half in front.
 * Subtle crescent shadow for depth. Uses `pointer-events: none`.
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
      <div
        style={{
          transform: `scale(${scale}) rotate(${rotation}deg)`,
          marginTop: '-100px',
          marginLeft: '-100px',
        }}
      >
        <svg
          width="200"
          height="200"
          viewBox="0 0 200 200"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <radialGradient id="planetGrad2" cx="35%" cy="30%">
              <stop offset="0%" stopColor="#ffcc80" />
              <stop offset="30%" stopColor="#e67e22" />
              <stop offset="70%" stopColor="#8b4513" />
              <stop offset="100%" stopColor="#3d1c00" />
            </radialGradient>
          </defs>

          {/* Ring — back half (behind planet, top arc) */}
          <path
            d="M 10 100 A 90 24 0 0 0 190 100"
            fill="none"
            stroke="rgba(210,180,140,0.3)"
            strokeWidth="5"
          />

          {/* Planet body */}
          <circle cx="100" cy="100" r="60" fill="url(#planetGrad2)" />

          {/* Ring — front half (in front of planet, bottom arc) */}
          <path
            d="M 10 100 A 90 24 0 0 1 190 100"
            fill="none"
            stroke="rgba(210,180,140,0.45)"
            strokeWidth="5"
          />
          <path
            d="M 10 100 A 90 24 0 0 1 190 100"
            fill="none"
            stroke="rgba(230,200,160,0.15)"
            strokeWidth="2"
          />
        </svg>
      </div>
    </div>
  );
};
