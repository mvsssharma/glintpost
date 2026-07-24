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
});
