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
import {
  useGitHubSync,
  fetchRemote,
  DEFAULT_SYNC_REPO,
  DEFAULT_SYNC_BRANCH,
  DEFAULT_SYNC_PATH,
} from "@/lib/github-sync";
import { showToast } from "@/lib/use-toast";

interface GitHubSyncModalProps {
  onClose: () => void;
}

export function GitHubSyncModal({ onClose }: GitHubSyncModalProps) {
  const config = useGitHubSync((s) => s.config);
  const status = useGitHubSync((s) => s.status);
  const error = useGitHubSync((s) => s.error);
  const lastSyncedAt = useGitHubSync((s) => s.lastSyncedAt);
  const configure = useGitHubSync((s) => s.configure);
  const syncNow = useGitHubSync((s) => s.syncNow);

  const [repo, setRepo] = useState(config?.repo ?? DEFAULT_SYNC_REPO);
  const [branch, setBranch] = useState(config?.branch ?? DEFAULT_SYNC_BRANCH);
  const [path, setPath] = useState(config?.path ?? DEFAULT_SYNC_PATH);
  const [token, setToken] = useState(config?.token ?? "");
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDisconnect, setShowDisconnect] = useState(false);

  const draft = {
    repo: repo.trim(),
    branch: branch.trim() || DEFAULT_SYNC_BRANCH,
    path: path.trim() || DEFAULT_SYNC_PATH,
    token: token.trim(),
  };
  const canSave = /^[\w.-]+\/[\w.-]+$/.test(draft.repo) && draft.token.length > 0;

  const handleTest = async () => {
    if (!canSave) return;
    setTesting(true);
    try {
      const remote = await fetchRemote(draft);
      showToast({
        message: remote
          ? `Connected — remote file has ${remote.data.events.length} events.`
          : "Connected — file does not exist yet; it will be created on first save.",
      });
    } catch (err) {
      showToast({
        message: err instanceof Error ? err.message : "Connection failed",
        duration: 8000,
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    await configure(draft);
    setSaving(false);
    if (useGitHubSync.getState().status !== "error") onClose();
  };

  const handleDisconnect = async () => {
    await configure(null);
    setShowDisconnect(false);
    setToken("");
  };

  const statusLabel =
    status === "off"
      ? "Not connected"
      : status === "syncing"
        ? "Syncing…"
        : status === "offline"
          ? "Offline — will sync when back online"
          : status === "error"
            ? `Error: ${error}`
            : lastSyncedAt
              ? `Synced ${new Date(lastSyncedAt).toLocaleString()}`
              : "Connected";

  return (
    <ModalOverlay onClose={onClose} title="GitHub sync">
      <div className="space-y-4">
        <p className="text-xs text-[var(--muted)]">
          Stores the timeline as a JSON file in a GitHub repository so every
          device opens with the same data. Changes are committed a few seconds
          after you make them and pulled again whenever you return to the tab.
        </p>

        <div
          className={`rounded-xl border px-3 py-2 text-xs ${
            status === "error"
              ? "border-red-500/40 text-red-500"
              : "border-[var(--border)] text-[var(--muted)]"
          }`}
        >
          {statusLabel}
        </div>

        <FormField label="Repository" required>
          <input
            className={inputClass}
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
            placeholder="owner/repo"
            autoCapitalize="none"
            autoCorrect="off"
          />
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Branch">
            <input
              className={inputClass}
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              placeholder={DEFAULT_SYNC_BRANCH}
            />
          </FormField>
          <FormField label="File path">
            <input
              className={inputClass}
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder={DEFAULT_SYNC_PATH}
            />
          </FormField>
        </div>

        <FormField label="Personal access token" required>
          <input
            className={inputClass}
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="github_pat_…"
            autoComplete="off"
          />
          <p className="mt-1.5 text-xs text-[var(--muted)]">
            GitHub → Settings → Developer settings → Fine-grained tokens. Limit
            it to this repository with <strong>Contents: Read and write</strong>.
            The token is stored only in this browser.
          </p>
        </FormField>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave || saving}
            className={`flex-1 ${buttonPrimaryClass}`}
          >
            {saving ? "Connecting…" : config ? "Save" : "Connect"}
          </button>
          <button
            type="button"
            onClick={handleTest}
            disabled={!canSave || testing}
            className={buttonSecondaryClass}
          >
            {testing ? "Testing…" : "Test connection"}
          </button>
        </div>

        {config && (
          <div className="flex flex-wrap gap-2 border-t border-[var(--border)] pt-4">
            <button
              type="button"
              onClick={() => void syncNow()}
              disabled={status === "syncing"}
              className={buttonSecondaryClass}
            >
              Sync now
            </button>
            <button
              type="button"
              onClick={() => setShowDisconnect(true)}
              className={`${buttonSecondaryClass} text-red-500`}
            >
              Disconnect
            </button>
          </div>
        )}
      </div>

      {showDisconnect && (
        <ConfirmDialog
          title="Disconnect GitHub sync"
          message="Data on this device is kept; it just stops syncing with GitHub. You can reconnect at any time."
          confirmLabel="Disconnect"
          onConfirm={handleDisconnect}
          onCancel={() => setShowDisconnect(false)}
        />
      )}
    </ModalOverlay>
  );
}
