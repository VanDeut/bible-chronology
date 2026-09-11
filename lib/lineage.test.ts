import { describe, expect, it } from "vitest";
import { collectLineage } from "./lineage";
import type { TimelineEvent } from "./types";

const ev = (id: string, related?: string[]): TimelineEvent => ({
  id, title: id, startDate: "0001-01-01", notes: "", categoryIds: ["c"], links: [],
  relatedEventIds: related, createdAt: "", updatedAt: "",
});

describe("collectLineage", () => {
  it("follows links both ways and stops at unrelated events", () => {
    const events = [
      ev("adam"), ev("seth", ["adam"]), ev("enosh", ["seth"]),
      ev("cain", ["adam"]), ev("flood"), ev("moses"), ev("aaron", ["moses"]),
    ];
    expect([...collectLineage(events, "seth")].sort()).toEqual(["adam", "cain", "enosh", "seth"]);
    expect([...collectLineage(events, "moses")].sort()).toEqual(["aaron", "moses"]);
    expect(collectLineage(events, "missing").size).toBe(0);
  });
});
