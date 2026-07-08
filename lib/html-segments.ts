/**
 * Document-wide token pipeline for "Refine with AI". The model never sees HTML or media:
 * the post is parsed into ordered plain-text BLOCKS, and links, media, inline-formatted
 * phrases, and code/tables become opaque tokens (⟦L0⟧/⟦M0⟧/⟦F0⟧/⟦B0⟧) mapped server-side.
 * The model may rewrite/merge/split/reorder blocks freely, but every token must survive
 * EXACTLY ONCE; we render the returned blocks to HTML ourselves and restore each token
 * byte-identical. So media/links can't change (by construction, not prompting) and cost
 * no vision tokens; the model places them by surrounding-text context.
 *
 * Tradeoff: links/formatted phrases are tokenized whole, so their visible text can be
 * repositioned but not reworded — a deliberate safety choice.
 */
import * as cheerio from "cheerio";
import type { AnyNode, Element as DomElement } from "domhandler";
import { isTag, isText } from "domhandler";
import { sanitizeRichHtml } from "./sanitize-html";

/** A content block handed to / returned by the model. `text`/`items` are PLAIN TEXT + tokens. */
export type Block =
  | { type: "p" | "quote"; text: string }
  | { type: "h"; level: number; text: string }
  | { type: "ul" | "ol"; items: string[] }
  | { type: "raw"; token: string };

/** What the model returns — same shape, `level` optional (we default/clamp it). */
export type OutBlock =
  | { type: "p" | "quote"; text: string }
  | { type: "h"; level?: number; text: string }
  | { type: "ul" | "ol"; items: string[] }
  | { type: "raw"; token: string };

export interface PipelineContext {
  tokenMap: Map<string, string>; // token -> original element outerHTML
}

const SKIP_TAGS = new Set(["script", "style"]);
const OPAQUE_BLOCK_TAGS = new Set(["pre", "table"]);
const MEDIA_TAGS = new Set(["img", "video", "iframe", "audio", "embed", "object"]);
const INLINE_FORMAT_TAGS = new Set([
  "strong", "b", "em", "i", "u", "s", "del", "ins", "code",
  "sub", "sup", "mark", "small", "abbr", "kbd",
]);
// Elements that belong to inline flow even when they appear at block position.
const INLINE_TAGS = new Set(["a", "span", "br", ...MEDIA_TAGS, ...INLINE_FORMAT_TAGS]);

const TOKEN_RE = /⟦[LMFB]\d+⟧/g;
const ALLOWED_BLOCK_TYPES = new Set(["p", "quote", "h", "ul", "ol", "raw"]);

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Parse HTML into an ordered list of plain-text blocks + a context holding the token map.
 * Media, links, inline-formatted phrases and opaque blocks are tokenized here so they can
 * never reach the model.
 */
export function extractBlocks(html: string): { blocks: Block[]; ctx: PipelineContext } {
  const $ = cheerio.load(html, null, false);
  const ctx: PipelineContext = { tokenMap: new Map() };
  const blocks: Block[] = [];
  let tokId = 0;

  function tokenize(el: DomElement, prefix: "L" | "M" | "F" | "B"): string {
    const token = `⟦${prefix}${tokId++}⟧`;
    ctx.tokenMap.set(token, $.html(el));
    return token;
  }

  // Flatten a block's inline children to a plain-text string with tokens.
  function buildInline(children: AnyNode[]): string {
    let out = "";
    for (const node of children) {
      if (isText(node)) {
        out += node.data;
        continue;
      }
      if (!isTag(node)) continue;
      const name = node.name.toLowerCase();
      if (name === "br") { out += " "; continue; }
      if (name === "a") { out += tokenize(node, "L"); continue; }
      if (MEDIA_TAGS.has(name)) { out += tokenize(node, "M"); continue; }
      if (INLINE_FORMAT_TAGS.has(name)) { out += tokenize(node, "F"); continue; }
      if (name === "span") {
        // A styled span (colour, background, …) is preserved verbatim; a bare one is unwrapped.
        if (node.attribs && Object.keys(node.attribs).length > 0) out += tokenize(node, "F");
        else out += buildInline(node.children);
        continue;
      }
      if (SKIP_TAGS.has(name)) continue;
      out += buildInline(node.children);
    }
    return out.replace(/\s+/g, " ").trim();
  }

  function walk(children: AnyNode[]) {
    let inlineBuf: AnyNode[] = [];
    const flush = () => {
      if (inlineBuf.length === 0) return;
      const text = buildInline(inlineBuf);
      inlineBuf = [];
      if (text) blocks.push({ type: "p", text });
    };

    for (const child of children) {
      if (isText(child)) {
        if (child.data.trim() !== "") inlineBuf.push(child);
        continue;
      }
      if (!isTag(child)) continue;
      const name = child.name.toLowerCase();

      if (INLINE_TAGS.has(name)) { inlineBuf.push(child); continue; }
      if (SKIP_TAGS.has(name)) continue;

      if (name === "p") {
        flush();
        const t = buildInline(child.children);
        if (t) blocks.push({ type: "p", text: t });
        continue;
      }
      if (/^h[1-6]$/.test(name)) {
        flush();
        const t = buildInline(child.children);
        // Clamp to 1–3 to match the editor's `header: [1, 2, 3]` config — Quill never
        // produces h4–h6, so editor content is never actually flattened. Revisit if the
        // editor ever enables deeper headings.
        if (t) blocks.push({ type: "h", level: clamp(parseInt(name[1], 10), 1, 3), text: t });
        continue;
      }
      if (name === "blockquote") {
        flush();
        const t = buildInline(child.children);
        if (t) blocks.push({ type: "quote", text: t });
        continue;
      }
      if (name === "ul" || name === "ol") {
        flush();
        const items: string[] = [];
        for (const li of child.children) {
          if (isTag(li) && li.name.toLowerCase() === "li") {
            const it = buildInline(li.children);
            if (it) items.push(it);
          }
        }
        if (items.length > 0) blocks.push({ type: name as "ul" | "ol", items });
        continue;
      }
      if (OPAQUE_BLOCK_TAGS.has(name)) {
        flush();
        blocks.push({ type: "raw", token: tokenize(child, "B") });
        continue;
      }

      // Unknown container (div/section/figure/…): recurse to find its blocks.
      flush();
      walk(child.children);
    }
    flush();
  }

  const root = $.root()[0] as unknown as DomElement;
  walk(root.children ?? []);

  return { blocks, ctx };
}

/**
 * Render the model's returned blocks back to sanitized HTML, restoring every token.
 * Throws on ANY validation failure — callers MUST treat that as "leave content unchanged"
 * (no partial writes). Guarantees: every original token appears exactly once, no unknown
 * or duplicated tokens, no raw markup smuggled through a block's text.
 */
export function reassembleBlocks(ctx: PipelineContext, outBlocks: OutBlock[]): string {
  const required = new Set(ctx.tokenMap.keys());
  const seen = new Set<string>();

  const consumeTokens = (s: string) => {
    for (const m of s.matchAll(TOKEN_RE)) {
      const tok = m[0];
      if (!required.has(tok)) throw new Error(`Unknown token ${tok}`);
      if (seen.has(tok)) throw new Error(`Duplicate token ${tok}`);
      seen.add(tok);
    }
  };
  const guardPlain = (s: string) => {
    if (/[<>]/.test(s)) throw new Error("Block text contains markup");
  };

  if (!Array.isArray(outBlocks)) throw new Error("Model did not return a blocks array");

  const parts: string[] = [];
  for (const b of outBlocks) {
    if (!b || typeof b !== "object" || !ALLOWED_BLOCK_TYPES.has((b as { type?: string }).type ?? "")) {
      throw new Error("Invalid block in model response");
    }
    switch (b.type) {
      case "ul":
      case "ol": {
        if (!Array.isArray(b.items)) throw new Error(`${b.type} block missing items`);
        const lis = b.items.map((it) => {
          if (typeof it !== "string") throw new Error("List item is not a string");
          guardPlain(it);
          consumeTokens(it);
          return `<li>${renderInline(it, ctx.tokenMap)}</li>`;
        });
        if (lis.length > 0) parts.push(`<${b.type}>${lis.join("")}</${b.type}>`);
        break;
      }
      case "raw": {
        const token = b.token;
        if (typeof token !== "string" || !required.has(token)) throw new Error("Invalid raw-block token");
        if (seen.has(token)) throw new Error(`Duplicate token ${token}`);
        seen.add(token);
        parts.push(ctx.tokenMap.get(token)!);
        break;
      }
      default: {
        // p | quote | h
        const text = (b as { text?: unknown }).text;
        if (typeof text !== "string") throw new Error(`${b.type} block missing text`);
        guardPlain(text);
        consumeTokens(text);
        const inner = renderInline(text, ctx.tokenMap);
        if (!inner) break;
        if (b.type === "h") {
          const lvl = clamp(typeof b.level === "number" ? b.level : 2, 1, 3);
          parts.push(`<h${lvl}>${inner}</h${lvl}>`);
        } else if (b.type === "quote") {
          parts.push(`<blockquote>${inner}</blockquote>`);
        } else {
          parts.push(`<p>${inner}</p>`);
        }
      }
    }
  }

  if (seen.size !== required.size) {
    const missing = [...required].filter((t) => !seen.has(t));
    throw new Error(`Model dropped tokens: ${missing.join(", ")}`);
  }

  return sanitizeRichHtml(parts.join(""));
}

function renderInline(text: string, tokenMap: Map<string, string>): string {
  let result = "";
  let last = 0;
  for (const m of text.matchAll(TOKEN_RE)) {
    const idx = m.index ?? 0;
    result += escapeHtml(text.slice(last, idx));
    result += tokenMap.get(m[0]) ?? "";
    last = idx + m[0].length;
  }
  result += escapeHtml(text.slice(last));
  return result;
}

/** Plain-text extraction from stored HTML (for term derivation / style examples). */
export function htmlToText(html: string): string {
  const $ = cheerio.load(html, null, false);
  return $.root().text().replace(/\s+/g, " ").trim();
}
