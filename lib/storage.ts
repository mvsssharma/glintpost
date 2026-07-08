import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { randomBytes } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

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
 *   root-relative `/uploads/<key>`. Post/announcement HTML is only ever rendered
 *   inside app-origin iframe pages, so the relative URL resolves correctly on any
 *   domain — no `APP_URL` coupling and portable across domain changes.
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
