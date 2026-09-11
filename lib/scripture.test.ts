import { describe, expect, it } from "vitest";
import { parseScriptureRefs } from "./scripture";

describe("scripture references", () => {
  it("links verses, ranges and whole chapters on jw.org", () => {
    const [a, b, c] = parseScriptureRefs("Gen 5:3; 1 Ki 2:1-4, Ps 90");
    expect(a.label).toBe("Genesis 5:3");
    expect(a.url).toBe(
      "https://www.jw.org/en/library/bible/nwt/books/genesis/5/#v01005003"
    );
    expect(b.label).toBe("1 Kings 2:1-4");
    expect(b.url).toBe(
      "https://www.jw.org/en/library/bible/nwt/books/1-kings/2/#v11002001-v11002004"
    );
    expect(c.label).toBe("Psalms 90");
    expect(c.url).toBe("https://www.jw.org/en/library/bible/nwt/books/psalms/90/");
  });

  it("keeps unparseable text as a plain label", () => {
    const [ref] = parseScriptureRefs("see footnote");
    expect(ref.url).toBeNull();
    expect(ref.label).toBe("see footnote");
  });

  it("carries the book over to a bare chapter:verse", () => {
    const [a, b] = parseScriptureRefs("Ge 5:32; 10:21");
    expect(a.label).toBe("Genesis 5:32");
    expect(b.label).toBe("Genesis 10:21");
  });

  it("accepts full names with periods and spacing variants", () => {
    expect(parseScriptureRefs("1 Samuel 17:45")[0].url).toContain("1-samuel/17/#v09017045");
    expect(parseScriptureRefs("Matt. 24:14")[0].label).toBe("Matthew 24:14");
    expect(parseScriptureRefs("Song of Solomon 2:1")[0].url).toContain("song-of-solomon");
  });
});
