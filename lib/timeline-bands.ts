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
  /** Offset of each lane from eventsTop; range-only lanes are compact. */
  laneTops: number[];
  /** Folded to a thin strip of tick marks. */
  collapsed: boolean;
}

export interface LaneMetrics {
  /** Row height for lanes holding point markers (marker + label + gap). */
  full: number;
  /** Row height for lanes holding only range bars. */
  compact: number;
}

/** Padding above the first lane of each band. */
export const BAND_HEADER_HEIGHT = 6;
/** Gap between consecutive bands. */
export const BAND_GAP = 4;
/** Bands never get shorter than this so the vertical name label stays readable. */
export const MIN_BAND_HEIGHT = 72;
/** Height of a collapsed band. */
export const COLLAPSED_BAND_HEIGHT = 26;

export function computeBandGeometry(
  bands: LayoutBand[],
  pixelsPerDay: number,
  lane: LaneMetrics,
  showHeaders: boolean,
  isCollapsed: (key: string) => boolean = () => false
): BandGeometry[] {
  const diameter = getFeaturedCircleDiameter(pixelsPerDay);
  const labelFont = getFeaturedLabelFontSize(diameter);
  const header = showHeaders ? BAND_HEADER_HEIGHT : 0;

  const result: BandGeometry[] = [];
  let cursor = 0;

  for (const band of bands) {
    if (isCollapsed(band.key)) {
      const top = cursor;
      result.push({
        top,
        eventsTop: top,
        height: COLLAPSED_BAND_HEIGHT,
        laneTops: [0],
        collapsed: true,
      });
      cursor = top + COLLAPSED_BAND_HEIGHT + BAND_GAP;
      continue;
    }

    // Float strip for featured circles; their anchor dot sits at eventsTop.
    const featuredPad =
      band.maxFloatTier >= 0
        ? getFeaturedMarkerOverflow(diameter, labelFont, band.maxFloatTier) + 6
        : 0;

    const laneTops: number[] = [];
    let lanesHeight = 0;
    for (let i = 0; i < Math.max(band.laneCount, 1); i++) {
      laneTops.push(lanesHeight);
      lanesHeight += band.laneHasPointMarker[i] ? lane.full : lane.compact;
    }

    const top = cursor;
    const eventsTop = top + header + featuredPad;
    const height = Math.max(
      header + featuredPad + lanesHeight + header,
      MIN_BAND_HEIGHT
    );
    result.push({ top, eventsTop, height, laneTops, collapsed: false });
    cursor = top + height + BAND_GAP;
  }

  return result;
}

export function totalBandsHeight(geometry: BandGeometry[]): number {
  if (geometry.length === 0) return 0;
  const last = geometry[geometry.length - 1];
  return last.top + last.height;
}
