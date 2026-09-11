"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTimelineStore } from "@/lib/store";
import { useActiveView } from "@/lib/use-active-view";
import { collectLineage } from "@/lib/lineage";
import { getEventCategoryIds } from "@/lib/event-categories";
import { getEventStartDayIndex } from "@/lib/date-utils";
import type { TimelineView } from "@/lib/types";
import type { useHiddenCategories } from "@/lib/use-hidden-categories";
import type { useCollapsedBands } from "@/lib/use-collapsed-bands";

type CategoryVisibility = ReturnType<typeof useHiddenCategories>;
type CollapsedBands = ReturnType<typeof useCollapsedBands>;

interface ViewsMenuProps {
  categoryVisibility: CategoryVisibility;
  collapsedBands: CollapsedBands;
  buttonClassName: string;
}

type Preset = Pick<TimelineView, "id" | "name" | "hiddenCategoryIds" | "collapsedBandIds">;

/** Built-in views derived from category names; only offered when the categories exist. */
function buildPresets(categories: { id: string; name: string }[]): Preset[] {
  const byName = (re: RegExp) => categories.filter((c) => re.test(c.name)).map((c) => c.id);
  const all = categories.map((c) => c.id);
  const presets: Preset[] = [
    { id: "preset:all", name: "Everything", hiddenCategoryIds: [], collapsedBandIds: [] },
  ];
  const kingdoms = byName(/kingdom|world power|prophet|^person/i);
  if (kingdoms.length > 0) {
    presets.push({
      id: "preset:kings",
      name: "Kings & prophets",
      hiddenCategoryIds: all.filter((id) => !kingdoms.includes(id)),
      collapsedBandIds: [],
    });
  }
  const people = byName(/^person/i);
  if (people.length > 0) {
    presets.push({
      id: "preset:people",
      name: "People only",
      hiddenCategoryIds: all.filter((id) => !people.includes(id)),
      collapsedBandIds: [],
    });
  }
  const firstCentury = byName(/first century|jesus|christian/i);
  if (firstCentury.length > 0) {
    presets.push({
      id: "preset:first-century",
      name: "First century",
      hiddenCategoryIds: all.filter((id) => !firstCentury.includes(id)),
      collapsedBandIds: [],
    });
  }
  return presets;
}

export function ViewsMenu({
  categoryVisibility,
  collapsedBands,
  buttonClassName,
}: ViewsMenuProps) {
  const categories = useTimelineStore((s) => s.data.categories);
  const events = useTimelineStore((s) => s.data.events);
  const views = useTimelineStore((s) => s.data.views ?? []);
  const detailItem = useTimelineStore((s) => s.detailItem);
  const addView = useTimelineStore((s) => s.addView);
  const deleteView = useTimelineStore((s) => s.deleteView);

  const activeViewId = useActiveView((s) => s.activeViewId);
  const lineageRootEventId = useActiveView((s) => s.lineageRootEventId);
  const setActiveView = useActiveView((s) => s.setActiveView);
  const setLineageRoot = useActiveView((s) => s.setLineageRoot);
  const requestJump = useActiveView((s) => s.requestJump);

  const [open, setOpen] = useState(false);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const presets = useMemo(() => buildPresets(categories), [categories]);
  const lineageRoot = lineageRootEventId
    ? events.find((e) => e.id === lineageRootEventId)
    : undefined;
  const selectedEvent = detailItem?.type === "event" ? detailItem.data : null;

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    window.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      window.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const apply = (view: Preset & { lineageRootEventId?: string }) => {
    categoryVisibility.setHidden(view.hiddenCategoryIds);
    collapsedBands.setCollapsed(view.collapsedBandIds);
    setLineageRoot(view.lineageRootEventId ?? null);
    setActiveView(view.id);
    setOpen(false);

    // Take the user to the earliest event the view shows.
    const hidden = new Set(view.hiddenCategoryIds);
    const lineage = view.lineageRootEventId
      ? collectLineage(events, view.lineageRootEventId)
      : null;
    const shown = events.filter(
      (e) =>
        getEventCategoryIds(e).some((id) => !hidden.has(id)) &&
        (!lineage || lineage.has(e.id))
    );
    if (shown.length === 0) return;
    const first = shown.reduce((a, b) =>
      getEventStartDayIndex(b) < getEventStartDayIndex(a) ? b : a
    );
    requestJump(getEventStartDayIndex(first));
  };

  const saveCurrent = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const id = addView({
      name: trimmed,
      hiddenCategoryIds: categoryVisibility.hiddenCategoryIds,
      collapsedBandIds: collapsedBands.collapsedIds,
      lineageRootEventId: lineageRootEventId ?? undefined,
    });
    setActiveView(id);
    setName("");
    setNaming(false);
    setOpen(false);
  };

  const activeName =
    [...presets, ...views].find((v) => v.id === activeViewId)?.name ?? null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={buttonClassName}
        aria-haspopup="true"
        aria-expanded={open}
      >
        Views
        {(activeName || lineageRoot) && (
          <span className="ml-1.5 hidden max-w-[10rem] truncate text-[var(--muted)] sm:inline">
            · {lineageRoot ? `Family of ${lineageRoot.title}` : activeName}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1 w-72 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-lg"
        >
          <Section title="Presets">
            {presets.map((p) => (
              <MenuRow key={p.id} active={activeViewId === p.id} onClick={() => apply(p)}>
                {p.name}
              </MenuRow>
            ))}
          </Section>

          <Section title="Family line">
            {selectedEvent ? (
              <MenuRow
                onClick={() =>
                  apply({
                    id: `lineage:${selectedEvent.id}`,
                    name: `Family of ${selectedEvent.title}`,
                    hiddenCategoryIds: [],
                    collapsedBandIds: [],
                    lineageRootEventId: selectedEvent.id,
                  })
                }
              >
                <span className="truncate">Show family of “{selectedEvent.title}”</span>
              </MenuRow>
            ) : (
              <p className="px-3 py-2 text-xs text-[var(--muted)]">
                Select an event first, then choose this to show only its
                related events (parents, children, siblings…).
              </p>
            )}
            {lineageRoot && (
              <MenuRow
                onClick={() => {
                  setLineageRoot(null);
                  setActiveView(null);
                  setOpen(false);
                }}
              >
                <span className="text-red-500">Clear family filter</span>
              </MenuRow>
            )}
          </Section>

          <Section
            title="Saved views"
            action={
              !naming ? (
                <button
                  type="button"
                  onClick={() => setNaming(true)}
                  className="text-xs font-medium text-indigo-500 hover:text-indigo-600"
                >
                  Save current…
                </button>
              ) : null
            }
          >
            {naming && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  saveCurrent();
                }}
                className="flex gap-1.5 px-3 py-2"
              >
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="View name"
                  className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-sm"
                />
                <button
                  type="submit"
                  disabled={!name.trim()}
                  className="rounded-lg bg-indigo-500 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-40"
                >
                  Save
                </button>
              </form>
            )}
            {views.length === 0 && !naming ? (
              <p className="px-3 py-2 text-xs text-[var(--muted)]">
                Set up Filter / collapsed bands / a family line, then save it
                here. Saved views sync with your data.
              </p>
            ) : (
              views.map((v) => (
                <div key={v.id} className="flex items-center">
                  <MenuRow active={activeViewId === v.id} onClick={() => apply(v)}>
                    <span className="truncate">{v.name}</span>
                  </MenuRow>
                  <button
                    type="button"
                    onClick={() => {
                      deleteView(v.id);
                      if (activeViewId === v.id) setActiveView(null);
                    }}
                    className="mr-2 rounded px-1.5 text-xs text-[var(--muted)] hover:text-red-500"
                    aria-label={`Delete view ${v.name}`}
                    title="Delete view"
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </Section>
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-[var(--border)] py-1 last:border-b-0">
      <div className="flex items-center justify-between px-3 py-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          {title}
        </span>
        {action}
      </div>
      {children}
    </div>
  );
}

function MenuRow({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`flex w-full min-w-0 items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-[var(--background)] ${
        active ? "font-medium text-indigo-500" : ""
      }`}
    >
      <span className="w-3 shrink-0 text-xs">{active ? "✓" : ""}</span>
      {children}
    </button>
  );
}
