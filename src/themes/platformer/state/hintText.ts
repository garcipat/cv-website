import { computed } from '@preact/signals-react';
import { currentUI } from '@/state/locale';

/**
 * The one derived signal mapping a hint/bubble message id to its localized
 * string, derived from the translation signal (`currentUI`). Both the page's
 * speech-bubble spawn/refresh and the editor's hint-marker hover label read
 * this instead of indexing `currentUI.value.platformer.hints[id]` directly
 * (FR-005/FR-020). It stores no text of its own.
 *
 * Deliberately the **whole mapper as one dictionary signal**, not one signal
 * per message and not the raw `currentUI`: the two consumers index it by id,
 * and this keeps a single named seam for the hint-text source.
 */
export const hintText = computed(() => currentUI.value.platformer.hints);
