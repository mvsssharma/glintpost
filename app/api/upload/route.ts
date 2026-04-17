import { NextResponse } from "next/server";
import { auth } from "@/auth";
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
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    const buffer = Buffer.from(await file.arrayBuffer());
    const url = await uploadToStorage(buffer, file.name, file.type);

    return NextResponse.json({ url });
  } catch (error) {
    console.error("Upload failed:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
