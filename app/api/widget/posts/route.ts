import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-key";
import { getOrgPrisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const org = await validateApiKey(req);

  if (!org) {
    return NextResponse.json(
      { error: "Invalid or missing API key" },
      { status: 401 }
    );
  }

  try {
    const db = getOrgPrisma(org.id);

    const posts = await db.post.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { publishedAt: "desc" },
      take: 20,
      include: {
        translations: { where: { locale: "en" }, take: 1 },
      },
    });

    const result = posts.map((post) => ({
      id: post.id,
      title: post.translations[0]?.title ?? "Untitled",
      content: post.translations[0]?.content ?? "",
      createdAt: post.publishedAt ?? post.createdAt,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to fetch widget posts:", error);
    return NextResponse.json(
      { error: "Failed to fetch posts" },
      { status: 500 }
    );
  }
}
