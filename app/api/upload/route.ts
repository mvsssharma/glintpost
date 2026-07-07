import { NextResponse } from "next/server";
import { requireOrgApi } from "@/lib/auth-helpers";
import { prisma } from "@/lib/db";
import { uploadToStorage } from "@/lib/storage";
import { logger } from "@/lib/logger";
import { ValidationError, ApiError } from "@/lib/errors";

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
]);

const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(req: Request) {
  try {
    const auth = await requireOrgApi();
    if (auth.error) return auth.error;
    const { session } = auth;

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      throw new ValidationError("No file provided");
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      throw new ValidationError("Invalid file type");
    }
    if (file.size > MAX_SIZE) {
      throw new ValidationError("File too large (max 5MB)");
    }

    const settings = await prisma.orgSettings.findUnique({
      where: { orgId: session.orgId },
      select: { storageUsedBytes: true, storageCapBytes: true },
    });

    if (settings) {
      const used = Number(settings.storageUsedBytes);
      const cap = Number(settings.storageCapBytes);
      if (used + file.size > cap) {
        throw new ValidationError(
          `Storage limit exceeded (${Math.round(cap / 1024 / 1024)}MB). Delete unused images or upgrade your plan.`
        );
      }
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const url = await uploadToStorage(buffer, file.name, file.type);

    if (settings) {
      await prisma.orgSettings.update({
        where: { orgId: session.orgId },
        data: { storageUsedBytes: { increment: BigInt(file.size) } },
      });
    }

    return NextResponse.json({ url });
  } catch (error) {
    logger.error({ err: error }, "Upload failed");
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
