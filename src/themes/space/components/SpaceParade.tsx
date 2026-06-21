import { useMemo } from 'react';
import { useSignals } from '@preact/signals-react/runtime';
import { Signal } from '@preact/signals-react';
import {
  SPACE_PARADE_CONFIGS,
  scaleConfigsToSpan,
  computeElementPosition,
} from '../space-parade-utils';
import type { ElementConfig, ElementTransform } from './space-elements/types';
import { RingedPlanet } from './space-elements/RingedPlanet';
import { Rocket } from './space-elements/Rocket';
import { UFO } from './space-elements/UFO';
import { Satellite } from './space-elements/Satellite';
import { ShootingStar } from './space-elements/ShootingStar';
import { Asteroid } from './space-elements/Asteroid';

export interface SpaceParadeProps {
  /** Signal providing the current scroll offset in vh units. */
  scrollOffset: Signal<number>;
  /** Total scroll span in vh units (computed from entries.length). */
  totalSpan: number;
}

/** Buffer margin (vh) on each side of the visible range for will-change. */
const WILL_CHANGE_BUFFER = 2.0;

/**
 * Scroll-driven element manager.
 *
 * - Reads `scrollOffset` signal and `totalSpan` to compute element positions.
 * - Scales configs once via `scaleConfigsToSpan`.
 * - Conditionally renders element components when scrollOffset falls within
 *   their `[entryOffset, exitOffset]` range.
 * - Applies `will-change: transform, opacity` only within the visible zone
 *   plus a buffer margin (FR-021).
 * - All elements render at z-5 behind CircleParade (z-10).
 */
export const SpaceParade = ({ scrollOffset, totalSpan }: SpaceParadeProps) => {
  useSignals();

  const currentOffset = scrollOffset.value;

  // Scale configs once — stable reference since totalSpan changes infrequently
  const scaledConfigs = useMemo(
    () => scaleConfigsToSpan(SPACE_PARADE_CONFIGS, totalSpan),
    [totalSpan],
  );

  return (
    <div
      className="fixed inset-0 pointer-events-none z-5 overflow-hidden"
      aria-hidden="true"
    >
      {scaledConfigs.map((config) => {
        const { entryOffset, exitOffset } = config;
        const range = exitOffset - entryOffset;

        // Guard: skip elements with invalid ranges
        if (range <= 0) return null;

        // Determine if element should render (within edge-fade buffer)
        // edgeFade starts at t=0.12, so we need a small margin before entryOffset
        const fadeMargin = range * 0.12;

        if (
          currentOffset < entryOffset - fadeMargin ||
          currentOffset > exitOffset + fadeMargin
        ) {
          // Don't render at all when far outside range — saves DOM nodes
          return null;
        }

        // Compute current visual state
        const transform = computeElementPosition(config, currentOffset);

        // will-change: only apply within visible zone + buffer
        const shouldOptimize =
          currentOffset >= entryOffset - WILL_CHANGE_BUFFER &&
          currentOffset <= exitOffset + WILL_CHANGE_BUFFER;

        return (
          <SpaceElement
            key={config.id}
            config={config}
            transform={transform}
            willChange={shouldOptimize}
          />
        );
      })}
    </div>
  );
};

// ── Element dispatcher ────────────────────────────────────────────────────

interface SpaceElementProps {
  config: ElementConfig;
  transform: ElementTransform;
  willChange: boolean;
}

const SpaceElement = ({ config, transform, willChange }: SpaceElementProps) => {
  const wrapperStyle: React.CSSProperties = willChange
    ? { willChange: 'transform, opacity' }
    : {};

  switch (config.type) {
    case 'planet':
      return (
        <div style={wrapperStyle}>
          <RingedPlanet transform={transform} />
        </div>
      );
    case 'rocket':
      return (
        <div style={wrapperStyle}>
          <Rocket transform={transform} />
        </div>
      );
    case 'ufo':
      return (
        <div style={wrapperStyle}>
          <UFO transform={transform} />
        </div>
      );
    case 'satellite':
      return (
        <div style={wrapperStyle}>
          <Satellite transform={transform} />
        </div>
      );
    case 'shooting-star':
      return (
        <div style={wrapperStyle}>
          <ShootingStar transform={transform} />
        </div>
      );
    case 'asteroid':
      return (
        <div style={wrapperStyle}>
          <Asteroid transform={transform} />
        </div>
      );
    default:
      return null;
  }
};
