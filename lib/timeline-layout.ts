import { useMemo } from "react";
import type { TimelineEvent, Background } from "./types";
import {
  getTimelineBounds,
  getEventStartDayIndex,
  getEventEndDayIndex,
  getDateDayIndex,
  dateToX,
} from "./date-utils";
import {
  getPointLaneHitRect,
  getPointLabelHitRect,
  isPointEvent,
  laneHasPointHitCollision,
  pointHitRectsOverlap,
  LABEL_ZOOM_THRESHOLD,
  POINT_LABEL_ROW_HEIGHT,
  MIN_POINT_HIT_WIDTH,
} from "./timeline-point-hit";
import {
  getFeaturedCircleDiameter,
  usesFeaturedCircle,
} from "./featured-marker-size";

export const MIN_PIXELS_PER_DAY_ABSOLUTE = 0.000001;
export const MAX_PIXELS_PER_DAY = 64;
export const DEFAULT_PIXELS_PER_DAY = 0.5;
export const ZOOM_FACTOR = 1.45;

/** Scrollable margin beyond earliest/latest event or background (each side). */
export const TIMELINE_EDGE_PADDING_YEARS = 100;
export const TIMELINE_EDGE_PADDING_DAYS = TIMELINE_EDGE_PADDING_YEARS * 365;

/** @deprecated use clampZoom with dynamic min from fitAllPixelsPerDay */
export const MIN_PIXELS_PER_DAY = MIN_PIXELS_PER_DAY_ABSOLUTE;

export function clampZoom(
  pixelsPerDay: number,
  min = MIN_PIXELS_PER_DAY_ABSOLUTE,
  max = MAX_PIXELS_PER_DAY
): number {
  return Math.min(max, Math.max(min, pixelsPerDay));
}

/** Zoom level that fits the entire timeline span in the viewport. */
export function fitAllPixelsPerDay(
  totalDays: number,
  viewportWidth: number
): number {
  if (totalDays <= 0 || viewportWidth <= 0) return DEFAULT_PIXELS_PER_DAY;
  return clampZoom((viewportWidth * 1) / totalDays);
}

export function minPixelsPerDay(
  totalDays: number,
  viewportWidth: number
): number {
  return fitAllPixelsPerDay(totalDays, viewportWidth);
}

export function zoomIn(
  pixelsPerDay: number,
  min = MIN_PIXELS_PER_DAY_ABSOLUTE
): number {
  return clampZoom(pixelsPerDay * ZOOM_FACTOR, min);
}

export function zoomOut(
  pixelsPerDay: number,
  min = MIN_PIXELS_PER_DAY_ABSOLUTE
): number {
  return clampZoom(pixelsPerDay / ZOOM_FACTOR, min);
}

export interface LayoutEvent {
  event: TimelineEvent;
  x: number;
  width: number;
  lane: number;
  /** Vertical stack index for featured circle markers at the same x band. */
  floatTier: number;
  /** Dedicated row for point-event labels (avoids overlap in crowded columns). */
  labelRow: number;
  /** Index into TimelineLayout.bands. */
  bandIndex: number;
  /** Free pixels to the right of this event before the next occupant of its lane. */
  rightGap: number;
}

/** One horizontal stripe of lanes; events grouped by their band key (primary category). */
export interface LayoutBand {
  key: string;
  laneCount: number;
  /** Lanes used only by span/range events (point labels stack below). */
  rangeLaneCount: number;
  /** Highest featured-circle float tier in this band, or -1 when none. */
  maxFloatTier: number;
  /**
   * Per lane: true when a point marker (with its label below) sits in it, so
   * the lane needs the taller row; range-only lanes can be compact.
   */
  laneHasPointMarker: boolean[];
}

export interface BandSpec {
  /** Band keys in display order; keys not listed are appended in first-seen order. */
  order: string[];
  keyOf: (event: TimelineEvent) => string;
}

export interface LayoutBackground {
  background: Background;
  x: number;
  width: number;
  row: number;
}

export interface TimelineLayout {
  timelineStartDay: number;
  timelineEndDay: number;
  totalWidth: number;
  pixelsPerDay: number;
  events: LayoutEvent[];
  backgrounds: LayoutBackground[];
  backgroundRowCount: number;
  /** Total lanes across all bands. */
  laneCount: number;
  /** Range lanes of the first band (single-band layouts only). */
  rangeLaneCount: number;
  bands: LayoutBand[];
}

function eventsOverlap(a: TimelineEvent, b: TimelineEvent): boolean {
  const aStart = getEventStartDayIndex(a);
  const aEnd = getEventEndDayIndex(a);
  const bStart = getEventStartDayIndex(b);
  const bEnd = getEventEndDayIndex(b);
  // Two ranges that merely touch (one ends the day the next begins, e.g.
  // successive kingdoms) can share a lane; anything involving a point needs
  // the inclusive test so a pin on a boundary day still gets its own row.
  if (!isPointEvent(a) && !isPointEvent(b)) {
    return aStart < bEnd && bStart < aEnd;
  }
  return aStart <= bEnd && bStart <= aEnd;
}

function assignLanes(
  events: TimelineEvent[],
  metricsById: Map<string, { x: number; width: number }>,
  pixelsPerDay: number
): { laneMap: Map<string, number>; rightGapMap: Map<string, number> } {
  const sorted = [...events].sort((a, b) => {
    const dayDiff = getEventStartDayIndex(a) - getEventStartDayIndex(b);
    if (dayDiff !== 0) return dayDiff;
    return a.id.localeCompare(b.id);
  });

  const lanes: {
    event: TimelineEvent;
    hitRect: { left: number; right: number };
  }[][] = [];
  const laneMap = new Map<string, number>();

  for (const event of sorted) {
    const metrics = metricsById.get(event.id);
    if (!metrics) continue;

    const point = isPointEvent(event);
    // Range widths include one extra day of pixels so a bar reaches the end
    // of its last day; trim it here so abutting bars do not read as colliding.
    const hitRect = point
      ? getPointLaneHitRect(metrics.x, metrics.width, pixelsPerDay)
      : {
          left: metrics.x,
          right: Math.max(
            metrics.x + 1,
            metrics.x + metrics.width - pixelsPerDay
          ),
        };

    let assigned = -1;
    for (let i = 0; i < lanes.length; i++) {
      const occupants = lanes[i];
      const hasTemporalOverlap = occupants.some((o) =>
        eventsOverlap(o.event, event)
      );
      if (hasTemporalOverlap) continue;

      if (
        laneHasPointHitCollision(
          occupants.map((o) => o.hitRect),
          hitRect
        )
      ) {
        continue;
      }

      assigned = i;
      break;
    }

    if (assigned === -1) {
      assigned = lanes.length;
      lanes.push([]);
    }

    lanes[assigned].push({ event, hitRect });
    laneMap.set(event.id, assigned);
  }

  // Room to the right of each bar (for a label beside narrow bars).
  const rightGapMap = new Map<string, number>();
  for (const occupants of lanes) {
    const byX = [...occupants].sort((a, b) => a.hitRect.left - b.hitRect.left);
    for (let i = 0; i < byX.length; i++) {
      const metrics = metricsById.get(byX[i].event.id)!;
      const right = metrics.x + metrics.width;
      const next = byX[i + 1];
      rightGapMap.set(
        byX[i].event.id,
        next ? Math.max(0, next.hitRect.left - right) : Number.POSITIVE_INFINITY
      );
    }
  }

  return { laneMap, rightGapMap };
}

function assignBackgroundRows(
  backgrounds: Background[]
): Map<string, number> {
  const sorted = [...backgrounds].sort((a, b) => {
    const startDiff =
      (getDateDayIndex(a.startDate) ?? 0) - (getDateDayIndex(b.startDate) ?? 0);
    if (startDiff !== 0) return startDiff;
    return a.id.localeCompare(b.id);
  });

  const rowEndDays: number[] = [];
  const rowMap = new Map<string, number>();

  for (const background of sorted) {
    const startDay = getDateDayIndex(background.startDate) ?? 0;
    const endDay = getDateDayIndex(background.endDate) ?? startDay;

    let assigned = -1;
    for (let row = 0; row < rowEndDays.length; row++) {
      if (startDay > rowEndDays[row]) {
        assigned = row;
        break;
      }
    }

    if (assigned === -1) {
      assigned = rowEndDays.length;
      rowEndDays.push(endDay);
    } else {
      rowEndDays[assigned] = endDay;
    }

    rowMap.set(background.id, assigned);
  }

  return rowMap;
}

function getFeaturedCircleHitRect(
  x: number,
  width: number,
  pixelsPerDay: number
): { left: number; right: number } {
  const diameter = getFeaturedCircleDiameter(pixelsPerDay);
  const hitWidth = Math.max(diameter, MIN_POINT_HIT_WIDTH);
  const centerX = x + Math.max(width, 3) / 2;
  return { left: centerX - hitWidth / 2, right: centerX + hitWidth / 2 };
}

function assignFeaturedFloatTiers(
  layoutEvents: LayoutEvent[],
  pixelsPerDay: number
): Map<string, number> {
  const circleEvents = layoutEvents.filter((entry) =>
    usesFeaturedCircle(entry.event)
  );
  const sorted = [...circleEvents].sort(
    (a, b) => a.x - b.x || a.event.id.localeCompare(b.event.id)
  );

  const tiers: { hitRect: { left: number; right: number } }[][] = [];
  const tierMap = new Map<string, number>();

  for (const entry of sorted) {
    const hitRect = getFeaturedCircleHitRect(
      entry.x,
      entry.width,
      pixelsPerDay
    );

    let assigned = -1;
    for (let i = 0; i < tiers.length; i++) {
      const collision = tiers[i].some((occ) =>
        pointHitRectsOverlap(occ.hitRect, hitRect)
      );
      if (!collision) {
        assigned = i;
        break;
      }
    }

    if (assigned === -1) {
      assigned = tiers.length;
      tiers.push([]);
    }

    tiers[assigned].push({ hitRect });
    tierMap.set(entry.event.id, assigned);
  }

  return tierMap;
}

/** Assign non-overlapping rows for point-event label bubbles (2D packing). */
function assignPointLabelRows(
  layoutEvents: LayoutEvent[],
  pixelsPerDay: number
): Map<string, number> {
  if (pixelsPerDay < LABEL_ZOOM_THRESHOLD) return new Map();

  const pointEvents = layoutEvents.filter(
    (entry) =>
      isPointEvent(entry.event) && !usesFeaturedCircle(entry.event)
  );
  const sorted = [...pointEvents].sort(
    (a, b) =>
      getEventStartDayIndex(a.event) - getEventStartDayIndex(b.event) ||
      a.x - b.x ||
      a.event.id.localeCompare(b.event.id)
  );

  const placed: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  }[] = [];
  const rowMap = new Map<string, number>();
  const rowGap = 4;

  for (const entry of sorted) {
    const hRect = getPointLabelHitRect(entry.x, entry.width);
    let row = 0;

    while (true) {
      const top = row * (POINT_LABEL_ROW_HEIGHT + rowGap);
      const bottom = top + POINT_LABEL_ROW_HEIGHT;
      const collision = placed.some(
        (box) =>
          pointHitRectsOverlap(hRect, box) &&
          top < box.bottom &&
          bottom > box.top
      );
      if (!collision) {
        placed.push({ ...hRect, top, bottom });
        rowMap.set(entry.event.id, row);
        break;
      }
      row++;
    }
  }

  return rowMap;
}

/** Split events into ordered bands. Without a spec, everything shares one band. */
function groupEventsIntoBands(
  events: TimelineEvent[],
  bands?: BandSpec
): { key: string; events: TimelineEvent[] }[] {
  if (!bands) return [{ key: "", events }];

  const byKey = new Map<string, TimelineEvent[]>();
  for (const event of events) {
    const key = bands.keyOf(event);
    const list = byKey.get(key);
    if (list) list.push(event);
    else byKey.set(key, [event]);
  }

  const ordered: { key: string; events: TimelineEvent[] }[] = [];
  for (const key of bands.order) {
    const list = byKey.get(key);
    if (!list) continue;
    ordered.push({ key, events: list });
    byKey.delete(key);
  }
  for (const [key, list] of byKey) ordered.push({ key, events: list });
  return ordered;
}

/** Lane, float-tier and label-row packing for the events of one band. */
function layoutSingleBand(
  events: TimelineEvent[],
  metricsById: Map<string, { x: number; width: number }>,
  pixelsPerDay: number
): {
  events: Omit<LayoutEvent, "bandIndex">[];
  summary: Omit<LayoutBand, "key">;
} {
  // Featured circles live in the float strip above the lanes and never take
  // a lane, so they cannot sit on top of another lane's bars.
  const laneEvents = events.filter((event) => !usesFeaturedCircle(event));
  const { laneMap, rightGapMap } = assignLanes(
    laneEvents,
    metricsById,
    pixelsPerDay
  );

  const layoutEvents: LayoutEvent[] = events.map((event) => {
    const metrics = metricsById.get(event.id)!;
    return {
      event,
      x: metrics.x,
      width: metrics.width,
      lane: laneMap.get(event.id) ?? 0,
      floatTier: 0,
      labelRow: 0,
      bandIndex: 0,
      rightGap: rightGapMap.get(event.id) ?? Number.POSITIVE_INFINITY,
    };
  });

  const floatTierMap = assignFeaturedFloatTiers(layoutEvents, pixelsPerDay);
  const pointLabelRowMap = assignPointLabelRows(layoutEvents, pixelsPerDay);

  let maxLane = laneMap.size > 0 ? Math.max(...laneMap.values()) + 1 : 1;
  let maxLabelRow = 0;
  let maxFloatTier = -1;

  for (const entry of layoutEvents) {
    entry.floatTier = floatTierMap.get(entry.event.id) ?? 0;
    entry.labelRow = pointLabelRowMap.get(entry.event.id) ?? 0;
    maxLabelRow = Math.max(maxLabelRow, entry.labelRow);
    if (usesFeaturedCircle(entry.event)) {
      maxFloatTier = Math.max(maxFloatTier, entry.floatTier);
    }
  }

  const rangeEvents = layoutEvents.filter((e) => !isPointEvent(e.event));
  const rangeLaneCount =
    rangeEvents.length > 0
      ? Math.max(...rangeEvents.map((e) => e.lane)) + 1
      : 0;

  const labelRowLayout = pixelsPerDay >= LABEL_ZOOM_THRESHOLD;
  if (labelRowLayout && maxLabelRow > 0) {
    maxLane = Math.max(maxLane, rangeLaneCount + maxLabelRow + 1);
  }

  const laneHasPointMarker: boolean[] = Array(maxLane).fill(false);
  for (const entry of layoutEvents) {
    if (!isPointEvent(entry.event) || usesFeaturedCircle(entry.event)) continue;
    // Above the label-zoom threshold, plain point events move into label rows
    // (placed after the range lanes), which always need the tall row.
    if (labelRowLayout && !usesFeaturedCircle(entry.event)) {
      laneHasPointMarker[rangeLaneCount + entry.labelRow] = true;
    } else {
      laneHasPointMarker[entry.lane] = true;
    }
  }

  return {
    events: layoutEvents,
    summary: {
      laneCount: maxLane,
      rangeLaneCount,
      maxFloatTier,
      laneHasPointMarker,
    },
  };
}

export function computeTimelineLayout(
  events: TimelineEvent[],
  backgrounds: Background[],
  pixelsPerDay: number,
  paddingDays = TIMELINE_EDGE_PADDING_DAYS,
  bands?: BandSpec
): TimelineLayout {
  const bounds = getTimelineBounds(events, backgrounds);
  const timelineStartDay = bounds.startDay - paddingDays;
  const timelineEndDay = bounds.endDay + paddingDays;
  const totalDays = timelineEndDay - timelineStartDay;
  const totalWidth = totalDays * pixelsPerDay;

  const metricsById = new Map<string, { x: number; width: number }>();
  for (const event of events) {
    const startDay = getEventStartDayIndex(event);
    const endDay = getEventEndDayIndex(event);
    const x = dateToX(startDay, timelineStartDay, pixelsPerDay);
    const endX = dateToX(endDay, timelineStartDay, pixelsPerDay);
    const width = Math.max(endX - x + pixelsPerDay, pixelsPerDay * 0.8);
    metricsById.set(event.id, { x, width });
  }

  const grouped = groupEventsIntoBands(events, bands);
  const layoutEvents: LayoutEvent[] = [];
  const layoutBands: LayoutBand[] = [];

  grouped.forEach((bandEvents, bandIndex) => {
    const band = layoutSingleBand(bandEvents.events, metricsById, pixelsPerDay);
    layoutBands.push({ key: bandEvents.key, ...band.summary });
    for (const entry of band.events) {
      layoutEvents.push({ ...entry, bandIndex });
    }
  });

  const maxLane = layoutBands.reduce((sum, b) => sum + b.laneCount, 0) || 1;
  const rangeLaneCount = layoutBands[0]?.rangeLaneCount ?? 0;

  const backgroundRowMap = assignBackgroundRows(backgrounds);
  const layoutBackgrounds: LayoutBackground[] = backgrounds.map((bg) => {
    const startDay = getDateDayIndex(bg.startDate) ?? timelineStartDay;
    const endDay = getDateDayIndex(bg.endDate) ?? startDay;
    const x = dateToX(startDay, timelineStartDay, pixelsPerDay);
    const endX = dateToX(endDay, timelineStartDay, pixelsPerDay);
    const width = Math.max(endX - x + pixelsPerDay, pixelsPerDay);
    return { background: bg, x, width, row: backgroundRowMap.get(bg.id) ?? 0 };
  });
  const backgroundRowCount =
    layoutBackgrounds.length > 0
      ? Math.max(...layoutBackgrounds.map((bg) => bg.row)) + 1
      : 1;

  return {
    timelineStartDay,
    timelineEndDay,
    totalWidth,
    pixelsPerDay,
    events: layoutEvents,
    backgrounds: layoutBackgrounds,
    backgroundRowCount,
    laneCount: maxLane,
    rangeLaneCount,
    bands: layoutBands,
  };
}

export function useTimelineLayout(
  events: TimelineEvent[],
  backgrounds: Background[],
  pixelsPerDay: number,
  bands?: BandSpec
): TimelineLayout {
  const ppd = clampZoom(pixelsPerDay);

  return useMemo(
    () =>
      computeTimelineLayout(
        events,
        backgrounds,
        ppd,
        TIMELINE_EDGE_PADDING_DAYS,
        bands
      ),
    [events, backgrounds, ppd, bands]
  );
}

export function sortVisibleEventsForRender(
  events: LayoutEvent[]
): LayoutEvent[] {
  const sorted = [...events];
  sorted.sort((a, b) => {
    const aPoint =
      !a.event.endDate || a.event.endDate === a.event.startDate;
    const bPoint =
      !b.event.endDate || b.event.endDate === b.event.startDate;
    if (aPoint === bPoint) return 0;
    return aPoint ? 1 : -1;
  });
  return sorted;
}

export function filterVisibleEvents(
  layout: TimelineLayout,
  scrollLeft: number,
  viewportWidth: number,
  buffer = 200
): LayoutEvent[] {
  const minX = scrollLeft - buffer;
  const maxX = scrollLeft + viewportWidth + buffer;

  return layout.events.filter(
    (e) => e.x + e.width >= minX && e.x <= maxX
  );
}

export function filterVisibleBackgrounds(
  layout: TimelineLayout,
  scrollLeft: number,
  viewportWidth: number,
  buffer = 200
): LayoutBackground[] {
  const minX = scrollLeft - buffer;
  const maxX = scrollLeft + viewportWidth + buffer;

  return layout.backgrounds.filter(
    (b) => b.x + b.width >= minX && b.x <= maxX
  );
}

/** Keys of bands that have at least one event inside the viewport window (plus buffer). */
export function bandsWithVisibleEvents(
  layout: TimelineLayout,
  scrollLeft: number,
  viewportWidth: number,
  buffer = 200
): Set<string> {
  const minX = scrollLeft - buffer;
  const maxX = scrollLeft + viewportWidth + buffer;
  const keys = new Set<string>();
  for (const e of layout.events) {
    if (e.x + e.width >= minX && e.x <= maxX) {
      keys.add(layout.bands[e.bandIndex].key);
    }
  }
  return keys;
}
