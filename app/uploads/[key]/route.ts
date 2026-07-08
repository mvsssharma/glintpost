import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { LOCAL_UPLOAD_DIR } from "@/lib/storage";

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

// Keys are server-generated in lib/storage.ts: 32 hex chars + a known image
// extension. Reject anything else — this also forecloses path traversal (a
// single dynamic segment can't contain "/", and the charset excludes ".").
const KEY_RE = /^[a-f0-9]{32}\.(jpg|jpeg|png|gif|webp|svg)$/;

type Context = { params: Promise<{ key: string }> };

export async function GET(_req: Request, context: Context) {
  const { key } = await context.params;

  if (!KEY_RE.test(key)) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const file = await readFile(path.join(LOCAL_UPLOAD_DIR, key));
    const ext = path.extname(key).toLowerCase();
    return new NextResponse(new Uint8Array(file), {
      headers: {
        "Content-Type": CONTENT_TYPE_BY_EXT[ext] ?? "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
