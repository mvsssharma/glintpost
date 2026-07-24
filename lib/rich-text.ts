/**
 * Helpers for reasoning about rich-text (Quill) HTML in the editor forms.
 */

/** Plain text of a rich-text document, with tags and entities stripped. */
export function richTextToPlain(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
}

/**
 * Whether a rich-text document has anything worth publishing.
 *
 * Text alone is not a sufficient test: images and video embeds are the only way
 * to add media (there is no separate media URL field), and both strip to an
 * empty string. Treating them as empty made an image-only or video-only post
 * impossible to save.
 *
 * Only `img` and `iframe` count, matching the tags that survive
 * `sanitizeRichHtml`. `<video>` is not in that allowlist, so accepting it here
 * would let a document pass validation and then publish as empty.
 */
export function hasRichContent(html: string): boolean {
  return richTextToPlain(html).length > 0 || /<(?:img|iframe)\b/i.test(html);
}
