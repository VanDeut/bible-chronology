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
import { BAND_HEADER_HEIGHT, type BandGeometry } from "@/lib/timeline-bands";
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
          ({ event, x, width, lane, floatTier, bandIndex }) =>
            `${event.id}:${event.updatedAt}:${x}:${width}:${lane}:${floatTier}:${bandIndex}`
        )
        .join("\0"),
    [visibleEvents]
  );

  const sortedVisibleEvents = useMemo(
    () => sortVisibleEventsForRender(visibleEvents),
    [visibleEventIdsKey, visibleEventsRevisionKey, visibleEvents]
  );

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
              style={{
                top: geo.top,
                height: geo.height,
                backgroundColor: colorWithAlpha(color, 0.14),
                borderTop: `1px solid ${colorWithAlpha(color, 0.55)}`,
              }}
            >
              <span
                className="sticky left-2 inline-flex items-center gap-1.5 rounded-full bg-[var(--surface)] px-2 text-[11px] font-medium text-[var(--foreground)] shadow-sm"
                style={{
                  marginTop: (BAND_HEADER_HEIGHT - 16) / 2,
                  height: 16,
                  boxShadow: `0 0 0 1px ${colorWithAlpha(color, 0.6)}`,
                }}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: color }}
                  aria-hidden
                />
                {category?.name ?? "Uncategorized"}
              </span>
            </div>
          );
        })}
      </div>

      <div
        className="absolute left-0 right-0 z-10 overflow-visible"
        style={{ top: eventsTop }}
      >
        {sortedVisibleEvents.map(({ event, x, width, lane, floatTier, labelRow, bandIndex }) => {
          const category = categoryById.get(getPrimaryCategoryId(event));
          const band = layout.bands[bandIndex];
          const geo = bandGeometry[bandIndex];
          const useLabelRowLayout =
            isPointEvent(event) &&
            layout.pixelsPerDay >= LABEL_ZOOM_THRESHOLD &&
            !usesFeaturedCircle(event);
          const rowIndex = useLabelRowLayout
            ? (band?.rangeLaneCount ?? 0) + labelRow
            : lane;
          const top =
            (geo?.eventsTop ?? 0) +
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
