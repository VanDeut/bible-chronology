"use client";

import { useEffect, useMemo } from "react";
import { useTimelineStore } from "@/lib/store";
import { formatTimelineDate } from "@/lib/date-utils";
import { getEventCategoryIds } from "@/lib/event-categories";
import { isPointEvent } from "@/lib/timeline-point-hit";

/**
 * Bottom card shown on phones after tapping an event: title, dates, categories
 * and a button for the full panel. Tapping the timeline again dismisses it.
 */
export function EventPreviewCard() {
  const event = useTimelineStore((s) => s.previewEvent);
  const categories = useTimelineStore((s) => s.data.categories);
  const setPreviewEvent = useTimelineStore((s) => s.setPreviewEvent);
  const setDetailItem = useTimelineStore((s) => s.setDetailItem);

  const eventCategories = useMemo(() => {
    if (!event) return [];
    const ids = getEventCategoryIds(event);
    return ids
      .map((id) => categories.find((c) => c.id === id))
      .filter((c): c is NonNullable<typeof c> => c != null);
  }, [event, categories]);

  useEffect(() => {
    if (!event) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreviewEvent(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [event, setPreviewEvent]);

  if (!event) return null;

  const dates = isPointEvent(event)
    ? formatTimelineDate(event.startDate)
    : `${formatTimelineDate(event.startDate)} — ${formatTimelineDate(event.endDate!)}`;
  const primary = eventCategories[0];

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:hidden">
      <div
        role="dialog"
        aria-label={`${event.title} preview`}
        className="pointer-events-auto w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-xl"
        style={{ borderTop: `3px solid ${primary?.color ?? "#6366f1"}` }}
      >
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="font-serif truncate text-base font-semibold leading-tight">
              {event.title}
            </h3>
            <p className="tabular-nums mt-0.5 text-xs text-[var(--muted)]">
              {dates}
            </p>
            {eventCategories.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {eventCategories.map((c) => (
                  <span
                    key={c.id}
                    className="rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
                    style={{ backgroundColor: c.color }}
                  >
                    {c.name}
                  </span>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setPreviewEvent(null)}
            className="-mr-1 -mt-1 rounded-full p-1.5 text-[var(--muted)] hover:bg-[var(--background)]"
            aria-label="Dismiss preview"
          >
            ✕
          </button>
        </div>
        <button
          type="button"
          onClick={() => setDetailItem({ type: "event", data: event })}
          className="mt-3 w-full rounded-xl bg-indigo-500 py-2 text-sm font-medium text-white active:scale-[0.98]"
        >
          Details
        </button>
      </div>
    </div>
  );
}
