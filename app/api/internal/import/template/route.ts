import { NextResponse } from "next/server";
import { requireOrgApi } from "@/lib/auth-helpers";
import { buildTemplate, IMPORT_TYPES, type ImportType } from "@/lib/import-excel";

export async function GET(req: Request) {
  const auth = await requireOrgApi();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  if (!type || !IMPORT_TYPES.includes(type as ImportType)) {
    return NextResponse.json({ error: "Invalid import type" }, { status: 400 });
  }

  const buffer = await buildTemplate(type as ImportType);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="glintpost-${type}-import-template.xlsx"`,
    },
  });
}
