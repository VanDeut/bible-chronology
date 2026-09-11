"use client";

import { useEffect, useState } from "react";

export interface TimelineControllerApi {
  zoomIn: () => void;
  zoomOut: () => void;
  fitAll: () => void;
  panLeft: () => void;
  panRight: () => void;
  scrollToDayIndex: (dayIndex: number) => void;
  scrollToEvent: (eventId: string) => void;
  canZoomIn: boolean;
  canZoomOut: boolean;
}

const empty: TimelineControllerApi = {
  zoomIn: () => {},
  zoomOut: () => {},
  fitAll: () => {},
  panLeft: () => {},
  panRight: () => {},
  scrollToDayIndex: () => {},
  scrollToEvent: () => {},
  canZoomIn: false,
  canZoomOut: false,
};

let controller: TimelineControllerApi = empty;
const listeners = new Set<() => void>();

export function registerTimelineController(next: TimelineControllerApi) {
  controller = next;
  listeners.forEach((l) => l());
}

export function unregisterTimelineController() {
  controller = empty;
  listeners.forEach((l) => l());
}

/** Non-hook access for event handlers. */
export function getTimelineController(): TimelineControllerApi {
  return controller;
}

export function useTimelineController(): TimelineControllerApi {
  const [, tick] = useState(0);

  useEffect(() => {
    const bump = () => tick((n) => n + 1);
    listeners.add(bump);
    return () => {
      listeners.delete(bump);
    };
  }, []);

  return controller;
}
