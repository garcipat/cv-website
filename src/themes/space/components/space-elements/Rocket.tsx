import type { ElementTransform } from './types';

export interface RocketProps {
  transform: ElementTransform;
}

/**
 * Scroll-driven rocket silhouette (Futurama Planet Express style).
 *
 * Green teardrop body, red nose cone with glow, dual wings,
 * tail fin, and orange triangular engine flame with flicker.
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
          marginLeft: '-40px',
        }}
      >
        <div
          style={{
            position: 'relative',
            width: '80px',
            height: '36px',
            animation: 'rocket-bob 3s ease-in-out infinite',
          }}
        >
          {/* Engine flame (behind body) */}
          <div
            style={{
              position: 'absolute',
              right: '-10px',
              top: '13px',
              width: 0,
              height: 0,
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderTop: '14px solid #ffaa00',
              animation: 'rocket-flame-flicker 0.15s ease-in-out infinite alternate',
            }}
          />

          {/* Body hull — green teardrop */}
          <div
            style={{
              position: 'absolute',
              width: '50px',
              height: '20px',
              background: 'linear-gradient(180deg, #5ceb8a, #3aaf5c)',
              borderRadius: '50% 10% 10% 50%',
              top: '8px',
              left: '5px',
              boxShadow: 'inset 0 -4px 0 rgba(0,0,0,0.2)',
            }}
          />

          {/* Nose cone — red circle with glow */}
          <div
            style={{
              position: 'absolute',
              width: '18px',
              height: '18px',
              background: '#ff4444',
              borderRadius: '50%',
              top: '9px',
              left: '-8px',
              boxShadow: '0 0 10px rgba(255,100,100,0.5)',
            }}
          />

          {/* Top wing */}
          <div
            style={{
              position: 'absolute',
              width: '30px',
              height: '8px',
              background: '#2d8a45',
              borderRadius: '2px',
              top: '6px',
              left: '25px',
              transform: 'rotate(-5deg)',
            }}
          />

          {/* Bottom wing */}
          <div
            style={{
              position: 'absolute',
              width: '30px',
              height: '8px',
              background: '#2d8a45',
              borderRadius: '2px',
              top: '22px',
              left: '25px',
              transform: 'rotate(5deg)',
            }}
          />

          {/* Tail fin */}
          <div
            style={{
              position: 'absolute',
              width: '24px',
              height: '16px',
              background: '#3aaf5c',
              borderRadius: '0 30% 30% 0',
              top: '10px',
              right: 0,
            }}
          />
        </div>
      </div>
    </div>
  );
};
