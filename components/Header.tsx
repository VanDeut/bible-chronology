"use client";

import { useEffect, useRef, useState } from "react";
import { useTimelineController } from "@/lib/timeline-controller";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { CategoryFilterMenu } from "./CategoryFilterMenu";
import type { ModalType } from "./AppShell";
import type { useHiddenCategories } from "@/lib/use-hidden-categories";
import { useGitHubSync } from "@/lib/github-sync";

type CategoryVisibility = ReturnType<typeof useHiddenCategories>;

interface HeaderProps {
  onOpenModal: (modal: ModalType) => void;
  categoryVisibility: CategoryVisibility;
}

const headerButtonClass =
  "rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] transition hover:bg-[var(--background)] active:scale-[0.98] whitespace-nowrap sm:text-sm";

export function Header({ onOpenModal, categoryVisibility }: HeaderProps) {
  const controller = useTimelineController();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuPanelRef = useRef<HTMLDivElement>(null);

  useFocusTrap(menuPanelRef, menuOpen);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    window.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      window.removeEventListener("keydown", handleKey);
    };
  }, [menuOpen]);

  const open = (type: ModalType) => {
    setMenuOpen(false);
    onOpenModal(type);
  };

  const run = (fn: () => void) => {
    setMenuOpen(false);
    fn();
  };

  // Run an action but keep the menu open (e.g. repeated zooming).
  const runKeepOpen = (fn: () => void) => {
    fn();
  };

  return (
    <header className="z-20 shrink-0 border-b border-[var(--border)] bg-[var(--surface)]">
      <div className="flex items-center justify-between gap-2 px-3 py-2 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="font-serif truncate text-lg font-semibold tracking-tight sm:text-xl">
            Bible Chronology
          </h1>
          <SyncStatusDot onClick={() => onOpenModal("github-sync")} />
        </div>

        <nav className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <HeaderButton
            onClick={() => onOpenModal("event")}
            className="hidden sm:inline-block"
          >
            + Event
          </HeaderButton>
          <HeaderButton
            onClick={() => onOpenModal("background")}
            className="hidden sm:inline-block"
          >
            + Background
          </HeaderButton>

          <CategoryFilterMenu
            categoryVisibility={categoryVisibility}
            buttonClassName={`${headerButtonClass} inline-flex items-center`}
          />

          <div className="relative" ref={menuRef}>
            <HeaderButton onClick={() => setMenuOpen((o) => !o)}>
              Menu
            </HeaderButton>

            {menuOpen && (
              <div
                ref={menuPanelRef}
                role="menu"
                aria-label="Main menu"
                className="absolute right-0 top-full z-50 mt-1 min-w-[12rem] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] py-1 shadow-lg"
              >
                <div className="sm:hidden">
                  <MenuItem onClick={() => open("event")}>Add event…</MenuItem>
                  <MenuItem onClick={() => open("background")}>
                    Add background…
                  </MenuItem>
                  <div className="my-1 border-t border-[var(--border)]" />
                </div>
                <MenuItem onClick={() => open("search")}>Search events…</MenuItem>
                <MenuItem onClick={() => open("jump-to-year")}>
                  Jump to year…
                </MenuItem>
                <div className="my-1 border-t border-[var(--border)]" />
                <MenuItem
                  onClick={() => runKeepOpen(() => controller.zoomIn())}
                  disabled={!controller.canZoomIn}
                >
                  Zoom in
                </MenuItem>
                <MenuItem
                  onClick={() => runKeepOpen(() => controller.zoomOut())}
                  disabled={!controller.canZoomOut}
                >
                  Zoom out
                </MenuItem>
                <MenuItem onClick={() => run(() => controller.fitAll())}>
                  Fit all
                </MenuItem>
                <div className="my-1 border-t border-[var(--border)]" />
                <MenuItem onClick={() => open("categories")}>
                  Manage categories
                </MenuItem>
                <MenuItem onClick={() => open("appearance")}>
                  Appearance…
                </MenuItem>
                <div className="my-1 border-t border-[var(--border)]" />
                <MenuItem onClick={() => open("csv")}>Import CSV</MenuItem>
                <MenuItem onClick={() => open("ai-prompt")}>
                  AI extraction prompt…
                </MenuItem>
                <MenuItem onClick={() => open("help")}>
                  Help & shortcuts…
                </MenuItem>
                <MenuItem onClick={() => open("import-export")}>
                  Backup & restore
                </MenuItem>
                <MenuItem onClick={() => open("github-sync")}>
                  GitHub sync…
                </MenuItem>
              </div>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}

function MenuItem({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className="w-full px-3 py-2 text-left text-sm transition hover:bg-[var(--background)] disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function HeaderButton({
  children,
  onClick,
  className,
}: {
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${headerButtonClass}${className ? ` ${className}` : ""}`}
    >
      {children}
    </button>
  );
}

/** Tiny GitHub-sync indicator; hidden when sync is not configured. */
function SyncStatusDot({ onClick }: { onClick: () => void }) {
  const status = useGitHubSync((s) => s.status);
  const error = useGitHubSync((s) => s.error);
  if (status === "off") return null;

  const { color, label } =
    status === "syncing"
      ? { color: "bg-amber-400 animate-pulse", label: "Syncing with GitHub…" }
      : status === "error"
        ? { color: "bg-red-500", label: `GitHub sync error: ${error ?? ""}` }
        : status === "offline"
          ? { color: "bg-slate-400", label: "Offline — changes sync when back online" }
          : { color: "bg-emerald-500", label: "Synced with GitHub" };

  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full hover:bg-[var(--background)]"
    >
      <span className={`h-2 w-2 rounded-full ${color}`} />
    </button>
  );
}
