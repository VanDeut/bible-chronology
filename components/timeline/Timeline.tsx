"use client";

import { useCallback, useRef, useState, useEffect, useMemo, useLayoutEffect } from "react";
import { useTimelineStore } from "@/lib/store";
import { createScrollStore } from "@/lib/scroll-store";
import {
  useTimelineLayout,
  DEFAULT_PIXELS_PER_DAY,
  MAX_PIXELS_PER_DAY,
  zoomIn,
  zoomOut,
  fitAllPixelsPerDay,
  minPixelsPerDay,
  clampZoom,
} from "@/lib/timeline-layout";
import { LABEL_ZOOM_THRESHOLD, POINT_LABEL_ROW_HEIGHT } from "@/lib/timeline-point-hit";
import {
  getEventCategoryIds,
  isEventVisibleForCategories,
} from "@/lib/event-categories";
import { computeBandGeometry, totalBandsHeight } from "@/lib/timeline-bands";
import { useCollapsedBands } from "@/lib/use-collapsed-bands";
import {
  getEventStartDayIndex,
  dateToX,
} from "@/lib/date-utils";
import {
  registerTimelineController,
  unregisterTimelineController,
} from "@/lib/timeline-controller";
import { TimelineMinimap } from "./TimelineMinimap";
import { TimelineRulerStrip } from "./TimelineRulerStrip";
import { TimelineViewport } from "./TimelineViewport";
import { CategoryLegend } from "../CategoryLegend";
import { usePinchZoom, type ZoomAnchor } from "./usePinchZoom";
import { useDragPan } from "./useDragPan";
import type { Category, TimelineEvent } from "@/lib/types";
import type { useHiddenCategories } from "@/lib/use-hidden-categories";
import {
  loadSavedTimelineView,
  saveTimelineView,
  TIMELINE_DATA_CLEARED_EVENT,
} from "@/lib/timeline-view-storage";

type CategoryVisibility = ReturnType<typeof useHiddenCategories>;

interface TimelineProps {
  categoryVisibility: CategoryVisibility;
}

const COMPACT_BREAKPOINT = 640;

/** Vertical sizing tuned per device so phones stay tight and desktops breathe. */
function getTimelineMetrics(viewportWidth: number, pixelsPerDay: number) {
  const compact = viewportWidth > 0 && viewportWidth < COMPACT_BREAKPOINT;
  const showPointLabels = pixelsPerDay >= LABEL_ZOOM_THRESHOLD;
  const eventHeight = compact ? 26 : 36;
  const labelHeight = showPointLabels ? POINT_LABEL_ROW_HEIGHT : compact ? 14 : 18;
  const gap = showPointLabels ? 10 : compact ? 5 : 8;
  const backgroundHeight = compact ? 22 : 28;
  const laneHeight = eventHeight + labelHeight + gap;
  const compactLaneHeight = eventHeight + (compact ? 4 : 6);
  const eventsTop = backgroundHeight;

  return {
    eventHeight,
    labelHeight,
    backgroundHeight,
    laneHeight,
    compactLaneHeight,
    eventsTop,
  };
}

export function Timeline({ categoryVisibility }: TimelineProps) {
  const events = useTimelineStore((s) => s.data.events);
  const backgrounds = useTimelineStore((s) => s.data.backgrounds);
  const categories = useTimelineStore((s) => s.data.categories);
  const setDetailItem = useTimelineStore((s) => s.setDetailItem);

  const { loaded: categoriesLoaded, isCategoryVisible } = categoryVisibility;

  const filteredEvents = useMemo(
    () =>
      categoriesLoaded
        ? events.filter((e) => isEventVisibleForCategories(e, isCategoryVisible))
        : events,
    [events, categoriesLoaded, isCategoryVisible]
  );

  const [pixelsPerDay, setPixelsPerDay] = useState(DEFAULT_PIXELS_PER_DAY);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollStore = useRef(createScrollStore()).current;
  const hasAutoFit = useRef(false);
  const zoomAnchorRef = useRef<ZoomAnchor | null>(null);
  // Band = primary category; falls back to the first visible category when the
  // primary is hidden via Filter so the event still lands in a shown band.
  const bandSpec = useMemo(
    () => ({
      order: categories.map((c) => c.id),
      keyOf: (event: TimelineEvent) => {
        const ids = getEventCategoryIds(event);
        return (
          (categoriesLoaded ? ids.find((id) => isCategoryVisible(id)) : undefined) ??
          ids[0]
        );
      },
    }),
    [categories, categoriesLoaded, isCategoryVisible]
  );
  const layout = useTimelineLayout(
    filteredEvents,
    backgrounds,
    pixelsPerDay,
    bandSpec
  );

  const metrics = getTimelineMetrics(viewportWidth, pixelsPerDay);
  const {
    eventHeight: EVENT_HEIGHT,
    labelHeight: EVENT_LABEL_HEIGHT,
    backgroundHeight: BACKGROUND_ROW_HEIGHT,
    laneHeight: LANE_HEIGHT,
    compactLaneHeight: COMPACT_LANE_HEIGHT,
  } = metrics;
  const BACKGROUND_HEIGHT = BACKGROUND_ROW_HEIGHT * layout.backgroundRowCount;

  const { toggleBand, isBandCollapsed } = useCollapsedBands();
  const bandGeometry = useMemo(
    () =>
      computeBandGeometry(
        layout.bands,
        layout.pixelsPerDay,
        { full: LANE_HEIGHT, compact: COMPACT_LANE_HEIGHT },
        true,
        isBandCollapsed
      ),
    [layout.bands, layout.pixelsPerDay, LANE_HEIGHT, COMPACT_LANE_HEIGHT, isBandCollapsed]
  );

  const EVENTS_TOP = BACKGROUND_HEIGHT;

  const categoryById = useMemo(() => {
    const map = new Map<string, Category>();
    for (const category of categories) {
      map.set(category.id, category);
    }
    return map;
  }, [categories]);

  const totalDays = layout.timelineEndDay - layout.timelineStartDay;
  const zoomMin = minPixelsPerDay(totalDays, viewportWidth);
  const zoomEpsilon = zoomMin * 0.05;
  const canZoomIn = pixelsPerDay < MAX_PIXELS_PER_DAY * 0.99;
  const canZoomOut = pixelsPerDay > zoomMin + zoomEpsilon;

  const applyZoomAt = usePinchZoom({
    containerRef: scrollRef,
    pixelsPerDay,
    timelineStartDay: layout.timelineStartDay,
    minPixelsPerDay: zoomMin,
    onPixelsPerDayChange: setPixelsPerDay,
    onPrepareZoom: (anchor) => {
      zoomAnchorRef.current = anchor;
    },
  });

  useLayoutEffect(() => {
    const anchor = zoomAnchorRef.current;
    if (!anchor) return;
    zoomAnchorRef.current = null;

    const el = scrollRef.current;
    if (!el) return;

    const newScrollLeft =
      (anchor.focalDay - layout.timelineStartDay) * pixelsPerDay -
      anchor.focalXInViewport;
    const maxScroll = Math.max(0, layout.totalWidth - el.clientWidth);
    const next = Math.max(0, Math.min(newScrollLeft, maxScroll));
    el.scrollLeft = next;
    scrollStore.setScrollLeft(next);
  }, [pixelsPerDay, layout.timelineStartDay, layout.totalWidth, scrollStore]);

  useDragPan({ containerRef: scrollRef });

  const applyZoom = useCallback(
    (nextPixelsPerDay: number) => {
      const el = scrollRef.current;
      const focalX = el ? el.clientWidth / 2 : 0;
      applyZoomAt(nextPixelsPerDay, focalX);
    },
    [applyZoomAt]
  );

  const fitAll = useCallback(() => {
    const el = scrollRef.current;
    const width = el?.clientWidth ?? viewportWidth;
    if (width <= 0 || totalDays <= 0) return;
    const ppd = fitAllPixelsPerDay(totalDays, width);
    setPixelsPerDay(ppd);
    requestAnimationFrame(() => {
      if (el) {
        el.scrollLeft = 0;
        scrollStore.setScrollLeft(0);
      }
    });
  }, [totalDays, viewportWidth, scrollStore]);

  const scrollTo = useCallback((left: number) => {
    scrollRef.current?.scrollTo({ left, behavior: "smooth" });
  }, []);

  const panByViewportFraction = useCallback((direction: -1 | 1) => {
    const el = scrollRef.current;
    if (!el) return;
    const step = el.clientWidth * 0.25;
    const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
    const next = Math.max(0, Math.min(el.scrollLeft + direction * step, maxScroll));
    el.scrollTo({ left: next, behavior: "smooth" });
  }, []);

  const scrollToDayIndex = useCallback(
    (dayIndex: number) => {
      const x =
        dateToX(dayIndex, layout.timelineStartDay, layout.pixelsPerDay) -
        viewportWidth / 2;
      const maxScroll = Math.max(0, layout.totalWidth - viewportWidth);
      scrollTo(Math.max(0, Math.min(x, maxScroll)));
    },
    [layout, viewportWidth, scrollTo]
  );

  const scrollToEvent = useCallback(
    (eventId: string) => {
      const event = events.find((e) => e.id === eventId);
      if (!event) return;
      const dayIndex = getEventStartDayIndex(event);
      scrollToDayIndex(dayIndex);
      setDetailItem({ type: "event", data: event });
    },
    [events, scrollToDayIndex, setDetailItem]
  );

  useEffect(() => {
    registerTimelineController({
      zoomIn: () => applyZoom(zoomIn(pixelsPerDay, zoomMin)),
      zoomOut: () => applyZoom(zoomOut(pixelsPerDay, zoomMin)),
      fitAll,
      panLeft: () => panByViewportFraction(-1),
      panRight: () => panByViewportFraction(1),
      scrollToDayIndex,
      scrollToEvent,
      canZoomIn,
      canZoomOut,
    });
    return () => unregisterTimelineController();
  }, [
    applyZoom,
    pixelsPerDay,
    zoomMin,
    fitAll,
    panByViewportFraction,
    scrollToDayIndex,
    scrollToEvent,
    canZoomIn,
    canZoomOut,
  ]);

  const timelineHeight = useMemo(() => {
    const eventsBottom = totalBandsHeight(bandGeometry);
    const contentHeight =
      BACKGROUND_HEIGHT + Math.max(eventsBottom, LANE_HEIGHT) + 32;

    return Math.max(contentHeight, viewportHeight);
  }, [bandGeometry, LANE_HEIGHT, BACKGROUND_HEIGHT, viewportHeight]);

  const syncScrollLeftFromElement = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    scrollStore.setScrollLeft(el.scrollLeft);
  }, [scrollStore]);

  const handleScroll = useCallback(() => {
    syncScrollLeftFromElement();
  }, [syncScrollLeftFromElement]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    setViewportWidth(el.clientWidth);
    setViewportHeight(el.clientHeight);
    scrollStore.setScrollLeft(el.scrollLeft);

    const ro = new ResizeObserver(() => {
      setViewportWidth(el.clientWidth);
      setViewportHeight(el.clientHeight);
    });
    ro.observe(el);

    return () => ro.disconnect();
  }, [scrollStore]);

  // Establish the initial view once the layout is measurable: restore the
  // last saved zoom/scroll if present, otherwise auto-fit on first ever visit.
  useEffect(() => {
    if (hasAutoFit.current || viewportWidth <= 0 || totalDays <= 0) return;

    const saved = loadSavedTimelineView();
    if (saved) {
      hasAutoFit.current = true;
      setPixelsPerDay(clampZoom(saved.pixelsPerDay, zoomMin));
      const target = saved.scrollLeft;
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          const el = scrollRef.current;
          if (el) {
            el.scrollLeft = target;
            scrollStore.setScrollLeft(target);
          }
        })
      );
    } else if (events.length > 0) {
      hasAutoFit.current = true;
      fitAll();
    }
  }, [events.length, viewportWidth, totalDays, fitAll, zoomMin, scrollStore]);

  // Persist the current view (debounced) once an initial view is established.
  useEffect(() => {
    if (!hasAutoFit.current) return;
    let t: ReturnType<typeof setTimeout>;
    const save = () => {
      clearTimeout(t);
      t = setTimeout(
        () =>
          saveTimelineView({
            pixelsPerDay,
            scrollLeft: scrollStore.getSnapshot(),
          }),
        300
      );
    };
    save();
    const unsub = scrollStore.subscribe(save);
    return () => {
      unsub();
      clearTimeout(t);
    };
  }, [pixelsPerDay, scrollStore]);

  useEffect(() => {
    const onDataCleared = () => {
      hasAutoFit.current = false;
      setPixelsPerDay(DEFAULT_PIXELS_PER_DAY);
      requestAnimationFrame(() => {
        const el = scrollRef.current;
        if (el) {
          el.scrollLeft = 0;
          scrollStore.setScrollLeft(0);
        }
      });
    };
    window.addEventListener(TIMELINE_DATA_CLEARED_EVENT, onDataCleared);
    return () =>
      window.removeEventListener(TIMELINE_DATA_CLEARED_EVENT, onDataCleared);
  }, [scrollStore]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TimelineMinimap
        events={filteredEvents}
        backgrounds={backgrounds}
        categories={categories}
        timelineStartDay={layout.timelineStartDay}
        timelineEndDay={layout.timelineEndDay}
        pixelsPerDay={layout.pixelsPerDay}
        totalWidth={layout.totalWidth}
        scrollStore={scrollStore}
        viewportWidth={viewportWidth}
        onScrollTo={scrollTo}
      />

      <CategoryLegend categoryVisibility={categoryVisibility} />

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="timeline-scroll order-4 min-w-0 flex-1 cursor-grab overflow-x-auto overflow-y-auto"
      >
        <TimelineViewport
          scrollRef={scrollRef}
          layout={layout}
          timelineHeight={timelineHeight}
          viewportWidth={viewportWidth}
          viewportHeight={viewportHeight}
          categoryById={categoryById}
          bandGeometry={bandGeometry}
          onToggleBand={toggleBand}
          backgroundRowHeight={BACKGROUND_ROW_HEIGHT}
          backgroundHeight={BACKGROUND_HEIGHT}
          eventsTop={EVENTS_TOP}
          eventHeight={EVENT_HEIGHT}
          labelHeight={EVENT_LABEL_HEIGHT}
          laneHeight={LANE_HEIGHT}
        />
      </div>

      <TimelineRulerStrip
        scrollRef={scrollRef}
        layout={layout}
        viewportWidth={viewportWidth}
        events={filteredEvents}
        categories={categories}
        className="order-3"
        onJumpToDay={scrollToDayIndex}
      />
    </div>
  );
}
