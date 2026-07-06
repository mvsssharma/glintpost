import ExcelJS from "exceljs";
import { sanitizeRichHtml } from "./sanitize-html";
import {
  createPostSchema,
  createRoadmapItemSchema,
  createAnnouncementSchema,
} from "./validations";

export const IMPORT_TYPES = ["posts", "roadmap", "announcements"] as const;
export type ImportType = (typeof IMPORT_TYPES)[number];

export const MAX_IMPORT_ROWS = 500;
export const MAX_IMPORT_FILE_BYTES = 2 * 1024 * 1024; // 2MB
export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const IMPORT_DATA_SHEET = "Data";
export const MAX_IMPORT_VOTES = 5000;

export interface RowError {
  row: number; // 1-based Excel row number (0 = file-level error)
  message: string;
}

export interface PostImportRow {
  title: string;
  content: string;
  status: "DRAFT" | "PUBLISHED";
  date: Date;
}

export interface RoadmapImportRow {
  title: string;
  description: string | null;
  status: "UNDER_REVIEW" | "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "ARCHIVED";
  upvotes: number;
  downvotes: number;
  date: Date;
}

export interface AnnouncementImportRow {
  title: string;
  content: string;
  displayType: "OVERLAY" | "TOP_BANNER";
  status: "DRAFT" | "PUBLISHED";
  startDate: Date;
  endDate: Date;
  priority: number;
  ctaText: string | null;
  ctaUrl: string | null;
  imageUrl: string | null;
}

export type ParsedImport =
  | { type: "posts"; rows: PostImportRow[] }
  | { type: "roadmap"; rows: RoadmapImportRow[] }
  | { type: "announcements"; rows: AnnouncementImportRow[] };

interface ColumnSpec {
  header: string;
  required: boolean;
  note: string;
  example: string;
  width?: number;
}

const COLUMNS: Record<ImportType, ColumnSpec[]> = {
  posts: [
    { header: "Title", required: true, note: "Post title (max 500 chars)", example: "New dashboard filters", width: 40 },
    { header: "Content", required: true, note: "Plain text or HTML. Blank lines become paragraphs.", example: "You can now filter posts by status.\n\nAvailable to all plans.", width: 60 },
    { header: "Status", required: false, note: "DRAFT or PUBLISHED. Blank = PUBLISHED (imported posts are usually already live).", example: "PUBLISHED", width: 14 },
    { header: "Date", required: false, note: "Published/created date — backdating allowed to keep your history in order. Use an Excel date cell or YYYY-MM-DD. Blank = today.", example: "2025-03-14", width: 16 },
  ],
  roadmap: [
    { header: "Title", required: true, note: "Item title (3–500 chars)", example: "Dark mode support", width: 40 },
    { header: "Description", required: false, note: "Optional description (max 5000 chars)", example: "System-aware dark theme across the app", width: 60 },
    { header: "Status", required: false, note: "Under Review, Planned, In Progress, Completed or Archived. Blank = Under Review.", example: "Planned", width: 16 },
    { header: "Upvotes", required: false, note: `Upvote count carried over from your old tool (0–${MAX_IMPORT_VOTES}). Blank = 0.`, example: "42", width: 10 },
    { header: "Downvotes", required: false, note: `Downvote count carried over (0–${MAX_IMPORT_VOTES}). Blank = 0. Most tools only export upvotes.`, example: "0", width: 10 },
    { header: "Date", required: false, note: "Created date — backdating allowed to keep item order. Excel date cell or YYYY-MM-DD. Blank = today.", example: "2025-01-20", width: 16 },
  ],
  announcements: [
    { header: "Title", required: true, note: "Announcement title (max 500 chars)", example: "Scheduled maintenance", width: 40 },
    { header: "Content", required: true, note: "Plain text or HTML. Blank lines become paragraphs.", example: "We will be down for maintenance on Sunday 2–4 AM IST.", width: 60 },
    { header: "Display Type", required: false, note: "Overlay or Banner. Blank = Overlay.", example: "Banner", width: 14 },
    { header: "Status", required: false, note: "DRAFT or PUBLISHED. Blank = DRAFT (publishing pushes to visitors — do it deliberately).", example: "DRAFT", width: 12 },
    { header: "Start Date", required: true, note: "When the announcement starts showing. Backdating allowed for historical records.", example: "2025-05-01", width: 16 },
    { header: "End Date", required: true, note: "When it stops showing. Must be after Start Date.", example: "2025-05-08", width: 16 },
    { header: "Priority", required: false, note: "0–1000, higher shows first. Blank = 0.", example: "10", width: 10 },
    { header: "CTA Text", required: false, note: "Optional button label (max 100 chars)", example: "Learn more", width: 16 },
    { header: "CTA URL", required: false, note: "Optional button link (http/https)", example: "https://example.com/blog/maintenance", width: 30 },
    { header: "Image URL", required: false, note: "Optional image link (http/https)", example: "", width: 30 },
  ],
};

export const IMPORT_LABELS: Record<ImportType, string> = {
  posts: "Changelog Posts",
  roadmap: "Roadmap Items",
  announcements: "Announcements",
};

// === Template generation ===

export async function buildTemplate(type: ImportType): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const columns = COLUMNS[type];

  const data = workbook.addWorksheet("Data");
  data.columns = columns.map((c) => ({ header: c.header, width: c.width ?? 20 }));
  data.getRow(1).font = { bold: true };
  data.addRow(columns.map((c) => c.example));

  const help = workbook.addWorksheet("Instructions");
  help.columns = [{ width: 18 }, { width: 100 }];
  help.addRow([`Importing ${IMPORT_LABELS[type]}`, ""]).font = { bold: true };
  help.addRow(["", ""]);
  help.addRow(["How it works", "Fill the Data sheet (row 2 is an example — replace it), then upload the file. Nothing is imported unless every row is valid."]);
  help.addRow(["Dates", "Enter dates however you like — past dates are fine and recommended when migrating, so your existing history keeps its original order."]);
  help.addRow(["Limits", `Up to ${MAX_IMPORT_ROWS} rows per file, file size up to ${Math.round(MAX_IMPORT_FILE_BYTES / 1024 / 1024)}MB.`]);
  help.addRow(["", ""]);
  help.addRow(["Columns", ""]).font = { bold: true };
  for (const c of columns) {
    help.addRow([c.header + (c.required ? " *" : ""), c.note]);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// === Cell helpers ===

type CellValue = ExcelJS.CellValue;

function cellText(value: CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((r) => r.text).join("").trim();
    }
    if ("text" in value && typeof value.text === "string") return value.text.trim();
    if ("result" in value) return cellText(value.result as CellValue);
  }
  return "";
}

/** Accepts Excel date cells, Excel serial numbers, YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY. */
function parseDateValue(value: CellValue): Date | null | "invalid" {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? "invalid" : value;
  if (typeof value === "object" && "result" in value) {
    return parseDateValue(value.result as CellValue);
  }
  if (typeof value === "number") {
    // Excel serial date (days since 1900-01-01; 25569 = 1970-01-01)
    if (value < 10000 || value > 80000) return "invalid";
    return new Date(Math.round((value - 25569) * 86400000));
  }
  const s = cellText(value);
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? "invalid" : d;
  }
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    const [, dd, mm, yyyy] = dmy;
    const d = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
    if (d.getUTCDate() !== Number(dd) || d.getUTCMonth() !== Number(mm) - 1) return "invalid";
    return d;
  }
  const fallback = new Date(s);
  return isNaN(fallback.getTime()) ? "invalid" : fallback;
}

/** Plain text becomes <p>/<br> HTML; content that already looks like HTML is sanitized as-is. */
function toHtml(text: string): string {
  if (/<([a-z][a-z0-9]*)\b[^>]*>/i.test(text)) {
    return sanitizeRichHtml(text);
  }
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped
    .split(/\r?\n\s*\r?\n/)
    .filter((p) => p.trim().length > 0)
    .map((p) => `<p>${p.trim().replace(/\r?\n/g, "<br>")}</p>`)
    .join("");
}

function normalizeEnum(text: string): string {
  return text.trim().toUpperCase().replace(/[\s-]+/g, "_");
}

function optionalUrl(text: string): string | null {
  return text.length > 0 ? text : null;
}

// === File validation ===

/** Returns an error message when the upload is not a valid .xlsx file. */
export function validateImportUpload(file: File): string | null {
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return "Only .xlsx files are accepted. Download the Excel template and upload the filled copy.";
  }
  const mime = file.type;
  if (mime && mime !== XLSX_MIME && mime !== "application/octet-stream") {
    return "Invalid file type. Upload a .xlsx spreadsheet from the template.";
  }
  return null;
}

function isXlsxBuffer(buffer: Buffer): boolean {
  // .xlsx is a ZIP archive — must start with PK
  return buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b;
}

// === Parsing ===

export async function parseImportFile(
  type: ImportType,
  buffer: Buffer,
): Promise<{ parsed: ParsedImport | null; errors: RowError[] }> {
  if (!isXlsxBuffer(buffer)) {
    return {
      parsed: null,
      errors: [{ row: 0, message: "Not a valid .xlsx file. Download the template and upload the filled copy." }],
    };
  }

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    return { parsed: null, errors: [{ row: 0, message: "Could not read the file. Upload the .xlsx template with your data filled in." }] };
  }

  const sheet = workbook.getWorksheet(IMPORT_DATA_SHEET);
  if (!sheet) {
    return {
      parsed: null,
      errors: [{
        row: 0,
        message: `Could not find a "${IMPORT_DATA_SHEET}" sheet. Download the template and enter your data on the Data tab.`,
      }],
    };
  }
  if (sheet.rowCount < 2) {
    return { parsed: null, errors: [{ row: 0, message: "No data rows found. Fill in the Data sheet of the template." }] };
  }

  // Map headers by name so column order doesn't matter
  const columns = COLUMNS[type];
  const headerIndex = new Map<string, number>();
  sheet.getRow(1).eachCell((cell, colNumber) => {
    headerIndex.set(cellText(cell.value).toLowerCase(), colNumber);
  });

  const errors: RowError[] = [];
  for (const c of columns) {
    if (c.required && !headerIndex.has(c.header.toLowerCase())) {
      errors.push({ row: 1, message: `Missing required column "${c.header}". Download the template and keep its header row.` });
    }
  }
  if (errors.length > 0) return { parsed: null, errors };

  const get = (row: ExcelJS.Row, header: string): CellValue => {
    const idx = headerIndex.get(header.toLowerCase());
    return idx ? row.getCell(idx).value : null;
  };
  const getText = (row: ExcelJS.Row, header: string): string => cellText(get(row, header));

  // Collect non-empty data rows
  const dataRows: ExcelJS.Row[] = [];
  for (let i = 2; i <= sheet.rowCount; i++) {
    const row = sheet.getRow(i);
    const hasData = columns.some((c) => getText(row, c.header).length > 0);
    if (hasData) dataRows.push(row);
  }

  if (dataRows.length === 0) {
    return { parsed: null, errors: [{ row: 0, message: "No data rows found. Fill in the Data sheet of the template." }] };
  }
  if (dataRows.length > MAX_IMPORT_ROWS) {
    return { parsed: null, errors: [{ row: 0, message: `Too many rows (${dataRows.length}). Split the file — the limit is ${MAX_IMPORT_ROWS} rows per import.` }] };
  }

  const requireDate = (row: ExcelJS.Row, header: string, rowNumber: number, fallback?: Date): Date | null => {
    const value = parseDateValue(get(row, header));
    if (value === "invalid") {
      errors.push({ row: rowNumber, message: `Invalid ${header}. Use an Excel date cell, YYYY-MM-DD, or DD/MM/YYYY.` });
      return null;
    }
    if (value === null) {
      if (fallback) return fallback;
      errors.push({ row: rowNumber, message: `${header} is required.` });
      return null;
    }
    return value;
  };

  if (type === "posts") {
    const rows: PostImportRow[] = [];
    for (const row of dataRows) {
      const rowNumber = row.number;
      const statusText = getText(row, "Status");
      const status = statusText ? normalizeEnum(statusText) : "PUBLISHED";
      const candidate = {
        title: getText(row, "Title"),
        content: toHtml(getText(row, "Content")),
        status,
      };
      const result = createPostSchema.safeParse(candidate);
      if (!result.success) {
        errors.push({ row: rowNumber, message: result.error.issues[0]?.message ?? "Invalid row" });
        continue;
      }
      const date = requireDate(row, "Date", rowNumber, new Date());
      if (!date) continue;
      rows.push({ title: result.data.title, content: result.data.content, status: result.data.status, date });
    }
    return errors.length > 0 ? { parsed: null, errors } : { parsed: { type, rows }, errors: [] };
  }

  if (type === "roadmap") {
    const rows: RoadmapImportRow[] = [];
    for (const row of dataRows) {
      const rowNumber = row.number;
      const statusText = getText(row, "Status");
      const candidate = {
        title: getText(row, "Title"),
        description: getText(row, "Description") || null,
        status: statusText ? normalizeEnum(statusText) : "UNDER_REVIEW",
      };
      const result = createRoadmapItemSchema.safeParse(candidate);
      if (!result.success) {
        errors.push({ row: rowNumber, message: result.error.issues[0]?.message ?? "Invalid row" });
        continue;
      }
      const upvotesText = getText(row, "Upvotes");
      const upvotes = upvotesText ? Number(upvotesText) : 0;
      if (!Number.isInteger(upvotes) || upvotes < 0 || upvotes > MAX_IMPORT_VOTES) {
        errors.push({ row: rowNumber, message: `Upvotes must be a whole number between 0 and ${MAX_IMPORT_VOTES}.` });
        continue;
      }
      const downvotesText = getText(row, "Downvotes");
      const downvotes = downvotesText ? Number(downvotesText) : 0;
      if (!Number.isInteger(downvotes) || downvotes < 0 || downvotes > MAX_IMPORT_VOTES) {
        errors.push({ row: rowNumber, message: `Downvotes must be a whole number between 0 and ${MAX_IMPORT_VOTES}.` });
        continue;
      }
      const date = requireDate(row, "Date", rowNumber, new Date());
      if (!date) continue;
      rows.push({
        title: result.data.title,
        description: result.data.description ?? null,
        status: result.data.status as RoadmapImportRow["status"],
        upvotes,
        downvotes,
        date,
      });
    }
    return errors.length > 0 ? { parsed: null, errors } : { parsed: { type, rows }, errors: [] };
  }

  // announcements
  const rows: AnnouncementImportRow[] = [];
  for (const row of dataRows) {
    const rowNumber = row.number;
    const startDate = requireDate(row, "Start Date", rowNumber);
    const endDate = requireDate(row, "End Date", rowNumber);
    if (!startDate || !endDate) continue;

    const displayText = getText(row, "Display Type");
    let displayType = displayText ? normalizeEnum(displayText) : "OVERLAY";
    if (displayType === "BANNER") displayType = "TOP_BANNER";
    const statusText = getText(row, "Status");
    const priorityText = getText(row, "Priority");

    const candidate = {
      title: getText(row, "Title"),
      content: toHtml(getText(row, "Content")),
      displayType,
      status: statusText ? normalizeEnum(statusText) : "DRAFT",
      startDate,
      endDate,
      priority: priorityText ? Number(priorityText) : 0,
      ctaText: getText(row, "CTA Text") || null,
      ctaUrl: optionalUrl(getText(row, "CTA URL")),
      imageUrl: optionalUrl(getText(row, "Image URL")),
    };
    const result = createAnnouncementSchema.safeParse(candidate);
    if (!result.success) {
      errors.push({ row: rowNumber, message: result.error.issues[0]?.message ?? "Invalid row" });
      continue;
    }
    rows.push({
      title: result.data.title,
      content: result.data.content,
      displayType: result.data.displayType,
      status: result.data.status,
      startDate: result.data.startDate,
      endDate: result.data.endDate,
      priority: result.data.priority,
      ctaText: result.data.ctaText ?? null,
      ctaUrl: result.data.ctaUrl ?? null,
      imageUrl: result.data.imageUrl ?? null,
    });
  }
  return errors.length > 0 ? { parsed: null, errors } : { parsed: { type, rows }, errors: [] };
}
