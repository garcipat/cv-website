import type { ElementTransform } from './types';

export interface RocketProps {
  transform: ElementTransform;
}

/**
 * Futurama Planet Express rocket — inline SVG.
 * Green teardrop body, red nose cone, dual wings, tail fin, engine flame.
 * Uses `pointer-events: none`.
 */
export const Rocket = ({ transform }: RocketProps) => {
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
          marginTop: '-25px',
          marginLeft: '-50px',
          animation: 'rocket-bob 3s ease-in-out infinite',
        }}
      >
        <svg
          width="100"
          height="50"
          viewBox="0 0 100 50"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Engine flame */}
          <path d="M72 14 L95 20 L72 26 Z" fill="#ffaa00" opacity="0.9">
            <animate
              attributeName="d"
              values="M72 14 L95 20 L72 26 Z;M72 13 L100 20 L72 27 Z;M72 14 L95 20 L72 26 Z"
              dur="0.15s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0.9;1;0.9"
              dur="0.15s"
              repeatCount="indefinite"
            />
          </path>

          {/* Tail fin */}
          <path d="M60 14 L78 12 L78 28 L60 26 Z" fill="#3aaf5c" />

          {/* Bottom wing */}
          <path d="M18 31 L45 31 L50 35 L30 35 Z" fill="#2d8a45" />

          {/* Body hull */}
          <path
            d="M5 15 C5 8, 30 5, 65 8 L65 32 C30 35, 5 32, 5 25 Z"
            fill="url(#bodyGrad)"
            stroke="#2d8a45"
            strokeWidth="0.5"
          />
          <defs>
            <linearGradient id="bodyGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#5ceb8a" />
              <stop offset="50%" stopColor="#3aaf5c" />
              <stop offset="100%" stopColor="#2d8a45" />
            </linearGradient>
          </defs>

          {/* Top wing */}
          <path d="M18 9 L45 9 L50 5 L30 5 Z" fill="#2d8a45" />

          {/* Dark body stripe */}
          <path d="M15 18 L62 18" stroke="#2d8a45" strokeWidth="2" opacity="0.4" />

          {/* Cockpit window */}
          <ellipse cx="18" cy="19" rx="7" ry="8" fill="oklch(0.7 0.05 220 / 0.6)" stroke="#5ceb8a" strokeWidth="0.5" />

          {/* Nose cone — red */}
          <circle cx="4" cy="20" r="6" fill="#ff4444" />
        </svg>
      </div>
    </div>
  );
};
