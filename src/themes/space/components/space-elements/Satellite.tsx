import type { ElementTransform } from './types';

export interface SatelliteProps {
  transform: ElementTransform;
}

/**
 * Scroll-driven retro satellite probe — inline SVG.
 * Gray body, two blue solar panels with grid lines, antenna with blinking
 * red tip. Uses `pointer-events: none`.
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
          marginTop: '-35px',
          marginLeft: '-30px',
        }}
      >
        <svg
          width="60"
          height="70"
          viewBox="0 0 60 70"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="satBodyGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#c0c0c0" />
              <stop offset="100%" stopColor="#808080" />
            </linearGradient>
            <linearGradient id="satPanelGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#6666cc" />
              <stop offset="50%" stopColor="#5555aa" />
              <stop offset="100%" stopColor="#6666cc" />
            </linearGradient>
          </defs>

          {/* Upper solar panel */}
          <rect x="4" y="0" width="52" height="14" rx="2" fill="url(#satPanelGrad)" stroke="#444488" strokeWidth="1" />
          <line x1="18" y1="0" x2="18" y2="14" stroke="rgba(100,100,180,0.4)" strokeWidth="1" />
          <line x1="38" y1="0" x2="38" y2="14" stroke="rgba(100,100,180,0.4)" strokeWidth="1" />

          {/* Central body */}
          <rect x="18" y="18" width="24" height="34" rx="3" fill="url(#satBodyGrad)" stroke="#999" strokeWidth="1" />

          {/* Antenna mast */}
          <line x1="30" y1="4" x2="30" y2="18" stroke="#ccc" strokeWidth="1.5" />

          {/* Blinking red light */}
          <circle cx="30" cy="2" r="3.5" fill="#ff3333">
            <animate attributeName="opacity" values="0.3;1;0.3" dur="1.2s" repeatCount="indefinite" />
          </circle>
          <circle cx="30" cy="2" r="6" fill="none" stroke="rgba(255,50,50,0.3)" strokeWidth="1.5">
            <animate attributeName="r" values="6;9;6" dur="1.2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.3;0.1;0.3" dur="1.2s" repeatCount="indefinite" />
          </circle>

          {/* Lower solar panel */}
          <rect x="4" y="56" width="52" height="14" rx="2" fill="url(#satPanelGrad)" stroke="#444488" strokeWidth="1" />
          <line x1="18" y1="56" x2="18" y2="70" stroke="rgba(100,100,180,0.4)" strokeWidth="1" />
          <line x1="38" y1="56" x2="38" y2="70" stroke="rgba(100,100,180,0.4)" strokeWidth="1" />
        </svg>
      </div>
    </div>
  );
};
