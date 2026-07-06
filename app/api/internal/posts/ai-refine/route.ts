import { NextResponse } from "next/server";
import { requireOrgApi } from "@/lib/auth-helpers";
import { getOrgPrisma } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { aiRefineSchema } from "@/lib/validations";
import { extractBlocks, reassembleBlocks, htmlToText, type OutBlock } from "@/lib/html-segments";
import { sanitizeRichHtml } from "@/lib/sanitize-html";
import { getEffectiveTerms, checkTerms } from "@/lib/glossary";
import { getRecentPostTexts, readNomenclature } from "@/lib/nomenclature";
import { rewriteDocument } from "@/lib/llm";

/**
 * "Refine with AI" — dashboard-only. Holistically rewrites the current editor HTML in a
 * single language while keeping media, links, formatting and code byte-identical (the model
 * never sees them; see lib/html-segments.ts). Session auth (never API-key), no CORS/OPTIONS.
 * Operates on unsaved editor state.
 */
export async function POST(req: Request) {
  const auth = await requireOrgApi();
  if (auth.error) return auth.error;
  const { session } = auth;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = aiRefineSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const db = getOrgPrisma(session.orgId);
  const settings = await db.orgSettings.findUnique({ where: { orgId: session.orgId } });

  if (!settings?.aiProvider || !settings.aiApiKey || !settings.aiModel) {
    return NextResponse.json(
      { error: "AI is not configured. Add a provider in Settings → AI configuration." },
      { status: 422 },
    );
  }

  const sanitizedInput = sanitizeRichHtml(parsed.data.content);
  const { blocks, ctx } = extractBlocks(sanitizedInput);

  // Nothing rewritable (empty content) — return input untouched.
  if (blocks.length === 0) {
    return NextResponse.json({ content: sanitizedInput, terminologyWarnings: [] });
  }

  const sourceText = htmlToText(sanitizedInput);
  const recentPosts = await getRecentPostTexts(db, 5);
  const terms = getEffectiveTerms(readNomenclature(settings.nomenclature), sourceText, recentPosts);

  let apiKey: string;
  try {
    apiKey = await decrypt(settings.aiApiKey);
  } catch {
    return NextResponse.json({ error: "Stored AI key could not be read." }, { status: 500 });
  }

  const cfg = {
    provider: settings.aiProvider,
    apiKey,
    model: settings.aiModel,
    writingContext: settings.aiWritingContext,
    terms,
  };

  let transformed: OutBlock[];
  try {
    transformed = await rewriteDocument(blocks, cfg);
  } catch (err) {
    console.error("ai-refine provider error:", err);
    return NextResponse.json({ error: "The AI provider could not be reached. Please try again." }, { status: 502 });
  }

  // Reassemble first so the terminology check runs against the FINAL rendered text
  // (link anchors, bold spans, etc. restored) rather than opaque ⟦…⟧ tokens — otherwise
  // terms that live only inside a link/format span would look "vanished" and trigger a
  // needless retry. Reassembly is also the token-integrity gate; failure = leave unchanged.
  let content: string;
  try {
    content = reassembleBlocks(ctx, transformed);
  } catch (err) {
    console.error("ai-refine reassembly failed:", err);
    return NextResponse.json(
      { error: "AI response could not be applied safely — your content was not changed." },
      { status: 502 },
    );
  }

  // Terminology check + one corrective retry.
  let warnings = checkTerms(sourceText, htmlToText(content), terms);
  if (warnings.length > 0) {
    const lost = warnings.map((w) => w.match(/^"(.+?)"/)?.[1]).filter(Boolean);
    try {
      const retry = await rewriteDocument(blocks, {
        ...cfg,
        corrective: `Keep these exact terms from the source text, unchanged: ${lost.join(", ")}.`,
      });
      const retryContent = reassembleBlocks(ctx, retry);
      const retryWarnings = checkTerms(sourceText, htmlToText(retryContent), terms);
      if (retryWarnings.length < warnings.length) {
        content = retryContent;
        warnings = retryWarnings;
      }
    } catch (err) {
      console.error("ai-refine terminology retry failed:", err);
      // keep the first result + its warnings
    }
  }

  return NextResponse.json({ content, terminologyWarnings: warnings });
}
