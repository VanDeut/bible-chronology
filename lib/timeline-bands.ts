import type { LayoutBand } from "./timeline-layout";
import {
  getFeaturedCircleDiameter,
  getFeaturedLabelFontSize,
  getFeaturedMarkerOverflow,
} from "./featured-marker-size";

/** Vertical placement of one band inside the events canvas (relative to eventsTop). */
export interface BandGeometry {
  top: number;
  /** Baseline of lane 0 — band top + header + featured overflow. */
  eventsTop: number;
  height: number;
}

/** Space reserved at the top of each band for the category name label. */
export const BAND_HEADER_HEIGHT = 22;
/** Gap between consecutive bands. */
export const BAND_GAP = 6;

export function computeBandGeometry(
  bands: LayoutBand[],
  pixelsPerDay: number,
  laneHeight: number,
  showHeaders: boolean
): BandGeometry[] {
  const diameter = getFeaturedCircleDiameter(pixelsPerDay);
  const labelFont = getFeaturedLabelFontSize(diameter);
  const header = showHeaders ? BAND_HEADER_HEIGHT : 0;

  const result: BandGeometry[] = [];
  let cursor = 0;

  for (const band of bands) {
    const featuredPad =
      band.maxFloatTier >= 0
        ? getFeaturedMarkerOverflow(diameter, labelFont, band.maxFloatTier)
        : 0;
    const lanes = Math.max(band.laneCount, 1) * laneHeight;
    const top = cursor;
    const eventsTop = top + header + featuredPad;
    const height = header + featuredPad + lanes;
    result.push({ top, eventsTop, height });
    cursor = top + height + BAND_GAP;
  }

  return result;
}

export function totalBandsHeight(geometry: BandGeometry[]): number {
  if (geometry.length === 0) return 0;
  const last = geometry[geometry.length - 1];
  return last.top + last.height;
}
