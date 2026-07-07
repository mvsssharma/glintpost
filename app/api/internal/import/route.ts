import { NextResponse } from "next/server";
import { requireOrgApi } from "@/lib/auth-helpers";
import { getOrgPrisma } from "@/lib/db";
import { cacheInvalidate } from "@/lib/cache";
import { logger } from "@/lib/logger";
import { ValidationError, ApiError } from "@/lib/errors";
import {
  parseImportFile,
  IMPORT_TYPES,
  MAX_IMPORT_FILE_BYTES,
  validateImportUpload,
  type ImportType,
  type ParsedImport,
} from "@/lib/import-excel";

const CACHE_KEYS: Record<ImportType, string> = {
  posts: "changelog-posts",
  roadmap: "roadmap-items",
  announcements: "announcements",
};

type OrgDb = ReturnType<typeof getOrgPrisma>;
type Tx = Parameters<Parameters<OrgDb["$transaction"]>[0]>[0];

export async function POST(req: Request) {
  try {
    const auth = await requireOrgApi();
    if (auth.error) return auth.error;
    const orgId = auth.session.orgId;

    const formData = await req.formData();
    const type = formData.get("type");
    const file = formData.get("file");

    if (typeof type !== "string" || !IMPORT_TYPES.includes(type as ImportType)) {
      throw new ValidationError("Invalid import type");
    }
    if (!(file instanceof File)) {
      throw new ValidationError("No file uploaded");
    }
    if (file.size > MAX_IMPORT_FILE_BYTES) {
      throw new ValidationError(
        `File too large. The limit is ${Math.round(MAX_IMPORT_FILE_BYTES / 1024 / 1024)}MB.`
      );
    }
    const fileError = validateImportUpload(file);
    if (fileError) {
      throw new ValidationError(fileError);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { parsed, errors } = await parseImportFile(type as ImportType, buffer);

    // All-or-nothing: any invalid row aborts the whole import so a fixed
    // re-upload never creates duplicates of the rows that were valid.
    if (!parsed || errors.length > 0) {
      return NextResponse.json({ errors }, { status: 400 });
    }

    const db = getOrgPrisma(orgId);
    await importRows(db, orgId, parsed);

    cacheInvalidate(orgId, CACHE_KEYS[parsed.type]);
    return NextResponse.json({ imported: parsed.rows.length });
  } catch (error) {
    logger.error({ err: error }, "Import failed");
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Import failed. Nothing was saved." }, { status: 500 });
  }
}

async function importRows(db: OrgDb, orgId: string, parsed: ParsedImport): Promise<void> {
  if (parsed.type === "posts") {
    await db.$transaction(
      async (tx: Tx) => {
        const batchSize = 50;
        for (let i = 0; i < parsed.rows.length; i += batchSize) {
          const chunk = parsed.rows.slice(i, i + batchSize);
          await Promise.all(
            chunk.map((row) =>
              tx.post.create({
                data: {
                  orgId,
                  status: row.status,
                  publishedAt: row.status === "PUBLISHED" ? row.date : null,
                  createdAt: row.date,
                  translations: {
                    create: { orgId, locale: "en", title: row.title, content: row.content },
                  },
                },
              })
            )
          );
        }
      },
      { timeout: 120_000 }
    );
    return;
  }

  if (parsed.type === "roadmap") {
    await db.roadmapItem.createMany({
      data: parsed.rows.map((row) => ({
        orgId,
        title: row.title,
        description: row.description,
        status: row.status,
        createdAt: row.date,
        importedUpvotes: row.upvotes,
        importedDownvotes: row.downvotes,
      })),
    });
    return;
  }

  await db.announcement.createMany({
    data: parsed.rows.map((row) => ({
      orgId,
      title: row.title,
      content: row.content,
      displayType: row.displayType,
      status: row.status,
      startDate: row.startDate,
      endDate: row.endDate,
      priority: row.priority,
      ctaText: row.ctaText,
      ctaUrl: row.ctaUrl,
      imageUrl: row.imageUrl,
      createdAt: row.startDate,
    })),
  });
}
