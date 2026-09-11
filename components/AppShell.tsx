"use client";

import { useEffect, useState } from "react";
import { Header } from "./Header";
import { Timeline } from "./timeline/Timeline";
import { DetailPanel } from "./panels/DetailPanel";
import { EventFormModal } from "./forms/EventFormModal";
import { BackgroundFormModal } from "./forms/BackgroundFormModal";
import { CategoryManagerModal } from "./forms/CategoryManagerModal";
import { ImportExportModal } from "./modals/ImportExportModal";
import { CsvImportModal } from "./modals/CsvImportModal";
import { AiPromptModal } from "./modals/AiPromptModal";
import { AppearanceModal } from "./modals/AppearanceModal";
import { JumpToYearModal } from "./modals/JumpToYearModal";
import { SearchEventsModal } from "./modals/SearchEventsModal";
import { HelpModal } from "./modals/HelpModal";
import { GitHubSyncModal } from "./modals/GitHubSyncModal";
import { Toaster } from "./ui/Toaster";
import { EmptyState } from "./EmptyState";
import { useTimelineStore } from "@/lib/store";
import { useHiddenCategories } from "@/lib/use-hidden-categories";
import { useAppearanceSettings } from "@/lib/use-appearance-settings";
import { useKeyboardShortcuts } from "@/lib/use-keyboard-shortcuts";
import { startSyncListeners } from "@/lib/github-sync";

export type ModalType =
  | "event"
  | "background"
  | "categories"
  | "appearance"
  | "import-export"
  | "csv"
  | "ai-prompt"
  | "search"
  | "jump-to-year"
  | "help"
  | "github-sync"
  | null;

export function AppShell() {
  const [modal, setModal] = useState<ModalType>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const detailItem = useTimelineStore((s) => s.detailItem);
  const setDetailItem = useTimelineStore((s) => s.setDetailItem);
  const isLoaded = useTimelineStore((s) => s.isLoaded);
  const eventCount = useTimelineStore((s) => s.data.events.length);
  const backgroundCount = useTimelineStore((s) => s.data.backgrounds.length);
  const categoryVisibility = useHiddenCategories();
  const appearance = useAppearanceSettings();

  const isEmpty = isLoaded && eventCount === 0 && backgroundCount === 0;

  const openModal = (type: ModalType) => {
    setEditId(null);
    setModal(type);
  };

  const openEdit = (type: "event" | "background", id: string) => {
    setEditId(id);
    setModal(type);
    setDetailItem(null);
  };

  const closeModal = () => {
    setModal(null);
    setEditId(null);
  };

  useEffect(() => startSyncListeners(), []);

  useKeyboardShortcuts({
    onOpenSearch: () => openModal("search"),
    disabled: modal !== null || detailItem !== null,
  });

  return (
    <div className="flex h-dvh flex-col">
      <Header onOpenModal={openModal} categoryVisibility={categoryVisibility} />

      <main className="relative min-h-0 min-w-0 flex-1">
        <Timeline categoryVisibility={categoryVisibility} />
        {isEmpty && (
          <EmptyState
            onAddEvent={() => openModal("event")}
            onRestoreBackup={() => openModal("import-export")}
            onImportCsv={() => openModal("csv")}
          />
        )}
      </main>

      {detailItem && (
        <DetailPanel
          item={detailItem}
          onClose={() => setDetailItem(null)}
          onEdit={() => {
            if (detailItem.type === "event") {
              openEdit("event", detailItem.data.id);
            } else {
              openEdit("background", detailItem.data.id);
            }
          }}
        />
      )}

      {modal === "event" && (
        <EventFormModal onClose={closeModal} editId={editId ?? undefined} />
      )}
      {modal === "background" && (
        <BackgroundFormModal
          onClose={closeModal}
          editId={editId ?? undefined}
        />
      )}
      {modal === "categories" && (
        <CategoryManagerModal onClose={closeModal} />
      )}
      {modal === "appearance" && (
        <AppearanceModal
          onClose={closeModal}
          categoryVisibility={categoryVisibility}
          appearance={appearance}
        />
      )}
      {modal === "search" && <SearchEventsModal onClose={closeModal} />}
      {modal === "jump-to-year" && <JumpToYearModal onClose={closeModal} />}
      {modal === "help" && <HelpModal onClose={closeModal} />}
      {modal === "github-sync" && <GitHubSyncModal onClose={closeModal} />}
      {modal === "import-export" && (
        <ImportExportModal onClose={closeModal} />
      )}
      {modal === "csv" && <CsvImportModal onClose={closeModal} />}
      {modal === "ai-prompt" && <AiPromptModal onClose={closeModal} />}
      <Toaster />
    </div>
  );
}
