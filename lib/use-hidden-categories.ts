"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "timeline-hidden-categories";

export function useHiddenCategories() {
  const [hiddenCategoryIds, setHiddenCategoryIds] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setHiddenCategoryIds(JSON.parse(raw));
    } catch {
      /* ignore */
    }
    setLoaded(true);
  }, []);

  const persist = useCallback((ids: string[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  }, []);

  const toggleCategory = useCallback(
    (categoryId: string) => {
      setHiddenCategoryIds((prev) => {
        const next = prev.includes(categoryId)
          ? prev.filter((id) => id !== categoryId)
          : [...prev, categoryId];
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const isCategoryVisible = useCallback(
    (categoryId: string) => !hiddenCategoryIds.includes(categoryId),
    [hiddenCategoryIds]
  );

  const showAllCategories = useCallback(() => {
    setHiddenCategoryIds([]);
    persist([]);
  }, [persist]);

  const hideAllCategories = useCallback(
    (categoryIds: string[]) => {
      setHiddenCategoryIds(categoryIds);
      persist(categoryIds);
    },
    [persist]
  );

  const setHidden = useCallback(
    (ids: string[]) => {
      setHiddenCategoryIds(ids);
      persist(ids);
    },
    [persist]
  );

  return {
    hiddenCategoryIds,
    setHidden,
    loaded,
    toggleCategory,
    isCategoryVisible,
    showAllCategories,
    hideAllCategories,
  };
}
