/**
 * Ambient CSS-only sun element.
 *
 * Large warm gradient circle pushed deep into the bottom-left corner,
 * with a pulsing box-shadow glow. Fixed-position, `pointer-events: none`.
 */
export const Sun = () => {
  return (
    <div
      className="fixed z-0 pointer-events-none"
      aria-hidden="true"
      style={{
        bottom: '-60px',
        left: '-40px',
        width: '250px',
        height: '250px',
        borderRadius: '50%',
        background: `
          radial-gradient(
            circle at 50% 50%,
            #fff9c4 0%,
            #ffcc02 30%,
            #ff9500 60%,
            #cc4400 100%
          )
        `,
        boxShadow: '0 0 80px 40px rgba(255,160,0,0.3), 0 0 160px 80px rgba(255,120,0,0.15)',
        animation: 'sun-pulse 5s ease-in-out infinite alternate',
      }}
    />
  );
};
