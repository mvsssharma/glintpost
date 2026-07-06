import DOMPurify from "isomorphic-dompurify";

/**
 * Sanitize rich-text HTML produced by the post/announcement editor.
 *
 * Unlike default DOMPurify, this KEEPS `<iframe>` embeds — that is how Quill's "video"
 * toolbar button stores content (`<iframe class="ql-video" …>`). Default sanitization
 * strips `<iframe>` entirely, which would silently drop embedded videos. Use this
 * everywhere the refine pipeline parses or emits post HTML so the "media preserved
 * byte-identical" guarantee also holds for video embeds.
 *
 * `src`/`class`/`width`/`height` are already in DOMPurify's defaults; we add the
 * iframe-specific presentation attributes Quill emits. DOMPurify still validates the
 * `src` URI (e.g. blocks `javascript:`), and this content is authored by authenticated
 * dashboard users (same trust boundary as the editor itself).
 */
export function sanitizeRichHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ADD_TAGS: ["iframe"],
    ADD_ATTR: ["allow", "allowfullscreen", "frameborder", "scrolling"],
  });
}
