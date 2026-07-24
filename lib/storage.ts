import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { randomBytes } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { getAppUrl } from "./app-url";

// Extension used when the uploaded file has none — keyed by the (already
// validated) content type from the upload route.
const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/svg+xml": ".svg",
};

function resolveExt(filename: string, contentType: string): string {
  return path.extname(filename).toLowerCase() || EXT_BY_TYPE[contentType] || ".bin";
}

// Driver selection: explicit STORAGE_DRIVER wins; otherwise use S3 when an
// endpoint is configured (cloud), else fall back to the local filesystem
// (self-hosted Docker — no external object store required).
const useS3 =
  (process.env.STORAGE_DRIVER || (process.env.S3_ENDPOINT ? "s3" : "local")) === "s3";

// Where the local driver writes files. In Docker this is a mounted volume so
// uploads survive container restarts. Served back out via app/uploads/[key].
export const LOCAL_UPLOAD_DIR =
  process.env.UPLOAD_DIR || path.join(process.cwd(), "data", "uploads");

let s3Client: S3Client | null = null;
function getS3(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: "auto",
      endpoint: process.env.S3_ENDPOINT!,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID!,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
      },
    });
  }
  return s3Client;
}

/**
 * Persists an uploaded file and returns a URL that renders it.
 *
 * - **S3 driver** (cloud): stores under `uploads/<key>` and returns an absolute
 *   `${S3_PUBLIC_URL}/uploads/<key>`.
 * - **Local driver** (self-hosted): writes to `LOCAL_UPLOAD_DIR` and returns a
 *   root-relative `/uploads/<key>`, so stored content carries no `APP_URL`
 *   coupling and stays portable across domain changes.
 *
 * A root-relative URL only resolves for renderers on the app's own origin (the
 * iframe pages). Content served to *external* renderers must be absolutized
 * first — see `absolutizeUploadUrls`.
 */
export async function uploadToStorage(
  buffer: Buffer,
  filename: string,
  contentType: string
): Promise<string> {
  const key = `${randomBytes(16).toString("hex")}${resolveExt(filename, contentType)}`;

  if (useS3) {
    await getS3().send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET!,
        Key: `uploads/${key}`,
        Body: buffer,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000",
      })
    );
    return `${process.env.S3_PUBLIC_URL}/uploads/${key}`;
  }

  await mkdir(LOCAL_UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(LOCAL_UPLOAD_DIR, key), buffer);
  return `/uploads/${key}`;
}

/**
 * Rewrites root-relative `/uploads/...` URLs in stored HTML to absolute ones.
 *
 * Required for every surface that renders our content on someone *else's*
 * origin, because a root-relative URL there resolves against the customer's
 * domain and 404s:
 *
 * - the announcement widget, which injects content straight into the host page
 *   (no iframe), and where the editor is now the only way to add an image;
 * - headless API consumers, who fetch `content` and render their own UI.
 *
 * Only the local driver produces relative URLs — S3 already returns absolute
 * ones, and this is a no-op for them. Applied at serve time rather than upload
 * time so stored content keeps its portability across domain changes.
 */
export function absolutizeUploadUrls(html: string): string {
  const base = getAppUrl().replace(/\/$/, "");
  // Attribute name and the `=` are matched case- and whitespace-tolerantly
  // (`SRC = "…"` is valid HTML). The `/uploads/` path deliberately stays
  // case-sensitive: keys are lowercase hex, and `app/uploads/[key]` only serves
  // lowercase, so rewriting `/UPLOADS/` would just produce an absolute 404.
  return html.replace(
    /(\s(?:[sS][rR][cC]|[hH][rR][eE][fF])\s*=\s*)(["'])(\/uploads\/[^"']+)\2/g,
    (_match, attr: string, quote: string, urlPath: string) => `${attr}${quote}${base}${urlPath}${quote}`
  );
}
