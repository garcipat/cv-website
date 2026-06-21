import { useRef, useEffect, useCallback, useState, forwardRef, useImperativeHandle } from 'react';
import { useSignals } from '@preact/signals-react/runtime';
import { ParadeCircle } from './ParadeCircle';
import {
  computeCircleTransform,
  findClosestCircleIndex,
  totalScrollSpan,
  POOL_SIZE,
  type CircleEntry,
  type CircleTransform,
} from '../parade-utils';

export interface CircleParadeProps {
  entries: CircleEntry[];
  /** Called on every frame with the active circle index (for anchor dot sync) */
  onActiveCircleChange?: (index: number) => void;
  /** Fired when user scrolls (not on mount initial update) — for hiding poster etc. */
  onUserScroll?: () => void;
}

/** Methods exposed to parent via ref for anchor dot navigation. */
export interface CircleParadeHandle {
  scrollToCircle: (circleIndex: number) => void;
}

/**
 * Scroll-driven circle parade manager.
 *
 * - Scroll container uses absolute positioning to fill viewport.
 * - Circles live in a separate fixed overlay (stage) so they stay in viewport.
 * - Observes scroll position with rAF throttling.
 * - Manages a fixed 7-slot circle pool (FR-030).
 */
export const CircleParade = forwardRef<CircleParadeHandle, CircleParadeProps>(
  ({ entries, onActiveCircleChange, onUserScroll }, ref) => {
  useSignals();

  const containerRef = useRef<HTMLDivElement>(null);
  const tickingRef = useRef(false);
  const initialDoneRef = useRef(false);

  const [poolAssignments, setPoolAssignments] = useState<number[]>(() =>
    Array.from({ length: POOL_SIZE }, () => -1),
  );

  const [transforms, setTransforms] = useState<CircleTransform[]>(() =>
    Array.from({ length: POOL_SIZE }, () => ({
      translateX: 0,
      translateY: 0,
      scale: 0.12,
      wrapperOpacity: 0,
      contentOpacity: 0,
      settled: false,
    })),
  );

  const totalSpan = totalScrollSpan(entries);

  const updateParade = useCallback((isFromScroll: boolean) => {
    const container = containerRef.current;
    if (!container || entries.length === 0) return;

    const scrollTop = container.scrollTop;
    const vhPixels = window.innerHeight;
    const scrollOffset = scrollTop / vhPixels;

    const activeCircleIndex = findClosestCircleIndex(entries, scrollOffset);

    // Notify parent only on scroll-triggered updates (not initial mount)
    if (isFromScroll) {
      onUserScroll?.();
    }
    onActiveCircleChange?.(activeCircleIndex);

    const newAssignments: number[] = [];
    const newTransforms: CircleTransform[] = [];

    for (let slot = 0; slot < POOL_SIZE; slot++) {
      const offset = slot - Math.floor(POOL_SIZE / 2);
      const assignedIndex = activeCircleIndex + offset;

      if (assignedIndex < 0 || assignedIndex >= entries.length) {
        newAssignments.push(-1);
        newTransforms.push({ translateX: 0, translateY: 0, scale: 0.12, wrapperOpacity: 0, contentOpacity: 0, settled: false });
      } else {
        const entry = entries[assignedIndex];
        const transform = computeCircleTransform(
          scrollOffset,
          entry.circleCenter,
          entry.effectiveSpan,
          entry.exitDirection,
        );
        newAssignments.push(assignedIndex);
        newTransforms.push(transform);
      }
    }

    setPoolAssignments(newAssignments);
    setTransforms(newTransforms);
  }, [entries, onActiveCircleChange, onUserScroll]);

  // Scroll observer with rAF throttling
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onScroll = () => {
      if (!tickingRef.current) {
        requestAnimationFrame(() => {
          if (!initialDoneRef.current) {
            initialDoneRef.current = true;
          }
          updateParade(initialDoneRef.current);
          tickingRef.current = false;
        });
        tickingRef.current = true;
      }
    };

    container.addEventListener('scroll', onScroll, { passive: true });

    // Initial update — compute transforms but don't treat as user scroll
    updateParade(false);

    return () => {
      container.removeEventListener('scroll', onScroll);
    };
  }, [updateParade]);

  // Scroll to a specific circle index (for anchor dot navigation)
  const scrollToCircle = useCallback(
    (circleIndex: number) => {
      const container = containerRef.current;
      if (!container || circleIndex < 0 || circleIndex >= entries.length) return;
      if (typeof container.scrollTo !== 'function') return;

      const entry = entries[circleIndex];
      const vhPixels = window.innerHeight;
      const targetScrollTop = entry.circleCenter * vhPixels;

      container.scrollTo({
        top: targetScrollTop,
        behavior: 'smooth',
      });
    },
    [entries],
  );

  useImperativeHandle(ref, () => ({ scrollToCircle }), [scrollToCircle]);

  return (
    <>
      {/* Scroll driver: full-viewport scroll container */}
      <div
        ref={containerRef}
        className="h-screen w-full overflow-y-scroll"
        style={{ scrollbarWidth: 'none' }}
      >
        <div
          style={{
            height: `${totalSpan * 100}vh`,
            pointerEvents: 'none',
          }}
        />
      </div>

      {/* Fixed stage: circles float over the viewport, unaffected by scroll */}
      <div
        className="fixed inset-0 pointer-events-none z-10 overflow-hidden"
        aria-hidden="true"
      >
        {entries.length > 0 &&
          poolAssignments.map((assignedIndex, slot) => {
            if (assignedIndex < 0 || assignedIndex >= entries.length) return null;
            const entry = entries[assignedIndex];
            const transform = transforms[slot];

            return (
              <ParadeCircle
                key={slot}
                entry={entry}
                transform={transform}
                isSettled={transform.settled}
              />
            );
          })}
      </div>
    </>
  );
});
