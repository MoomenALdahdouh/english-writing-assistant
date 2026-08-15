/**
 * Safely apply a correction for `source` onto `current` without wiping
 * text the user typed after (or around) the corrected span.
 *
 * Returns null when the original span is no longer intact (mid-edit) —
 * callers must skip apply instead of clobbering the field.
 */
export function mergeCorrectionIntoField(
  current: string,
  source: string,
  corrected: string,
): string | null {
  if (!source) return null;
  if (current === source) return corrected;

  // User kept typing after the snapshot we corrected
  if (current.startsWith(source)) {
    return corrected + current.slice(source.length);
  }

  // Trailing-segment correction inside a longer field
  if (current.length > source.length && current.endsWith(source)) {
    return current.slice(0, current.length - source.length) + corrected;
  }

  // Unique contiguous occurrence (rare mid-field case)
  const idx = current.indexOf(source);
  if (idx >= 0 && current.indexOf(source, idx + 1) === -1) {
    return current.slice(0, idx) + corrected + current.slice(idx + source.length);
  }

  return null;
}

export function canMergeCorrection(current: string, source: string): boolean {
  return mergeCorrectionIntoField(current, source, source) !== null;
}
