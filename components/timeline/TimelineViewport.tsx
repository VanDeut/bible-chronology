"use client";

import { memo, useMemo } from "react";
import type { Category } from "@/lib/types";
import { useElementScrollLeft } from "@/lib/use-element-scroll-left";
import {
  filterVisibleEvents,
  filterVisibleBackgrounds,
  sortVisibleEventsForRender,
  type TimelineLayout,
} from "@/lib/timeline-layout";
import { isPointEvent, LABEL_ZOOM_THRESHOLD } from "@/lib/timeline-point-hit";
import { usesFeaturedCircle } from "@/lib/featured-marker-size";
import { getPrimaryCategoryId } from "@/lib/event-categories";
import type { BandGeometry } from "@/lib/timeline-bands";
import { colorWithAlpha } from "@/lib/color-utils";
import { TimelineGrid } from "./TimelineGrid";
import { BackgroundSpan } from "./BackgroundSpan";
import { BackgroundImageColumn } from "./BackgroundImageColumn";
import {
  TimelineEventBlock,
  eventUsesStickyScrollLeft,
} from "./TimelineEventBlock";
import { TimelineCursor } from "./TimelineCursor";
import { useTimelineStore } from "@/lib/store";
import { useActiveView } from "@/lib/use-active-view";

interface TimelineViewportProps {
  scrollRef: React.RefObject<HTMLDivElement | null>;
  layout: TimelineLayout;
  timelineHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  categoryById: Map<string, Category>;
  /** Index-aligned with layout.bands; offsets relative to eventsTop. */
  bandGeometry: BandGeometry[];
  backgroundRowHeight: number;
  backgroundHeight: number;
  eventsTop: number;
  eventHeight: number;
  labelHeight: number;
  laneHeight: number;
}

/** Scroll-synced canvas: grid, ruler, events, backgrounds. Isolated from chrome above. */
export const TimelineViewport = memo(function TimelineViewport({
  scrollRef,
  layout,
  timelineHeight,
  viewportWidth,
  viewportHeight,
  categoryById,
  bandGeometry,
  backgroundRowHeight,
  backgroundHeight,
  eventsTop,
  eventHeight,
  labelHeight,
  laneHeight,
}: TimelineViewportProps) {
  const scrollLeft = useElementScrollLeft(scrollRef);
  const setDetailItem = useTimelineStore((s) => s.setDetailItem);
  // Family-line view: connectors are the point, so draw them solid and bolder.
  const lineageMode = useActiveView((s) => s.lineageRootEventId != null);

  const visibleEvents = useMemo(
    () => filterVisibleEvents(layout, scrollLeft, viewportWidth),
    [layout, scrollLeft, viewportWidth]
  );
  const visibleBackgrounds = useMemo(
    () => filterVisibleBackgrounds(layout, scrollLeft, viewportWidth),
    [layout, scrollLeft, viewportWidth]
  );

  const visibleEventIdsKey = useMemo(
    () => visibleEvents.map((entry) => entry.event.id).join("\0"),
    [visibleEvents]
  );

  const visibleEventsRevisionKey = useMemo(
    () =>
      visibleEvents
        .map(
          ({ event, x, width, lane, floatTier, bandIndex, rightGap }) =>
            `${event.id}:${event.updatedAt}:${x}:${width}:${lane}:${floatTier}:${bandIndex}:${rightGap}`
        )
        .join("\0"),
    [visibleEvents]
  );

  const sortedVisibleEvents = useMemo(
    () => sortVisibleEventsForRender(visibleEvents),
    [visibleEventIdsKey, visibleEventsRevisionKey, visibleEvents]
  );

  // Connector lines between related events (parent ↔ child, cause ↔ effect).
  const connectors = useMemo(() => {
    const positions = new Map<
      string,
      { x: number; right: number; y: number }
    >();
    for (const entry of layout.events) {
      const geo = bandGeometry[entry.bandIndex];
      if (!geo || geo.hidden) continue;
      const band = layout.bands[entry.bandIndex];
      let y: number;
      if (geo.collapsed) {
        y = geo.eventsTop + 13;
      } else if (usesFeaturedCircle(entry.event)) {
        y = geo.eventsTop - 2;
      } else {
        const useLabelRowLayout =
          isPointEvent(entry.event) &&
          layout.pixelsPerDay >= LABEL_ZOOM_THRESHOLD;
        const rowIndex = useLabelRowLayout
          ? band.rangeLaneCount + entry.labelRow
          : entry.lane;
        y = geo.eventsTop + (geo.laneTops[rowIndex] ?? 0) + eventHeight / 2;
      }
      positions.set(entry.event.id, {
        x: entry.x,
        right: entry.x + entry.width,
        y,
      });
    }

    const minX = scrollLeft - 200;
    const maxX = scrollLeft + viewportWidth + 200;
    const lines: { key: string; d: string; color: string }[] = [];
    for (const entry of layout.events) {
      const related = entry.event.relatedEventIds;
      if (!related?.length) continue;
      const from = positions.get(entry.event.id);
      if (!from) continue;
      const color =
        categoryById.get(getPrimaryCategoryId(entry.event))?.color ?? "#6366f1";
      for (const id of related) {
        const to = positions.get(id);
        if (!to) continue;
        // Drop the vertical at this event's start; land on the related bar
        // there if it spans that date, else on its nearest end.
        const x = from.x + 1;
        const landX = x >= to.x && x <= to.right ? x : x < to.x ? to.x : to.right;
        if (Math.max(x, landX) < minX || Math.min(x, landX) > maxX) continue;
        const d =
          landX === x
            ? `M${x},${from.y} L${x},${to.y}`
            : `M${x},${from.y} L${x},${to.y} L${landX},${to.y}`;
        lines.push({ key: `${entry.event.id}-${id}`, d, color });
      }
    }
    return lines;
  }, [
    layout,
    bandGeometry,
    eventHeight,
    scrollLeft,
    viewportWidth,
    categoryById,
  ]);

  return (
    <div
      style={{ width: layout.totalWidth, height: timelineHeight }}
      className="relative"
    >
      <div className="absolute inset-0 z-[5]">
        {visibleBackgrounds.map(({ background, x, width }) => (
          <BackgroundImageColumn
            key={`bg-img-${background.id}-${background.updatedAt}-${background.imageUrl ?? ""}`}
            background={background}
            x={x}
            width={width}
            canvasHeight={timelineHeight}
            viewportHeight={viewportHeight}
          />
        ))}
      </div>

      <TimelineGrid
        timelineStartDay={layout.timelineStartDay}
        timelineEndDay={layout.timelineEndDay}
        pixelsPerDay={layout.pixelsPerDay}
        totalWidth={layout.totalWidth}
        height={timelineHeight}
        scrollLeft={scrollLeft}
        viewportWidth={viewportWidth}
      />

      <div
        className="absolute left-0 right-0 z-20"
        style={{ top: 0, height: backgroundHeight }}
      >
        {visibleBackgrounds.map(({ background, x, width, row }) => (
          <BackgroundSpan
            key={background.id}
            background={background}
            x={x}
            width={width}
            top={row * backgroundRowHeight}
            height={backgroundRowHeight}
            scrollLeft={scrollLeft}
            onInfoClick={() =>
              setDetailItem({ type: "background", data: background })
            }
          />
        ))}
      </div>

      <div
        className="absolute left-0 right-0 z-[6]"
        style={{ top: eventsTop }}
      >
        {layout.bands.map((band, i) => {
          const geo = bandGeometry[i];
          if (!geo) return null;
          const category = categoryById.get(band.key);
          const color = category?.color ?? "#6366f1";
          return (
            <div
              key={band.key}
              className="absolute left-0 right-0"
              title={geo.hidden ? `${category?.name ?? "Uncategorized"} — no events in view` : undefined}
              style={{
                top: geo.top,
                height: geo.height,
                backgroundColor: colorWithAlpha(color, geo.hidden ? 0.4 : 0.14),
                borderTop: geo.hidden ? undefined : `1px solid ${colorWithAlpha(color, 0.55)}`,
              }}
            >
              {geo.collapsed && (
                <span
                  className="font-serif sticky left-2 top-1 inline-block max-w-[240px] truncate rounded-md bg-[var(--surface)]/90 px-1.5 text-[10.5px] font-medium leading-[18px] text-[var(--foreground)]"
                  style={{ marginTop: 4 }}
                >
                  {category?.name ?? "Uncategorized"}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {connectors.length > 0 && (
        <svg
          className="pointer-events-none absolute left-0 z-[8]"
          style={{ top: eventsTop, width: layout.totalWidth, height: timelineHeight }}
          aria-hidden
        >
          {connectors.map((line) => (
            <path
              key={line.key}
              d={line.d}
              fill="none"
              stroke={line.color}
              strokeWidth={lineageMode ? 2 : 1.5}
              strokeDasharray={lineageMode ? undefined : "3 3"}
              strokeOpacity={lineageMode ? 1 : 0.85}
            />
          ))}
        </svg>
      )}

      <div
        className="absolute left-0 right-0 z-10 overflow-visible"
        style={{ top: eventsTop }}
      >
        {sortedVisibleEvents.map(({ event, x, width, lane, floatTier, labelRow, bandIndex, rightGap }) => {
          const category = categoryById.get(getPrimaryCategoryId(event));
          const band = layout.bands[bandIndex];
          const geo = bandGeometry[bandIndex];
          if (geo?.collapsed) {
            const color = category?.color ?? "#6366f1";
            const point = isPointEvent(event);
            return (
              <button
                key={event.id}
                type="button"
                onClick={() => setDetailItem({ type: "event", data: event })}
                title={event.title}
                aria-label={event.title}
                className="absolute cursor-pointer rounded-sm opacity-80 transition hover:opacity-100 hover:ring-2 hover:ring-indigo-400/60"
                style={{
                  left: point ? x - 1 : x,
                  width: point ? 3 : Math.max(width, 2),
                  top: geo.eventsTop + 7,
                  height: 12,
                  backgroundColor: color,
                }}
              />
            );
          }
          const useLabelRowLayout =
            isPointEvent(event) &&
            layout.pixelsPerDay >= LABEL_ZOOM_THRESHOLD &&
            !usesFeaturedCircle(event);
          const rowIndex = useLabelRowLayout
            ? (band?.rangeLaneCount ?? 0) + labelRow
            : lane;
          // Featured circles anchor at the top of the band's lanes.
          const top = usesFeaturedCircle(event)
            ? (geo?.eventsTop ?? 0)
            : (geo?.eventsTop ?? 0) +
              (geo?.laneTops[rowIndex] ?? rowIndex * laneHeight);
          const stickyScrollLeft = eventUsesStickyScrollLeft(event, width)
            ? scrollLeft
            : 0;

          return (
            <TimelineEventBlock
              key={event.id}
              event={event}
              category={category}
              x={x}
              width={width}
              top={top}
              eventHeight={eventHeight}
              labelHeight={labelHeight}
              pixelsPerDay={layout.pixelsPerDay}
              scrollLeft={stickyScrollLeft}
              floatTier={floatTier}
              labelRow={labelRow}
              rightGap={rightGap}
            />
          );
        })}
      </div>

      <TimelineCursor
        containerRef={scrollRef}
        timelineStartDay={layout.timelineStartDay}
        pixelsPerDay={layout.pixelsPerDay}
        height={timelineHeight}
      />
    </div>
  );
});
