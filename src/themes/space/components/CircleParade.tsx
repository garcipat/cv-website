import { useMemo, useEffect } from 'react';
import { useSignals } from '@preact/signals-react/runtime';
import { Signal } from '@preact/signals-react';
import { ParadeCircle } from './ParadeCircle';
import {
  computeCircleTransform,
  findClosestCircleIndex,
  POOL_SIZE,
  type CircleEntry,
  type CircleTransform,
} from '../parade-utils';

export interface CircleParadeProps {
  entries: CircleEntry[];
  /** Signal providing the current scroll offset in vh units. */
  scrollOffset: Signal<number>;
  /** Called when the active circle index changes (for anchor dot sync). */
  onActiveCircleChange?: (index: number) => void;
}

const EMPTY_TRANSFORM: CircleTransform = {
  translateX: 0,
  translateY: 0,
  scale: 0.12,
  wrapperOpacity: 0,
  contentOpacity: 0,
  settled: false,
};

/**
 * Scroll-driven circle parade manager (refactored — signal consumer).
 *
 * - Consumes `scrollOffset` signal to compute circle transforms.
 * - Renders only the fixed stage overlay with a 7-slot circle pool.
 * - No longer owns the scroll container or a scroll listener.
 */
export const CircleParade = ({
  entries,
  scrollOffset,
  onActiveCircleChange,
}: CircleParadeProps) => {
  useSignals();

  const currentOffset = scrollOffset.value;

  // Compute active circle index
  const activeCircleIndex = useMemo(
    () => findClosestCircleIndex(entries, currentOffset),
    [entries, currentOffset],
  );

  // Notify parent of active circle changes (for anchor dot sync)
  useEffect(() => {
    onActiveCircleChange?.(activeCircleIndex);
  }, [activeCircleIndex, onActiveCircleChange]);

  // Compute pool assignments and transforms
  const { poolAssignments, transforms } = useMemo(() => {
    if (entries.length === 0) {
      return {
        poolAssignments: Array.from<number>({ length: POOL_SIZE }).fill(-1),
        transforms: Array.from<CircleTransform>({ length: POOL_SIZE }).fill(EMPTY_TRANSFORM),
      };
    }

    const newAssignments: number[] = [];
    const newTransforms: CircleTransform[] = [];

    for (let slot = 0; slot < POOL_SIZE; slot++) {
      const offset = slot - Math.floor(POOL_SIZE / 2);
      const assignedIndex = activeCircleIndex + offset;

      if (assignedIndex < 0 || assignedIndex >= entries.length) {
        newAssignments.push(-1);
        newTransforms.push(EMPTY_TRANSFORM);
      } else {
        const entry = entries[assignedIndex];
        const transform = computeCircleTransform(
          currentOffset,
          entry.circleCenter,
          entry.effectiveSpan,
          entry.exitDirection,
        );
        newAssignments.push(assignedIndex);
        newTransforms.push(transform);
      }
    }

    return { poolAssignments: newAssignments, transforms: newTransforms };
  }, [entries, currentOffset, activeCircleIndex]);

  return (
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
  );
};
