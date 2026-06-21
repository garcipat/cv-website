/**
 * Ambient CSS-only nebula clouds.
 *
 * 3 large blurred color blobs (pink, blue, purple) positioned at edges
 * of the viewport, drifting horizontally via the `nebula-drift` CSS keyframe.
 * Fixed-position, `pointer-events: none`, no props.
 *
 * Matches the mockup: hex base colors, opacity 0.12, blur(60px), translateX drift.
 */
export const Nebula = () => {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden" aria-hidden="true">
      <div
        className="absolute rounded-full"
        style={{
          width: '500px',
          height: '300px',
          background: '#ff6b9d',
          top: '10%',
          left: '-20%',
          filter: 'blur(60px)',
          opacity: 0.12,
          animation: 'nebula-drift 60s linear infinite',
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          width: '400px',
          height: '250px',
          background: '#4a9eff',
          top: '60%',
          right: '-15%',
          filter: 'blur(60px)',
          opacity: 0.12,
          animation: 'nebula-drift 75s linear infinite',
          animationDelay: '-20s',
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          width: '350px',
          height: '200px',
          background: '#a855f7',
          top: '30%',
          left: '40%',
          filter: 'blur(60px)',
          opacity: 0.12,
          animation: 'nebula-drift 90s linear infinite',
          animationDelay: '-45s',
        }}
      />
    </div>
  );
};
