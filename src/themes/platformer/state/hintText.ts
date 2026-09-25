import { computed } from '@preact/signals-react';
import { currentUI } from '@/state/locale';

/**
 * The one derived signal mapping a hint/bubble message id to its localized
 * string, derived from the translation signal (`currentUI`). Both the page's
 * speech-bubble spawn/refresh and the editor's hint-marker hover label read
 * this instead of indexing `currentUI.value.platformer.hints[id]` directly
 * (FR-005/FR-020). It stores no text of its own.
 */
export const hintText = computed(() => currentUI.value.platformer.hints);
