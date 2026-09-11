"use client";

import { useState } from "react";
import { ModalOverlay } from "../ui/ModalOverlay";
import {
  FormField,
  FormInput,
  FormTextarea,
  buttonPrimaryClass,
} from "../ui/FormField";
import { RelatedEventsInput } from "./RelatedEventsInput";
import { LinksInput } from "./LinksInput";
import { ImageUpload, isValidImageUrl } from "./ImageUpload";
import { DateInput } from "./DateInput";
import { useTimelineStore } from "@/lib/store";
import { isPointEvent } from "@/lib/timeline-point-hit";
import {
  getEventCategoryIds,
  normalizeEventCategoryIds,
} from "@/lib/event-categories";
import {
  hasValidationErrors,
  validateEventDraft,
} from "@/lib/validate-timeline-item";

interface EventFormModalProps {
  onClose: () => void;
  editId?: string;
}

export function EventFormModal({ onClose, editId }: EventFormModalProps) {
  const categories = useTimelineStore((s) => s.data.categories);
  const existing = useTimelineStore((s) =>
    editId ? s.data.events.find((e) => e.id === editId) : undefined
  );
  const addEvent = useTimelineStore((s) => s.addEvent);
  const updateEvent = useTimelineStore((s) => s.updateEvent);

  const defaultCategoryId = categories[0]?.id ?? "cat-default";
  const initialCategoryIds = existing
    ? getEventCategoryIds(existing)
    : [defaultCategoryId];

  const [title, setTitle] = useState(existing?.title ?? "");
  const [startDate, setStartDate] = useState(existing?.startDate ?? "");
  const [endDate, setEndDate] = useState(existing?.endDate ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(
    () => new Set(initialCategoryIds)
  );
  // Primary = categoryIds[0]; decides the band (and color) on the timeline.
  const [primaryCategoryId, setPrimaryCategoryId] = useState<string>(
    initialCategoryIds[0] ?? defaultCategoryId
  );
  const [links, setLinks] = useState<string[]>(existing?.links ?? []);
  const [imageUrl, setImageUrl] = useState(existing?.imageUrl ?? "");
  const [imageUrlDraft, setImageUrlDraft] = useState(existing?.imageUrl ?? "");
  const [featured, setFeatured] = useState(existing?.featured ?? false);
  const [scripture, setScripture] = useState(existing?.scripture ?? "");
  const [relatedEventIds, setRelatedEventIds] = useState<string[]>(
    existing?.relatedEventIds ?? []
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const draftEvent = {
    startDate,
    endDate: endDate || undefined,
  };
  const singleDay = isPointEvent(draftEvent);
  const showCircleHint =
    featured && Boolean(imageUrl.trim()) && singleDay;
  const showCircleBlockedHint =
    featured && Boolean(imageUrl.trim()) && !singleDay;

  const toggleCategory = (id: string) => {
    setSelectedCategoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size <= 1) return prev;
        next.delete(id);
        if (id === primaryCategoryId) {
          // Hand primary to the first remaining selection (in list order).
          const fallback = categories.find((c) => next.has(c.id))?.id;
          if (fallback) setPrimaryCategoryId(fallback);
        }
      } else {
        next.add(id);
      }
      return next;
    });
    setErrors((e) => {
      const { categories: _c, ...rest } = e;
      return rest;
    });
  };

  const validate = () => {
    const e = validateEventDraft({ title, startDate, endDate: endDate || undefined });
    if (selectedCategoryIds.size === 0) {
      e.categories = "Select at least one category";
    }
    setErrors(e);
    return !hasValidationErrors(e);
  };

  const handleSubmit = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;

    const draft = imageUrlDraft.trim();
    const trimmedImageUrl =
      draft && isValidImageUrl(draft) ? draft : imageUrl.trim();

    setSubmitting(true);
    const primary = selectedCategoryIds.has(primaryCategoryId)
      ? primaryCategoryId
      : categories.find((c) => selectedCategoryIds.has(c.id))?.id;
    const orderedIds = [
      ...(primary ? [primary] : []),
      ...categories
        .filter((c) => selectedCategoryIds.has(c.id) && c.id !== primary)
        .map((c) => c.id),
    ];
    const categoryIds = normalizeEventCategoryIds(
      orderedIds,
      categories.map((c) => c.id)
    );

    const payload = {
      title: title.trim(),
      startDate,
      endDate: endDate || undefined,
      notes,
      categoryIds,
      links: links.filter(Boolean),
      imageUrl: trimmedImageUrl || undefined,
      featured: featured || undefined,
      scripture: scripture.trim() || undefined,
      relatedEventIds: relatedEventIds.length > 0 ? relatedEventIds : undefined,
    };

    if (existing) {
      updateEvent(existing.id, payload);
    } else {
      addEvent(payload);
    }
    onClose();
  };

  return (
    <ModalOverlay onClose={onClose} title={existing ? "Edit Event" : "Add Event"}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Title" required error={errors.title}>
          <FormInput
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Event title"
          />
        </FormField>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Start Date" required error={errors.startDate}>
            <DateInput value={startDate} onChange={setStartDate} />
          </FormField>
          <FormField label="End Date (optional)" error={errors.endDate}>
            <DateInput value={endDate} onChange={setEndDate} />
          </FormField>
        </div>

        <FormField label="Categories" error={errors.categories}>
          <p className="mb-2 text-xs text-[var(--muted)]">
            Select one or more. The primary category decides the band and color on
            the timeline.
          </p>
          <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--background)] p-2">
            {categories.map((c) => {
              const checked = selectedCategoryIds.has(c.id);
              const isPrimary = checked && c.id === primaryCategoryId;
              return (
                <div
                  key={c.id}
                  className="flex items-center gap-2.5 rounded-lg px-2 py-2 transition hover:bg-[var(--surface)]"
                >
                  <label className="flex flex-1 cursor-pointer items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleCategory(c.id)}
                      className="accent-indigo-500"
                    />
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: c.color }}
                      aria-hidden
                    />
                    <span className="text-sm">{c.name}</span>
                  </label>
                  {checked && selectedCategoryIds.size > 1 && (
                    <label
                      className={`flex cursor-pointer items-center gap-1 text-xs ${
                        isPrimary
                          ? "text-indigo-500"
                          : "text-[var(--muted)] hover:text-[var(--foreground)]"
                      }`}
                      title="Primary category sets the band and color"
                    >
                      <input
                        type="radio"
                        name="primary-category"
                        checked={isPrimary}
                        onChange={() => setPrimaryCategoryId(c.id)}
                        className="accent-indigo-500"
                      />
                      Primary
                    </label>
                  )}
                </div>
              );
            })}
          </div>
        </FormField>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-3">
          <input
            type="checkbox"
            checked={featured}
            onChange={(e) => setFeatured(e.target.checked)}
            className="mt-0.5 accent-indigo-500"
          />
          <span className="text-sm">
            <span className="font-medium">Featured event</span>
            <span className="mt-0.5 block text-xs text-[var(--muted)]">
              With an image URL on a single-day event, shows a circular picture
              on the timeline (scales with zoom). Square images with the subject
              centered work best.
            </span>
          </span>
        </label>

        <FormField label="Notes">
          <FormTextarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes…"
          />
        </FormField>

        <FormField label="Scripture references">
          <FormInput
            value={scripture}
            onChange={(e) => setScripture(e.target.value)}
            placeholder="e.g. Gen 5:3; 1 Ki 2:1-4; Ps 90"
          />
          <p className="mt-1.5 text-xs text-[var(--muted)]">
            Separate with semicolons. Each reference links to the New World
            Translation on jw.org.
          </p>
        </FormField>

        <RelatedEventsInput
          selectedIds={relatedEventIds}
          onChange={setRelatedEventIds}
          excludeId={editId}
        />

        <LinksInput links={links} onChange={setLinks} />

        <ImageUpload
          imageUrl={imageUrl}
          onUploaded={setImageUrl}
          onClear={() => {
            setImageUrl("");
            setImageUrlDraft("");
          }}
          onInputChange={setImageUrlDraft}
        />

        {showCircleHint && (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200">
            Circular timeline picture will show for this single-day event.
          </p>
        )}

        {showCircleBlockedHint && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
            Circular pictures only appear on <strong>single-day</strong> events.
            Clear the end date (or set it equal to the start date) to use a
            circle instead of a bar.
          </p>
        )}

        <button type="submit" disabled={submitting} className={buttonPrimaryClass}>
          {existing ? "Save Changes" : "Add Event"}
        </button>
      </form>
    </ModalOverlay>
  );
}
