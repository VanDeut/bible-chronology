export interface Category {
  id: string;
  name: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface TimelineEvent {
  id: string;
  title: string;
  startDate: string;
  endDate?: string;
  notes: string;
  categoryIds: string[];
  links: string[];
  imageUrl?: string;
  /** Stays prominent when zoomed out (larger pin, label at lower zoom). */
  featured?: boolean;
  /** Free-text scripture references, e.g. "Gen 5:3; 1 Ki 2:1-4" (linked to jw.org). */
  scripture?: string;
  /** Ids of connected events (e.g. a parent); drawn as connector lines. */
  relatedEventIds?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Background {
  id: string;
  startDate: string;
  endDate: string;
  imageUrl?: string;
  /** 0–1 opacity for the full-height background image (default 0.45). */
  imageOpacity?: number;
  title: string;
  notes: string;
  links: string[];
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_BACKGROUND_IMAGE_OPACITY = 0.45;
export const MIN_BACKGROUND_IMAGE_OPACITY = 0.05;
export const MAX_BACKGROUND_IMAGE_OPACITY = 0.85;

export function getBackgroundImageOpacity(background: Background): number {
  const value = background.imageOpacity ?? DEFAULT_BACKGROUND_IMAGE_OPACITY;
  return Math.min(
    MAX_BACKGROUND_IMAGE_OPACITY,
    Math.max(MIN_BACKGROUND_IMAGE_OPACITY, value)
  );
}

export interface TimelineData {
  events: TimelineEvent[];
  backgrounds: Background[];
  categories: Category[];
}

export type DetailItem =
  | { type: "event"; data: TimelineEvent }
  | { type: "background"; data: Background };

export const DEFAULT_CATEGORIES: Omit<Category, "createdAt" | "updatedAt">[] = [
  { id: "cat-default", name: "General", color: "#6366f1" },
  { id: "cat-life", name: "Life", color: "#22c55e" },
  { id: "cat-work", name: "Work", color: "#f59e0b" },
];

export function createEmptyData(): TimelineData {
  const now = new Date().toISOString();
  return {
    events: [],
    backgrounds: [],
    categories: DEFAULT_CATEGORIES.map((c) => ({
      ...c,
      createdAt: now,
      updatedAt: now,
    })),
  };
}

import { normalizeEventCategories } from "./event-categories";

/** Strip legacy fields and normalize loaded/imported data. */
export function normalizeTimelineData(data: TimelineData): TimelineData {
  const categories = (data.categories ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    color: c.color,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  }));

  const validCategoryIds = new Set(categories.map((c) => c.id));

  const events = (data.events ?? []).map((event) =>
    normalizeEventCategories(
      event as TimelineEvent & { categoryId?: string },
      validCategoryIds
    )
  );

  return {
    events,
    backgrounds: data.backgrounds ?? [],
    categories,
  };
}
