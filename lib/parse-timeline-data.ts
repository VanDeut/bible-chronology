import { compareTimelineDates, normalizeTimelineDate } from "./date-utils";
import type {
  Background,
  Category,
  TimelineData,
  TimelineEvent,
  TimelineView,
} from "./types";
import {
  getBackgroundImageOpacity,
  normalizeTimelineData,
} from "./types";

export const BACKUP_VERSION = 1;

export interface TimelineBackupFile {
  version: number;
  exportedAt: string;
  data: TimelineData;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function asBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  return undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function parseCategory(raw: unknown, warnings: string[]): Category | null {
  if (!isRecord(raw)) return null;
  const id = asString(raw.id);
  const name = asString(raw.name).trim();
  const color = asString(raw.color).trim();
  const createdAt = asString(raw.createdAt);
  const updatedAt = asString(raw.updatedAt);
  if (!id || !name || !color || !createdAt || !updatedAt) {
    warnings.push(`Skipped invalid category: ${name || id || "unknown"}`);
    return null;
  }
  return { id, name, color, createdAt, updatedAt };
}

function parseEventCategoryIds(raw: Record<string, unknown>): string[] {
  const fromArray = asStringArray(raw.categoryIds);
  if (fromArray.length > 0) return fromArray;
  const legacy = asString(raw.categoryId, "");
  if (legacy) return [legacy];
  return ["cat-default"];
}

function parseEvent(raw: unknown, warnings: string[]): TimelineEvent | null {
  if (!isRecord(raw)) return null;
  const id = asString(raw.id);
  const title = asString(raw.title).trim();
  const startDate = normalizeTimelineDate(asString(raw.startDate));
  const createdAt = asString(raw.createdAt);
  const updatedAt = asString(raw.updatedAt);
  const categoryIds = parseEventCategoryIds(raw);

  if (!id || !title || !startDate || !createdAt || !updatedAt) {
    warnings.push(`Skipped invalid event: ${title || id || "unknown"}`);
    return null;
  }

  const endRaw = asOptionalString(raw.endDate);
  const endDate = endRaw ? normalizeTimelineDate(endRaw) || undefined : undefined;
  if (endRaw && !endDate) {
    warnings.push(`Skipped end date for event "${title}"`);
  }
  if (endDate && compareTimelineDates(endDate, startDate) < 0) {
    warnings.push(`Skipped event "${title}" — end before start`);
    return null;
  }

  return {
    id,
    title,
    startDate,
    endDate,
    notes: asString(raw.notes),
    categoryIds,
    links: asStringArray(raw.links),
    imageUrl: asOptionalString(raw.imageUrl),
    featured: asBoolean(raw.featured),
    scripture: asOptionalString(raw.scripture),
    relatedEventIds: asStringArray(raw.relatedEventIds).length
      ? asStringArray(raw.relatedEventIds)
      : undefined,
    createdAt,
    updatedAt,
  };
}

function parseBackground(raw: unknown, warnings: string[]): Background | null {
  if (!isRecord(raw)) return null;
  const id = asString(raw.id);
  const title = asString(raw.title).trim();
  const startDate = normalizeTimelineDate(asString(raw.startDate));
  const endDate = normalizeTimelineDate(asString(raw.endDate));
  const createdAt = asString(raw.createdAt);
  const updatedAt = asString(raw.updatedAt);

  if (!id || !title || !startDate || !endDate || !createdAt || !updatedAt) {
    warnings.push(`Skipped invalid background: ${title || id || "unknown"}`);
    return null;
  }

  if (compareTimelineDates(endDate, startDate) < 0) {
    warnings.push(`Skipped background "${title}" — end before start`);
    return null;
  }

  const imageUrl = asOptionalString(raw.imageUrl);
  const opacityRaw = asNumber(raw.imageOpacity);
  const draft: Background = {
    id,
    startDate,
    endDate,
    title,
    notes: asString(raw.notes),
    links: asStringArray(raw.links),
    imageUrl,
    imageOpacity: opacityRaw,
    createdAt,
    updatedAt,
  };

  return {
    ...draft,
    imageOpacity: imageUrl ? getBackgroundImageOpacity(draft) : undefined,
  };
}

/** Accept raw JSON from a backup file (versioned or legacy flat shape). */
export function unwrapBackupPayload(raw: unknown): unknown {
  if (isRecord(raw) && isRecord(raw.data) && Array.isArray(raw.data.events)) {
    return raw.data;
  }
  return raw;
}

export function parseTimelineData(raw: unknown): {
  data: TimelineData;
  warnings: string[];
} {
  const warnings: string[] = [];
  const payload = unwrapBackupPayload(raw);

  if (!isRecord(payload)) {
    throw new Error("Invalid backup format");
  }

  const eventsRaw = payload.events;
  const backgroundsRaw = payload.backgrounds;
  const categoriesRaw = payload.categories;

  if (
    !Array.isArray(eventsRaw) ||
    !Array.isArray(backgroundsRaw) ||
    !Array.isArray(categoriesRaw)
  ) {
    throw new Error("Invalid backup format");
  }

  const events = eventsRaw
    .map((item) => parseEvent(item, warnings))
    .filter((item): item is TimelineEvent => item != null);

  const backgrounds = backgroundsRaw
    .map((item) => parseBackground(item, warnings))
    .filter((item): item is Background => item != null);

  const categories = categoriesRaw
    .map((item) => parseCategory(item, warnings))
    .filter((item): item is Category => item != null);

  const views = (Array.isArray(payload.views) ? payload.views : [])
    .map((item) => parseView(item))
    .filter((item): item is TimelineView => item != null);

  return {
    data: normalizeTimelineData({ events, backgrounds, categories, views }),
    warnings,
  };
}

function parseView(raw: unknown): TimelineView | null {
  if (!isRecord(raw)) return null;
  const id = asString(raw.id);
  const name = asString(raw.name).trim();
  const createdAt = asString(raw.createdAt);
  const updatedAt = asString(raw.updatedAt);
  if (!id || !name || !createdAt || !updatedAt) return null;
  return {
    id,
    name,
    hiddenCategoryIds: asStringArray(raw.hiddenCategoryIds),
    collapsedBandIds: asStringArray(raw.collapsedBandIds),
    lineageRootEventId: asOptionalString(raw.lineageRootEventId),
    createdAt,
    updatedAt,
  };
}

export function createBackupFile(data: TimelineData): TimelineBackupFile {
  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  };
}
