export interface CsvRow {
  title: string;
  startDate: string;
  endDate: string;
  description: string;
  category: string;
  link: string;
}

export interface CsvFieldMapping {
  title: string;
  startDate: string;
  endDate: string;
  description: string;
  intro: string;
  fullText: string;
  category: string;
  link: string;
}

export interface CsvParseResult {
  headers: string[];
  rows: string[][];
  wasRtf: boolean;
  warnings: string[];
  error: string | null;
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function isRtfContent(text: string): boolean {
  const sample = stripBom(text).trimStart().slice(0, 800);
  return /^\{\\rtf1/i.test(sample) || /\\rtf1\\ansi/i.test(sample);
}

function isRtfGarbage(value: string): boolean {
  return /\\rtf1/i.test(value) || /^\{\\rtf/i.test(value) || /^\\[a-z]+\d/i.test(value);
}

/** Windows-1252 code points 0x80–0x9F that differ from Latin-1 (RTF \'xx escapes). */
const CP1252_HIGH: Record<number, string> = {
  0x80: "€", 0x82: "‚", 0x83: "ƒ", 0x84: "„", 0x85: "…", 0x86: "†", 0x87: "‡",
  0x88: "ˆ", 0x89: "‰", 0x8a: "Š", 0x8b: "‹", 0x8c: "Œ", 0x8e: "Ž", 0x91: "‘",
  0x92: "’", 0x93: "“", 0x94: "”", 0x95: "•", 0x96: "–", 0x97: "—", 0x98: "˜",
  0x99: "™", 0x9a: "š", 0x9b: "›", 0x9c: "œ", 0x9e: "ž", 0x9f: "Ÿ",
};

function unescapeRtf(text: string): string {
  return text
    .replace(/\\'([0-9a-fA-F]{2})/g, (_, hex: string) => {
      const code = parseInt(hex, 16);
      return CP1252_HIGH[code] ?? String.fromCharCode(code);
    })
    .replace(/\\(\r?\n)/g, "$1")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
}

/** Pull CSV text out of an RTF export. */
function extractCsvFromRtf(raw: string): string {
  let text = unescapeRtf(stripBom(raw));

  // Prefer the known Tiki-Toki header row
  const titleHeader = text.match(/"Title"\s*,\s*"Start Date"/i);
  if (titleHeader?.index != null) {
    text = text.slice(titleHeader.index);
  } else {
    // Any quoted CSV header row
    const genericHeader = text.match(/"[^"\r\n]{1,80}"\s*,\s*"[^"\r\n]{1,80}"/);
    if (genericHeader?.index != null) {
      text = text.slice(genericHeader.index);
    }
  }

  // Drop trailing RTF closing brace
  text = text.replace(/\}\s*$/, "");

  // Remove RTF control groups that appear before quoted fields on a line
  text = text.replace(/^[^\S\r\n]*(?:\\[a-z]+\d*\s*|\\[^'"\s])*\s*(?=")/gim, "");

  return text;
}

export function prepareImportText(raw: string): { text: string; wasRtf: boolean } {
  if (!isRtfContent(raw)) {
    return { text: stripBom(raw), wasRtf: false };
  }

  return { text: extractCsvFromRtf(raw), wasRtf: true };
}

function parseCsvRecords(text: string): string[][] {
  const records: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (next === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      current.push(field);
      field = "";
    } else if (char === "\n") {
      current.push(field);
      field = "";
      if (current.some((c) => c.length > 0)) {
        records.push(current);
      }
      current = [];
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field.length > 0 || current.length > 0) {
    current.push(field);
    if (current.some((c) => c.length > 0)) {
      records.push(current);
    }
  }

  return records;
}

function sanitizeHeaders(headers: string[]): string[] {
  return headers.map((h) => h.trim().replace(/^\uFEFF/, ""));
}

function headersLookValid(headers: string[]): boolean {
  if (headers.length < 2) return false;
  if (headers.some(isRtfGarbage)) return false;
  const lower = headers.map((h) => h.toLowerCase());
  return lower.some((h) =>
    ["title", "name", "event", "start", "date"].some((k) => h.includes(k))
  );
}

export function parseCsv(raw: string): CsvParseResult {
  const warnings: string[] = [];
  let { text, wasRtf } = prepareImportText(raw);

  if (wasRtf) {
    warnings.push(
      "This file was exported as Rich Text (RTF), not plain CSV. It was converted automatically."
    );
  }

  let records = parseCsvRecords(text);
  let headers = records.length > 0 ? sanitizeHeaders(records[0]) : [];

  // If RTF conversion failed, retry with aggressive extraction
  if (!headersLookValid(headers) && isRtfContent(raw)) {
    text = extractCsvFromRtf(raw);
    records = parseCsvRecords(text);
    headers = records.length > 0 ? sanitizeHeaders(records[0]) : [];
    wasRtf = true;
  }

  if (!headersLookValid(headers)) {
    return {
      headers: [],
      rows: [],
      wasRtf,
      warnings,
      error:
        "Could not read column headers from this file. It may be a Rich Text export — open it in TextEdit, choose Format → Make Plain Text, then save and try again.",
    };
  }

  const rows = records.slice(1).map((row) => {
    while (row.length < headers.length) row.push("");
    return row;
  });

  return { headers, rows, wasRtf, warnings, error: null };
}

export function autoDetectMapping(headers: string[]): CsvFieldMapping {
  const lower = headers.map((h) => h.toLowerCase());

  const find = (...candidates: string[]) => {
    for (const candidate of candidates) {
      const idx = lower.findIndex((h) => h === candidate || h.includes(candidate));
      if (idx >= 0) return headers[idx];
    }
    return "";
  };

  return {
    title: find("title", "name", "event"),
    startDate: find("start date", "startdate", "start date/time", "start"),
    endDate: find("end date", "enddate", "end date/time", "end", "finish"),
    description: find("description", "notes", "detail", "body"),
    intro: find("intro", "summary", "excerpt"),
    fullText: find("full text", "fulltext", "text", "content"),
    category: find("category", "type", "tag"),
    link: find("external link", "link", "url", "website"),
  };
}

function normalizeDate(value: string): string {
  if (!value) return "";
  const trimmed = value.trim();

  const bcMatch = trimmed.match(/^(\d+)\s*BC-(\d{2})-(\d{2})/i);
  if (bcMatch) {
    const y = String(parseInt(bcMatch[1], 10)).padStart(4, "0");
    return `-${y}-${bcMatch[2]}-${bcMatch[3]}`;
  }

  const negMatch = trimmed.match(/^(-\d{1,5})-(\d{2})-(\d{2})/);
  if (negMatch) return `${negMatch[1]}-${negMatch[2]}-${negMatch[3]}`;

  const isoMatch = trimmed.match(/^(\d{1,4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const y = String(parseInt(isoMatch[1], 10)).padStart(4, "0");
    return `${y}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  const slashMatch = trimmed.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (slashMatch) {
    const month = slashMatch[1].padStart(2, "0");
    const day = slashMatch[2].padStart(2, "0");
    return `${slashMatch[3]}-${month}-${day}`;
  }

  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, "0");
    const d = String(parsed.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  return "";
}

function combineDescription(
  row: string[],
  mapping: CsvFieldMapping,
  headers: string[]
): string {
  const col = (field: string) => (field ? headers.indexOf(field) : -1);
  const parts: string[] = [];

  const descIdx = col(mapping.description);
  const introIdx = col(mapping.intro);
  const fullIdx = col(mapping.fullText);

  if (introIdx >= 0 && row[introIdx]?.trim()) parts.push(row[introIdx].trim());
  if (fullIdx >= 0 && row[fullIdx]?.trim()) parts.push(row[fullIdx].trim());
  if (descIdx >= 0 && row[descIdx]?.trim()) parts.push(row[descIdx].trim());

  return parts.join("\n\n");
}

/** Split a CSV category cell into multiple names (semicolon or pipe separated). */
export function splitCategoryNames(value: string): string[] {
  if (!value.trim()) return [];
  return value
    .split(/[;|]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function convertCsvToRows(
  headers: string[],
  rows: string[][],
  mapping: CsvFieldMapping
): { valid: CsvRow[]; skipped: number; skipReasons: string[] } {
  const colIndex = (field: string) => (field ? headers.indexOf(field) : -1);
  const titleIdx = colIndex(mapping.title);
  const startIdx = colIndex(mapping.startDate);
  const endIdx = colIndex(mapping.endDate);
  const categoryIdx = colIndex(mapping.category);
  const linkIdx = colIndex(mapping.link);

  const valid: CsvRow[] = [];
  let skipped = 0;
  const skipReasons: string[] = [];

  for (const row of rows) {
    const title = titleIdx >= 0 ? (row[titleIdx] ?? "").trim() : "";
    const startDate = startIdx >= 0 ? normalizeDate(row[startIdx] ?? "") : "";
    const endDate = endIdx >= 0 ? normalizeDate(row[endIdx] ?? "") : "";
    const description = combineDescription(row, mapping, headers);
    const category = categoryIdx >= 0 ? (row[categoryIdx] ?? "").trim() : "";
    const link = linkIdx >= 0 ? (row[linkIdx] ?? "").trim() : "";

    if (!title || isRtfGarbage(title)) {
      skipped++;
      continue;
    }
    if (!startDate) {
      skipped++;
      if (skipReasons.length < 3) {
        skipReasons.push(`"${title.slice(0, 40)}" — unrecognised start date`);
      }
      continue;
    }

    valid.push({ title, startDate, endDate, description, category, link });
  }

  return { valid, skipped, skipReasons };
}
