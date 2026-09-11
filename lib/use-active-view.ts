"use client";

import { create } from "zustand";

/** Transient view state: which saved view is applied and any family-line filter. */
interface ActiveViewState {
  activeViewId: string | null;
  lineageRootEventId: string | null;
  /** Day index the timeline should center on once the filtered layout is ready. */
  pendingJumpDay: number | null;
  setActiveView: (id: string | null) => void;
  setLineageRoot: (eventId: string | null) => void;
  requestJump: (dayIndex: number) => void;
  clearJump: () => void;
}

export const useActiveView = create<ActiveViewState>((set) => ({
  activeViewId: null,
  lineageRootEventId: null,
  pendingJumpDay: null,
  setActiveView: (id) => set({ activeViewId: id }),
  setLineageRoot: (eventId) => set({ lineageRootEventId: eventId }),
  requestJump: (dayIndex) => set({ pendingJumpDay: dayIndex }),
  clearJump: () => set({ pendingJumpDay: null }),
}));
