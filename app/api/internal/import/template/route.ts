import { NextResponse } from "next/server";
import { requireOrgApi } from "@/lib/auth-helpers";
import { buildTemplate, IMPORT_TYPES, type ImportType } from "@/lib/import-excel";
import { logger } from "@/lib/logger";
import { ValidationError, ApiError } from "@/lib/errors";

export async function GET(req: Request) {
  try {
    const auth = await requireOrgApi();
    if (auth.error) return auth.error;

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    if (!type || !IMPORT_TYPES.includes(type as ImportType)) {
      throw new ValidationError("Invalid import type");
    }

    const buffer = await buildTemplate(type as ImportType);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="glintpost-${type}-import-template.xlsx"`,
      },
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to build import template");
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Failed to build import template" }, { status: 500 });
  }
}
