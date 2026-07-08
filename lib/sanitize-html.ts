import DOMPurify from "isomorphic-dompurify";

/**
 * Sanitize rich-text HTML from the post/announcement editor. Unlike default DOMPurify,
 * this KEEPS `<iframe>` — Quill stores video embeds as `<iframe class="ql-video">`, so
 * default sanitization silently deletes users' videos. Use this everywhere post HTML is
 * rendered or served; DOMPurify still validates the src URI (blocks javascript: etc.).
 */
export function sanitizeRichHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ADD_TAGS: ["iframe"],
    ADD_ATTR: ["allow", "allowfullscreen", "frameborder", "scrolling"],
  });
}
