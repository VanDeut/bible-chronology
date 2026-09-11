"use client";

import {
  getTimelineTicks,
  getVisibleDayRange,
  getAdMarkerX,
} from "@/lib/timeline-ticks";

interface TimelineRulerProps {
  timelineStartDay: number;
  timelineEndDay: number;
  pixelsPerDay: number;
  totalWidth: number;
  scrollLeft: number;
  viewportWidth: number;
  /** Clicking a year label centers the viewport on that day. */
  onJumpToDay?: (dayIndex: number) => void;
}

export function TimelineRuler({
  timelineStartDay,
  timelineEndDay,
  pixelsPerDay,
  totalWidth,
  scrollLeft,
  viewportWidth,
  onJumpToDay,
}: TimelineRulerProps) {
  const visibleRange = getVisibleDayRange(
    timelineStartDay,
    pixelsPerDay,
    scrollLeft,
    viewportWidth
  );
  const ticks = getTimelineTicks(
    timelineStartDay,
    timelineEndDay,
    pixelsPerDay,
    visibleRange
  ).filter((t) => t.major);
  const adX = getAdMarkerX(timelineStartDay, timelineEndDay, pixelsPerDay);

  return (
    <div
      className="relative border-b border-[var(--border)] bg-[var(--surface)]/85 backdrop-blur-sm"
      style={{ width: totalWidth, height: 32 }}
    >
      {ticks.map((tick) => (
        <div
          key={tick.dayIndex}
          className="absolute top-0 flex h-full flex-col justify-end pb-1"
          style={{ left: tick.x }}
        >
          <div className="h-2 w-px bg-[var(--border)]" />
          {onJumpToDay ? (
            <button
              type="button"
              onClick={() => onJumpToDay(tick.dayIndex)}
              className="tabular-nums ml-1 -mb-1 cursor-pointer whitespace-nowrap rounded px-0.5 pb-1 text-left text-[10px] text-[var(--muted)] transition hover:bg-[var(--background)] hover:text-[var(--foreground)]"
              title={`Center on ${tick.label}`}
            >
              {tick.label}
            </button>
          ) : (
            <span className="tabular-nums ml-1 text-[10px] text-[var(--muted)] whitespace-nowrap">
              {tick.label}
            </span>
          )}
        </div>
      ))}

      {/* BC / AD boundary labels, aligned with the date ruler */}
      {adX != null && (
        <div
          className="absolute bottom-1 flex items-center"
          style={{ left: adX, transform: "translateX(-50%)" }}
        >
          <span className="rounded-l-md bg-neutral-600/90 px-1.5 py-0.5 text-[9px] font-semibold uppercase leading-none tracking-wide text-white">
            BC
          </span>
          <span className="rounded-r-md bg-amber-500/90 px-1.5 py-0.5 text-[9px] font-semibold uppercase leading-none tracking-wide text-white">
            AD
          </span>
        </div>
      )}
    </div>
  );
}
