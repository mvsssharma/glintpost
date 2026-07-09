import sanitizeHtml from "sanitize-html";

/**
 * Sanitize rich-text HTML from the post/announcement editor (Quill) before it is
 * rendered or served.
 *
 * Uses `sanitize-html` (pure JS, no DOM/jsdom) rather than DOMPurify+jsdom: jsdom's
 * transitive deps do nested `require()` of ESM, which Vercel's Fluid/bytecode module
 * loader can't load at runtime (ERR_REQUIRE_ESM -> FUNCTION_INVOCATION_FAILED on any
 * sanitize path). `sanitize-html` has a pure-CommonJS dependency tree, so it bundles
 * and loads cleanly on every runtime.
 *
 * Allowlist mirrors the editor's output and the previous DOMPurify behavior: it KEEPS
 * `<iframe>` because Quill stores video embeds as `<iframe class="ql-video">` (default
 * sanitization would silently delete users' videos), while stripping scripts, event
 * handlers, and dangerous URI schemes (javascript:, etc.).
 */
const ALLOWED_TAGS = [
  "h1", "h2", "h3", "h4", "h5", "h6", "p", "br", "hr", "div", "span",
  "strong", "b", "em", "i", "u", "s", "strike", "del", "ins", "sub", "sup", "small", "mark",
  "abbr", "cite", "q", "kbd", "samp",
  "ol", "ul", "li", "blockquote", "pre", "code",
  "a", "img", "iframe", "figure", "figcaption",
  "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "colgroup", "col", "dl", "dt", "dd",
];

export function sanitizeRichHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ["href", "name", "target", "rel"],
      img: ["src", "alt", "title", "width", "height"],
      iframe: ["src", "class", "width", "height", "frameborder", "allow", "allowfullscreen", "scrolling"],
      // Quill uses class (ql-*) and data-list (bullet/ordered) for formatting.
      "*": ["class", "style", "data-list"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesByTag: { img: ["http", "https", "data"], iframe: ["http", "https"] },
    allowProtocolRelative: false,
    // <script>/<style> tags and their contents are dropped by default (nonTextTags).
  });
}
