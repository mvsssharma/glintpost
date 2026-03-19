import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-key";
import { corsHeaders, handlePreflight } from "@/lib/cors";
import { prisma } from "@/lib/db";

export async function OPTIONS(req: NextRequest) {
  return handlePreflight(req);
}

export async function GET(req: NextRequest) {
  const org = await validateApiKey(req);

  if (!org) {
    return NextResponse.json(
      { error: "Invalid or missing API key" },
      { status: 401 }
    );
  }

  const origin = req.headers.get("origin");
  const cors = corsHeaders(origin, org.settings?.allowedDomain ?? null);

  const form = await prisma.feedbackForm.findUnique({
    where: { orgId: org.id },
  });

  if (!form || !form.enabled) {
    return NextResponse.json(
      { error: "No active feedback form" },
      { status: 404, headers: cors }
    );
  }

  return NextResponse.json(
    {
      id: form.id,
      title: form.title,
      questions: form.questions,
    },
    { headers: cors }
  );
}
