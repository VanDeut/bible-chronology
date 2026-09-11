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
  /** No events in the current viewport window: band takes no space at all. */
  hidden: boolean;
}

export interface LaneMetrics {
  /** Row height for lanes holding point markers (marker + label + gap). */
  full: number;
  /** Row height for lanes holding only range bars. */
  compact: number;
}

/** Padding above the first lane of each band. */
export const BAND_HEADER_HEIGHT = 14;
/** Gap between consecutive bands. */
export const BAND_GAP = 4;
/** Bands never get shorter than this so the vertical name label stays readable. */
export const MIN_BAND_HEIGHT = 84;
/** Height of a collapsed band. */
export const COLLAPSED_BAND_HEIGHT = 26;

/** Approximate px per character of the vertical band label (10.5px serif). */
export const BAND_LABEL_PX_PER_CHAR = 6.8;
/** Vertical label columns the gutter can hold side by side. */
export const BAND_LABEL_MAX_COLUMNS = 3;

/** Shortest band that can show `name` in the gutter without clipping. */
export function minBandHeightForName(name: string): number {
  const textLength = name.length * BAND_LABEL_PX_PER_CHAR + 16;
  const perColumn = Math.ceil(textLength / BAND_LABEL_MAX_COLUMNS);
  return Math.max(MIN_BAND_HEIGHT, perColumn + 2 * BAND_HEADER_HEIGHT);
}

export function computeBandGeometry(
  bands: LayoutBand[],
  pixelsPerDay: number,
  lane: LaneMetrics,
  showHeaders: boolean,
  isCollapsed: (key: string) => boolean = () => false,
  nameOf: (key: string) => string = () => "",
  isHidden: (key: string) => boolean = () => false
): BandGeometry[] {
  const diameter = getFeaturedCircleDiameter(pixelsPerDay);
  const labelFont = getFeaturedLabelFontSize(diameter);
  const header = showHeaders ? BAND_HEADER_HEIGHT : 0;

  const result: BandGeometry[] = [];
  let cursor = 0;

  for (const band of bands) {
    if (isHidden(band.key)) {
      result.push({
        top: cursor,
        eventsTop: cursor,
        height: 0,
        laneTops: [0],
        collapsed: false,
        hidden: true,
      });
      continue;
    }
    if (isCollapsed(band.key)) {
      const top = cursor;
      result.push({
        top,
        eventsTop: top,
        height: COLLAPSED_BAND_HEIGHT,
        laneTops: [0],
        collapsed: true,
        hidden: false,
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
      minBandHeightForName(nameOf(band.key))
    );
    result.push({ top, eventsTop, height, laneTops, collapsed: false, hidden: false });
    cursor = top + height + BAND_GAP;
  }

  return result;
}

export function totalBandsHeight(geometry: BandGeometry[]): number {
  if (geometry.length === 0) return 0;
  const last = geometry[geometry.length - 1];
  return last.top + last.height;
}
