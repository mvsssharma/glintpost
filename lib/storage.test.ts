import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { absolutizeUploadUrls } from "./storage";

const ORIGINAL = process.env.APP_URL;
beforeEach(() => {
  process.env.APP_URL = "https://updates.acme.com";
});
afterEach(() => {
  process.env.APP_URL = ORIGINAL;
});

describe("absolutizeUploadUrls", () => {
  it("absolutizes a root-relative local-driver image", () => {
    expect(absolutizeUploadUrls('<p><img src="/uploads/abc.png"></p>')).toBe(
      '<p><img src="https://updates.acme.com/uploads/abc.png"></p>'
    );
  });

  it("leaves absolute S3 URLs untouched", () => {
    const html = '<p><img src="https://cdn.example.com/uploads/abc.png"></p>';
    expect(absolutizeUploadUrls(html)).toBe(html);
  });

  it("handles single quotes and href", () => {
    expect(absolutizeUploadUrls("<a href='/uploads/x.pdf'>d</a>")).toBe(
      "<a href='https://updates.acme.com/uploads/x.pdf'>d</a>"
    );
  });

  it("rewrites every occurrence", () => {
    expect(
      absolutizeUploadUrls('<img src="/uploads/a.png"><img src="/uploads/b.png">')
    ).toBe(
      '<img src="https://updates.acme.com/uploads/a.png"><img src="https://updates.acme.com/uploads/b.png">'
    );
  });

  // Only our own upload path is rewritten — an unrelated relative URL in the
  // customer's own content must not be touched.
  it("ignores non-upload relative URLs", () => {
    const html = '<a href="/pricing">Pricing</a>';
    expect(absolutizeUploadUrls(html)).toBe(html);
  });

  it("does not double-slash when APP_URL has a trailing slash", () => {
    process.env.APP_URL = "https://updates.acme.com/";
    expect(absolutizeUploadUrls('<img src="/uploads/a.png">')).toBe(
      '<img src="https://updates.acme.com/uploads/a.png">'
    );
  });

  it("leaves content with no uploads unchanged", () => {
    const html = "<p>Just text</p>";
    expect(absolutizeUploadUrls(html)).toBe(html);
  });

  // Quill + sanitize-html normalize to lowercase, but the changelog route serves
  // stored content unsanitized, so don't rely on that.
  it("handles uppercase attributes and spacing around =", () => {
    expect(absolutizeUploadUrls('<IMG SRC = "/uploads/a.png">')).toBe(
      '<IMG SRC = "https://updates.acme.com/uploads/a.png">'
    );
  });

  it("does not rewrite an uppercase /UPLOADS/ path that could not be served anyway", () => {
    const html = '<img src="/UPLOADS/a.png">';
    expect(absolutizeUploadUrls(html)).toBe(html);
  });
});
