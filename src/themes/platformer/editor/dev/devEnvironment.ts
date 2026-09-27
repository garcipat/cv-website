import { isDevEnvironmentSignal } from '../editorState';
import { DEV_ENVIRONMENT_ENDPOINT } from './devEnvironmentEndpoint';

/**
 * Pings `DEV_ENVIRONMENT_ENDPOINT` once and records a successful answer in
 * `isDevEnvironmentSignal` (held in `../editorState`, so this module imports no
 * signals). Resolves with what it found; never rejects.
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
