"use client";

import { useState } from "react";
import { ModalOverlay } from "../ui/ModalOverlay";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import {
  FormField,
  inputClass,
  buttonPrimaryClass,
  buttonSecondaryClass,
} from "../ui/FormField";
import { useTimelineStore } from "@/lib/store";
import type { Category } from "@/lib/types";

const PRESET_COLORS = [
  "#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#ec4899",
  "#8b5cf6", "#06b6d4", "#84cc16", "#f97316", "#64748b",
];

interface CategoryManagerModalProps {
  onClose: () => void;
}

export function CategoryManagerModal({ onClose }: CategoryManagerModalProps) {
  const categories = useTimelineStore((s) => s.data.categories);
  const addCategory = useTimelineStore((s) => s.addCategory);
  const updateCategory = useTimelineStore((s) => s.updateCategory);
  const deleteCategory = useTimelineStore((s) => s.deleteCategory);
  const moveCategory = useTimelineStore((s) => s.moveCategory);

  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const startEdit = (cat: Category) => {
    setEditing(cat);
    setName(cat.name);
    setColor(cat.color);
  };

  const startNew = () => {
    setEditing(null);
    setName("");
    setColor(PRESET_COLORS[0]);
  };

  const handleSave = () => {
    if (!name.trim()) return;

    if (editing) {
      updateCategory(editing.id, { name: name.trim(), color });
    } else {
      addCategory({ name: name.trim(), color });
    }
    startNew();
  };

  const handleDelete = (id: string) => {
    if (categories.length <= 1) return;
    setPendingDeleteId(id);
  };

  const performDelete = () => {
    if (!pendingDeleteId) return;
    deleteCategory(pendingDeleteId);
    if (editing?.id === pendingDeleteId) startNew();
    setPendingDeleteId(null);
  };

  const pendingDeleteCategory = pendingDeleteId
    ? categories.find((c) => c.id === pendingDeleteId)
    : undefined;

  return (
    <ModalOverlay onClose={onClose} title="Manage Categories">
      <div className="space-y-4">
        <p className="text-xs text-[var(--muted)]">
          List order sets the top-to-bottom order of category bands on the timeline.
        </p>
        <ul className="space-y-2">
          {categories.map((cat, index) => (
            <li
              key={cat.id}
              className="flex items-center gap-3 rounded-xl border border-[var(--border)] px-3 py-2"
            >
              <span className="flex flex-col -my-1">
                <button
                  type="button"
                  onClick={() => moveCategory(cat.id, -1)}
                  disabled={index === 0}
                  aria-label={`Move ${cat.name} up`}
                  className="px-1 text-xs leading-none text-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-30"
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={() => moveCategory(cat.id, 1)}
                  disabled={index === categories.length - 1}
                  aria-label={`Move ${cat.name} down`}
                  className="px-1 text-xs leading-none text-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-30"
                >
                  ▼
                </button>
              </span>
              <span
                className="h-4 w-4 shrink-0 rounded-full"
                style={{ backgroundColor: cat.color }}
              />
              <span className="flex-1 text-sm">{cat.name}</span>
              <button
                onClick={() => startEdit(cat)}
                className="text-xs text-indigo-500 hover:text-indigo-600"
              >
                Edit
              </button>
              <button
                onClick={() => handleDelete(cat.id)}
                className="text-xs text-red-500 hover:text-red-600"
                disabled={categories.length <= 1}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>

        <div className="space-y-3 border-t border-[var(--border)] pt-4">
          <h3 className="text-sm font-medium">
            {editing ? "Edit Category" : "New Category"}
          </h3>

          <FormField label="Name" required>
            <input
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Category name"
            />
          </FormField>

          <FormField label="Color">
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`h-8 w-8 rounded-full transition ${
                    color === c ? "ring-2 ring-offset-2 ring-indigo-500" : ""
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </FormField>

          <div className="flex gap-2">
            <button onClick={handleSave} className={`flex-1 ${buttonPrimaryClass}`}>
              {editing ? "Save" : "Add Category"}
            </button>
            {editing && (
              <button onClick={startNew} className={buttonSecondaryClass}>
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>

      {pendingDeleteCategory && (
        <ConfirmDialog
          title="Delete category"
          message={
            <>
              Delete{" "}
              <span className="font-medium text-[var(--foreground)]">
                {pendingDeleteCategory.name}
              </span>
              ? Its events will move to General.
            </>
          }
          confirmLabel="Delete"
          onConfirm={performDelete}
          onCancel={() => setPendingDeleteId(null)}
        />
      )}
    </ModalOverlay>
  );
}
