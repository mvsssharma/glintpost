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

    const posts = (await db.post.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { publishedAt: "desc" },
      take: 20,
      include: {
        translations: { where: { locale: "en" }, take: 1 },
        _count: {
          select: {
            engagements: { where: { type: "LIKE" } },
          },
        },
      },
    })) as Array<{
      id: string;
      publishedAt: Date | null;
      createdAt: Date;
      translations: Array<{ title: string; content: string }>;
      _count: { engagements: number };
    }>;

    // _count only supports one filter per relation, so query dislikes separately
    const postIds = posts.map((p) => p.id);
    const dislikeCounts = await db.engagementEvent.groupBy({
      by: ["postId"],
      where: { postId: { in: postIds }, type: "DISLIKE" },
      _count: true,
    });
    const dislikeMap = Object.fromEntries(
      dislikeCounts.map((d: { postId: string | null; _count: number }) => [d.postId, d._count])
    );

    const result = posts.map((post) => ({
      id: post.id,
      title: post.translations[0]?.title ?? "Untitled",
      content: post.translations[0]?.content ?? "",
      createdAt: post.publishedAt ?? post.createdAt,
      likes: post._count.engagements,
      dislikes: (dislikeMap[post.id] as number) ?? 0,
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
