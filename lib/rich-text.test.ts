import { describe, it, expect } from "vitest";
import { hasRichContent, richTextToPlain } from "./rich-text";

describe("richTextToPlain", () => {
  it("strips tags and decodes non-breaking spaces", () => {
    expect(richTextToPlain("<p>Hello&nbsp;there</p>")).toBe("Hello there");
  });

  it("is empty for an empty Quill document", () => {
    expect(richTextToPlain("<p><br></p>")).toBe("");
  });

  it("is empty for media-only content", () => {
    expect(richTextToPlain('<p><img src="https://cdn/x.png"></p>')).toBe("");
  });
});

describe("hasRichContent", () => {
  it("rejects an empty Quill document", () => {
    expect(hasRichContent("<p><br></p>")).toBe(false);
    expect(hasRichContent("")).toBe(false);
    expect(hasRichContent("<p>   </p>")).toBe(false);
  });

  it("accepts plain text", () => {
    expect(hasRichContent("<p>Shipped a thing</p>")).toBe(true);
  });

  // These are the regression cases: media strips to an empty string, which
  // previously made an image-only or video-only post impossible to save.
  it("accepts an image-only document", () => {
    expect(hasRichContent('<p><img src="https://cdn/x.png"></p>')).toBe(true);
  });

  it("accepts a video-only document", () => {
    expect(
      hasRichContent('<iframe class="ql-video" src="https://www.youtube.com/embed/abc"></iframe><p><br></p>')
    ).toBe(true);
  });

  it("does not mistake a text mention of img for media", () => {
    expect(hasRichContent("<p></p>")).toBe(false);
    expect(hasRichContent("<imgfoo>")).toBe(false);
  });
});
