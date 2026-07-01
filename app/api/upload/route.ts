import { NextResponse } from "next/server";
import { requireOrgApi } from "@/lib/auth-helpers";
import { prisma } from "@/lib/db";
import { uploadToStorage } from "@/lib/storage";

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
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "File too large (max 5MB)" },
        { status: 400 }
      );
    }

    const settings = await prisma.orgSettings.findUnique({
      where: { orgId: session.orgId },
      select: { storageUsedBytes: true, storageCapBytes: true },
    });

    if (settings) {
      const used = Number(settings.storageUsedBytes);
      const cap = Number(settings.storageCapBytes);
      if (used + file.size > cap) {
        return NextResponse.json(
          { error: `Storage limit exceeded (${Math.round(cap / 1024 / 1024)}MB). Delete unused images or upgrade your plan.` },
          { status: 400 }
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
    console.error("Upload failed:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
