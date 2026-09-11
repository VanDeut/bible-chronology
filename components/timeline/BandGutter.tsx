"use client";

import { memo } from "react";
import type { Category } from "@/lib/types";
import type { LayoutBand } from "@/lib/timeline-layout";
import type { BandGeometry } from "@/lib/timeline-bands";
import { colorWithAlpha } from "@/lib/color-utils";
import {
  BAND_LABEL_MAX_COLUMNS,
  BAND_LABEL_PX_PER_CHAR,
} from "@/lib/timeline-bands";

export const BAND_GUTTER_WIDTH = 52;

interface BandGutterProps {
  bands: LayoutBand[];
  bandGeometry: BandGeometry[];
  categoryById: Map<string, Category>;
  /** Canvas y where the bands start (below the background rows). */
  eventsTop: number;
  scrollTop: number;
  onToggleBand: (categoryId: string) => void;
}

/**
 * Fixed column left of the scroll canvas holding the band names, so the
 * labels never cover events. Names run vertically and wrap into a second
 * column when the band is too short for one.
 */
export const BandGutter = memo(function BandGutter({
  bands,
  bandGeometry,
  categoryById,
  eventsTop,
  scrollTop,
  onToggleBand,
}: BandGutterProps) {
  return (
    <div
      className="relative shrink-0 overflow-hidden border-r border-[var(--border)] bg-[var(--surface)]"
      style={{ width: BAND_GUTTER_WIDTH }}
      aria-label="Category bands"
    >
      {bands.map((band, i) => {
        const geo = bandGeometry[i];
        if (!geo) return null;
        const category = categoryById.get(band.key);
        const color = category?.color ?? "#6366f1";
        const name = category?.name ?? "Uncategorized";
        const top = eventsTop + geo.top - scrollTop;
        const label = geo.collapsed ? `Expand ${name}` : `Collapse ${name}`;
        // Keep the name in view while scrolling through a tall band: slide it
        // down with the viewport until it reaches the band's bottom.
        const textLength = name.length * BAND_LABEL_PX_PER_CHAR + 16;
        const columns = Math.min(
          BAND_LABEL_MAX_COLUMNS,
          Math.max(1, Math.ceil(textLength / (geo.height - 16)))
        );
        const estimatedLength = Math.min(
          geo.height - 16,
          Math.ceil(textLength / columns)
        );
        const hiddenAbove = Math.max(0, -top);
        const labelOffset = Math.min(
          hiddenAbove + 8,
          Math.max(8, geo.height - estimatedLength - 8)
        );

        return (
          <div
            key={band.key}
            className="absolute left-0 right-0 flex items-start justify-center"
            style={{
              top,
              height: geo.height,
              paddingTop: geo.collapsed ? 0 : labelOffset - 8,
              backgroundColor: colorWithAlpha(color, 0.14),
              borderTop: `1px solid ${colorWithAlpha(color, 0.55)}`,
            }}
          >
            {geo.collapsed ? (
              <button
                type="button"
                onClick={() => onToggleBand(band.key)}
                className="mt-1 flex h-[18px] w-[18px] cursor-pointer items-center justify-center rounded-md bg-[var(--surface)] text-[10px] text-[var(--foreground)] hover:bg-[var(--background)]"
                style={{ boxShadow: `0 0 0 1px ${colorWithAlpha(color, 0.6)}` }}
                title={label}
                aria-label={label}
                aria-expanded={false}
              >
                ▸
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onToggleBand(band.key)}
                className="font-serif mt-2 max-h-[calc(100%-16px)] cursor-pointer overflow-hidden rounded-md bg-[var(--surface)] px-0.5 py-1.5 text-[10.5px] font-medium leading-[1.15] tracking-wide text-[var(--foreground)] hover:bg-[var(--background)]"
                style={{
                  writingMode: "vertical-rl",
                  transform: "rotate(180deg)",
                  // Up to three vertical columns; band min height guarantees fit.
                  maxWidth: BAND_GUTTER_WIDTH - 8,
                  boxShadow: `0 0 0 1px ${colorWithAlpha(color, 0.6)}`,
                }}
                title={label}
                aria-label={label}
                aria-expanded={true}
              >
                {name}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
});
