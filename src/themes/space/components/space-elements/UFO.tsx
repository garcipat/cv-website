import type { ElementTransform } from './types';

export interface UFOProps {
  transform: ElementTransform;
}

/**
 * UFO with Simpsons-style alien — inline SVG.
 * Silver saucer, green alien head with antenna, eyes, and triangular teeth.
 * Uses `pointer-events: none`.
 */
export const UFO = ({ transform }: UFOProps) => {
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
          marginTop: '-55px',
          marginLeft: '-45px',
          animation: 'ufo-hover 3s ease-in-out infinite',
        }}
      >
        <svg
          width="90"
          height="85"
          viewBox="0 0 90 85"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <g>
            <animateTransform
              attributeName="transform"
              type="rotate"
              values="-3 45 40;3 45 40;-3 45 40"
              dur="0.5s"
              repeatCount="indefinite"
            />

            {/* Antenna stick */}
            <line x1="40" y1="20" x2="38" y2="4" stroke="#44dd44" strokeWidth="2" strokeLinecap="round" />
            {/* Antenna bulb */}
            <circle cx="37" cy="2" r="3.5" fill="#ffdd44" />
            <circle cx="37" cy="2" r="6" fill="none" stroke="rgba(255,221,68,0.4)" strokeWidth="1.5">
              <animate attributeName="r" values="6;9;6" dur="1s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.4;0.15;0.4" dur="1s" repeatCount="indefinite" />
            </circle>

            {/* Alien head */}
            <ellipse cx="45" cy="35" rx="18" ry="20" fill="#44dd44" />
            <ellipse cx="45" cy="35" rx="18" ry="20" fill="none" stroke="rgba(68,221,68,0.5)" strokeWidth="2">
              <animate attributeName="rx" values="18;20;18" dur="1s" repeatCount="indefinite" />
              <animate attributeName="ry" values="20;22;20" dur="1s" repeatCount="indefinite" />
            </ellipse>

            {/* Left eye */}
            <ellipse cx="38" cy="32" rx="6" ry="7" fill="white" />
            <circle cx="39" cy="33" r="2.5" fill="black">
              <animate attributeName="cx" values="39;37;39" dur="3s" repeatCount="indefinite" />
            </circle>

            {/* Right eye */}
            <ellipse cx="52" cy="32" rx="6" ry="7" fill="white" />
            <circle cx="53" cy="33" r="2.5" fill="black" />

            {/* Teeth */}
            <polygon points="40,52 42,47 44,52" fill="white" />
            <polygon points="44,52 46,47 48,52" fill="white" />
            <polygon points="48,52 50,47 52,52" fill="white" />

            {/* Neck gap */}
            <rect x="36" y="53" width="18" height="3" fill="#0a0a1a" />

            {/* Saucer body */}
            <ellipse cx="45" cy="63" rx="42" ry="11" fill="url(#saucerGrad)" />
            <ellipse cx="45" cy="63" rx="42" ry="11" fill="none" stroke="#666" strokeWidth="0.5" />

            {/* Saucer rim highlight */}
            <ellipse cx="45" cy="60" rx="34" ry="3" fill="rgba(255,255,255,0.15)" />

            {/* Blinking lights */}
            <circle cx="18" cy="63" r="2.5" fill="#ff3333">
              <animate attributeName="opacity" values="0.3;1;0.3" dur="0.5s" repeatCount="indefinite" />
            </circle>
            <circle cx="45" cy="63" r="2.5" fill="#ff3333">
              <animate attributeName="opacity" values="1;0.3;1" dur="0.5s" begin="0.25s" repeatCount="indefinite" />
            </circle>
            <circle cx="72" cy="63" r="2.5" fill="#ff3333">
              <animate attributeName="opacity" values="0.3;1;0.3" dur="0.5s" begin="0.1s" repeatCount="indefinite" />
            </circle>
          </g>

          <defs>
            <linearGradient id="saucerGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#d4d4d4" />
              <stop offset="50%" stopColor="#808080" />
              <stop offset="100%" stopColor="#5a5a5a" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </div>
  );
};
