/**
 * The one generic save module: `saveFile` owns the exact
 * POST-to-the-dev-server-with-download-fallback sequence, `downloadFile` owns
 * the anchor/object-URL download. The level/blueprint savers are thin
 * parameterisations over these, so the fallback and filename handling exist
 * once.
 *
 * No React: `editor/dev/` is plain browser infrastructure (the Node vite
 * plugins only import the endpoint/folder constants, which stay import-free).
 */

export interface SaveResult {
  /** True when the dev server wrote the file into the repository itself. */
  written: boolean;
  /** Repository-relative path of the written file, when it was written. */
  path?: string;
  /** Why the dev server refused, when it answered but declined to write. */
  error?: string;
}

/**
 * Hands `contents` to the browser as a download — the only way a static site
 * can produce a file ( no writes into the repository). The
 * developer moves it into the target folder themselves, which is what the
 * Save dialog explains.
 *
 * The anchor is created, clicked, and removed within the call, and the object
 * URL is revoked immediately afterwards: nothing about the download outlives
 * it.
 */
export function downloadFile(fileName: string, contents: string): void {
  const blob = new Blob([contents], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/**
 * Saves a file the way the developer actually wants it saved: POSTed to the
 * dev server, which writes it straight into the target folder — so it needs no
 * moving afterwards.
 *
 * The endpoint only exists while `npm run dev` is running (its plugin is
 * `apply: 'serve'`), so anything else — a built site, a missing plugin, a
 * refused write — falls back to the plain download. The caller gets told which
 * of the two happened so the UI can say so rather than implying a file landed
 * somewhere it didn't.
 */
export async function saveFile(opts: {
  endpoint: string;
  fileName: string;
  contents: string;
}): Promise<SaveResult> {
  try {
    const response = await fetch(opts.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName: opts.fileName, contents: opts.contents }),
    });
    const body = (await response.json()) as { path?: string; error?: string };

    if (response.ok && typeof body.path === 'string') {
      return { written: true, path: body.path };
    }

    downloadFile(opts.fileName, opts.contents);
    return body.error === undefined ? { written: false } : { written: false, error: body.error };
  } catch {
    // No dev server behind this page at all (built site, or served statically).
    downloadFile(opts.fileName, opts.contents);
    return { written: false };
  }
}
