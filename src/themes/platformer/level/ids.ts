/**
 * The one home for CV-derived id vocabulary (FR-006, D5). `slugify` moved here
 * verbatim from `CollectibleMapper.ts` (whose cross-mapper export it replaces),
 * and `slugId` composes it with a kind prefix for the placement ids the
 * mappers build (`block-edu-…`, `qmark-cert-…`, `enemy-course-…`,
 * `chest-exp-…`, `coin-…`).
 *
 * `level/` vocabulary only: this module imports nothing, so it stays
 * React-free and cheap for every mapper (and the runtime) to share.
 */

/** Lowercases and hyphenates a label into a stable id fragment (e.g.
 *  "DevOps & Tools" -> "devops-tools"). Not full slugify (no unicode
 *  normalization) — CV category/language names are plain ASCII today. */
export function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/** `slugId('block-edu', 'B.Sc.', 'TU Berlin')` -> `block-edu-b-sc-tu-berlin`.
 *  The one way a mapper derives a CV-backed placement id; `parts` are joined
 *  with `-` before slugging, so a two-part id stays a single slug run. */
export function slugId(prefix: string, ...parts: string[]): string {
  return `${prefix}-${slugify(parts.join('-'))}`;
}
