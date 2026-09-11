/**
 * Parse free-text scripture references ("Gen 5:3; 1 Ki 2:1-4, Ps 90") into
 * links on jw.org's online New World Translation.
 */

interface BibleBook {
  number: number;
  name: string;
  slug: string;
  aliases: string[];
}

const BOOKS: BibleBook[] = [
  { number: 1, name: "Genesis", slug: "genesis", aliases: ["ge", "gen"] },
  { number: 2, name: "Exodus", slug: "exodus", aliases: ["ex", "exo", "exod"] },
  { number: 3, name: "Leviticus", slug: "leviticus", aliases: ["le", "lev"] },
  { number: 4, name: "Numbers", slug: "numbers", aliases: ["nu", "num"] },
  { number: 5, name: "Deuteronomy", slug: "deuteronomy", aliases: ["de", "deu", "deut", "dt"] },
  { number: 6, name: "Joshua", slug: "joshua", aliases: ["jos", "josh"] },
  { number: 7, name: "Judges", slug: "judges", aliases: ["jg", "jdg", "judg"] },
  { number: 8, name: "Ruth", slug: "ruth", aliases: ["ru", "rut"] },
  { number: 9, name: "1 Samuel", slug: "1-samuel", aliases: ["1sa", "1sam", "1 sa", "1 sam"] },
  { number: 10, name: "2 Samuel", slug: "2-samuel", aliases: ["2sa", "2sam", "2 sa", "2 sam"] },
  { number: 11, name: "1 Kings", slug: "1-kings", aliases: ["1ki", "1kgs", "1 ki", "1 kgs"] },
  { number: 12, name: "2 Kings", slug: "2-kings", aliases: ["2ki", "2kgs", "2 ki", "2 kgs"] },
  { number: 13, name: "1 Chronicles", slug: "1-chronicles", aliases: ["1ch", "1chr", "1 ch", "1 chr", "1 chron"] },
  { number: 14, name: "2 Chronicles", slug: "2-chronicles", aliases: ["2ch", "2chr", "2 ch", "2 chr", "2 chron"] },
  { number: 15, name: "Ezra", slug: "ezra", aliases: ["ezr"] },
  { number: 16, name: "Nehemiah", slug: "nehemiah", aliases: ["ne", "neh"] },
  { number: 17, name: "Esther", slug: "esther", aliases: ["es", "est", "esth"] },
  { number: 18, name: "Job", slug: "job", aliases: ["jb"] },
  { number: 19, name: "Psalms", slug: "psalms", aliases: ["ps", "psa", "psalm", "pss"] },
  { number: 20, name: "Proverbs", slug: "proverbs", aliases: ["pr", "pro", "prov"] },
  { number: 21, name: "Ecclesiastes", slug: "ecclesiastes", aliases: ["ec", "ecc", "eccl"] },
  { number: 22, name: "Song of Solomon", slug: "song-of-solomon", aliases: ["ca", "song", "sos", "song of songs", "canticles"] },
  { number: 23, name: "Isaiah", slug: "isaiah", aliases: ["isa", "is"] },
  { number: 24, name: "Jeremiah", slug: "jeremiah", aliases: ["jer", "je"] },
  { number: 25, name: "Lamentations", slug: "lamentations", aliases: ["la", "lam"] },
  { number: 26, name: "Ezekiel", slug: "ezekiel", aliases: ["eze", "ezek", "ezk"] },
  { number: 27, name: "Daniel", slug: "daniel", aliases: ["da", "dan"] },
  { number: 28, name: "Hosea", slug: "hosea", aliases: ["ho", "hos"] },
  { number: 29, name: "Joel", slug: "joel", aliases: ["joe", "jl"] },
  { number: 30, name: "Amos", slug: "amos", aliases: ["am"] },
  { number: 31, name: "Obadiah", slug: "obadiah", aliases: ["ob", "oba", "obad"] },
  { number: 32, name: "Jonah", slug: "jonah", aliases: ["jon"] },
  { number: 33, name: "Micah", slug: "micah", aliases: ["mic"] },
  { number: 34, name: "Nahum", slug: "nahum", aliases: ["na", "nah"] },
  { number: 35, name: "Habakkuk", slug: "habakkuk", aliases: ["hab"] },
  { number: 36, name: "Zephaniah", slug: "zephaniah", aliases: ["zep", "zeph"] },
  { number: 37, name: "Haggai", slug: "haggai", aliases: ["hag"] },
  { number: 38, name: "Zechariah", slug: "zechariah", aliases: ["zec", "zech"] },
  { number: 39, name: "Malachi", slug: "malachi", aliases: ["mal"] },
  { number: 40, name: "Matthew", slug: "matthew", aliases: ["mt", "mat", "matt"] },
  { number: 41, name: "Mark", slug: "mark", aliases: ["mr", "mk", "mar"] },
  { number: 42, name: "Luke", slug: "luke", aliases: ["lu", "lk", "luk"] },
  { number: 43, name: "John", slug: "john", aliases: ["joh", "jn"] },
  { number: 44, name: "Acts", slug: "acts", aliases: ["ac", "act"] },
  { number: 45, name: "Romans", slug: "romans", aliases: ["ro", "rom"] },
  { number: 46, name: "1 Corinthians", slug: "1-corinthians", aliases: ["1co", "1cor", "1 co", "1 cor"] },
  { number: 47, name: "2 Corinthians", slug: "2-corinthians", aliases: ["2co", "2cor", "2 co", "2 cor"] },
  { number: 48, name: "Galatians", slug: "galatians", aliases: ["ga", "gal"] },
  { number: 49, name: "Ephesians", slug: "ephesians", aliases: ["eph"] },
  { number: 50, name: "Philippians", slug: "philippians", aliases: ["php", "phil", "philip"] },
  { number: 51, name: "Colossians", slug: "colossians", aliases: ["col"] },
  { number: 52, name: "1 Thessalonians", slug: "1-thessalonians", aliases: ["1th", "1thes", "1thess", "1 th", "1 thes", "1 thess"] },
  { number: 53, name: "2 Thessalonians", slug: "2-thessalonians", aliases: ["2th", "2thes", "2thess", "2 th", "2 thes", "2 thess"] },
  { number: 54, name: "1 Timothy", slug: "1-timothy", aliases: ["1ti", "1tim", "1 ti", "1 tim"] },
  { number: 55, name: "2 Timothy", slug: "2-timothy", aliases: ["2ti", "2tim", "2 ti", "2 tim"] },
  { number: 56, name: "Titus", slug: "titus", aliases: ["tit"] },
  { number: 57, name: "Philemon", slug: "philemon", aliases: ["phm", "phlm", "philem"] },
  { number: 58, name: "Hebrews", slug: "hebrews", aliases: ["heb"] },
  { number: 59, name: "James", slug: "james", aliases: ["jas", "jam"] },
  { number: 60, name: "1 Peter", slug: "1-peter", aliases: ["1pe", "1pet", "1 pe", "1 pet"] },
  { number: 61, name: "2 Peter", slug: "2-peter", aliases: ["2pe", "2pet", "2 pe", "2 pet"] },
  { number: 62, name: "1 John", slug: "1-john", aliases: ["1jo", "1jn", "1 jo", "1 jn"] },
  { number: 63, name: "2 John", slug: "2-john", aliases: ["2jo", "2jn", "2 jo", "2 jn"] },
  { number: 64, name: "3 John", slug: "3-john", aliases: ["3jo", "3jn", "3 jo", "3 jn"] },
  { number: 65, name: "Jude", slug: "jude", aliases: ["jud"] },
  { number: 66, name: "Revelation", slug: "revelation", aliases: ["re", "rev"] },
];

const bookLookup = new Map<string, BibleBook>();
for (const book of BOOKS) {
  bookLookup.set(normalizeBookKey(book.name), book);
  for (const alias of book.aliases) bookLookup.set(normalizeBookKey(alias), book);
}

function normalizeBookKey(text: string): string {
  return text.toLowerCase().replace(/\./g, "").replace(/\s+/g, " ").trim();
}

export interface ScriptureRef {
  /** Original text as typed, trimmed. */
  text: string;
  /** Canonical display, e.g. "Genesis 5:3-5". */
  label: string;
  /** jw.org NWT link, or null when the reference could not be parsed. */
  url: string | null;
}

const REF_PATTERN =
  /^([1-3]?\s*[A-Za-z][A-Za-z .]*?)\s*(\d+)(?::(\d+)(?:\s*[-–]\s*(\d+))?)?$/;

function pad(n: number, width: number): string {
  return String(n).padStart(width, "0");
}

/** Build the NWT study-Bible link on jw.org for a book/chapter/verse (range). */
export function buildJwOrgUrl(
  book: BibleBook,
  chapter: number,
  verse?: number,
  verseEnd?: number
): string {
  const base = `https://www.jw.org/en/library/bible/nwt/books/${book.slug}/${chapter}/`;
  if (!verse) return base;
  const start = `${pad(book.number, 2)}${pad(chapter, 3)}${pad(verse, 3)}`;
  if (verseEnd && verseEnd > verse) {
    const end = `${pad(book.number, 2)}${pad(chapter, 3)}${pad(verseEnd, 3)}`;
    return `${base}#v${start}-v${end}`;
  }
  return `${base}#v${start}`;
}

export function parseScriptureRef(text: string): ScriptureRef {
  const trimmed = text.trim();
  const match = trimmed.match(REF_PATTERN);
  if (!match) return { text: trimmed, label: trimmed, url: null };

  const [, bookText, chapterText, verseText, verseEndText] = match;
  const book = bookLookup.get(normalizeBookKey(bookText));
  if (!book) return { text: trimmed, label: trimmed, url: null };

  const chapter = Number(chapterText);
  const verse = verseText ? Number(verseText) : undefined;
  const verseEnd = verseEndText ? Number(verseEndText) : undefined;

  const label =
    `${book.name} ${chapter}` +
    (verse ? `:${verse}` : "") +
    (verse && verseEnd && verseEnd > verse ? `-${verseEnd}` : "");

  return { text: trimmed, label, url: buildJwOrgUrl(book, chapter, verse, verseEnd) };
}

/** Split "Gen 5:3; 1 Ki 2:1-4, Ps 90" into individual references. */
export function parseScriptureRefs(value: string | undefined): ScriptureRef[] {
  if (!value?.trim()) return [];
  return value
    .split(/[;,\n]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map(parseScriptureRef);
}
