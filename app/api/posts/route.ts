import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getOrgPrisma } from "@/lib/db";
import { createPostSchema } from "@/lib/validations";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session.orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = createPostSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const { title, content } = parsed.data;
    const db = getOrgPrisma(session.orgId);

    const post = await db.post.create({
      data: {
        orgId: session.orgId,
        status: "PUBLISHED",
        publishedAt: new Date(),
        translations: {
          create: {
            locale: "en",
            title,
            content,
          },
        },
      },
      include: { translations: true },
    });

    return NextResponse.json(post, { status: 201 });
  } catch (error) {
    console.error("Failed to create post:", error);
    return NextResponse.json(
      { error: "Failed to create post" },
      { status: 500 }
    );
  }
}
