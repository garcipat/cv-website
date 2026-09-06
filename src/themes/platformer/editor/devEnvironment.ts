import { signal } from '@preact/signals-react';
import { DEV_ENVIRONMENT_ENDPOINT } from './devEnvironmentEndpoint';

/**
 * Whether this page is being served by `npm run dev`, i.e. whether the editor's
 * dev-server-backed actions (Save, Save Blueprint) can actually write a file.
 * `false` until a successful ping says otherwise — see `probeDevEnvironment`.
 *
 * Deliberately NOT a `createLocalStorageSignal`: persisting it would let a
 * `true` from a dev session survive into a statically-served copy on the same
 * origin and show Save controls that cannot work, which is the exact failure
 * this gate exists to prevent.
 */
export const isDevEnvironmentSignal = signal(false);

/**
 * Pings `DEV_ENVIRONMENT_ENDPOINT` once and records a successful answer in
 * `isDevEnvironmentSignal`. Resolves with what it found; never rejects.
 *
 * Only ever writes `true`. The ping can prove a dev server is there; it cannot
 * prove one is absent (a transient network failure looks identical), so a
 * failure leaves the signal exactly as it was rather than clearing a
 * previously-confirmed dev environment.
 *
 * `response.ok` alone is not enough: a statically-served build typically
 * answers an unknown path with the SPA's `index.html` and a 200, so the check
 * is on the parsed body — and the parse throwing on that HTML is itself part of
 * the answer, handled by the catch.
 */
export const probeDevEnvironment = async (): Promise<boolean> => {
  try {
    const response = await fetch(DEV_ENVIRONMENT_ENDPOINT);
    const body = (await response.json()) as { isDev?: unknown };
    if (response.ok && body.isDev === true) {
      isDevEnvironmentSignal.value = true;
      return true;
    }
    return false;
  } catch {
    return false;
  }
};
