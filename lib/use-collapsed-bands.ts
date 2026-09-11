"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "timeline-collapsed-bands";

/** Category ids whose band is folded to a thin strip of tick marks. */
export function useCollapsedBands() {
  const [collapsedIds, setCollapsedIds] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setCollapsedIds(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  const toggleBand = useCallback((categoryId: string) => {
    setCollapsedIds((prev) => {
      const next = prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId];
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const setCollapsed = useCallback((ids: string[]) => {
    setCollapsedIds(ids);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    } catch {
      /* ignore */
    }
  }, []);

  const isBandCollapsed = useCallback(
    (categoryId: string) => collapsedIds.includes(categoryId),
    [collapsedIds]
  );

  return { collapsedIds, setCollapsed, toggleBand, isBandCollapsed };
}
