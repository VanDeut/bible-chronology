"use client";

import { memo, useMemo, type RefObject } from "react";
import { useElementScrollLeft } from "@/lib/use-element-scroll-left";
import { getVisibleFeaturedRulerMarkers } from "@/lib/ruler-featured-markers";
import { TimelineRuler } from "./TimelineRuler";
import { FeaturedRulerMarkers } from "./FeaturedRulerMarkers";
import type { TimelineLayout } from "@/lib/timeline-layout";
import type { Category, TimelineEvent } from "@/lib/types";

interface TimelineRulerStripProps {
  scrollRef: RefObject<HTMLDivElement | null>;
  layout: TimelineLayout;
  viewportWidth: number;
  events: TimelineEvent[];
  categories: Category[];
  className?: string;
  onJumpToDay?: (dayIndex: number) => void;
}

/** Date ruler pinned above the scroll canvas; syncs to the timeline scroll container. */
export const TimelineRulerStrip = memo(function TimelineRulerStrip({
  scrollRef,
  layout,
  viewportWidth,
  events,
  categories,
  className = "",
  onJumpToDay,
}: TimelineRulerStripProps) {
  const scrollLeft = useElementScrollLeft(scrollRef);
  const width =
    viewportWidth > 0
      ? viewportWidth
      : scrollRef.current?.clientWidth ?? 0;

  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );

  const featuredMarkers = useMemo(
    () =>
      getVisibleFeaturedRulerMarkers(
        events,
        layout.timelineStartDay,
        layout.pixelsPerDay,
        scrollLeft,
        width
      ),
    [
      events,
      layout.timelineStartDay,
      layout.pixelsPerDay,
      scrollLeft,
      width,
    ]
  );

  return (
    <div
      className={`shrink-0 overflow-hidden border-b border-[var(--border)] bg-[var(--surface)] ${className}`}
    >
      <div
        className="relative h-8"
        style={{
          width: layout.totalWidth,
          transform: `translateX(${-scrollLeft}px)`,
        }}
      >
        <TimelineRuler
          timelineStartDay={layout.timelineStartDay}
          timelineEndDay={layout.timelineEndDay}
          pixelsPerDay={layout.pixelsPerDay}
          totalWidth={layout.totalWidth}
          scrollLeft={scrollLeft}
          viewportWidth={width}
          onJumpToDay={onJumpToDay}
        />
        <FeaturedRulerMarkers
          markers={featuredMarkers}
          categoryById={categoryById}
        />
      </div>
    </div>
  );
});
