import type { ElementTransform } from './types';

export interface UFOProps {
  transform: ElementTransform;
}

/**
 * Scroll-driven UFO with Simpsons-style alien riding on top.
 * Both alien head and saucer share a single centered column layout.
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
          marginTop: '-45px',
          marginLeft: '-40px',
          animation: 'ufo-hover 3s ease-in-out infinite',
        }}
      >
        {/* ── Single centered column: alien on top, saucer below ── */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: '80px',
            animation: 'alien-wiggle 0.5s ease-in-out infinite alternate',
          }}
        >
          {/* Antenna stick */}
          <div
            style={{
              width: '2px',
              height: '14px',
              background: '#44dd44',
              borderRadius: '1px',
              marginBottom: '-3px',
              marginLeft: '-4px',
            }}
          />
          {/* Antenna bulb */}
          <div
            style={{
              width: '6px',
              height: '6px',
              background: '#ffdd44',
              borderRadius: '50%',
              marginBottom: '-3px',
              marginLeft: '-4px',
              boxShadow: '0 0 6px rgba(255,221,68,0.7)',
            }}
          />

          {/* Head */}
          <div
            style={{
              width: '36px',
              height: '40px',
              background: '#44dd44',
              borderRadius: '50%',
              position: 'relative',
              boxShadow: '0 0 16px rgba(68,221,68,0.45)',
            }}
          >
            {/* Left eye */}
            <div
              style={{
                position: 'absolute',
                width: '12px',
                height: '14px',
                background: 'white',
                borderRadius: '50%',
                top: '13px',
                left: '5px',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  width: '5px',
                  height: '6px',
                  background: 'black',
                  borderRadius: '50%',
                  top: '5px',
                  left: '4px',
                  animation: 'alien-pupil-look 3s ease-in-out infinite',
                }}
              />
            </div>
            {/* Right eye */}
            <div
              style={{
                position: 'absolute',
                width: '12px',
                height: '14px',
                background: 'white',
                borderRadius: '50%',
                top: '13px',
                right: '5px',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  width: '5px',
                  height: '6px',
                  background: 'black',
                  borderRadius: '50%',
                  top: '5px',
                  right: '4px',
                }}
              />
            </div>

            {/* Triangular teeth */}
            <div
              style={{
                position: 'absolute',
                bottom: '2px',
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                gap: '1px',
              }}
            >
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  style={{
                    width: 0,
                    height: 0,
                    borderLeft: '3px solid transparent',
                    borderRight: '3px solid transparent',
                    borderTop: '5px solid white',
                  }}
                />
              ))}
            </div>
          </div>

          {/* Small neck gap */}
          <div style={{ height: '2px' }} />

          {/* Saucer body */}
          <div
            style={{
              width: '80px',
              height: '20px',
              background: 'linear-gradient(180deg, #d4d4d4, #808080, #5a5a5a)',
              borderRadius: '50%',
              position: 'relative',
              boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
            }}
          >
            {/* Rim highlight */}
            <div
              style={{
                position: 'absolute',
                top: '3px',
                left: '10%',
                width: '80%',
                height: '3px',
                background: 'rgba(255,255,255,0.35)',
                borderRadius: '2px',
              }}
            />

            {/* Blinking lights */}
            {[
              { left: '14px', delay: '0s' },
              { left: '34px', delay: '0.25s' },
              { left: '54px', delay: '0.1s' },
            ].map((light, i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  width: '5px',
                  height: '5px',
                  background: '#ff3333',
                  borderRadius: '50%',
                  bottom: '3px',
                  left: light.left,
                  boxShadow: '0 0 4px rgba(255,50,50,0.8)',
                  animation: `ufo-blink 0.5s linear infinite alternate`,
                  animationDelay: light.delay,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
