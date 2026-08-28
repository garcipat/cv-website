import { useMemo, useEffect } from 'react';
import { useSignals } from '@preact/signals-react/runtime';
import { ParadeCircle } from './ParadeCircle';
import { scrollOffset, activeCircleIndex } from '../SpaceState';
import {
  computeCircleTransform,
  findClosestCircleIndex,
  POOL_SIZE,
  type CircleEntry,
  type CircleTransform,
} from '../parade-utils';

export interface CircleParadeProps {
  entries: CircleEntry[];
}

const EMPTY_TRANSFORM: CircleTransform = {
  translateX: 0,
  translateY: 0,
  scale: 0.12,
  wrapperOpacity: 0,
  contentOpacity: 0,
  settled: false,
};

export const CircleParade = ({ entries }: CircleParadeProps) => {
  useSignals();

  const currentOffset = scrollOffset.value;

  // Compute and publish active circle index via signal
  const activeIdx = useMemo(
    () => findClosestCircleIndex(entries, currentOffset),
    [entries, currentOffset],
  );

  useEffect(() => {
    activeCircleIndex.value = activeIdx;
  }, [activeIdx]);

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
      const assignedIndex = activeIdx + offset;

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
  }, [entries, currentOffset, activeIdx]);

  return (
    <div
      className="fixed inset-0 pointer-events-none z-10 overflow-hidden"
      aria-hidden="true"
      data-testid="circle-parade-stage"
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
