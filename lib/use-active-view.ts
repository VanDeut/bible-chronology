"use client";

import { create } from "zustand";

/** Transient view state: which saved view is applied and any family-line filter. */
interface ActiveViewState {
  activeViewId: string | null;
  lineageRootEventId: string | null;
  setActiveView: (id: string | null) => void;
  setLineageRoot: (eventId: string | null) => void;
}

export const useActiveView = create<ActiveViewState>((set) => ({
  activeViewId: null,
  lineageRootEventId: null,
  setActiveView: (id) => set({ activeViewId: id }),
  setLineageRoot: (eventId) => set({ lineageRootEventId: eventId }),
}));
