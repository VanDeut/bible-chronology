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
            </div>
          );
        })}
      </div>

      <div
        className="absolute left-0 right-0 z-10 overflow-visible"
        style={{ top: eventsTop }}
      >
        {sortedVisibleEvents.map(({ event, x, width, lane, floatTier, labelRow, bandIndex, rightGap }) => {
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

      {/* Band names: sticky in both axes so they stay visible while panning
          and while scrolling down through a tall band. */}
      <div
        className="pointer-events-none absolute left-0 right-0 z-[15]"
        style={{ top: eventsTop }}
      >
        {layout.bands.map((band, i) => {
          const geo = bandGeometry[i];
          if (!geo) return null;
          const category = categoryById.get(band.key);
          const color = category?.color ?? "#6366f1";
          const name = category?.name ?? "Uncategorized";
          return (
            <div
              key={band.key}
              className="absolute left-0 right-0"
              style={{ top: geo.top, height: geo.height }}
            >
              <span
                className="font-serif sticky left-1 top-2 inline-block max-h-[calc(100%-16px)] overflow-hidden text-ellipsis whitespace-nowrap rounded-md bg-[var(--surface)] px-0.5 py-1.5 text-[10.5px] font-medium tracking-wide text-[var(--foreground)]"
                style={{
                  marginTop: 8,
                  writingMode: "vertical-rl",
                  transform: "rotate(180deg)",
                  boxShadow: `0 0 0 1px ${colorWithAlpha(color, 0.6)}`,
                }}
                title={name}
              >
                {name}
              </span>
            </div>
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
