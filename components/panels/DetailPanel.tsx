"use client";

import { useEffect, useRef, useState } from "react";
import { formatTimelineDate } from "@/lib/date-utils";
import type { DetailItem } from "@/lib/types";
import { useTimelineStore } from "@/lib/store";
import { getCategoryById } from "@/lib/merge";
import { getEventCategoryIds } from "@/lib/event-categories";
import { parseScriptureRefs } from "@/lib/scripture";
import { getTimelineController } from "@/lib/timeline-controller";
import { useActiveView } from "@/lib/use-active-view";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { DetailImage } from "../ui/DetailImage";
import { showToast } from "@/lib/use-toast";
import { useFocusTrap } from "@/lib/use-focus-trap";

interface DetailPanelProps {
  item: DetailItem;
  onClose: () => void;
  onEdit: () => void;
}

function cleanDisplayText(text: string): string {
  return text.replace(/[\u2028\u2029]/g, " ").replace(/\s+/g, " ").trim();
}

export function DetailPanel({ item, onClose, onEdit }: DetailPanelProps) {
  const categories = useTimelineStore((s) => s.data.categories);
  const allEvents = useTimelineStore((s) => s.data.events);
  const setDetailItem = useTimelineStore((s) => s.setDetailItem);
  const setLineageRoot = useActiveView((s) => s.setLineageRoot);
  const setActiveView = useActiveView((s) => s.setActiveView);
  const deleteEvent = useTimelineStore((s) => s.deleteEvent);
  const deleteBackground = useTimelineStore((s) => s.deleteBackground);
  const restoreEvent = useTimelineStore((s) => s.restoreEvent);
  const restoreBackground = useTimelineStore((s) => s.restoreBackground);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const formatDate = (d: string) => formatTimelineDate(d);

  const performDelete = () => {
    const title = cleanDisplayText(item.data.title);
    if (item.type === "event") {
      const snapshot = item.data;
      deleteEvent(snapshot.id);
      showToast({
        message: `Deleted “${title}”`,
        actionLabel: "Undo",
        onAction: () => restoreEvent(snapshot),
      });
    } else {
      const snapshot = item.data;
      deleteBackground(snapshot.id);
      showToast({
        message: `Deleted “${title}”`,
        actionLabel: "Undo",
        onAction: () => restoreBackground(snapshot),
      });
    }
    setConfirmOpen(false);
    onClose();
  };

  const confirmDialog = confirmOpen ? (
    <ConfirmDialog
      title={item.type === "event" ? "Delete event" : "Delete background"}
      message={
        <>
          Delete{" "}
          <span className="font-medium text-[var(--foreground)]">
            {cleanDisplayText(item.data.title)}
          </span>
          ? This can&apos;t be undone.
        </>
      }
      confirmLabel="Delete"
      onConfirm={performDelete}
      onCancel={() => setConfirmOpen(false)}
    />
  ) : null;

  if (item.type === "event") {
    const event = item.data;
    const scriptureRefs = parseScriptureRefs(event.scripture);
    const relatedIds = event.relatedEventIds ?? [];
    const relatedEvents = relatedIds
      .map((id) => allEvents.find((e) => e.id === id))
      .filter((e): e is NonNullable<typeof e> => e != null);
    // Events that point at this one (e.g. children of a parent).
    const linkedFrom = allEvents.filter(
      (e) =>
        e.id !== event.id &&
        !relatedIds.includes(e.id) &&
        e.relatedEventIds?.includes(event.id)
    );
    const eventCategories = getEventCategoryIds(event)
      .map((id) => getCategoryById(categories, id))
      .filter((c): c is NonNullable<typeof c> => c != null);

    return (
      <>
      <PanelShell
        onClose={onClose}
        actions={
          <PanelActions
            editLabel="Edit Event"
            onEdit={onEdit}
            onDelete={() => setConfirmOpen(true)}
          />
        }
      >
        <div className="space-y-5">
          <div>
            <div className="mb-3 flex flex-wrap gap-2">
              {eventCategories.map((category, index) => (
                <span
                  key={category.id}
                  className="inline-block rounded-full px-2.5 py-1 text-xs font-medium text-white"
                  style={{ backgroundColor: category.color }}
                  title={
                    index === 0 && eventCategories.length > 1
                      ? "Primary category"
                      : undefined
                  }
                >
                  {index === 0 && eventCategories.length > 1 ? "★ " : ""}
                  {category.name}
                </span>
              ))}
            </div>
            {event.featured && (
              <span className="mb-3 inline-block rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                ★ Featured
              </span>
            )}
            <h2 className="font-serif text-xl font-semibold leading-snug tracking-tight">
              {cleanDisplayText(event.title)}
            </h2>
            <p className="tabular-nums mt-2 text-sm text-[var(--muted)]">
              {formatDate(event.startDate)}
              {event.endDate && event.endDate !== event.startDate && (
                <> — {formatDate(event.endDate)}</>
              )}
            </p>
          </div>

          {event.imageUrl && (
            <DetailImage src={event.imageUrl} alt={event.title} />
          )}

          {event.notes && (
            <DetailSection title="Notes">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--muted)]">
                {event.notes}
              </p>
            </DetailSection>
          )}

          {scriptureRefs.length > 0 && (
            <DetailSection title="Scripture">
              <ul className="flex flex-wrap gap-1.5">
                {scriptureRefs.map((ref, i) =>
                  ref.url ? (
                    <li key={i}>
                      <a
                        href={ref.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs font-medium text-indigo-500 hover:border-indigo-400 hover:text-indigo-600"
                        title={`Read ${ref.label} on jw.org`}
                      >
                        {ref.label}
                        <span aria-hidden className="text-[10px]">↗</span>
                      </a>
                    </li>
                  ) : (
                    <li
                      key={i}
                      className="rounded-full border border-[var(--border)] px-2.5 py-1 text-xs text-[var(--muted)]"
                      title="Could not recognise this reference"
                    >
                      {ref.label}
                    </li>
                  )
                )}
              </ul>
            </DetailSection>
          )}

          {(relatedEvents.length > 0 || linkedFrom.length > 0) && (
            <DetailSection title="Related events">
              <button
                type="button"
                onClick={() => {
                  setLineageRoot(event.id);
                  setActiveView(`lineage:${event.id}`);
                  onClose();
                }}
                className="mb-2 w-full rounded-lg border border-indigo-400/60 px-2.5 py-1.5 text-sm font-medium text-indigo-500 hover:bg-indigo-500/10"
              >
                Show only this family line
              </button>
              <ul className="space-y-1">
                {[...relatedEvents, ...linkedFrom].map((rel) => (
                  <li key={rel.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setDetailItem({ type: "event", data: rel });
                        getTimelineController().scrollToEvent(rel.id);
                      }}
                      className="flex w-full items-baseline justify-between gap-3 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-left text-sm hover:bg-[var(--surface)]"
                    >
                      <span className="truncate">{rel.title}</span>
                      <span className="tabular-nums shrink-0 text-xs text-[var(--muted)]">
                        {formatDate(rel.startDate)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </DetailSection>
          )}

          {event.links.length > 0 && (
            <DetailSection title="Links">
              <LinksList links={event.links} />
            </DetailSection>
          )}
        </div>
      </PanelShell>
      {confirmDialog}
      </>
    );
  }

  const bg = item.data;

  return (
    <>
    <PanelShell
      onClose={onClose}
      actions={
        <PanelActions
          editLabel="Edit Background"
          onEdit={onEdit}
          onDelete={() => setConfirmOpen(true)}
        />
      }
    >
      <div className="space-y-5">
        <div>
          <span className="mb-3 inline-block rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
            Background
          </span>
          <h2 className="font-serif text-xl font-semibold leading-snug tracking-tight">
            {cleanDisplayText(bg.title)}
          </h2>
          <p className="tabular-nums mt-2 text-sm text-[var(--muted)]">
            {formatDate(bg.startDate)} — {formatDate(bg.endDate)}
          </p>
        </div>

        {bg.imageUrl && (
          <DetailImage src={bg.imageUrl} alt={bg.title} />
        )}

        {bg.notes && (
          <DetailSection title="Notes">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--muted)]">
              {bg.notes}
            </p>
          </DetailSection>
        )}

        {bg.links.length > 0 && (
          <DetailSection title="Links">
            <LinksList links={bg.links} />
          </DetailSection>
          )}
        </div>
      </PanelShell>
      {confirmDialog}
    </>
  );
}

function PanelShell({
  children,
  actions,
  onClose,
}: {
  children: React.ReactNode;
  actions: React.ReactNode;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLElement>(null);
  useFocusTrap(panelRef, true);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm sm:bg-black/20"
        onClick={onClose}
      />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Details"
        className="fixed inset-x-0 bottom-0 z-50 flex max-h-[88dvh] flex-col overflow-hidden rounded-t-2xl bg-[var(--surface)] shadow-2xl panel-slide-up sm:inset-x-auto sm:inset-y-0 sm:right-0 sm:max-h-none sm:w-[400px] sm:rounded-none sm:rounded-l-2xl sm:panel-slide-side"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-6 py-4">
          <span className="text-sm font-semibold text-[var(--foreground)]">
            Details
          </span>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] transition hover:bg-[var(--background)]"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-5">
          {children}
        </div>

        <div className="shrink-0 border-t border-[var(--border)] bg-[var(--surface)] px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {actions}
        </div>
      </aside>
    </>
  );
}

function PanelActions({
  editLabel,
  onEdit,
  onDelete,
}: {
  editLabel: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <button
        onClick={onEdit}
        className="rounded-xl bg-indigo-500 py-3 text-sm font-medium text-white transition hover:bg-indigo-600 active:scale-[0.98]"
      >
        {editLabel}
      </button>
      <button
        onClick={onDelete}
        className="rounded-xl border border-red-200 py-3 text-sm font-medium text-red-600 transition hover:bg-red-50 active:scale-[0.98] dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/30"
      >
        Delete
      </button>
    </div>
  );
}

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl bg-[var(--background)] p-4 ring-1 ring-[var(--border)]">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
        {title}
      </h3>
      {children}
    </section>
  );
}

function formatLinkLabel(url: string): string {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    const path = parsed.pathname === "/" ? "" : parsed.pathname;
    return path ? `${host}${path}` : host;
  } catch {
    return url;
  }
}

function LinksList({ links }: { links: string[] }) {
  return (
    <ul className="space-y-2">
      {links.map((link, i) => (
        <li key={i}>
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            title={link}
            className="inline-flex max-w-full items-center gap-1.5 text-sm text-indigo-500 transition hover:text-indigo-600"
          >
            <span className="truncate">{formatLinkLabel(link)}</span>
            <ExternalLinkIcon />
          </a>
        </li>
      ))}
    </ul>
  );
}

function ExternalLinkIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5 shrink-0 opacity-70"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M6 3h7v7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13 3 6 10" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 13H3V6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
