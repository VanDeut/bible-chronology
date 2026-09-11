"use client";

import { useMemo, useState } from "react";
import { FormField, inputClass } from "../ui/FormField";
import { useTimelineStore } from "@/lib/store";
import { formatTimelineDate } from "@/lib/date-utils";

interface RelatedEventsInputProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  /** The event being edited, so it cannot relate to itself. */
  excludeId?: string;
}

const MAX_RESULTS = 12;

/** Searchable picker for linking this event to others (parent, cause, etc.). */
export function RelatedEventsInput({
  selectedIds,
  onChange,
  excludeId,
}: RelatedEventsInputProps) {
  const events = useTimelineStore((s) => s.data.events);
  const [query, setQuery] = useState("");

  const byId = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return events
      .filter(
        (e) =>
          e.id !== excludeId &&
          !selectedIds.includes(e.id) &&
          e.title.toLowerCase().includes(q)
      )
      .slice(0, MAX_RESULTS);
  }, [events, query, excludeId, selectedIds]);

  return (
    <FormField label="Related events">
      <p className="mb-2 text-xs text-[var(--muted)]">
        Link a parent, successor or cause — a thin line connects them on the
        timeline.
      </p>
      {selectedIds.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-1.5">
          {selectedIds.map((id) => {
            const ev = byId.get(id);
            return (
              <li
                key={id}
                className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] py-0.5 pl-2.5 pr-1 text-xs"
              >
                <span className="max-w-[200px] truncate">
                  {ev?.title ?? "(missing event)"}
                </span>
                <button
                  type="button"
                  onClick={() => onChange(selectedIds.filter((s) => s !== id))}
                  className="rounded-full px-1 text-[var(--muted)] hover:text-red-500"
                  aria-label={`Remove ${ev?.title ?? "related event"}`}
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <input
        className={inputClass}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search events by title…"
      />
      {results.length > 0 && (
        <ul className="mt-1 max-h-44 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--background)] p-1">
          {results.map((ev) => (
            <li key={ev.id}>
              <button
                type="button"
                onClick={() => {
                  onChange([...selectedIds, ev.id]);
                  setQuery("");
                }}
                className="flex w-full items-baseline justify-between gap-3 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-[var(--surface)]"
              >
                <span className="truncate">{ev.title}</span>
                <span className="tabular-nums shrink-0 text-xs text-[var(--muted)]">
                  {formatTimelineDate(ev.startDate)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </FormField>
  );
}
