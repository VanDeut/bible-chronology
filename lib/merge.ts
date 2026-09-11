import type { TimelineData, TimelineEvent, Background, Category } from "./types";
import { normalizeTimelineData } from "./types";
import { compareTimelineDates } from "./date-utils";

function isNewer(a: string, b: string): boolean {
  return new Date(a).getTime() > new Date(b).getTime();
}

function mergeItem<T extends { id: string; updatedAt: string }>(
  local: T[],
  remote: T[]
): T[] {
  const map = new Map<string, T>();

  for (const item of remote) {
    map.set(item.id, item);
  }

  for (const item of local) {
    const existing = map.get(item.id);
    if (!existing || isNewer(item.updatedAt, existing.updatedAt)) {
      map.set(item.id, item);
    }
  }

  return Array.from(map.values());
}

export function mergeTimelineData(
  local: TimelineData,
  remote: TimelineData
): TimelineData {
  return {
    events: mergeItem(local.events, remote.events),
    backgrounds: mergeItem(local.backgrounds, remote.backgrounds),
    categories: mergeItem(local.categories, remote.categories),
    views: mergeItem(local.views ?? [], remote.views ?? []),
  };
}

export function replaceTimelineData(data: TimelineData): TimelineData {
  return normalizeTimelineData(structuredClone(data));
}

export function mergeImportData(
  existing: TimelineData,
  imported: TimelineData
): TimelineData {
  return mergeTimelineData(existing, imported);
}

export function getAllUpdatedAt(data: TimelineData): string {
  const timestamps = [
    ...data.events.map((e) => e.updatedAt),
    ...data.backgrounds.map((b) => b.updatedAt),
    ...data.categories.map((c) => c.updatedAt),
  ];
  if (timestamps.length === 0) return new Date(0).toISOString();
  return timestamps.reduce((latest, t) => (isNewer(t, latest) ? t : latest));
}

export function sortEvents(events: TimelineEvent[]): TimelineEvent[] {
  return [...events].sort((a, b) =>
    compareTimelineDates(a.startDate, b.startDate)
  );
}

export function sortBackgrounds(backgrounds: Background[]): Background[] {
  return [...backgrounds].sort((a, b) =>
    compareTimelineDates(a.startDate, b.startDate)
  );
}

export function getCategoryById(
  categories: Category[],
  id: string
): Category | undefined {
  return categories.find((c) => c.id === id);
}
