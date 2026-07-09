import { describe, it, expect } from "vitest";
import { sanitizeRichHtml } from "./sanitize-html";

describe("sanitizeRichHtml", () => {
  it("strips <script> tags and their content", () => {
    const out = sanitizeRichHtml("<script>alert(1)</script><p>after</p>");
    expect(out).not.toContain("script");
    expect(out).not.toContain("alert");
    expect(out).toContain("<p>after</p>");
  });

  it("strips inline event handlers", () => {
    expect(sanitizeRichHtml('<img src=x onerror=alert(1)>')).not.toContain("onerror");
    expect(sanitizeRichHtml('<p onclick="alert(1)">x</p>')).not.toContain("onclick");
  });

  it("strips javascript: URIs on links and iframes", () => {
    expect(sanitizeRichHtml('<a href="javascript:alert(1)">x</a>')).not.toContain("javascript:");
    expect(sanitizeRichHtml('<iframe src="javascript:alert(1)"></iframe>')).not.toContain("javascript:");
  });

  it("keeps Quill video embeds (iframe.ql-video)", () => {
    const out = sanitizeRichHtml(
      '<iframe class="ql-video" frameborder="0" allowfullscreen="true" src="https://www.youtube.com/embed/abc"></iframe>'
    );
    expect(out).toContain("<iframe");
    expect(out).toContain('class="ql-video"');
    expect(out).toContain("https://www.youtube.com/embed/abc");
  });

  it("preserves standard editor formatting", () => {
    const html =
      '<h1>Title</h1><p><strong>b</strong> <em>i</em> <u>u</u> <s>s</s></p>' +
      '<ul><li>a</li></ul><ol><li data-list="ordered">1</li></ol>' +
      '<blockquote>q</blockquote><pre><code>c</code></pre>';
    const out = sanitizeRichHtml(html);
    for (const frag of ["<h1>Title</h1>", "<strong>b</strong>", "<em>i</em>", "<u>u</u>", "<s>s</s>", "<li>a</li>", 'data-list="ordered"', "<blockquote>q</blockquote>", "<code>c</code>"]) {
      expect(out).toContain(frag);
    }
  });

  it("keeps safe links and images", () => {
    expect(sanitizeRichHtml('<a href="https://x.com" rel="noopener">l</a>')).toContain('href="https://x.com"');
    expect(sanitizeRichHtml('<a href="mailto:a@b.com">m</a>')).toContain("mailto:a@b.com");
    expect(sanitizeRichHtml('<img src="https://cdn/x.png" alt="p">')).toContain('src="https://cdn/x.png"');
  });

  it("drops <svg> (not an editor format; XSS vector)", () => {
    expect(sanitizeRichHtml("<svg onload=alert(1)></svg><p>ok</p>")).toBe("<p>ok</p>");
  });

  it("preserves unicode and entities", () => {
    expect(sanitizeRichHtml("<p>Ünïcödé &amp; <b>bold</b></p>")).toContain("Ünïcödé");
  });
});
