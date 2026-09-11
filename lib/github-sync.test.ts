import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchRemote, pushRemote, GitHubSyncError } from "./github-sync";
import { createEmptyData } from "./types";

const config = {
  repo: "owner/repo",
  branch: "main",
  path: "data/timeline.json",
  token: "t",
};

afterEach(() => vi.unstubAllGlobals());

describe("github-sync contents API", () => {
  it("returns null when the file does not exist yet", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 404 })));
    expect(await fetchRemote(config)).toBeNull();
  });

  it("round-trips UTF-8 data through base64 and reports the sha", async () => {
    const data = createEmptyData();
    data.categories[0].name = "Génesis ✡";
    let sent = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === "PUT") {
          sent = (JSON.parse(init.body as string) as { content: string }).content;
          return new Response(JSON.stringify({ content: { sha: "new" } }), { status: 201 });
        }
        return new Response(JSON.stringify({ content: sent, sha: "new" }), { status: 200 });
      })
    );

    expect(await pushRemote(config, data, null)).toBe("new");
    const remote = await fetchRemote(config);
    expect(remote?.sha).toBe("new");
    expect(remote?.data.categories[0].name).toBe("Génesis ✡");
  });

  it("surfaces a 409 conflict as a typed error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ message: "sha mismatch" }), { status: 409 }))
    );
    await expect(pushRemote(config, createEmptyData(), "old")).rejects.toBeInstanceOf(
      GitHubSyncError
    );
  });
});
