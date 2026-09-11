import { create } from "zustand";
import type { TimelineData } from "./types";
import { parseTimelineData, createBackupFile } from "./parse-timeline-data";
import { mergeTimelineData, replaceTimelineData } from "./merge";
import { showToast } from "./use-toast";

/**
 * Keeps the timeline in a JSON file inside a GitHub repo so every device that
 * opens the site sees the same data. Reads/writes go through the GitHub
 * Contents API straight from the browser; the token lives in localStorage.
 */

export interface GitHubSyncConfig {
  /** "owner/repo" */
  repo: string;
  branch: string;
  path: string;
  token: string;
}

export type SyncStatus = "off" | "idle" | "syncing" | "error" | "offline";

const CONFIG_KEY = "timeline-github-sync";
const DIRTY_KEY = "timeline-github-sync-dirty";
const PUSH_DEBOUNCE_MS = 2500;

export const DEFAULT_SYNC_REPO = process.env.NEXT_PUBLIC_GITHUB_REPO ?? "";
export const DEFAULT_SYNC_BRANCH = "main";
export const DEFAULT_SYNC_PATH = "data/timeline.json";

export function loadSyncConfig(): GitHubSyncConfig | null {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<GitHubSyncConfig>;
    if (!parsed.repo || !parsed.token) return null;
    return {
      repo: parsed.repo,
      branch: parsed.branch || DEFAULT_SYNC_BRANCH,
      path: parsed.path || DEFAULT_SYNC_PATH,
      token: parsed.token,
    };
  } catch {
    return null;
  }
}

export function saveSyncConfig(config: GitHubSyncConfig | null): void {
  try {
    if (config) localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    else localStorage.removeItem(CONFIG_KEY);
  } catch {
    /* storage unavailable */
  }
}

function isDirty(): boolean {
  try {
    return localStorage.getItem(DIRTY_KEY) === "1";
  } catch {
    return false;
  }
}

function setDirty(value: boolean): void {
  try {
    if (value) localStorage.setItem(DIRTY_KEY, "1");
    else localStorage.removeItem(DIRTY_KEY);
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// GitHub Contents API

function contentsUrl(config: GitHubSyncConfig): string {
  const path = config.path.split("/").map(encodeURIComponent).join("/");
  return `https://api.github.com/repos/${config.repo}/contents/${path}`;
}

function headers(config: GitHubSyncConfig): HeadersInit {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${config.token}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

function encodeBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function decodeBase64(b64: string): string {
  const binary = atob(b64.replace(/\n/g, ""));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export class GitHubSyncError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
  }
}

async function describeError(res: Response): Promise<GitHubSyncError> {
  let detail = "";
  try {
    const body = (await res.json()) as { message?: string };
    detail = body.message ?? "";
  } catch {
    /* no body */
  }
  const hint =
    res.status === 401
      ? "Token rejected — check it is valid and not expired."
      : res.status === 403
        ? "Token lacks permission — it needs Contents: read & write on this repo."
        : res.status === 404
          ? "Repo, branch or file path not found (or the token cannot see the repo)."
          : "";
  return new GitHubSyncError(
    [`GitHub ${res.status}`, detail, hint].filter(Boolean).join(" · "),
    res.status
  );
}

export interface RemoteSnapshot {
  data: TimelineData;
  sha: string;
}

/** Latest committed file, or null when it does not exist yet. */
export async function fetchRemote(
  config: GitHubSyncConfig
): Promise<RemoteSnapshot | null> {
  const res = await fetch(`${contentsUrl(config)}?ref=${encodeURIComponent(config.branch)}`, {
    headers: headers(config),
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw await describeError(res);

  const body = (await res.json()) as { content: string; sha: string };
  const raw = JSON.parse(decodeBase64(body.content));
  const { data } = parseTimelineData(raw);
  return { data, sha: body.sha };
}

/** Commit the file; `sha` must match the current remote or GitHub returns 409. */
export async function pushRemote(
  config: GitHubSyncConfig,
  data: TimelineData,
  sha: string | null
): Promise<string> {
  const text = JSON.stringify(createBackupFile(data), null, 2) + "\n";
  const res = await fetch(contentsUrl(config), {
    method: "PUT",
    headers: { ...headers(config), "Content-Type": "application/json" },
    body: JSON.stringify({
      message: `Update timeline data (${data.events.length} events)`,
      content: encodeBase64(text),
      branch: config.branch,
      ...(sha ? { sha } : {}),
    }),
  });
  if (!res.ok) throw await describeError(res);
  const body = (await res.json()) as { content: { sha: string } };
  return body.content.sha;
}

// ---------------------------------------------------------------------------
// Sync engine

interface DataBridge {
  getData: () => TimelineData;
  /** Replace app data without triggering a push back to GitHub. */
  setDataFromRemote: (data: TimelineData) => void;
}

interface SyncStore {
  config: GitHubSyncConfig | null;
  status: SyncStatus;
  error: string | null;
  lastSyncedAt: string | null;
  remoteSha: string | null;

  /** Called once by the data store so the engine can read/replace app data. */
  attach: (bridge: DataBridge) => void;
  configure: (config: GitHubSyncConfig | null) => Promise<void>;
  /** Local data changed; push soon (debounced). */
  notifyLocalChange: () => void;
  /** Pull remote if it changed; push if local edits are pending. */
  syncNow: () => Promise<void>;
}

let bridge: DataBridge | null = null;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let inFlight: Promise<void> = Promise.resolve();

function serialize(fn: () => Promise<void>): Promise<void> {
  inFlight = inFlight.then(fn, fn);
  return inFlight;
}

export const useGitHubSync = create<SyncStore>((set, get) => ({
  config: null,
  status: "off",
  error: null,
  lastSyncedAt: null,
  remoteSha: null,

  attach: (b) => {
    bridge = b;
    const config = loadSyncConfig();
    set({ config, status: config ? "idle" : "off" });
  },

  configure: async (config) => {
    saveSyncConfig(config);
    if (pushTimer) clearTimeout(pushTimer);
    if (!config) {
      setDirty(false);
      set({ config: null, status: "off", error: null, remoteSha: null });
      return;
    }
    set({ config, status: "idle", error: null, remoteSha: null });
    // First connect: local content counts as unsynced edits so it is merged
    // with (or creates) the remote file instead of being discarded.
    const local = bridge?.getData();
    if (local && (local.events.length > 0 || local.backgrounds.length > 0)) {
      setDirty(true);
    }
    await get().syncNow();
  },

  notifyLocalChange: () => {
    if (!get().config) return;
    setDirty(true);
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
      pushTimer = null;
      void get().syncNow();
    }, PUSH_DEBOUNCE_MS);
  },

  syncNow: () =>
    serialize(async () => {
      const config = get().config;
      if (!config || !bridge) return;
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        set({ status: "offline" });
        return;
      }
      set({ status: "syncing", error: null });

      try {
        const remote = await fetchRemote(config);
        const dirty = isDirty();
        let sha = remote?.sha ?? null;

        if (dirty || !remote) {
          let toPush = bridge.getData();
          if (remote && remote.sha !== get().remoteSha) {
            // Remote changed since we last looked (or this is a fresh
            // connect/boot with unsynced edits): merge before writing.
            toPush = mergeTimelineData(toPush, remote.data);
            bridge.setDataFromRemote(replaceTimelineData(toPush));
          }
          try {
            sha = await pushRemote(config, toPush, sha);
          } catch (err) {
            if (err instanceof GitHubSyncError && err.status === 409) {
              // Lost the race — merge with the newest remote and retry once.
              const latest = await fetchRemote(config);
              const merged = latest
                ? mergeTimelineData(bridge.getData(), latest.data)
                : bridge.getData();
              bridge.setDataFromRemote(replaceTimelineData(merged));
              sha = await pushRemote(config, merged, latest?.sha ?? null);
            } else {
              throw err;
            }
          }
          setDirty(false);
        } else if (remote.sha !== get().remoteSha) {
          bridge.setDataFromRemote(replaceTimelineData(remote.data));
        }

        set({
          status: "idle",
          error: null,
          remoteSha: sha,
          lastSyncedAt: new Date().toISOString(),
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unknown sync error";
        set({ status: "error", error: message });
        showToast({ message: `GitHub sync failed: ${message}`, duration: 8000 });
      }
    }),
}));

/** Pull when the tab regains focus or comes back online. */
export function startSyncListeners(): () => void {
  const onVisible = () => {
    if (document.visibilityState === "visible") void useGitHubSync.getState().syncNow();
  };
  const onOnline = () => void useGitHubSync.getState().syncNow();
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("online", onOnline);
  window.addEventListener("focus", onVisible);
  return () => {
    document.removeEventListener("visibilitychange", onVisible);
    window.removeEventListener("online", onOnline);
    window.removeEventListener("focus", onVisible);
  };
}
